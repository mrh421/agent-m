---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - e1b6e0b58aaa9d417ecb377a8b71cc0237f9617e
  - https://github.com/akmaier/agent-m/pull/1433
date: 2026-10-29 10:18 UTC
---
# Development → Release testing: ITM-1295, the Bridge's job-list test removes its folders without flipping

**REGISTER**

## Reason

ITM-1295, pull request #1433 into `sprint/team1/115`, passes on `e1b6e0b5`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874). The item changes a test and no behaviour. So its commits are
green, as A REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469), and the sprint's brief says so of
ITM-1295.

1. **CI is green on its one commit.** Run 40855669294, `pull_request`, on `e1b6e0b5` passes 38 of 38 pull-request jobs.
2. **The cause is named as a path, as the Acceptance asks, and the code bears it out.**
   - The Bridge writes a job's end at `src/bridge-jobs/watch.mjs:281`, `host.commitFiles(…)`, which reaches
     `src/repository-hosts/local-git.mjs:108`, `git push --quiet origin <commit>:refs/heads/<branch>`, in the product's
     clone under `agent-work/`.
   - The server's ref moves inside `receive-pack`. The client's push updates `.git/refs/remotes/origin/main` of the clone
     only after `receive-pack` has exited.
   - The test pauses the Bridge with `stopWatching("pause")`, which does not await a running job. The world's `finally`
     then removed the folder while that push was still alive: `ENOTEMPTY` on `rmdir …/.git`.
   - `ended` returns its part only after `commitFiles` has returned (`watch.mjs:279-282`). So the job is listed running
     until that push has exited.
   - **The measurement** (GIT_TRACE2, in the pull request): with the old cleanup, 85 of 192 runs had a process alive at
     `rmSync`, 83 of them that push, and 1 gave `ENOTEMPTY`. With the fix, 0 of 192 had one alive, and all 192 passed.
   - **ITM-949's detached maintenance** is ruled out: the nearest one ended 410 ms before `rmSync`. Its positive control
     found it in 96 runs.
3. **The fix stays within the Acceptance.**
   - The world's cleanup waits, with the file's own `until` and its bound, until no job of the Bridge is listed running.
     Then it removes the folder. `PATH` and the `GIT_CONFIG_*` keys are restored in an inner `finally`.
   - No retry of the removal is added.
   - **Reading taken:** "no wait whose bound is not the end of that process" (ITM-1295's Outcome) allows a poll whose
     condition is that end. A job leaves the state running only once its end's push has returned (point 2).
   - Only `tests/bridge-jobs-list.test.mjs` (MOD-bridge-jobs) changes. No code, no other test, and no expected result of
     its four earlier cases change. No test is removed.
4. **TST-1295001, beyond the Acceptance, stays.** It pins the Acceptance's own sentence, "its cleanup removes its folders
   on every run of one commit", which no case asked for before. The item named no test that does, and A NEW TEST IS SHOWN
   TO FAIL ON A PLANTED FAULT (SPEC.md:1527-1530) is met by it.
   - **The planted fault, run by me on `e1b6e0b5`:** with the wait taken out of the cleanup, the file runs 4 pass and
     1 fail. The failing case is TST-1295001.
   - Restored, it runs 5 pass.
5. **The reader.** On `e1b6e0b5`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `bridge-jobs-list`: 5 declarations, TST-1295001 among them, and 0 findings.

## Noted

- ITM-1295 changes no behaviour of Agent M, and no release test of it is due. The gate Release testing → Sprint review
  checks "the release tests (TST) of the selected items" (`docs/process-models/scrum-wip.md:54`), as for ITM-1296 in
  sprint 111.
