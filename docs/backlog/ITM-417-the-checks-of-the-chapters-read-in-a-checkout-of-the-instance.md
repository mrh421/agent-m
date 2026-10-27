---
id: ITM-417
title: The checks of the chapters read in a checkout of the instance
level: system
realises:
  - A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE
  - A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING
  - A TEST JOB RECEIVES THE CHAPTER ON TESTING
  - AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION
  - AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING
modules:
  - MOD-source-register
builds_on:
  - ITM-392
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_job_reading.py` its requirements name
built_by:
  - 3e3adec9834ab849b9e1108db92b9abfff064983
---
# ITM-417 The checks of the chapters read in a checkout of the instance

**REGISTER**

## Outcome

The cases SPEC.md's check `tests/test_job_reading.py` names for a job in a checkout of the instance: the input of each
kind built from its job definition with a fixture checkout, through MOD-source-register's chapter recipes (ITM-392), and
compared with the book's chapter files and their recorded hashes.

## Acceptance

- Its cases state: each kind's input naming the paths of its chapters in the checkout, each file matching its recorded
  SHA-256; a chapter file changed in the checkout refused by name; the browser's cases of the file unchanged in what
  they assert.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.
