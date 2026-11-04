---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - f1623490e7330a26395d523ac2f461efe04f07e1
  - https://github.com/akmaier/agent-m/tree/sprint/team1/143
date: 2026-11-03 07:32 UTC
---
# Release testing → Sprint review: the release tests of team 1's sprint 143

**REGISTER**

## Reason

**Rejected on one condition:** two release cases are written by the implementer of the behaviour they test
(`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`).

1. **The release tests.** From the cut `7a9b031d3` to the head `f1623490e`, eight changed files hold cases of level
   `release`: `release-itm-1274`, `release-itm-1335`, `release-sprint-02-c`, `release-uc-005`, `release-uc-012`,
   `release-uc-018`, `release-uc-046` and `tests/test_issue_to_spec.py`. The same `grep` finds no release case in
   `test-pages-release-look`, `test_apply_approvals.py` and `test_approval_records.py`, which also changed; it does find the
   level in the eight files above, the known positive.
2. **The writers, by the `Agent-M-Participant` trailer of every commit that touches them since the cut:**
   - In the seven `release-…` files, every net change is developer-sonnet-l's, written after the code:
     - `cd51514e8` (ITM-1397);
     - `9bd671b33` (ITM-1365);
     - `268c6ef5b` (ITM-1451).

     opus-f's and sonnet-j's own edits there are reverted byte for byte (`c6b3e8560`, `25220cd6c`). sonnet-l built none
     of this sprint's behaviour.
   - **`tests/test_issue_to_spec.py` does not meet the condition.** developer-opus-f changed it in ITM-1397's tests-only
     commit `9ab594c0e`, and no later commit took that change over:
     - TST-1152001 and TST-1283001 now read the issue from each entry's rationale instead of the queue's index;
     - the adapter's `queueNames` changed with them.

     That is the behaviour opus-f built in ITM-1397. I missed it at ITM-1397's gate, where I checked only the files
     named `release-…`.
3. **Green on the sprint branch.** The push run 41596888847 on `f1623490e` is green, but a push runs no release row. The
   item pull requests' runs were green on every release shard. The release rows are to be read on the sprint's pull
   request into `main`.

## What follows

developer-sonnet-l, who built none of ITM-1397, writes TST-1152001's and TST-1283001's expectation, and the adapter's
`queueNames`, from the accepted text: MOD-spec-changes, Data, "for an entry drafted from an issue, the line
`**Issue:** #<number> of <product address>`" in the rationale. He does this in a tests-only pull request into
`sprint/team1/143`, after reading AGENTS.md, SPEC.md and chapter 13 in full. If his text equals opus-f's, the commit still
makes it his. This gate is then decided again.
