---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 688d75e24d30b30b00f622515b0ecf7bbff606ef
  - https://github.com/akmaier/agent-m/pull/1390
  - tests/release-itm-1254-issue-move.test.mjs
  - tests/release-itm-1272-waiting-queues.test.mjs
  - tests/release-itm-1266-review-folders.test.mjs
  - tests/test_issue_to_spec.py
date: 2026-10-29 02:02 UTC
---
# Release testing → Sprint review: team 1's sprint 110

**REGISTER**

## Reason

The release tests of sprint 110's four items pass on `sprint/team1/110` at `688d75e2`, the head of #1390 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`). This is RELEASE TESTS
ARE NOT WRITTEN BY THE IMPLEMENTER (SPEC.md:1537-1541).

1. **The release tests, one file or more for each item, each declaring the level `release`:**
   - ITM-1254: `tests/release-itm-1254-issue-move.test.mjs`, TST-1254301 to 304.
   - ITM-1272: `tests/release-itm-1272-waiting-queues.test.mjs`, TST-1272301 to 303.
   - ITM-1266: `tests/release-itm-1266-review-folders.test.mjs`, TST-1266301 to 304.
   - ITM-1152: its own check, `tests/test_issue_to_spec.py` with `tests/test_issue_to_spec.md`, TST-1152001 to 003.
2. **Their writers, from the `Agent-M-Participant` trailers of every commit that touched them on the sprint branch:**
   - developer-sonnet-l wrote the 1254 and 1272 files in `98c8bc2c`, and the 1266 file in `38e67ee9`. Each commit
     touches only its files.
   - developer-sonnet-k wrote `test_issue_to_spec.py` and its data in `43a28d9b` and `b420bd2b`.
3. **None of them built the behaviour they test.** These are the trailers of every commit under `src/` on the sprint
   branch (`git log origin/main..origin/sprint/team1/110 -- src/`):
   - ITM-1254: `5c8dcd9f`, developer-opus-f;
   - ITM-1272: `67761100`, developer-sonnet-j;
   - ITM-1266: `2f3238dc` and `0156a9eb`, developer-opus-e.
   - developer-sonnet-k and developer-sonnet-l have no commit under `src/`.
   - ITM-582 and ITM-584, which `test_issue_to_spec.py` checks, were built before the sprint in the coordinator's
     session, with no commit naming k or l.
   - The other modules the files name (MOD-notifications, MOD-review-pages in TST-1254302, MOD-repository-hosts) were not
     built by sonnet-l either.
4. **Green on the sprint branch.** Run 40803561001 of #1390, `pull_request`, on `688d75e2`, passes 38 of 38
   pull-request jobs. In its release jobs:
   - TST-1254301 to 304 pass in release shard 8 (job 123217116865);
   - TST-1272301 to 303 in shard 4 (job 123217116790);
   - the four cases of `release-itm-1266-review-folders.test.mjs` in shard 3 (job 123217116749);
   - the three cases of `test_issue_to_spec.py` in shard 2 (job 123217116736).
   - All 14 pass.

## Noted

- The flaky `tests/review-pages-release-limitations.test.mjs` is ITM-1287, and passes in this run.
