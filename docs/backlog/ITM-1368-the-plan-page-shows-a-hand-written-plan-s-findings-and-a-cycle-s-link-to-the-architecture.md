---
id: ITM-1368
title: The plan page shows a hand-written plan's findings, and a cycle's link to the architecture
level: module
realises:
  - UC-045
  - AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
  - A PLAN STEP NAMES THE TESTS OF ITS LEVEL
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1061
tests:
  - unit
origin:
  - findings UC045-F2 and UC045-F4 of ITM-1061's system tests TST-1061019 and TST-1061022 (#1650), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1036-development-release-testing-1061.md)
---
# ITM-1368 The plan page shows a hand-written plan's findings, and a cycle's link to the architecture

**REGISTER**

## Outcome

- UC-045 2a: a plan written by hand is checked as in step 3 when the planner presses *Save plan*. MOD-work-plans' `savePlan`
  runs `planFindings` first and writes nothing on an error (MOD-work-plans.md:215-217). A step with an empty level or
  phase never gets there: `ownStep` (`src/implementation-pages/plan.mjs:332`) throws a `TypeError`, and `saveOwn`
  (`plan.mjs:337-348`) a raw `DocumentError` for the order's row, and the page shows those.
- UC-045 3a: on a cycle in the modules' interfaces, Agent M names the modules of the cycle and links to UC-023 to change the
  architecture. `findingLine` (`plan.mjs:184`) draws a finding as text only.

## The reading taken

The route `plan` is the page of UC-045 (MOD-implementation-pages.md:162-168). A link the use case gives that page, beside a
finding the route already shows, is built in that route. The link leads to `#arc`, as the pull request of ITM-1061 reads it.

## Acceptance

- *Save plan* of a plan written by hand with a step whose level or phase is empty shows the findings of `planFindings`, and
  writes nothing; no `TypeError` or `DocumentError` reaches the page.
- A finding of a cycle in the modules' uses names its modules and carries a link to `#arc`.
- TST-1061019 and TST-1061022 lose their `todo`s in a commit by a participant other than the implementer, written after the
  code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
