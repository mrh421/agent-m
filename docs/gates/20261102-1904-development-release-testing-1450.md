---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7eb671909d15674c08216ba67420e2efe03f2295
  - https://github.com/akmaier/agent-m/pull/1757
date: 2026-11-02 19:04 UTC
---
# Development → Release testing: ITM-1450, #1757

**REGISTER**

## Reason

ITM-1450 (the main page's job table wears the site's one look) may go on. The pull request is #1757 into
`sprint/team1/143`, at `7eb671909`. developer-opus-e wrote the tests-only commit `6e9b4851e` and the code `7eb671909`
(trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It adds `tests/main-page-look.test.mjs`. In
   run 41502547826, only TST-1450002 fails. At attempt 1, shard 3 was cancelled at the time limit with no test failing;
   it passed at attempt 2.
2. **CI is green on the head:** run 41505224543 (`7eb671909`), at attempt 1. `git merge-tree` with the sprint branch's
   head `4287b8966` is clean.
3. **Only the item's module changes:** one line of `src/main-page/jobs.mjs` (MOD-main-page), plus the new test file.
   Before, `drawList` (`jobs.mjs:111`) drew `table.jobs`, a class no style sheet names. It is now `table.jobs.list`, as
   `look.css:116` styles it, and no CSS is added.
4. **The new tests name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-main-page.** The pull request records
   five counter-proofs. TST-1450001, the known positive, finds both a planted bare button and a planted bare table.
5. **The Acceptance holds:**
   - The table `jobs` carries `list`.
   - Every button of the main, jobs and job pages already carries `btn`, which TST-1450001 and 1450003 now guard.
   - No existing expected result changes.

opus-e read the binding documents and chapters 9, 11, 12 and 13 in full.

## Noted

- `drawList` (`jobs.mjs:85-86`) sets no `data-label`, so on a phone the job table's cells carry no column names. The item
  does not ask for them; it is a candidate for the review, not registered.
