---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d0c5bccd37c453841340f77fb9981c1938be6710
  - https://github.com/akmaier/agent-m/pull/1695
date: 2026-11-01 19:29 UTC
---
# Development → Release testing: ITM-1393, #1695

**REGISTER**

## Reason

ITM-1393 (the reuse candidate chosen is written, and one not found is not offered) may go on. The pull request is #1695
into `sprint/team1/142`, at `d0c5bccd3`. developer-opus-f wrote the tests-only commit `1b2297558` and the code
`09bad2c35`; developer-sonnet-l wrote `d0c5bccd3`, the lift of TST-448230's and TST-448231's `todo`, after the code was
pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `1b2297558` adds TST-1393001 and 1393002 to
   `tests/review-pages-draft-architecture.test.mjs` (MOD-review-pages). In run 41341160185 they are the only failing
   cases. Their identifiers had no history (known positive: TST-1392001).
2. **CI is green on the head:** run 41341589770 (`d0c5bccd3`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/jobs.mjs`.
   - Before, the radio buttons had no listener, and `draftFromEditors` read only the text areas. Now a change of the
     radio button swaps the picked candidate's cells into the decision's text (`chosenIn`). `writeResult`'s due diligence
     then marks it chosen.
   - `candidateChoices` leaves out a row whose cell begins with `not found`.
4. **The Acceptance holds:**
   - The picked candidate is written under *Decision*, the drafted one under *Alternatives*, and the picked row is
     marked chosen.
   - A candidate that was not found is listed with its address and not offered. Known positive: one that was found is
     offered.
   - Removing the listener fails TST-1393001, and removing the filter fails TST-1393002.
   - TST-448230 and 448231 lose their `todo`: red at `1b2297558`, green at `09bad2c35`. sonnet-k wrote both cases, and
     sonnet-l built none of the page.

## Readings taken

- A pick is the author's edit of the decision's text (MOD-job-runner's `writeResult`, "such as the reuse candidate they
  chose").
- 7a's listing is the existing due-diligence row.
- No radio button is checked before the author picks.

All are taken.

## Noted

- `chosenIn` reads the tables *Decision* and *Alternatives* itself, as MOD-reuse-facts does without offering it. One
  shared reading would need MOD-reuse-facts to offer it. It is a candidate for the review, not registered now.
