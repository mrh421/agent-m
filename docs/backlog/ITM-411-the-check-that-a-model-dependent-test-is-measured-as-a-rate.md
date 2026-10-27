---
id: ITM-411
title: The check that a model-dependent test is measured as a rate
level: system
realises:
  - A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
modules:
  - MOD-result-records
  - MOD-test-document
builds_on:
  - ITM-251
  - ITM-304
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_rate_reporting.py` its requirements name
built_by:
  - e75a361d2b4767ebb4d5b27381aaeba41a16a534
---
# ITM-411 The check that a model-dependent test is measured as a rate

**REGISTER**

## Outcome

`tests/test_rate_reporting.py`, the check SPEC.md names for `A MODEL-DEPENDENT TEST IS MEASURED AS A RATE`: a
model-dependent test declares its number of runs before the first run (MOD-test-document's `testFindings`), and
MOD-result-records' `rateComparison` reports its pass rate on a commit beside the rate of the last release, from fixture
result records.

## Acceptance

- Its cases state: a declaration without its runs named; a rate reported beside the last release's, a worse one marked;
  a test without an earlier release reported without a comparison.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
