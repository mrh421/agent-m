---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3275a79b856210993a9d708e6770d92b5aa6de55
  - https://github.com/akmaier/agent-m/pull/1566
date: 2026-10-31 12:32 UTC
---
# Development → Release testing: #1566, ITM-690 The old review core goes

**REGISTER**

## Reason

ITM-690 is a refactoring of MOD-approvals: `tests/test_approval_records.py` is rewritten in place and checks the records
through MOD-approvals and MOD-documents, run in node.
1. **One commit, green:** run 41201130508 on `3275a79b8`. A refactoring's commits are all green (THE DEFAULT DEFINITION
   OF DONE IS THE JOB RULES).
2. **CI is green on the head:** 43 checks pass, none fails.
3. **Scope:** the one changed file is the file MOD-approvals' Parts name as taken over (`MOD-approvals.md:63`). Its four
   tests and their expected results are unchanged. `test_every_record_is_well_formed` asserts the same empty list in
   another form (A REFACTORING JOB CHANGES NO EXPECTED RESULT).
4. **No new test.** MOD-test-document's reader gives 0 declarations and 0 findings on the file, as before. Its control,
   `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0. Three of the four faults planted in the checker turn it
   red.
5. **Acceptance:** the file is rewritten on MOD-approvals, no other file changes, and its 4 tests pass locally on the head.

## Noted

- Removing the `documentFindings` call leaves the file green, since `writeDocument` catches the same misfits.
  `documentFindings` does not check the approval record's `lines` shape.
- A `release-report` record is now accepted, as the schema allows; the old check called it an unknown kind. No such record
  exists in `docs/approvals/`.
- `tests/jsrun.py` is not used.
- The developer read only 133.md's brief, not the agreements of sprints 130 to 132 it points to (Scrum Master's note).
