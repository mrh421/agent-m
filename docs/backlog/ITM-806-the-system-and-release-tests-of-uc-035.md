---
id: ITM-806
title: The system and release tests of UC-035
level: system
realises:
  - UC-035
modules:
  - MOD-implementation-pages
  - MOD-progress-measures
builds_on:
  - ITM-800
tests:
  - system
  - release
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-806 The system and release tests of UC-035

**REGISTER**

## Outcome

No item realises the system and release tests of UC-035, and `tests/` holds no system test of it. The system test walks
the main flow and every alternative flow UC-035 names, as the dashboard reaches it, each test stating its expected result.
Its release tests include `tests/test_progress_view.py`, the check SPEC.md names for `PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE`, which does not exist: a V-model, a Scrum and a Kanban fixture each render their declared measure.
They are written from UC-035 and the requirements it realises by a participant who implements none of the items it
tests (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-035 realises has a release test; each new test's counter-proof is recorded in the pull request.
- Where the page and UC-035 disagree, the test follows UC-035 and the disagreement is named as a finding.
- Only tests change.
- **Read at sprint team1/138's probe** (developer-opus-f, not pushed; no existing expectation moves).
  - `tests/test_progress_view.py` stays, since SPEC.md:1849-1850 names it as the Check. Its Check also says "A definition
    naming an unknown measure fails validation", so the file holds that case too, through MOD-model-catalogue's
    interface. If validation accepts the definition, that is a finding.
  - Its fixtures are data files, not large literals (AGENTS.md §7).
  - 2c is tested like any other flow: the chart starts at the change, and earlier progress stays readable in the model
    it was made under. Where the page does not do this, the case is a FINDING `todo` (UC035-S6).
  - The findings UC035-S1 to S5 (TST-806002, 006, 009, 011, 012) and S6 are not registered in any open item. At the
    gate, each becomes a new item for the module whose code it points into, named with file:line in the pull request.
