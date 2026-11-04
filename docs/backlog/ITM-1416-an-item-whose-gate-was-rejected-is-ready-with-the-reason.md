---
id: ITM-1416
title: An item whose gate was rejected is ready again, with the reason
level: module
realises:
  - UC-034
  - UC-024
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
modules:
  - MOD-work-plans
builds_on:
  - ITM-1412
tests:
  - unit
origin:
  - the part of ITM-1412's Acceptance that its modules could not give, ruled at its gate in team1's sprint 142 (docs/gates/20261102-0823-development-release-testing-1412.md); TST-805218 of ITM-805
---
# ITM-1416 An item whose gate was rejected is ready again, with the reason

**REGISTER**

## Outcome

UC-034 7a: "The gate's decider rejects. The gate record states the rejection and its reason. The job ends, and the item
returns to *ready* with the reason attached." UC-024 10a says the same of a step. ITM-1412 ends such a job with an End
`failed` whose reason names the gate, the record and the rejection's reason. `itemStates` (`src/work-plans/states.mjs:205`)
gives an item whose job failed the state `blocked`.

## The reading taken

MOD-work-plans' `ItemState` gives `blocked` for "a job failed, or waits for a person". A job that a rejected gate ended did
not fail at its work: a person decided against it, and UC-034 and UC-024 return its item or step to *ready*. So `itemStates`
reads a job whose End names a rejected gate record as ended by that decision, and gives its item `ready`, with the
rejection's reason as the state's `reason`. A job that failed otherwise still gives `blocked`. The module text does not list
this case, and that is noted for akmaier at ITM-1412's gate.

## Acceptance

- An item or step whose newest job ended at a rejected gate is `ready`, its reason naming the gate record and the
  rejection's reason. Counter-proof: an item whose job failed otherwise is `blocked` (TST-805214 holds).
- TST-805218 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
