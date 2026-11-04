---
id: ITM-1428
title: The tunnel check's test ends within its limit
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-bridge-build
builds_on: []
tests:
  - unit
origin:
  - the second flip of `tests/bridge-build-build-platform.test.mjs`, in run 41416171968 at attempt 1 (#1721, job 125180545480), counted at ITM-1422's gate in team1's sprint 142 (docs/gates/20261102-0901-development-release-testing-1422.md); the first at sprint 141's close (docs/gates/20261101-1430-retrospective-sprint-planning-h141.md)
---
# ITM-1428 The tunnel check's test ends within its limit

**REGISTER**

## Outcome

The case "buildPlatform — the tunnel check starts the packaged Linux app without Electron's sandbox, and no other app with
an argument" of `tests/bridge-build-build-platform.test.mjs` ran into its limit of 60 s twice on CI (62 s at sprint 141's
close, 60.2 s in run 41416171968) and passed on the next attempt.

## Acceptance

- First, the cause is named as a data-flow path, from the tunnel check's start to the moment the case waits for, before any
  change.
- The case waits for what it checks, not for a fixed time or a process that may not end, and keeps its expected results.
- Only the test and its helpers change. The item adds no behaviour, so it begins without a failing test.
