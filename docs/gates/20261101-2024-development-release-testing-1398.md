---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3f3ca9676b742522633edb4ee872f7469bb93203
  - https://github.com/akmaier/agent-m/pull/1701
date: 2026-11-01 20:24 UTC
---
# Development → Release testing: ITM-1398, #1701

**REGISTER**

## Reason

ITM-1398 (a save after a refusal compares with the newer version) may go on. The pull request is #1701 into
`sprint/team1/142`, at `3f3ca9676`. developer-opus-f wrote the tests-only commit `a9327f03d` and the code `aac60e861`;
developer-sonnet-l wrote `3f3ca9676`, the lift of TST-376217's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - `a9327f03d` adds TST-1398001 to `review-pages-edit-requirement` and TST-1398002 to `review-pages-use-cases`. In run
     41344889113 they are the only failing cases.
   - It also changes the shared wait `tests/review-pages-wait.mjs` (MOD-review-pages). A result paragraph that already
     held text when a wait began counts only once its text changes; otherwise a wait after a refusal ends at once. Its 16
     users stay green, and no expected result changes.
2. **CI is green on the head:** run 41345617991 (`3f3ca9676`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/edit.mjs` and `file-edit.mjs`. On a refusal, the editor takes the
   newer version's blob as the one it now edits against:
   - the requirement's editor takes the blob of the section the refusal shows, or none when that section is gone
     (`edit.mjs:64` → `proposeSection`);
   - the file's editor takes the refusal's `currentBlob` (`file-edit.mjs:143` → `saveFile`), as `arrange.mjs:293` does.
4. **The Acceptance holds:**
   - The merged text is saved once against the newer version.
   - The planted fault, every save compared with the branch at the time of saving, fails each new case alone, so a later
     change is still refused.
   - TST-376217 loses its `todo`: red at `a9327f03d` (0 ≠ 1), green at `aac60e861`. opus-e wrote the case, and sonnet-l
     built none of the editors.

## Reading taken

- "The blob the file or section was opened on" (MOD-review-pages) is, after a refusal, the newer version the refusal
  shows. It is the item's reading.

## Noted

- `entry-edit.mjs:72` and `file-drafts.mjs:30` also keep their first blob after a refusal. No case guards them. They are a
  candidate for the review, not registered now.
