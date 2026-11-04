---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 58baa19ff555f7c61734951cbca05e33f51d606b
  - https://github.com/akmaier/agent-m/pull/1613
date: 2026-11-01 09:00 UTC
---
# Development → Release testing: ITM-1271, #1613

**REGISTER**

## Reason

ITM-1271 (a review page reads the record of the job that wrote the file it shows) may go on. The pull request is #1613
into `sprint/team1/141`, at `58baa19ff`, by developer-sonnet-k (`Agent-M-Participant` on every commit). I wrote none of
it.
1. **The tests come first, and each tests-only commit is red:**
   - `61e177cad`, run 41282295558;
   - `228e826ec`, run 41282483624;
   - `224c81d4d`, run 41282654901;
   - `41b4e1592`, run 41282739006.

   The first code, `ed1973cce`, read the records one by one. The Scrum Master returned it, since it broke TST-1311301 and
   `A PAGE LOAD READS THE REPOSITORY IN BATCHES`. `58baa19ff` supersedes it. The final expectations stand in the red
   commits `224c81d4d` and `41b4e1592`.
2. **CI is green on the head:** run 41282844999 (pull_request, `58baa19ff`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module and its tests change.**
   - The code is in `src/review-pages/` (`jobs.mjs`, `flow.mjs`).
   - `tests/review-pages-job-notes-one-record.test.mjs` is new, and TST-680211 in
     `tests/review-pages-use-cases.test.mjs` is changed. Both are headed MOD-review-pages.
   - `tests/release-itm-1311-job-record-batch.test.mjs` passes unchanged.
4. **The reader is the one the module text gives.** `jobNotes` and `draftingRounds` read through `newestJobRecords`,
   which hands the snapshot's records to MOD-job-ledger's `recordsNewestFirst`: "the record of the job that drafted a
   file … read newest first and no further than that record" (MOD-review-pages.md:360-361). `listJobs` over all records
   is gone from both, and nothing reads a record twice (AGENTS.md §2.2).

## The reading, ruled

The Acceptance gives two counts:
- "reads no record older than it";
- "`#review/arc` with an architecture job among the ten newest reads at most ten records".

The code asks for the records in batches of at most 100, newest first, as `A PAGE LOAD READS THE REPOSITORY IN BATCHES`
gives it (SPEC.md:684-691). It stops after the batch that holds the job's record. So a recent job costs one request, as
ten records would, instead of 478 records in 5 batches: the Acceptance's measurable outcome.

Meeting the literal counts would need a smaller first batch, a special first case (AGENTS.md §2.5). TST-1311305 (100, 100,
30) would then change. So both counts are read at the level of the request: no request is sent beyond the one that holds
the job's record. Taken.

TST-1271001 and 1271003 assert this. One batch holding the hundred newest is sent, and no record outside it is read.
TST-1271002 asserts that a file no job lists is looked for through all records, 100 at a time.

## Noted

MOD-job-ledger and MOD-runtimes were read in their interface parts. The change calls only `recordsNewestFirst`, so that is
enough.
