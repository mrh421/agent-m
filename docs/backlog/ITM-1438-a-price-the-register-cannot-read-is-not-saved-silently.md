---
id: ITM-1438
title: A price the participant list cannot read is not saved silently
level: module
realises:
  - UC-017
  - NO COST IS GUESSED
modules:
  - MOD-settings-pages
builds_on:
  - ITM-375
tests:
  - unit
origin:
  - UC017-F3, TST-375215 of ITM-375's system tests of UC-017 (#1740), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1311-development-release-testing-0375.md)
---
# ITM-1438 A price the participant list cannot read is not saved silently

**REGISTER**

## Outcome

A price typed as the field's hint reads it ("2.00 / 8.00") is saved without a word, and MOD-participant-list's
`participantsOf` reads it as `null`, so every job's cost is unknown (TST-375215). MOD-participant-list judges no row by
design, so the page that takes the price says what it cannot read.

## Acceptance

- The Participants page refuses to save a price that the participant list would read as none, naming the form it expects.
  The form its hint shows is a form the list reads. Known positive: a price in the list's form is saved and read.
- TST-375215 loses its `todo` in a commit by a participant who built none of the page (not developer-sonnet-j), written
  after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
