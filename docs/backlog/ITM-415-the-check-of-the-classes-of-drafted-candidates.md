---
id: ITM-415
title: The check of the classes of drafted candidates
level: system
realises:
  - A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
  - EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
  - A CHANGE IS PROPOSED UNDER THE EXISTING NAME
  - A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
  - A CONFLICT IS DECIDED BY A PERSON
  - CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
modules:
  - MOD-documents
  - MOD-job-runner
  - MOD-spec-changes
builds_on:
  - ITM-387
  - ITM-393
  - ITM-338
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_derivation_classes.py` its requirements name
built_by:
  - c60dc42c528877b3fb050a18701b4d5407024037
---
# ITM-415 The check of the classes of drafted candidates

**REGISTER**

## Outcome

`tests/test_derivation_classes.py`, the check SPEC.md names for these requirements, without a model: MOD-documents'
`classifyCandidates`, MOD-job-runner's check `candidate-classes` (ITM-387) and MOD-spec-changes' `entrySections`
(ITM-393) with the writer `queue-entries` (ITM-338), over fixture candidates. The rate of `THE MODEL'S CLASSIFICATION IS
MEASURED, NOT TRUSTED` needs a model's answers and belongs to a nightly run; the architecture fixtures of `THE
DERIVATION RULES HOLD FOR ARCHITECTURE` are ITM-447's.

## Acceptance

- Its cases state: each class kept; an exact duplicate found by rule; two candidates of one rule merged naming both
  passages; a change written under its name, a duplicate as an added source, an undecided conflict not written.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
