---
id: ITM-991
title: The system and release tests of UC-041
level: system
realises:
  - UC-041
modules:
  - MOD-work-plans
builds_on:
  - ITM-620
tests:
  - system
  - release
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-041-9, verified against the accepted texts on main at ee5d1364
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-991 The system and release tests of UC-041

**REGISTER**

## Outcome

No test of level `release` names UC-041, and `tests/` holds neither `tests/test_time_box_close.py` — the check SPEC.md names
for `A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT`, `A SPRINT ENDS WITH A RETROSPECTIVE`, `CLOSING A SPRINT CAN BE ASSIGNED
TO A PARTICIPANT`, `A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF`, `AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM` and
`AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF` — nor `tests/test_phase_branch.py`, the check of `A PHASE OR A TIME
BOX MAY HAVE A BRANCH OF ITS OWN`. The system test walks UC-041's main flow and its alternative flows as the dashboard
reaches them. They are written by a participant who implements none of the items they test (`RELEASE TESTS ARE NOT WRITTEN
BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-041 realises has a release test; each new test's counter-proof is recorded in the pull request.
- Where the page and UC-041 disagree, the test follows UC-041 and the disagreement is named as a finding.
- Only tests change.
