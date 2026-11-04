---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 53225fe804f8ed42c2e61468b2d0c0fe87035f51
  - https://github.com/akmaier/agent-m/pull/1717
date: 2026-11-02 08:46 UTC
---
# Development → Release testing: ITM-1416, #1717

**REGISTER**

## Reason

ITM-1416 (an item whose gate was rejected is ready again, with the reason) may go on, for what its module does. The pull
request is #1717 into `sprint/team1/142`, at `53225fe80`. developer-sonnet-k wrote the tests-only commit `aa0b33e08` and the
code `53225fe80` (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `aa0b33e08` adds
   `tests/work-plans-rejected-gate.test.mjs` (TST-1416001 to 1416005, MOD-work-plans). In run 41413734032 they are the
   only failing cases.
2. **CI is green on the head:** run 41413998830 (`53225fe80`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/states.mjs`, eight lines.
   - The path: ITM-1412 writes an End `failed` whose reason is `the gate <gate> was rejected by <record>[: <reason>]`. The
     job ledger hands it over as the record's end, and `derivedState` (:205) gave `blocked` for every failed job.
   - Now a failed job whose End's reason has that form gives `ready`, with that reason. The check comes after the checks of
     a merge, a `built_by`, an acceptance, a prerequisite and a waiting gate, and before `blocked`.
4. **The Acceptance holds for MOD-work-plans:**
   - An item or step whose newest job ended at a rejected gate is `ready`, naming the gate, the record and the reason.
   - An item whose job failed otherwise stays `blocked`: TST-805214 holds.
   - The counter-proofs in the pull request each fail a named case: the End never read as a rejection, any failed job
     counted, any reason holding "rejected", and a rejection placed before a merged pull request.

## Ruled

- **TST-805218's lift is not done here and moves to ITM-1421 (MOD-implementation-pages), registered in this commit.** The
  case also asserts that the Implement page draws a ready item's reason. `implement.mjs` (about :436) draws a reason only
  for an item that cannot start, and MOD-implementation-pages is not among ITM-1416's modules. TST-805218 keeps its `todo`.

## Readings taken

- The rejection is read from the End record, as the item says.
- The reason's form is matched in `states.mjs`, since MOD-work-plans' Uses name neither MOD-runtimes nor
  MOD-workflow-entries. The form now stands in three places, the two writers and this reader. That is the duplicate
  ITM-1412's gate noted, and it is a candidate for the review.
- The reason is passed on unchanged.
- MOD-work-plans' `ItemState` text is not changed; ITM-1416's reading stands, noted for akmaier at ITM-1412's gate.

## Noted

- sonnet-k read the item, the gate record, UC-034 and MOD-work-plans in full with `cat`, not with the Read tool. It did not
  read the sprint plan. AGENTS.md asks for the originals, which it read. The brief's tool and the plan hold for the next
  item.
