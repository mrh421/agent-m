---
id: ITM-1356
title: The tests browser offers Arrange
level: module
realises:
  - UC-021
  - ARTIFACTS ARE ARRANGED IN NESTED GROUPS
modules:
  - MOD-trace-pages
builds_on:
  - ITM-738
tests:
  - unit
origin:
  - finding F1 of ITM-738's system test TST-738003 (#1629), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1545-development-release-testing-0738.md)
---
# ITM-1356 The tests browser offers Arrange

**REGISTER**

## Outcome

UC-021 step 1: "in the list of use cases, architecture elements, modules or tests, the author presses **Arrange**."
MOD-review-pages gives the route `arrange/<group kind>` for tests too (MOD-review-pages.md:283-285). The list of tests is
MOD-trace-pages' view `tests` (MOD-trace-pages.md:135), and it offers no *Arrange* (`src/trace-pages/flow.mjs:656`).

## Acceptance

- At the default branch's head, the view `tests` offers *Arrange*. It leads to MOD-review-pages' `arrange/tests`, with
  the product kept in the address as the review pages keep it. At a release tag, or while it shows an earlier commit's
  version, it offers none (MOD-trace-pages.md:80-84).
- TST-738003 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
