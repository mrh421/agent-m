---
id: ITM-1255
title: A backlog's module files and list fields are read in one place
level: module
realises:
  - A BACKLOG ITEM NAMES THE MODULES IT CHANGES
modules:
  - MOD-work-plans
builds_on:
  - ITM-1250
tests:
  - unit
origin:
  - the review of ITM-1250 (PR #1380) by reviewer-sonnet, against AGENTS.md §2 principle 2, "Nothing twice"
---
# ITM-1255 A backlog's module files and list fields are read in one place

**REGISTER**

## Outcome

Within MOD-work-plans, four rules of the backlog stand twice:
- **The file of a backlog item:** `ITEM_FILE` (`src/work-plans/saves.mjs:33`) and `BACKLOG_ITEM`
  (`src/work-plans/strategies.mjs:74`). These are one rule.
- **An item's identifier taken from a path:** `ANY_ITEM_FILE` (`saves.mjs:34`) and `ITEM_ID` (`strategies.mjs:173`). These
  are near-equal: the first asks for a file ending `.md`.
- **The architecture's module files, found and read:** `strategies.mjs:243` (`documents(MODULE_FILE, …)`) and `:384`
  (`snapshot.paths.filter(MODULE_FILE.test)` and `readDocument`).
- **A list-valued field read as a list:** `list` in `saves.mjs:39` and `src/work-plans/states.mjs:18`, the same function.

Each is defined once within the module, and used from there.
- For the near-equal pair, one rule is kept only where it gives every caller the same result as today. Where it does
  not, the two stay, and the pull request names why.
- `asList` (`strategies.mjs`) reads a drafted answer's lists, a rule of its own, and stays.

The same reads in MOD-issue-handling and MOD-maintenance-pages are ITM-1298's. MOD-work-plans' interface offers none of
them (MOD-work-plans.md, `provides:`), and those modules' Uses name only `saveItems` and `backlogFindings`. So that part
waits for a draft of their module files for akmaier (DEVELOP AGAINST INTERFACES, A MODULE INTERFACE IS MINIMAL).

## Acceptance

- The existing tests of MOD-work-plans pass unchanged, and no expected result changes. CI is green on every commit
  (refactoring).
- A unit test naming MOD-work-plans pins that each rule above has one definition. Its counter-proof is a second copy
  planted in another file of the module.
- Only `src/work-plans/` and the tests that name MOD-work-plans change.
