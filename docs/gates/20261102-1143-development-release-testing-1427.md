---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a17455af5a38e4e3f9b76f8791b92403414ca52b
  - https://github.com/akmaier/agent-m/pull/1731
date: 2026-11-02 11:43 UTC
---
# Development → Release testing: ITM-1427, #1731

**REGISTER**

## Reason

ITM-1427 (a CI test job records what it did not write) may go on. The pull request is #1731 into `sprint/team1/142`, at
`a17455af5`, the Scrum Master's merge of the sprint branch, which keeps every lifted entry of UC-026's flow maps in the
evidence. The commits (`Agent-M-Participant` on each):
- developer-sonnet-j: the tests-only commits `7910c72fe` and `be2b130ee`, and the code `fc48d4f2d`;
- developer-sonnet-l: `a15e35902`, the lift of TST-771209's `todo`, after the code was pushed.

I wrote none of it.
1. **The tests-only commits are red for the item's reason.** They add `tests/workflow-entries-write-tests-not-written.test.mjs`
   (MOD-workflow-entries). In run 41427061785 the failing cases are TST-1427001, 002 and 004. TST-1427003 guards the result
   that does not change, and passes.
2. **CI is green on the head:** run 41434950634 (`a17455af5`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/workflow-entries/product.mjs`.
   - The writer `branch-and-pull-request` hands no draft back (`product.mjs:267-272`), so the report's cases not written
     were dropped.
   - Now `notWrittenOf(report)` gives the end record a draft `{ notWritten: [{ identifier, reason }] }`, in the shape the
     generation page (`generate.mjs:286`) and TST-764004 read.
4. **The Acceptance holds:**
   - The end record of a `write-tests` job on CI names each case it did not write, and why. A case the report does not
     name is not listed.
   - The four counter-proofs in the pull request each fail a case.
   - TST-771209 loses its `todo`: red at `be2b130ee`, green at `fc48d4f2d`. sonnet-j wrote the case and implemented the
     item; sonnet-l, who lifted it, built none of the entry.

## Readings taken

- The reason of a case not written is the report's `tests[].notWritten`.
- MOD-job-ledger types the record's `draft` as `unknown | null`. Its "draft: for a job whose kind hands its draft back"
  says when the draft is the whole draft, and forbids no other content.

Both are taken.

## Merge note

#1732 and #1731 each move one line of UC-026's flow maps. Whichever merges second takes the other first, every lifted entry
kept in the evidence.
