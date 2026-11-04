---
id: ITM-1413
title: The bash timeout test waits for the process tree to end
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-checkout-tools
builds_on: []
tests:
  - unit
origin:
  - the second flip of `tests/checkout-tools-bash.test.mjs` (TST-1240031), in run 41348183929 at attempt 1 (#1708), counted at ITM-1409's gate in team1's sprint 142 (docs/gates/20261101-2057-development-release-testing-1409.md); the first in run 41327960738 (ITM-1389's gate)
---
# ITM-1413 The bash timeout test waits for the process tree to end

**REGISTER**

## Outcome

TST-1240031 of `tests/checkout-tools-bash.test.mjs` failed twice on CI with "the background sleep is ended with its
command" (actual `true`, expected `false`), and passed on the next attempt. The command is ended after 500 ms, its tree
SIGKILLed 3 s after SIGTERM. The case reads the background process's state at a moment that does not wait for that end.

## Acceptance

- First, the cause is named as a data-flow path, from the timeout to the state the case reads, before any change.
- The case waits for the state of the process tree, not for a fixed time, and keeps its expected results.
- Only the test and its helpers change. The item adds no behaviour, so it begins without a failing test.
