---
id: ITM-410
title: The check that a test states its expected result
level: system
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-test-document
builds_on:
  - ITM-304
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_test_battery.py` its requirements name
built_by:
  - 5730e8ba6ac14d4c130521eefba9d56a8c06565c
---
# ITM-410 The check that a test states its expected result

**REGISTER**

## Outcome

`tests/test_test_battery.py`, the check SPEC.md names for `A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS`, through
MOD-test-document's `testDeclarations` and `testFindings`: a battery of fixture test files, each case with or without
its input, its precondition and its expected result, read without running any of them.

## Acceptance

- Its cases state: a complete declaration passing; each of the three parts missing named as its finding, with the test
  and its line.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
