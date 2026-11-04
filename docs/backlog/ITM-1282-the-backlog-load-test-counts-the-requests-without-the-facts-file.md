---
id: ITM-1282
title: The backlog load test counts the requests without the facts file
level: module
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1263
tests:
  - component
origin:
  - the scrum master, from PR #1382's run 40795459787 on its head merged with main, and a local run on main at 7b60a22a; main's push runs run only setup and records, so the break shows on pull requests only
---
# ITM-1282 The backlog load test counts the requests without the facts file

**REGISTER**

## Outcome

Since ITM-1263 (7339b422, merged with 29a9655c), no commit's facts file is stored or read, so opening `#backlog` makes
8 requests, not 9. Every pull request's run of "agent-m tests" fails in `component-pull-request (5)`, and the same test
fails on main: `tests/dashboard-backlog-teams.test.mjs:230`, "#backlog — the chart's merges cost no request: one listing
of the pull requests, and 9 requests in all", `8 !== 9`. Its declaration (:226) still names "the facts stored for the
commit (none)" among the requests.

The test follows ITM-1263's text again.

## Acceptance

- On a pull request, every unit, component and system job passes, with this test run, not skipped; the test still
  checks one listing of the pull requests and the total number of requests, and its declaration names the requests
  the load makes.
- Only the tests named change.
