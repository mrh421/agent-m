---
id: ITM-1404
title: An agent's review names the sources of its feedback
level: module
realises:
  - UC-041
  - AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
modules:
  - MOD-work-plans
builds_on:
  - ITM-991
tests:
  - unit
origin:
  - UC041-F2, TST-991305 of ITM-991's release tests of UC-041 (#1698), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1949-development-release-testing-0991.md)
---
# ITM-1404 An agent's review names the sources of its feedback

**REGISTER**

## Outcome

`AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM`: a review recorded by an agent names the sources of its feedback —
issues, mails, job records, test results — and states that no stakeholder took part unless one did. An unattended close
ends "unchanged" (`src/job-runner/loop.mjs:234`), the writer runs all the same, and `src/work-plans/saves.mjs:214` writes
"Sources of the feedback: none."

## Acceptance

- A review recorded by an agent names each source of its feedback, and says that no stakeholder took part unless one did.
  A close whose feedback names no source records none of it as a review.
- TST-991305 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
