---
id: ITM-1392
title: A finding only the author decides is shown with the architecture draft
level: module
realises:
  - UC-022
  - WHAT A PERSON DECIDES IS NOT SENT BACK
modules:
  - MOD-review-pages
builds_on:
  - ITM-448
tests:
  - unit
origin:
  - F1, TST-448229 of ITM-448's system tests of UC-022 (#1683), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1633-development-release-testing-0448.md)
---
# ITM-1392 A finding only the author decides is shown with the architecture draft

**REGISTER**

## Outcome

UC-022 step 6: "A finding that only the author can decide — a requirement the architecture cannot keep — is not sent back
but shown to the author." The correction loop keeps such a finding in `outcome.forPerson`. The architecture's drafting
page draws the draft through `presentDerivation` (`src/review-pages/jobs.mjs:605-635`), which never reads `forPerson`. So
a reviewer's conflict finding stands only in the job's record.

## Acceptance

- After *Run*, the shown architecture draft lists each finding the loop kept for the person, with its file, line, rule and
  text, apart from the rounds.
- TST-448229 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
