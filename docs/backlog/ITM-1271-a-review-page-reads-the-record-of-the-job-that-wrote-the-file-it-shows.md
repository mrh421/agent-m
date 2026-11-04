---
id: ITM-1271
title: A review page reads the record of the job that wrote the file it shows
level: module
realises:
  - UC-007
  - UC-022
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-review-pages
builds_on: []
tests:
  - component
origin:
  - akmaier, 2026-10-28: "It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1271 A review page reads the record of the job that wrote the file it shows

**REGISTER**

## Outcome

MOD-review-pages shows, "beside an open file a job wrote, the notes of that job's end record" (UC-007 4a, 4b), and on
*Review all* of the architecture the rounds of the drafting job. To find them it reads every job record:

- `jobNotes` (`src/review-pages/jobs.mjs:232-236`, called at `src/review-pages/flow.mjs:561` for every open use case or
  decision shown): `readJobRecords(snapshot)` and `listJobs` over all of `docs/jobs/` — 478 records, ~7 MB, 5 batches at
  Agent M's head —, then keeps the `note:` lines that name the file's identifier.
- `draftingRounds` (`flow.mjs:104-113`): the same reading, then the first row of kind architecture with an end.

## The reading taken

MOD-review-pages gives the way to find the job: "MOD-job-ledger.recordsNewestFirst — the record of the job that drafted a
file, with its rounds, read newest first and no further than that record" (MOD-review-pages.md:360-361). `readHistory` is
given "on `<k>/history` only" (:305), so `jobNotes` does not use it.

After the change: `jobNotes` reads the records through `recordsNewestFirst`, newest first, and stops at the first record
whose job wrote the file shown; `draftingRounds` stops at the first architecture job with an end. A file no job wrote is
looked for through all records, as the text gives it.

Design principles (AGENTS.md §2 *Designing*): §2.2 *nothing twice* — the module reads the records through the one reader
MOD-job-ledger provides for this, instead of listing every record itself.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/review-pages-job-notes-one-record.test.mjs` (MOD-review-pages, component), over a counting fake with 300 job
  records: an open use case written by the third-newest job shows that job's notes and reads no record older than it.
  `#review/arc` with an architecture job among the ten newest reads at most ten records. Counter-proof: a note of an
  older job naming the same use case is not shown, and the code before the change reads all 300.

Measurable outcome: opening an open use case or decision written by a recent job reads the records down to that job,
instead of 478 records in 5 batches (~7 MB).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/review-pages/` and the tests that name MOD-review-pages change.
