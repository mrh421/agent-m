---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - bf0c80f8a805d449b7b510a9aaf590b8b5386e9c
  - https://github.com/akmaier/agent-m/pull/1770
date: 2026-11-03 13:01 UTC
---
# Development → Release testing: ITM-1406, #1770

**REGISTER**

## Reason

ITM-1406 (a retrospective's process change is a SPEC queue entry) may go on. The pull request is #1770 into
`sprint/team1/144`, at `bf0c80f8a`, and the trailers name each commit's writer:
- developer-opus-e wrote the tests-only commits `79e7d7aaa`, `173f05b3a` (both taken over from #1760) and `06cff48b1`, and
  the code `ffea87631` and `6745de807`;
- developer-sonnet-l wrote `efcd781cb` and `bf0c80f8a`, after the code.

I wrote none of it.
1. **The first commits hold only tests and are red for the item's reason.** Run 41637191415 fails only TST-1406001 and
   1406002 (`work-plans-sprint-record-writer`), TST-1406003 (`spec-changes-propose-section`) and the moved TST-991209
   (`system-uc-041-close-a-sprint`). The other files fail only their `todo` findings.
2. **CI is green on the head:** run 41639932161 (`bf0c80f8a`), at attempt 1. Run 41638404731 on the code `6745de807` was
   red only in TST-991406, which sonnet-l then moved. `git merge-tree` with the sprint branch's head `683325060` is clean.
3. **Only the item's modules change:** `src/spec-changes/accept.mjs` and `propose.mjs` (MOD-spec-changes), and
   `src/work-plans/saves.mjs` and `strategies.mjs` (MOD-work-plans), plus tests and the UC-041 harness.
   - **The trace graph.** Before, `proposeSection` → `impactOf` (`accept.mjs:83-84`) → `storedGraph`
     (`build.mjs:201-206`) threw `GraphNotStored`. Now `proposeSection` alone has `impactOf` build the graph through
     `traceGraph` where none is stored. TST-1406003 shows the same impact list as from a stored graph.
   - **The close.** Before, `closeSprint` wrote changes only as lines of the record (UC041-F4). Now `closeSprint` →
     `proposeChanges` → `proposeSection` writes one entry per governing section, each change appended as a new
     requirement in the section found by the governing requirement's name.

   This is what the accepted texts give (MOD-spec-changes `7fd421d35da4`, MOD-work-plans `70bc6a3da70e`).
4. **The new tests name their requirements and modules.** The pull request records six counter-proofs.
5. **The Acceptance holds:**
   - Each change of the process is an open entry, and the model, the Definition of Done, the participants and the job
     definitions stay byte-identical.
   - **TST-991306 loses its `todo`.** With the `todo` stripped, it fails at `06cff48b1` and passes at `6745de807`. sonnet-l,
     who built none of it, lifted it.
   - **TST-991406 follows the SPEC rule's check and the accepted `closeSprint` text.** The record stands alone in the first
     commit, everything but the record and `docs/spec-freigaben/` stays byte-identical, and every entry is open. It fails
     at `06cff48b1` and passes at `6745de807`. sonnet-l moved it after the code.
   - The release files changed only by sonnet-l's commits.

opus-e and sonnet-l read the binding documents and the chapters in full, and both modules at their accepted blobs.

## Ruled

- **opus-e's readings stand:**
  - the instance's host comes from `closeSprint`'s context;
  - an entry's person is the record's closer;
  - one entry is written per section;
  - the result gains `entries` and `notes` only when a change goes to the process.
- **MOD-text-tools' `blobSha`.** MOD-work-plans' Uses already name MOD-text-tools, and Uses are read at module level
  (TST-106805), so this is not a gap.
- **`closeSprint`'s interface names no instance host and no entries.** Both are an extension that keeps every existing
  field (`OPEN FOR EXTENSION, CLOSED FOR CHANGE`). They are noted for the next module-text draft and not registered now.
