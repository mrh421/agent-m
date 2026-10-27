---
id: ITM-696
title: The old identity checks go
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - THE NAME IS THE ID AND IT SURVIVES
modules:
  - MOD-identifiers
builds_on:
  - ITM-694
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 98721efc88d3e6cdb95a47809976dd6e609dce99
---
# ITM-696 The old identity checks go

**REGISTER**

## Outcome

`docs/assets/artifacts/identity.mjs` repeats `identifiersIn` and MOD-spec-document's `renamedRequirements`. Its tests
are rewritten on MOD-identifiers, and it goes.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.

**Read at sprint team1/73's start (2026-10-17, po-opus).** `docs/assets/artifacts/identity.mjs` is imported by
`docs/assets/artifacts/checks.mjs:36` and by `tests/artifacts-checks.test.mjs:23`. `checks.mjs` is MOD-documents' to
remove, in ITM-694, which this item builds on.
