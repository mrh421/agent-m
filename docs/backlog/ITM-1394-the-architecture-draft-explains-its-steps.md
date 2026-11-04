---
id: ITM-1394
title: The architecture draft explains its steps
level: module
realises:
  - UC-022
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-review-pages
builds_on:
  - ITM-448
tests:
  - unit
origin:
  - F4 and F7, TST-448232 and TST-448332 of ITM-448's system and release tests of UC-022 (#1683), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1633-development-release-testing-0448.md)
---
# ITM-1394 The architecture draft explains its steps

**REGISTER**

## Outcome

`EVERY STEP EXPLAINS ITSELF`: every step that asks something of the person carries an explanation that can be expanded.
The architecture draft shown after *Run* asks the author to review it, change it, choose a library and press *Write
proposals*. It carries no folded explanation (`src/review-pages/jobs.mjs:605-674`, `kinds.mjs:43`). UC-022 7c has the
author decide on a candidate's licence "with a folded explanation of what a licence permits". The explanation topics
`licence-permits` and `due-diligence` exist, but no page shows them.

## Acceptance

- The shown architecture draft carries a folded explanation of the step it asks of the author.
- Its due-diligence table carries the explanation `due-diligence`. At a candidate whose licence is missing, unknown or
  restrictive, it carries `licence-permits`.
- TST-448232 and TST-448332 lose their `todo` in a commit by a participant other than the implementer, written after the
  code is pushed. TST-448332 is a release test.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
