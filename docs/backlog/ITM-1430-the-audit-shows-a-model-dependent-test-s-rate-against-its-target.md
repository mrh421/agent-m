---
id: ITM-1430
title: The audit shows whether a model-dependent test reached its rate
level: module
realises:
  - UC-030
  - A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
modules:
  - MOD-release-evidence
  - MOD-trace-pages
builds_on:
  - ITM-775
tests:
  - unit
origin:
  - UC030-F1, TST-775207 of ITM-775's system tests of UC-030 (#1733), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1108-development-release-testing-0775.md)
---
# ITM-1430 The audit shows whether a model-dependent test reached its rate

**REGISTER**

## Outcome

A model-dependent test's outcome is a rate (`A MODEL-DEPENDENT TEST IS MEASURED AS A RATE`). The audit's rows that
MOD-release-evidence derives give that rate alone, so the reader cannot tell whether the test passed on the release
(TST-775207).

## The reading taken

opus-e's probe found that no value of `outcome` lets the row show the rate and whether the test passed. MOD-release-
evidence's `auditRows` gives each test `{ id, level, outcome, counterProof, worse, byImplementer }`, its outcome is the rate,
and MOD-trace-pages counts as passing only an outcome `passed` (`src/trace-pages/audit.mjs:34`). The same gap leaves a
model-dependent test that did not run, whose outcome is "k of n", out of the page's count of what did not pass.

`OPEN FOR EXTENSION, CLOSED FOR CHANGE`: a module is extended with a new function without changing those it offers. So each
test of `auditRows` gains a field `passed`, true when its run completed and its rate is not worse than the last release's,
and the last release's rate. Every field it gives stays as it is, its outcome still the rate. MOD-trace-pages counts and
shows passing from `passed`. MOD-release-evidence's text lists neither field; that is noted for akmaier, and the item
builds without asking.

## Acceptance

- The audit's row of a model-dependent test names its rate, the rate of the last release it is compared with, and whether
  it passed. A model-dependent test that did not run is counted as not passed.
- TST-775207 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
