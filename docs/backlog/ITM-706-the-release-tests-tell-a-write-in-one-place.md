---
id: ITM-706
title: The release tests tell a write in one place
level: system
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-site-frame
  - MOD-trace-pages
builds_on:
  - ITM-678
  - ITM-574
tests:
  - release
origin:
  - ITM-678's pull request #725, from developer-sonnet-b's finding
---
# ITM-706 The release tests tell a write in one place

**REGISTER**

## Outcome

`const writes = …`, the rule that tells which of a fake server's requests is a write, stands copied in two test files
of MOD-trace-pages that load the dashboard through `tests/app-harness.mjs`:
- `tests/release-sprint-15-spec-toggles.test.mjs:28-29`, taught by ITM-678 that the batch `POST …/graphql` is a read;
- `tests/system-sprint-14-spec-overview.test.mjs:51`, left untaught: it would count that batch as a write.

Sprint 56's agreement reads: "A shared test harness lives in a helper file of its own, never in a test file."
So the rule moves into `tests/app-harness.mjs`, MOD-site-frame's since ITM-574, and the two files use it.

It is written by a participant who builds none of ITM-574, since the files are system and release tests.

## Acceptance

- One function of `tests/app-harness.mjs` tells a write. The two files use it, and none keeps a copy.
- Their expected results are unchanged, and each passes on the base and on ITM-574's head.
- Its counter-proof: a planted write in a page fails each of them.
- **The planning run** (sprint team1/122, on `main` at `0e928b61b`). A stand-in exported the rule, the batch of reads
  excepted, from `tests/app-harness.mjs` beside its other exports, and the two files took it in place of their copies.
  The 84 files that import `tests/app-harness.mjs` give 536 pass, 0 fail and 4 todos, with and without it. So no other
  test changes.

`tests/app-harness.mjs` is headed `Module: MOD-site-frame` (`:11`), and both test files `Module: MOD-trace-pages`.
