---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b96d0ae816aea7ed88ac4897a98a27aded250d3e
  - https://github.com/akmaier/agent-m/pull/1443
  - tests/release-itm-1293-move-form-builds-on.test.mjs
  - tests/release-itm-1309-tests-tree-commit-records.test.mjs
  - tests/release-itm-1281-start-page-instance-reads.test.mjs
date: 2026-10-29 11:25 UTC
---
# Release testing → Sprint review: team 1's sprint 116

**REGISTER**

## Reason

The release tests of sprint 116's items pass on `sprint/team1/116` at `b96d0ae8`, the head of #1443 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1293 | `tests/release-itm-1293-move-form-builds-on.test.mjs` | TST-1293301 to 304 | `d3961bbc` (#1440) |
| ITM-1309 | `tests/release-itm-1309-tests-tree-commit-records.test.mjs` | TST-1309301 to 305 | `4d0600ab` (#1441) |
| ITM-1281 | `tests/release-itm-1281-start-page-instance-reads.test.mjs` | TST-1281301 to 304 | `102ec1b1` (#1442) |

   - **ITM-1300** changes a test and no behaviour, so it has no release test. That was ruled at its gate
     (`docs/gates/20261029-1053-development-release-testing-4ffe.md`).
2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/`, `index.html` and
   `docs/index.html` in `origin/main..b96d0ae8`:
   - ITM-1293 `9cb6bb5a`: developer-opus-f;
   - ITM-1309 `2d8cb619`: developer-sonnet-j;
   - ITM-1281 `3c3527b2`: developer-opus-e.
   - developer-sonnet-l has none. Its four commits in the range are the three release tests and `52162a73`, the edit of
     TST-1276301 and 302 ruled at ITM-1309's stop (`team1/116.md`).
3. **Green on the sprint branch.** Run 40864640682, `pull_request`, on `b96d0ae8` passes 38 of 38 pull-request jobs. In
   its release jobs:
   - 1309: 5 pass and 1281: 4 pass (release shard 3);
   - 1293: 4 pass (release shard 6).
   - 0 fail. All 13 cases pass.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `b96d0ae8`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The three files give 4, 5 and 4 declarations, every case of the table, each of the level `release`, and 0 findings.

## The point put to this gate

**The duplicate-title warning on a drafted item is intended.**
- MOD-work-plans gives `backlogFindings` "an item that realises nothing; that names no module the architecture
  describes; that builds on an item that does not exist, or on one that builds on it in turn; and, as a warning, an item
  that restates an existing one" (MOD-work-plans.md:192-194).
- An item restates another when their titles are equal (`src/work-plans/checks.mjs:20`, `classifyCandidates`).
- With the backlog's items beside the drafted one, a drafted item whose title equals a backlog item's restates it, and
  "the item's marks while the person edits it" (MOD-maintenance-pages.md:202) include that warning.
- It is what UC-033 4a offers the person: *Add to <identifier>*, an existing item the issue may join.
- A warning withholds nothing, so *Add* stays offered. Only an error withholds it (ITM-1257, "*Save* offered only while
  no error remains").
- ITM-1293's Acceptance is silent on it, and the texts give it. No defect, and no item.
