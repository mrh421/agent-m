---
id: ITM-1409
title: An implementation job receives its item and what it realises
level: module
realises:
  - UC-034
  - A PROCESS REQUIREMENT ADDS TO THE MODEL
modules:
  - MOD-run-planner
builds_on:
  - ITM-805
tests:
  - unit
origin:
  - UC034-F2, TST-805208 of ITM-805's system tests of UC-034 (#1699), ruled at its gate in team1's sprint 142 (docs/gates/20261101-2000-development-release-testing-0805-1045.md)
---
# ITM-1409 An implementation job receives its item and what it realises

**REGISTER**

## Outcome

UC-034 step 3 says what is sent to an implementing participant: "the item; the requirements and use cases it realises, and
their existing tests", and the product's process requirements. The recipe `implementation-inputs` of MOD-run-planner sends
the module files, the decisions, the SPEC, the interfaces used and the modules' code and tests. It sends no item file, no
realised use case, no tests of the realised requirements and no process requirements.

## The reading taken

MOD-run-planner's list of what the recipe gives "for a step or item" names what it must hold, not all it may hold. So the
recipe also gives the item's file, the use cases it realises, the existing tests that guard its requirements and the
product's process requirements. The coding standards file stays cut (ITM-568).

## Acceptance

- The input of an implementation job for an item holds the item's file, the use cases it realises, the existing tests that
  guard the requirements it realises, and the process requirements. Each part names the sources whose content it carries.
- TST-805208 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
