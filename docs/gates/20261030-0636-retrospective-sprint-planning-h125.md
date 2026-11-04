---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 929c0f464ed413c24333112191f8df7f0641eda1
  - https://github.com/akmaier/agent-m/pull/1507
  - docs/backlog/sprints/team1/125.md@da9f6c58f
date: 2026-10-30 06:36 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/125` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 125, pull request #1507 of `sprint/team1/125` into `main` at `929c0f46`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/125.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `da9f6c58f`, whose subject and `Agent-M-Participant` trailer name scrum-master-opus-c. I
     wrote none of them.
2. **CI is green on the pull request.** Run 41014342484, `pull_request`, on `929c0f46`:
   - Attempt 1 failed in `unit-pull-request (13)` alone. There it failed only on TST-2026271023 of
     `tests/review-core.test.mjs`, "rejecting a SPEC change entry on its page takes it out of its queue", inside
     TST-2026271021..24.
   - `929c0f46` differs from `5e4f89c4` only by my release-gate record, and run 41013853598 on `5e4f89c4` was green.
   - Attempt 2, the same commit, succeeds: 41 jobs succeed, 17 are skipped, none failed.
   - So TST-2026271023 has two outcomes on one commit, and is flaky (A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY,
     SPEC.md:1587-1590), not a failure of the increment. It failed once before, on another commit (`team1/122.md`, Review).
3. **The run still stands for the merge.**
   - Since `2cf237413`, the merge base, `main` has gained the five gate records of this sprint, cherry-picked
     (`a5ad8ff91` to `bb826d092`), and the close.
   - The merge has no conflict (`git merge-tree --write-tree origin/main 929c0f464`, exit 0).
   - On `origin/main` merged with `929c0f46` locally, in a checkout, the checks that read those files pass:
     - `python3 -m unittest` in `tests/` for the following, OK:
       - `test_approval_records`, `test_backlog_layout`, `test_backlog_item_fields`, `test_definition_of_done`;
       - `test_parallel_sprints`, `test_no_history`, `test_artifact_format`, `test_participants`;
       - `test_role_assignment`, `test_coverage_report`, `test_no_backend`, `test_pages_layout`, `test_self_sufficient`.
     - `node --test` for the following: 40 pass, 0 fail:
       - `tests/trace-graph-import-uses.test.mjs` (TST-106805 among its cases);
       - `tests/dashboard-backlog-teams.test.mjs`, `tests/release-sprint-02-b-work-items.test.mjs`;
       - `tests/test-document-one-line.test.mjs`;
       - the two unit files of ITM-730.
4. **Every gate before the merge is recorded.**
   - Development → Release testing, each passed on its first round:
     - #1500 (ITM-659), on `194a03d0`;
     - #1501 (ITM-1067), on `e04e4dfc`;
     - #1502 (ITM-1307), on `af80a260`;
     - #1503 (ITM-730), on `03326195`.
   - Release testing → Sprint review: passed on `5e4f89c4`.
5. **The close's feedback is entered.** Its one item, the file put back after its accepted removal, is ITM-1314 (`eab51919c`,
   on this record's branch). The other four lines are noted, and need no item.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who plans sprint 126 from the records alone.

- **Read first, in the original, with the Read tool:**
  - AGENTS.md, SPEC.md in full, docs/process.md and docs/process-models/scrum-wip.md;
  - the book's chapters 8, 9, 11, 12 and 13;
  - sprint records `team1/123.md` to `125.md` with their Retrospectives;
  - this record, and docs/architecture/MOD-test-document.md.
- **The state of the backlog on `main` once #1507 is merged** (the count tool, `scratchpad/tools/state.py`, after
  `gh pr list` refreshes `merged.json` and `open.json`). Of the 1,062 items, 996 are done (ITM-659, 730, 1067 and 1307 the
  newest) and 66 are not.
  - The tool names 997 done, since the merged draft pull request #1481 names ITM-1267 in its title. ITM-1267 is not done.
  - The 66 not done:
    - 48 are ready, ITM-739 and ITM-1314 among them;
    - 12 wait for an item they build on, by the direct `builds_on` check: ITM-373, 374, 585, 700, 802, 803, 804, 806, 818,
      1058, 1059 and 1061;
    - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
    - 1 waits for a text: ITM-857 (`team1/124.md`, the backlog edits);
    - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
  - `docs/architecture/` is wholly accepted; no draft stands open.
  - No other team holds a sprint open (`team2/105.md` holds its `## Review`).
