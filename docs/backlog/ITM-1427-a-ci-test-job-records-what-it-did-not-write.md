---
id: ITM-1427
title: A CI test job records what it did not write
level: module
realises:
  - UC-026
  - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
modules:
  - MOD-workflow-entries
builds_on:
  - ITM-771
tests:
  - unit
origin:
  - UC026-F6, TST-771209 of ITM-771's system tests of UC-026 (#1718), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0855-development-release-testing-0771.md)
---
# ITM-1427 A CI test job records what it did not write

**REGISTER**

## Outcome

`A JOB IS RECORDED IN ITS PRODUCT REPOSITORY`: once a job has ended, its record names its end state and results. A
`write-tests` job on CI ends with a record that holds no draft, so the cases it did not write (`notWritten`) never reach its
record under `docs/jobs/` (TST-771209).

## Acceptance

- The end record of a `write-tests` job on CI names each proposed case it did not write, and why.
- TST-771209 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
