---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 902e5200749d05ebd9c5ba9bce3be70c7cc9bb3f
  - https://github.com/akmaier/agent-m/pull/1451
  - tests/release-itm-1180-spec-view-links.test.mjs
  - tests/release-itm-1280-jobs-list-batches.test.mjs
  - tests/release-itm-1306-electron-from-setup.test.mjs
date: 2026-10-29 13:04 UTC
---
# Release testing → Sprint review: team 1's sprint 117

**REGISTER**

## Reason

The release tests of sprint 117's items pass on `sprint/team1/117` at `902e5200`, the head of #1451 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1180 | `tests/release-itm-1180-spec-view-links.test.mjs` | TST-1180301 to 304 | `c2cd45ae` (#1448) |
| ITM-1280 | `tests/release-itm-1280-jobs-list-batches.test.mjs` | TST-1280301 to 307 | `c656f9c7` (#1449) |
| ITM-1306 | `tests/release-itm-1306-electron-from-setup.test.mjs` | TST-1306301 to 309 | `7093d0fb` (#1450) |

   - **ITM-1303** changes a test and no behaviour, so it has no release test, as ruled at its gate
     (`docs/gates/20261029-1145-development-release-testing-ba82.md`).
2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/`, `index.html`,
   `docs/index.html` and the test setup and Electron helpers (`tests/test-schedule-setup.sh`, `tests/site-usability.d/`,
   `tests/desktop-shell.d/`, `tests/desktop-shell.test.mjs`) in `origin/main..902e5200`:
   - ITM-1180 `c469f427`: developer-sonnet-j;
   - ITM-1280 `197c4882`: developer-opus-f;
   - ITM-1306 `c9f6df31` and `eb8b3b95`: developer-opus-e.
   - developer-sonnet-l has none. Its six commits in the range are the three release tests and the three edits ruled at
     the stops and in the Acceptances:
     - `cd55a6a8` (`release-itm-276`);
     - `7c450c3a` (`release-itm-1285`);
     - `262fec19` (`release-itm-1269`).
3. **Green on the sprint branch.** Run 40877782403, `pull_request`, on `902e5200` passes 39 of 39 pull-request and setup
   jobs. In its release jobs:
   - 1180: 4 pass and 1280: 7 pass (release shard 4);
   - 1306: 9 pass (release shard 2).
   - 0 fail and 0 skipped. All 20 cases pass.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `902e5200`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The three files give 4, 7 and 9 declarations, every case of the table, each of the level `release`, and 0 findings.

## The readings of the release tests

1. **ITM-1180: a branch that is not the default is read as a tag is.** The view links *Edit*, *+ Requirement*,
   *Arrange* and the history on the default branch only (`onDefaultBranch`, `src/trace-pages/flow.mjs`). The
   specification row is drawn on "branch and tags" (MOD-trace-pages.md:130). So another branch shows the requirements
   and no links, as a tag does.
2. **ITM-1306: the Electron places run under `--import` with `process.platform` set to `linux` on a Mac.** That is how
   the cases reach the Linux path of each helper on a machine that is not Linux. On the CI's runners the platform is
   Linux, so it changes nothing there.
3. **ITM-1306: one planted fault cannot be seen from outside.** `|| true` after the package's `npm install` leaves the
   setup's end to `install.js`, which then fails anyway. #1450 names it. The fault on `install.js` itself is caught
   (`:181`). No item.
