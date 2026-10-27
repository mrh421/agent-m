---
id: ITM-693
title: A test's level is read by the test-document module
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - EVERY TEST HAS ONE LEVEL
modules:
  - MOD-test-document
  - MOD-test-schedule
builds_on:
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 3e995d128e066871a60c76ed349bd4f3a98f1b91
---
# ITM-693 A test's level is read by the test-document module

**REGISTER**

## Outcome

The workflows `tests.yml` and `nightly.yml` pick tests by level through `docs/assets/artifacts/headers.mjs`
(`headerTags`). MOD-test-document's `testDeclarations` reads the same header lines. The workflows, named in
MOD-test-schedule's Parts, read through it, and `headers.mjs` goes. `tests/jsrun.py` becomes MOD-test-document's.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
