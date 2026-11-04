---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ac181583232d992359ed7a262f0014862cec68ed
  - https://github.com/akmaier/agent-m/pull/1639
date: 2026-11-01 20:00 UTC
---
# Development → Release testing: ITM-1059, #1639

**REGISTER**

## Reason

ITM-1059 (a plan is written by hand with *+ Step* and saved as the planner's own input) may go on. The pull request is
#1639 into `sprint/team1/141`, at `ac1815832`, by developer-opus-e (`Agent-M-Participant` on both commits). I wrote none of
it.
1. **The first commit holds only tests and is red for the item's reason.** `cb00dcb2f` adds TST-1059001 to 1059003 to
   `tests/implementation-pages-plan-draft.test.mjs` and extends the file's `Guards:` line. In run 41294349515
   (pull_request) only those three fail.
2. **CI is green on the head:** run 41294661099 (pull_request, `ac1815832`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module changes:** `src/implementation-pages/` (`plan.mjs`, `implement.mjs`).
   - `declaredWorkflowOf` moves to `plan.mjs` beside `declaredModelOf`, as one definition. ITM-1058's editor is now one
     shared `editor`.
   - Every import is among MOD-implementation-pages' Uses, nothing more loads at start, and the preload check passes.
4. **The Acceptance holds:**
   - Steps added with *+ Step* and saved commit one file per step and `docs/plan/order.md` in one commit, with no
     `Agent-M-` line, and a script's click adds nothing (TST-1059001).
   - A plan without a step for one module is refused with its finding, and nothing is written (TST-1059002).
   - A move that breaks the order of the interfaces is refused (TST-1059003).
   - The red run is the counter-proof.

## Readings, ruled

- **+ Step is shared.** It adds to an open draft, saved through `writeResult`, or to a hand-written plan, saved through
  `savePlan`. Taken.
- **Hand-written steps are added after the default branch's plan.** Rows and `builds_on` name them by title, which
  `savePlan` resolves, and nothing existing is removed. Taken.
- **A step's other fields** (`realises`, `origin`, its two sections) are filled by `ownStep` in `plan.mjs`, following
  MOD-work-plans' `draftedPlan`. `draftedPlan` is not in MOD-work-plans' interface, so the rule now stands in two places.
  Removing the second copy needs an interface of MOD-work-plans, a question of the architecture. The item can be built
  without it (AGENTS.md §6a.6), so it passes. Noted for akmaier: MOD-work-plans could offer the step's derived fields, or
  let `savePlan` fill them, so that `ownStep` goes.
