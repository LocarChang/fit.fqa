# FQA Test Execution Dashboard

Static GitHub Pages dashboard for parsing `data/dashboard.json` and switching between Test Run overviews.

The desktop layout remains unchanged above 800 px. At phone widths (600 px and below), the overview becomes a single-column layout, result statistics use two columns, and Recent Test Runs automatically changes from a wide table into three-row touch-friendly cards without horizontal scrolling. Project is selected first and filters the available Test Runs.

## Publish

Copy the contents of this directory to the root of the `fit.fqa` repository. GitHub Pages can continue to publish from `main` through the existing workflow.

For an existing installation, update only `index.html`, `assets/`, and this README. Do not manually replace or merge `data/dashboard.json`; that file is owned by Test Plan Management Autosync. If Git reports a conflict in that JSON file, discard the manual version and use **Autosync Dashboard > Sync Now** to publish a clean copy.

## Local preview

The page loads JSON with `fetch`, so do not open `index.html` directly with `file://`. Run a local HTTP server in this directory, for example:

```text
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## JSON contract

Replace `data/dashboard.json` with the exporter output. Required root properties:

- `generated_at`: ISO-8601 date/time with timezone.
- `test_runs`: array of Test Run objects.

Each Test Run supports:

- `run_id`, `run_name`, `project`, `plan_name`, `build`, `run_status`
- `estimated_time`, `executed_time`
- `total_cases`, `executed_cases`
- `status`: `passed`, `failed`, `blocked`, `retest`, `untested`, `skipped`
- `testers`: display name, total cases, and the same six status counts

The parser validates the root structure, normalises missing numeric status fields to zero, and displays an error instead of breaking the page when JSON is invalid.

## Refresh behavior

- Browser checks `dashboard.json` every 60 seconds with cache disabled.
- The Refresh button performs a full cache-busted page reload, equivalent to using Ctrl+F5 for the dashboard.
- Data older than 15 minutes is marked as potentially outdated.
- The future Test Plan Management exporter can update only `data/dashboard.json`; no page code changes are required.
