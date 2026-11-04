---
id: ITM-1421
title: Implement shows why a ready item returned
level: module
realises:
  - UC-034
  - UC-024
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1416
tests:
  - unit
origin:
  - the part of ITM-1416's Acceptance (TST-805218's lift) that MOD-work-plans could not give, ruled at its gate in team1's sprint 142 (docs/gates/20261102-0846-development-release-testing-1416.md)
---
# ITM-1421 Implement shows why a ready item returned

**REGISTER**

## Outcome

UC-034 7a: after a rejected gate, "the item returns to *ready* with the reason attached". Since ITM-1416, `itemStates` gives
such an item `ready`, with the rejection's reason as its `reason`. The Implement page (`src/implementation-pages/implement.mjs`,
about :436) draws a reason only for an item that cannot start. For a startable item it draws the participant and the run,
and not the reason it carries.

## Acceptance

- On Implement, a ready item whose state carries a reason shows that reason in its row, beside what it shows for a
  startable item. An item with no reason shows none.
- TST-805218 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
