---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d86447e591625d2ebdad81381e2fabac93d4a5e1
  - https://github.com/akmaier/agent-m/pull/1699
  - 8d1b46ad7f6274ef43ce2fd0c37d90b8f5bfe4d9
  - https://github.com/akmaier/agent-m/pull/1696
date: 2026-11-01 20:00 UTC
---
# Development → Release testing: ITM-805 (#1699) and ITM-1045 (#1696), the system and release tests of UC-034 and UC-043

**REGISTER**

The two batteries are decided in one record, because their findings overlap. I wrote none of either.

## Reason: ITM-805, #1699

ITM-805 was written by developer-sonnet-j (`Agent-M-Participant` on `d86447e59`).
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41344016144 (`d86447e59`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-034-harness.mjs`;
   - `system-uc-034-implement-backlog-items` (TST-805201 to 805221);
   - `release-uc-034-implement-backlog-items` (TST-805301 to 805306);
   - the checks the SPEC names, at level release, each with its data file: `test_job_gate.py` (TST-805401 to 805404),
     `test_gate_record.py` (805501 to 805504) and `test_job_assignment.py` (805601 to 805603).
4. **Who wrote what it tests.**
   - sonnet-j built ITM-817, 1316, 1330, 1332, 1343, 1272, 1368 and 1371, among others. `A BACKLOG ITEM NAMES THE MODULES
     IT CHANGES` is mapped to other writers' TST-803103 and 987303.
   - I compared every item whose code sonnet-j wrote, by `Agent-M-Participant` on `src/`, with what the new release cases
     and checks guard: the gates, their records, the holders of a role, the runs and the teams' sprints. None of those
     items realises one of these requirements. Known positive: 22 items realise them, none of them sonnet-j's.
   - sonnet-j did not check the writers of the 23 release cases its map names, so I did, by the commit that wrote each
     case. Four are sonnet-j's: TST-804305, 1061101, 1061109 and 1061201. They guard `NOTHING IS IMPLEMENTED BEFORE IT IS
     ACCEPTED`, `A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN` and `A RUN FOLLOWS THE MODULES' INTERFACES`, which no
     item of sonnet-j's built, so sonnet-j may have written them. The rest are by
     sonnet-l, sonnet-k, opus-e, or commits that name no participant.
5. **The Acceptance holds:** TST-805201 maps UC-034's flow and names 4a, 5a, 5b and 6b as not walked, with reasons.
   TST-805301 maps 37 requirements. Each of the 29 planted faults fails a named case.

## Reason: ITM-1045, #1696

ITM-1045 was written by developer-sonnet-k (`Agent-M-Participant` on `5ac78bd6f`, `7d8a7a4ec` and `8d1b46ad7`).
1. **No failing first commit:** a battery adds no behaviour.
2. **CI is green on the head:** run 41344085676 (`8d1b46ad7`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-043-harness.mjs`;
   - `system-uc-043-run-the-process-over-a-selection` (TST-1045201 to 1045234);
   - `release-uc-043-run-the-process-over-a-selection` (TST-1045301 to 1045311);
   - `tests/test_process_run.py` with its data file (TST-1045401 to 1045412), the check the SPEC names for the six
     requirements of a run.

   The harness plays the run's participant, since akmaier withdrew the run page (`3a3938318`).
4. **Who wrote what it tests.** sonnet-k built ITM-1329, 1333, 800, 1336, 1340, 1278, 1378, 1381, 1259 and 1346, and none of
   the start of a sprint's jobs. TST-1045301 maps 25 requirements:
   - 22 with release evidence;
   - `ONE CLICK PER DECISION`, at review;
   - `EVERY TEAM RUNS SPRINTS OF ITS OWN`, named open. Its release case can come from ITM-805's cases, which test a team's
     plan, start and end without touching another team's; a later mapping by sonnet-l closes it.
5. **The Acceptance holds:** about 35 planted faults, each failing a named case, and three `todo` lifts tried on fixes
   (F1, F3, F4).
6. **What sonnet-k read.** It read several module files in part and not chapter 8. AGENTS.md §1 asks chapter 13 for
   tests, not chapter 8. Its cases are checked here by their content. The brief's "in full" holds for the next item.

## Findings, ruled

**The run's machinery: no item; for akmaier.** akmaier withdrew the unbuilt parts of the runs on 2026-10-28 (`3a3938318`):
the run page, a run's next actions, its hold at a limit, CI and the Bridge advancing runs, and a finished run's record.
UC-043 and the SPEC's requirements of a run still stand. The findings that ask for those parts are therefore not built,
and their cases stay `todo` naming the finding:
- ITM-1045: F2 (nothing selects steps, takes limits or writes a run's record), F3 (no presets of the limits), F4 and
  ITM-805's F6 (a held run still starts jobs), F5 (no tests job after the implementation), F6 (no `finish`), F7 (3b, no
  holder), F10 (stopping a run cancels none of its jobs) and F11 (a V-model's test step beside its implementation step);
- ITM-1045 F1: a run's record taken as every step's job by `itemStates`. It arises only once a run's record is written;
- ITM-1045 F8 (1d, `set-up-ci` started with no plan) and F9 (1b, an open module file stops no step), both steps of a run.

No reading lets these be built without the run akmaier withdrew. The general change is one decision of akmaier's: either
withdraw the run from UC-043 and the SPEC's requirements of a run, or bring back the run's items.

**ITM-805's findings outside the run: items, registered in this commit.**
- **UC034-F1, TST-805204 → ITM-1408 (MOD-implementation-pages).** No control opens `#implement/sprint=<team>/<nn>`
  (*Start sprint work*, UC-034 step 1). The module holds the backlog and the starting of items, but does not name the
  control; noted for akmaier.
- **UC034-F2, TST-805208 → ITM-1409 (MOD-run-planner).** `implementation-inputs` sends no item file, no realised use case,
  no tests of its requirements and no process requirements (step 3). The module's list is read as what the recipe must
  give, not all it may.
- **UC034-F3, TST-805211 → ITM-1410 (MOD-implementation-pages).** A Bridge that does not answer is reported as "nothing was
  started", though the start record is written, and no route is named (4a).
- **UC034-F4, TST-805213 → ITM-1411 (MOD-runtimes).** The pull request names the requirements its tests guard, not those
  its item realises nor its issue (5.3). MOD-runtimes' "names … the requirements its new tests guard" does not say "only",
  so it is no conflict with UC-034, and the description names both.
- **UC034-F5, TST-805218 → ITM-1412 (MOD-workflow-entries, MOD-runtimes).** A rejected gate ends no job
  (`product.mjs:332` resumes only on `passed`). MOD-product-process and MOD-runtimes give the resumption after a gate to
  these modules, but do not list the rejection; noted for akmaier.

## Noted

- The reason "ITM-004 builds on ITM-003 is not done, which is not done" repeats itself. It is a candidate for the review.
- No `run` kind exists and nothing calls `nextActions`, which follows from the withdrawal.

## Readings taken

- **ITM-805:**
  - "Nor on a record by anyone else" is `recordGateDecision` refusing a participant who does not hold the role.
  - The run's requirements are tested on `nextActions`.
  - `EVERY TEAM RUNS SPRINTS OF ITS OWN` is tested as a team's plan, start and end leaving another team's untouched.
- **ITM-1045:**
  - The harness plays the run's participant.
  - "From one start" is one run record.
  - The `set-up-ci` job works on UC-027.
  - The Scrum case leaves out ITM-005.

All are taken.
