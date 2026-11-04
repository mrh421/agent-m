---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - cc05fbb8076c189bbb6fbffb2e6768e23a137ef7
  - https://github.com/akmaier/agent-m/pull/1700
date: 2026-11-01 20:24 UTC
---
# Development → Release testing: ITM-1403, #1700

**REGISTER**

## Reason

ITM-1403 (a sprint's close records the sprint it was started for) may go on. The pull request is #1700 into
`sprint/team1/142`, at `cc05fbb80`. developer-opus-e wrote the tests-only commit `bb76077e4` and the code `8cc52a44c`;
developer-sonnet-l wrote `cc05fbb80`, the lift of TST-991207's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `bb76077e4` adds TST-1403001 and 1403002 to
   `tests/work-plans-sprint-record-writer.test.mjs` (MOD-work-plans). In run 41344242448 they are the only failing cases.
2. **CI is green on the head:** run 41345522581 (`cc05fbb80`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/strategies.mjs`. The writer took `close?.sprint` from the draft
   (:461-462), which `close-sprint`'s answer does not hold, and threw `UnknownWork` (:128). It now records the close for
   the sprint the job's parameter names, through `sprintInputs(context, context.params)`.
4. **The Acceptance holds:**
   - A close without a sprint is recorded for the sprint of the job's parameter.
   - A draft that names another sprint changes nothing of that sprint's record.
   - The old code throws, which is the counter-proof.
   - TST-991207 loses its `todo`: red at `bb76077e4`, green at `8cc52a44c`. opus-e wrote that case and implemented the
     item; sonnet-l, who lifted it, built none of the writer.

## Reading taken

- The writer closes the sprint the job's parameter names, as the recipe `sprint-facts` reads it.
