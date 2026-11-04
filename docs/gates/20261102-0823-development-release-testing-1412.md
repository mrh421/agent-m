---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 04e5b2cfa9ca9ca7fa1a73cd0f5f39715386de28
  - https://github.com/akmaier/agent-m/pull/1712
date: 2026-11-02 08:23 UTC
---
# Development → Release testing: ITM-1412, #1712

**REGISTER**

## Reason

ITM-1412 (a rejected gate ends its job) may go on, for what its modules do. The pull request is #1712 into
`sprint/team1/142`, at `04e5b2cfa`. developer-sonnet-k wrote the tests-only commit `c2f2e0fd8` and the code `04e5b2cfa`
(`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `c2f2e0fd8` adds cases to
   `tests/runtimes-resume.test.mjs` (MOD-runtimes) and `tests/workflow-entries-resume-gate.test.mjs`
   (MOD-workflow-entries). In run 41350904771 only these new cases fail.
2. **CI is green on the head:** run 41411759175 (`04e5b2cfa`), at attempt 2. Attempt 1 failed only TST-367004 of
   `desktop-shell-bridge-jobs`, which the pull request does not touch (below). `git merge-tree` with the sprint branch's
   head is clean.
3. **Only the item's modules change:** `src/workflow-entries/product.mjs`, `src/runtimes/index.mjs` and `tab.mjs`.
   - Before, the CI entry's `resumable` kept only `passed` gates (`product.mjs:332`), so a job at a rejected gate waited
     for ever. `resumeJob` appended `## Resumed` for any record.
   - Now a rejected gate record that names the job, decided by someone other than the job's participant, ends the job with
     an End `failed` whose reason names the gate, the record and the rejection's reason. This holds on CI, in the tab and
     on a Bridge.
   - The code commit's change to the test adds a `git pull` and a message to an assertion. No expected value moves.
4. **The Acceptance, for these modules, holds:** a job waiting at a rejected gate ends `failed` naming the record and its
   reason, and a `passed` record still resumes the job. TST-1412001 to 1412009 have counter-proofs A to K in the pull
   request.

## Ruled

- **"Its step or item shows *ready* again" is not built here, and moves to ITM-1416 (MOD-work-plans), registered in this
  commit.**
  - The lift of TST-805218 (UC-034 7a) stopped without a commit. Even with this code's End, `itemStates`
    (`src/work-plans/states.mjs:205`) gives an item whose job failed the state `blocked`, and MOD-work-plans is not among
    ITM-1412's modules.
  - sonnet-l rightly neither weakened the case nor wrote the End as `cancelled`. TST-805218 keeps its `todo`.
  - ITM-1416 reads a job that a rejected gate ended as not having failed at its work, so its item is `ready` with the
    reason. MOD-work-plans' `ItemState` text ("blocked (a job failed, or waits for a person)") does not list that case,
    which is noted for akmaier. The item can be built on that reading, so nothing is asked now.

## Readings taken

The pull request names eight readings. Among them:
- a rejection counts as a decision of the gate;
- only the job the record names ends;
- the job's own participant's rejection does not count;
- `resumeJob` imports `readDocument` and `gateSchema` by Uses read at the level of the module;
- the reason's form stands in the two modules, a small duplicate.

All are taken. The duplicate is a candidate for the review.

## Flips counted

- `desktop-shell-bridge-jobs` (TST-367004) flipped a second time, in run 41411759175 at attempt 1: the job read "running"
  where "done" was expected after about 7 s. Its first flip was counted at ITM-1389's gate. It is registered as ITM-1417
  (its test only) in this commit.
