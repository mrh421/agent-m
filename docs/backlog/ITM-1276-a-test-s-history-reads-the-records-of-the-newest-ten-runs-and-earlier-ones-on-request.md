---
id: ITM-1276
title: A test's history reads the records of the newest ten runs and earlier ones on request
level: module
realises:
  - UC-029
  - EVERY TEST RUN LEAVES A RESULT RECORD
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-trace-pages
builds_on:
  - ITM-1266
  - ITM-1275
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1276 A test's history reads the records of the newest ten runs and earlier ones on request

**REGISTER**

## Outcome

`historyPart` (`src/trace-pages/test-detail.mjs:106-121`) reads the whole tree of the branch `test-results` (3,186 entries,
~146 KB gzipped) and `testHistory` (`src/result-records/read.mjs:206-223`) reads every run record of every commit, one
request each (`recordsAt`, `:47-60`): at the head of `test-results` 506 records of 276 commits, 96.8 MB, to show one
test's marks. The records are large because each lists every test's row (the newest average ~362 KB).

The history is a list the page shows, so it is bounded, not stored: after the change, as MOD-trace-pages says, the page
reads the records the newest ten commits of `test-results` added (`readHistory` with their changes, one request) and
those of the release tags' commits, through a snapshot of the branch narrowed to them (ITM-1266's `folders`), in one
batch; *Earlier runs* reads the next ten. Ten, because the records are the cost: ten are ~3.6 MB at today's sizes, one
batch, and the commits a reviewer looks at first are the newest; `testHistory` is unchanged and given that snapshot.

Reading taken: UC-029 step 5, "one mark per commit of the default branch where it ran", holds with the marks shown ten
runs at a time: every commit where the test ran still has its mark, reached through *Earlier runs*; the step names no
number shown at once.

Design principles (AGENTS.md §2 *Designing*): ch. 12 *KISS* — the existing history and folders read a bounded list; no
new stored view; §2.5 — the same *older* paging as `<k>/history` of the review pages (twenty commits at a time).

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/trace-pages-test-history-newest.test.mjs` (MOD-trace-pages, component), over a counting fake whose
  `test-results` holds 30 records: opening a test reads one history, one folders request and one batch of 10 records,
  shows the marks of those, and *Earlier runs* reads the next 10. Counter-proof: no recursive tree of `test-results` is
  read; a flaky commit among the ten is still marked flaky.

Measurable outcome, on the live page: opening a test reads ~10 records (~3.6 MB) in one batch instead of the tree and
506 records (96.8 MB) one by one.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/trace-pages/` and the tests that name MOD-trace-pages change.
- **The functions the Outcome needs are named in MOD-trace-pages' Uses:**
  - `MOD-repository-hosts.readHistory`, `readSnapshot` and `listTags` (MOD-trace-pages.md:19-22);
  - `MOD-result-records.testHistory`.
- **Tests of other modules this Outcome changes: none.**
  - The tests that draw a test's detail are `trace-pages-test-detail`, `trace-pages-test-history-logs` and
    `release-itm-1275-history-log-on-open`, all of MOD-trace-pages.
  - The tests of MOD-result-records call `testHistory`, which does not change.
  - The search was for `key: "tests"` with a row, `trace/tests/` and `testHistory`. Its known positive is
    `trace-pages-test-detail`.
- **The harness.** `tests/trace-pages-harness.mjs` (MOD-trace-pages) gives `readHistory` of the default branch only. It
  gains the history of the branch `test-results`, with each commit's changes.
  - `release-itm-1275-history-log-on-open` is a release test, and it passes unchanged.
  - Where it cannot pass unchanged, the item stops, since a release test is changed only by a participant who
    implemented none of it.
- It removes no test.
