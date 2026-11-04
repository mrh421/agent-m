---
id: ITM-1277
title: The library reads a failed fetch's log only while a legal text waits for it
level: module
realises:
  - UC-004
  - AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
modules:
  - MOD-settings-pages
builds_on: []
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1277 The library reads a failed fetch's log only while a legal text waits for it

**REGISTER**

## Outcome

`library` (`src/settings-pages/library.mjs:105-120`, `fetchFailures`) lists every run of `fetch-sources.yml` and calls
`ciRunLog` — every job's full log — for every failed run, on each load, also when no legal text waits for its fetch
(the loop over failed runs does not look at `waiting`). The line is shown for a legal text without a version
(UC-004 7a). At Agent M's head the workflow has never run and no legal text is registered, so the cost today is one
listing; it grows with every failed run.

After the change, as MOD-settings-pages says: no log is read while no legal text waits; otherwise the failed runs' logs
are read newest first, only until each waiting text has its line, and no further back than the newest successful run
started by a push — a run on a push fetches every text then waiting (`.github/workflows/fetch-sources.yml`, input
`source` empty), so a text still waiting is younger than it.

Design principle (AGENTS.md §2 *Designing*): akmaier — what is read is what the page shows; ch. 12 *KISS* — a bound
from the workflow's own trigger, no stored state.

## The reading of the accepted text

The Outcome reads the runs of the fetch workflow and their logs with `listCiRuns` and `ciRunLog`, as the code already does
(`src/settings-pages/library.mjs:106-112`). Both are functions of the Host.
- MOD-repository-hosts: "`Host` — the object `connect` returns; the functions below, from `readSnapshot` on, are its
  functions" (MOD-repository-hosts.md:111).
- MOD-settings-pages' Uses name `MOD-repository-hosts.connect` (MOD-settings-pages.md:30). A module that uses the object
  `connect` returns calls its functions.
- MOD-settings-pages.md:222-225 states the Outcome: "the logs are read only while a legal text waits without its line,
  newest failed run first, no further back than the newest successful run started by a push, and none is read while no
  legal text waits".

So the item changes when the logs are read, not what the module uses. Sprint 111's ruling on ITM-1268 read Host functions
one by one; the sentence of MOD-repository-hosts above reads them as the functions of one object.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/settings-pages-library-fetch-logs.test.mjs` (MOD-settings-pages, component), over a fake host with ten failed
  runs: with no legal text waiting, no `ciRunLog`; with one waiting whose line stands in the newest failed run, one
  `ciRunLog`, and the line shown; with a successful push run third newest, at most two logs read. Counter-proof: today's
  page reads ten.

Measurable outcome: a load of `library` with no waiting legal text reads no log (today one per failed run); with one
waiting, as many as it takes to find its line.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/settings-pages/` and the tests that name MOD-settings-pages change.

**The planning run (sprint team1/124).** A stand-in on `main` at `fb0322f08` keeps the one listing of the fetch workflow's
runs, reads them by `started`, newest first, and stops at the first successful run of the event `push` or once every
waiting text has its line.
- Ten failed runs: with no legal text waiting, 10 logs before and 0 after; with one waiting whose line is in the newest, 10
  and 1; with a successful push run third newest and no line, 10 and 2. One listing in each case.
- 147 files that name MOD-settings-pages, `settings-pages/`, `library.mjs`, `fetch-sources`, `ciRunLog` or the route: no
  case fails only with it. A first stand-in that also skipped the listing failed two request counts
  (`settings-pages-library-batches.test.mjs:212`, `settings-pages-library-versions.test.mjs:379`), so the listing stays.
