---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f3cc4155ff8c2b4e7bade4894acb7d6b463b15f4
  - https://github.com/akmaier/agent-m/pull/1559
date: 2026-10-31 11:37 UTC
---
# Development → Release testing: ITM-1335, a requirement proposed as a change of itself with its rule unchanged is a duplicate

**REGISTER**

## Reason

ITM-1335 is by developer-opus-e. Pull request #1559 into `sprint/team1/132` has two commits.

1. **First commit only tests, red:** `d6fe41ebf` holds only `tests/documents-change-of-itself.test.mjs` (new) and
   `tests/documents-change-under-own-key.test.mjs`. Run 41197125041 is red on it. Its jobs `unit-pull-request (13)` and
   `(14)` each fail one file: TST-1335001, and TST-1317004 at `r2`. Both give `change`/`participant` where
   `duplicate`/`rule` is expected, which is the item's reason. The 80 other files of those jobs fail 0.
2. **CI green on the head:** run 41197205367 on `f3cc4155f` succeeds.
3. **Scope:**
   - `src/documents/candidates.mjs` is MOD-documents. The proposed artifact is now left out of the search only for a key of one value.
   - The new test file is headed MOD-documents.
   - In `documents-change-under-own-key`, which is headed MOD-documents, only TST-1317004's expectation for `r2` and its `expect` line changed. The Acceptance names that test, and the accepted MOD-documents text gives the behaviour it now asserts.
4. **Requirement, module, counter-proof:** TST-1335001 guards EXACT DUPLICATES ARE FOUND WITHOUT A MODEL and A CHANGE IS
   PROPOSED UNDER THE EXISTING NAME, and names MOD-documents. Its counter-proofs are in the pull request: three faults
   planted in `candidates.mjs`, each failing the case it targets. MOD-test-document's reader finds 1 and 4 declarations and
   0 findings in the two files. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
5. **Acceptance:**
   - The restated rule is a duplicate, decided by rule.
   - Another rule stays a change, decided by the participant.
   - `MOD-sync` stays a change.
   - TST-1317004's `r2` is a duplicate of A REPORT HAS A TITLE, decided by rule, and its other two assertions stay.
   - The reading taken, "a requirement" as a key of more than one value, is the one the item names.
