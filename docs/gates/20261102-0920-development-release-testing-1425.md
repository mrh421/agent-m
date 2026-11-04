---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2447214e41768f1a7da80089618fea4020cbd8c0
  - https://github.com/akmaier/agent-m/pull/1723
date: 2026-11-02 09:20 UTC
---
# Development → Release testing: ITM-1425, #1723

**REGISTER**

## Reason

ITM-1425 (the test proposals' check agrees with the test document and checks each identifier) may go on. The pull request
is #1723 into `sprint/team1/142`, at `2447214e4`. developer-opus-e wrote the tests-only commit `254f26b67` and the code
`dad73e883`; developer-sonnet-l wrote `2447214e4`, the lift of TST-771210's and TST-771314's `todo`, after the code was pushed
(`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `254f26b67` adds TST-1425001 and 1425002 to the
   two test files of `test-proposals` (MOD-result-records). The helper `declared` gains a module parameter whose default is
   the old one, so no expectation moves. In run 41417313607 the two new cases are the only failing ones.
2. **CI is green on the head:** run 41418885759 (`2447214e4`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/result-records/strategies.mjs`.
   - **F3:** `writtenTests` → `differences` compared the test's guards with all the case's guards, the `MOD-` entry
     included. A case that guards a requirement and names a module could not pass both checks. Now a `MOD-` entry is
     compared with the test's module and the others with its guards, each only where the case names it. A differing
     module is a finding of its own.
   - **F4:** `testProposals` never looked at a case's identifier. Now an identifier that is missing, is not of the form
     `TST-<number>`, or belongs to an existing test or another case, is an error under `EVERY ARTIFACT HAS AN IDENTIFIER`.
4. **The Acceptance holds:**
   - The counter-proofs F3-a to c and F4-a to c are in the pull request, several of them failing TST-771210 or 771314 too.
   - TST-771210 and 771314 lose their `todo`: each red at `254f26b67`, green at `dad73e883`. sonnet-j wrote both, and
     sonnet-l built none of the writer.

## Readings taken

The pull request names five readings:
1. A test's module is a field of its own (`EVERY ARTIFACT NAMES ITS ORIGIN`).
2. Each part is compared only where the case names it.
3. An identifier has the form `TST-<number>`.
4. "Given to another test" is an existing test's identifier or another case's.
5. The check tells a `MOD-` entry and a `TST-` identifier by their form itself, since MOD-result-records' Uses do not name
   MOD-identifiers' `kindOfIdentifier`. It is a small copy of a rule MOD-identifiers holds. A Uses line naming
   `kindOfIdentifier` would remove it; that is noted for akmaier and is a candidate for the review.

All are taken.
