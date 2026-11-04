---
id: ITM-804
title: The system and release tests of UC-033
level: system
realises:
  - UC-033
modules:
  - MOD-maintenance-pages
  - MOD-issue-handling
  - MOD-work-plans
builds_on:
  - ITM-582
  - ITM-583
  - ITM-584
  - ITM-1250
  - ITM-1256
  - ITM-617
tests:
  - system
  - release
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-804 The system and release tests of UC-033

**REGISTER**

## Outcome

No item realises the system and release tests of UC-033, and `tests/` holds no system test of it. The system test walks
the main flow and every alternative flow UC-033 names, as the dashboard reaches it, each test stating its expected result.
It walks an issue from its class to its item and, once the item's pull request is merged, to its close (step 6).
They are written from UC-033 and the requirements it realises by a participant who implements none of the items it
tests (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-033 realises has a release test; each new test's counter-proof is recorded in the pull request.
- Where the page and UC-033 disagree, the test follows UC-033 and the disagreement is named as a finding.
- Only tests change.
