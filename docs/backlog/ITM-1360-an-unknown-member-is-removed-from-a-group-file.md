---
id: ITM-1360
title: An unknown member is removed from a group file
level: module
realises:
  - UC-021
  - AN ITEM HAS ONE PLACE IN ITS HIERARCHY
modules:
  - MOD-group-document
  - MOD-review-pages
builds_on:
  - ITM-738
tests:
  - unit
origin:
  - finding F3 of ITM-738's system test TST-738015 (#1629), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1545-development-release-testing-0738.md)
---
# ITM-1360 An unknown member is removed from a group file

**REGISTER**

## Outcome

UC-021 3a: "The group file names an identifier that no longer exists. The tree shows it as *unknown member*; the author
removes it or leaves it." The page shows it (`src/review-pages/arrange.mjs:191-198`). But no move removes it.
MOD-group-document's `GroupMove` gives `create`, `rename`, `move`, `move-group`, `delete` and `lift`
(MOD-group-document.md:67-69), and "no move deletes an item".

## Not ready: for akmaier

No accepted text gives a move that takes an unknown member out of a group file. Writing the file around
`applyMoves` would keep a second rule for the group file outside the module that owns it. The general cause: MOD-group-document
needs a move that removes a member matching no item (an unknown member is no item, so "no move deletes an item" still
holds). Once its text gives that move, MOD-review-pages offers *Remove* beside each unknown member, and TST-738015 loses
its `todo`.

## Acceptance

- An unknown member offers *Remove*. The move takes it out of the group file, and every item stays where it is.
- TST-738015 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
