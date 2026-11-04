---
id: ITM-1300
title: The progress page tests guard use cases by identifier
level: module
realises:
  - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
modules:
  - MOD-implementation-pages
builds_on: []
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1260 (PR #1406), docs/gates/20261029-0637-development-release-testing-60ac.md, the reader on the changed tests
---
# ITM-1300 The progress page tests guard use cases by identifier

**REGISTER**

## Outcome

`tests/implementation-pages-progress.test.mjs` holds two guards entries that name a use case's steps: "UC-035 steps 3, 4
and 5" and "UC-035 2b". MOD-test-document's reader reports both under A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION,
on `sprint/team1/112` as on ITM-1260's head. A guards entry is "the requirements it guards by name, or use cases by
identifier" (MOD-test-document.md:60). The entries name UC-035.

## Acceptance

- The reader reads the file with no finding, shown against a known positive.
- No expected result changes, and CI is green on every commit (refactoring).
- Only `tests/implementation-pages-progress.test.mjs` changes.
- Tests of other modules this Outcome changes: none. It removes no test.
