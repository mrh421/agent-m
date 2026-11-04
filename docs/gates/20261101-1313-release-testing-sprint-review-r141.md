---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 82290373e09b146f8d75425975d5b9ae0e0e786f
  - https://github.com/akmaier/agent-m/pull/1670
date: 2026-11-01 13:13 UTC
---
# Release testing → Sprint review: the release tests of team 1's sprint 141

**REGISTER**

## Reason

1. **The release tests.** Every file under `tests/` with release cases that this sprint added or changed, from the cut
   `2c3ad42dd` to the head `82290373e`: 25 files named `release-…` and the two Python checks of level `release`,
   `tests/test_implementation_plan.py` and `tests/test_plan_layout.py`. (`tests/review-pages-release-reports.test.mjs`,
   also changed, holds unit cases only.) MOD-test-document reads each case of level `release` with `module: system` and
   no finding, as each item's gate record gives it.
2. **They are not written by the implementer** (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`), by the
   `Agent-M-Participant` trailer of every commit that touches them this sprint:
   - **developer-sonnet-l** wrote every change to the existing release files: ITM-1180, 1268, 1272, 1273, 1278, 1281, 1314
     and 1319's files, `release-sprint-01-dashboard-app`, `release-sprint-09-uc-001-add-product`, `release-uc-006`,
     `release-uc-037` and `release-uc-049` (the moved expectations of ITM-1170, 1291, 1349, 1350, 1355 and 1364);
     `release-uc-031-configure-a-process-model` (ITM-779, 1354, 1373, and TST-779104 in `53a0c3f4f`);
     `release-uc-031-requirements-of-a-model` (ITM-802, 1372, 1373); `release-uc-021` and `release-uc-025` (ITM-1359,
     1364); `release-uc-033` (TST-804311 to 804313, the cases of `backlogFindings`); `release-uc-045` (ITM-1369).
     sonnet-l built no item of this sprint: no commit under `src/` in the sprint carries its trailer, while the same count
     finds opus-e (14), opus-f (11), sonnet-j (9) and sonnet-k (12).
   - **The batteries**, each by a writer who built none of its use case's code, read at each gate: UC-004 (opus-f), UC-008
     (sonnet-j), UC-010 (sonnet-k), UC-012 (opus-e), UC-021 (sonnet-j), UC-025 (opus-f), UC-033 (sonnet-j, without the cases
     of `backlogFindings`, which sonnet-j built in ITM-817), UC-045 with the two Python checks (sonnet-j), UC-046
     (sonnet-k).
   - **TST-779104.** sonnet-k's change of it (`714044929`, ITM-1371) asserted the reads of ITM-1278's declarations, which
     sonnet-k built (`0e62ceaae`). sonnet-l wrote the expectation anew from UC-031 and MOD-implementation-pages in
     `53a0c3f4f` (#1668), merged before this gate; it adds the check that the only file read is `docs/process.md`.
   - **Reading taken.** Some battery writers later built an item of the same use case: opus-f ITM-1361 to 1363 (UC-004),
     sonnet-k ITM-1378 and 1381 (UC-010), sonnet-j ITM-1364 (UC-021) and ITM-1368 and 1371 (UC-045). None of them changed
     a release case for that item; each release case those items moved was changed by sonnet-l. The release cases were
     written from the use case before that behaviour, by another participant.
   - ITM-1370 changed the separator of 32 declarations in 13 Python files and nothing of their cases; it writes no test.
3. **Green on the sprint branch.** The pull request run 41309166410 on `82290373e`: at attempt 1 every test job passed but
   `release-pull-request (7)`, which was cancelled with no step failed; at attempt 2 it passed (13:06:58 to 13:08:58 UTC).
   So every release row is green on the head. The push run 41309070256 is green too; it runs no row of tests.

## Noted

- **`release-pull-request (7)` runs at the two-minute limit** (`A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES`): 120 s at
  attempt 2, cancelled at attempt 1 here and on #1663. At ITM-373's gate the same shard took 82 s. A shard that the limit
  stops is a finding for the next planning.
- **`agent-m done`** ("Check the Definition of Done", `onDoneCheck`) was cancelled at attempt 2 of the same run after two
  minutes, with no step failed. It is not a release test; the next gate, Retrospective → Sprint planning, needs it green
  on #1670.
- Left for akmaier, out of the selection or not built: ITM-1366 (UC-012's title), ITM-1376, ITM-1377 and ITM-1380.
