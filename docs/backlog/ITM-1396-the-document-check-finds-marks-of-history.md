---
id: ITM-1396
title: The document check finds marks of history
level: module
realises:
  - A DOCUMENT HOLDS NO HISTORY
  - UC-022
modules:
  - MOD-documents
builds_on:
  - ITM-448
tests:
  - unit
origin:
  - F6, TST-448328 of ITM-448's release tests of UC-022 (#1683), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1633-development-release-testing-0448.md)
---
# ITM-1396 The document check finds marks of history

**REGISTER**

## Outcome

MOD-documents' `documentFindings` gives, "for a `noHistory` schema, each mark of history", through MOD-text-tools'
`historyMarks`, which its Uses name. `src/documents/checks.mjs` never calls `historyMarks`, and its head comment lists "the
marks of history" as not checked yet. `noHistory` is read only by the schema language (`schema-language.mjs:41,441`). So an
architecture decision with "Changed on …" passes the check.

## Acceptance

- `documentFindings` reports, as an error under `A DOCUMENT HOLDS NO HISTORY`, each mark of history in a document whose
  schema names `noHistory`. A document without one gives none.
- Before the job starts, its probe runs the existing tests that read the repository's documents through
  `documentFindings` and names every document that would gain a finding. One whose fix the accepted texts allow is fixed
  under this item. An accepted use case or architecture file that would change stops the item for the Product Owner.
- TST-448328 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
