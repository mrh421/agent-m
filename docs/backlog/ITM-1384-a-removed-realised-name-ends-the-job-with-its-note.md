---
id: ITM-1384
title: A removed realised name ends the job with its note
level: module
realises:
  - UC-007
  - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
modules:
  - MOD-artifact-edits
  - MOD-job-ledger
builds_on:
  - ITM-580
tests:
  - unit
origin:
  - finding UC007-F1 of ITM-580's system test TST-580209 (#1672), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1459-development-release-testing-0580.md)
---
# ITM-1384 A removed realised name ends the job with its note

**REGISTER**

## Outcome

UC-007 4a: a name a drafted use case realises that matches no requirement is removed, and "the outcome's notes name the use
case and the name" (MOD-artifact-edits.md:136-138). The writer `open-files` gives the note
`UC-002 realised "X", which matches no requirement; removed` (`src/artifact-edits/strategies.mjs:151`), which goes into the
job's `## End` as a result (`src/runtimes/tab.mjs:106`; on CI `src/workflow-entries/product.mjs:120`). `writeDocument`
refuses a list item with a comma (`src/documents/checks.mjs:80-81`). So the use case is committed, the job gets no
`## End`, and the page shows a `DocumentError`.

## Acceptance

- After a use case is written with a realised name removed, the job's record ends `done`, and the outcome's note names the
  use case and the name, as the page shows it.
- Before the job starts, its probe names where the note is to stand in the record by MOD-job-ledger's text (`## End`,
  MOD-job-ledger.md:98) and which of the two modules the change falls in; the item changes only that.
- TST-580209 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
