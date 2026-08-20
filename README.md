# FQA Test Execution Dashboard

Static GitHub Pages dashboard for parsing `data/dashboard.json` and switching between Test Run overviews.

## Publish

Copy the contents of this directory to the root of the `fit.fqa` repository. GitHub Pages can continue to publish from `main` through the existing workflow.

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
- Data older than 15 minutes is marked as potentially outdated.
- The future Test Plan Management exporter can update only `data/dashboard.json`; no page code changes are required.
