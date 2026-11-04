---
id: ITM-1373
title: A model without a time box names no measure per time box
level: module
realises:
  - A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
  - PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
  - UC-031
modules:
  - MOD-model-catalogue
  - MOD-implementation-pages
builds_on:
  - ITM-802
tests:
  - unit
origin:
  - finding UC031-R3 of ITM-802's release test TST-802311 (#1651), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1043-development-release-testing-0802.md)
---
# ITM-1373 A model without a time box names no measure per time box

**REGISTER**

## Outcome

The editor saves a pulled model with a work-in-progress limit and no time box whose `measure` is `remaining items per time
box` (`src/model-catalogue/validate.mjs:155-165`). Its progress page then draws the board and its cumulative flow, as
MOD-progress-measures states for a model with a work-in-progress limit (MOD-progress-measures.md:232-235), and not the
measure the model names (`PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE`).

## The reading taken

`modelFindings` reports "a measure that does not fit the kind of work" (MOD-model-catalogue.md:101). A measure per time box
does not fit work that has no time box. So such a definition cannot be declared, and every model a product can declare is
drawn in its own measure. MOD-progress-measures does not change.

## Acceptance

- `modelFindings` reports, as an error, the measure `remaining items per time box` in a model that names no time box. Each
  model of the shipped catalogue still passes.
- The implementer's own red unit test shows the finding. TST-802311's expectation changes with it — *Save* is refused with
  that finding, and no product declares the definition — in one commit, with its `todo` removed, by a participant other
  than the implementer, written after the code is pushed.
- TST-779103 (`tests/release-uc-031-configure-a-process-model.test.mjs`, the one test the probe moved; the item names
  MOD-implementation-pages for that file only, and changes no code of it) tests UC-031 step 4's flow control. Where it
  takes Scrum's copy to a work-in-progress limit alone, the copy also takes the measure `items per state over time`, so that
  the case still tests the flow control and Save stays available. Its other expectations stand. The change is written in the
  same commit as TST-802311's, by the same participant.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
