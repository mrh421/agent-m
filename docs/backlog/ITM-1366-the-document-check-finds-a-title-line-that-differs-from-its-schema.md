---
id: ITM-1366
title: The document check finds a title line that differs from its schema
level: module
realises:
  - EVERY ARTIFACT HAS AN IDENTIFIER
  - UC-004
modules:
  - MOD-documents
  - MOD-site-frame
builds_on:
  - ITM-1363
tests:
  - unit
origin:
  - developer-opus-f's probe of ITM-1363 (#1648), ruled by the Product Owner of team1's sprint 141
---
# ITM-1366 The document check finds a title line that differs from its schema

**REGISTER**

## Outcome

MOD-documents' `documentFindings` gives "every finding the schema can decide", the title among them
(MOD-documents.md:276-284), against the schema's `title` pattern, for example `# {id} {title}` (MOD-documents.md:70).
`src/documents/checks.mjs:16-18` states that the title is "not checked yet". So a source entry whose title line is a bare `#` has
no finding.

## What the probe found, and the readings taken

The probe ran 890 files with the check built.
- **Forms.** 11 test files move, none of MOD-documents: a form opened on a title line that does not match its `id` and
  `title` fields shows a title finding the person cannot fix (*+ Item*, the move form, *+ Register source*). MOD-site-frame's
  `schemaForm` shows "the findings of `documentFindings` … while typing", and checks "a document given without the
  identifier its schema names … at the path the identifier typed gives it" (MOD-site-frame.md:271-277): it checks the
  document its typed fields make. The title line is made of fields by the schema's `title` pattern, so `schemaForm` writes
  it from the pattern and the fields before it checks and hands the document over. That is one place for every form, and
  no caller changes. The item names MOD-site-frame for it.
- **ITM-1165** is a backlog item, a register: its title line follows its front matter's `title` under this item.
- **UC-012** reads `# UC-012 Handle an issue: bug fix or specification change` under the front matter title "Handle an issue
  — bug fix or specification change" (`docs/use-cases/UC-012-*.md:3`, `:24`). It is an accepted use case: which of the two
  holds is akmaier's, and any change of it is a use-case change.

## Not ready — for akmaier

The check would fail `tests/test_usecase_fields.py` on UC-012 until one of its two titles changes. The question for akmaier:
UC-012's title is "Handle an issue — bug fix or specification change" or "Handle an issue: bug fix or specification change".
Everything else of this item can be built as it stands.

## Acceptance

- `documentFindings` reports a document whose title line does not fit its schema's `title` pattern, or that lacks the
  title line the pattern asks for, as an error at the title's line, naming the rule of the part of the schema closest to
  it. A title line that fits gives no finding, and a schema without `title` gives none.
- Before the job starts, its probe runs the existing tests that read the repository's documents through
  `documentFindings`, and names every document that would gain a finding. One whose fix the accepted texts allow is fixed
  under this item; any other stops the item for the Product Owner.
- `schemaForm` hands over, and checks, the document with its title line made from the schema's `title` pattern and the
  fields; the 11 test files the probe named do not move.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
