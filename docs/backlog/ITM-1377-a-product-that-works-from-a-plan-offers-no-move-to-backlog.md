---
id: ITM-1377
title: A product that works from a plan offers no Move to backlog
level: module
realises:
  - UC-033
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-804
tests:
  - unit
origin:
  - finding UC033-F4 of ITM-804's system test TST-804210 (#1653), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1108-development-release-testing-0804.md)
---
# ITM-1377 A product that works from a plan offers no Move to backlog

**REGISTER**

## Outcome

UC-033 1b: a product that works from a plan has no backlog; a bug is fixed directly (UC-012 step 5). The issue route
offers *Move to backlog* for a bug or a change whatever model the product declares (`src/maintenance-pages/issues.mjs:322`,
`:556-562`).

## Not ready — for akmaier

The issue route must know whether the product's declared model plans its work or pulls it from a backlog.
MOD-maintenance-pages' Uses name nothing of MOD-product-process, or of anything else that reads the declaration
(MOD-maintenance-pages.md:40-66). The general change it asks: the module's Uses name the function that gives a product's
workflow, as MOD-work-plans' do (`MOD-product-process.productWorkflow`).

## Acceptance

- For a product whose declared model plans its work, the issue page offers no *Move to backlog* and writes nothing under
  `docs/backlog/`; the fix of UC-012 step 5 is offered.
- TST-804210 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
