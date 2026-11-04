---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9bd671b334e67a5ba0a73b1fa9f20b8218aca486
  - https://github.com/akmaier/agent-m/pull/1761
date: 2026-11-02 20:49 UTC
---
# Development → Release testing: ITM-1365, #1761

**REGISTER**

## Reason

ITM-1365 (the issue page hands its work to no person) may go on. The pull request is #1761 into `sprint/team1/143`, at
`9bd671b33`. developer-sonnet-j wrote the tests-only commit `d94805ea1` and the code `9a1f3aa2f`. developer-sonnet-l wrote
`9bd671b33`, the lift of TST-585306's `todo`, after the code (trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It adds
   `tests/maintenance-pages-no-person-1365.test.mjs`. In run 41517324949 (attempt 2; attempt 1 was cancelled at the limit
   with no test failing), only its three new cases fail.
2. **CI is green on the code and on the head.** Run 41519112960 on `9a1f3aa2f` is green at attempt 1. Run 41520178212 on
   `9bd671b33` is green at attempt 3; at attempts 1 and 2 jobs were cancelled at the limit, with no test failing. `git
   merge-tree` with the sprint branch's head `96904b362` is clean.
3. **Only the item's module changes:** two lines of `src/maintenance-pages/issues.mjs` (MOD-maintenance-pages), plus
   tests.
   - Before, `runSection` (:136) took `participantsOf(register)`, the person alice among them, and `eligible` (:137)
     judged capabilities only. So a radio was drawn for alice (:140).
   - MOD-participant-list (:92-94) tells the caller to ask "among the other four types". `eligible` is now asked among
     the participants whose type is not `person`.
   - All three panels go through `runSection`. Where only a person would be eligible, the page says so, as before.
4. **The new tests name `A PROCESS MODEL ORGANISES PEOPLE AND AGENTS`, UC-012 and MOD-maintenance-pages.** The pull request
   records three counter-proofs.
5. **The Acceptance holds:**
   - No run panel offers a person.
   - TST-585306 loses its `todo`: with the `todo` stripped, it fails at `d94805ea1` (alice offered) and passes at
     `9a1f3aa2f`. sonnet-l, who built none of it, lifted it, and its assertions are unchanged.
   - No other expected result changes.

sonnet-j read the binding documents, chapters 9, 11, 12 and 13 and both module files in full. sonnet-l read AGENTS.md, the
whole SPEC and chapter 13.
