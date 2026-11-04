---
id: ITM-1352
title: The component diagram marks the modules that have a gap
level: module
realises:
  - UC-025
  - MODULE GAPS ARE REPORTED, NOT FORBIDDEN
modules:
  - MOD-trace-pages
builds_on:
  - ITM-741
tests:
  - unit
origin:
  - finding UC025-F1 of ITM-741's system test TST-741006 (#1607), ruled at its gate in team1's sprint 141 (docs/gates/20261101-0613-development-release-testing-0741.md)
---
# ITM-1352 The component diagram marks the modules that have a gap

**REGISTER**

## Outcome

UC-025 step 5: "modules with a gap are marked". MOD-trace-pages' modules view gives the component diagram with "gaps
marked" (MOD-trace-pages.md:134). `drawModules` (`src/trace-pages/flow.mjs:934`) calls `componentDiagram(files)` without
the gaps that `moduleRows` gave. So no module with a gap is marked, and only a missing provider is marked (5a).

## Acceptance

- Each module that has a gap in `moduleRows`' gaps is marked in the diagram. A module without a gap is not marked.
- A missing provider stays a box marked *missing* (5a).
- TST-741006 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
