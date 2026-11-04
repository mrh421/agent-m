---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ec360cc8164fee097cc51c28949f25302a09b058
  - https://github.com/akmaier/agent-m/pull/1768
date: 2026-11-03 07:40 UTC
---
# Release testing → Sprint review: the release tests of team 1's sprint 143, after #1768

**REGISTER**

## Reason

The condition that failed in `20261103-0732-release-testing-sprint-review-r143.md` now holds. The other conditions stand
as that record gives them.
1. **#1768 writes the two cases.** It is developer-sonnet-l's one tests-only commit `ec360cc81`, into `sprint/team1/143`,
   and changes only `tests/test_issue_to_spec.py` and `.md` (8 lines added, 8 removed). It merges cleanly onto
   `6738cd327`.
   - sonnet-l built none of ITM-1397.
   - He read AGENTS.md, the whole SPEC and chapter 13 in full, and MOD-spec-changes at its accepted blob `9964b0f91282`,
     not ITM-1453's draft.
2. **The cases follow the accepted text, not the code.** TST-1152001 and TST-1283001 expect the line
   `**Issue:** #7 of <product address>` in the entry's rationale, as MOD-spec-changes' Data gives it for
   `NN-<package>.begruendung.md`. `queueNames` reads the rationales.
   - `queueHolds` now leaves the rationales out, so it can no longer pass on them by mistake.
   - The expect lines and planted faults are in his own words.
   - Counter-proof: an empty selection of rationales fails `queueNames`.
3. **The writer.** The adapter's two lines that select and read the rationales are, by `git blame`, still opus-f's
   `9ab594c0e`. sonnet-l's commit leaves them unchanged, since his own reading gives the same lines. He disclosed that a
   layout `grep` showed him opus-f's lines before he wrote. The expected values the cases assert are sonnet-l's. As the
   rejection said, a text equal to opus-f's that he commits is his. So every release case changed since the cut
   `7a9b031d3` is written by a participant other than the implementer of what it tests.
4. **Green.** Run 41597358217 on `ec360cc81` is green at attempt 1. Release shard 9 ran all four cases of
   `test_issue_to_spec` and passed them. The other release shards were green in the item pull requests' runs, and none of
   their files changed after those runs.

Once #1768 is merged, the release tests of sprint 143 may go to the sprint's review.
