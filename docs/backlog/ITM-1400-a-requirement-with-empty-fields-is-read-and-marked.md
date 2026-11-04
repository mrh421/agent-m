---
id: ITM-1400
title: A requirement with empty fields is read and marked
level: module
realises:
  - UC-018
  - A REQUIREMENT HAS FOUR FIELDS
modules:
  - MOD-spec-document
builds_on:
  - ITM-376
tests:
  - unit
origin:
  - UC018-F4, TST-376222 of ITM-376's system tests of UC-018 (#1682), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1637-development-release-testing-0376.md)
---
# ITM-1400 A requirement with empty fields is read and marked

**REGISTER**

## Outcome

UC-018 3d: *+ Requirement* opens the editor with the four fields empty, and step 3 marks what is missing. MOD-spec-document's
`parseSpec` "never throws on content: a requirement missing a field is read with that field `null`, and
`requirementFindings` names it". A requirement whose name is empty (`****`), or that is a bare bold name, is not read at
all (`src/spec-document/parse.mjs:22,26`). So the fields `requirements/new` opens with get no mark. Known positive: a
requirement missing only its check is marked. Unit TST-472630 passes only because of its other fixture requirement.

## Acceptance

- A requirement with an empty name, or with a name and no other field, is read with its missing fields `null`. Every
  missing field is named by `requirementFindings`.
- TST-376222 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- Before the job starts, its probe runs the existing tests that read the repository's SPEC through `parseSpec` and names
  any change of what they read.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
