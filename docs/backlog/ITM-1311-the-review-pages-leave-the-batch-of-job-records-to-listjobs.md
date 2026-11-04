---
id: ITM-1311
title: The review pages leave the batch of job records to listJobs
level: module
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-review-pages
builds_on:
  - ITM-1280
tests:
  - unit
origin:
  - the stop of ITM-1280 (PR #1447), docs/backlog/sprints/team1/117.md, "ITM-1280's stop"
---
# ITM-1311 The review pages leave the batch of job records to listJobs

**REGISTER**

## Outcome

`readJobRecords` (`src/review-pages/common.mjs:87-93`) names a snapshot's job records to `readMany` "before
MOD-job-ledger reads them one by one". It is called at `src/review-pages/flow.mjs:107` and `src/review-pages/jobs.mjs:233`.
Since ITM-1280, MOD-job-ledger's `listJobs` names a snapshot's records to `readMany` itself (MOD-job-ledger.md:181). So
the review pages batch the same records twice: a second copy of the rule (AGENTS.md §2 principle 2). Its comment no
longer holds.

After the change `readJobRecords` and its two calls go, and `listJobs` makes the one batch. MOD-review-pages' text names
that it reads the job records (MOD-review-pages.md:280), not how, so it does not change.

## Acceptance

- `tests/review-pages-use-cases.test.mjs`' TST-680211 counts one call of `readMany` naming every job record, as it did
  before ITM-1280, in the tests-only commit. It is red there, with the two calls.
- Only `src/review-pages/` and the tests that name MOD-review-pages change.
- Tests of other modules this Outcome changes: none. The run, with the change applied on `main` at `59d5f7ee2`, took
  every test that names MOD-review-pages, MOD-site-frame (whose `dashboard-app.mjs` calls the review routes),
  `src/review-pages/common.mjs`, `flow.mjs` or `jobs.mjs`, or `readMany`: 246 files. No case fails that does not fail
  without the change. TST-680211 passes with the change as it stands, since it asks for at least one call.
- It removes no test.
