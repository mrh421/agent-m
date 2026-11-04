---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9306f29bd2f21dce8d0a7169fa20a157a8b581fa
  - https://github.com/akmaier/agent-m/pull/1536
  - docs/backlog/sprints/team1/128.md@4e2688108
date: 2026-10-30 19:45 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/128` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 128, pull request #1536 of `sprint/team1/128` into `main` at `9306f29b`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/128.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `4e2688108`, whose `Agent-M-Participant` is scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 41115892504 (`pull_request`, attempt 1) on `9306f29b` succeeds: 41 jobs
   succeed, 17 are skipped, none failed.
3. **The run still stands for the merge.**
   - The run started at 19:31 UTC. Since then, `main` has gained this sprint's three gate records, cherry-picked
     (`d4dd6b900`, `01a0ed775`, `95686bdba`), and the close (`4e2688108`). None changes code or a test.
   - The merge has no conflict (`git merge-tree --write-tree`, exit 0).
   - `origin/main` with this record's backlog commit was merged with `9306f29b` in a checkout, uncommitted, and then
     aborted. On it:
     - `python3 -m unittest` in `tests/`, 137 cases, OK. The files: `test_approval_records`, `test_backlog_layout`,
       `test_backlog_item_fields`, `test_definition_of_done`, `test_parallel_sprints`, `test_no_history`,
       `test_artifact_format`, `test_participants`, `test_role_assignment`, `test_coverage_report`, `test_no_backend`,
       `test_pages_layout`, `test_self_sufficient`, `test_backlog_from_acceptance`, `test_architecture_review` and
       `test_correction_loop`.
     - `node --test` on `trace-graph-import-uses` (TST-106805): 5 pass.
     - In an export of the same merge: `dashboard-backlog-teams`, `release-sprint-02-b-work-items`,
       `test-document-one-line`, `product-process-gates` (TST-292101 among them), `system-uc-023-modify-the-architecture`
       and the five release files of the sprint. 72 cases with TST-106805: 70 pass, 1 `todo` (TST-739013), and only
       TST-106805 fails, for want of `.git`. In the checkout it passes.
4. **Every gate before the merge is recorded.**
   - **Development → Release testing:**
     - #1530 (ITM-1316) passed on `11160197`;
     - #1529 (ITM-1320) passed on `fe06a650`;
     - #1528 (ITM-1318) passed on `0424952a`;
     - #1531 (ITM-1319) was rejected on `9e9c87e9` for the reads of one page load, and passed on `20a7a9c1`.
   - **Release testing → Sprint review** passed on `068a8cf7`
     (`docs/gates/20261030-1930-release-testing-sprint-review-e128.md`). `9306f29b` adds only that record.
5. **The close's feedback is entered.**
   - **For the Product Owner,** registered in this record's backlog commit:
     - **ITM-1323** (MOD-review-pages; release): *Accept ticked* and *Accept all N shown* in a pulled product, each run
       with two use cases. TST-131920[5-9] and TST-13192nn are free in the history; its known positive is TST-1319204's
       `65b879c7c`.
     - **ITM-1324** (MOD-site-frame; unit): ITM-1290's two cases in `site-frame-schema-form-missing-key` take
       TST-1290011 and 1290012, which are free in the history; its known positive is TST-1290003's `66afb81ff`.
   - **For akmaier:** UC-023 step 6, the list of affected modules after a decision's *Accept*, stays unbuilt and
     `todo` (TST-739013). akmaier's answer on S4 concerned UC-008, which ITM-1319 built.
   - The other notes need no item: the return of #1531, the trailerless merge `82cf005b3`, which the Retrospective
     answers with an agreement, a report that named reads it had not made, and the records job's artifact download.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who plans sprint 129 from the records alone.

- **Read first, in the original, with the Read tool:**
  - AGENTS.md, SPEC.md in full, docs/process.md and docs/process-models/scrum-wip.md;
  - the book's chapters 8, 9, 11, 12 and 13;
  - sprint records `team1/126.md` to `128.md` with their Retrospectives;
  - this record, and the six gate records of sprint 128: `docs/gates/20261030-1832-…-a1316.md`, `-b1320.md`,
    `-c1318.md`, `-d1319r.md`, `-1850-…-d1319.md` and `-1930-release-testing-sprint-review-e128.md`;
  - docs/architecture/MOD-test-document.md;
  - the items ITM-1321 to ITM-1324, ITM-716 and ITM-803.
- **The state of the backlog on `main` once #1536 and this record's branch are merged.** These are not recounted with
  the tool here; they follow from sprint 128's planning count (`team1/128.md`).
  - There are 1,072 items, ITM-1323 and 1324 the newest. 1,007 are done, ITM-1319, 1318, 1320 and 1316 the newest, and
    65 are not.
  - The count tool (`scratchpad/tools/state.py`, after `scratchpad/po127b/count.sh`) names #1481 (ITM-1267) and #1519
    (ITM-1319) by their titles. ITM-1319 is now done; ITM-1267 is not.
  - Waiting: ITM-857 and ITM-1321 for a text (MOD-trace-graph's sentence, open for akmaier since `ccbd0800c`); the 11
    of the `builds_on` check; ITM-598 and 648, held by stale pull requests; and ITM-237, 267 (with 374) and 632, which
    need a person.
- **Ready candidates:**
  - **ITM-1322** (MOD-prompt-bar's tests): two `guards` lines and the header. Its stand-in moved no case.
  - **ITM-1323** (MOD-review-pages; release): new test file only, by a participant who implemented none of ITM-1319.
  - **ITM-1324** (MOD-site-frame; unit): two declaration lines. ITM-1321's Acceptance needs it done first.
  - **ITM-803:** it follows ITM-1316, which is done now. Its system test walks every flow of UC-032. Its authors are not
    yet read.
  - **ITM-716:** it changes `readPlace` (`src/review-pages/common.mjs`). ITM-1319's pages are merged now, so it can be
    read again; it changes what `load-per-view` counts for `#use-case`, TST-1319007 among them.
  - The rest as `team1/128.md`'s "Not selected" lists them.
