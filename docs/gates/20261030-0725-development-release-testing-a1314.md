---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ca9e9b6f973429d230360be16ed97514ea03f8e0
  - https://github.com/akmaier/agent-m/pull/1508
date: 2026-10-30 07:25 UTC
---
# Development → Release testing: ITM-1314, a file put back after its accepted removal has the empty text as its last accepted text

**REGISTER**

## Reason

ITM-1314, pull request #1508 into `sprint/team1/126`, passes on `ca9e9b6f`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `994843d3`:** run 41018620661 (`pull_request`) fails only in jobs 123940608720 and 123940608881.
     In those jobs the only failures are the item's two new files, on TST-1314001 to TST-1314003. Each fails with
     `NotFound: … did not hold the text docs/approvals/…-e69de29bb2d1.md names when the record was added`.
     - That is the item's reason: on the code as it stood, `lastAcceptedText` reads the file at the removal record's
       commit, where none stands (`src/approvals/status.mjs:193` of the base).
   - **Head `ca9e9b6f`:** run 41019343233 (`pull_request`) succeeds: 41 jobs succeed, 17 are skipped, none failed.
2. **Only the item's files change.**
   - MOD-approvals: `status.mjs` gains one branch in `lastAcceptedText`, and `reject.mjs` one condition in `rejectShown`
     and the import of `EMPTY_BLOB` from `status.mjs`, as `accept.mjs` takes it.
   - Two new test files. Their headers name MOD-approvals and MOD-review-pages, one module per line. The case of
     MOD-review-pages is the one the Acceptance names.
   - No existing test changes. No top-level await is added: `EMPTY_BLOB` stays the literal constant.
3. **It builds the accepted text and the item's Acceptance.**
   - Where the most recent record of an identifier names the empty text's blob, `lastAcceptedText` gives
     `{ text: "", blob: EMPTY_BLOB, path: <the record's file> }` and reads no file (TST-1314001). That is "the text named by
     the most recent approval record of an identifier" (MOD-approvals.md:119-120), for a removal's record, which names the
     empty text (:129-130). Its types and errors are unchanged.
   - `rejectShown` of such a file is one commit whose one file is `{ path, delete: true }`, the reason in its message
     (TST-1314002).
   - The decision's page shows such a file as changed, every line of its text added against the empty text, with no
     problem in its difference section (TST-1314003).
   - Each case asserts its known positive: MOD-kept, a module accepted and then changed, is read and restored as before.
4. **The pull request's reading is the item's own, and holds.** The empty text of an accepted removal is no file on the
   default branch, so *Reject* deletes the file rather than writing an empty one. `acceptShown` takes that text as a
   removal (MOD-approvals.md:129-130), and `removedFiles` then names no identifier (:115-118).
5. **Counter-proofs.**
   - The counter-proof the Acceptance names, NotFound on the code as it stands, is the tests-only run at point 1. It is
     recorded in the pull request.
   - Planted on the head and restored after:
     - `rejectShown` writing the empty text instead of deleting fails TST-1314002;
     - `lastAcceptedText` giving the empty text for every record fails TST-1314001 and TST-1314002 on their known
       positive.
   - Restored: 33 of 33 pass in the two new files, `approvals-last-accepted`, `review-core.d/review-pages-reject`,
     `workflow-entries-main-changed`, `test-document-one-line` and `trace-graph-import-uses` (TST-106805), on Node 26.
6. **MOD-test-document's reader:**
   - `tests/approvals-put-back-after-removal.test.mjs`: 2 declarations, 0 findings. The header gives MOD-approvals,
     level `unit`, and no finding.
   - `tests/review-pages-put-back-after-removal.test.mjs`: 1 declaration, 0 findings. The header gives MOD-review-pages,
     level `unit`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each value stands on one line, and each declared known positive is asserted in its case.
7. **Reads, against the planning count** (`team1/126.md`): TST-1314001 asserts five calls for the put-back file and no
   snapshot of another ref, and six for the known positive, the snapshot at the record's commit and the file among them.
   That is the count the planning's stand-in gave.
8. **The developer's run:** 417 files, the tests of every module that imports MOD-approvals, on Node 22 and Node 26. Its
   13 failing files fail alike on an export of the sprint branch at `7edde6e93`. My planning run of a stand-in, over 452
   files, found no case that fails only with it.

## Noted

- The pull request's description names no `JOB-` identifier.
