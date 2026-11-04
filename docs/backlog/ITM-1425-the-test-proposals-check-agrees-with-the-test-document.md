---
id: ITM-1425
title: The test proposals' check agrees with the test document and checks each identifier
level: module
realises:
  - UC-026
  - EVERY ARTIFACT NAMES ITS ORIGIN
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-result-records
builds_on:
  - ITM-771
tests:
  - unit
origin:
  - UC026-F3 and F4, TST-771210 and TST-771314 of ITM-771's system and release tests of UC-026 (#1718), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0855-development-release-testing-0771.md)
---
# ITM-1425 The test proposals' check agrees with the test document and checks each identifier

**REGISTER**

## Outcome

- **F3:** a proposed case that exercises a module cannot pass both checks of a generated test. MOD-test-document's
  `testFindings` refuses a module among a case's guards. MOD-result-records' `differences` asks the guards of the proposal
  and the written case to be equal, the module included (TST-771210).
- **F4:** the writer `test-proposals` never checks a proposed case's identifier (TST-771314).

## The reading taken

`EVERY ARTIFACT NAMES ITS ORIGIN`: a test names the requirement it guards and the module it exercises, two different
fields. So a module is not a guard, and MOD-result-records compares the guards without the module and the module as its
own field, as MOD-test-document reads them.

## Acceptance

- A proposed case that guards a requirement and exercises a module passes both checks. A case whose written guards differ
  from the proposal's still fails `differences`.
- A proposed case without a `TST-` identifier, or with one that is given to another test, is refused by name.
- TST-771210 and TST-771314 lose their `todo` in a commit by a participant other than the implementer, written after the
  code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
