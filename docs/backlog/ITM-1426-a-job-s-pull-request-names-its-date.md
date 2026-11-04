---
id: ITM-1426
title: A job's pull request names its date
level: module
realises:
  - UC-026
  - UC-034
  - AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
modules:
  - MOD-runtimes
builds_on:
  - ITM-771
  - ITM-1411
tests:
  - unit
origin:
  - UC026-F5, TST-771211 of ITM-771's system tests of UC-026 (#1718), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0855-development-release-testing-0771.md)
---
# ITM-1426 A job's pull request names its date

**REGISTER**

## Outcome

UC-026 step 8 and UC-034 step 5.3: the pull request "records the Agent M version, the participant, the model and the date".
MOD-runtimes' description names the provenance lines, but holds no date (TST-771211).

## Acceptance

- The description of a job's pull request names the date its job ran, beside the Agent M version, the participant and the
  model.
- TST-771211 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
