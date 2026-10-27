---
id: ITM-257
title: The system and release tests of UC-013
level: system
realises:
  - UC-013
modules:
  - MOD-test-pages
  - MOD-release-evidence
builds_on:
  - ITM-256
tests:
  - system
  - release
origin:
  - UC-013
built_by:
  - 93e1d871db26354fc4bf700aedd7fc3620c6ba24
---
# ITM-257 The system and release tests of UC-013

**REGISTER**

## Outcome

UC-013 checked as a whole through the dashboard's release panel once ITM-256 and the change between jobs after it are
merged: a system test that walks UC-013's main flow and each of its alternative flows through the panel, with GitHub
replaced by a fixture server and the route of the complete run by a fixture that ends the queued run and adds its result
records — running it is UC-010's and UC-011's —, and release tests, one or more for each requirement UC-013 realises.
They are written by a Developer who implemented none of ITM-247 to ITM-256 nor that change (`RELEASE TESTS ARE NOT WRITTEN
BY THE IMPLEMENTER`).

## Acceptance

- Every requirement UC-013 realises has a release test, and the system test walks the main flow and each alternative
  flow; each test states its input, precondition and expected result where they can be read without running it, and
  names what it guards.
- Each new test's counter-proof — a fault planted in the code it guards, and the test failing on it — is recorded in the
  pull request, which names the author.
- Where the panel and UC-013 disagree, the test follows UC-013 and the disagreement is named as a finding.
- Only new test files change.
