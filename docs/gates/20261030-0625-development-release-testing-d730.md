---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 03326195d15e9acbe0d312d44a1f2c232e0e3d2a
  - https://github.com/akmaier/agent-m/pull/1503
date: 2026-10-30 06:25 UTC
---
# Development → Release testing: ITM-730, the architecture's Review all shows and accepts a removed decision or module

**REGISTER**

## Reason

ITM-730, pull request #1503 into `sprint/team1/125`, passes on `03326195`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `c5722793`:** run 41011032707 fails only in the item's two new files, on TST-730001 to TST-730005.
     That is the item's reason: MOD-approvals provides no `removedFiles`, `acceptShown` records no removal, and Review all
     shows no removed file.
   - **Implementation commit `09df957e`:** run 41011330426 fails only in `tests/maintenance-pages-fix-583.test.mjs` and
     `tests/system-uc-012-fix-a-bug.test.mjs`, with "Cannot access 'specStrategies' before initialization".
     - The commit wrote `EMPTY_BLOB = await blobSha("")` at the top of `src/approvals/status.mjs`. That is a second
       asynchronous module in the cycle of `src/approvals/index.mjs` and `status.mjs`, which changed the order in which
       Node 22 evaluates the modules that import them.
     - It does not show on Node 26, which this machine runs.
   - **Head `03326195`** changes only that line, to the constant `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`. On the head,
     `blobSha("")` gives the same value. Run 41012210544 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are
     skipped. That confirms the cause.
2. **Only the item's files change.**
   - MOD-approvals:
     - `status.mjs`: `removedFiles`, the constant, and one private function, `recordsById`, that `statuses` and
       `removedFiles` share;
     - `accept.mjs`: the removal branch of `acceptShown`;
     - `index.mjs`: the export.
   - MOD-review-pages:
     - `flow.mjs`: the removed files on the architecture's Review all;
     - `sections.mjs`: a removal's impact list with its code files and tests in one line each.
     `sections.mjs` was not in the planning's list of files. It lies in MOD-review-pages' folder, so it is a file of the
     item's modules (SPEC.md:1478-1482).
   - The two new test files, whose headers name MOD-approvals and MOD-review-pages. No existing test changes.
3. **It builds the accepted texts and the item's Acceptance.**
   - `removedFiles(snapshot) -> Array<{ id, kind }>`, as MOD-approvals.md:115-118 states it. It names every decision or
     module file a record names, of whose identifier the snapshot holds no file, and whose removal no record accepts. It
     returns them in the order of the identifiers and reads no record's text (TST-730001).
   - `acceptShown` records a shown file with the empty text's blob while the head holds no file of its identifier
     (TST-730002). It leaves the file out as "changed since shown" when the head holds one, also under a new name
     (TST-730003), as MOD-approvals.md:129-130 states it. Its types and errors are unchanged.
   - On `decision/all`, each removed file is drawn with its last accepted text against the empty text and its impact list
     (`architectureImpact` with `after: null`). It is counted in *Accept all N shown*, and its removal is recorded in the
     same commit (TST-730004), as MOD-review-pages.md:217-220 states it.
   - The Acceptance's fixture is TST-730004: a changed decision, a new module file and a removed module file.
4. **The pull request's readings are right.**
   - **The path comes from `lastAcceptedText`.** That is the accepted text, accepted by akmaier in `77495fd0f`.
   - **One private pass is shared by `statuses` and `removedFiles`.** "It is computed in the same pass over
     `docs/approvals/` as `statuses`" (MOD-approvals.md:117-118) is read as the same procedure over the records' names.
     Each call makes it once. No record's text is read, and no request is made.
   - **The empty text is the text shown**, word for word MOD-review-pages.md:218-219.
   - **A removal's impact list names its code files and tests in one line each.** A removed module has no node of its own
     in the graph of the snapshot shown, so it has no folder there. The list still names the module and its code file
     (TST-730004: MOD-shelf and `src/shelf/index.mjs`).
   - **Only the architecture's Review all lists removed files** (`kind.whole`), as MOD-review-pages.md:216-219 says "For
     the architecture".
   - **The badge "removed since acceptance" has no colour rule.** Its state stands in its text, so THE SITE SERVES A SCREEN
     READER ("no status is given by colour alone", SPEC.md:967-972) holds. That a colour is missing is no rule broken.
5. **The two gaps the developer left out.**
   - **A file whose removal was accepted and which is later put back.**
     - The most recent record then names the empty text. `lastAcceptedText` reads the file at the commit that added that
       record, finds no file there, and throws `NotFound` (`src/approvals/status.mjs:193`). That code is unchanged by the
       item.
     - The file is then "changed". Its page and its Review all could not show it against its last accepted text, and
       Reject could not restore that text. That goes against A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
       (SPEC.md:1179-1183) and A REJECTION REMOVES THE PROPOSAL.
     - The path opens only once a removal can be accepted, which this item makes possible. Neither the item's Outcome nor
       its Acceptance names it, and the Definition of Done holds without it. **It does not hold this gate.**
     - It is a defect in a path this increment opens, so it is no YAGNI either. It goes into the close's feedback as a new
       item: `lastAcceptedText` gives the empty text, its blob and the path, for an identifier whose most recent record
       names the empty text's blob.
   - **The list page's "Review all N not accepted" leaves removed files out.**
     - MOD-review-pages states no count on that link, so no sentence is broken.
     - The link is drawn whatever the count, so a removal is still reached.
     - The count can read 0 while a removal waits. That is for the close's feedback, as a note, not a defect.
6. **Counter-proofs, made on the head and restored after.**
   - `removedFiles` ignoring a record of the removal fails TST-730001 and TST-730004.
   - `acceptShown` recording a removal although the head holds the file fails TST-730003.
   - Review all listing no removed file fails TST-730004 and TST-730005; the latter's known positive is TST-730004's page.
   - Restored, 5 of 5. The tests-only run is the code as it stood.
7. **MOD-test-document's reader:**
   - `tests/approvals-removed-files.test.mjs`: 3 declarations, 0 findings. The header gives MOD-approvals, level `unit`,
     and no finding.
   - `tests/review-pages-removed-files.test.mjs`: 2 declarations, 0 findings. The header gives MOD-review-pages, level
     `unit`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each value stands on one line. The `given`, `input` and `expect` of TST-730001 to TST-730005, as the reader reads them,
     are those of the two files' declarations. Each names its known positive and asserts it.
8. **Locally on the head,** Node 26: the two new files, `maintenance-pages-fix-583`, `system-uc-012-fix-a-bug` and
   `tests/test-document-one-line.test.mjs` give 16 pass, 0 fail. My planning run of a stand-in of the item, over 193
   files, found no case that fails only with it.
9. **Reads, against the planning count.**
   - Where nothing is removed, the page reads no last accepted text it did not read before (TST-730005: no `readHistory`
     of MOD-shelf's record).
   - Each removed file adds one `lastAcceptedText` (TST-730004: one `readHistory` of its one record).
   - `removedFiles` reads no record's text.

## Noted

- The cause of the red implementation run showed on CI's Node 22 and not on this machine's Node 26. A top-level await in a
  module of an import cycle changes the evaluation order on Node 22. For the close's feedback.
- The new item for the restored file (point 5) is for the close to register. It realises A CHANGED FILE IS SHOWN AGAINST
  ITS LAST ACCEPTED TEXT, and names MOD-approvals.
- The pull request's description names the tests-only run alone. The runs are those above.
