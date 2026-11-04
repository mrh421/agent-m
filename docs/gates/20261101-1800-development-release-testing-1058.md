---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 11dffcafaf6339633bc9cc00f06b77ff20a633ec
  - https://github.com/akmaier/agent-m/pull/1635
date: 2026-11-01 18:00 UTC
---
# Development → Release testing: ITM-1058, #1635

**REGISTER**

## Reason

ITM-1058 (the plan is drafted, reviewed and saved on the plan page) may go on. The pull request is #1635 into
`sprint/team1/141`, at `11dffcafa`, by developer-opus-e (`Agent-M-Participant` on `b2cbde734` and `47fb2b1ef`). The head
is the Scrum Master's merge of the sprint branch, with #1634, onto `47fb2b1ef`. I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `b2cbde734` adds only
   `tests/implementation-pages-plan-draft.test.mjs`. In run 41292699010 (pull_request) it fails TST-1058001 to 1058005,
   plus TST-738002, the sprint branch's clash at the time. The code `47fb2b1ef` (run 41293094298) failed only on
   TST-738002, which #1634 fixed.
2. **CI is green on the head:** run 41293522837 (pull_request, `11dffcafa`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module changes:** `src/implementation-pages/` (`plan.mjs`, `backlog.mjs`, `index.mjs`).
   - *Propose items*' attended run is exported once as `attendedJob` and shared, so it is not written twice
     (AGENTS.md §2.2). The tests of *Propose items* are unchanged.
   - No static import is added: MOD-work-plans' backlog and MOD-job-runner load by a relative `import()` on the click,
     as NO SERVER allows since ITM-1345.
   - The preload check and `tests/test_no_backend.py` pass. Every call is among MOD-implementation-pages' Uses.
4. **The Acceptance holds:**
   - The run panel names the participant, its place and the parts it sends.
   - The draft is shown in its order with a diagram.
   - A move that puts a module before one whose interface it uses is refused with `planFindings`' finding (TST-1058003).
   - *Save plan* calls `writeResult` with the draft as the planner left it, in one commit through `plan-steps`
     (TST-1058004).
   - Counter-proofs: saving the returned draft instead of the edit fails 004, and taking the refusal away fails 003.

## Readings, ruled

All four are taken. No accepted text gives these forms, and each is the simplest one the texts allow:
- **"Where its dependencies allow"** is `planFindings`' finding on the order of the interfaces. A step's `after` is drawn
  and refuses nothing.
- **A drafted step is checked by its place.** It is of level `module` where it implements modules only.
- **Split** makes "<title> (2)" after the step. **Merge** joins both steps' modules and `after`.
- **`worksOn`** is the architecture's system, subsystems and modules.

## Noted

- 141.md lists ITM-1058 under *Not ready*. It started on the reading recorded in the sprint's `## Selection`: ITM-1057
  and ITM-613 are built, and ITM-614 is merged into this sprint branch.
- `backlog.mjs` imports `settingsOf` of MOD-bridge-client, while the Uses name `bridgeAt`. This was there before the item,
  and the item does not touch it. Uses are read at the level of the module (TST-106805), so it is no finding.
