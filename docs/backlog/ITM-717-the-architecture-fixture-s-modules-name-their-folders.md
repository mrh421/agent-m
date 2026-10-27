---
id: ITM-717
title: The architecture fixture's modules name their folders
level: unit
realises:
  - A MODULE IS A FOLDER
modules:
  - MOD-documents
builds_on:
tests:
  - unit
origin:
  - ITM-714's stop (sprint team1/73), from developer-sonnet-c's probe
built_by:
  - 955289160085ef90eba2a98e572ea6869d52e4e2
---
# ITM-717 The architecture fixture's modules name their folders

**REGISTER**

## Outcome

The module files of the shared fixture `tests/fixtures/architecture/` have no `folder:` field. The module schema
requires it: `src/documents/schemas/module.schema.md:13` reads `"folder": { "type": "path", "required": true, "rule": "A
MODULE IS A FOLDER" }`. MOD-trace-graph's `architectureImpact` therefore finds no code file of any module on this
fixture.

The fixture is used by:
- `architecture-format`, `architecture`, `load-per-view`, `review-page-core` and `review-page`;
- `review-core.d/dashboard-writes`;
- `test_architecture_files`, `test_coverage_report`, `test_impact_list` and `test_matrix_derived`.

At the start, each user is read for what a `folder:` field would change. The modules whose tests change are named
(sprint 65's agreement). A user that belongs to no module waits for the job that moves it (sprint 72's agreement).

## Acceptance

- Every module file of the fixture names its folder, and MOD-documents' schema check gives it no finding.
- Every user keeps its expected results, or each changed one is named at the start.
