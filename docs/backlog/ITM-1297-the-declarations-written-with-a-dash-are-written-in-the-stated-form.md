---
id: ITM-1297
title: The declarations written with a dash are written in the stated form
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
  - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
modules:
  - MOD-reuse-facts
  - MOD-review-pages
  - MOD-source-register
  - MOD-workflow-entries
builds_on:
  - ITM-1285
tests:
  - unit
origin:
  - developer-sonnet-l's release tests of ITM-1285 (PR #1401), and po-opus-c's ruling in docs/backlog/sprints/team1/111.md
---
# ITM-1297 The declarations written with a dash are written in the stated form

**REGISTER**

## Outcome

MOD-test-document states the declaration's first line by its form, `// TST-014 · level: unit · module: MOD-text-tools`
(MOD-test-document.md:44-48). 733 test files write it so. Five write ` - ` in place of ` · `, and the reader reads none of
those 28 declarations:
- `tests/reuse-facts.test.mjs`: 9;
- `tests/review-pages-draft-requirements.test.mjs`: 5;
- `tests/source-register-version-fetch.test.mjs`: 6;
- `tests/workflow-entries-sources.test.mjs`: 3;
- `tests/review-pages-draft-architecture.test.mjs`: 5, among them TST-443001 (`:571`).

The defect is in those files, not in the reader. The text gives one form, and a second accepted form would be a copy of
the rule (AGENTS.md §2 principle 2). Written in the stated form, the five files are read with 28 declarations more. Of
these, 12 guard an entry that is neither a requirement's name nor a use case's identifier (A REFERENCE NAMES THE
IDENTIFIER, NOT THE POSITION):
- 4 in `review-pages-draft-requirements`;
- 5 in `source-register-version-fetch`;
- 3 in `workflow-entries-sources`.

Each `guards` entry then names the requirement or use case it means.

## Acceptance

- Every first line of a declaration in the five files is written in the stated form. MOD-test-document's reader then
  reads each file with no finding, shown against a known positive.
- No expected result of a test changes, and CI is green on every commit (refactoring).
- Only the five test files change.
- Tests of other modules this Outcome changes: none beyond the five files, each named by one of the item's modules.
