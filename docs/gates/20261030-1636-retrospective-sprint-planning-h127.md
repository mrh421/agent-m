---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 4ae521d6107b30f0662fd7f6da310c0c67e3c306
  - https://github.com/akmaier/agent-m/pull/1525
  - docs/backlog/sprints/team1/127.md@ecbb24c69
date: 2026-10-30 16:36 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/127` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 127, pull request #1525 of `sprint/team1/127` into `main` at `4ae521d6`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/127.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `ecbb24c69`, whose `Agent-M-Participant` is scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 41090473005 (`pull_request`, attempt 1) on `4ae521d6` succeeds: 41 jobs
   succeed, 17 are skipped, none failed.
3. **The run still stands for the merge.**
   - The run started at 16:30 UTC. Since then, `main` has gained the close (`ecbb24c69`, 16:31 UTC). Before it, `main`
     gained this sprint's gate records, cherry-picked (`185fd734f` to `91164fcc3`), with UC-023's acceptance
     (`cebe3653a`).
   - The merge has no conflict (`git merge-tree --write-tree origin/main 4ae521d61`, exit 0).
   - On `origin/main` merged with `4ae521d6` locally, in a checkout, with this record's backlog commit in the tree:
     - `python3 -m unittest` in `tests/`, 123 cases, OK, for:
       - `test_approval_records`, `test_backlog_layout`, `test_backlog_item_fields`, `test_definition_of_done`;
       - `test_parallel_sprints`, `test_no_history`, `test_artifact_format`, `test_participants`;
       - `test_role_assignment`, `test_coverage_report`, `test_no_backend`, `test_pages_layout`, `test_self_sufficient`.
     - `node --test`, 74 cases: 72 pass, 2 `todo` (TST-739011 and 739013, UC023-S3 and S4), 0 fail. The files:
       - `trace-graph-import-uses` (TST-106805), `dashboard-backlog-teams`, `release-sprint-02-b-work-items`;
       - `test-document-one-line`, and `product-process-gates` (TST-292101 among them);
       - `system-uc-023-modify-the-architecture`, and the four release tests of the sprint.
4. **Every gate before the merge is recorded.**
   - **Development → Release testing,** each passed on its first round:
     - #1515 (ITM-1315), on `b7c84cef`;
     - #1516 (ITM-782), on `b6d5c0bd`;
     - #1520 (ITM-1317), on `0a86fdc4`;
     - #1518 (ITM-1187), on `6ba155f9`.
   - **Release testing → Sprint review:**
     - rejected on `1f663e6d`, since two test cases shared each of TST-1187101 to 1187104 (`…-1051-…-e127r.md`);
     - passed on `7a3bbcc5` once #1526 renamed the release cases (`…-1629-…-e127.md`).
     - `4ae521d6` adds only that record to it.
5. **The close's feedback is entered.**
   - **For the Product Owner:**
     - the check that one test identifier names one test case is **ITM-1321**, of MOD-trace-graph;
     - TST-1360003 and 1360004's guards by a step are **ITM-1322**, of MOD-prompt-bar.
     - Both are registered in `43df53eb6`, on this record's branch.
   - **For akmaier:** the open point of ITM-1317 stays noted (below).
   - The other notes need no item: the gate record's form, and the files the planning run of ITM-1187 could not run.
   - UC023-S1 to S4 are ruled. S1 is done with ITM-1317. S2 to S4 are ITM-1318, 1320 and 1319.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who plans sprint 128 from the records alone.

- **Read first, in the original, with the Read tool:**
  - AGENTS.md, SPEC.md in full, docs/process.md and docs/process-models/scrum-wip.md;
  - the book's chapters 8, 9, 11, 12 and 13;
  - sprint records `team1/125.md` to `127.md` with their Retrospectives;
  - this record, and the six gate records of sprint 127:
    - `docs/gates/20261030-0912-…-a1315.md`, `-0927-…-b782.md`, `-1003-…-d1317.md`, `-1013-…-c1187.md`;
    - `-1051-release-testing-sprint-review-e127r.md` and `-1629-…-e127.md`;
  - docs/architecture/MOD-test-document.md;
  - the items ITM-1316, 1318, 1319, 1320, 1321 and 1322.
- **The state of the backlog on `main` once #1525 and this record's branch are merged.** The count tool is
  `scratchpad/tools/state.py`, run after `scratchpad/po127b/count.sh` refreshes `merged.json` and `open.json`.
  - There are 1,070 items. 1,003 are done, ITM-1315, 782, 1187 and 1317 the newest, and 67 are not.
  - The tool names 1,005 done. #1481 names ITM-1267 in its title and #1519 names ITM-1319, and neither item is done.
  - The 67 not done:
    - **11 wait for an item they build on,** by the direct `builds_on` check: ITM-373, 374, 585, 700, 802, 804, 806, 818,
      1058, 1059 and 1061.
    - **2 are held by stale pull requests:** ITM-598 (#697) and ITM-648 (#715).
    - **2 wait for a text:**
      - ITM-857 (`team1/124.md`);
      - ITM-1321, which needs MOD-trace-graph's `graphFindings` to name the check. The reading was sought and is in the
        item.
    - **3 need a person:** ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
    - **49 are ready,** counted as before, ITM-1316, 1318, 1319, 1320 and 1322 among them.
    - ITM-803 no longer waits by the `builds_on` check. Its item is not read here.
  - **Acceptance:** every use case, module file and decision on `main` is accepted.
    - UC-008 is accepted by `a52aff870` and UC-023 by `cebe3653a`.
    - MOD-job-catalogue, MOD-job-runner, MOD-prompt-bar, MOD-review-pages and MOD-work-plans are accepted by
      `1b539d0fe`.
  - **Other teams:** none holds a sprint open (`team2/105.md` holds its `## Review`).
