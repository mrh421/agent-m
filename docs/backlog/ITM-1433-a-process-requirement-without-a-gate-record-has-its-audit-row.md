---
id: ITM-1433
title: A process requirement without a gate record has its audit row
level: module
realises:
  - UC-030
  - THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
modules:
  - MOD-release-evidence
  - MOD-trace-pages
builds_on:
  - ITM-775
tests:
  - unit
origin:
  - UC030-F6, TST-775220 of ITM-775's system tests of UC-030 (#1733), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1108-development-release-testing-0775.md)
---
# ITM-1433 A process requirement without a gate record has its audit row

**REGISTER**

## Outcome

`THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE`, "including requirements with no test or no passing outcome". The
audit view's `gatesOf` keeps only the gates that have a record, so a process requirement whose gate was never decided has
no row (TST-775220).

## The reading taken

opus-e's probe found that the row is made by MOD-release-evidence's `auditRows`. It makes a process requirement's row only
for a requirement its gates name (`src/release-evidence/audit.mjs:98-100`), and types each gate `{ requirement, gate,
record: string }`. Dropping the page's filter alone hands it a gate with no record. The page then breaks, and the exported
document writes a record `null` that no one can check (UC-030 step 5).

`OPEN FOR EXTENSION, CLOSED FOR CHANGE`: `auditRows` takes the gates the workflow holds without a record as an added,
optional input, and gives each such row the gate as one no record holds. The type of a gate with a record stays as it is.
`auditDocument` writes that no record holds the gate, and the page draws it outside the cell of gate records. MOD-trace-pages
hands the gates without a record in that input instead of dropping them. The item therefore names MOD-release-evidence too.
The input is missing from MOD-release-evidence's text; that is noted for akmaier, and the item builds without asking.

## Acceptance

- Every process requirement valid at the release has a row, one whose gate has no record included, naming that no record
  holds it.
- TST-775220 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
