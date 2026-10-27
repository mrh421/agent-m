---
id: ITM-1164
title: MOD-trace-pages' Parts name tests.mjs and audit.mjs
level: module
realises:
  - A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES
modules:
  - MOD-trace-pages
builds_on:
  - ITM-766
  - ITM-768
tests:
  - unit
origin:
  - ITM-768's pull request #1248 (sprint team1/102), from developer-sonnet-a's report
built_by:
  - ac10b26d97a85eddcf2df67e6340ee683b2b86ec
  - 3fd2452ea63a0ef9a01d0f9c26f155e5f9baa15e
---
# ITM-1164 MOD-trace-pages' Parts name tests.mjs and audit.mjs

**REGISTER**

## Outcome

`A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES` (SPEC.md:1275-1279) asks a module's file to state the parts it
consists of. MOD-trace-pages' `## Parts` names `index.mjs`, `flow.mjs`, `subject.mjs`, `views.mjs`, `diagram.mjs` and
`export.mjs`. Two files in `src/trace-pages/` are not named there:
- `tests.mjs`, the tests view (ITM-766, ITM-769);
- `audit.mjs`, the audit view (ITM-768).

## Not ready: it is a draft for akmaier

The draft adds both files to MOD-trace-pages' `## Parts`, each with what it holds. No code changes.

## Acceptance

- MOD-trace-pages' `## Parts` names every file of `src/trace-pages/`, and akmaier has accepted the text.

**The draft is on `main` as `ac10b26d`** (MOD-trace-pages, by developer-sonnet-c). It changes no code, so the item is done once akmaier accepts it.
