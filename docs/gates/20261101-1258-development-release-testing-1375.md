---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3a944d28589e44646115e9bf9b035eff78f221b0
  - https://github.com/akmaier/agent-m/pull/1669
date: 2026-11-01 12:58 UTC
---
# Development → Release testing: ITM-1375, #1669

**REGISTER**

## Reason

ITM-1375 (an item's merged pull request closes its issues with links) may go on. The pull request is #1669 into
`sprint/team1/141`, at `3a944d285`. developer-opus-f wrote the tests-only commit `cbee694d8` and the code `9d135850b`;
developer-sonnet-l wrote `3a944d285`, the lift of TST-804211's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `cbee694d8` adds
   `tests/maintenance-pages-item-close-1375.test.mjs` (MOD-maintenance-pages) and
   `tests/workflow-entries-item-pull-request-closed.test.mjs` (MOD-workflow-entries), and gives the world
   `tests/workflow-entries-pull-request-world.mjs` (MOD-workflow-entries) a commit of the instance's checkout; no expected
   result moves. In run 41308290667 the failing cases are TST-1375001 to 1375003 and TST-1375101 to 1375103, and no other.
2. **CI is green on the head:** run 41308648285 (`3a944d285`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's modules change:** `src/workflow-entries/product.mjs` (`issuesClosedBy`; `workFacts` with `atHead`) and
   `src/maintenance-pages/issues.mjs` (`itemTrail`; `closeControls`, shared with the fix's trail). `closeWithLinks` is
   unchanged.
4. **The Acceptance holds:** an item's merged pull request closes the issues among its origins with `closeWithLinks`,
   naming the pull request and the item, both in `onPullRequestClosed` and through *Close with links*; a bug fix closes its
   issue as before. The pull request records 13 planted faults. TST-804211 loses its `todo`: it fails at `cbee694d8` ("the
   item's merged pull request offers the close", 0 ≠ 1) and passes on the head.
5. **Reads against the base:** the page of a bug or a change issue now reads the backlog's items in one batch, and the job
   records only when an item names the issue. It shows what it reads: the close of the item's pull request. TST-1270004 to
   1270006 and 1270301 to 1270302, which count the page's reads, still pass.

## Readings taken

- A job that implements an item is of kind `implement` or `refactor` and names it in `works_on`; `close-sprint` closes no
  issue.
- The issues closed are those among the item's origins.
- In CI the items are read through `productFacts` at the head, since `artifactSchemas` is not among MOD-workflow-entries'
  Uses.
- On the page the close stands below *Move to backlog*.

All are taken.
