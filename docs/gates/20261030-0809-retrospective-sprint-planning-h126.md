---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - dea1731858301b2ccf296ad38f021f3385c80369
  - https://github.com/akmaier/agent-m/pull/1513
  - docs/backlog/sprints/team1/126.md@89ef87401
date: 2026-10-30 08:09 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/126` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 126, pull request #1513 of `sprint/team1/126` into `main` at `dea17318`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/126.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `89ef87401`, whose subject names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 41023826011 (`pull_request`, attempt 1) on `dea17318` succeeds: 41 jobs
   succeed, 17 are skipped, none failed.
3. **The run still stands for the merge.**
   - Since `7edde6e93`, the merge base, `main` has gained this sprint's four gate records, cherry-picked (`e703f2431` to
     `41e47ba66`), and the close.
   - The merge has no conflict (`git merge-tree --write-tree origin/main dea173185`, exit 0).
   - On `origin/main` merged with `dea17318` locally, in a checkout, the checks that read those files pass:
     - `python3 -m unittest` in `tests/` for the following, OK:
       - `test_approval_records`, `test_backlog_layout`, `test_backlog_item_fields`, `test_definition_of_done`;
       - `test_parallel_sprints`, `test_no_history`, `test_artifact_format`, `test_participants`;
       - `test_role_assignment`, `test_coverage_report`, `test_no_backend`, `test_pages_layout`, `test_self_sufficient`.
     - `node --test` for the following: 55 tests, 51 pass, 4 `todo`, 0 fail:
       - `trace-graph-import-uses` (TST-106805), `dashboard-backlog-teams`, `release-sprint-02-b-work-items`;
       - `test-document-one-line`;
       - `system-uc-023-modify-the-architecture`, and the release tests of ITM-1314 and ITM-1186.
4. **Every gate before the merge is recorded.**
   - Development → Release testing, each passed on its first round:
     - #1508 (ITM-1314), on `ca9e9b6f`;
     - #1509 (ITM-1186), on `83838661`;
     - #1510 (ITM-739), on `c5dc42e8`.
   - Release testing → Sprint review: passed on `0c46a0ca`. `dea17318` adds only that gate's record to it.
5. **The close's feedback is entered.**
   - Its item for the Product Owner, UC023-S5, is ITM-1315 (`e2ea0601c`, on this record's branch).
   - UC023-S1 to S4 are noted for akmaier.
   - The flip of TST-1240031 is noted, and needs no item.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who plans sprint 127 from the records alone.

- **Read first, in the original, with the Read tool:**
  - AGENTS.md, SPEC.md in full, docs/process.md and docs/process-models/scrum-wip.md;
  - the book's chapters 8, 9, 11, 12 and 13;
  - sprint records `team1/124.md` to `126.md` with their Retrospectives;
  - this record and the four gate records of sprint 126 (`docs/gates/20261030-0725-…-a1314.md`, `-0738-…-b1186.md`,
    `-0753-…-c739.md`, `-0802-…-e126.md`);
  - docs/architecture/MOD-test-document.md.
- **The state of the backlog on `main` once #1513 is merged** (the count tool, `scratchpad/tools/state.py`, after
  `gh pr list` refreshes `merged.json` and `open.json`).
  - Of the 1,063 items, 999 are done, ITM-1314, 1186 and 739 the newest, and 64 are not.
  - The tool names 1,000 done, since the merged draft pull request #1481 names ITM-1267 in its title. ITM-1267 is not
    done.
  - The 64 not done:
    - 46 are ready, ITM-1315 among them. It builds on ITM-739, done once #1513 is merged.
    - 12 wait for an item they build on, by the direct `builds_on` check: ITM-373, 374, 585, 700, 802, 803, 804, 806, 818,
      1058, 1059 and 1061.
    - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715).
    - 1 waits for a text: ITM-857 (`team1/124.md`).
    - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
  - `docs/architecture/` is wholly accepted; no draft stands open.
  - No other team holds a sprint open (`team2/105.md` holds its `## Review`).
- **Two Developers had no item in sprint 126,** developer-opus-f and developer-sonnet-k, since only three ready items
  could be built without most of their work at planning (`team1/126.md`, "Three items, not four"; Retrospective).
  - Look harder for buildable items: make the stand-ins of the larger visible builds below, one of them at least, rather
    than set them aside as "not made at this planning".
  - A stand-in that shows the test changes is the item's planning run, however large the build.
