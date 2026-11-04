---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1534d9899593b28c398a05ceda3c277f2623dc6a
  - https://github.com/akmaier/agent-m/pull/1716
date: 2026-11-02 08:40 UTC
---
# Development → Release testing: ITM-1417, #1716

**REGISTER**

## Reason

ITM-1417 (the Bridge jobs test waits for the job's end) may go on. The pull request is #1716 into `sprint/team1/142`, at
`1534d9899`, one commit by developer-opus-f (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item adds no behaviour (its Acceptance).
2. **CI is green on the head:** run 41413684300 (`1534d9899`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's test changes:** `tests/desktop-shell-bridge-jobs.test.mjs` (`Module: MOD-desktop-shell,
   MOD-bridge-jobs, MOD-bridge-http`).
4. **The cause, as a data-flow path.**
   - `watch.mjs:248` `ended()` → :281 `host.commitFiles` → `local-git.mjs:108` pushes the end's commit. Origin's ref moves
     while the push runs, so the case's wait (:145), which reads origin, already sees `## End`.
   - `local-git` then waits for the push to exit and removes its folder (:115) before `watch.mjs:249` sets the listed
     state.
   - The case's one `GET /v1/jobs` (:161) can land in between, which gives "running" where "done" is expected: the
     failure on CI.
   - A local probe saw origin hold the end before `commitFiles` resolved in 13 of 30 idle runs and 11 of 30 under load.
5. **The Acceptance holds:**
   - TST-367004 polls `GET /v1/jobs` with the shared wait, deadline 30 s, until the job is no longer running. It then
     asserts the same `[[id, "done", "opencode"]]` and the ended log. Its `input` names the wait; `given` and `expect` are
     unchanged.
   - With a delay of 2 s planted before `watch.mjs:249`, the old case failed with CI's message (run 41413719878), and the
     new case passed (41413723726).
   - A planted fault that drops the listed state's update fails the new case, "failed" against "done" (41413727171).
   - No more repeats on CI are asked: the widened window reproduces the failure on demand, which is the proof the
     Acceptance needs.

## Reading taken

- MOD-bridge-jobs' "live states" are read as current, not as changing in the same moment the record lands on origin. So
  the cause lies in the case, as the item says.

## Noted

- The three branches `probe-itm-1417-*` stay on origin as evidence until this gate, and the Scrum Master deletes them after
  the merge.
- opus-f did not read the sprint plan. Its reads for a tests-only item (AGENTS.md, SPEC.md, chapter 13, the item, the
  module files) were in full, and its work is checked here.
