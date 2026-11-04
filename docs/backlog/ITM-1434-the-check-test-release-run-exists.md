---
id: ITM-1434
title: The release run's check that the SPEC names exists
level: module
realises:
  - A RELEASE RUNS EVERY TEST AT EVERY LEVEL
  - ACCEPTING THE RELEASE TEST REPORT RELEASES
  - A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
modules:
  - MOD-release-evidence
builds_on: []
tests:
  - release
origin:
  - noted by ITM-775's writer (#1733): SPEC.md names `tests/test_release_run.py` as the check of three requirements, and no such file exists; ruled at its gate in team1's sprint 142 (docs/gates/20261102-1108-development-release-testing-0775.md)
---
# ITM-1434 The release run's check that the SPEC names exists

**REGISTER**

## Outcome

`SPEC.md` names `tests/test_release_run.py` as the check of `A RELEASE RUNS EVERY TEST AT EVERY LEVEL`, `ACCEPTING THE
RELEASE TEST REPORT RELEASES` and `A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED`. No such file exists.

## Acceptance

- `tests/test_release_run.py`, with its data file, checks what the three requirements' checks name:
  - a release is tagged only after every test at every level ran on the candidate's commit;
  - accepting a green report sets the tag on the tested commit, and rejecting it sets none;
  - a red run without a recorded limitation cannot be tagged, and with one it can.
- It is written by a participant who built none of the behaviour it guards (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`), with each case's counter-proof recorded in the pull request.
- A case that finds the behaviour missing is a `todo` naming its finding, ruled at the gate.
- Only test files change.
