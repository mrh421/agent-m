---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c1da6fd1f2d725d74b950da8524d7c3c682dce56
  - https://github.com/akmaier/agent-m/pull/1544
date: 2026-10-31 05:50 UTC
---
# Development → Release testing: ITM-1326, the backlog lists what the other teams' sprints hold without a plan open

**REGISTER**

## Reason

ITM-1326, pull request #1544 into `sprint/team1/130`, passes on `c1da6fd1`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41173188716 (`pull_request`, attempt 1) on `c1da6fd1` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed. The implementation commit `02d85e7d3` is green too, in run 41171707305.
2. **The first commit holds only tests and is red for the item's reason.** `6eae2c797` adds
   `tests/implementation-pages-backlog-held-without-plan.test.mjs` alone. Run 41171357024 on it fails in one job,
   `unit-pull-request (15)`, on TST-1326001 only.
3. **Only the item's module and the tests its Acceptance names change.**
   - developer-opus-f (`Agent-M-Participant`), `02d85e7d3`: `src/implementation-pages/backlog.mjs`, +5 −4.
     - `paint` draws `heldPanel` under `sprints && teams.length > 1`.
     - Without a team, the heading and the empty line drop "other".
     - No column is added.
   - developer-opus-f, `a0ecc5a5d`: the merge of the sprint branch with ITM-1330 (#1543), as the plan orders. `git show
     --cc` shows no text of its own, so no conflict was resolved, and it carries the author's trailers.
   - developer-sonnet-l (`Agent-M-Participant`), `c1da6fd1f`: `tests/system-uc-032-maintain-the-backlog.test.mjs`
     alone. TST-803012 loses its `todo`, and S3's entry moves to `FLOW_EVIDENCE`. developer-sonnet-l implemented none of
     the item.
   - Nothing new is imported, and no value of an interface changes.
4. **The Acceptance holds.**
   - TST-1326001: with two teams and ITM-002 held by team1/03, the backlog without a plan lists it with its title, sprint,
     the module it changes and the module that one uses, before the backlog's table.
   - TST-1326002 is the known positive: with one team nothing is listed.
   - TST-1326003: with a plan open, the other teams' items are listed as before.
   - **Requests:** `load-per-view` passes. `heldPanel` draws from the view the route has read and sends nothing.
   - TST-803012 passes without `todo`.
5. **Counter-proof, planted by me** on the head, in my checkout, and restored after. With the old condition `planning &&
   teams.length > 1`, TST-1326001 and TST-803012 fail.
6. **The tests of the module and its callers,** in my checkout of the head: every `implementation-pages-*` file,
   `load-per-view`, UC-032's system and release files, `dashboard-backlog-teams`, `release-itm-1260-stored-views`,
   `release-itm-1316-done-item-marks` and `test-document-one-line`. They give 245 tests: 239 pass, 6 `todo` (ITM-803's
   findings that stand and ITM-1330-A), 0 fail.
7. **MOD-test-document's reader** on the head:
   - The new file has 3 declarations, and UC-032's system test 27, each with 0 findings. Each header names one module per
     line.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 5,859 declarations, 5,859 identifiers and 0 repeats.
8. **It merges cleanly** into the sprint branch as it stands, with the release tests of #1547 to #1549 (`git merge-tree`,
   exit 0).
9. **The readings of the pull request hold.**
   - **The sprint's name `<team>/<nn>` names its team.** That is the reading the item states. `Held.sprint` is of that
     form (MOD-work-plans).
   - **Without a plan, every held item is listed.** UC-032 step 5 lists "every item that another team's sprint holds" to
     a team's Product Owner. A page without a team chosen has no "own" team, so every team's holds are another's to
     some team. MOD-implementation-pages gives the route the list "from `heldItems`" with no team named.

## Noted

- **ITM-1330-A,** the `todo` TST-1330104 of #1549, is ruled in the Scrum Master's report of this gate: a new item, of
  MOD-progress-measures.
