---
id: ITM-412
title: The check that a document holds no history
level: system
realises:
  - A DOCUMENT HOLDS NO HISTORY
modules:
  - MOD-documents
  - MOD-spec-document
  - MOD-text-tools
builds_on:
  - ITM-227
  - ITM-301
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_no_history.py` its requirements name
built_by:
  - 7514703c63e8a0eba195e369ed8d1f51214dbe6b
---
# ITM-412 The check that a document holds no history

**REGISTER**

## Outcome

`tests/test_no_history.py`, the check SPEC.md names for `A DOCUMENT HOLDS NO HISTORY`: this repository's SPEC, use
cases, architecture decisions, module files, backlog items and settings files read with MOD-documents'
`documentFindings` and MOD-spec-document's `requirementFindings`, whose marks of history MOD-text-tools gives; records
and dated measurements are not among them.

## Acceptance

- Its cases state: none of these files carrying a withdrawal note, an edit stamp or the date of a change; a fixture copy
  with each kind of mark planted named with its file and line; a record and a dated measurement not read as documents of
  this rule.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
