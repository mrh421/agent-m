---
id: ITM-699
title: The old process-model reader and job file go
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
modules:
  - MOD-model-catalogue
  - MOD-job-catalogue
  - MOD-work-plans
builds_on:
  - ITM-681
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
---
# ITM-699 The old process-model reader and job file go

**REGISTER**

## Outcome

`docs/assets/jobs/propose-backlog-items/job.json` repeats the kind `propose-items`. It goes, as MOD-job-catalogue's
Parts say (`docs/architecture/MOD-job-catalogue.md:45`), and `tests/test_backlog_item_fields.py` (`:13`, `:31`,
`:192-196`) and `tests/test_artifact_format.py` (`:123`) stop reading it. The old process-model reader,
`docs/assets/process-model.mjs`, was removed by `4929406eb`; the old backlog view is gone (`docs/assets/dashboard/` holds
only `built.json`).

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.
- The Product Owner's planning run, on `main` at `ecc7de406` with `job.json` removed (20 test files that name the file,
  its folder or `docs/assets`, and `test_coverage_report`): the three cases of `TestTheJobThatDraftsItems` in
  `tests/test_backlog_item_fields.py` that read `job.json` fail with it gone, and nothing else. That file is MOD-work-plans'
  test, so the item names MOD-work-plans for it alone; no code of MOD-work-plans changes. The three cases go with the file,
  with the docstring's sentence on it, and the pull request names the case of `tests/job-catalogue.test.mjs` that keeps
  guarding the kind `propose-items`. The class's counter-proof case reads no job file and stays.
- `tests/test_artifact_format.py:123` names the path as a string and reads no file; it passes with the file gone and does
  not change.
