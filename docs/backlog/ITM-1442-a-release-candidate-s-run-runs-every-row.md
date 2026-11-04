---
id: ITM-1442
title: A release candidate's run runs every row
level: module
realises:
  - A RELEASE RUNS EVERY TEST AT EVERY LEVEL
  - UC-028
modules:
  - MOD-result-records
builds_on:
  - ITM-1434
tests:
  - unit
origin:
  - the finding of ITM-1434's cases 019 and 020 (#1743), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1332-development-release-testing-1434.md)
---
# ITM-1442 A release candidate's run runs every row

**REGISTER**

## Outcome

`A RELEASE RUNS EVERY TEST AT EVERY LEVEL`, and MOD-test-schedule has a release candidate run every row (UC-028 1a).
MOD-result-records' `runOf` (`src/result-records/strategies.mjs:249`) leaves out the row `paid` and every row whose column
of the release candidate is empty. So a product with paid tests never completes a release through this route:
`acceptAndRelease` refuses the run as incomplete.

## Acceptance

- A run for a release candidate runs every row of the schedule, `paid` included, whatever the row's cells say. Runs for
  the other occasions keep the rows their columns name.
- The two `expectedFailure` cases of `tests/test_release_run.py` (019, 020) pass, lifted in a commit by a participant
  other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
