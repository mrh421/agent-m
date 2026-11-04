---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a54e2d5e4b9ec5b18ff26ef7743e9ef785e45a4e
  - https://github.com/akmaier/agent-m/pull/1680
date: 2026-11-01 15:49 UTC
---
# Development → Release testing: ITM-740, #1680, the system and release tests of UC-024

**REGISTER**

## Reason

ITM-740 was written by developer-opus-e (`Agent-M-Participant` on `a54e2d5e4`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41322727589 (`a54e2d5e4`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-024-harness.mjs`, `tests/system-uc-024-implement-the-architecture.test.mjs`
   (TST-740201 to 740222) and `tests/release-uc-024-implement-the-architecture.test.mjs` (TST-740301 to 740321). The
   harness reuses the harnesses of UC-045 and UC-032 without changing them. MOD-test-document reads 43 declarations with
   no finding. TST-7402nn and 7403nn had no history (known positive: TST-733001).
4. **Who wrote what it tests.** By `Agent-M-Participant` on `src/`, opus-e wrote code of ITM-1058, 1059, 1170, 1171,
   1260 and 1264, among others. The seven requirements whose UC-024 behaviour those items built are in `BUILT_BY_WRITER`
   and mapped to other writers' release tests. TST-740301 checks that no case of this file guards them. I compared every
   item whose code opus-e wrote with the requirements this file's release cases guard. The only overlap is
   `ONE CLICK PER DECISION` and `THE PAGE NAMES WHERE IT SENDS`, through ITM-1319 (accepting a use case fills the
   backlog) and ITM-779 (the process-model editor). TST-740316 and 740318 test the *Implement* page's part shown before a
   click, *Start jobs* and *Merge*, which those items did not build. The reading is the sprint's: the writer has built
   none of the behaviour a case guards.
5. **The Acceptance holds:** TST-740201 maps the thirteen main steps and the sixteen alternative flows, the existing unit
   tests among them. 9a is left out with its reason, since it is the participant's own work. TST-740301 maps the 44
   requirements UC-024 realises, five of them guarded at review only. The pull request records 45 planted faults, and
   every case but the two maps and the `todo` fails on one.

## Ruled

- **UC024-F1, TST-740207 (`todo`) → no new item; it waits for akmaier with ITM-568's cut.** UC-024 step 4 gives every step
  "the product's coding standards file, if it has one". `src/run-planner/inputs.mjs` leaves it out (its comment at :10),
  because MOD-run-planner's accepted text names no path for that file. ITM-568 cut it "until akmaier accepts the draft
  that names it (`AGENTS.md` at the product's root)". No accepted text gives the path, and a test would have to choose
  one, so no reading lets it be built now. The general change it needs is a module text that names the file. The `todo`
  stays and names the finding.
- **10a, "the step returns to *ready* with the reason attached" → no finding.** TST-740218 walks the rejection: one
  commit, with a record of decision `rejected` that holds its reason under `## Reason` (MOD-product-process's gate
  record, "required for `rejected`"). The reason is attached through that record, which names the job.
  MOD-implementation-pages shows the reasons for a step "if it cannot start" (MOD-implementation-pages.md:188), and a
  step that is ready again can start. No module text assigns showing a rejection's reason beside a ready step, so no
  item is needed.

## Readings taken

- A battery needs no red run.
- Step 1's "configures it here" is the link to `#process`.
- Steps 8 and 9 are the participant's work and are checked at step 11.
- 9b's draft offers no *Merge*.
- Step 10 is decided through `recordGateDecision`.
- 1c is checked on the host the page uses.
- `NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED` is tested with an open use case.
- A requirement guarded at review only gets no release test.

All are taken.
