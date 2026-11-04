---
id: ITM-1312
title: The tunnels runtime release test waits for the states it asserts
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-tunnels
builds_on: []
tests:
  - unit
origin:
  - po-opus-c's gate of sprint team1/119 (PR #1461), docs/gates/20261029-1536-release-testing-sprint-review-5e8b.md, point 3
---
# ITM-1312 The tunnels runtime release test waits for the states it asserts

**REGISTER**

## Outcome

On commit `3836359c`, job 123546570337 of run 40901982501 (attempt 1) failed TST-286904 in
`tests/release-itm-286-tunnels-runtime.test.mjs` ("public runtime isolates failures, grows reconnect waits, and stops
reconnecting after close"). Its rerun, job 123548956750 (attempt 2), passed: the test flips on the same commit. In the
failing run, the worker's check found the denied tunnel in the state `opening` with the reason `auth-refused` where it
waited for that tunnel's settled state, within its 90 polls. The test waits on the tunnels' states, not on a count of
polls, and gives the same outcome on every run of one commit.

**First task:** reproduce the flip (sprint 118's agreement), for example by running the case repeatedly under load, and
name the data-flow path from the poll to the failing assertion. Where it does not reproduce on today's code, the item
stops and reports the runs.

**Reproduced at sprint team1/120's planning, on `main` at `9db71783`.** Run alone 30 times beside 12 busy processes, the
case passed 30 times. Run 40 times beside 60 busy processes on 20 cores, it failed once, with
`"gaps":[228,216]`, both tunnels settled (`failed`, `auth-refused` and `host-unreachable`), `before` and `after` 3.
- **The failure node is not the poll.** In the CI failure too the states were reached and `gaps` was `[390,388]`. Both
  runs failed only `!(gaps[1]>gaps[0])` (`:133`).
- **The path.** `times` takes `Date.now()` when the cycling host receives `tcpip-forward`. A gap is then the runtime's
  wait (`src/tunnels/index.mjs:122-123`: 100, then 200 ms) plus a whole SSH connect and handshake. Under load the
  handshake's time varies by more than the 100 ms the waits differ by, so the growth is not seen.
- What the test may read is what MOD-tunnels' interface states (MOD-tunnels.md:57-71) and what its own fixture hosts see.
  The interface states "growing waits" and no wait value.

## Acceptance

- The test's expected results are unchanged: the reconnect waits grow. What it measures as a wait leaves out the
  connect and handshake that follow it, so that load does not hide the growth. Its wait for the states ends when the
  asserted states are reached, and fails by name when they do not come.
- The repetition above, 40 runs beside 60 busy processes, passes every run on the item's head. Without the change it
  failed one in 40, which is its known positive.
- Only the test and its helpers change.
