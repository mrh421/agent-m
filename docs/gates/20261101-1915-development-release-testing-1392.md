---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a0a295f40f47294935bea7fe893195e4110dc3d9
  - https://github.com/akmaier/agent-m/pull/1694
date: 2026-11-01 19:15 UTC
---
# Development → Release testing: ITM-1392, #1694

**REGISTER**

## Reason

ITM-1392 (a finding only the author decides is shown with the architecture draft) may go on. The pull request is #1694
into `sprint/team1/142`, at `a0a295f40`. developer-opus-f wrote the tests-only commit `6f8d4d56a` and the code `37e7633d6`;
developer-sonnet-l wrote `a0a295f40`, the lift of TST-448229's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `6f8d4d56a` adds TST-1392001 to
   `tests/review-pages-draft-architecture.test.mjs` (MOD-review-pages). In run 41339695895 it is the only failing case.
2. **CI is green on the head:** run 41340241016 (`a0a295f40`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/jobs.mjs`, two lines.
   - The path: `loop.mjs:200-202` keeps a finding under `A CONFLICT IS DECIDED BY A PERSON` in `forPerson`. The tab's
     runtime hands it to the page, and `presentDerivation` never read it.
   - Now the page draws it with the file's existing `findingsList("for-person", …)`, and only when there is one.
4. **The Acceptance holds:**
   - The reviewer's conflict is shown in the compiler form, apart from the rounds, and stands in no request to the drafter.
   - Known positive: the graph check's finding is sent back. Counter-proof: a run without a conflict shows no list.
   - The two planted faults fail the case: `remaining` shown in its place, and the list always drawn.
   - TST-448229 loses its `todo`: red at `6f8d4d56a`, green with the code. sonnet-k wrote the case, and sonnet-l built
     none of the page.

## Readings taken

- The list `ul.for-person` stands beside the list of findings left and the list of a step's findings, drawn only when
  there is a finding.
- After *Check this edit*, the page keeps the first run's lists, as it keeps its rounds.

Both are taken.
