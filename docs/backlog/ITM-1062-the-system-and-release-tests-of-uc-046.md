---
id: ITM-1062
title: The system and release tests of UC-046
level: system
realises:
  - UC-046
modules:
  - MOD-main-page
  - MOD-progress-measures
builds_on:
  - ITM-684
  - ITM-864
tests:
  - system
  - release
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-046-1, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-1062 The system and release tests of UC-046

**REGISTER**

## Outcome

No item realises the system and release tests of UC-046, and `tests/` holds no system test of it: every test that names
UC-046 is a unit test. UC-046.md:49-81 is the main flow, :82-96 the alternative flows; MOD-main-page.md:99-123 the route
`home` that serves them (one card per product, "each with its name, its process model, its bar of six stages each filled
by its share, the stage it is in marked", each stage a link to "the address `menuOf` gives, called with the card's product
address, for the entry of the same place in the process").

The system test walks the main flow and every alternative flow UC-046 names on the live main page, as `index.html` serves
it after ITM-684, each test stating its expected result. Since `dcf0badd` and `fb1b7c69` a card is drawn from the overview
stored for the head on the branch `overview-cache`, or from the one `latest.json` names while the head's is not stored,
and is derived from the repository only where neither is stored (MOD-main-page, the route `home`); the test's fixture
serves that branch as the home harness does. The existing `tests/test_main_page.py`, `tests/test_progress_derived.py`
and `tests/test_job_dashboard.py` stay; a release test is added for each requirement UC-046 realises without one, except
those whose check is "at review". They are written from UC-046 and the requirements it realises by a participant who
implements none of the items it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-046 realises with an automatic check has a release test, existing or new; each new test's
  counter-proof is recorded in the pull request.
- Where the page and UC-046 disagree, the test follows UC-046 and the disagreement is named as a finding.
- Only tests change.
