---
id: ITM-1269
title: The job page reads its own job
level: module
realises:
  - UC-036
  - ONE DASHBOARD SHOWS EVERY JOB
modules:
  - MOD-main-page
builds_on: []
tests:
  - component
origin:
  - akmaier, 2026-10-28: "It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1269 The job page reads its own job

**REGISTER**

## Outcome

The route `job` (`src/main-page/jobs.mjs:255-262`, `renderJob`) calls `everyJob`, the list's reading: a snapshot of the
instance and of every kept product, every record under `docs/jobs/` of each — 478 at Agent M's head, ~7 MB, read one
by one (`src/job-ledger/index.mjs:420-430`) —, and the live state of every job without an end, for a CI job a listing of
the job workflow's runs each (`src/runtimes/ci.mjs:284`); then it finds the one job by its id and shows it.

After the change, as MOD-main-page says: the route reads `docs/jobs/<id>.md` of the product the address names — else of
the first repository among the instance and the kept products whose tree holds it — and asks that job's live state
alone. The list `jobs` is unchanged.

Design principle (AGENTS.md §2 *Designing*): §2.1 — showing one job and listing every job are two responsibilities;
the page of one job no longer runs the list's reading.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/main-page-job-one-record.test.mjs` (MOD-main-page, component), over a counting fake with three products of
  ten job records each: `#job/id=JOB-x/product=<b>` shows what `tests/main-page-job.test.mjs` expects and reads one
  record, of product b, and one live state; without `product`, the trees of the instance and the products and one
  record. Counter-proof: a planted second record of another job is not read.

Measurable outcome, on the live main page: opening one job reads one record (~15 KB) instead of 478 records (~7 MB) and
asks one live state instead of one for each job without an end.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/main-page/` and the tests that name MOD-main-page change.
- **The functions the Outcome needs are named in MOD-main-page's Uses** (MOD-main-page.md:24, :36-37, :40):
  - `MOD-repository-hosts.readSnapshot`, its `folders` narrowed to `docs/jobs/<id>.md`;
  - `MOD-job-ledger.listJobs` and `jobState`;
  - `MOD-runtimes.liveState`.
  - The text gives the route this behaviour (MOD-main-page.md:153-155).
- **Tests of other modules this Outcome changes: none.**
  - The tests that draw the route `job` are `main-page-job`, `-job-gate`, `-job-retry`, `-job-cancel`, `-job-trail`,
    `-job-revert` and `main-page-jobs`, all of MOD-main-page.
  - `implementation-pages-progress` only links to `#job/id=…`.
  - The search was for `#job/`, `name === "job"` and `"job")` over `tests/`. Its known positive is `main-page-job`.
- It removes no test.
