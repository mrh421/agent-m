---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 760470bdd18e1c4c3734b6deaf53c41abee18f6e
  - https://github.com/akmaier/agent-m/pull/1660
date: 2026-11-01 11:40 UTC
---
# Development → Release testing: ITM-1373, #1660

**REGISTER**

## Reason

ITM-1373 (a model without a time box names no measure per time box) may go on. The pull request is #1660 into
`sprint/team1/141`, at `760470bdd`. developer-opus-e wrote the tests-only commit `3a58821b6` and the code `8b2c58d3b`;
developer-sonnet-l wrote `760470bdd`, the two release cases the item gives another participant (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `3a58821b6` changes `tests/model-catalogue.test.mjs`
   (MOD-model-catalogue) only. Run 41302007099 on it was cancelled when the next commit was pushed, after its jobs had run:
   its log fails one case, TST-1373001, "the measure remaining items per time box in pulled work that names no time box
   is an error". Every other ✖ line of it is a `todo` naming a FINDING.
2. **CI is green on the head:** run 41302239993 (`760470bdd`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's modules change:** `src/model-catalogue/validate.mjs`, `index.mjs` and one sentence of
   `model.schema.md`. `modelFindings` reports `remaining items per time box` in pulled work without a time box as an
   error on the measure's line. The five shipped models give no finding.
4. **The Acceptance holds:**
   - TST-1373001 covers a fixture, the Kanban, and the counter-proof with a time box. The pull request records the base
     and a dropped `timeBox === null` as planted faults.
   - sonnet-l's `760470bdd`, written after the code was pushed:
     - TST-802311 expects *Save* refused with the measure named, nothing committed, and a fitting measure clearing it;
       its `todo` is gone. It fails on the base.
     - TST-779103 takes the measure `items per state over time` where Scrum's copy keeps only the WIP limit. *Save*
       stays available, and no assertion changes. It passes on both base and head.
   - The probe over 132 files moved only TST-779103, which the item names.

## Reading taken

- The rule covers pulled work only, since the schema's variants already refuse that measure for planned work. Taken.
