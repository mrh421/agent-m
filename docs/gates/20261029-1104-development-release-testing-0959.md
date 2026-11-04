---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 52162a7385596e82b53b7561892848673f599c31
  - https://github.com/akmaier/agent-m/pull/1438
  - docs/backlog/ITM-1309-the-tests-tree-reads-the-records-of-the-version-s-commit-alone.md@858754d64
date: 2026-10-29 11:04 UTC
---
# Development → Release testing: ITM-1309, the tests tree reads the records of the version's commit alone

**REGISTER**

## Reason

ITM-1309, pull request #1438 into `sprint/team1/116`, passes on `52162a73`, its head when this was decided. The item is
read as edited at its stop (`team1/116.md`, "ITM-1309's stop").

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40861339829, `pull_request`, on `52162a73` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `d561cc0d` is red in run 40860703908, in two jobs. There fail only:
   - the three new cases, TST-1309001 to 003;
   - the two changed expectations, TST-1276002 and 003, whose whole-tree count goes from 1 to 0.
   - The helper change of `trace-pages-test-history-newest` stands in that commit, as ruled at the stop.
3. **The implementation commit changes no test.**
   - `2d8cb619` changes only `src/trace-pages/tests.mjs:48`, to `readSnapshot(RESULTS_BRANCH, { folders:
     [`runs/${snapshot.commit}`] })`, and its comment.
   - Its run 40860766688 fails only TST-1276301 and 302, the release cases the Acceptance names. The ✖ of "UC-042 1a"
     there is a `todo` (FINDING R3), not a failure.
4. **The release test is changed as ruled.** `52162a73`, by developer-sonnet-l, who implemented none of this item,
   changes only `tests/release-itm-1276-test-history-ten-at-a-time.test.mjs`:
   - TST-1276301's helper `narrowedOf` leaves out the tests tree's snapshot, narrowed to `runs/<version commit>`. The
     count of the history's snapshot stays 1, and its folders, batch and records are asserted as before.
   - TST-1276302's whole-tree count goes from 1 to 0.
   - Both `expect:` lines say so.
5. **Only its module changes.**
   - Code: `src/trace-pages/tests.mjs`.
   - Tests: the new `trace-pages-tests-tree-commit-records`, `trace-pages-test-history-newest` and
     `release-itm-1276-test-history-ten-at-a-time`, all named MOD-trace-pages.
   - No test of another module changes, and no test is removed.
   - The code adds no import. It calls `readSnapshot` (with `folders`) and `resultsAt`, which MOD-trace-pages' Uses
     name.
6. **The counter-proof stands.**
   - TST-1309002 asserts what the narrowed snapshot holds: the one record of the version's commit, and none of another
     commit or of the tag's.
   - It asserts also the record read, with main's record as the known positive.
   - A count of reads alone would pass on the old code, since `resultsAt` reads only that commit's records. So asserting
     what the snapshot holds is the reading that can fail.
   - TST-1309003 covers a version at a tag.
7. **The readings hold.**
   - **No `readMany` is added.** `resultsAt` reads the records of one commit, and the Acceptance asks for no batch
     (YAGNI).
   - **TST-1309002 asserts the snapshot's content,** as in point 6.
8. **The reader.** On `52162a73`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `trace-pages-tests-tree-commit-records`: 3, TST-1309001 to 003.
   - `trace-pages-test-history-newest`: 4.
   - `release-itm-1276-test-history-ten-at-a-time`: 4.
   - All with 0 findings.