- **For akmaier, open, and no item:**
  - **UC-023 step 6 (TST-739013, UC023-S4):** after a decision's or module's *Accept*, the list of affected modules with
    their plan steps and backlog items. No accepted module text states it; it waits for akmaier.
  - **The question of ITM-1317:** a requirement proposed as a change of itself, its rule unchanged apart from case and
    white space, keeps the class change. That follows MOD-documents.md:301-305 and reads against the letter of EXACT
    DUPLICATES ARE FOUND WITHOUT A MODEL (SPEC.md:276-278). Ask it only as akmaier's question.
- **Known flips.** A failed attempt on one of these alone, with a green rerun on the same commit, counts as CI green on
  the head:
  - ITM-1287 (`review-pages-release-limitations`); `release-itm-1159-modules-labels`, under heavy local load;
  - TST-291007 (`mod-desktop-shell-settings`); `desktop-shell.test.mjs`, past its limit after TST-276006;
  - TST-1240031 (`checkout-tools-bash`); TST-2026271023 (`review-core`);
  - **TST-276901** (`release-itm-276-desktop-shell`), an Electron case past its 32 s, since the gate of ITM-1318;
  - TST-286004 (`tunnels-runtime`): one failure with `port-taken`, not yet two outcomes on one commit.
  - The records job's artifact download failed on #1535 (run 41112226901). It is CI's, not a test's.
- **The agreements to apply at planning and to put in the brief:**
  - **Sprint 128:** a merge commit that resolves a conflict is written with its author's trailers. Items that share a
    test file are merged in the order the plan names, and the next one merges the sprint branch before its gate.
  - **Sprint 127:** before a SPEC change touches an existing rule, its purpose is stated and confirmed with akmaier. A
    new test identifier is searched for in the history before it is used (`git log --all -G <pattern> -- tests docs
    src`, checked against a known positive; without the paths the search runs for minutes).
  - **Sprints 110 to 126** stand as `team1/128.md`'s brief lists them.
- **Learned in sprint 128, for gates:**
  - **Count a page's requests at the Development gate** in a fixture that takes the path the item adds. ITM-1319's
    first head passed CI and broke A PAGE LOAD READS THE REPOSITORY IN BATCHES only in a pulled product.
  - **At the release gate, read the test declarations of the whole repository for repeats,** until ITM-1321 is built.
    Use `scratchpad/po128g/repeats.mjs` in an export, with sprint 127's `1f663e6d` as its known positive. On `main` it
    finds TST-1290001 and 1290002 until ITM-1324 is done.
  - **A release test names what it does not cover** (#1535). Rule each such gap at the gate, as sprint 126's agreement
    asks.
  - **Read every merge commit's `git show --cc`.** A conflict resolution writes text, and a branch update by GitHub
    writes none.
  - **Runs' job logs can be gone** (`BlobNotFound`). The run's result record on `test-results` names its run, and gives
    each test's outcome.
- **Things the records do not state plainly:**
  - **Tools,** in the scratchpad: `tools/` (`state.py`, `ready.py`, `reader.mjs`, `decls.mjs`, `prun.sh`),
    `po127b/count.sh`, and `po128g/` (`repeats.mjs`, `export.sh`, `runs.sh`, `files.sh`, `mergecheck.sh`).
  - **A worktree-isolated agent's shell refuses compound commands that name git or gh,** and commands with a computed
    argument. Write a script to a file and run `bash <file>`.
  - An export made with `git archive` has no `.git`. The Python checks that need it, and TST-106805, fail there. Run
    them on a trial merge in the agent's own checkout (`git merge --no-commit`, then `git merge --abort`).
  - These files hang on the planning machine and are read on CI: `release-uc-037-connect-mailbox`,
    `system-uc-037-connect-mailbox`, `system-uc-038-bridge-route`, `system-uc-039-bridge-route`,
    `release-uc-003-dashboard-https-bridge` and `system-uc-003-dashboard-bridge`.
