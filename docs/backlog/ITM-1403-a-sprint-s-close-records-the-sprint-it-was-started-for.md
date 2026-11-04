---
id: ITM-1403
title: A sprint's close records the sprint it was started for
level: module
realises:
  - UC-041
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
modules:
  - MOD-work-plans
builds_on:
  - ITM-991
tests:
  - unit
origin:
  - UC041-F1, TST-991207 of ITM-991's system tests of UC-041 (#1698), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1949-development-release-testing-0991.md)
---
# ITM-1403 A sprint's close records the sprint it was started for

**REGISTER**

## Outcome

The writer `sprint-record` reads the sprint from the draft (`src/work-plans/strategies.mjs:462`), but the answer schema of
`close-sprint` names no `sprint`. So the close fails with `UnknownWork` (:128) and nothing is recorded. The sprint the
close is for is the job's parameter.

## Acceptance

- A close started for a sprint records the review and the retrospective in that sprint's record, whatever the draft
  holds.
- TST-991207 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
