---
id: ITM-698
title: The old pseudonymiser and tunnel go
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
modules:
  - MOD-personal-data
  - MOD-bridge-client
builds_on:
  - ITM-680
  - ITM-683
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - a47cf17301144f2d987cbbb85828221f0ec6c864
  - 9d81c5a69c5efbb58b206376c173014169047238
---
# ITM-698 The old pseudonymiser and tunnel go

**REGISTER**

## Outcome

`docs/assets/pseudonymiser.mjs` repeats MOD-personal-data, and `docs/assets/bridge-tunnel.mjs` MOD-bridge-client's
`allocatePort` and `tunnelCommands`. Once the old writes and settings view are gone, both go.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.
