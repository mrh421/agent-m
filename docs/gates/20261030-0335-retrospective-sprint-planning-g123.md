---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 96e659dd10c7eb245ef6bfc4b70d5f086caf5317
  - https://github.com/akmaier/agent-m/pull/1490
  - docs/backlog/sprints/team1/123.md@fc10a0091
date: 2026-10-30 03:35 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/123` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 123, pull request #1490 of `sprint/team1/123` into `main` at `96e659dd`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/123.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `fc10a0091`, whose subject names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.**
   - Run 40997587801, `pull_request`, attempt 1, on `96e659dd` succeeds: 58 jobs, 17 skipped, none failed.
   - `96e659dd` is `5354aa28`, on which the release tests were decided, with my gate record of that decision on top. Run
     40996928942 on `5354aa28` was green as well.
3. **The run still stands for the merge.**
   - Since `4743a462`, the merge base, `main` has gained:
     - `ba3e54e74`, which takes the drafts of #1479 to #1481 back out of `docs/architecture/`;
     - `c4230111e`, the open MOD-approvals draft of ITM-730;
     - the five gate records of this sprint;
     - the close.
   - The merge has no conflict (`git merge-tree`).
   - In the merged tree, `docs/architecture/` is `main`'s. The branch changes no file there.
   - On `origin/main` merged with `96e659dd` locally, the checks that read those files pass:
     - `python3 -m unittest` for `test_backlog_layout`, `test_backlog_item_fields`, `test_definition_of_done`,
       `test_parallel_sprints`, `test_participants`, `test_role_assignment`, `test_model_roles`, `test_coverage_report`,
       `test_test_battery` and `test_test_levels`: OK (83 tests);
     - `test_no_history`, `test_artifact_format` and `test_no_backend`, in a checkout: OK;
     - `node --test` for `tests/trace-graph-import-uses.test.mjs` (TST-106805 among its cases): 5 pass, 0 fail, in a
       checkout;
     - `tests/release-sprint-02-b-work-items.test.mjs`, `tests/dashboard-backlog-teams.test.mjs`,
       `tests/test-document-one-line.test.mjs` and the items' own unit and release files: they pass. The browser file of
       ITM-894 runs on CI only.
4. **Every gate before the merge is recorded:**
   - Development → Release testing:
     - #1483 (ITM-894), passed on its first round;
     - #1484 (ITM-987), rejected once on `9cf8e9c9` and passed on `fd78df51`;
     - #1485 (ITM-1304), passed on its first round.
   - Release testing → Sprint review: passed on `5354aa28`.

## Noted

**Handover to the next planning of team 1** — for a fresh po-opus-c, who reads this from the records alone.

- **Read first,** as the coordinator's brief asks, in the original: AGENTS.md, SPEC.md, docs/process.md,
  docs/process-models/scrum-wip.md, the book's chapters 8, 9, 11, 12 and 13, sprint records `team1/120.md` to `123.md`
  with their Retrospectives, this record, and docs/architecture/MOD-test-document.md.
- **The state of the backlog on `main` once #1490 is merged,** read as in every planning since sprint 110. Of the 1,073
  items, 988 are done (ITM-894, 987 and 1304 the newest) and 85 are not:
  - 36 are ready;
  - 16 wait for an item they build on;
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
  - 28 are marked as waiting for a draft for akmaier. The recheck below settles them; see the backlog edits;
  - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
- **The architecture drafts are gone, and a recheck settles the 28.**
  - akmaier rejected the bulk drafts #1479 to #1481, and `ba3e54e74` took them back out. `docs/architecture/` is again
    as at `b65cefcc9`, apart from the open 4-line MOD-approvals draft `c4230111e`.
  - architect-opus-a then rechecked the waiting items read-only, and akmaier decided two of them. The recheck is
    `scratchpad/triage-29.md`. I read it in full; it is a working file, not a record, so its result is restated here.
  - The recheck's two readings:
    - **R1:** a module's Uses work at the level of the module. ARC-037: "a module uses another only through that
      module's index.mjs"; TST-106805 checks "the module before the dot"; MOD-repository-hosts gives the Host's functions
      as the functions of the object `connect` returns.
    - **R2:** the accepted text already says it.
  - Its table has 29 rows: the 28 items and ITM-1259. ITM-1259 has been done since sprint team1/111, so its row is only
    a reading of MOD-workflow-entries' `listPullRequests` (R1), and no edit. The sprint's Review says "17 of the 29"
    buildable. By the table's rows that count holds only with ITM-1259; of the 28 items, 15 are class A.
  - **Class A, buildable against the accepted text with the reading the table names (15).** At the next planning, each
    item's section "Not ready: a draft for akmaier" is replaced by its reading. Then each is read against every team
    agreement, as any ready item is, before it is selected.
    - ITM-659: MOD-site-frame's `tokenKeyOf` is the one place, which the review and settings pages call (R1).
      MOD-browser-store keeps its own as the owner of the key's format (no cycle).
    - ITM-716: `Route.reads` gets the repository as the frame read it. The route draws from that snapshot and asks
      `repositoryInfo` only for write permission or visibility.
    - ITM-817, **narrowed:** report every module the architecture does not describe, and circles of any length (SPEC
      A BACKLOG ITEM NAMES THE MODULES IT CHANGES, SPEC.md:1679-1682). Drop its parts on rule names and on the old
      `itemProblems`. This is also sprint 123's release-test feedback.
    - ITM-857, **narrowed:** the listing is done (ITM-1280). What remains is naming a used-up limit through
      `notice("rate-limit")`, which MOD-main-page's Uses name.
    - ITM-1067: MOD-review-pages names MOD-source-register, so `registerPaths` (R1).
    - ITM-1111: the links call `context.go(route, params)`, as *+ Add product* does (`home.mjs:121`).
    - ITM-1190: "across the instance" covers the instance and its products. Each list is read as its home card reads its
      overview.
    - ITM-1256: MOD-maintenance-pages:119-121 already gives the route the candidates and conflicts (R2). ITM-585 and 804
      build on it and become startable once it is done.
    - ITM-1261, **adds MOD-trace-pages:** already accepted. `main-changed.mjs` is alike in the instance and a product
      (MOD-runtimes:212-218); the Install link is the page's wording.
    - ITM-1267: MOD-site-frame:182-185 already says that a route naming `module` holds `name`, `entry`, `entryShown` and
      `title`, and `preloads.mjs` names the modules as data. No `standIn` function is built.
      - Before selecting it, read sprint 120's stop record (`team1/120.md`, "ITM-1267's stop"). There 204 test files
        failed with a stand-in route that has no `render`, against the `Route` type (MOD-site-frame.md:153-162).
      - The recheck's reading must answer that type; the planning stand-in shows whether it does.
      - Its CI job time is named before it is selected (A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES).
    - ITM-1277: MOD-settings-pages:223-224. `listCiRuns` and `ciRunLog` are Host functions (R1).
    - ITM-1291: `readFileAt` is a Host function, and MOD-approvals uses the Host (R1).
    - ITM-1292: `closeWithLinks(host, …)`, and `readIssue` is a Host function (R1). Noting once is stricter than the text,
      and allowed.
    - ITM-1298: both modules already use `readDocument` and `artifactSchemas`. The hand-written copies go.
    - ITM-1307: MOD-test-pages names MOD-progress-measures, so `scheduleView` (R1). Facts come with the declarations;
      the others are "unknown".
  - **Class B, proposed for withdrawal (11).** At the next planning, read each against its reason and withdraw it where
    the reason holds, as ITM-895 was withdrawn at sprint 122. Name each withdrawal and its reason in the sprint's record.
    No item builds on any of them, nor on ITM-1305 (a search of every item's `builds_on`; known positive: it finds ITM-585
    and 804 on ITM-1256).
    - ITM-468: built on `main` (`9ab15a19`, with a test). MOD-job-runner's `WriteOutcome` already says the notes are
      what the end record lists.
    - ITM-719: only a hand-written mismatching record triggers it. Agent M never writes one, and
      `test_approval_records.py:139` refuses one. YAGNI.
    - ITM-816: already conforms (`HostError` through the Host, R1).
    - ITM-831: saves one request, seen only in fixtures; ITM-942 and ITM-1291 cover it.
    - ITM-897: its stop condition is met: measured, it saves nothing.
    - ITM-1146: MOD-job-catalogue:41 gives each kind its own `answer.schema.json`; TST-1133005 reads it so.
    - ITM-1195: a stale Uses line with no effect on code or users. It is fixed with the next change of MOD-work-plans.
    - ITM-1201: only `traceGraph`'s line is stale. It is fixed with the next change of MOD-trace-graph.
    - ITM-1286: no effect on users. `BAR_FILES` lives in `dashboard-app.mjs`, which is to be removed.
    - ITM-1288: the code follows the accepted sentence word for word.
    - ITM-1299: gzip is the platform's, not an Agent M rule. YAGNI.
    - The coordinator's brief counted ten B items. The table holds the eleven above.
  - **Withdrawn by akmaier:** ITM-1305; the accepted, slower scope-`work` path stays. At the next planning its file goes
    with a commit naming akmaier's decision.
  - **Still waiting:** ITM-730, for akmaier's acceptance of the 4-line MOD-approvals draft `c4230111e` (`removedFiles`
    takes the path and the last accepted text from `lastAcceptedText`). Its file stays open on `main` until an approval
    record names it. ITM-739 builds on ITM-730, and waits with it among the 16.
- **The counts once those edits are made:** 1,073 − 12 withdrawn (the 11 of class B and ITM-1305) = 1,061 items, 988 done
  and 73 not done:
  - 51 ready (36 + the 15 of class A);
  - 16 waiting for an item they build on;
  - 2 held by stale pull requests;
  - 1 waiting for a draft (ITM-730);
  - 3 needing a person.
  - Recount from the files at the planning. The 16 are the predecessors' count; the direct `builds_on` check of
    `scratchpad/tools/state.py` gives 13 (ITM-373, 374, 585, 700, 739, 802, 803, 804, 806, 818, 1058, 1059 and 1061).
- **The other ready items, unchanged from sprint 123's `## Not selected`:**
  - ITM-782, 1170, 1171, 1186 and 1187: their build at planning is most of the item, and was not made. ITM-1186's
    Acceptance changes `tests/settings-pages-prompt-bar-note.test.mjs`.
  - ITM-600, 690, 800 and 1138: builds of several modules, not made.
  - ITM-351 and 446: a "Not done: what is missing" gap, not read again.
  - ITM-518: its check cannot run here.
  - ITM-1271: its reader is not settled.
  - ITM-1287 and 1194: not reproduced.
  - ITM-561 and 614: "Not ready".
  - ITM-1204: a first task that can end in a draft.
  - ITM-779: it names a gap of the architecture.
  - The 20 batteries (ITM-266, 370 to 372, 375, 376, 448, 579, 580, 738, 740, 741, 771, 772, 774, 775, 805, 991, 1045 and
    1062): each needs the Developers who implemented none of its use case named before it is selected.
