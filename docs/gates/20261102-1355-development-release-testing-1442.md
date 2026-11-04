---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1fe9ea9addf03d616e07b866524a57f09bd13463
  - https://github.com/akmaier/agent-m/pull/1744
date: 2026-11-02 13:55 UTC
---
# Development → Release testing: ITM-1442, #1744

**REGISTER**

## Reason

ITM-1442 (a release candidate's run runs every row) may go on. The pull request is #1744 into `sprint/team1/142`, at
`1fe9ea9ad`. developer-sonnet-k wrote the tests-only commit `81fca460e` and the code `8139d7d88`. developer-sonnet-l wrote
`1fe9ea9ad`, the lift of cases 019 and 020 of `tests/test_release_run.py`, after the code was pushed (`Item:` trailer on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** In run 41454286274, `unit-pull-request (7)`
   fails only in `result-records-run-tests`: TST-1442001 and the moved TST-586101, 586102 and 586105.
2. **CI is green on the head:** run 41456243496 (`1fe9ea9ad`). `git merge-tree` with the sprint branch's head
   `b81139a88` is clean.
3. **Only the item's module changes:** `src/result-records/strategies.mjs` (MOD-result-records), plus its tests and the
   lift in `tests/test_release_run.py`.
   - `runOf` (:249) kept `row !== "paid" && occasionsOf(row).includes("release candidate")`. A candidate's run therefore
     lacked `paid` and every unticked row, so `acceptAndRelease` refused it as incomplete. Now the occasion
     `release-candidate` keeps every row, and the other occasions are unchanged.
   - `resultRecord` (:280) leaves `paid` out of the record's `levels`. The run schema admits five levels
     (`result-record.schema.md:26`), and `workflow-entries/product.mjs:804` already writes none.
4. **The new tests name `A RELEASE RUNS EVERY TEST AT EVERY LEVEL`, UC-028 and MOD-result-records.** The pull request
   records their counter-proofs:
   - `false ||` fails TST-1442001, 586101 and 586102;
   - `true ||` fails TST-1442002;
   - removing the `paid` filter fails TST-586105, 586106 and 586108 on the schema.
5. **The Acceptance holds:**
   - Every row runs for a candidate, and the other occasions keep their columns (TST-1442002).
   - Cases 019 and 020 pass: red at `81fca460e` and green at `8139d7d88`, lifted by sonnet-l, who built none of `runOf`,
     with every assertion kept.

## Ruled

- **TST-586101 and 586102's moved expectations are the Acceptance's own** ("every row, `paid` included, whatever the row's
  cells say"). Both moved in the tests-only commit and were red there.
- **TST-586105 ends unchanged.** The tests-only commit had it expect `paid` among the record's levels, and the code commit
  put back its old expectation once the schema refused `paid`. Net, no asserted value of it changes, so the Acceptance's
  "no other existing expected result changes" holds.
- **The reads.** sonnet-k did not read chapters 9, 11, 12 and 13 in full (AGENTS.md §1). That is not one of the gate's
  conditions (scrum-wip.md, Gates; `THE DEFAULT DEFINITION OF DONE IS THE JOB RULES`). The work holds on every check
  above, so it does not block the gate. It is a point for the retrospective, under the brief's agreement on reports.

## Noted

- MOD-result-records' Data names `levels` "the levels run", while the recipe now names the row `paid`, which the record
  leaves out. This is a candidate for a module-text draft, not registered now.
- sonnet-k reports that `mod-desktop-shell-jobs-composition` (TST-367001 to 367003) fails in its local run of the sprint
  branch. CI is green on the head, so I count no flip.
