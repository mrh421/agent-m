---
id: ITM-1314
title: A file put back after its accepted removal has the empty text as its last accepted text
level: module
realises:
  - A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
  - A REJECTION REMOVES THE PROPOSAL
  - UC-023
modules:
  - MOD-approvals
builds_on:
  - ITM-730
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-730 (PR #1503), docs/gates/20261030-0625-development-release-testing-d730.md, point 5; the close of sprint team1/125, feedback
---
# ITM-1314 A file put back after its accepted removal has the empty text as its last accepted text

**REGISTER**

## Outcome

Since ITM-730, a decision or module file's removal can be accepted. The record then names the empty text's blob,
`e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` (MOD-approvals.md:129-130).

If a file of that identifier is put back later, the file is "changed": records name earlier texts, and none names the
current one.
- Its page and Review all show it against its last accepted text, through `lastAcceptedText`.
- *Reject* restores that text, also through `lastAcceptedText` (`rejectShown`, MOD-approvals.md:144-153).

`lastAcceptedText` reads the file at the commit that added the most recent record. A removal's record was added where no
file stands, so it finds none and throws `NotFound` (`src/approvals/status.mjs:193`, `then.blob(file) !== blob`). The file
can then be neither shown against its last accepted text nor rejected. That goes against A CHANGED FILE IS SHOWN AGAINST
ITS LAST ACCEPTED TEXT (SPEC.md:1179-1183) and A REJECTION REMOVES THE PROPOSAL.

`lastAcceptedText` gives "the text named by the most recent approval record of an identifier" (MOD-approvals.md:119-120).
A removal's record names the empty text. So where the most recent record names the empty text's blob,
`lastAcceptedText` gives `{ text: "", blob: <the empty text's blob>, path: <the record's file> }`, and reads no file.

## The reading of the accepted text

- The empty text is the text a removal's record names. `acceptShown` writes such a record for "a shown file with the
  empty text's blob", which "is a removal" (MOD-approvals.md:129-130). So it is the last accepted text, as any other
  record's text is.
- *Reject* of such a file makes "the file's text … the one `lastAcceptedText` gives" (MOD-approvals.md:147-148). For the
  empty text of a removal, that is the file removed again: what the default branch holds of a removed file is no file,
  and `removedFiles` then names no identifier (MOD-approvals.md:115-118). The item reads it so, and `rejectShown` deletes
  the file, as it does "when no record names one".

## Acceptance

- A unit case of `lastAcceptedText`:
  - over a host whose most recent record of an identifier names the empty text's blob, at a path where no file stood when
    it was added, it gives the empty text, that blob and the record's file, and reads no file;
  - known positive: an earlier record that names a text is still read as before.
  - Counter-proof: on the code as it stands, the same host gives `NotFound`.
- A unit case of `rejectShown`: a file put back after its accepted removal is rejected by one commit that deletes it.
- A unit case of the decision's page (MOD-review-pages, its test only): such a file is shown as changed, with its text
  against the empty text.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/approvals/` and the tests that name MOD-approvals change, with the one case of MOD-review-pages named above.
  The planning run names any other test before selection: it names none.

**The planning run (sprint team1/126).** A stand-in on `main` at `02fb1fe16`:
- `lastAcceptedText` gives `{ text: "", blob, path: file }` where the most recent record names `EMPTY_BLOB`, before it
  reads the repository at that record's commit.
- `rejectShown` deletes the file where the last accepted text is the empty text's, as where no record names one.
- 452 test files that name MOD-approvals, its folder, `lastAcceptedText`, `rejectShown`, `commitRejection`,
  `load-per-view`, or a module that imports MOD-approvals or its folder: MOD-review-pages, MOD-workflow-entries,
  MOD-desktop-shell, MOD-implementation-pages, MOD-progress-measures, MOD-prompt-bar, MOD-release-evidence,
  MOD-spec-changes, MOD-test-pages, MOD-trace-pages and MOD-work-plans. No case fails only with it.
  `trace-graph-import-uses` passes with it.
- Reads, over a counting fake host with a module accepted, removed with an accepted removal, and put back:
  - the put-back file: six calls and `NotFound` on `main`, five and the empty text with it — the snapshot at the removal
    record's commit is no longer read;
  - known positive, a module accepted and then changed: the same six calls and the same text on both.
  - `rejectShown` of the put-back file: on `main` `NotFound` and no commit; with it one commit that deletes the file.
