---
id: ITM-1358
title: A pending move names where the item came from
level: module
realises:
  - UC-021
modules:
  - MOD-review-pages
builds_on:
  - ITM-738
tests:
  - unit
origin:
  - finding F4 of ITM-738's system test TST-738006 (#1629), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1545-development-release-testing-0738.md)
---
# ITM-1358 A pending move names where the item came from

**REGISTER**

## Outcome

UC-021 step 3 lists the pending changes as "*moved UC-007 from "Review" to "Approval"*". The page `arrange/<group kind>`
lists a move as "Move X to …" and leaves out the group it came from (`src/review-pages/arrange.mjs:64-72`).

## Acceptance

- A pending move names the item, the group it came from and the group it goes to, or *the top level* for either. A
  group's move names the group the same way.
- TST-738006 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
