---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 09fd933fd0a7778e5516735c94caf5b77196f9db
  - https://github.com/akmaier/agent-m/pull/1426
  - tests/release-itm-1265-schedule-stored-view.test.mjs
  - tests/release-itm-1270-issue-reads.test.mjs
  - tests/release-itm-1270-replies-read-issue.test.mjs
  - tests/release-itm-1275-history-log-on-open.test.mjs
  - tests/release-itm-1278-models-declarations.test.mjs
date: 2026-10-29 09:30 UTC
---
# Release testing → Sprint review: team 1's sprint 114

**REGISTER**

## Reason

The release tests of sprint 114's items pass on `sprint/team1/114` at `09fd933f`, the head of #1426 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1265 | `tests/release-itm-1265-schedule-stored-view.test.mjs` | TST-1265301 to 305 | `28ce77d8` (#1425) |
| ITM-1270 | `tests/release-itm-1270-issue-reads.test.mjs` | TST-1270301 to 304 | `431bab7b` (#1424) |
| ITM-1270 | `tests/release-itm-1270-replies-read-issue.test.mjs` | TST-1270305, 306 | `431bab7b` (#1424) |
| ITM-1275 | `tests/release-itm-1275-history-log-on-open.test.mjs` | TST-1275301 to 305 | `0a7cbd43` (#1423) |
| ITM-1278 | `tests/release-itm-1278-models-declarations.test.mjs` | TST-1278301 to 304 | `0a7cbd43` (#1423) |

2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/`, `index.html` and
   `docs/index.html` in `origin/main..09fd933f`:
   - ITM-1265 `ed988c7c`: developer-opus-e;
   - ITM-1270 `f979c4a2`: developer-opus-f;
   - ITM-1275 `eaabd0bf`: developer-sonnet-j;
   - ITM-1278 `0e62ceaa`: developer-sonnet-k.
   - developer-sonnet-l has none.
   - Its commit `85a7abef` on ITM-1265's branch changes only `tests/release-itm-1260-stored-views.test.mjs`, as ITM-1265's
     Acceptance asks.
3. **Green on the sprint branch.** Run 40849564211, `pull_request`, on `09fd933f` passes 38 of 38 pull-request jobs. In
   its release jobs:
   - 1275: 5 pass (release shard 4);
   - 1270: 4 pass and 1278: 4 pass (release shard 5);
   - 1270 replies: 2 pass (release shard 6);
   - 1265: 5 pass (release shard 8).
   - 0 fail. All 20 cases pass.
   - #1425's own attempt 1 failed only `tests/bridge-jobs-list.test.mjs`, the flip registered as ITM-1295. It is no
     release test of this sprint, and the run on the sprint branch's head is green in its first attempt.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `09fd933f`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The five files give 5, 4, 2, 5 and 4 declarations, every case of the table, each of the level `release`, and
     0 findings.

## The readings of the release tests

1. **A declaration of an unknown level that calls a paid service counts in the row `paid` alone.**
   - `ScheduleView` holds "the number of the test declarations of each level, and of those that call a paid service"
     (MOD-progress-measures.md:297-300).
   - So the row `paid` counts every declaration that calls one, whatever its level. A level outside the five has no row
     of its own.
   - This agrees with ITM-1265's counter-proof: "a declaration of an unknown level is counted in no row", for one that
     calls none.
2. **A `ciRunLog` that fails leaves the link as it was, so that it can be asked again.**
   - MOD-trace-pages.md:162-164 marks the link *no longer available* only where `ciRunLog` "gives `null`". A failed
     request gives no answer, so the link keeps "log".
   - TST-1275304 pins this: the second click asks again.
3. **On GitLab, the `NotFound` for a merge request's iid comes from the server's 404.**
   - The issues and the merge requests of a project number their iids apart, so an iid of a merge request alone has no
     issue.
   - That is "a number the repository has no issue of" (MOD-repository-hosts.md:274-276), as ruled at ITM-1270's gate
     (`docs/gates/20261029-0854-development-release-testing-e9eb.md`, point 6).
