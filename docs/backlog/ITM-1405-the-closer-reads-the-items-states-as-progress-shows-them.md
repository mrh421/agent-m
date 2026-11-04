---
id: ITM-1405
title: The closer reads the items' states as Progress shows them
level: module
realises:
  - UC-041
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
modules:
  - MOD-work-plans
builds_on:
  - ITM-991
tests:
  - unit
origin:
  - UC041-F3, TST-991203 of ITM-991's system tests of UC-041 (#1698), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1949-development-release-testing-0991.md)
---
# ITM-1405 The closer reads the items' states as Progress shows them

**REGISTER**

## Outcome

The recipe `sprint-facts` calls `itemStates` with `statuses(snapshot)` alone (`src/work-plans/strategies.mjs:145`). So the
closer is told "waiting for acceptance" for an item that Progress shows as "blocked". The same call at :339
(`leave-out-named-modules`) serves UC-008 and is not this item's.

## Acceptance

- `sprint-facts` gives each selected item the state Progress shows for it on the same commit.
- TST-991203 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
