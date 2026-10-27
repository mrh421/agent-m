---
id: ITM-447
title: The architecture's cases of the derivation checks
level: system
realises:
  - THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE
  - THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
  - NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
  - THE DERIVATION RULES HOLD FOR ARCHITECTURE
modules:
  - MOD-job-runner
  - MOD-approvals
  - MOD-spec-changes
  - MOD-documents
builds_on:
  - ITM-414
  - ITM-415
  - ITM-437
  - ITM-438
tests:
  - release
origin:
  - SPEC.md: the checks `tests/test_derivation_context.py` and `tests/test_derivation_classes.py` its requirements name
built_by:
  - 4b7269b16625cf9b52212e7f879a8b1f440541ab
---
# ITM-447 The architecture's cases of the derivation checks

**REGISTER**

## Outcome

The architecture's cases of the two checks SPEC.md names for these requirements, beside the cases ITM-414 and ITM-415
write. In `tests/test_derivation_context.py`: a first derivation of the architecture for a fixture product prepared with
every requirement and every accepted use case and no selection, and a derivation of part of them refused; the input of a
fixture drafter and of a fixture reviewer holding every requirement, every accepted use case and every file of the
draft; a participant whose context cannot hold them named, and nothing sent. In `tests/test_derivation_classes.py`: the
same battery with architecture fixtures — drafted decisions and module files classed as new, a change, a duplicate or a
conflict by the keys of their formats.

## Acceptance

- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the architecture's cases added to the two test files and to their data files change.
