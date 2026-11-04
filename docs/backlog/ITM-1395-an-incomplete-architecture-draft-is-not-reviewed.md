---
id: ITM-1395
title: An incomplete architecture draft is not reviewed
level: module
realises:
  - UC-022
  - AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE
modules:
  - MOD-job-runner
builds_on:
  - ITM-448
tests:
  - unit
origin:
  - F5, TST-448312 of ITM-448's release tests of UC-022 (#1683), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1633-development-release-testing-0448.md)
---
# ITM-1395 An incomplete architecture draft is not reviewed

**REGISTER**

## Outcome

`AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE`: "An architecture draft is checked only once it is complete, and then as
a whole". Its check says no review starts "for a draft that lacks the decision stating the whole architecture". The
correction loop (`src/job-runner/loop.mjs:178-190`) asks the reviewing participant even when its checks find that the
draft lacks that decision (`ONE DECISION STATES THE WHOLE ARCHITECTURE`).

## The reading taken

The correction loop belongs to MOD-job-runner and runs "its checks and then its reviewing participants". So the loop
sends a draft to its reviewers only when its checks found nothing that makes the draft incomplete. Such a finding goes back
to the drafter as any check's finding does. The module text assigns the loop but does not state this condition, and that
is noted for akmaier at the gate.

## Acceptance

- A draft without the decision that states the whole architecture is sent to no reviewer, and its finding goes back to
  the drafter. Counter-proof: a complete draft is reviewed.
- TST-448312 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
