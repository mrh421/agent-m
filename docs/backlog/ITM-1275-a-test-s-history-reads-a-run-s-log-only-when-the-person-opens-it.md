---
id: ITM-1275
title: A test's history reads a run's log only when the person opens it
level: module
realises:
  - UC-029
  - EVERY TEST RUN LEAVES A RESULT RECORD
modules:
  - MOD-trace-pages
builds_on: []
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1275 A test's history reads a run's log only when the person opens it

**REGISTER**

## Outcome

The detail of a test (`trace/tests/<TST>`, `src/trace-pages/test-detail.mjs:106-121`) gives each mark of its history a
link to the run's log. To say whether the server still keeps it (UC-029 5b), `historyLogLink` (`:88-103`) calls
`ciRunLog` for every mark — `jobLogs` (`src/repository-hosts/github.mjs:491`), which downloads the full log of every job
of the run — before the page is drawn: one download of whole CI logs for each commit that ran the test.

After the change, as MOD-trace-pages says: each mark links its run (`WebLinks`' `run`); whether the log is kept is asked
when the person opens the link, with `ciRunLog` for that run alone, and the link then reads *no longer available* where
it gives `null`. Reading taken (AGENTS.md §6a.6): UC-029 5b says the link "is marked *no longer available*", not when;
marking it once opened satisfies it.

Design principle (AGENTS.md §2 *Designing*): §2.1 — drawing the history and fetching a log are two responsibilities;
akmaier: what is read is what a person opens.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/trace-pages-test-history-logs.test.mjs` (MOD-trace-pages, component), over a counting fake with a test run on
  five commits: opening the test sends no `actions/jobs/<id>/logs`; opening the third mark's log sends the requests of
  that run alone, and a run whose logs answer 410 then reads *no longer available*. Counter-proof: today's page sends five.

Measurable outcome: opening a test downloads no CI log; today one run's full logs per commit that ran it (up to 276
commits at Agent M's head).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/trace-pages/` and the tests that name MOD-trace-pages change.
- Tests of other modules this Outcome changes: none. The only test that draws a test's detail is
  `trace-pages-test-detail` (MOD-trace-pages).