- **Ready candidates with an effect akmaier sees,** each still to be read against every agreement below:
  - **ITM-1315** (MOD-review-pages; new, from sprint 126's close). A file that rests on what is not accepted shows
    *Accept* disabled beside the names of what is open (UC-023 4b).
    - `offerAcceptance` returns before any *Accept* today (`src/review-pages/flow.mjs:610-618`).
    - TST-739012 loses its `todo`, and TST-739001's `FLOW_FINDINGS` entry moves to `FLOW_EVIDENCE`. Both are changed by a
      participant who implemented none of the item: they are developer-sonnet-l's system test.
    - TST-739104 must stay green: "offers no Accept that can be pressed".
    - Small; a stand-in is quick.
  - **ITM-1187** (MOD-prompt-bar): the bar offers this browser's endpoints and CLI sessions, and reads no participant list
    for the offer (MOD-prompt-bar.md:190-191, :207-208).
    - ITM-1186 now lets a person declare `session:<bridge>:<agent>`, so the offer has its data.
    - Its build changes every system and release test whose bar is offered through `docs/participants.md`. TST-377010
      asserts the link to `participants` that the item moves to `endpoints`. TST-377016 and 377017 lose their `todo`.
    - The planning run names them. Release-test changes go to developer-sonnet-l.
  - **ITM-782** (MOD-implementation-pages): *Propose items* with *Add to backlog*, *+ Item*, and an item pointed at a
    replacing requirement, on the route `backlog`.
    - The kind `propose-items`, its check `backlog-checks` and its writer `backlog-items` exist (`src/work-plans/`).
    - MOD-implementation-pages' Uses name `runPanel`, `schemaForm`, `prepareJob`, `writeResult` and `saveItems`.
    - The issue route's run section (`src/maintenance-pages/issues.mjs`, `runSection`, `moveSection`) is a pattern to
      read; its code is another module's and is not imported.
  - **ITM-1261 and ITM-1267**, akmaier's requests: builds of four and seven modules. ITM-1267 names its CI time first;
    read sprint 120's stop record on it (`team1/120.md`) before it is selected.
  - **ITM-1256** stays blocked. Its reading is in the item, and no reading meets A CONFLICT IS DECIDED BY A PERSON
    (SPEC.md:296-298): "shown beside it, with both sources and their authority". MOD-maintenance-pages names no function
    that gives an existing requirement's sources.
  - Without a visible effect, ready:
    - ITM-716 (`Route.reads` given the frame's snapshot);
    - ITM-1298. Read whether `artifactSchemaOf` also matches plan items under `docs/plan/` before its reading is relied
      on.
    - ITM-817 and ITM-1291: their sprint-124 planning runs found failing cases (`team1/124.md`).
- **Waiting for akmaier, not ruled yet** (ITM-739's gate, `docs/gates/20261030-0753-development-release-testing-c739.md`;
  `team1/126.md`, Review). Each needs a change of the SPEC or the architecture. None is an item, and none is to be asked
  as a draft by the PO. Their `todo` cases stay as they are.
  - **UC023-S1** (TST-739010): a change of a module, or of a decision that keeps its title, is refused as a duplicate of
    itself. MOD-documents keys a module by `id` and a decision by `title`, and `classifyCandidates` decides by rule.
    EXACT DUPLICATES ARE FOUND WITHOUT A MODEL and A CHANGE IS PROPOSED UNDER THE EXISTING NAME meet on the same name.
  - **UC023-S2** (TST-739209, 739210): `review-architecture` has no `whole-architecture` recipe
    (MOD-job-catalogue.md:92).
  - **UC023-S3** (TST-739011): *Describe the change* from the bar chooses no reviewing participant.
  - **UC023-S4** (TST-739013): no module states UC-023 step 6, the affected modules listed after Accept.
- **The other ready items,** as in `team1/126.md`'s `## Not selected`:
  - ITM-600, 690, 800, 1138, 1170 and 1171: builds not made at planning;
  - ITM-351 and 446: a gap not read again;
  - ITM-518: its check's list not read;
  - ITM-1271: its reader is not settled;
  - ITM-1287 and 1194: not reproduced;
  - ITM-561, 614, 1204 and 779: "not ready", a first task that can end in a draft, or a gap of the architecture;
  - the 20 batteries (ITM-266, 370 to 372, 375, 376, 448, 579, 580, 738, 740, 741, 771, 772, 774, 775, 805, 991, 1045 and
    1062), each with its authors to be read before it is selected. ITM-739 shows how: the builders read in the sprint
    records and the commits' `Agent-M-Participant` trailers.
- **Known flips.** A failed attempt on one of these alone, with a green rerun on the same commit, counts as CI green on
  the head. None is reproduced, so none has an item. Once a run shows one again, its job's log gives the failure node.
  - ITM-1287 (`review-pages-release-limitations`);
  - `release-itm-1159-modules-labels`, under heavy local load;
  - TST-291007 (`mod-desktop-shell-settings`);
  - `desktop-shell.test.mjs`, past its job's limit after TST-276006;
  - TST-1240031 (`checkout-tools-bash`): twice now, the second on `0c46a0ca` (run 41023092796);
  - TST-2026271023 (`review-core`), flaky on `929c0f46`;
  - TST-286004 (`tunnels-runtime`): one failure with `port-taken`, on `e8f85f74`, not yet two outcomes on one commit.
- **The agreements of sprints 124 to 126,** to apply at planning and to put in the brief:
  - **Sprint 124:**
    - every known positive or counter-proof a declaration names is asserted in its case, and the writer checks this before
      pushing;
    - a Developer imports no function of a module that its module's Uses do not name, read at the level of the module as
      TST-106805 reads it.
  - **Sprint 125:** a Developer adds no top-level await to a module, and runs the tests of the modules that import its
    module, not only its own. CI runs Node 22; this machine runs Node 26.
  - **Sprint 126:** a battery's findings are each ruled at its gate — already registered, a new item, or for akmaier — so
    that the close carries every one with its owner.
  - The older agreements (sprints 110 to 123) stand as `team1/126.md`'s brief lists them:
    - the planning stand-in, in the shape of the module's existing values;
    - the planning run, base beside change, of the path readers and of the modules that call or import the changed one;
    - the Uses check with interface types;
    - reads counted;
    - a refactoring's commits pushed one at a time;
    - the reading sought before an item is said to wait for a draft;
    - Bridge packages linked for the run.
- **Learned in sprint 126, for gates:**
  - A part file of a module may export to another part of the same module, as `participants.mjs` exports `PRESETS` to
    `bridge.mjs`. The module's interface is its `provides:` and `index.mjs`, which do not change. That is how a preset is
    taken "not a copy".
  - A battery item has no red commit. Its counter-proofs are planted faults, recorded in the pull request, and the gate
    plants some of its own.
  - A test-only item's branch may stand behind the sprint branch. Its `pull_request` run merges the base. Read the run's
    head and, if in doubt, run its files on the sprint branch merged locally.
- **Things the records do not state plainly:**
  - The planning tools are in the scratchpad's `tools/`:
    - `state.py` and `ready.py`, the backlog's state;
    - `reader.mjs`, MOD-test-document's reader over files;
    - `prun.sh`, a planning run of a list: root, list, output prefix, regex of files to leave out.
  - Sprint 126's planning material is in the scratchpad's `po126/`:
    - the base export, the stand-ins `h1314` and `h1186`, their lists and runs;
    - `probes/list.py`, a run's list by patterns;
    - `probes/cmp.py`, the cases that fail only with a change;
    - `probes/decl.mjs`, the reader that prints a declaration's `given`, `input` and `expect`.
  - An export made with `git archive` has no `.git`. These error there and pass in a checkout:
    - the Python checks `test_artifact_format`, `test_no_backend`, `test_pages_layout`, `test_release_sprint_02_d` and
      `test_self_sufficient`;
    - the Node files `trace-graph-uses-provided` and `test-schedule-own-ci`.
  - Files that hang on the planning machine: `release-uc-037-connect-mailbox`, `system-uc-037-connect-mailbox`,
    `system-uc-038-bridge-route`, `system-uc-039-bridge-route`, `release-uc-003-dashboard-https-bridge` and
    `system-uc-003-dashboard-bridge`.
  - Files that fail there with and without any change: `release-itm-269-endpoint-route`, and the cases of the desktop
    composition and of Electron, TST-367001 to TST-367003 among them.
  - A worktree-isolated agent's shell refuses compound commands that name git or gh. Write a script to a file and run
    `bash <file>`, or split the commands.
