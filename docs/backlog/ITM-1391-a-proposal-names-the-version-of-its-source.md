---
id: ITM-1391
title: A proposal names the version of its source
level: module
realises:
  - UC-005
  - A LIVING SOURCE IS PINNED
modules:
  - MOD-spec-changes
builds_on:
  - ITM-579
tests:
  - unit
origin:
  - TST-579219 of ITM-579's system tests of UC-005 (#1681), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1611-development-release-testing-0579.md)
---
# ITM-1391 A proposal names the version of its source

**REGISTER**

## Outcome

UC-005's postcondition asks that each proposal names its source passage and the source version. MOD-spec-changes' Data
gives the rationale (`queue-rationale`) "the origin — the source passage and version". The writer of a derived entry,
`rationaleOf` (`src/spec-changes/propose.mjs:183`, its Origin at :195-196), writes `Source SRC-policy, passages: ch. 5.`
and no version. No file of the written queue names the version of the source.

## Acceptance

- The rationale of an entry derived from a linked source names in its origin the source, its passages and the version
  that was read.
- TST-579219 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
