---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 43bf952927a49da8fb7352a20aeb6617a44bb1fb
  - https://github.com/akmaier/agent-m/pull/1447
  - docs/backlog/ITM-1280-the-jobs-list-reads-its-records-in-batches-and-the-job-workflow-s-runs-once.md@7197614f5
date: 2026-10-29 12:19 UTC
---
# Development → Release testing: ITM-1280, the jobs list reads its records in batches and the job workflow's runs once

**REGISTER**

## Reason

ITM-1280, pull request #1447 into `sprint/team1/117`, passes on `43bf9529`, its head when this was decided. The item is
read as edited at its stop (`team1/117.md`, "ITM-1280's stop").

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40871651626, `pull_request`, on `43bf9529` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `9bffb860` is red in run 40869916670, in three jobs, and only on:
   - TST-1280001 (`job-ledger-list-batched`);
   - TST-1280002 and 003 (`runtimes-live-states`);
   - TST-1280004 (`main-page-jobs-reads`);
   - TST-847010 (`main-page-home`), the changed expectation: the run list is asked once for the repository, not once per
     job.
   - The fakes of `main-page-jobs` and `main-page-job-one-record` are changed in that commit, to answer the batch request
     and to count a record a batch names as read. Their expectations are unchanged.
   - The implementation commit `197c4882` changes no test.
3. **TST-847010 is outside the cases the Acceptance listed, and within its modules.**
   - The planning run made only `listJobs` batch, so it saw the failures of the batch. `liveStates` changes the count of
     run listings, and TST-847010 counts those on `home`.
   - Its header names MOD-main-page, a module of the item.
   - Its changed count stands in the tests-only commit, red there.
   - Its known positive and counter-proof (no CI job, no listing) stay.
4. **The tests changed after the implementation commit are the ones ruled.**
   - `262fec19`, by developer-sonnet-l, who implemented none of this item, changes `release-itm-1269-job-page-reads-its-own-job`:
     a record named in a batch request counts as read. No assertion changes, as the Acceptance asks of the release test.
   - `43bf9529`, by developer-opus-f, changes TST-680211 (`review-pages-use-cases`, MOD-review-pages) as ruled at the stop:
     at least one call of `readMany`, and every call naming every job record and nothing else.
5. **Only its modules change.**
   - Code: `src/job-ledger/index.mjs`, `src/runtimes/index.mjs` and `ci.mjs`, and `src/main-page/jobs.mjs`, `home.mjs` and
     `reread.mjs`.
   - Tests: those named above, each naming MOD-job-ledger, MOD-runtimes, MOD-main-page, or MOD-review-pages for the one
     test the item names. No code of MOD-review-pages changes, and no test is removed.
6. **The interfaces are the accepted text, within the Uses.**
   - MOD-runtimes provides `liveStates` (MOD-runtimes.md:79): "`liveState` for each of the records of one repository that
     have not ended … the runs of the job workflow listed once for all of them" (:299-301).
   - MOD-main-page's Uses name it (MOD-main-page.md:41), and `#jobs` calls it once per repository (:138).
   - MOD-job-ledger's `listJobs` names a snapshot's records to `readMany` first (MOD-job-ledger.md:181), through the
     `Snapshot` its Uses name.
   - The job page keeps `liveState`.
7. **The reading holds: a Bridge is still asked once per record.** The text shares only the listing of the runs among a
   repository's records. Each record's state is "`liveState` for each of the records", and a Bridge record's `liveState`
   asks its Bridge. TST-1280003 pins it.
8. **The reader.** On `43bf9529`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `job-ledger-list-batched` 1, `runtimes-live-states` 2, `main-page-jobs-reads` 1, `main-page-jobs` 13, `main-page-home`
     42, `main-page-job-one-record` 2, `release-itm-1269-job-page-reads-its-own-job` 4, `review-pages-use-cases` 20.
   - All with 0 findings. `test-document-one-line` passes.

## Noted

- **ITM-1311** removes MOD-review-pages' own batch of the job records, now that `listJobs` makes it (registered at the
  stop).
