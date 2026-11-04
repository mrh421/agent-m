---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d1118cec345b4853180acd02c1403e7e8ba75cff
  - https://github.com/akmaier/agent-m/pull/1678
date: 2026-11-01 15:42 UTC
---
# Development → Release testing: ITM-1388, #1678

**REGISTER**

## Reason

ITM-1388 (the participants test waits for the saved list) may go on. The pull request is #1678 into `sprint/team1/142`, at
`d1118cec3`, one commit by developer-sonnet-k (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item adds no behaviour and changes only a test's wait (its Acceptance).
2. **CI is green on the head:** run 41322182501 (`d1118cec3`), at the first attempt. Every job that did not succeed is a
   skipped job of another event. `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's test changes:** `tests/settings-pages-participants.test.mjs` (`Module: MOD-settings-pages`), +17 lines
   in the shared helper `save(page)`.
4. **The cause is named as a data-flow path:** the test's `click` returns after the fixed 15 ms of `settle`. The Save
   handler awaits `saveFile` (`src/settings-pages/participants.mjs:419`), whose `commitFiles` then awaits `blobSha`
   (`src/artifact-edits/save.mjs:81`, `crypto.subtle.digest` on node's threadpool). Only after that does it run
   `writeSetting` (:428), `renderList` (:430) and "Saved." (:433). So the case read the empty list at `:329` (run
   41319529673).
5. **The Acceptance holds:** `save(page)` now waits for `participants-result` to have text instead of a number of turns,
   and it fails by name for any text but "Saved.". The case keeps its expected results. With the threadpool held busy,
   20 of 20 runs failed before and 0 of 20 after. Counter-proofs: a save that never lands fails 10 cases by the
   deadline's message, and a refused save fails them with the refusal's text.

## Reading taken

- "The page's state" is `participants-result`, the paragraph the route writes last. The check that it reads "Saved." is
  the wait's end condition, not a new expected result: every caller of `save(page)` already expects a saved participant.

## Noted

- With this merge, `settings-pages-participants`' flips (sprint 141, and run 41319529673 in this sprint) have their item.
