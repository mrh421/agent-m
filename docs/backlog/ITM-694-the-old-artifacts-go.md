---
id: ITM-694
title: The old artifacts go
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - ARTIFACTS ARE MARKDOWN
modules:
  - MOD-documents
builds_on:
  - ITM-690
  - ITM-692
  - ITM-695
  - ITM-697
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 3e995d128e066871a60c76ed349bd4f3a98f1b91
  - 1ee8b166972dc4ca9b0aa42cc0ae24a9a39481e1
---
# ITM-694 The old artifacts go

**REGISTER**

## Outcome

`docs/assets/artifacts.mjs`, `artifacts/checks.mjs` and `use-cases.mjs` repeat MOD-documents. Once their importers
are gone, they go, and their tests are rewritten on the module or go with them.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.
