---
id: ITM-1423
title: The test generation page offers only accepted names
level: module
realises:
  - UC-026
  - NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
modules:
  - MOD-test-pages
builds_on:
  - ITM-771
tests:
  - unit
origin:
  - UC026-F1, TST-771203 of ITM-771's system tests of UC-026 (#1718), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0855-development-release-testing-0771.md)
---
# ITM-1423 The test generation page offers only accepted names

**REGISTER**

## Outcome

UC-026 has the author choose what the tests are generated for among accepted requirements, use cases and modules. The page
of MOD-test-pages that starts the generation lists names that are not accepted beside the accepted ones (TST-771203).

## Acceptance

- The page offers for selection only requirements, use cases and modules that are accepted. Known positive: an accepted
  one is offered.
- TST-771203 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
