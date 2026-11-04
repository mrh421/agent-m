---
id: ITM-1398
title: A save after a refusal compares with the newer version
level: module
realises:
  - UC-018
  - A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
modules:
  - MOD-review-pages
builds_on:
  - ITM-376
tests:
  - unit
origin:
  - UC018-F2, TST-376217 of ITM-376's system tests of UC-018 (#1682), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1637-development-release-testing-0376.md)
---
# ITM-1398 A save after a refusal compares with the newer version

**REGISTER**

## Outcome

UC-018 5a: after a refused save, "the author merges by hand and presses *Save* again; the comparison is now against the
newer SHA". The editors keep the blob they were first opened on (`src/review-pages/edit.mjs:64`, `file-edit.mjs:143`,
`openedBlob`). So the save of the merged text is refused again and writes nothing.

## The reading taken

MOD-review-pages' editors save "only on the blob the file or section was opened on". The newer version a refusal shows
beside the edit is the text the author now edits against, so after a refusal the editor holds that version's blob.

## Acceptance

- After a refused save, the merged text is saved against the newer version and written once. Counter-proof: a further
  change on the default branch after the refusal refuses it again.
- TST-376217 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
