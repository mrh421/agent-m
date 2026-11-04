---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ba8a06f60f499bc10d3ab49c4f23b166e0bf2d50
  - https://github.com/akmaier/agent-m/pull/1710
date: 2026-11-01 21:09 UTC
---
# Development → Release testing: ITM-1405, #1710

**REGISTER**

## Reason

ITM-1405 (the closer reads the items' states as Progress shows them) may go on. The pull request is #1710 into
`sprint/team1/142`, at `ba8a06f60`. developer-opus-e wrote the tests-only commit `72fd7e762` and the code `f491501ea`;
developer-sonnet-l wrote `ba8a06f60`, the lift of TST-991203's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `72fd7e762` adds TST-1405001 to
   `tests/work-plans-sprint-facts-recipe.test.mjs` (MOD-work-plans). In run 41349522345 it is the only failing case. Known
   positive: an item that realises a requirement the SPEC does not hold stays "waiting for acceptance".
2. **CI is green on the head:** run 41350057256 (`ba8a06f60`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/strategies.mjs`.
   - The recipe `sprint-facts` (:145) gives `itemStates` what counts as accepted as Progress derives it:
     MOD-approvals' `statuses`, plus every requirement of the SPEC through MOD-spec-document's `parseSpec`. Both are
     named in MOD-work-plans' Uses.
   - A new `specRequirements(snapshot)` is the module's one reading of the SPEC's requirements; `backlog-inputs` uses it
     too.
   - The same call at :339 serves UC-008 and does not change.
4. **The Acceptance holds:**
   - An item Progress shows "blocked" is given to the closer as "blocked".
   - The two planted faults each fail the case.
   - TST-991203 loses its `todo`: red at `72fd7e762` (actual "waiting for acceptance", expected "blocked"), green at
     `f491501ea`. opus-e wrote the case and implemented the item; sonnet-l, who lifted it, built none of the recipe.

## Readings taken

- "The state Progress shows" is the same derivation of what is accepted. Progress' order of the items is not taken over,
  since it changes no state.

## Noted for akmaier

- The rule that MOD-approvals' statuses and the SPEC's requirements count as accepted now stands in three places:
  - `src/progress-measures/facts.mjs:235`;
  - `src/implementation-pages/backlog.mjs:101`;
  - this recipe.

  One shared definition would remove the copies (AGENTS.md §2, *Nothing twice*). Progress' function is private to
  MOD-progress-measures, which uses MOD-work-plans, so the definition would have to move into a module both use, such as
  MOD-approvals. That is a change of the architecture.
