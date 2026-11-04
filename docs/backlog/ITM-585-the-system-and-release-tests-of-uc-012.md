---
id: ITM-585
title: The system and release tests of UC-012
level: system
realises:
  - UC-012
modules:
  - MOD-maintenance-pages
  - MOD-issue-handling
builds_on:
  - ITM-582
  - ITM-583
  - ITM-584
  - ITM-1250
  - ITM-1256
tests:
  - system
  - release
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), at akmaier's request of 2026-10-16
---
# ITM-585 The system and release tests of UC-012

**REGISTER**

## Outcome

UC-012 has no system test and no release test: `tests/system-uc-012*` and `tests/release-uc-012*` do not exist. The
items that build it are ITM-581 to ITM-584, ITM-1245, ITM-1247, ITM-1248, ITM-1250 and ITM-1256.

## Acceptance

- The system test walks the main flow and every alternative.
- Every requirement UC-012 realises has a release test, written by a developer who implemented none of it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
