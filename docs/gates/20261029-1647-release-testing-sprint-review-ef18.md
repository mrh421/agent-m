---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a244d416fd71b1fd0878ee9e7433d62becbae664
  - https://github.com/akmaier/agent-m/pull/1466
  - tests/release-itm-1289-merged-merge-request-runs-entry.test.mjs
  - tests/test_issue_to_spec.py
  - tests/release-itm-286-tunnels-runtime.test.mjs
date: 2026-10-29 16:47 UTC
---
# Release testing → Sprint review: team 1's sprint 120

**REGISTER**

## Reason

The release tests of sprint 120's items pass on `sprint/team1/120` at `a244d416`, the head of #1466 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541). The
selected items are ITM-1289, ITM-1283 and ITM-1312. ITM-1267 left the selection at its stop
(`docs/backlog/sprints/team1/120.md`, "ITM-1267's stop").

1. **The release tests, each declaring the level `release`:**

| Item | File | Cases | Writer | Commit |
|---|---|---|---|---|
| ITM-1289 | `tests/release-itm-1289-merged-merge-request-runs-entry.test.mjs` | TST-1289301 to 306 | developer-sonnet-l | `112ececb` (#1465) |
| ITM-1283 | `tests/test_issue_to_spec.py` | TST-1283001 | developer-sonnet-j | `8d077b54` (#1463) |
| ITM-1312 | `tests/release-itm-286-tunnels-runtime.test.mjs` | TST-286904 | developer-sonnet-k | `95482cac` (#1464) |

   - ITM-1283 and ITM-1312 are themselves release tests. Each changes no code.
2. **No writer built the behaviour it tests.** These are the trailers of every commit in `origin/main..a244d416`, merges
   aside:
   - ITM-1289 `80451685` and `6a27980f`: developer-opus-f;
   - ITM-1289's release tests `112ececb`: developer-sonnet-l;
   - ITM-1283 `8d077b54`: developer-sonnet-j;
   - ITM-1312 `95482cac`: developer-sonnet-k.
   - The behaviour of ITM-1283's case is the GitLab path of the queue write. That came from developer-sonnet-a,
     developer-sonnet-b and the coordinator's session (`docs/gates/20261029-1613-development-release-testing-76d8.md`).
   - The behaviour of ITM-1312's case is MOD-tunnels, which no developer of team 1 built
     (`docs/gates/20261029-1634-development-release-testing-a5f5.md`).
3. **Green on the sprint branch.** Run 40914188912, `pull_request`, on `a244d416`, attempt 1, succeeds: 41 jobs pass and 17
   are skipped, and none fails. In its log:
   - TST-1289301 to 306 pass;
   - TST-1283001 (`test_a_change_is_written_as_a_queue_on_a_gitlab_server`) is `ok`;
   - TST-286904 passes.
4. **Run by me on `a244d416`.**
   - The two Node release files and `test-document-one-line` give 12 pass and 0 fail.
   - `test_issue_to_spec` gives 4 tests, OK.
5. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `a244d416`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `release-itm-1289-merged-merge-request-runs-entry` gives 6 declarations, TST-1289301 to 306, each of the level
     `release`, and 0 findings.
   - `test_issue_to_spec.py` gives 4 and 0, and `release-itm-286-tunnels-runtime` gives 4 and 0. Both were read at their
     Development gates.

## Noted

- **For the review:**
  - The GitLab branches of `proposeSection` and `saveEntry` (`src/spec-changes/propose.mjs:400`, `:411`, `:468`) stay
    uncovered on GitLab. They serve a section saved on the dashboard, not the issue route (gate of #1463).
  - Every push of any branch now lists the merged merge requests once on GitLab (gate of #1462).
  - MOD-workflow-entries' code calls `host.listPullRequests`, which its Uses do not name. That gap came with ITM-1259
    (this sprint's planning).
- ITM-1267 goes back to the backlog, waiting for a draft of MOD-site-frame for akmaier. The close records it.
