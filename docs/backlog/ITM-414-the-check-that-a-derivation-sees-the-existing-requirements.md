---
id: ITM-414
title: The check that a derivation sees the existing requirements
level: system
realises:
  - DERIVATION SEES THE EXISTING REQUIREMENTS
  - NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
  - A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
modules:
  - MOD-job-runner
  - MOD-spec-changes
builds_on:
  - ITM-337
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_derivation_context.py` its requirements name
built_by:
  - 1c30257b229de2980be2072e1f7fd05071a58feb
---
# ITM-414 The check that a derivation sees the existing requirements

**REGISTER**

## Outcome

`tests/test_derivation_context.py`, the check SPEC.md names for these requirements, for the kinds that write
requirements: a job of `derive-requirements` and of `change-requirements` prepared with MOD-job-runner's `prepareJob`
and MOD-spec-changes' recipe `spec-with-queues` (ITM-337) over a fixture product with open queues. The architecture's
rules that name the same check are ITM-447's.

## Acceptance

- Its cases state: every requirement of the SPEC and of every open queue in the input; a participant whose context
  cannot hold them named as not fitting, nothing sent.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
