---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d32b67d7c8aadda322c5962dd8e7a5b6e7721d14
  - https://github.com/akmaier/agent-m/pull/1453
date: 2026-10-29 14:06 UTC
---
# Development → Release testing: ITM-1311, the review pages leave the batch of job records to listJobs

**REGISTER**

## Reason

ITM-1311, pull request #1453 into `sprint/team1/118`, passes on `d32b67d7`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **The first commit holds only the tests, and CI is red on it for the item's reason.**
   - `86512143` changes only `tests/review-pages-use-cases.test.mjs`.
   - Run 40886322834, `pull_request`, on `86512143` fails in one job, `unit-pull-request (10)`. I read its log: the only
     failing case is TST-680211, with "one batch", actual 2 and expected 1. The `TST316-counterproof` lines in the same
     log are the planted faults of a passing test.
2. **CI is green on the head.** Run 40886599962, `pull_request`, on `d32b67d7` succeeds: 41 jobs pass and 17 are
   skipped.
3. **Only the item's modules change:** `src/review-pages/common.mjs`, `flow.mjs` and `jobs.mjs`, and
   `tests/review-pages-use-cases.test.mjs`, whose TST-680211 names MOD-review-pages. No test of another module changes,
   and no test is removed.
4. **The Acceptance holds.**
   - TST-680211 counts exactly one call of `readMany`, naming every job record and nothing else. Its `expect:` says so,
     in the tests-only commit. The accepted use case's page still asks for none.
   - A search of `src/` and `tests/` for `readJobRecords` finds nothing on `d32b67d7`. On `sprint/team1/118` it finds 5
     lines, in `common.mjs`, `flow.mjs` and `jobs.mjs`; that is the known positive.
   - The guard holds against reading the records one by one: that gives no batch, and the case asserts exactly one.
5. **The failure path, read by me on `sprint/team1/118`:** `flow.mjs:561` calls `jobNotes`, at `jobs.mjs:232`. Its
   `readJobRecords` (`:233`) calls `readMany` once. `listJobs` (`:234`) calls it again at `src/job-ledger/index.mjs:428`.
   On the head, only the second call remains. `draftingRounds` (`flow.mjs:104-107`) loses the same first call.
6. **The tests, run by me on `d32b67d7`.** I ran the set that planning ran: every test that names MOD-review-pages,
   MOD-site-frame, one of the three changed files or `readMany`, 242 files. Four mailbox files that hang on this machine
   were left out, as at planning (`docs/backlog/sprints/team1/118.md`).
   - 2,195 cases pass and 4 fail, with 12 todo. The 4 failures are TST-1281004 and TST-1306307 to 309, the Bridge and
     Electron cases that fail here without the change too.
   - That is the result planning found with the change applied.
   - `tests/test-document-one-line.test.mjs` and `tests/review-pages-use-cases.test.mjs`: 22 pass.
7. **The reader.** On `d32b67d7`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `review-pages-use-cases`: 20 declarations and 0 findings.
8. **The pull request's description** quotes no `JOB-` identifier.

## Noted

- ITM-1311 changes how many requests a page sends, not what it shows. developer-sonnet-l writes its release tests, as
  the sprint's selection says of each item that changes behaviour.