- **Ready candidates with an effect akmaier sees,** each still to be read against every agreement below:
  - **ITM-1314** (MOD-approvals; new, from this close). A decision or module file put back after its accepted removal is
    shown against its last accepted text, the empty one, and *Reject* removes it again. Its Acceptance names one case of
    MOD-review-pages. Its reading of *Reject*: deleting the file, not writing an empty one. That reading rests on the
    empty text being what `acceptShown` takes as a removal.
  - **ITM-1256** (MOD-maintenance-pages): the issue route's drafted change shows its candidates beside their requirements,
    and each conflict is decided.
    - It was not selected at sprint 125. Its Outcome asks for the review pages' candidates "the same, not a copy", and
      MOD-maintenance-pages' Uses name no function of MOD-review-pages.
    - Seek the reading first (sprint 123's agreement): which accepted interface of MOD-spec-changes or MOD-review-pages
      already gives candidates by class, and whether MOD-maintenance-pages names that module.
    - ITM-585 and ITM-804 build on it.
  - **ITM-1261 and ITM-1267**, akmaier's requests: products store their trace graph and views; the routes as data. These
    are builds of four and seven modules. ITM-1267 also names its CI time first, and sprint 120's stop record on it
    (`team1/120.md`) is to be read before it is selected.
  - **ITM-782** (*Propose items*, *+ Item*, *Add to backlog* on the route `backlog`), and **ITM-1186 and ITM-1187** (CLI
    sessions on the `bridge` section and in the bar). Each was "not built at this planning" until now. ITM-1186's
    Acceptance changes `tests/settings-pages-prompt-bar-note.test.mjs`.
  - Without a visible effect, ready and small: ITM-716 (`Route.reads` given the frame's snapshot), ITM-1298 (the hand-written
    schema copies go), and ITM-817 and ITM-1291 (their planning runs at sprint 124 found failing cases; see `team1/124.md`).
- **ITM-739 is now unblocked.** It builds on ITM-724, 729, 730 and 731, all done.
  - It is UC-023's system test and its release tests, a battery.
  - It is written only by a Developer who implemented none of ITM-724 and ITM-728 to ITM-731 (its Outcome; RELEASE TESTS
    ARE NOT WRITTEN BY THE IMPLEMENTER). Read who built each first, in the sprint records:
    - ITM-728 and ITM-729: developer-sonnet-f (`team2/86.md`, `team2/88.md`);
    - ITM-724: developer-sonnet-i (`team2/89.md`);
    - ITM-730: developer-opus-e (`team1/125.md`);
    - ITM-731: still to be read.
  - developer-sonnet-l implemented none of ITM-730 and wrote its release tests. Whether it built any of the others is
    still to be read.
- **The other ready items,** as in `team1/125.md`'s `## Not selected`:
  - ITM-600, 690, 800, 1138, 1170 and 1171: builds not made at planning;
  - ITM-351 and 446: a gap not read again;
  - ITM-518: its check cannot run here;
  - ITM-1271: its reader is not settled;
  - ITM-1287 and 1194: not reproduced;
  - ITM-561, 614, 1204 and 779: "not ready", a first task that can end in a draft, or a gap of the architecture;
  - the 20 batteries (ITM-266, 370 to 372, 375, 376, 448, 579, 580, 738, 740, 741, 771, 772, 774, 775, 805, 991, 1045 and
    1062), each with its authors to be read before it is selected.
- **Known flips.** A failed attempt on one of these alone, with a green rerun on the same commit, counts as CI green on
  the head. None of them is reproduced, so none has an item; once a run shows one again, its job's log gives the failure
  node.
  - ITM-1287 (`review-pages-release-limitations`);
  - `release-itm-1159-modules-labels`, under heavy local load;
  - TST-291007 (`mod-desktop-shell-settings`);
  - `desktop-shell.test.mjs`, past its job's limit after TST-276006;
  - TST-1240031 (`checkout-tools-bash`);
  - TST-2026271023 (`review-core`), flaky on `929c0f46` (this record);
  - TST-286004 (`tunnels-runtime`): one failure with `port-taken`, on `e8f85f74`, not yet two outcomes on one commit.
- **The agreements of sprints 123 to 125,** to apply at planning and to put in the brief:
  - **Sprint 123:**
    - before an item is said to wait for a draft, the reading that would let it be built against the accepted text is
      sought and written down;
    - a refactoring's commits are pushed one at a time, so that each gets its own pull-request run.
  - **Sprint 124:**
    - every known positive or counter-proof a declaration names is asserted in its case, and the writer checks this before
      pushing;
    - a Developer imports no function of a module that its module's Uses do not name, read at the level of the module as
      TST-106805 reads it.
  - **Sprint 125:** a Developer adds no top-level await to a module, and runs the tests of the modules that import its
    module, not only its own. CI runs Node 22; this machine runs Node 26, and an import cycle with a top-level await
    showed only on CI.
  - The older agreements (sprints 110 to 122) stand as `team1/125.md`'s brief lists them:
    - the planning stand-in;
    - the planning run, base beside change;
    - the Uses check with interface types;
    - reads counted;
    - a value added in its family's shape;
    - Bridge packages linked for the run.
- **Learned in sprint 125, for gates:**
  - A `Module:` line that joins modules with " · " or "; " is read as its first module only. One module per line, as
    MOD-test-document's Data gives it.
  - A source-reading test is acceptable where only the source can show what the Acceptance asks (TST-659001, as
    TST-1111001). A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT concerns only the SPEC, use cases and
    architecture files.
  - A red tests-only run with an extra failure elsewhere still counts as red for the item's reason, if the item's own
    cases fail for it (gate of #1501).
- **Things the records do not state plainly:**
  - The planning tools are in the scratchpad's `tools/`:
    - `state.py` and `ready.py`, the backlog's state;
    - `reader.mjs`, MOD-test-document's reader over files;
    - `prun.sh`, a planning run of a list: root, list, output prefix, regex of files to leave out.
  - Sprint 125's base and stand-ins are in the scratchpad's `po125/`.
  - An export made with `git archive` has no `.git`. Five Python checks error there, and pass in a checkout:
    `test_artifact_format`, `test_no_backend`, `test_pages_layout`, `test_release_sprint_02_d` and `test_self_sufficient`.
  - The scratchpad's `head/` folder was overwritten with an export of `f2430a50` during sprint 124's gates. Rebuild it
    before relying on it.
  - Files that hang on the planning machine: `release-uc-037-connect-mailbox`, `system-uc-037-connect-mailbox`,
    `system-uc-038-bridge-route`, `system-uc-039-bridge-route`, `release-uc-003-dashboard-https-bridge` and
    `system-uc-003-dashboard-bridge`.
  - Files that fail there with and without any change: `release-itm-269-endpoint-route`, and TST-367001 to TST-367003.
