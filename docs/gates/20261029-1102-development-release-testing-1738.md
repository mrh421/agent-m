---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9cb6bb5aa508bdc08149bc3f6d052c2aa55fd5ed
  - https://github.com/akmaier/agent-m/pull/1437
date: 2026-10-29 11:02 UTC
---
# Development → Release testing: ITM-1293, the move form checks builds_on against the backlog

**REGISTER**

## Reason

ITM-1293, pull request #1437 into `sprint/team1/116`, passes on `9cb6bb5a`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40860737622, `pull_request`, on `9cb6bb5a` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `01e093c7` is red in run 40860611924, in unit shard 4, and there only in
   TST-1293001, for the item's reason: the form shows "the item builds on ITM-0900, which does not exist".
   - TST-1293002, an unknown identifier still marked, passes there, as a counter-proof should.
   - The implementation commit `9cb6bb5a` changes only `src/maintenance-pages/issues.mjs`, and no test.
   - The pull request was opened at the tests-only commit, so it has its own red run (sprint 115's agreement).
3. **Only its module changes.**
   - Code: `src/maintenance-pages/issues.mjs`.
   - Tests: the new `tests/maintenance-pages-move-builds-on.test.mjs`, which names MOD-maintenance-pages.
   - As its Acceptance says, no test of another module changes, and no test is removed.
   - The code adds no import. It calls `backlogFindings`, `readDocument` and `artifactSchemas`, which
     MOD-maintenance-pages' Uses name.
4. **The Outcome is the accepted text.** `backlogFindings` gives "the item's marks while the person edits it"
   (MOD-maintenance-pages.md:202).
   - The form now hands it the backlog's items beside the drafted one, so an existing item named in `builds_on` is
     found.
   - It keeps the findings of the drafted item alone.
   - The backlog's items are those `backlogItems(head)` already reads for *Add to …*, read once and kept with their
     documents. No further request is made.
5. **No counter-proof is weakened.**
   - TST-1293002 asserts the error on `ITM-0999` once, and no mark that is a backlog item's own.
   - The existing move-form tests (`maintenance-pages-move-lists`, `-move-1250`, `release-itm-1257-move-form-lists`,
     `release-itm-1254-issue-move`) pass unchanged in the run. Among them is the finding that an item names no module.
6. **The reading holds.** "The item's marks" are the findings on the drafted item, and not those the backlog's own items
   would carry. The page shows the drafted item, and the backlog's findings are the backlog page's.
7. **The reader.** On `9cb6bb5a`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `maintenance-pages-move-builds-on`: 2 declarations, TST-1293001 and 002, and 0 findings.
