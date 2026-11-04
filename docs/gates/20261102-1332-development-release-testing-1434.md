---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3008bed58a7a07dbbe792dfd53eb70cc03d5c3c3
  - https://github.com/akmaier/agent-m/pull/1743
date: 2026-11-02 13:32 UTC
---
# Development → Release testing: ITM-1434, #1743

**REGISTER**

## Reason

ITM-1434 (the release run's check that the SPEC names exists) may go on. The pull request is #1743 into `sprint/team1/142`,
at `3008bed58`, one commit by developer-sonnet-l (`Agent-M-Participant`). I wrote none of it.
1. **Only new test files:** `tests/test_release_run.py` with its data file `tests/test_release_run.md`, and
   `tests/release-run-world.mjs`. This is the check the SPEC names for `A RELEASE RUNS EVERY TEST AT EVERY LEVEL`,
   `ACCEPTING THE RELEASE TEST REPORT RELEASES` and `A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED`.
2. **CI is green on the head:** run 41453040176 (`3008bed58`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Its writer built none of what it guards.** By the trailers, sonnet-l's commits on that code are `todo` lifts only.
4. **The Acceptance holds:**
   - 21 cases: 19 pass, and 2 are expected failures that name a finding.
   - 24 planted faults, and every case fails on at least one.

## Ruled

- **The finding of cases 019 and 020 → ITM-1442 (MOD-result-records), registered in this commit.** `runOf`
  (`src/result-records/strategies.mjs:249`) leaves out the row `paid` and every row whose column of the release candidate is
  empty. MOD-test-schedule has a release candidate run every row (UC-028 1a). So a product with paid tests never
  completes a release through this route, and `acceptAndRelease` refuses the run as incomplete. The fix is one filter in
  one function.

## Readings taken

- "Accepting the release test report on the dashboard" is the release panel calling `acceptAndRelease`.
- "Rejecting it sets no tag": the flow offers no rejection of a report, so there is nothing to reject.
- No case runs fewer levels than declared, since the SPEC asks that every test "has run".

All are taken.
