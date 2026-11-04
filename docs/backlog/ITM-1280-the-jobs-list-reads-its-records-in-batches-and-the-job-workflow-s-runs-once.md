---
id: ITM-1280
title: The jobs list reads its records in batches and the job workflow's runs once
level: module
realises:
  - UC-036
  - ONE DASHBOARD SHOWS EVERY JOB
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-job-ledger
  - MOD-runtimes
  - MOD-main-page
  - MOD-review-pages
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1280 The jobs list reads its records in batches and the job workflow's runs once

**REGISTER**

## Outcome

`jobs` (`src/main-page/jobs.mjs:168-177`, `everyJob`) calls `listJobs` (`src/job-ledger/index.mjs:420-430`), which reads
every record under `docs/jobs/` one request at a time — 478 at Agent M's head, ~7.6 MB —, then `liveStatesOf`
(`jobs.mjs:69-79`) asks `liveState` for each job without an end, which for a CI job lists every run of
`agent-m-jobs.yml` (`src/runtimes/ci.mjs:283-286`, `runOfAddress`; 172 runs, two pages) — once per job (7 unended at
the head).

The list shows every job (SPEC `ONE DASHBOARD SHOWS EVERY JOB`), waiting ones first, and which jobs have not ended is
known only from their records. So the read is batched, not bounded to the newest: a newest-N page would hide a job that
has waited at a gate for weeks — the row the list shows first.

After the change, as MOD-job-ledger, MOD-runtimes and MOD-main-page say: `listJobs` names a snapshot's records to
`readMany` first; `liveStates(records, product, bridges)` gives the live states of a repository's unended jobs with one
listing of the job workflow's runs; the list calls it once per repository. The job page (ITM-1269) keeps `liveState`.

Design principles (AGENTS.md §2 *Designing*): §2.2 — the runs are listed once; SPEC `A PAGE LOAD READS THE REPOSITORY IN
BATCHES`.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/job-ledger-list-batched.test.mjs` (MOD-job-ledger, unit): over a counting fake with 250 records, `listJobs` sends
  three batches and no single read; the rows equal today's.
- `tests/runtimes-live-states.test.mjs` (MOD-runtimes, unit): five unended CI jobs give the states `liveState` gives
  one by one, with one listing of the runs. Counter-proof: a record without an end on a Bridge asks the Bridge.
- `tests/main-page-jobs-reads.test.mjs` (MOD-main-page, component): `#jobs` with two repositories sends per repository
  its batches and at most one listing of runs.

Measurable outcome, on the live main page: `#jobs` reads Agent M's records in 5 batches instead of 478 requests, and
lists the job workflow's runs once (2 pages) instead of once per unended job (up to 14 pages today).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of the three modules and the tests that name them change.
- **The functions the Outcome needs are named in the Uses of the modules that call them:**
  - MOD-main-page's names `MOD-runtimes.liveStates` (MOD-main-page.md:41, :138);
  - MOD-runtimes provides `liveStates` (MOD-runtimes.md:79, :299);
  - MOD-job-ledger names `readSnapshot` and `Snapshot` (MOD-job-ledger.md:181: the records of a snapshot "are named to
    its `readMany` first").
- **The search for every count and expectation the Outcome changes was a run, not a text search.** On
  `sprint/team1/116` at `b96d0ae8`, `listJobs` was made to name the records to `readMany` first. The 135 test files that
  name `listJobs`, `liveState`, `#jobs`, `agent-m-jobs.yml`, `job-ledger` or `main-page` were run with and without that
  change.
  - Without it, 1,044 of 1,053 pass and 1 fails, which fails the same way with it.
  - With it, 21 more fail, all of MOD-main-page:
    - `main-page-jobs` (TST-509001 to 006, TST-970001 to 003, TST-866002);
    - `main-page-job-one-record` (TST-1269001, 002);
    - `main-page-home` (TST-943002, 005, 007);
    - `main-page-root-entry` (TST-684002);
    - `main-page-home-instance` (TST-1281001);
    - `release-itm-1269-job-page-reads-its-own-job` (TST-1269301 to 304).
  - The Developer names, for each, whether its expectation changes or its fake of the host answers the batch. Both stand
    in the tests-only commit.
  - The release test is changed by developer-sonnet-l, in a commit of its own on the item's branch.
  - `liveStates` changes the listing of the job workflow's runs on `#jobs`. Its counts stand in `main-page-jobs`, which
    is named above.
- **One test of another module changes:** `tests/review-pages-use-cases.test.mjs` (MOD-review-pages), TST-680211
  (`:572-579`).
  - It counts one call of `readMany` naming the job records. MOD-review-pages' `readJobRecords`
    (`src/review-pages/common.mjs:89-93`) names them, and `listJobs` now names them again, so there are two calls.
  - The host's `readMany` asks only for blobs it does not hold yet (`src/repository-hosts/index.mjs:268-273`), so the
    second call sends no request.
  - The expectation becomes: at least one call, and every call names every job record and nothing else. Its `expect:`
    says so, and every other assertion stays.
  - It is changed by developer-opus-f in a commit of its own on the item's branch.
  - The item names MOD-review-pages for that one test, and no code of it changes.
- **Tests of other modules this Outcome changes: none besides**, by that run. The tests of MOD-implementation-pages,
  MOD-review-pages, MOD-progress-measures, MOD-prompt-bar and MOD-runtimes that call `listJobs` pass with the change.
- It removes no test.
