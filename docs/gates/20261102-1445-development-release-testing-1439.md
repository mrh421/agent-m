---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b37ff4404f764d28d22caebc6caeed7bb7904f42
  - https://github.com/akmaier/agent-m/pull/1747
date: 2026-11-02 14:45 UTC
---
# Development → Release testing: ITM-1439, #1747

**REGISTER**

## Reason

ITM-1439 (the participant's test step explains itself) may go on. The pull request is #1747 into `sprint/team1/142`, at
`b37ff4404`. developer-opus-e wrote the tests-only commit `69beefae9` and the code `bdc7c10a3`. developer-sonnet-l wrote
`81d7aec6d`, the lift of TST-375217's `todo`, after the code was pushed, then `ba0223a70`, `2353f5ab2` and `b37ff4404`
(trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** In run 41461090921, only
   `unit-pull-request (16)` fails, and only on TST-1439001.
2. **CI is green on the head:** run 41463472487 (`b37ff4404`). `git merge-tree` with the sprint branch's head
   `c4ddc9cca` is clean.
3. **Only the item's module changes:** one line of `src/settings-pages/participants.mjs` (MOD-settings-pages).
   - Before, `bridgeControls()` drew the step *Test* and its result with no fold, although the topic `agent-test` stands
     in `src/site-frame/explanations.md`.
   - Now the step returns `explain("agent-test")` after the result, drawn like the form's other folds.
4. **The new test names UC-017, `EVERY STEP EXPLAINS ITSELF` and MOD-settings-pages.** The pull request records its
   counter-proof: with `explain("endpoint-test")` in place, TST-1439001 fails.
5. **The Acceptance holds:**
   - The *Test* step carries the fold `agent-test`, for a CLI and a sandboxed agent alike.
   - TST-375217 loses its `todo`: red at `69beefae9`, green at `bdc7c10a3`. sonnet-l, who built none of the page,
     lifted it, and its flow-map entry moves to the evidence. UC-017's system tests now hold no `todo`.

## Ruled

- **TST-375217's `expect:` line now states what its body asserts.** sonnet-l reworded it in three commits at the Scrum
  Master's instruction. No assertion of the case changed, so no expected result changes.
- **The reads stand.** opus-e read the SPEC requirements the item names, as `docs/instructions/developers.md` narrows the
  reads and this sprint's reading on reads allows (`…-1389`).
