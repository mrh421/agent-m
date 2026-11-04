---
id: ITM-1399
title: An editor links the arrangement
level: module
realises:
  - UC-018
  - REGROUPING LEAVES THE GROUPED FILE UNCHANGED
modules:
  - MOD-review-pages
builds_on:
  - ITM-376
tests:
  - unit
origin:
  - UC018-F3, TST-376213 of ITM-376's system tests of UC-018 (#1682), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1637-development-release-testing-0376.md)
---
# ITM-1399 An editor links the arrangement

**REGISTER**

## Outcome

UC-018 3e: the editor changes text only, never a group, and "a link opens the arrangement (UC-021)". MOD-review-pages'
editors (`<k>/<id>/edit`, `requirement/<name>/edit`) carry no such link. Only the lists link `arrange/<group kind>`
(`src/review-pages/flow.mjs:326`).

## Acceptance

- The editor of a requirement, a use case, a decision, a module or a test links the arrangement of its kind.
- TST-376213 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
