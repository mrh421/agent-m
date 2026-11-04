---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - e7dcef4146a1a96e888bcf524127bf74e6745273
  - https://github.com/akmaier/agent-m/pull/1685
date: 2026-11-01 16:39 UTC
---
# Development → Release testing: ITM-1387, #1685

**REGISTER**

## Reason

ITM-1387 (one wait for the review pages' tests) may go on. The pull request is #1685 into `sprint/team1/142`, at
`e7dcef414`. developer-opus-f wrote `4f3083f05`, and developer-sonnet-l wrote `e7dcef414` (`Agent-M-Participant` on each).
I wrote none of it.
1. **No failing first commit:** the item adds no behaviour (its Acceptance).
2. **CI is green on the head:** run 41326818176 (`e7dcef414`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only tests of the item's modules change.** `4f3083f05` adds `tests/review-pages-wait.mjs` (`Module: MOD-review-pages`),
   which holds ITM-1287's `until(page, condition, what)`. It changes eleven `review-pages-*` files to import it instead of
   their own 400-turn copy. The lines removed are those copies; no assertion, expected result or declaration changes. The
   helper is a file of its own because four of the files do not import the harness.
4. **The Acceptance holds:**
   - No copy of the 400-turn wait stays in the eleven files.
   - `tests/release-itm-1314-put-back-after-removal.test.mjs` is changed in a commit of its own by sonnet-l, who wrote that
     release file and has written no code under `src/` other than merge commits, so built none of ITM-1314.
   - With the threadpool held, the failures fall from 20/20 to 0/20 for `edit-architecture` (the flipping file) and from
     10/10 to 0/10 for `architecture`, `handed-snapshot`, `use-cases` and `release-itm-1314`. For `release-reports` they fall
     from 7/10 to 0/10. On a free pool there were none before or after.
   - The planted faults fail by name: a file not drawn again, a save never answered, the text filter removed, and
     `createTag` removed.

## Reading taken

- A page has settled when a paragraph of the class `result` holds text. The editor keeps an empty one until a save is
  answered (`src/markdown-render/editor.mjs:34`), so ITM-1287's wait, read literally, would end every editor's wait at once
  (planted fault 3).

## Noted

- `review-pages-arrange` (:128, 600 turns) and `review-pages-spec-entries` (:152) keep waits of their own. No flip of
  either is counted in this sprint. They are candidates for the review and are not registered now.
- With this merge, `review-pages-edit-architecture`'s two flips have their item.
