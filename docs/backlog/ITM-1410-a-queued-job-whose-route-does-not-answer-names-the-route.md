---
id: ITM-1410
title: A queued job whose route does not answer names the route
level: module
realises:
  - UC-034
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-805
tests:
  - unit
origin:
  - UC034-F3, TST-805211 of ITM-805's system tests of UC-034 (#1699), ruled at its gate in team1's sprint 142 (docs/gates/20261101-2000-development-release-testing-0805-1045.md)
---
# ITM-1410 A queued job whose route does not answer names the route

**REGISTER**

## Outcome

UC-034 4a: when the bridge or the runner does not answer, "the job stays *queued*. Agent M says which route is down, and
the author may cancel or reassign the job". When a connected Bridge does not answer, `src/implementation-pages/implement.mjs:477`
says "nothing was started" and names no route, though `queueOnBridge` has already committed the job's start record.

## Acceptance

- A job whose Bridge or runner does not answer is shown *queued*, with the route that is down, and with the controls to
  cancel or reassign it.
- TST-805211 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
