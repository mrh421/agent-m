---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 843c3480d867dd7bebe1afdb00a09b1ef9fd1ac1
  - https://github.com/akmaier/agent-m/pull/1762
date: 2026-11-02 21:05 UTC
---
# Development → Release testing: ITM-1452, #1762

**REGISTER**

## Reason

ITM-1452 (UC-026's system cases do not flip) may go on. The pull request is #1762 into `sprint/team1/143`, at `843c3480d`,
one commit by developer-opus-f (trailer). I wrote none of it.
1. **A test-only refactoring needs no red commit.** The item is one, and CI is green on its one commit (`A REFACTORING
   JOB BEGINS WITHOUT A FAILING TEST`).
2. **CI is green on the head:** run 41522885316 (`843c3480d`), at attempt 2. At attempt 1, five jobs were cancelled at the
   limit with no test failing. `git merge-tree` with the sprint branch's head `a578a1a8f` is clean.
3. **Only the item's scope changes:** five lines of `tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs`.
   - The cause: TST-771207 pressed *Write tests* twice. `writeTests` (`src/test-pages/generate.mjs`) has no guard against
     a second press, while `onRun` has one (:244-248). So both presses queued a job on the same head, and the second
     commit was refused "Moved: main has moved on".
   - That refusal arrived before or after the case read the page, depending on timing. The world the cases share then
     made TST-771208, 771209 and 771211 fail.
   - The pull request makes the flip happen on purpose: a 3 s wait before reading the page fails exactly those four cases
     at `96904b362`, with CI's messages. After the fix, all 13 cases pass.
4. **No asserted value changes** (`A REFACTORING JOB CHANGES NO EXPECTED RESULT`). The case presses once. It still asserts
   one commit and no refusal, and only the message "one commit for two clicks" reads "one commit for the click".
5. **The Acceptance holds:** the cause is fixed in the test, and the flip is shown on purpose before the fix and not after
   it.

opus-f read the binding documents, chapters 9, 11, 12 and 13 and the three module files in full.

## Ruled

- **The second press was the test's own addition, not a requirement's.** UC-026 step 8 has the author press *Write tests*
  once. `ONE CLICK PER DECISION` asks that a decision take one click, and no text asks that a second press be ignored. So
  pressing once changes the case's input, not an expected result the texts give. Before, "one commit for two clicks"
  held only by the run's timing.
- **writeTests' missing guard is no item.** No accepted text requires `writeTests` to ignore a second press as `onRun`
  does, so it is a candidate for the review, not registered (`YOU AREN'T GONNA NEED IT`).
