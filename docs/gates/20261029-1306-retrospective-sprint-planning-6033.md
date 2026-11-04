---
gate: Retrospective → Sprint planning
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 902e5200749d05ebd9c5ba9bce3be70c7cc9bb3f
  - https://github.com/akmaier/agent-m/pull/1451
  - docs/backlog/sprints/team1/117.md@5b1fc83a1
date: 2026-10-29 13:06 UTC
---
# Retrospective → Sprint planning: the merge of `sprint/team1/117` into `main`

**REGISTER**

## Reason

The increment of team 1's sprint 117, pull request #1451 of `sprint/team1/117` into `main` at `902e5200`, may be merged.

The condition is "the review and the retrospective are recorded, CI is green on the pull request"
(`docs/process-models/scrum-wip.md:55`). The decider "must not have written the review or retrospective it checks"
(`docs/process.md:35`).

1. **The review and the retrospective are recorded.** `docs/backlog/sprints/team1/117.md` on `main` holds three
   sections: `## Review`, `## Unfinished items` (none) and `## Retrospective`. All three were appended in `5b1fc83a1`,
   whose trailer names scrum-master-opus-c. I wrote none of them.
2. **CI is green on the pull request.** Run 40877782403, `pull_request`, passes 39 of 39 pull-request and setup jobs.
   Its checkout is "Merge 902e5200… into caf3d533…".
3. **The run still stands for the merge.**
   - Since `caf3d533`, `main` has gained `64c9a57ee` (my release gate record) and `5b1fc83a1` (the close). They change
     only two files, under `docs/gates/` and `docs/backlog/sprints/`.
   - The merge has no conflict (`git merge-tree`).
   - On `origin/main` merged with `902e5200` locally, the checks that read those records pass:
     - `python3 -m unittest test_backlog_layout test_no_history test_artifact_format test_backlog_item_fields
       test_definition_of_done test_parallel_sprints`: OK;
     - `node --test tests/release-sprint-02-b-work-items.test.mjs tests/dashboard-backlog-teams.test.mjs`: 28 pass,
       0 fail.
4. **Every gate before the merge is recorded:**
   - Development → Release testing for #1444, #1446 and #1447, and for #1445 after one return;
   - Release testing → Sprint review on `902e5200`.

## Noted

**Handover to the next po-opus-c session, which plans sprint 118 from the records.**

- **The state of the backlog on `main` at `5b1fc83a1`, read as in every planning since sprint 110.** Of the 1,073 items,
  968 are done and 105 are not:
  - 65 are ready.
  - 16 wait for an item they build on.
  - 2 are held by stale pull requests: ITM-598 (#697) and ITM-648 (#715).
  - 20 wait for a draft for akmaier: ITM-468, 716, 730, 816, 817, 831, 1067, 1111, 1146, 1190, 1195, 1201, 1256, 1277,
    1286, 1291, 1298, 1299, 1305 and 1307. ITM-585 and 804 wait through ITM-1256, and ITM-739 through ITM-730.
  - 2 need a person: ITM-237 and ITM-267, and ITM-374 through ITM-267.
- **The classifier misses ten of the draft-waiting items.** It counts as waiting only items with a section
  `## Not ready`. These ten name their draft in their Outcome instead: ITM-468, 716, 730, 816, 817, 831, 1067, 1256, 1286
  and 1291. Read their Outcome before taking any of them as ready.
- **Ready next, with their folders free:**
  - ITM-1308 (MOD-maintenance-pages, `maintenance-pages-move-1250`'s five step guards; a refactoring of comments);
  - ITM-1310 (MOD-site-frame, one class name in `look.css`; a refactoring);
  - ITM-1311 (MOD-review-pages, `readJobRecords` goes now that `listJobs` batches; its Acceptance still asks for the
    other modules' tests to be named by a run);
  - ITM-1181 (MOD-trace-pages, the specification view while an entry waits; its first task confirms the path, and it
    may stop).
- **Prepared but held:**
  - ITM-1271 reads which job wrote a file from the commit's `Agent-M-Job` trailer. That format is MOD-job-runner's, and
    MOD-job-runner provides no reader of it. Settle that before selecting it.
  - ITM-1302 and ITM-1304 span many modules and want a sprint of their own.
  - ITM-1261 and ITM-1267 (page loads) are not yet checked against the agreements.
- **Things the records do not state plainly:**
  - **The agreements of sprint 117's retrospective are the ones to apply first.** A planning run takes:
    - every test that reads a file the item changes, searched by its path;
    - the tests of every module whose code calls a changed function, found from its callers in `src/`.
  - **For a change read by many tests,** run those tests with the change applied on the current sprint head, before and
    after, and name each new failure in the Acceptance. A text search alone missed tests three times in sprints 115 to
    117.
  - **A test of another module named for one test only** is written into the item's `modules:`, with "no code of it
    changes" in the Acceptance. A release test is always changed by developer-sonnet-l, in a commit of its own.
  - **At every gate, read the declaration reader with its control** (`tests/release-itm-1254-issue-move.test.mjs`, 4 and 0).
    Also run `tests/test-document-one-line.test.mjs`. For an item that changes how CI fetches or caches something, read
    the run's job logs, not only its conclusion (ITM-1306's return).
  - **Known flips not yet fixed:** `review-pages-release-limitations` (ITM-1287). A failed attempt on it alone, with a
    green rerun, counts as CI green on the head, as at #1445.
  - **A `✖` marked `# FINDING` or `todo`** (ITM-133, UC-042 1a, system-uc-019) is a todo, not a failure.
