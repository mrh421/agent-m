---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1587d5d1e5a07b1a1efa3476426e64c428196187
  - https://github.com/akmaier/agent-m/pull/1708
date: 2026-11-01 20:57 UTC
---
# Development → Release testing: ITM-1409, #1708

**REGISTER**

## Reason

ITM-1409 (an implementation job receives its item and what it realises) may go on. The pull request is #1708 into
`sprint/team1/142`, at `1587d5d1e`. developer-sonnet-j wrote the tests-only commit `c960c1ef9` and the code `ae7ffe6f1`;
developer-sonnet-l wrote `1587d5d1e`, the lift of TST-805208's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** In run 41347872902 the failing cases are:
   - the new TST-1409001 to 1409005 of `tests/run-planner-item-inputs.test.mjs` (MOD-run-planner);
   - the moved expectations of `tests/run-planner-inputs.test.mjs` (TST-568001, 568003, 568006, 568008, 1248101 and
     1248105);
   - TST-805207;
   - besides these, only the `todo` cases that name a finding.
2. **CI is green on the head:** run 41348183929 (`1587d5d1e`), at attempt 2. Attempt 1 failed only TST-1240031 of
   `checkout-tools-bash`, which the pull request does not touch; that is its second flip (below).
3. **The merge.** `git merge-tree` with the sprint branch's head conflicts in the flow map of `system-uc-034`, since
   ITM-1410's lift, merged since, moved its own entry there. The Scrum Master resolves it with a merge of the sprint branch
   that keeps both entries in the evidence, as for #1700, and merges once CI is green on that merge.
4. **Only the item's module changes:** `src/run-planner/inputs.mjs`. For a job's `params.items`, the recipe gives, in this
   order:
   - the item's file;
   - the use cases it realises, and those that realise a requirement it names;
   - the test files whose guards name what it realises;
   - the modules' inputs as before;
   - last, the instance's `SPEC.md` as the process requirements, left out where it equals the product's SPEC part.

   Plan steps and jobs that name only modules are unchanged.
5. **The Acceptance holds:**
   - The item's input holds what UC-034 step 3 names.
   - The seven planted faults each fail a case.
   - TST-805208 loses its `todo`: red at `c960c1ef9`, green at `ae7ffe6f1`. sonnet-j wrote the case and implemented the
     item; sonnet-l, who lifted it, built none of the recipe.

## Ruled

- **The moved expectations.** The six cases of `run-planner-inputs` and TST-805207 count or list the parts a job receives.
  The item's Acceptance names the new parts, and its reading (MOD-run-planner's list is what the recipe must give, not all
  it may) allows them. Each moved in the tests-only commit and was red there. No expectation of a plan step or of a job
  that names only modules changed. sonnet-j wrote TST-805207 in its battery; the move is the item's own.
- **The process requirements are the instance's whole `SPEC.md`.** MOD-run-planner's Uses name no function that lists the
  requirements a product's gates add. Agent M's SPEC is the one that constrains the development process (`A REQUIREMENT
  NAMES WHAT IT CONSTRAINS`), so giving it whole is a reading that builds. Narrowing it would need a function the Uses do
  not name, which is noted for akmaier and not asked now.

## Flips counted

- `checkout-tools-bash` (TST-1240031) flipped a second time, in run 41348183929 at attempt 1: "the background sleep is
  ended with its command", actual `true`, expected `false`. Its first flip was counted at ITM-1389's gate. It is
  registered as ITM-1413 (MOD-checkout-tools, its test only) in this commit.
