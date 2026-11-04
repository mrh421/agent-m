---
id: ITM-1432
title: The audit's rows link their limitation, their log and their accepted text
level: module
realises:
  - UC-030
  - THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
modules:
  - MOD-trace-pages
builds_on:
  - ITM-775
tests:
  - unit
origin:
  - UC030-F2, F3 and F4, TST-775214, 775217 and 775205 of ITM-775's system tests of UC-030 (#1733), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1108-development-release-testing-0775.md)
---
# ITM-1432 The audit's rows link their limitation, their log and their accepted text

**REGISTER**

## Outcome

UC-030 has each row of the audit tell what a reviewer needs. MOD-trace-pages' audit view falls short in three places:
- **F2 (2b):** a recorded limitation is not linked to the rows of the failing tests it explains (TST-775214);
- **F3 (2d):** the view never asks for a run's log (`ciRunLog`), so a log the server dropped is not marked unavailable
  (TST-775217);
- **F4:** a row does not name the blob SHA of the accepted text, which only the export holds (TST-775205).

## Acceptance

- A failing test's row links the limitation the release test report records for it.
- A row whose run's log can no longer be read marks it unavailable, while its outcome still comes from the result records.
- Each row names the blob SHA of the accepted text it rests on, as the export does.
- TST-775214, 775217 and 775205 lose their `todo` in a commit by a participant other than the implementer, written after
  the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
