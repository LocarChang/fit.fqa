(() => {
  'use strict';

  const DATA_URL = 'data/dashboard.json';
  const AUTO_REFRESH_MS = 60_000;
  const STALE_AFTER_MS = 15 * 60_000;
  const statuses = [
    ['passed', 'Passed', '#1ca77d'],
    ['failed', 'Failed', '#eb4657'],
    ['blocked', 'Blocked', '#8e3bc5'],
    ['retest', 'Retest', '#ffad26'],
    ['untested', 'Untested', '#aebbc7'],
    ['skipped', 'Skipped', '#4d91d7']
  ];

  const ui = {
    selector: document.querySelector('[data-run-selector]'),
    project: document.querySelector('[data-project-filter]'),
    message: document.querySelector('[data-message]'),
    runName: document.querySelector('[data-run-name]'),
    passRate: document.querySelector('[data-pass-rate]'),
    passedRatio: document.querySelector('[data-passed-ratio]'),
    donut: document.querySelector('[data-donut]'),
    statusGrid: document.querySelector('[data-status-grid]'),
    testerList: document.querySelector('[data-tester-list]'),
    table: document.querySelector('[data-run-table]'),
    progressFill: document.querySelector('[data-progress-fill]'),
    progressText: document.querySelector('[data-progress-text]'),
    lastUpdated: document.querySelector('[data-last-updated]'),
    syncDot: document.querySelector('[data-sync-dot]'),
    refresh: document.querySelector('[data-refresh]')
  };

  let dashboard = null;
  let selectedRunId = null;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function text(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
  }

  function normaliseRun(raw, index) {
    if (!raw || typeof raw !== 'object') throw new Error(`test_runs[${index}] must be an object.`);
    const status = raw.status && typeof raw.status === 'object' ? raw.status : {};
    const normalStatus = Object.fromEntries(statuses.map(([key]) => [key, number(status[key])]));
    const statusTotal = Object.values(normalStatus).reduce((sum, value) => sum + value, 0);
    const totalCases = number(raw.total_cases, statusTotal);
    const executedCases = Math.min(number(raw.executed_cases, totalCases - normalStatus.untested), totalCases);
    const testers = Array.isArray(raw.testers) ? raw.testers.map((tester, testerIndex) => {
      if (!tester || typeof tester !== 'object') throw new Error(`testers[${testerIndex}] must be an object.`);
      const testerStatus = Object.fromEntries(statuses.map(([key]) => [key, number(tester[key])]));
      const testerTotal = number(tester.total_cases, Object.values(testerStatus).reduce((a, b) => a + b, 0));
      return {
        display_name: text(tester.display_name, `Tester ${testerIndex + 1}`),
        total_cases: testerTotal,
        ...testerStatus
      };
    }) : [];

    return {
      run_id: String(raw.run_id ?? index + 1),
      run_name: text(raw.run_name, `Test Run ${index + 1}`),
      project: text(raw.project, '-'),
      plan_name: text(raw.plan_name, '-'),
      build: text(raw.build, '-'),
      run_status: text(raw.run_status, 'Running'),
      estimated_time: text(raw.estimated_time, '00:00:00'),
      executed_time: text(raw.executed_time, '00:00:00'),
      total_cases: totalCases,
      executed_cases: executedCases,
      status: normalStatus,
      testers
    };
  }

  function parseDashboard(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Dashboard JSON root must be an object.');
    if (!Array.isArray(raw.test_runs)) throw new Error('Dashboard JSON requires a test_runs array.');
    const generatedAt = new Date(raw.generated_at);
    if (Number.isNaN(generatedAt.getTime())) throw new Error('generated_at must be a valid ISO date/time.');
    return { generated_at: generatedAt, test_runs: raw.test_runs.map(normaliseRun) };
  }

  function percentage(value, total) {
    return total > 0 ? Math.max(0, Math.min(100, value / total * 100)) : 0;
  }

  function formatPercent(value) {
    return `${Number(value.toFixed(1))}%`;
  }

  function setMessage(message = '') {
    ui.message.hidden = !message;
    ui.message.textContent = message;
  }

  function renderSyncState() {
    const age = Date.now() - dashboard.generated_at.getTime();
    ui.syncDot.className = `sync-dot ${age > STALE_AFTER_MS ? 'stale' : 'fresh'}`;
    ui.lastUpdated.textContent = `Last updated: ${dashboard.generated_at.toLocaleString()}${age > STALE_AFTER_MS ? ' — Data may be outdated' : ''}`;
  }

  function donutGradient(run) {
    let cursor = 0;
    const stops = [];
    statuses.forEach(([key, , colour]) => {
      const width = percentage(run.status[key], run.total_cases);
      if (width > 0) stops.push(`${colour} ${cursor}% ${cursor + width}%`);
      cursor += width;
    });
    return stops.length ? `conic-gradient(${stops.join(',')})` : '#aebbc7';
  }

  function renderStatus(run) {
    ui.statusGrid.replaceChildren(...statuses.map(([key, label, colour]) => {
      const item = document.createElement('div');
      item.className = 'status-item';
      item.innerHTML = `<span class="status-dot"></span><div class="status-copy"><strong></strong><small></small></div><span class="status-count"></span>`;
      item.querySelector('.status-dot').style.background = colour;
      item.querySelector('strong').textContent = label;
      item.querySelector('small').textContent = `${formatPercent(percentage(run.status[key], run.total_cases))} of cases`;
      item.querySelector('.status-count').textContent = run.status[key];
      return item;
    }));
  }

  function renderTesters(run) {
    if (!run.testers.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No tester progress available.';
      ui.testerList.replaceChildren(empty);
      return;
    }
    ui.testerList.replaceChildren(...run.testers.map(tester => {
      const row = document.createElement('div');
      row.className = 'tester-row';
      const name = document.createElement('span');
      name.className = 'tester-name';
      name.textContent = tester.display_name;
      name.title = tester.display_name;
      const bar = document.createElement('div');
      bar.className = 'tester-bar';
      statuses.forEach(([key, , colour]) => {
        const count = tester[key];
        if (!count) return;
        const segment = document.createElement('span');
        segment.className = 'tester-segment';
        segment.style.width = `${percentage(count, tester.total_cases)}%`;
        segment.style.background = colour;
        segment.textContent = count;
        segment.title = `${key}: ${count}`;
        bar.append(segment);
      });
      row.append(name, bar);
      return row;
    }));
  }

  function renderOverview(run) {
    selectedRunId = run.run_id;
    ui.selector.value = run.run_id;
    ui.runName.textContent = run.run_name;
    const passRate = percentage(run.status.passed, run.total_cases);
    ui.passRate.textContent = formatPercent(passRate);
    ui.passedRatio.textContent = `${run.status.passed} / ${run.total_cases} passed`;
    ui.donut.style.background = donutGradient(run);
    ui.donut.setAttribute('aria-label', `${run.run_name}: ${formatPercent(passRate)} pass rate`);
    const progress = percentage(run.executed_cases, run.total_cases);
    ui.progressFill.style.width = `${progress}%`;
    ui.progressText.textContent = `${run.executed_cases} / ${run.total_cases}`;
    renderStatus(run);
    renderTesters(run);
    renderTable();
    history.replaceState(null, '', `#run-${encodeURIComponent(run.run_id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function filteredRuns() {
    const project = ui.project.value;
    return dashboard.test_runs.filter(run => !project || run.project === project);
  }

  function renderRunSelector(preferredRunId = selectedRunId) {
    const runs = filteredRuns();
    ui.selector.replaceChildren(...runs.map(run => new Option(run.run_name, run.run_id)));
    const selected = runs.find(run => run.run_id === preferredRunId) || runs[0];
    ui.selector.disabled = runs.length === 0;
    if (selected) {
      renderOverview(selected);
    } else {
      selectedRunId = null;
      renderTable();
      setMessage('No Test Run is available for the selected Project.');
    }
  }

  function statusClass(value) {
    const candidate = value.toLowerCase().replace(/[^a-z]/g, '');
    return ['running', 'approving', 'completed', 'draft'].includes(candidate) ? candidate : 'draft';
  }

  function renderTable() {
    const runs = filteredRuns();
    ui.table.replaceChildren(...runs.map(run => {
      const row = document.createElement('tr');
      const progress = percentage(run.executed_cases, run.total_cases);
      row.innerHTML = `<td class="centre"><button class="view-button" type="button" title="View overview" aria-label="View overview">◉</button></td><td><button class="run-link" type="button"></button></td><td></td><td></td><td class="centre"><div class="mini-progress"><span></span><strong></strong></div></td><td class="centre"></td><td class="centre"></td><td class="centre"><span class="badge"></span></td>`;
      ['Overview', 'Recent Run', 'Plan', 'Build', 'Progress', 'Estimated time', 'Executed time', 'Status']
        .forEach((label, index) => { row.children[index].dataset.label = label; });
      const buttons = [row.querySelector('.view-button'), row.querySelector('.run-link')];
      buttons.forEach(button => button.addEventListener('click', () => renderOverview(run)));
      row.querySelector('.view-button').classList.toggle('active', run.run_id === selectedRunId);
      row.querySelector('.run-link').textContent = run.run_name;
      row.children[2].textContent = run.plan_name;
      row.children[3].textContent = run.build;
      row.querySelector('.mini-progress span').style.width = `${progress}%`;
      row.querySelector('.mini-progress strong').textContent = formatPercent(progress);
      row.children[5].textContent = run.estimated_time;
      row.children[6].textContent = run.executed_time;
      const badge = row.querySelector('.badge');
      badge.classList.add(statusClass(run.run_status));
      badge.textContent = run.run_status;
      return row;
    }));
  }

  function renderControls() {
    const projects = [...new Set(dashboard.test_runs.map(run => run.project))].sort();
    ui.project.replaceChildren(new Option('All projects', ''), ...projects.map(project => new Option(project, project)));
    const hashId = decodeURIComponent(location.hash.replace(/^#run-/, ''));
    const selected = dashboard.test_runs.find(run => run.run_id === hashId) || dashboard.test_runs[0];
    if (selected) {
      ui.project.value = selected.project;
      renderRunSelector(selected.run_id);
    }
    else setMessage('No Test Run data is available.');
  }

  async function loadDashboard() {
    ui.refresh.disabled = true;
    setMessage();
    try {
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to load dashboard.json (HTTP ${response.status}).`);
      dashboard = parseDashboard(await response.json());
      renderSyncState();
      renderControls();
    } catch (error) {
      ui.syncDot.className = 'sync-dot error';
      ui.lastUpdated.textContent = 'Dashboard data unavailable';
      setMessage(error instanceof Error ? error.message : 'Unable to parse dashboard data.');
      console.error(error);
    } finally {
      ui.refresh.disabled = false;
    }
  }

  ui.selector.addEventListener('change', () => {
    const run = dashboard.test_runs.find(item => item.run_id === ui.selector.value);
    if (run) renderOverview(run);
  });
  ui.project.addEventListener('change', () => {
    setMessage();
    renderRunSelector();
  });
  ui.refresh.addEventListener('click', loadDashboard);
  setInterval(loadDashboard, AUTO_REFRESH_MS);
  loadDashboard();
})();
