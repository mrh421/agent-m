---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 62916c73a22d52e934a67deee133f611bf5e342f
  - https://github.com/akmaier/agent-m/pull/1541
date: 2026-10-31 03:59 UTC
---
# Release testing → Sprint review: team 1's sprint 129

**REGISTER**

## Reason

The release tests of sprint 129's selection pass on `sprint/team1/129` at `62916c73`, the head of pull request #1541
into `main` when this was decided.

The condition is "written by a participant other than the implementer of the behaviour they test, green on the sprint
branch" (`docs/process-models/scrum-wip.md:54`).

1. **What the sprint holds.**
   - **Merges:** the four items are merged into the branch: #1537 (ITM-1322), #1538 (ITM-1324), #1539 (ITM-1323) and
     #1540 (ITM-803). Each passed its Development gate (`docs/gates/20261030-2007-…-a1322.md`, `-b1324.md`, `-c1323.md`,
     `20261030-2035-…-d803.md`).
   - **Merge commits:** `git show --cc` of `141e9570c`, `cd46d9ea2`, `2dd27c061` and `62916c73a` shows no text of
     their own, so no conflict was resolved.
   - **Against `main`:** the diff from `main` holds the test files of the four items and the four gate records, and no
     code file.
2. **The release tests and their writers** (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER, SPEC.md:1535-1539).
   - **ITM-1323:** `tests/release-itm-1319-accept-ticked-and-all-shown.test.mjs`, TST-1319205 to 1319207, by
     developer-opus-f. ITM-1319's behaviour was written by developer-opus-e alone (`9e9c87e92`, `20a7a9c16`).
   - **ITM-803:** `tests/system-uc-032-maintain-the-backlog.test.mjs` and the three `release-uc-032-*` files, TST-803001
     to 803027 and 803101 to 803113, by developer-sonnet-l, who has written no file under `src/` (`team1/129.md`).
   - **ITM-1322 and ITM-1324:** they change four and two comment lines of a test file, and no behaviour, so no release
     test of theirs is due. Their own files pass (below).
3. **Green on the sprint branch.**
   - **CI:** run 41166341235 (`pull_request`, attempt 1) on `62916c73` succeeds: 41 jobs succeed, 17 are skipped, and
     none failed.
   - **The sprint's test files, in an export of the head:** `prompt-bar-one-kind`, `site-frame-schema-form-missing-key`,
     `site-frame-preloads`, both `release-itm-1319-accept*` files, the system and three release files of UC-032, and
     `test-document-one-line`. They give 58 tests: 49 pass, 9 todo and 0 fail.
     - The 9 `todo` cases are ITM-803's findings S1 to S9. Each was ruled at its gate (`…-d803.md`, Noted).
   - **UC-032's existing release checks:** `test_parallel_sprints`, `test_wip_limit`, `test_time_box_selection` and
     `test_job_from_backlog`, with `test_backlog_from_acceptance`, run 52 cases, OK.
4. **No test identifier is repeated.** The repeat reading of MOD-test-document's `testDeclarations`, on the head, finds
   1,491 test files, 5,848 declarations, 5,848 identifiers and 0 repeats.
   - Known positive: on `main` at `4c27ee9e2` the same reading finds 5,805 declarations, 5,803 identifiers and 2 repeats,
     TST-1290001 and 1290002, which ITM-1324 removed.
5. **MOD-test-document's reader** on the sprint's new and changed test files: 0 findings in each.
   - `prompt-bar-one-kind` has 5 declarations.
   - `site-frame-schema-form-missing-key` has 2.
   - `release-itm-1319-accept-ticked-and-all-shown` has 3.
   - UC-032's files have 27, 4, 4 and 5.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.

## Noted

- **The findings of the sprint's release tests are ruled at their gates.** There is none for ITM-1323. ITM-803's S1 to
  S9 and `tests/test_gate_record.py` are ruled in `…-d803.md`, with the owner of each: new items for the Product
  Owner, and questions for akmaier.
- **`main` has repository-wide test identifiers free of repeats.** ITM-1321's repository-wide case can then find none,
  once its sentence of MOD-trace-graph is accepted.
