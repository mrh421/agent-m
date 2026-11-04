---
id: ITM-1424
title: The release tests' writer is no implementer of the selection
level: module
realises:
  - UC-026
  - RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
modules:
  - MOD-test-pages
builds_on:
  - ITM-771
tests:
  - unit
origin:
  - UC026-F2, TST-771309 of ITM-771's release tests of UC-026 (#1718), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0855-development-release-testing-0771.md)
---
# ITM-1424 The release tests' writer is no implementer of the selection

**REGISTER**

## Outcome

`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`. When release tests are generated, MOD-test-pages' `implementersOf` names
the participants who implemented the selection, so that none of them is offered as the writer. It misses the implementer
of an item that realises the selected use case or changes the selected module (TST-771309).

## Acceptance

- `implementersOf` names every participant who implemented an item that realises a selected requirement or use case, or
  changes a selected module. None of them is offered as the release tests' writer.
- TST-771309 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
