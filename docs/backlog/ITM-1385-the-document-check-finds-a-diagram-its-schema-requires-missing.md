---
id: ITM-1385
title: The document check finds a diagram its schema requires missing
level: module
realises:
  - DIAGRAMS ARE MERMAID IN MARKDOWN
  - UC-007
modules:
  - MOD-documents
  - MOD-review-pages
  - MOD-spec-changes
  - MOD-workflow-entries
  - MOD-runtimes
  - MOD-prompt-bar
  - MOD-artifact-edits
builds_on:
  - ITM-580
  - ITM-1386
tests:
  - unit
origin:
  - finding UC007-F2 of ITM-580's release test TST-580305 (#1672), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1459-development-release-testing-0580.md)
---
# ITM-1385 The document check finds a diagram its schema requires missing

**REGISTER**

## Outcome

MOD-documents' `documentFindings` gives "a diagram missing where `required`" (MOD-documents.md:276-284), and the use-case
schema requires one (MOD-documents.md:230-232). `src/documents/checks.mjs:16-17` states that "a Mermaid block missing where
`diagrams` is `required` or standing where it is `none`" is "not checked yet". So a drafted use case without Mermaid passes
the correction loop.

## What the probe found, and the reading taken

The probe (sprint 142) found no repository document that gains a finding: each of the 48 use cases holds a Mermaid block
(known positive: UC-007), and no file has a schema whose `diagrams` is `none`. In the tests, the drafted or edited use-case
fixtures of nine files hold no Mermaid block, so they fail with the check although no expected result moves: the unit
files of MOD-review-pages (`review-pages-draft-use-cases`, `review-pages-conversation-draft`), MOD-spec-changes
(`test_artifact_provenance.py`, `test_prompted_change_context.py`) and MOD-documents (`test_diagrams_are_mermaid.py`), and
the system and release files `system-uc-019`, `release-uc-007` (TST-580304) and `system-` and `release-uc-010`.
`test_release_sprint_02_d.py` ran 59 s and is unclear.

Reading taken (as ITM-1170 named the modules of the tests it moved): the item names the modules of those tests, for its
tests only, and changes no code of theirs. Their fixtures gain the diagram the accepted use-case schema already requires.
It starts once ITM-1386 has left MOD-review-pages.

## Acceptance

- `documentFindings` reports, as an error, a document whose schema names `diagrams: required` and that holds no Mermaid
  block, and one whose schema names `diagrams: none` and that holds one. A document that fits gives none.
- Before the job starts, its probe runs the existing tests that read the repository's documents through
  `documentFindings` and names every document that would gain a finding. One whose fix the accepted texts allow is fixed
  under this item; an accepted use case or architecture file that would change stops the item for the Product Owner.
- TST-580305 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- The tests-only commit gives each unit file's drafted or edited use-case fixture its Mermaid block, and holds the item's
  own red cases. The fixtures of the system and release files (`system-uc-019`, `release-uc-007`, `system-` and
  `release-uc-010`) are changed by a participant who built none of the behaviour they test, in a commit of their own, before
  the code. No fixture change moves an expected result; `test_release_sprint_02_d.py`'s outcome is read on CI.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
