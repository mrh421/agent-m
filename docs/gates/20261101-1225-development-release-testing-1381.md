---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c62bc6954a6b6e90c8ed91a89b9dc63b52df3541
  - https://github.com/akmaier/agent-m/pull/1664
date: 2026-11-01 12:25 UTC
---
# Development → Release testing: ITM-1381, #1664

**REGISTER**

## Reason

ITM-1381 (a queued endpoint job in CI reads the key its route names) may go on. The pull request is #1664 into
`sprint/team1/141`, at `c62bc6954`. developer-sonnet-k wrote the tests-only commit `c3988b739`, the code `90a999ffc` and
the further test `53cf6d1c1`; developer-sonnet-j wrote `c62bc6954`, the lift of TST-373211's `todo` with the harness's
stored endpoint, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `c3988b739` changes
   `tests/workflow-entries-job-workflow.test.mjs` (MOD-workflow-entries) only. In run 41304211074 its three new cases,
   TST-1381005 to 1381007, fail, and no other.
2. **CI is green on the head:** run 41306106037 (`c62bc6954`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/workflow-entries/product.mjs`. `CI_ROUTE` is gone, and the four reads of a
   key's secret take it from the participant's route with the existing `SECRET_OF`, a model endpoint's route
   `endpoint <name> secret <NAME>` among them. TST-1381008, added after the code at the Scrum Master's return, covers the
   dispatch branch; its planted fault, the old pattern in that branch, fails it alone. A later test that adds a case
   weakens nothing.
4. **The Acceptance holds:** a queued endpoint job is taken by the machine that holds its route's key, gets that key, and
   is not run when the key is missing, naming it.

## The lift of TST-373211, ruled

The Acceptance gives the lift to a participant other than the implementer, after the code, with the harness's stored
endpoint of `ci-bot`. sonnet-j's commit does that. The fixture's `ci-bot` keeps its route `ci hosted secret FIXTURE_KEY`,
which the old pattern read as well, so the lift does not fail at `c3988b739`; without the harness's stored endpoint it
fails on the head ("names no endpoint and no agent"). A lift shows that UC-010's flow works with the merged items, here
ITM-1378 and the harness; it need not be red at the item's own tests-only commit. ITM-1381's code is shown by its own unit
cases and their planted faults. An `endpoint ci-bot secret …` row would move TST-373202 and the offer's reads, outside
this item. Taken.

## Noted

- sonnet-k's first report read neither the SPEC nor chapters 9, 11, 12 and 13, and left the dispatch branch untested; the
  Scrum Master returned it, and both were done before this gate. Noted for the retrospective.
