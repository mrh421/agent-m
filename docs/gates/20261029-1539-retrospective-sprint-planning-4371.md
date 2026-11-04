---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3836359cdc4f490a92b17a8797a09f4d7c89fd8d
  - https://github.com/akmaier/agent-m/pull/1461
  - docs/backlog/sprints/team1/119.md@a64534ecd
date: 2026-10-29 15:39 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/119` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 119, pull request #1461 of `sprint/team1/119` into `main` at `3836359c`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.** `docs/backlog/sprints/team1/119.md` on `main` holds three
   sections: `## Review`, `## Unfinished items` (none) and `## Retrospective`. All three were appended in `a64534ecd`,
   whose trailer names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 40901982501, `pull_request`, attempt 2, succeeds: 41 jobs pass and 17 are
   skipped. Its checkout is "Merge 3836359c… into c4c664cb…".
   - Attempt 1 failed only TST-286904, a flip registered as ITM-1312
     (`docs/gates/20261029-1536-release-testing-sprint-review-5e8b.md`).
3. **The run still stands for the merge.**
   - Since `c4c664cb`, `main` has gained `d0a9bf494` (my release gate record, with ITM-1312) and `a64534ecd` (the close).
     They add or change three files under `docs/`.
   - The merge has no conflict (`git merge-tree`).
   - On `origin/main` merged with `3836359c` locally, the checks that read those records pass:
     - `python3 -m unittest test_backlog_layout test_no_history test_artifact_format test_backlog_item_fields
       test_definition_of_done test_parallel_sprints`: OK;
     - `node --test tests/release-sprint-02-b-work-items.test.mjs tests/dashboard-backlog-teams.test.mjs`: 28 pass,
       0 fail.
4. **Every gate before the merge is recorded:**
   - Development → Release testing for #1458, for #1459 after one return, and for #1457 after one return;
   - Release testing → Sprint review on `3836359c`.

## Noted

**Handover to the next po-opus-c session, which plans sprint 120 from the records.**

- **The state of the backlog on `main` once #1461 is merged,** read as in every planning since sprint 110. Of the 1,073
  items, 974 are done and 99 are not:
  - 56 are ready, ITM-1312 among them;
  - 16 wait for an item they build on;
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
  - 23 wait for a draft for akmaier: those in sprint 119's record, `## Not selected`;
  - 2 need a person: ITM-237 and ITM-267, and ITM-374 through ITM-267.
- **The classifier's trap,** listed in sprint 119's record: eleven items name their draft in their text, not in a
  section `## Not ready`, ITM-897 among them. A phrase search also hits ITM-518, 632, 699, 719, 782, 857, 1171, 1287 and
  1304. These are not yet read; read each before selecting it.
- **Candidates not yet checked against the agreements:**
  - ITM-1159 (MOD-trace-pages, MOD-site-frame: the narrow table rule; its draft is accepted);
  - ITM-1267 (seven modules, MOD-site-frame's loading; wants a sprint without another item in MOD-site-frame);
  - ITM-1304 (147 test files; wants a sprint of its own);
  - ITM-1283 and ITM-1289 (GitLab routes);
  - ITM-659, 857 and 1170.
  - ITM-1287 and 1312 are flips. Under sprint 118's agreement, their reproduction is tried at planning before either is
    selected.
- **The agreements to apply,** from the Retrospectives of sprints 110 to 119. The newest first:
  - A planning stand-in uses only what the calling module's Uses and the called module's interface state.
  - A rename of an identifier first searches `docs/` and `src/` for every reader of it. Counter-proof records under
    `docs/tests/counter-proofs/` are read by identifier.
  - An item whose first task is to reproduce a failure is settled at planning.
  - With each change applied, run every test that reads a changed file by its path, and every test of a module whose
    code calls a changed function. Name each new failure in the item's Acceptance.
- **Things the records do not state plainly:**
  - **This machine cannot run some cases.** The mailbox system tests `release-uc-037-connect-mailbox`,
    `system-uc-037-connect-mailbox`, `system-uc-038-bridge-route` and `system-uc-039-bridge-route` hang, as do
    `release-uc-003-dashboard-https-bridge` and `system-uc-003-dashboard-bridge`. Leave them out of a planning run, or
    stop them.
  - **Cases that fail here with and without a change:** TST-1281004, TST-1306307 to 309, TST-266001 and 002,
    `release-itm-269-endpoint-route`, and `test_expected_results_stated` (a missing Node module).
  - **A planning run of a few hundred files takes ten minutes or more.** Run it in the background.
  - **At every gate, read the declaration reader with its control:** `tests/release-itm-1254-issue-move.test.mjs`, 4
    and 0.
  - **Known flips:** ITM-1287 (`review-pages-release-limitations`) and ITM-1312 (TST-286904). A failed attempt on one of
    them alone, with a green rerun, counts as CI green on the head.
