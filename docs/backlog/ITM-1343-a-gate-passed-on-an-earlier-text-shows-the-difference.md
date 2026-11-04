---
id: ITM-1343
title: A gate passed on an earlier text shows the difference
level: module
realises:
  - UC-035
  - STATUS IS DERIVED FROM THE RECORDS
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-800
  - ITM-806
tests:
  - unit
origin:
  - finding UC035-S7 of ITM-806's system test TST-806020 (#1590), ruled at its gate in team1's sprint 138 (docs/backlog/sprints/team1/138.md)
---
# ITM-1343 A gate passed on an earlier text shows the difference

**REGISTER**

## Outcome

UC-035 3a: a gate whose record names a text that has changed since is shown as *passed on an earlier text*, "with the difference". The row draws `gate.needs ?? gate.difference` (`src/implementation-pages/progress.mjs:203`), so where a gate has `needs` the difference is never shown.

## Acceptance

- The row of a gate passed on an earlier text shows the difference between the recorded text and the current one.
- Its *Needs* cell shows the gate's needs and then its difference, joined by `; `; the column keeps its heading *Needs*.
- A unit test of its own, TST-1343nnn, headed `Module: MOD-implementation-pages`, guards STATUS IS DERIVED FROM THE
  RECORDS: a gate passed on an earlier text that has both needs and a difference shows the difference. It is the red
  first commit, and its counter-proof is recorded.
- TST-806020 loses its `todo` in a commit of developer-sonnet-l, written after the code is pushed.
- Before selection, the planning reads whether the accepted module files state this; if they do not, the item is a gap of
  the architecture, for akmaier.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
