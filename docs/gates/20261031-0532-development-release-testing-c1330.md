---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 36bbb08cf34867b9f1352cbee1ae1dc4f3382fde
  - https://github.com/akmaier/agent-m/pull/1543
date: 2026-10-31 05:32 UTC
---
# Development → Release testing: ITM-1330, a sprint that has ended is drawn as ended

**REGISTER**

## Reason

ITM-1330, pull request #1543 into `sprint/team1/130`, passes on `36bbb08c`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41172647122 (`pull_request`, attempt 1) on `36bbb08c` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed. The implementation commit `f03a165a3` is green too, in run 41171931673.
2. **The first commit holds only tests and is red for the item's reason.**
   - `08624383f` adds `tests/progress-measures-sprint-ended.test.mjs` and changes TST-783002 in
     `tests/implementation-pages-backlog-end-sprint.test.mjs`.
   - Run 41171312371 on it fails in `unit-pull-request (13)` and `(14)`, on the four new cases (TST-1330001 to 1330004)
     and TST-783002. No other case fails.
3. **Only the item's module and the tests its Acceptance names change.**
   - developer-sonnet-j (`Agent-M-Participant`), `f03a165a3`: `src/progress-measures/measures.mjs`, +4 −3. `teamSprint`'s
     `final` is `## Review`, or `sprintsToClose([record], states, today)` naming the sprint, imported from
     `../work-plans/index.mjs`.
   - developer-sonnet-l (`Agent-M-Participant`), `36bbb08cf`: `tests/system-uc-032-maintain-the-backlog.test.mjs` alone.
     TST-803019 and 803020 lose their `todo`, and their entries move from `FLOW_FINDINGS` to `FLOW_EVIDENCE`.
     developer-sonnet-l implemented none of the item.
4. **Uses, read at the level of the module** (sprint 124's agreement). MOD-progress-measures' Uses name MOD-work-plans,
   and `sprintsToClose` is in its `provides`. In my checkout of the head, TST-106805 (`trace-graph-import-uses`) passes.
5. **The Acceptance holds.**
   - TST-1330001: a sprint whose `## Ended` is today is final and not endable. Known positive: a time box ending tomorrow is
     not final.
   - TST-1330002: a sprint without a time box whose items are all merged is final. Counter-proof: with one item open it
     is not final, and it is endable.
   - TST-1330003: a time box ending today is final.
   - TST-1330004: `backlogView` takes such a sprint as the team's `lastEnded`, not as running. Known positive: one ending
     tomorrow still runs.
   - TST-783002's `given` and known positive change to the ended sprint, as the item names. Its assertion that no *End
     sprint* is offered stays.
   - TST-803019 and 803020 pass without `todo`.
6. **Counter-proof, planted by me** on the head, in my checkout, and restored after.
   - With `final` written back as `## Review` or `end < today`, 7 cases fail: TST-1330001 to 1330004, TST-783002,
     TST-803019 and TST-803020.
   - Restored, the tests of the module and its callers pass. These are every `progress-measures-*` and
     `implementation-pages-*` file, UC-032's system and release files, `dashboard-backlog-teams`,
     `release-itm-1260-stored-views`, `trace-graph-import-uses` and `test-document-one-line`: 346 tests, 339 pass, 7
     `todo` (ITM-803's findings that stand), 0 fail.
7. **MOD-test-document's reader** on the head:
   - `progress-measures-sprint-ended` has 4 declarations, `implementation-pages-backlog-end-sprint` 3 and
     `system-uc-032-maintain-the-backlog` 27, each with 0 findings. Each header names one module per line.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 5,852 declarations, 5,852 identifiers and 0 repeats.
8. **It merges cleanly** into the sprint branch as it stands with ITM-1329 and ITM-1321 merged (`git merge-tree`, exit
   0). It is the first of the items that share UC-032's system test.
9. **The readings of the pull request hold.**
   - **A time box ending today has ended.** That is `sprintsToClose`'s text: "its `end` date is before or on `today`"
     (MOD-work-plans.md:212). The item takes `final` from that one rule.
   - **`## Review` stays its own reason.** `sprintsToClose` names only sprints whose record holds no `## Review`, and
     MOD-progress-measures' `final` covers a closed sprint as well.
   - **An empty selection without a time box counts as every item done. It needs no guard here.**
     - `sprintsToClose`'s text reads "every item of its selection is `done`", and `teamSprint` asks it rather than
       keeping the rule twice (AGENTS.md §2, "Nothing twice").
     - A guard in `teamSprint` would make the two modules decide "ended" differently again, which is the finding this item
       mends.
     - Such a sprint cannot be started from the page: *Start sprint* asks for at least one item (`backlog.mjs`, `paint`).
       Whether `sprintsToClose` should read an empty selection otherwise would be a change of MOD-work-plans' text,
       which is not this item's.

## Noted

- ITM-1326 shares `tests/system-uc-032-maintain-the-backlog.test.mjs`. Once this is merged, its branch merges the sprint
  branch before its gate.
