---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0eb3e29b6d2af3ccdb4fe979f61c41dd2d46c1c1
  - https://github.com/akmaier/agent-m/pull/1724
date: 2026-11-02 11:17 UTC
---
# Development → Release testing: ITM-1428, #1724

**REGISTER**

## Reason

ITM-1428 (the tunnel check's test ends within its limit) may go on, for the case it changes. The pull request is #1724 into
`sprint/team1/142`, at `0eb3e29b6`, one commit by developer-opus-f (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item adds no behaviour (its Acceptance).
2. **CI is green on the head:** run 41420734222 (`0eb3e29b6`), at the first attempt, TST-961009 in 578 ms. No job failed or
   was cancelled. `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's test changes:** `tests/bridge-build-build-platform.test.mjs` (MOD-bridge-build).
4. **The cause, as a data-flow path.**
   - The case's start (:301) → `run.build()` → `builder.mjs:220` `tunnelCheck` → `check.mjs:214` starts the app, whose first
     line logs the arguments the case asserts.
   - The app opens the reverse tunnel and the forward through the test's SSH server.
   - `check.mjs:223-230` polls until its deadline of 60 s (:196). On CI the forward never answered, so the check threw, the
     build rethrew (`builder.mjs:225`), and the case failed before it read the log.
5. **The Acceptance holds:**
   - TST-961009 now starts an app that logs its arguments and ends at once. The build rejects at once with "the packaged
     app ended with code 0", which the case now asserts too.
   - The expected arguments are unchanged: `--no-sandbox` on Linux, none on macOS.
   - With the server refusing the forward, the old case failed at 60 s with CI's message (run 41420625503), and the new
     one passed in 473 ms (41420629975). 80 builds under load did not stall (41418854456).
   - The planted faults at `check.mjs:214`, no argument on Linux and `--no-sandbox` everywhere, each fail.

## Reading taken

- "Keeps its expected results" means the two lists of arguments the case expects. That the build resolves and the tunnels
  answer is TST-961005's to show.

## Ruled

- **The stall's cause stays open, and the file can still flip → ITM-1436 (MOD-tunnels, MOD-bridge-build), registered in
  this commit.**
  - The flip counted at sprint 141's close was TST-1082001's, with the same "forward within 60 seconds".
  - TST-961004, 961005, 961007 and 1082001 still need the real check.
  - opus-f named two candidates from the code: a client that closes before `ready` stays `opening` for ever
    (`src/tunnels/index.mjs:114`), and a port released before the app binds it (`check.mjs:105`). ITM-1436 shows the cause
    with a probe first, as a data-flow path, and fixes it where the module texts assign it.
- The probe branches stay on origin as evidence until this gate; the Scrum Master deletes them after the merge.
