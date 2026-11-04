---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 827a3b2c87796cd82637ce0af9f5c569b330a5bf
  - https://github.com/akmaier/agent-m/pull/1482
  - docs/backlog/sprints/team1/122.md@b5e7ba5fa
date: 2026-10-29 23:38 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/122` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 122, pull request #1482 of `sprint/team1/122` into `main` at `827a3b2c`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.**
   - `docs/backlog/sprints/team1/122.md` on `main` holds three sections: `## Review`, `## Unfinished items` (none) and
     `## Retrospective`.
   - All three were appended in `b5e7ba5fa`, whose subject names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 40973769875, `pull_request`, attempt 1, on `827a3b2c` succeeds: 58 jobs, 17
   are skipped, and none fails. `827a3b2c` is `29098382`, on which the release tests were decided, with my gate record of
   that decision on top; run 40973184020 on `29098382` was green as well.
3. **The run still stands for the merge.**
   - Since `1b2134f0e`, the merge base, `main` has gained the five gate records of this sprint, the close, and one line of
     `docs/participants.md` (`22f3509a0`, architect-opus-a).
   - The merge has no conflict (`git merge-tree`).
   - On `origin/main` merged with `827a3b2c` locally, the checks that read those files pass:
     - `python3 -m unittest` for `test_backlog_layout`, `test_no_history`, `test_artifact_format`,
       `test_backlog_item_fields`, `test_definition_of_done`, `test_parallel_sprints`, `test_participants`,
       `test_role_assignment` and `test_model_roles`: OK;
     - `node --test tests/release-sprint-02-b-work-items.test.mjs tests/dashboard-backlog-teams.test.mjs`: 28 pass,
       0 fail.
4. **Every gate before the merge is recorded:** Development → Release testing for #1476, #1475, #1477 and #1478, each
   passed on its first round; Release testing → Sprint review on `29098382`.

## Noted

**Handover to the next planning of team 1** (by po-opus-c, or a fresh session from these records).

- **The state of the backlog on `main` once #1482 is merged,** read as in every planning since sprint 110. Of the 1,073
  items, 985 are done and 88 are not:
  - 39 are ready;
  - 16 wait for an item they build on;
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715);
  - 28 wait for a draft for akmaier: those of sprint 122's record, `## Not selected`;
  - 3 need a person: ITM-237, ITM-267 (and ITM-374 through it) and ITM-632.
- **The ready items that may be built without a draft, read from their texts at sprint 122's planning** (not yet each
  against every agreement):
  - 19 are the system and release tests of the use cases: ITM-266, 370 to 372, 375, 376, 579, 580, 738, 740, 741, 771,
    772, 774, 775, 805, 991, 1045 and 1062. Each is a battery, written by participants who implemented none of its use
    case.
  - About 14 are module items: ITM-351 (what is left after ITM-1202), 446, 448, 600, 690, 782, 800, 894, 987, 1138, 1170,
    1171, 1186 and 1187. ITM-782, 1170 and 1171 want a planning stand-in that is most of the item.
  - Not now: ITM-1287 and ITM-1194 (reproduce first), ITM-518 (its check cannot run here), ITM-1271 (its reader is not
    settled), ITM-561 and 614 ("Not ready"), ITM-1204 (a first task that can end in a draft), ITM-779 (it names a gap of
    the architecture).
  - **ITM-1304 may now get its own sprint:** no item holds a test file. Its count tool finds 929 lines in 266 files, notes
    after declarations among them; the count is read to its end before selection. TST-488001's `expect:` is one of them.
- **The agreements to apply,** from the Retrospectives of sprints 110 to 122; the newest first:
  - Before running release tests that start the Bridge, a participant installs the packages of
    `src/bridge-build/package-lock.json` outside the repository and links them for the run only.
  - Every report of a new or changed declaration prints the reader's `given`, `input` and `expect` for it.
  - A planning stand-in that adds a value to a list or family writes it in the shape the module's existing values have.
  - The Uses check reads the interface types of every module whose values the item changes, not only the prose.
  - An item whose build alone can show its test changes is built at planning by the Product Owner's stand-in.
  - A planning stand-in uses only what the calling module's Uses and the called module's interface state.
  - A rename of an identifier first searches `docs/` and `src/` for every reader of it.
  - An item whose first task is to reproduce a failure, or to read whether anything is to be built, is settled at
    planning (ITM-895 was withdrawn so at sprint 122).
  - With each change applied, run every test that reads a changed file by its path, and every test of a module whose
    code calls a changed function. Name each new failure in the item's Acceptance.
- **Things the records do not state plainly:**
  - The planning tools are in the scratchpad's `tools/` (see sprint 121's handover), with `decls.mjs`, which prints a
    declaration's `given`, `input` and `expect`. Sprint 122's runs export a commit with `git archive` into
    `p122/<name>`; such an export has no `.git`, so `test_no_history`, `test_artifact_format` and `test_no_backend`
    error there and are run in a checkout instead.
  - Release cases an item changes go to developer-sonnet-l, on the item's branch, in a commit of its own; that worked
    for all three items of sprint 122 that needed it.
  - Files that hang or fail here: as in sprint 121's handover, with `release-itm-268-desktop-shell` failing here.
