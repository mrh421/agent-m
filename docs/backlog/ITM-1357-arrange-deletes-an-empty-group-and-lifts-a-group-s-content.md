---
id: ITM-1357
title: Arrange deletes an empty group and lifts a group's content
level: module
realises:
  - UC-021
  - ARTIFACTS ARE ARRANGED IN NESTED GROUPS
modules:
  - MOD-review-pages
builds_on:
  - ITM-738
tests:
  - unit
origin:
  - finding F2 of ITM-738's system test TST-738012 (#1629), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1545-development-release-testing-0738.md)
---
# ITM-1357 Arrange deletes an empty group and lifts a group's content

**REGISTER**

## Outcome

UC-021 2b: "Only an empty group can be deleted; otherwise the author first moves its content, or chooses *move content up
one level*." MOD-group-document gives the moves `{ op: "delete", group }` and `{ op: "lift", group }`. `applyMoves`
refuses to delete a group that is not empty (MOD-group-document.md:67-69, :78-81). The page `arrange/<group kind>` offers
neither (`src/review-pages/arrange.mjs:200-215`).

## Acceptance

- Each group on the page offers *Delete*, which hands `applyMoves` a `delete` move, and *Move content up one level*,
  which hands it a `lift` move.
- A refused move shows its reason, and nothing changes.
- Each applied move stands among the pending changes.
- TST-738012 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
