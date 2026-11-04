---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7e2c9b56796956dff56758c3d8514fad676a4e42
  - https://github.com/akmaier/agent-m/pull/1688
date: 2026-11-01 18:56 UTC
---
# Development → Release testing: ITM-1395, #1688

**REGISTER**

## Reason

ITM-1395 (an incomplete architecture draft is not reviewed) may go on. The pull request is #1688 into `sprint/team1/142`,
at `7e2c9b567`, a merge of the sprint branch into the item for `main`'s changes. developer-sonnet-k wrote the tests-only
commit `c1209361f` and the code `d951a7dca`; developer-sonnet-l wrote `0dc37190c`, the lift of TST-448312's `todo`, after
the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `c1209361f` adds
   `tests/job-runner-incomplete-draft.test.mjs` (TST-1395001 to 1395004). It also moves TST-739005 of
   `system-uc-023-modify-the-architecture`, whose declaration names `module: MOD-job-runner`, the item's module. In run
   41328613717 the failing cases are two new ones and TST-739005, besides the `todo` cases that name a finding.
2. **CI is green on the head:** run 41338288361 (`7e2c9b567`), at the first attempt. No job failed or was cancelled. The
   earlier run 41337056585 failed only on `main`'s two causes, `test_no_backend` and TST-371318, both fixed since.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/job-runner/loop.mjs`. After its checks, the loop asks the reviewing
   participants only when no check found `ONE DECISION STATES THE WHOLE ARCHITECTURE`; such a finding goes back to the drafter.
4. **The Acceptance holds:**
   - A draft without that decision is sent to no reviewer, and the completed draft is reviewed.
   - TST-739005 moves from four requests to three: the reviewer is asked for the corrected draft only, and the case now
     asserts that the review holds its text. sonnet-l wrote that system case; the move is the item's own, in its tests-only
     commit.
   - Four planted faults are recorded in the pull request.
   - TST-448312 loses its `todo` in sonnet-l's commit: red at `c1209361f`, green at `d951a7dca`. sonnet-k wrote the case,
     and sonnet-l built none of the loop.

## Reading taken

- The condition is the finding of that one rule, so it holds for every kind whose checks give it. The wider reading, any
  error withholds the review, was probed and not taken, since it moves TST-739005 and other cases further than the item
  asks.

## Noted for akmaier

- MOD-job-runner's text assigns the loop, "its checks and then its reviewing participants", but states no condition of
  completeness. The general change is a sentence there naming it.
