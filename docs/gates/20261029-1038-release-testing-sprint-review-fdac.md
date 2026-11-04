---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7f2213018b6eb57f4be3cc4bfb856dd64d8a392d
  - https://github.com/akmaier/agent-m/pull/1435
  - tests/release-itm-1269-job-page-reads-its-own-job.test.mjs
  - tests/release-itm-1276-test-history-ten-at-a-time.test.mjs
  - tests/release-itm-1284-issue-leads-open-own-use-cases.test.mjs
date: 2026-10-29 10:38 UTC
---
# Release testing → Sprint review: team 1's sprint 115

**REGISTER**

## Reason

The release tests of sprint 115's items pass on `sprint/team1/115` at `7f221301`, the head of #1435 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1269 | `tests/release-itm-1269-job-page-reads-its-own-job.test.mjs` | TST-1269301 to 304 | `5db0981a` (#1430) |
| ITM-1284 | `tests/release-itm-1284-issue-leads-open-own-use-cases.test.mjs` | TST-1284301 to 303 | `728f31c0` (#1431) |
| ITM-1276 | `tests/release-itm-1276-test-history-ten-at-a-time.test.mjs` | TST-1276301 to 304 | `fe6b697b` (#1434) |

   - **ITM-1295** changes a test and no behaviour, so it has no release test. That was ruled at its gate
     (`docs/gates/20261029-1018-development-release-testing-6307.md`), as for ITM-1296 in sprint 111.
2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/`, `index.html` and
   `docs/index.html` in `origin/main..7f221301`:
   - ITM-1269 `1f4befc5`: developer-opus-e;
   - ITM-1284 `b5e3a976`: developer-opus-f;
   - ITM-1276 `1f76b7ed`: developer-sonnet-j.
   - developer-sonnet-l has none. Its four commits in the range are the three release tests and `d6135684`, the edit of
     TST-1254302 ruled at ITM-1284's stop (`team1/115.md`).
3. **Green on the sprint branch.** Run 40858459294, `pull_request`, on `7f221301` passes 38 of 38 pull-request jobs. In
   its release jobs:
   - 1284: 3 pass (release shard 3);
   - 1269: 4 pass (release shard 5);
   - 1276: 4 pass (release shard 6).
   - 0 fail. All 11 cases pass.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `7f221301`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The three files give 4, 4 and 3 declarations, every case of the table, each of the level `release`, and 0 findings.

## The points put to this gate

1. **The repeated reads of a record within a page of a test's history: harmless, no defect.**
   - The release tests count the calls of the snapshot's `read`: 72 calls for 24 record files across three pages, all
     of files the page's batch holds.
   - A call is not a request. The host's snapshot keeps each text by its blob: `read(path)` asks the server only for a
     blob it holds no text of (`src/repository-hosts/index.mjs:298-305`). `readMany` fills that store first, so a
     repeated call of a batched file sends nothing.
   - A PAGE LOAD READS THE REPOSITORY IN BATCHES asks that "a file whose blob the page has read already is not read
     again" (SPEC.md:684-687). Read as requests, that holds: one history, one narrowed snapshot and one batch per page,
     as TST-1276301 and 302 count.
   - The calls come from `testHistory` and `historyLogLink`, each reading a commit's records through the same
     snapshot. No item is registered.
2. **TST-1284303 stands, as a check of the instance's own page.**
   - ITM-1284's Acceptance asks it of "a product's issue page". On the instance's own page, the issue route names no
     product. The page asks for a product to be chosen and draws no issue and no lead. So "the same holds" is read as
     "no lead exists there", and the case says so in its `expect:`.
   - The case has its known positive: the product's issue 5 offers the lead first.
   - The behaviour of ITM-1284 is guarded by TST-1284301 and 302. Each has its planted fault, the lead's `go` without the
     empty product.
   - The point says no planted fault is possible for 303. One is: the issue route drawing the first kept product's issue
     where the frame names none, which would offer a lead on the instance's page. It is not recorded in the case. That is
     no condition of this gate, which asks for authorship and green outcomes. Noted for the review.
