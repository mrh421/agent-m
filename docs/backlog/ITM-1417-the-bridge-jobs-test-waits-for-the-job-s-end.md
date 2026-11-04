---
id: ITM-1417
title: The Bridge jobs test waits for the job's end
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-desktop-shell
  - MOD-bridge-jobs
  - MOD-bridge-http
builds_on: []
tests:
  - unit
origin:
  - the second flip of `tests/desktop-shell-bridge-jobs.test.mjs` (TST-367004), in run 41411759175 at attempt 1 (#1712), counted at ITM-1412's gate in team1's sprint 142 (docs/gates/20261102-0823-development-release-testing-1412.md); the first in run 41329522146 (ITM-1389's gate)
---
# ITM-1417 The Bridge jobs test waits for the job's end

**REGISTER**

## Outcome

TST-367004 of `tests/desktop-shell-bridge-jobs.test.mjs` failed twice on CI and passed on the next attempt. The second time,
the job read "running" where "done" was expected, after about 7 s. The case reads the job's state at a moment that does not
wait for its end.

## Acceptance

- First, the cause is named as a data-flow path, from the job handed over to the state the case reads, before any change.
- The case waits for the job's state, not for a fixed time, and keeps its expected results.
- Only the test and its helpers change. The item adds no behaviour, so it begins without a failing test.
