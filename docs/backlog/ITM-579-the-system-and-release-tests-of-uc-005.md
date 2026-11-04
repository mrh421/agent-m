---
id: ITM-579
title: The system and release tests of UC-005
level: system
realises:
  - UC-005
modules:
  - MOD-review-pages
  - MOD-spec-changes
  - MOD-job-runner
builds_on:
  - ITM-577
  - ITM-578
tests:
  - system
  - release
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), at akmaier's request of 2026-10-16
---
# ITM-579 The system and release tests of UC-005

**REGISTER**

## Outcome

UC-005 has no system test and no release test: `tests/system-uc-005*` and `tests/release-uc-005*` do not exist, while `tests/system-uc-006-approve-spec-change.test.mjs` does.

## Acceptance

- The system test walks the main flow and every alternative.
- Every requirement UC-005 realises has a release test, written by a developer who implemented none of it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
