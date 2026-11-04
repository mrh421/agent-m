---
id: ITM-1441
title: Clearing an endpoint from its line confirms that nothing is stored
level: module
realises:
  - UC-003
  - A CLEAR IS A REAL CLEAR
modules:
  - MOD-settings-pages
builds_on:
  - ITM-266
tests:
  - unit
origin:
  - UC003-F1, TST-266213 of ITM-266's system tests of UC-003 (#1741), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1321-development-release-testing-0266.md)
---
# ITM-1441 Clearing an endpoint from its line confirms that nothing is stored

**REGISTER**

## Outcome

UC-003 2b: after a clear, Agent M confirms that nothing is stored. The *Clear* of the form says so. The *Clear* on the
Settings tab's line of an endpoint removes its entries and says nothing (TST-266213).

## Acceptance

- *Clear* on an endpoint's line removes its entries and states that the endpoint is cleared and nothing of it is stored,
  as the form's *Clear* does.
- TST-266213 loses its `todo` in a commit by a participant who built none of the page, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
