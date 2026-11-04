---
id: ITM-1407
title: The close-sprint answer names its new items
level: module
realises:
  - UC-041
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
modules:
  - MOD-job-catalogue
builds_on:
  - ITM-991
tests:
  - unit
origin:
  - UC041-F5, TST-991206 of ITM-991's system tests of UC-041 (#1698), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1949-development-release-testing-0991.md)
---
# ITM-1407 The close-sprint answer names its new items

**REGISTER**

## Outcome

`A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT`: the review's feedback enters the backlog as items (UC-041 step 6). The
answer schema and the prompt of the job kind `close-sprint` name no `newItems`. So a closer is never asked for them. Known
positive: a draft that holds them is committed.

## Acceptance

- The kind `close-sprint` asks for and accepts the review's new items in its answer, and a close whose feedback names
  them commits them.
- TST-991206 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
