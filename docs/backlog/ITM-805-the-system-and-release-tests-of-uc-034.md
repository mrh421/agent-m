---
id: ITM-805
title: The system and release tests of UC-034
level: system
realises:
  - UC-034
modules:
  - MOD-implementation-pages
  - MOD-product-process
  - MOD-main-page
  - MOD-workflow-entries
builds_on:
  - ITM-789
  - ITM-734
  - ITM-791
  - ITM-792
  - ITM-801
tests:
  - system
  - release
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-805 The system and release tests of UC-034

**REGISTER**

## Outcome

No item realises the system and release tests of UC-034, and `tests/` holds no system test of it. The system test walks
the main flow and every alternative flow UC-034 names, as the dashboard reaches it, each test stating its expected result.
Its release tests include `tests/test_job_gate.py`, `tests/test_gate_record.py` and `tests/test_job_assignment.py`, the checks SPEC.md names for `A JOB STOPS AT EVERY GATE`, `THE GATE IS RECORDED` and `A JOB GOES ONLY TO A HOLDER OF ITS ROLE`, none of which exists.
They are written from UC-034 and the requirements it realises by a participant who implements none of the items it
tests (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-034 realises has a release test; each new test's counter-proof is recorded in the pull request.
- Where the page and UC-034 disagree, the test follows UC-034 and the disagreement is named as a finding.
- Only tests change.
