---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 290983823f7fe9eaccdab68403e9a7d00ee9c2df
  - https://github.com/akmaier/agent-m/pull/1482
  - tests/release-itm-1185-session-declaration.test.mjs
  - tests/release-itm-268-desktop-shell.test.mjs
  - tests/release-itm-269-endpoint-route.test.mjs
  - tests/release-uc-003-dashboard-https-bridge.test.mjs
  - tests/release-sprint-15-bridge-jobs.test.mjs
  - tests/release-itm-1266-review-folders.test.mjs
  - tests/release-itm-1268-last-accepted-one-file.test.mjs
  - tests/release-itm-1311-job-record-batch.test.mjs
  - tests/release-sprint-15-spec-toggles.test.mjs
date: 2026-10-29 23:31 UTC
---
# Release testing → Sprint review: team 1's sprint 122

**REGISTER**

## Reason

The release tests of sprint 122's items pass on `sprint/team1/122` at `29098382`, the head of #1482 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541). The
selected items are ITM-1313, ITM-1177, ITM-706 and ITM-820, merged with #1475, #1477, #1476 and #1478.

1. **The release tests of the items, each declaring the level `release`.** No gate called for a new one; each item
   changes existing release cases.

| Item | File | Cases | Changed by | Commit |
|---|---|---|---|---|
| ITM-1313 | `tests/release-itm-1185-session-declaration.test.mjs` | TST-1185304, now an ordinary case | developer-sonnet-l | `81a17d2a` |
| ITM-1177 | `release-itm-268-desktop-shell`, `release-itm-269-endpoint-route`, `release-uc-003-dashboard-https-bridge`, `release-sprint-15-bridge-jobs` | TST-268901, TST-269901, TST-266002, TST-472517 | developer-sonnet-l | `b562878c` |
| ITM-820 | `release-itm-1266-review-folders`, `release-itm-1268-last-accepted-one-file`, `release-itm-1311-job-record-batch` | the fixture walk only | developer-sonnet-l | `9ec78402` |
| ITM-706 | `release-sprint-15-spec-toggles` | TST-472518, the write rule only | developer-sonnet-k | `85e1152f` |

   - ITM-706 and ITM-820 are refactorings and change no behaviour, so they need no new release test
     (`docs/gates/20261029-1858-development-release-testing-a706.md`, `20261029-2326-…-d820.md`).
2. **No writer built the behaviour it tests.** These are the `Agent-M-Participant` trailers of every commit in
   `origin/main..29098382`, merges and my gate records aside:
   - ITM-1313 `2789a7b1` and `c3ae1a18`: developer-sonnet-j;
   - ITM-1177 `18029e29` and `759bdf8d`: developer-opus-f;
   - ITM-820 `e9e21aaf`: developer-opus-e;
   - ITM-706 `85e1152f`: developer-sonnet-k, who built none of ITM-574 or ITM-678, whose behaviour TST-472518 tests
     (developer-sonnet-d and developer-sonnet-b, `team1/72.md:48-50`);
   - the three release-test commits: developer-sonnet-l, who implemented none of the four items, nor ITM-1266, ITM-1268
     or ITM-1311, whose release tests ITM-820 touched.
3. **Green on the sprint branch.** Run 40973184020 (`pull_request`, head `29098382`, attempt 1) succeeds: 58 jobs, 17
   skipped, none failed.
4. **Run by me on `29098382`.** The release files above but `release-uc-003-dashboard-https-bridge`, which hangs on this
   machine, with `tests/system-sprint-14-spec-overview.test.mjs`: 29 tests, 27 pass, 0 todo. The 2 that fail,
   `release-itm-268-desktop-shell` and `release-itm-269-endpoint-route`, fail on this machine with and without the
   sprint's changes (Electron and the endpoint route), as at planning; CI ran them green.
5. **The reader.** MOD-test-document's reader on `29098382`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The nine release files give 32 declarations, each of the level `release`, and 0 findings.
   - TST-1185304's todo is gone, as ruled at sprint 121's gate; its `given`, `input` and `expect` are unchanged.
