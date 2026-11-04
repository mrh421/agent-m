---
id: ITM-654
title: A fix shows each changed expectation, old beside new
level: module
realises:
  - UC-012
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-582
  - ITM-583
tests:
  - unit
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), whose row was blocked on a draft that akmaier accepted in b43da779
---
# ITM-654 A fix shows each changed expectation, old beside new

**REGISTER**

## Outcome

UC-012 5a: "the author sees the old and the new expectation side by side". MOD-maintenance-pages' `issues` route
(accepted text): "before its pull request is merged, for each existing test whose expected result the fix changes, the
requirement it now checks correctly with the old and the new expectation side by side". The interfaces it reads, and
whether its path reads the repository per test, are read at its start (sprint 66's agreement).

**Read at its start** (team 2's sprint 97, 2026-10-20):
- The page reaches a fix's pull request only through the route `issues`, which ITM-582 builds (`confirmClass`), and the
  fix only through ITM-583 (`fix-inputs`' pull request, `closeWithLinks`). ITM-582 is merged (#1255;
  `src/issue-handling/classes.mjs`); ITM-583 is not built — no file under `src/` defines `fix-inputs` or `closeWithLinks`.
  So it waits for ITM-583.
- It reads the fix's pull request, its changed files on both sides, and the declarations of the tests among them.
  MOD-maintenance-pages' Uses name the interfaces that give them (`docs/architecture/MOD-maintenance-pages.md:29-80`,
  `:175-180`): `MOD-job-ledger.recordsNewestFirst` gives the `fix-bug` job whose `works_on` names the issue,
  `MOD-runtimes.jobTrail` its branch's pull request, then `MOD-repository-hosts.pullRequestFacts`,
  `MOD-test-document.isTestFile` and `testDeclarations`. No file under `src/maintenance-pages/` shows an old and a new
  expectation yet.

## Acceptance

- Before a fix's pull request is merged, each existing test whose expected result it changes is shown with its requirement, the old and the new expectation side by side.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Tests of other modules this Outcome changes: none. Every test that draws the issue route names MOD-maintenance-pages
  in its header: the `maintenance-pages-*` tests, `system-uc-012-fix-a-bug`, `test_issue_to_spec.py`, and the release
  tests `release-itm-1254-issue-move` and `release-itm-1257-move-form-lists`. A release test among them is changed only
  by a participant who implemented none of this item.
- Only `src/maintenance-pages/` and the tests that name MOD-maintenance-pages change.
