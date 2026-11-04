---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 19a5ffa6ca48baa18088199f05ee67fae6ce5f0c
  - https://github.com/akmaier/agent-m/pull/1692
date: 2026-11-01 18:56 UTC
---
# Development → Release testing: ITM-1402, #1692

**REGISTER**

## Reason

ITM-1402 (the schemas of records do not ask for a document without history) may go on. The pull request is #1692 into
`sprint/team1/142`, at `19a5ffa6c`, one commit by developer-opus-e (`Agent-M-Participant`). I wrote none of it.
1. **A refactoring, green on every commit:** run 41338318308 (`19a5ffa6c`), at the first attempt, on its only commit. No
   job failed or was cancelled. `git merge-tree` with the sprint branch's head is clean.
2. **Only the item's modules change:** `src/approvals/approval-record.schema.md` (MOD-approvals) and
   `src/result-records/result-record.schema.md` and `counter-proof.schema.md` (MOD-result-records). Each loses its line
   `"noHistory": true`, and nothing else changes. No test changes, so no expected result changes.
3. **The Acceptance holds:**
   - Without ITM-1396's check, 78 files of the two modules and their importers pass, and no test asserts the key.
   - With ITM-1396's held `checks.mjs`, `test_approval_records` passes again. Approval records with a finding fall from 1
     to 0, and result records on `test-results` from 258 to 0.
   - Known positive: a planted "Changed on" in a decision is still found.

## Reading taken

- The key is removed, not set to `false`, as MOD-documents' Data says records "leave it out". The candidate schema in
  `src/release-evidence/report.mjs` is not a record's and not this item's module, so it stays.
