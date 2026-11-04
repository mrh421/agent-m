---
id: ITM-1045
title: The system and release tests of UC-043
level: system
realises:
  - UC-043
modules:
  - MOD-implementation-pages
  - MOD-run-planner
  - MOD-workflow-entries
builds_on:
tests:
  - system
  - release
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-043-13, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-1045 The system and release tests of UC-043

**REGISTER**

## Outcome

No test of level `release` names UC-043, and `tests/` holds no `tests/test_process_run.py` — the check SPEC.md names for
`A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION`, `A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS`, `A RUN FOLLOWS THE
MODULES' INTERFACES`, `A RUN SETS UP CI BEFORE IT IMPLEMENTS`, `A RUN HAS LIMITS FIXED AT ITS START` and `A RUN ENDS WITH THE
VALIDATION OF ITS MODULES`. `tests/test_job_record.py`, the check of `A RUN IS A JOB THAT NAMES ITS JOBS`, exists since
`eafa5fc5` and `ee533fe2` (ITM-1132), at level release; its header (`tests/test_job_record.py:15-16`) names as not testable
yet that a run records the jobs it starts as it starts them, since `nextActions` and `finishRun` are not built. That case is added
once they are. The system
test walks UC-043's main flow and alternative flows as the dashboard and CI reach them. They are written by a participant
who implements none of the items they test (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-043 realises has a release test; each new test's counter-proof is recorded in the pull request.
- Where the system and UC-043 disagree, the test follows UC-043 and the disagreement is named as a finding.
- Only tests change.
