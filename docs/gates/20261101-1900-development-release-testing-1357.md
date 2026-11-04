---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 61f568a11e0a8a2d62da494743ab01b2c50c960e
  - https://github.com/akmaier/agent-m/pull/1637
date: 2026-11-01 19:00 UTC
---
# Development → Release testing: ITM-1357, #1637

**REGISTER**

## Reason

ITM-1357 (Arrange deletes an empty group and lifts a group's content) may go on. The pull request is #1637 into
`sprint/team1/141`, at `61f568a11`, by developer-sonnet-k (`Agent-M-Participant` on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `7eb86933a` adds three cases to
   `tests/review-pages-arrange.test.mjs` (MOD-review-pages). In run 41294082098 (pull_request) only TST-1357001 to 1357003
   fail.
2. **CI is green on the head:** run 41294266942 (pull_request, `61f568a11`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module changes:** three lines of `groupNode` in `src/review-pages/arrange.mjs`. *Delete* hands
   `applyOne` the move `{ op: "delete", group }`, and the existing path shows `applyMoves`' refusal with its reason.
4. **The Acceptance holds:**
   - An empty group is deleted as a pending change, and *Save* writes `docs/groups/use-cases.md` alone, without it
     (TST-1357001).
   - Deleting a group that is not empty is refused with its reason, and nothing changes (TST-1357002).
   - Lift, then delete: the content stands in the parent and the group is gone (TST-1357003).
   - Counter-proof: with *Delete* handing a `lift` move, all three fail.

## The reading, ruled

**Move content up one level** was already drawn (`src/review-pages/arrange.mjs:208-209`), guarded by TST-726004 and
TST-738011. The item's Outcome said the page offers neither; it offered *lift*. So only *Delete* is added, and
TST-1357003 walks both. Taken.

## Next

TST-738012's `todo` (FINDING F2) is taken away by a participant other than the implementer, after the code:
developer-sonnet-l.
