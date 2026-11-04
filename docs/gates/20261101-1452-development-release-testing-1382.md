---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 12fe3fb34d88d587f3dd09419f8f905f2cc79a42
  - https://github.com/akmaier/agent-m/pull/1671
date: 2026-11-01 14:52 UTC
---
# Development → Release testing: ITM-1382, #1671

**REGISTER**

## Reason

ITM-1382 (the Definition of Done check reads the job before the pull request's commits) may go on. The pull request is
#1671 into `sprint/team1/142`, at `12fe3fb34`. developer-opus-f wrote the tests and the code (`Agent-M-Participant` on
both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `8b7064301` changes
   `tests/workflow-entries-done-check.test.mjs` (MOD-workflow-entries) only. In run 41317139419 its one new case,
   TST-1382001, fails, and no other. The file's helper `withCheckout` gains an option `pullRequest` whose default is the
   event the other cases had; none of their expected results moves.
2. **CI is green on the head:** run 41317786883 (`12fe3fb34`), attempt 2. At attempt 1 every test job passed and
   `agent-m done` failed: the pull request's body quoted a job identifier from the test's counter-proof, so the check
   looked for that job's record. The body was corrected and the rerun is green; the code did not change. `git merge-tree`
   with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/workflow-entries/product.mjs`, +6/−1. Before `composeTestRun` and
   `pullRequestFacts`, `onDoneCheck` reads the event's pull request; when its title is a string and names no job, nor its
   body, the check ends with the existing *nothing to do*. Otherwise it runs as before.
4. **The Acceptance holds:** a pull request that names no job ends without reading its commits (TST-1382001: 12 calls of
   the fake server on the base, 0 on the head); one that names a job is checked as before, its commits read, ending
   `done`. The pull request records two planted faults. The pin of the product's CI is ITM-1383's.

## Readings taken

- A GitLab event carries no title, so the check there runs as before.
- The job's identifier is still taken from the server's facts once the check runs.

Both are taken.

## Noted

- On GitLab the check still reads every commit before it knows whether a job is named; carrying `CI_MERGE_REQUEST_TITLE`
  into the entry would be a change of its own. Nothing waits on it.
- A pull request's body that quotes a job identifier makes the check look for that job. Noted for the brief.
