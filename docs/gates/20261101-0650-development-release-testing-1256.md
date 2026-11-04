---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8a4da800ddb323b4f6ea5eab9bbac890e686d5ba
  - https://github.com/akmaier/agent-m/pull/1610
date: 2026-11-01 06:50 UTC
---
# Development → Release testing: ITM-1256, #1610

**REGISTER**

## Reason

ITM-1256 (a change drafted from an issue shows its candidates beside their requirements, and each conflict is decided)
may go on. The pull request is #1610 into `sprint/team1/141`, at `8a4da800d`, by developer-opus-f (`Agent-M-Participant`
on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `541d2e72a` changes only
   `tests/maintenance-pages-conflict-1256.test.mjs` (new) and `tests/maintenance-pages-save-584.test.mjs`. In run
   41280611406 (pull_request) only TST-1256001 to 1256003 fail.
2. **CI is green on the head:** run 41280679793 (pull_request, `8a4da800d`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module and its tests change.**
   - The code: `src/maintenance-pages/issues.mjs` (`changeSection`).
   - Both tests name MOD-maintenance-pages, as the Acceptance allows.
   - The code reads a requirement's rule from `prepared.parts[].artifacts` and writes the decisions with `writeResult`.
     Both are among the Uses the item names (MOD-job-runner.md:254-255, :356-360). Nothing is imported from
     MOD-review-pages.
4. **The Acceptance holds:**
   - Each candidate is shown beside the rule of the requirement it refers to (TST-1256001).
   - A conflict offers the person's decision, and *Save* waits for it (TST-1256002).
   - *Save* writes the conflict as decided (TST-1256003).
   - The counter-proof: before the change, the three cases fail on CI.

## The changed test, ruled

TST-584101 now drafts only the new candidate, and its line "a conflict nobody decided is not written" is removed. With this
item, an undecided conflict keeps *Save* disabled, so that line can no longer be reached through *Save*. TST-1256002
guards it now: *Save* is disabled, and a click on it writes nothing under `docs/spec-freigaben/`. TST-1256003 starts from
that state as its known positive. The change is in the tests-only commit, and its test names MOD-maintenance-pages.
Allowed.

## Readings, ruled

- **"*Save* is offered only when every conflict is decided"** is read as: *Save* is shown, and disabled until then.
  Taken.
- **Dropping a conflict is not offered.** The person's decision is a class (new, change, duplicate), which `writeResult`
  writes in place of the participant's (MOD-job-runner.md:356-360). No text names a choice to drop. Taken.
- **The existing requirement's sources and authority beside a conflict** (`A CONFLICT IS DECIDED BY A PERSON`,
  SPEC.md:296-298) are not shown on the issue route. No function among MOD-maintenance-pages' Uses gives them. This is the
  gap the item already names, for akmaier. Nothing waits on it.
