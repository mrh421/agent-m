---
id: ITM-730
title: A restructuring of the architecture reviewed as a whole
level: module
realises:
  - UC-023
  - AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
  - SEVERAL FILES ARE ACCEPTED IN ONE CLICK
modules:
  - MOD-review-pages
  - MOD-approvals
builds_on:
  - ITM-729
tests:
  - unit
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-730 A restructuring of the architecture reviewed as a whole

**REGISTER**

## Outcome

UC-023 step 5: a change that touches many files is accepted on the architecture's review page — "every changed file
with its difference and its impact list, every new file in full, every removed decision with its impact list, and
**Accept all N shown** for all of them in one commit". `decision/all` shows the changed files with their difference and
ITM-729's impact list, and the new ones in full (`showAll`, `src/review-pages/flow.mjs`); it shows no removed decision,
and MOD-approvals provides no `removedFiles`.

This item builds, as MOD-review-pages.md:217-220 and MOD-approvals.md:115-118 and :129-130 state them:
- MOD-approvals' `removedFiles(snapshot)`: every decision or module file that a record names, of whose identifier the
  snapshot holds no file, and whose removal no record accepts;
- on `decision/all`, each such file with its impact list (`architectureImpact` with `after: null`) and the empty text as
  the text shown, so that *Accept all N shown* counts it;
- in `acceptShown`, a shown file with the empty text's blob recorded as a removal while the head holds no file of its
  identifier, and left out as "changed since shown" when it holds one.

## The reading of the accepted text

- `removedFiles` gives `{ id, kind }`; the path and the last accepted text are those `lastAcceptedText` gives for the
  identifier (MOD-approvals.md:115-118, accepted in `77495fd0f`). So the page calls `lastAcceptedText` for each removed
  file, which it already uses for a changed one, and needs no record chronology of its own.
- The record of a removal names the path `lastAcceptedText` gives as its `file`, and the empty text's blob.

## Acceptance

- In a small DOM with a fixture snapshot holding a changed decision, a new module file and a removed module file: each
  changed and removed file with its impact list, the new file in full, and one commit with one record per file shown, the
  removed one's naming the empty text's blob. Counter-proof: on the code as it stands, the removed file is not shown.
- A unit case of `removedFiles`: a removed file is named, a held one is not, and one whose removal a record accepts is not.
- A unit case of `acceptShown`: a shown removal is recorded while the head holds no file of its identifier, and left out as
  "changed since shown" when it holds one.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The planning run (sprint team1/125).** A stand-in on `main` at `785019f50` builds the three parts above.
- 193 test files that name MOD-approvals, MOD-review-pages, `acceptShown`, `removedFiles` or their folders: no case fails
  only with it. The checks that need a checkout (`test_artifact_format`, `test_no_backend`, `test_pages_layout`,
  `test_release_sprint_02_d`, `test_self_sufficient`) and `trace-graph-import-uses` pass with it.
- Reads: `removedFiles` reads no record's text. Where nothing is removed, as on `main` today, the page reads as before;
  each removed file adds one `lastAcceptedText`.
