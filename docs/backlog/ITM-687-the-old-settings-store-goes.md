---
id: ITM-687
title: The old settings store goes
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - CONFIGURATION LIVES IN THE BROWSER
modules:
  - MOD-browser-store
builds_on:
  - ITM-574
  - ITM-683
  - ITM-684
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 7de9422363de7f873aad154967d52bd19323270e
---
# ITM-687 The old settings store goes

**REGISTER**

## Outcome

`docs/assets/settings-store.mjs` repeats MOD-browser-store, and `product-store-adapter.mjs` only translates its calls
to it. Once the live app, the main page and the settings view call MOD-browser-store, both go.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
