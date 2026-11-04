---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 98f1fca6fe22400643f0904bced55f7f1fe4b89a
  - https://github.com/akmaier/agent-m/pull/1657
date: 2026-11-01 11:51 UTC
---
# Development → Release testing: ITM-1369, #1657

**REGISTER**

## Reason

ITM-1369 (a plan orders the modules, then the integrations, then the system) may go on. The pull request is #1657 into
`sprint/team1/141`, at `98f1fca6f`. developer-opus-f wrote the tests-only commit `519e2cceb` and the code `d21f55a3e`;
developer-sonnet-l wrote the merge `10d78f70e` and `98f1fca6f`, the adaptation of the UC-045 cases and the `todo` lift
(`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `519e2cceb` changes
   `tests/work-plans-plan-checks.test.mjs` (MOD-work-plans) only. In run 41301347310 its two new cases fail: an integration
   ordered before a step of its modules, and the system's step ordered before any other step.
2. **CI is green on the head:** run 41303152964 (`98f1fca6f`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/checks.mjs`. `planFindings` names both orders under `AN
   IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES`.
4. **The adaptations, judged.** Both cases moved because the new check refuses their plans, which the SPEC's rule allows.
   Both are listed in the pull request and written by a participant who built none of the code.
   - **TST-1061020** (system) added Mail's step by hand after the system's step. It now presses *Up* three times to set
     Mail before the integrations and the system, and asserts that order before *Save*. Its expectations stand, and one
     is added. Not weakened.
   - **TST-1061111** (release) appended a module step after the system's step. Its fixture plan now holds five steps
     without the system's, and the step added by hand is the system's, Whole. It still checks what it guards: the step
     written by hand is committed with a new identifier (`ITM-121`), and the order gains its row after the last step, now
     in the phase Testing. Not weakened.
   - TST-1061021 loses its `todo`; it fails on the base.
5. **The Acceptance holds:** the two orders are refused as errors; the probe's fixture plans that gained a finding are the
   two above; the pull request records its planted faults.

## Noted

- A step written by hand is appended after the plan's existing steps and cannot be saved before one of them; reordering
  is the draft's (UC-045 step 4). Noted; nothing waits on it.
