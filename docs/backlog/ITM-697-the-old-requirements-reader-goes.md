---
id: ITM-697
title: The old requirements reader goes
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - A REQUIREMENT HAS FOUR FIELDS
modules:
  - MOD-spec-document
builds_on:
  - ITM-681
  - ITM-685
  - ITM-692
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 3e995d128e066871a60c76ed349bd4f3a98f1b91
---
# ITM-697 The old requirements reader goes

**REGISTER**

## Outcome

`docs/assets/artifacts/requirements.mjs` repeats `parseSpec`, `requirementFindings` and `requirementNamesIn`. Once
its importers are gone, its tests are rewritten on MOD-spec-document, and it goes.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.
