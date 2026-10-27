---
id: ITM-474
title: Pull request item names are matched without case sensitivity
level: module
realises:
  - UC-032
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
  - A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
modules:
  - MOD-work-plans
  - MOD-work-items
builds_on:
  - ITM-295
  - ITM-469
tests:
  - unit
origin:
  - akmaier reported the backlog dashboard still showing many already merged items as open
built_by:
  - 9ab15a195f36ef612b25632f20540384ef1d5a5c
---
# ITM-474 Pull request item names are matched without case sensitivity

**REGISTER**

## Outcome

The backlog state and sprint-hold derivation treat a pull request title or head branch that contains an item identifier in
any letter case as naming the canonical uppercase item. The canonical item identifiers in backlog files and sprint
records remain uppercase.

## Acceptance

- Unit tests for MOD-work-items and MOD-work-plans state, before the code exists, that a merged pull request whose branch
  contains `itm-014` or `itm-001` in lower case marks or releases the uppercase backlog item.
- Existing tests that derive item state and held items stay green.
