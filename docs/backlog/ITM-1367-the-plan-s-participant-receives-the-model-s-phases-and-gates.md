---
id: ITM-1367
title: The plan's participant receives the model's phases and gates
level: module
realises:
  - UC-045
  - THE MODEL DETERMINES THE PHASES AND THE GATES
modules:
  - MOD-work-plans
builds_on:
  - ITM-1061
tests:
  - unit
origin:
  - finding UC045-F1 of ITM-1061's system test TST-1061004 (#1650), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1036-development-release-testing-1061.md)
---
# ITM-1367 The plan's participant receives the model's phases and gates

**REGISTER**

## Outcome

MOD-work-plans' recipe `architecture-and-model` gives "the decision that states the system, the subsystems' decisions, the
module files, the process model with its phases and gates, and the existing plan" (MOD-work-plans.md:264-265). It sends the
product's declaration `docs/process.md` (`src/work-plans/strategies.mjs:66`), which names the model, and not the model's
phases and gates. UC-045 step 2: the participant receives them.

## Acceptance

- The input of `draft-plan` holds the phases and the gates of the product's declared workflow, from
  MOD-product-process' `productWorkflow` (among MOD-work-plans' Uses), beside the declaration.
- TST-1061004 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
