---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9ad790fb83f3cfb3c931e68587df9a996788fb42
  - https://github.com/akmaier/agent-m/pull/1750
date: 2026-11-02 16:01 UTC
---
# Development → Release testing: the UC-018 battery follows the accepted texts, #1750

**REGISTER**

## Reason

The UC-018 battery may go on. The pull request is #1750 into `sprint/team1/142`, at `9ad790fb8`. developer-sonnet-l wrote
both commits, `e430133ae` and `9ad790fb8`. I wrote none of it.

akmaier's acceptance of the SPEC packages' texts reached the sprint branch with the merge of `main` (`084642c4e`):
- `A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE` is withdrawn. `SPEC.md` holds it no more; the same `grep` finds
  `A CLEAR IS A REAL CLEAR`, the known positive.
- UC-018 step 6 reads "Agent M adds an entry to the section's queue".
- UC-018's `realises` lists 21 requirements.

The battery still asserted the old texts, so run 41474024697 of #1749 was red on TST-376201, 376206 and 376301.

1. **No red first commit is needed.** The pull request adds no behaviour and changes only tests to follow the accepted
   texts, as a battery's own changes do (the reading *A battery*).
2. **CI is green on the head:** run 41475606524 (`9ad790fb8`), with all twelve `release-pull-request` shards passing.
   `git merge-tree` with the sprint branch's head `9ce9b9e72` is clean.
3. **Only test files change:** `tests/system-uc-018-edit-a-specification-or-use-case.test.mjs` and
   `tests/release-uc-018-edit-a-specification-or-use-case.test.mjs`.
   - TST-376201's flow-map passage for step 6 quotes the accepted text. Its finding names MOD-spec-changes, the module the
     SPEC packages' build item changes.
   - TST-376206 asserts the new step 6: a second edit of one section adds entry 02 to the section's queue and leaves 01.
     It is marked `todo` as FINDING UC018-F1 (MOD-spec-changes) until the build item is done.
   - TST-376301 maps the 21 requirements UC-018 now realises.
   - Release TST-376320 is removed, with its finding check. It guarded only the withdrawn requirement, so nothing is left
     for another test to guard.
4. **No new test is added.** TST-376206's rewritten assertions are its own counter-proof today: it fails, as a `todo`, on
   the behaviour that is not built yet.
5. **The release tests still meet r142's conditions** (`20261102-1448-…-r142`):
   - **Writer:** `release-uc-018` is changed only by sonnet-l, who built none of UC-018's behaviour. Its twelve commits
     under `src/` in the whole history are merges of other participants' pull requests, and none of them is its own code.
   - **Green:** the release shards are green on the head, as point 2 states.

So the release gate stands for the sprint branch once #1750 is merged.
