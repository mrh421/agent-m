---
id: ITM-413
title: The check of an implementation job's pull request
level: system
realises:
  - AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
  - A REFACTORING JOB BEGINS WITHOUT A FAILING TEST
  - A REFACTORING JOB CHANGES NO EXPECTED RESULT
  - AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
modules:
  - MOD-product-process
builds_on:
  - ITM-409
tests:
  - release
origin:
  - SPEC.md: the check `tests/test_implementation_job.py` its requirements name
built_by:
  - e4d85ab2806a9a8ef467d26cd604b6d1b3eb2e7b
---
# ITM-413 The check of an implementation job's pull request

**REGISTER**

## Outcome

`tests/test_implementation_job.py`, the check SPEC.md names for these requirements, through MOD-product-process'
`doneCheck` (ITM-409) on fixture pull-request facts: the job branch's first commit and its CI result, every commit's CI
result for a refactoring job, the asserted values a refactoring changes, and the files a job's pull request changes
against the folders of its modules. How a pull request between jobs is checked is stated by no module, so that part of
`WHAT NO MODULE OWNS IS CHANGED BETWEEN JOBS` is not part of this item.

## Acceptance

- Its cases state: a job whose first commit holds only tests with red CI passing, and one with code in it refused; a
  refactoring job with a red commit refused and one green on every commit passing; a refactoring that changes an
  asserted value refused and one that moves a test passing; a job's pull request changing a file outside its modules
  refused.
- Each test states its input, its precondition and its expected result where they can be read without running it, names
  what it guards, the module it exercises and its level `release`; its cases stand in a Markdown data file beside it and
  the Python file only loads them (AGENTS.md §7).
- It is written by a participant who implemented none of the behaviour it tests (`RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER`); each test's counter-proof — a fault planted in the code it guards, and the test failing on it — is
  recorded in the pull request.
- Where the code does not do what the requirement says, the test follows the requirement and the disagreement is named
  as a finding.
- Only the new test file and its data file change.

**Read at sprint team1/93 (developer-sonnet-c): built** (`e4d85ab2`, team2/26.md). All six behaviours are cases of
`tests/test_implementation_job.md` and match `src/product-process/done.mjs`. Its tests pass (`test_implementation_job`,
`product-process-done`, `product-process`). It is done. Branches of `done.mjs` without a case (`:83`, `:90`, `:95`,
`:108-111`) are findings, registered once four-digit identifiers stand on `main`. The carve-out for work between jobs stays
with akmaier, as the item says.

