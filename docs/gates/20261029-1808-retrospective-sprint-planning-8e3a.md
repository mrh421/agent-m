---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 137bee6aa3e8612d801182e4ff9a7c02b4d23288
  - https://github.com/akmaier/agent-m/pull/1474
  - docs/backlog/sprints/team1/121.md@4d85b4120
date: 2026-10-29 18:08 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/121` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 121, pull request #1474 of `sprint/team1/121` into `main` at `137bee6a`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/121.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `4d85b4120`, whose trailer names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 40926760329, `pull_request`, attempt 1, on `137bee6a` succeeds: 58 jobs, 17
   are skipped, and none fails.
3. **The run still stands for the merge.**
   - Since the run, `main` has gained only records and backlog text under `docs/`: my gate records, ITM-1185's ruling,
     ITM-1313 and the close, nine files in all.
   - The merge has no conflict (`git merge-tree`).
   - On `origin/main` merged with `137bee6a` locally, the checks that read those records pass:
     - `python3 -m unittest` for `test_backlog_layout`, `test_no_history`, `test_artifact_format`,
       `test_backlog_item_fields`, `test_definition_of_done` and `test_parallel_sprints`: OK;
     - `node --test tests/release-sprint-02-b-work-items.test.mjs tests/dashboard-backlog-teams.test.mjs`: 28 pass,
       0 fail.
4. **Every gate before the merge is recorded:**
   - Development → Release testing for #1469, #1470 and #1468 passed, #1468 after its red head was ruled; #1467 passed on
     its second round, after one return;
   - Release testing → Sprint review on `137bee6a`.

## Noted

**Handover to the next po-opus-c session, which plans sprint 122 from the records.** This session's context is too large
to plan another sprint safely.

- **The state of the backlog on `main` once #1474 is merged,** read as in every planning since sprint 110. Of the 1,074
  items, 981 are done and 93 are not:
  - 44 are ready, ITM-1313 among them;
  - 16 wait for an item they build on;
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
  - 28 wait for a draft for akmaier: those of sprint 121's record, `## Not selected`;
  - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
- **Candidates,** all outside a draft:
  - ITM-1313 (MOD-browser-store), small. Its stand-in must keep the family in a shape `keys_written` of
    `tests/test_settings_page.py` finds, or the item names that test's change; that is the trap of sprint 121.
  - ITM-1170, ITM-1171 and ITM-782: each passes the Uses check, and only a stand-in build shows its test changes. That
    build was not made at sprint 121's planning (`team1/121.md`).
  - ITM-1304 (continued declaration values): it wants a sprint with no other item in its files.
  - ITM-518: its check, `tests/test_expected_results_stated.py`, fails on this machine at an import of `src/tunnels/`; its
    list is read from CI.
  - ITM-1287: not reproduced in 500 runs under load; it waits for a CI run that shows it again.
  - Other ready items not read since sprint 110: the system and release tests of UC-003 to UC-046 (ITM-266, 370 to 376,
    579, 580, 738, 740, 741, 771 to 775, 805, 991, 1045, 1062), ITM-351, 706, 800, 820, 895 and 1177.
    Each is read against the agreements before it is selected; several name akmaier or a draft in their text.
- **The agreements to apply,** from the Retrospectives of sprints 110 to 121. The newest first:
  - Every report of a new or changed declaration prints the reader's `given`, `input` and `expect` for it.
  - A planning stand-in that adds a value to a list or family writes it in the shape the module's existing values have.
  - The Uses check reads the interface types of every module whose values the item changes, not only the prose.
  - An item whose build alone can show its test changes is built at planning by the Product Owner's stand-in, never as a
    sprint item.
  - A planning stand-in uses only what the calling module's Uses and the called module's interface state.
  - A rename of an identifier first searches `docs/` and `src/` for every reader of it.
  - An item whose first task is to reproduce a failure is settled at planning.
  - With each change applied, run every test that reads a changed file by its path, and every test of a module whose
    code calls a changed function. Name each new failure in the item's Acceptance.
- **Things the records do not state plainly:**
  - **Tools of this session, in the scratchpad's `tools/`:** `state.py` (after `gh pr list --state merged` to
    `merged.json` and `--state open` to `open.json`), `select.py` and `prun.sh` (a planning run), `reader.mjs`,
    `flip.sh` and `flippar.sh` (a flip's repetition: give the name pattern `.`, never an empty one), `titles.py`,
    `cont1304.py` (it also counts note lines after a declaration, so read its hits), `probe719.mjs`.
  - A stand-in is built in a detached worktree under the scratchpad (`git worktree add --detach … origin/main`), and its
    run beside a run of the same list on an unchanged worktree.
  - **Files that hang on this machine:** `release-uc-037-connect-mailbox`, `system-uc-037-connect-mailbox`,
    `system-uc-038-bridge-route`, `system-uc-039-bridge-route`, `release-uc-003-dashboard-https-bridge` and
    `system-uc-003-dashboard-bridge`. Leave them out of a run.
  - **Failures here with and without a change:** TST-291005 and 007, TST-1281004, TST-1306307 to 309,
    `release-itm-269-endpoint-route`, and every test that imports `src/tunnels/` (no `node_modules` here).
  - A todo that passes shows as `ok … # TODO` in TAP, and one that fails as `not ok … # TODO`.
  - **Known flip:** ITM-1287 (`review-pages-release-limitations`). A failed attempt on it alone, with a green rerun,
    counts as CI green on the head.
