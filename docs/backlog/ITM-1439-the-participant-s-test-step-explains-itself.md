---
id: ITM-1439
title: The participant's test step explains itself
level: module
realises:
  - UC-017
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-settings-pages
builds_on:
  - ITM-375
tests:
  - unit
origin:
  - UC017-F5, TST-375217 of ITM-375's system tests of UC-017 (#1740), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1311-development-release-testing-0375.md)
---
# ITM-1439 The participant's test step explains itself

**REGISTER**

## Outcome

`EVERY STEP EXPLAINS ITSELF`. The Participants page's *Test* step carries no folded explanation, though the explanation
topic `agent-test` exists (TST-375217).

## Acceptance

- The *Test* step of a participant carries the folded explanation `agent-test`.
- TST-375217 loses its `todo` in a commit by a participant who built none of the page (not developer-sonnet-j), written
  after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
