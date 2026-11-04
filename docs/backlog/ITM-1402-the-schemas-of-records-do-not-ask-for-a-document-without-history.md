---
id: ITM-1402
title: The schemas of records do not ask for a document without history
level: module
realises:
  - A DOCUMENT HOLDS NO HISTORY
  - A RECORD IS EVIDENCE, NOT A PROPOSAL
modules:
  - MOD-approvals
  - MOD-result-records
builds_on: []
tests:
  - unit
origin:
  - ITM-1396's code (#1689), stopped in team1's sprint 142: with the marks of history checked, an approval record and 246 of 1167 result records would gain findings, though a record is evidence that is never rewritten
---
# ITM-1402 The schemas of records do not ask for a document without history

**REGISTER**

## Outcome

`A DOCUMENT HOLDS NO HISTORY` names the files that state only what holds now, "records and dated measurements are not among
them". MOD-documents' Data says of `noHistory`: "records and measurements leave it out". Three schemas of records set it all
the same:
- MOD-approvals' `src/approvals/approval-record.schema.md`;
- MOD-result-records' `src/result-records/result-record.schema.md` and `src/result-records/counter-proof.schema.md`.

Today nothing checks `noHistory`, so this changes no outcome. Once ITM-1396 checks the marks of history, it would give
findings on records that are written once and never rewritten. One example is the approval record
`docs/approvals/spec-2026-09-30g_ci-entwurf-und-rechenumgebung-01-a22d7c221b09.md`, line 7.

## Acceptance

- The three schemas no longer set `noHistory`. No other schema changes.
- It is a refactoring: CI is green on every commit, and no expected result changes. ITM-1396's tests are what then show the
  records read without a finding.
