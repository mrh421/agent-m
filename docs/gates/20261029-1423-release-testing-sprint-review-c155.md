---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 73f74dad7631c68bc9a14fce3c79c45f072c3ec5
  - https://github.com/akmaier/agent-m/pull/1456
  - tests/release-itm-1311-job-record-batch.test.mjs
date: 2026-10-29 14:23 UTC
---
# Release testing → Sprint review: team 1's sprint 118

**REGISTER**

## Reason

The release tests of sprint 118's items pass on `sprint/team1/118` at `73f74dad`, the head of #1456 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1311 | `tests/release-itm-1311-job-record-batch.test.mjs` | TST-1311301 to 305 | `0561f4cb` (#1455) |

   - **ITM-1308 and ITM-1310** change a test and a style, and no behaviour, so they have no release test. Their gates
     say so: `docs/gates/20261029-1359-development-release-testing-d0fb.md` and `-1403-…-6fac.md`.
   - **ITM-1181** is withdrawn and left the selection (`docs/backlog/sprints/team1/118.md`, "ITM-1181's stop").
2. **The writer built none of the behaviour.** These are the trailers of every commit in `origin/main..73f74dad`, merges
   aside:
   - ITM-1311 `86512143` and `d32b67d7`: developer-opus-f;
   - ITM-1310 `9d1f7b43`: developer-opus-e;
   - ITM-1308 `fc87e8b7`: developer-sonnet-k.
   - developer-sonnet-l has one commit, `0561f4cb`, which adds only the release test.
3. **Green on the sprint branch.** Run 40890119130, `pull_request`, on `73f74dad` succeeds: 41 jobs pass and 17 are
   skipped. In `release-pull-request (7)`, the file gives 5 pass, 0 fail and 0 skipped.
4. **Run by me on `73f74dad`:** the release test, `test-document-one-line`, `review-pages-use-cases` and
   `maintenance-pages-move-1250` give 33 pass and 0 fail.
5. **A planted fault, run by me.** I took out the `readMany` call of `listJobs` (`src/job-ledger/index.mjs:428`), the
   fault TST-1311301 names.
   - TST-1311301, 303, 304 and 305 fail, and 302, which checks the notes shown, passes.
   - Restored, all 5 pass.
6. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `73f74dad`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The release test gives 5 declarations, every case of the table, each of the level `release`, and 0 findings.

## The readings of the release tests

1. **The cases would also pass before ITM-1311, and that is enough for this gate.**
   - On the real host, the second `readMany` call sent nothing. The host asks only for blobs it does not hold
     (`src/repository-hosts/index.mjs:267-274`), as ITM-1280's stop recorded.
   - A release test checks the behaviour the SPEC states from outside: the requests that leave the page (A PAGE LOAD READS
     THE REPOSITORY IN BATCHES). The behaviour seen from outside did not change; ITM-1311 removed a second copy of a rule
     inside MOD-review-pages.
   - The cases still fail on a fault that breaks the batch (point 5), so they guard the requirement.
   - The count of calls, which is what the item changed, stays guarded by the unit test TST-680211. Its tests-only commit
     was red on it, with 2 calls where 1 was expected (run 40886322834).
2. **"The notes shown are unchanged" is read as the notes of the jobs that name the file, newest job first,** as the
   file's header states. That is what `jobNotes` gives (`src/review-pages/jobs.mjs`). No item.
