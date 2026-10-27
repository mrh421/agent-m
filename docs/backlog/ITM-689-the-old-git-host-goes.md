---
id: ITM-689
title: The old git host goes
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - NO SERVER
modules:
  - MOD-repository-hosts
builds_on:
  - ITM-680
  - ITM-681
  - ITM-683
  - ITM-684
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
built_by:
  - 511d691c8bcc952918f29f5a9d29e210bb94976a
---
# ITM-689 The old git host goes

**REGISTER**

## Outcome

`docs/assets/git-host.mjs` and `git-host/pull-requests.mjs` repeat MOD-repository-hosts. Once the views and the main
page are the modules', no file imports them, and they go. The queue `2026-10-16_the-destination-check-names-the-tests-that-check-it` names the
module tests that check the destinations (ITM-528).

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.

**Noted at ITM-807's gate (sprint team1/74, 2026-10-17, po-opus).** `tests/review-core.d/git-host.test.mjs` names
MOD-repository-hosts since ITM-807. Its body still carries item history, `(ITM-006)` at `:26`, which this item removes.
