---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 47a5e8e80f2f8f7aebfc3b1fb0b990df2ef90c65
  - https://github.com/akmaier/agent-m/pull/1541
  - docs/backlog/sprints/team1/129.md@6e2e0f5d7
date: 2026-10-31 04:06 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/129` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 129, pull request #1541 of `sprint/team1/129` into `main` at `47a5e8e8`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/129.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `6e2e0f5d7`, whose `Agent-M-Participant` is scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 41166723281 (`pull_request`, attempt 1) on `47a5e8e8` succeeds: 41 jobs
   succeed, 17 are skipped, and none failed.
3. **The run still stands for the merge.**
   - **What `main` gained since the run:**
     - the five gate records of this sprint, cherry-picked (`b12663018` to `5671a0382`);
     - akmaier's acceptance of MOD-trace-graph (`435ef6dd7`, which adds `docs/approvals/MOD-trace-graph-034c5a34a59b.md`,
       and `346633fe4`, which changes no file);
     - the close (`6e2e0f5d7`);
     - and, on this record's branch, the backlog commit `d3f5fe134`.
     - None of these changes code or a test.
   - **No conflict:** `git merge-tree --write-tree` exits 0.
   - **The trial merge.** I merged `origin/sprint/team1/129` into this record's branch in a checkout, uncommitted, and
     then aborted it. On it:
     - `python3 -m unittest` in `tests/` ran 180 cases, OK. The files: `test_approval_records`, `test_backlog_layout`,
       `test_backlog_item_fields`, `test_definition_of_done`, `test_parallel_sprints`, `test_no_history`,
       `test_artifact_format`, `test_participants`, `test_role_assignment`, `test_coverage_report`, `test_no_backend`,
       `test_pages_layout`, `test_self_sufficient`, `test_backlog_from_acceptance`, `test_architecture_review`,
       `test_correction_loop`, `test_wip_limit`, `test_time_box_selection`, `test_job_from_backlog` and
       `test_identifiers`.
     - `node --test` on `trace-graph-import-uses` (TST-106805), `test-document-one-line`, `product-process-gates`
       (TST-292101 among them), `dashboard-backlog-teams`, the sprint's changed and new test files, and
       `site-frame-preloads` gave 86 cases: 77 pass, 9 `todo` (ITM-803's findings), and none fail.
     - The repeat reading of MOD-test-document's `testDeclarations` found 5,848 declarations, 5,848 identifiers and 0
       repeats.
   - **Merge commits:** `git show --cc` of the sprint's four merge commits shows no text of their own.
4. **Every gate before the merge is recorded.**
   - **Development → Release testing:**
     - #1537 (ITM-1322) passed on `b9e64731`;
     - #1538 (ITM-1324) passed on `02809df7`;
     - #1539 (ITM-1323) passed on `1bd1d2ac`;
     - #1540 (ITM-803) passed on `f757807c`.
   - **Release testing → Sprint review** passed on `62916c73`
     (`docs/gates/20261031-0359-release-testing-sprint-review-e129.md`). `47a5e8e8` adds only that record.
5. **The close's feedback is entered.**
   - **For the Product Owner,** registered in this record's backlog commit `d3f5fe134`, from ITM-803's gate
     (`docs/gates/20261030-2035-development-release-testing-d803.md`). `git log --all -E -G 'ITM-13(2[5-9]|3[0-9])[^0-9]'
     -- docs src tests` finds no commit; the same search for ITM-1324 finds the sprint's records, its known positive.
     - **ITM-1325** (MOD-implementation-pages): what no item realises at the top of the backlog page (S2, TST-803004).
     - **ITM-1326** (MOD-implementation-pages): the other teams' held items beside the backlog without a plan open (S3,
       TST-803012).
     - **ITM-1327** (MOD-implementation-pages): a changed selection names what it adds and removes (S4, TST-803014).
     - **ITM-1328** (MOD-implementation-pages): in a planned model, `#backlog` links the plan and draws no backlog (S6,
       TST-803024).
     - **ITM-1329** (MOD-work-plans): a refused *Start sprint* leaves no branch (S5's branch).
     - **ITM-1330** (MOD-progress-measures): a sprint that has ended is drawn as ended (S7 with S8, TST-803019 and
       803020).
   - **A correction to my ruling at ITM-803's gate:** ITM-1330 is a new item, but it waits for a text. MOD-progress-measures'
     Uses do not name MOD-work-plans' `sprintsToClose`, and writing its rule again in `teamSprint` would keep it twice.
     The item names the sentence it needs.
   - **ITM-1321 is ready.** akmaier accepted MOD-trace-graph's text with its sentence on `graphFindings` (`435ef6dd7`), and
     ITM-1324 cleared the repeats. Its Readiness says so in the same commit.
   - **For akmaier:** S1, S5's naming and S9 (below). The other notes need no item: the 275 declarations whose `module:`
     names several modules, and `tests/test_gate_record.py`, which is ITM-805's.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who plans sprint 130 from the records alone.

- **Read first, in the original, with the Read tool:**
  - AGENTS.md, SPEC.md in full, docs/process.md and docs/process-models/scrum-wip.md;
  - the book's chapters 8, 9, 11, 12 and 13;
  - sprint records `team1/127.md` to `129.md` with their Retrospectives;
  - this record, and the five gate records of sprint 129: `docs/gates/20261030-2007-…-a1322.md`, `-b1324.md`, `-c1323.md`,
    `20261030-2035-…-d803.md` and `20261031-0359-release-testing-sprint-review-e129.md`;
  - docs/architecture/MOD-test-document.md, MOD-implementation-pages.md, MOD-trace-graph.md;
  - UC-032;
  - the items ITM-1321, ITM-1325 to ITM-1330, ITM-716 and ITM-805.
- **The state of the backlog on `main` once #1541 and this record's branch are merged.** It is derived from sprint 129's
  planning count (`team1/129.md`) and not recounted with the tool here.
  - **Items:** 1,078, ITM-1325 to 1330 the newest.
  - **Done:** 1,011, ITM-1324, 1322, 1323 and 803 the newest.
  - **Not done:** 67.
    - 49 are ready: the 43 that stayed, ITM-1321, and ITM-1325 to 1329.
    - 2 wait for a text:
      - ITM-857 (`team1/124.md`);
      - ITM-1330, which needs MOD-progress-measures' Uses to name `sprintsToClose`.
    - 11 wait for an item they build on, by the direct `builds_on` check: ITM-373, 374, 585, 700, 802, 804, 806, 818,
      1058, 1059 and 1061.
    - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715).
    - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
  - **The count tool** (`scratchpad/tools/state.py`, after `scratchpad/po127b/count.sh`) names #1481 (ITM-1267) and
    #1527 (MOD-trace-graph's draft for ITM-1321) by their titles. Neither item is done.
