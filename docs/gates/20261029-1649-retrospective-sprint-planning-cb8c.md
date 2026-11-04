---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a244d416fd71b1fd0878ee9e7433d62becbae664
  - https://github.com/akmaier/agent-m/pull/1466
  - docs/backlog/sprints/team1/120.md@2297f247c
date: 2026-10-29 16:49 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/120` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 120, pull request #1466 of `sprint/team1/120` into `main` at `a244d416`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/120.md` on `main` holds three sections: `## Review`, `## Unfinished items` (ITM-1267 to
     the backlog) and `## Retrospective`.
   - All three were appended in `2297f247c`, whose trailer names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 40914188912, `pull_request`, attempt 1, on `a244d416` succeeds: 41 jobs pass,
   17 are skipped, and none fails.
3. **The run still stands for the merge.**
   - Since the run, `main` has gained only records and backlog text under `docs/`: the ruling on ITM-1267, my gate records
     and the close, six files in all.
   - The merge has no conflict (`git merge-tree`).
   - On `origin/main` merged with `a244d416` locally, the checks that read those records pass:
     - `python3 -m unittest` for `test_backlog_layout`, `test_no_history`, `test_artifact_format`,
       `test_backlog_item_fields`, `test_definition_of_done` and `test_parallel_sprints`: OK;
     - `node --test tests/release-sprint-02-b-work-items.test.mjs tests/dashboard-backlog-teams.test.mjs`: 28 pass,
       0 fail.
4. **Every gate before the merge is recorded:**
   - Development → Release testing for #1463, #1462 and #1464, each passed the first time;
   - Release testing → Sprint review on `a244d416`.
   - ITM-1267 left the selection at its stop, and nothing of it is on the sprint branch.

## Noted

**Handover to the next po-opus-c session, which plans sprint 121 from the records.** This session's context is too large
to plan another sprint safely.

- **The state of the backlog on `main` once #1466 is merged,** read as in every planning since sprint 110. Of the 1,073
  items, 977 are done and 96 are not:
  - 50 are ready;
  - 16 wait for an item they build on;
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
  - 25 wait for a draft for akmaier: those of sprint 120's record, `## Not selected`, and ITM-1267;
  - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
- **Candidates not yet checked against the agreements,** all outside a draft:
  - in MOD-site-frame and the views, free again now that ITM-1267 is out: ITM-1159, 1288, 659 and 1170;
  - ITM-1287, a flip, whose reproduction is tried at planning;
  - ITM-1304 (147 test files; wants a sprint of its own);
  - ITM-518, 699, 782 and 1171 (read at sprint 120's planning; no draft);
  - ITM-719, whose first task may end in a draft of MOD-approvals; it is settled at planning first.
- **The agreements to apply,** from the Retrospectives of sprints 110 to 120. The newest first:
  - The Uses check reads the interface types of every module whose values the item changes, not only the prose.
  - An item whose build alone can show its test changes is built at planning by the Product Owner's stand-in, never as a
    sprint item.
  - A planning stand-in uses only what the calling module's Uses and the called module's interface state.
  - A rename of an identifier first searches `docs/` and `src/` for every reader of it.
  - An item whose first task is to reproduce a failure is settled at planning.
  - With each change applied, run every test that reads a changed file by its path, and every test of a module whose
    code calls a changed function. Name each new failure in the item's Acceptance.
- **Things the records do not state plainly:**
  - **Tools of this session, in the scratchpad's `tools/`:**
    - `state.py`, the backlog's states by sprint 110's rule (after `gh pr list --state merged` to `merged.json`);
    - `select.py` and `prun.sh`, a planning run's choice of files and its background run;
    - `reader.mjs`, MOD-test-document's reader with any control;
    - `flip.sh`, a flip's repetition beside busy processes.
  - **Files that hang on this machine:** `release-uc-037-connect-mailbox`, `system-uc-037-connect-mailbox`,
    `system-uc-038-bridge-route`, `system-uc-039-bridge-route`, `release-uc-003-dashboard-https-bridge` and
    `system-uc-003-dashboard-bridge`. Leave them out of a run.
  - **Failures here with and without a change:** TST-367001 to 003, `mod-desktop-shell-route-strategies`, TST-1281004 and
    `release-itm-269-endpoint-route`.
  - **Known flip:** ITM-1287 (`review-pages-release-limitations`). A failed attempt on it alone, with a green rerun,
    counts as CI green on the head.
