---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6be032a70ce6918c85d4ccacc775d2c60f2f8abe
  - https://github.com/akmaier/agent-m/pull/1666
date: 2026-11-01 12:22 UTC
---
# Development → Release testing: ITM-1379, #1666

**REGISTER**

## Reason

ITM-1379 (a job on the server's runners says its calls are billed per use) may go on. The pull request is #1666 into
`sprint/team1/141`, at `6be032a70`. developer-opus-e wrote the tests-only commit `862205161` and the code `f30e7404a`;
developer-sonnet-l wrote `6be032a70`, the lift of TST-373210's `todo`, after the code was pushed (`Agent-M-Participant`
on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `862205161` changes
   `tests/review-pages-draft-use-cases.test.mjs` (MOD-review-pages) only. In run 41304804569 the one failing case is the
   new one, "on the server's runners, the run panel says the calls are billed per use by the agent's provider".
2. **CI is green on the head:** run 41305325124 (`6be032a70`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** four lines in `panelOf` of `src/review-pages/jobs.mjs`. When the chosen offer's
   route is `ci hosted`, the view appends to the panel a line naming the route and that the calls are billed per use by the
   agent's provider. It reads nothing more.
4. **The Acceptance holds:** TST-1379001 and 1379002 cover the line on `ci hosted` and its absence on another route; the
   pull request records the planted fault `route.kind === "tab"`, which fails both. TST-373210 loses its `todo`: it fails at
   the tests-only commit on /billed per (use|call)/ and passes on the head. The other views that offer the CI route are named
   in the pull request.

## Readings taken

- The line stands with the panel, as MOD-site-frame's `runPanel` leaves what the panel names besides to the view.
- "The server's runners" is `ci hosted`; a self-hosted runner, `ci runner:<label>`, is the person's own machine.

Both are taken.

## Noted

- `panelOf` serves the drafting pages of requirements and architecture too, so the line shows there as well, which UC-010
  covers. The other views named in the pull request are unchanged; nothing waits on them.