- **The agreements to apply,** from the Retrospectives of sprints 110 to 123, the newest first:
  - Before an item is said to wait for a draft, the reading that would let it be built against the accepted text is
    sought and written down (sprint 123).
  - A refactoring's commits are pushed one at a time, so that each gets its own pull-request run (sprint 123).
  - Before running release tests that start the Bridge, a participant installs the packages of
    `src/bridge-build/package-lock.json` outside the repository and links them for the run only.
  - Every report of a new or changed declaration prints the reader's `given`, `input` and `expect` for it.
  - A planning stand-in that adds a value to a list or family writes it in the shape the module's existing values have.
  - The Uses check reads the interface types of every module whose values the item changes, not only the prose.
  - An item whose build alone can show its test changes is built at planning by the Product Owner's stand-in.
  - A planning stand-in uses only what the calling module's Uses and the called module's interface state.
  - A rename of an identifier first searches `docs/` and `src/` for every reader of it.
  - An item whose first task is to reproduce a failure, or to read whether anything is to be built, is settled at
    planning.
  - With each change applied, run every test that reads a changed file by its path, and every test of a module whose
    code calls a changed function. Name each new failure in the item's Acceptance.
- **Learned in sprint 123, for gates and planning:**
  - A planning run's list of "tests that read a changed file by its path" missed a test it had to find
    (`test_test_battery.py`). For a change across many test files, run the whole suite.
  - No test counted a close's reads, so a cost regression passed CI. At a gate, probe the reads and calls of a changed
    function on the path the item does not change, against the base.
  - Real Tab, End and wheel events in the controlled Electron flip on the CI runner. A release case built on them gives
    no verdict; keyboard reach is guarded by the unit cases on `tabindex`.
  - MOD-test-document's reader takes a continuation line that begins with a lowercase word and a colon (`https:`,
    `include:`) for a key it passes over. ITM-1304 found ten such values; new declarations keep each value on one line.
- **Things the records do not state plainly:**
  - The planning tools are in the scratchpad's `tools/`:
    - `state.py` and `ready.py`, the backlog's state; refresh `merged.json` and `open.json` with `gh pr list` first;
    - `decls.mjs` and `reader.mjs`, the reader;
    - `prun.sh`, a planning run of a list, base beside change;
    - `after1304.mjs`, `classify1304.py` and `cmp1304.mjs`, the declaration counts and the before/after comparison.
  - An export made with `git archive` has no `.git`, so `test_no_history`, `test_artifact_format`, `test_no_backend` and
    `trace-graph-import-uses` (TST-106805) error there; run them in a checkout. The machine's six hanging files are named
    in `team1/123.md`'s brief.
  - Release cases an item changes go to developer-sonnet-l, on the item's branch, in a commit of its own.
  - developer-sonnet-j had no item in sprint 123. With 15 more ready items, the next selection can fill four.
