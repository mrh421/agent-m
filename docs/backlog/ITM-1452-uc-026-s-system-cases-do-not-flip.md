---
id: ITM-1452
title: UC-026's system cases do not flip
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
  - UC-026
modules:
  - MOD-test-pages
  - MOD-result-records
  - MOD-runtimes
builds_on:
  - ITM-771
tests:
  - unit
origin:
  - the second flip of TST-771207, 771208, 771209 and 771211 (run 41518211866 of #1760, attempt 1; the first at ITM-1438's gate, docs/gates/20261102-1418-development-release-testing-1438.md)
---
# ITM-1452 UC-026's system cases do not flip

**REGISTER**

## Outcome

`tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs` failed TST-771207, 771208 and 771211 on one commit, and
passed on rerun ("main has moved on", "branch tests/extension-2 already exists"; run 41457352297, attempt 1). It did so
again with TST-771209 (run 41518211866, attempt 1). Neither pull request touches those tests. Agreed in the brief: the
second flip of a file makes it an item.

The probe comes first. It gives the cause as a path, `file:line → what is shared or waited on → where the case fails`, in
the test or in its harness `tests/uc-026-harness.mjs`, and shows it fail on purpose.

## Acceptance

- The cause is fixed in the test or its harness, and no expected result changes. This is a test-only refactoring, so CI
  is green on every commit (`A REFACTORING JOB BEGINS WITHOUT A FAILING TEST`).
- The pull request shows the flip made to happen on purpose before the fix, and not after it.