- **Ready candidates, each with an effect akmaier ruled on:**
  - **ITM-1318** (MOD-job-catalogue; UC023-S2): `review-architecture` names `whole-architecture`.
    - Its planning run was made in sprint 127 on `d27b1e408` and is in the item. It moves 11 Node cases in 6 files and two
      Python checks. TST-739209 and 739210 lose their `todo`.
    - `main` has moved since; run it again before selection.
  - **ITM-1319** (MOD-review-pages, MOD-job-catalogue, MOD-work-plans; UC023-S4 as UC-008 step 6): accepting a use case
    runs `check-affected-modules` and adds the items.
    - Its texts are accepted. **Its planning stand-in and run are still to be made.**
    - It touches three modules and a new Python check, `tests/test_backlog_from_acceptance.py`.
  - **ITM-1320** (MOD-prompt-bar, MOD-job-runner; UC023-S3): `prepareJob` takes `selfReview`, and the bar's in-tab
    hand-over of a kind with reviewers reviews with the participant itself.
    - TST-739011 loses its `todo`.
    - Its planning run is still to be made.
  - **Shared file:** ITM-1318 and ITM-1320 both change `tests/test_architecture_review.py`. Whichever is merged second
    makes its change on top of the other's, as ITM-1187 and ITM-1317 did with the UC-023 system test.
  - **Shared module:** ITM-1318 and ITM-1319 both change MOD-job-catalogue. They write different files: `review-architecture`'s
    kind and prompt, and a new kind. Planning checks that no two selected items write one file.
  - **ITM-1316** (MOD-work-plans, MOD-implementation-pages): UC-032 1a, the mark of a withdrawn or changed requirement.
    - It is unblocked, since ITM-782 is done.
    - Its planning run is still to be made. MOD-work-plans' `itemStates` gives a done item no `reason` today
      (`src/work-plans/states.mjs:173-179`). That is the gap the item builds.
    - If it is selected with ITM-1319, both change MOD-work-plans: read the files each writes.
  - **ITM-1322** (MOD-prompt-bar's tests): two `guards` lines and the file's header.
    - It is small, changes no expected result, and needs no stand-in.
    - It writes `tests/prompt-bar-one-kind.test.mjs`, which ITM-1320's run may also move. Read that first.
  - Not selected before, with their reasons in `team1/127.md`'s `## Not selected`:
    - ITM-1261 and 1267, akmaier's requests: builds of four and seven modules;
    - ITM-716, which ITM-1315 kept out by its file. That file is merged now, so ITM-716 can be read again.
    - ITM-1298, whose reading does not hold;
    - ITM-1256, for which no reading meets A CONFLICT IS DECIDED BY A PERSON;
    - ITM-817 and 1291, with failing cases from their planning runs at sprint 124;
    - ITM-518, whose check's list is not read;
    - the 20 batteries, whose authors are not read.
- **For akmaier, open, and no item:** the question of ITM-1317.
  - A requirement proposed as a change of itself, its rule unchanged apart from case and white space, now keeps the class
    change.
  - That follows MOD-documents.md:301-305, and it reads against the letter of EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
    (SPEC.md:276-278).
  - TST-1317004 asserts the behaviour as built, and no release test asserts either answer.
  - Ask it only as akmaier's question: it needs a sentence of the SPEC or of MOD-documents.
- **Known flips.** A failed attempt on one of these alone, with a green rerun on the same commit, counts as CI green on
  the head. None was reported to this Product Owner as flipping in sprint 127, and the sprint's runs were not read for
  flips here. None is reproduced, so none has an item.
  - ITM-1287 (`review-pages-release-limitations`);
  - `release-itm-1159-modules-labels`, under heavy local load;
  - TST-291007 (`mod-desktop-shell-settings`);
  - `desktop-shell.test.mjs`, past its job's limit after TST-276006;
  - TST-1240031 (`checkout-tools-bash`). Twice now; its job log names the process tree's kill after SIGTERM.
  - TST-2026271023 (`review-core`);
  - TST-286004 (`tunnels-runtime`): one failure with `port-taken`, not yet two outcomes on one commit.
- **The agreements of sprints 125 to 127,** to apply at planning and to put in the brief:
  - **Sprint 125:** a Developer adds no top-level await to a module, and runs the tests of the modules that import its
    module, not only its own. CI runs Node 22; this machine runs Node 26.
  - **Sprint 126:** a battery's findings, and a finding a release test names, are each ruled at its gate — already
    registered, a new item, or for akmaier.
  - **Sprint 127:**
    - before a SPEC change touches an existing rule, its purpose is stated and confirmed with akmaier;
    - a new test identifier is searched for in the history before it is used. Use `git log --all -S <TST-…>`, checked
      against a known positive.
  - The agreements of sprints 110 to 124 stand as `team1/127.md`'s brief lists them.
- **Learned in sprint 127, for gates:**
  - **A gate record's `decision` is `passed` or `rejected`, nothing else.** TST-292101 counts the records that depart from
    the form. A record is written once (A RECORD IS EVIDENCE, NOT A PROPOSAL, SPEC.md:832-833). A malformed one is
    written again under a name of its own, and the malformed file is removed (`f2bbaa25d`).
  - **At the release gate, read the sprint's test declarations for repeats,** until ITM-1321 is built. MOD-test-document's
    reader checks one declaration at a time.
  - **A planning run that leaves out the files that hang locally does not see what the change moves in them.** In sprint
    127 those were `system-uc-037`, `release-uc-037` and `uc-039-world`. Their CI result is read before the Acceptance is
    written, or the Acceptance names them as unread.
  - **A fixed port in a test** collides only within one shard's job, since each CI shard is a runner of its own. Search
    the tests for another bind of the same port. Port 0 is safe.
  - **An exemption a test makes for the bar's two `testBridge` requests** holds only if the path it exempts is sent by no
    other path of the page. Read the senders of `/v1/pair` and `/v1/agents` (`src/bridge-client/index.mjs`).
- **Things the records do not state plainly:**
  - **Tools,** in the scratchpad:
    - `tools/`, as before: `state.py`, `ready.py`, `reader.mjs` and `prun.sh`.
    - `po127b/`:
      - `count.sh`, which refreshes the pull-request lists and counts;
      - `runs.sh <run>…`, each run's head, event and jobs;
      - `run.sh`, `plant.py` and `plants.sh`, the planted faults of ITM-1187's gate, as a pattern.
  - **A worktree-isolated agent's shell refuses compound commands that name git or gh,** and commands with a computed
    argument. Write a script to a file and run `bash <file>`, or split the commands.
  - An export made with `git archive` has no `.git`. The Python checks named in `team1/126.md`'s handover error there and
    pass in a checkout.
  - These files hang on the planning machine and are read on CI:
    - `release-uc-037-connect-mailbox`, `system-uc-037-connect-mailbox`;
    - `system-uc-038-bridge-route`, `system-uc-039-bridge-route`;
    - `release-uc-003-dashboard-https-bridge`, `system-uc-003-dashboard-bridge`.
