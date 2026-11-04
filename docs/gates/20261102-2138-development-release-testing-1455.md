---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7c94dd66c4ddddaf41cc871752f553cb49cf91d1
  - https://github.com/akmaier/agent-m/pull/1764
date: 2026-11-02 21:38 UTC
---
# Development → Release testing: ITM-1455, #1764

**REGISTER**

## Reason

ITM-1455 (the main page's job table names its columns on a phone) may go on. The pull request is #1764 into
`sprint/team1/143`, at `7c94dd66c`. developer-sonnet-k wrote the tests-only commit `81770c496` and the code `7c94dd66c`
(trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It adds
   `tests/main-page-job-table-labels.test.mjs`. In run 41525812639 (attempt 2; the other jobs were cancelled at the limit
   with no test failing), only TST-1455001 fails.
2. **CI is green on the head:** run 41527755821 (`7c94dd66c`), at attempt 3. At attempts 1 and 2, one job each was
   cancelled at the limit with no test failing. `git merge-tree` with the sprint branch's head `35b0f0935` is clean.
3. **Only the item's module changes:** `src/main-page/jobs.mjs` (MOD-main-page), plus the new test file.
   - Before, `drawList` (`jobs.mjs:85-86`) drew nine `<td>` without `data-label`, so `look.css:188`'s phone rule matched
     nothing.
   - Now the nine titles stand once, in `COLUMNS`, which gives both the head's `<th>` and each cell's `data-label`: one
     list, not two (`DON'T REPEAT YOURSELF`).
   - No CSS is added, and no existing expected result changes.
4. **The new test names `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-main-page.** The pull request records
   three counter-proofs.
5. **The Acceptance holds:** every cell of the table `jobs` carries `data-label` with its column's title.

sonnet-k read the binding documents, chapters 9, 11, 12 and 13 and both module files in full, before any code.

## Ruled

- **sonnet-k's readings stand.** "Every cell" means every `<td>` of a job row. The group heading `<th colspan=9>` stays
  unlabelled, since MOD-site-frame says that a cell without `data-label` "stands unlabelled".
