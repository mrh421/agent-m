---
id: ITM-416
title: The check that the person who prompts is a source
level: system
realises:
  - THE PERSON WHO PROMPTS IS A SOURCE
modules:
  - MOD-source-register
  - MOD-spec-changes
builds_on:
  - ITM-383
  - ITM-393
  - ITM-396
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_prompted_source.py` its requirements name
built_by:
  - 1bdbf0a726b89eaeceb1b129cc60bca4ab3d7953
---
# ITM-416 The check that the person who prompts is a source

**REGISTER**

## Outcome

`tests/test_prompted_source.py`, the check SPEC.md names for `THE PERSON WHO PROMPTS IS A SOURCE`: a change of a
requirement by prompt with a fixture participant, for a person whose source the fixture product registers and links,
found with MOD-source-register's `personSource` (ITM-383), and the sections the change would save composed with
MOD-spec-changes' `entrySections` (ITM-393).

## Acceptance

- Its cases state: every drafted requirement naming that person's source among its sources; a person without a linked
  source getting no source, so that nothing is sent.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
