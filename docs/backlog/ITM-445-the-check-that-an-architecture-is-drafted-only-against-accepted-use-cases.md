---
id: ITM-445
title: The check that an architecture is drafted only against accepted use cases
level: system
realises:
  - ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES
modules:
  - MOD-approvals
  - MOD-job-runner
builds_on:
  - ITM-437
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_job_preconditions.py` its requirements name
built_by:
  - 99931d8eaff93d4d793b0463c96ea0fc2dcee3da
---
# ITM-445 The check that an architecture is drafted only against accepted use cases

**REGISTER**

## Outcome

`tests/test_job_preconditions.py`, the check SPEC.md names for this requirement, for the architecture: a job of
`derive-architecture` prepared with MOD-job-runner's `prepareJob` and MOD-approvals' precondition `architecture-ready`
(ITM-437) over a fixture product with an open use case does not start and names that use case; once an approval record
names its text, it starts. The other requirements that name the same check — `A PLANNED MODEL IMPLEMENTS ITS
IMPLEMENTATION PLAN` and `NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED` — wait for their use cases' items.

## Acceptance

- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
