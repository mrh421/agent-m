---
id: ITM-1408
title: The backlog starts the sprint's ready items in one click
level: module
realises:
  - UC-034
  - ONE CLICK PER DECISION
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-805
tests:
  - unit
origin:
  - UC034-F1, TST-805204 of ITM-805's system tests of UC-034 (#1699), ruled at its gate in team1's sprint 142 (docs/gates/20261101-2000-development-release-testing-0805-1045.md)
---
# ITM-1408 The backlog starts the sprint's ready items in one click

**REGISTER**

## Outcome

UC-034 step 1: the author opens **Backlog** and selects ready items, "or presses **Start sprint work** to select every
ready item of the sprint". `src/implementation-pages/implement.mjs` reads `#implement/sprint=<team>/<nn>`, but no page
offers a control that opens it. Known positive: *Change the selection* is found on the backlog.

## The reading taken

MOD-implementation-pages holds the backlog with its sprints and "starting the jobs of steps or items". So the backlog of a
sprint offers *Start sprint work*, which opens the starting of that sprint's ready items. The module text does not name the
control, and that is noted for akmaier at the gate.

## Acceptance

- The backlog of a team's current sprint offers *Start sprint work*. It opens the starting page with every ready item of
  that sprint selected, and the reason for each item that cannot start.
- TST-805204 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