- **Ready candidates:**
  - **ITM-1321** (MOD-trace-graph; unit). Its text is accepted (`435ef6dd7`), and the repository holds no repeated test
    identifier. Its build and planning run are not made yet. Once it is done, the gates no longer need the repeat reading
    by hand.
  - **ITM-1325 to ITM-1328** (MOD-implementation-pages; unit): S2, S3, S4 and S6.
    - All four change `paint` in `src/implementation-pages/backlog.mjs`.
    - No two selected items write the same file (sprint 127's planning rule). So select one, or name their order and have
      each merge the sprint branch before its gate (sprint 128).
    - Each takes away its TST-8030nn `todo` in a commit of a participant who implemented none of it.
  - **ITM-1329** (MOD-work-plans; unit): no branch is left by a refused start. It writes `src/work-plans/saves.mjs` only.
  - **ITM-716:** it changes `readPlace` (`src/review-pages/common.mjs`) and what `load-per-view` counts for `#use-case`,
    TST-1319007 among them. Its build is not made.
  - **akmaier's requests:** ITM-1261 and 1267. They are builds of four and seven modules, not made at a planning yet.
    ITM-1267 names its CI time first.
  - **Others:**
    - ITM-600, 690, 800, 1138, 1170 and 1171, whose builds are not made;
    - the batteries whose authors are not read, ITM-805 among them, which holds `tests/test_gate_record.py`;
    - the rest as `team1/129.md`'s "Not selected" lists them.
- **For akmaier, open, and no item:**
  - **S1 (TST-803005):** an item's origin on its backlog row (UC-032 step 1). The route reads no item file, and
    MOD-progress-measures' `BacklogView` row has no origin, so it needs a change of that interface type.
  - **S5's naming (TST-803015):** a refused *Start sprint* naming the sprint, held item and module (UC-032 6c). The texts
    check the holds "at the view's commit" and write "on that commit", so a sprint committed after the view is refused
    as `Moved`.
  - **S9 (TST-803113):** whether a sprint's closer must be a participant. UC-032 6 and CLOSING A SPRINT CAN BE ASSIGNED
    TO A PARTICIPANT do not say that another closer is refused. Ask it only as a question.
  - **ITM-1330's sentence:** MOD-progress-measures' Uses naming `MOD-work-plans.sprintsToClose`. It is a draft for the
    architect and akmaier.
  - **UC-023 step 6 (TST-739013, UC023-S4):** after a decision's or module's *Accept*, the list of affected modules with
    their plan steps and backlog items. No accepted module text states it.
  - **The question of ITM-1317:** a requirement proposed as a change of itself, its rule unchanged apart from case and
    white space, keeps the class change. That follows MOD-documents.md:301-305 and reads against the letter of EXACT
    DUPLICATES ARE FOUND WITHOUT A MODEL (SPEC.md:276-278). Ask it only as akmaier's question.
  - **No longer open:** MOD-trace-graph's draft for ITM-1321, which akmaier accepted (`435ef6dd7`).
- **Known flips.** A failed attempt on one of these alone, with a green rerun on the same commit, counts as CI green on
  the head:
  - ITM-1287 (`review-pages-release-limitations`); `release-itm-1159-modules-labels`, under heavy local load;
  - TST-291007 (`mod-desktop-shell-settings`); `desktop-shell.test.mjs`, past its limit after TST-276006;
  - TST-276901 (`release-itm-276-desktop-shell`), past its 32 s;
  - TST-1240031 (`checkout-tools-bash`); TST-2026271023 (`review-core`);
  - TST-286004 (`tunnels-runtime`): one failure with `port-taken`, not yet two outcomes on one commit.
  - Not a test's: an attempt with jobs cancelled and no step failed, as run 41119086739's first. The records job's
    artifact download, as run 41112226901.
- **The agreements to apply at planning and to put in the brief:**
  - **Sprint 129:** a battery's finding that points into another module's code names that module's item, not the
    battery's.
  - **Sprint 128:** a merge commit that resolves a conflict is written with its author's trailers. Items that share a
    test file are merged in the order the plan names, and the next one merges the sprint branch before its gate.
  - **Sprint 127:** before a SPEC change touches an existing rule, its purpose is stated and confirmed with akmaier. A
    new test identifier is searched for in the history before it is used, with `git log --all -E -G <pattern> -- tests
    docs src`, checked against a known positive. `-E` is needed for `{3}`, and a `\b` matches nothing.
  - **Sprints 110 to 126** stand as `team1/129.md`'s brief lists them.
- **Learned in sprint 129, for gates:**
  - **A test-only item has no red first commit.** AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST binds a job "that adds
    or changes behaviour". The gate reads the DoD's clause with it, and planted faults stand in for the red run.
  - **A battery's `todo` cases are its findings.** Read each at its failure node, then rule it. A finding that needs an
    interface type, a Uses line or a write order the texts fix goes to akmaier. One a module can build within its text
    becomes an item. A reading that adds "only" is a question.
  - **Before ruling "a new item", read the Uses of the module that would build it.** ITM-1330 needed a Uses line.
- **Things the records do not state plainly:**
  - **Tools,** in the scratchpad:
    - `tools/` (`state.py`, `ready.py`, `reader.mjs`, `decls.mjs`, `prun.sh`);
    - `po127b/count.sh`;
    - `po128g/repeats.mjs`;
    - `po129g/` (`check.sh <commit> [files]` exports a commit and runs the reader with its control, then the repeat
      reading; `joined.mjs` counts declarations whose `module:` names several modules).
  - **Shell limits:** a worktree-isolated agent's shell refuses compound commands that name git or gh, and commands
    with a computed argument. Write a script to a file and run `bash <file>`.
  - **The Product Owner's checkout:** the primary working tree stays on `main`. Gate records are written in a worktree
    of the Product Owner's own under `.agent/worktrees/`.
  - **Exports without `.git`:** an export made with `git archive` has no `.git`, so the Python checks that need it, and
    TST-106805, fail there. Run them on a trial merge in the agent's own checkout (`git merge --no-commit`, then
    `git merge --abort`).
  - **Files that hang** on the planning machine are read on CI: `release-uc-037-connect-mailbox`,
    `system-uc-037-connect-mailbox`, `system-uc-038-bridge-route`, `system-uc-039-bridge-route`,
    `release-uc-003-dashboard-https-bridge` and `system-uc-003-dashboard-bridge`.
