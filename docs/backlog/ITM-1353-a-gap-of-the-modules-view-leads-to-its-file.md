---
id: ITM-1353
title: A gap of the modules view leads to the file it concerns
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
  - finding UC025-F3 of ITM-741's system test TST-741008 (#1607), ruled at its gate in team1's sprint 141 (docs/gates/20261101-0613-development-release-testing-0741.md)
---
# ITM-1353 A gap of the modules view leads to the file it concerns

**REGISTER**

## Outcome

UC-025 step 6: "The reviewer follows a row or a gap to the file it concerns." In MOD-trace-pages' modules view, a gap
leads to "the module's file and folder" (MOD-trace-pages.md:134). `modulesGaps` (`src/trace-pages/flow.mjs:893`) draws
each gap as text, with at most the link of the next step (*Implement*, *Change the architecture*). No gap leads to the
module file or code file it concerns.

## Acceptance

- Each gap links the file it concerns, as the view's other links to a file do: the module's file, or the code file.
- The next step's link stays where step 6 gives one.
- TST-741008 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
