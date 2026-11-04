---
id: ITM-1295
title: The Bridge's job-list test removes its folders without flipping
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-bridge-jobs
builds_on: []
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1285 (PR #1397), docs/gates/20261029-0454-development-release-testing-a224.md, point 1
---
# ITM-1295 The Bridge's job-list test removes its folders without flipping

**REGISTER**

## Outcome

On commit `3f149fba`, job 123249407673 of run 40813584499 (attempt 1) failed TST-1097103 (`tests/bridge-jobs-list.test.mjs:205`),
"GET /v1/jobs lists a running job as running and, once the Bridge was quit, as cancelled". Its cleanup ended with
`ENOTEMPTY: directory not empty, rmdir '/tmp/agent-m-1097-…/agent-work/products/github-com-acme-product-a/.git'`. The rerun
of the same commit (attempt 2) passed, so the test flips on one commit. ITM-949 found a cleanup of this kind, where git's
detached maintenance in a clone wrote into `.git` after the push had returned.

The first task names, from the test's own steps, which process still writes into that `.git` when the cleanup runs. The
change follows from the cause named. No retry is added to the cleanup, and no wait whose bound is not the end of that
process.

## Acceptance

- The pull request names the process that writes into the folder at the cleanup, with the data-flow path to it.
- The test's expected results are unchanged, and its cleanup removes its folders on every run of one commit.
- Only the test, its helpers and, where the cause lies in MOD-bridge-jobs, `src/bridge-jobs/` change.
- **Tests of other modules this Outcome changes: none.** `tests/bridge-jobs-list.test.mjs` names MOD-bridge-jobs.
- It removes no test.
- It also flipped in run 40848846291, attempts 1 and 2.
