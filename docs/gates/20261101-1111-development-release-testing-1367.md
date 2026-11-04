---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 636c8b064ac2708442004b7e4763b0da086cfc55
  - https://github.com/akmaier/agent-m/pull/1652
date: 2026-11-01 11:11 UTC
---
# Development → Release testing: ITM-1367, #1652

**REGISTER**

## Reason

ITM-1367 (the plan's participant receives the model's phases and gates) may go on. The pull request is #1652 into
`sprint/team1/141`, at `636c8b064`. developer-opus-f wrote the tests and the code (`Agent-M-Participant` on both commits).
I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `59cea0cd4` changes
   `tests/work-plans-architecture-and-model.test.mjs` (MOD-work-plans) only. In run 41299334085 the one failing job is
   `unit-pull-request (10)`, and its failing cases are the eight of that file: TST-1367001, 1367002 and the moved
   TST-610001 to 610006.
2. **CI is green on the head:** run 41299423891 (`636c8b064`), attempt 2. Attempt 1 failed only TST-1240031
   (`tests/checkout-tools-bash.test.mjs`), a known flip of the brief. `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/strategies.mjs`. After `docs/process.md`, `architectureAndModel` gives
   one part, "phases and gates of the product's workflow", `{ phases, gates }` from `workflowOf`, the one reading of the
   product's workflow that `plan-checks`, `plan-steps` and `sprint-facts` already share, with the sources of
   `docs/process.md`. A model the instance does not hold is refused with `UnknownWork { id: <model_file> }`.
4. **Reads against the base:** the recipe now also reads the instance at the declared version, as `workflowOf` does for the
   other kinds. The phases and gates the Acceptance asks for are in the model's file, so the read is the one it needs.
5. **The Acceptance holds:**
   - The input of `draft-plan` holds the declared workflow's phases and gates (TST-1367001: the V-model's seven phases and
     three gates).
   - TST-610001 to 610006 move in the tests-only commit: the part list gains the workflow part after `docs/process.md`.
     MOD-work-plans' recipe text gives "the process model with its phases and gates" (MOD-work-plans.md:264-265), so the
     move is allowed. The probe over 439 files moved nothing else.
   - The pull request records the counter-proofs: the base fails all eight, `gates: []` fails TST-1367001, and a removed
     refusal fails TST-1367002.
   - TST-1061004 passes under its `todo`. A participant other than opus-f lifts it after the merge.

## Readings taken

- `productWorkflow` is among MOD-work-plans' Uses; "for `plan-checks` and `sprint-facts`" names where it was used, not a
  limit on the recipe.
- The phases and gates are one JSON part, as `sprint-facts` gives its facts.
- A missing model is refused as a missing `docs/process.md` is.

All are taken.
