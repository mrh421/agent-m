---
id: ITM-518
title: No test takes its expected result from a document
level: system
realises:
  - A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-test-document
builds_on:
tests:
  - unit
origin:
  - docs/backlog/sprints/team1/28.md
---
# ITM-518 No test takes its expected result from a document

**REGISTER**

## Outcome

The check the SPEC names for `A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT`,
`tests/test_expected_results_stated.py`, exists — ITM-650 built it (`4ebfa61c`, `a4c48e84`), with the counter-proof the
SPEC names (TST-650002) —: it lists every test that names a module and reads `SPEC.md`, a file
under `docs/use-cases/` or a file under `docs/architecture/` when it runs, for review. Sprint 28's review found such tests
still in place: TST-472343 reads `docs/architecture/MOD-job-runner.md`, and the case at
`tests/spec-changes-queue-entries.test.mjs` "queue-entries — each entry has its rationale" computes its expected trailers
with `provenanceLines`; a search of `tests/` found at least 8, 20 and 12 test files reading a module file, a use case and
`SPEC.md` (queue 2026-10-15b's impact list), as lower bounds. `tests/job-runner-records.test.mjs:20` still reads `docs/architecture/MOD-job-runner.md` for TST-472343 (`:55`). What is
left is the second point of the Acceptance: the list read, and each listed test named for an item of its module.

## Acceptance

- The check exists, with the counter-proof the SPEC names: a fixture test that compares a function's result with a value
  read from a module file is listed; the same test stating that value in its own text is not.
- Its list, as it stands on the sprint's base, is in the pull request; each listed test that takes an expected result from
  a document is named for an item of its module, or changed here where its module is this item's.

## Intake Decision

Registration only, by scrum-master-opus from Sprint 28's review; it waits for the Product Owner's selection.
