---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 284b57b7700165e4aed2973e2467649b0392edce
  - https://github.com/akmaier/agent-m/pull/1711
date: 2026-11-01 21:13 UTC
---
# Development → Release testing: ITM-1413, #1711

**REGISTER**

## Reason

ITM-1413 (the bash timeout test waits for the process tree to end) may go on. The pull request is #1711 into
`sprint/team1/142`, at `284b57b77`, one commit by developer-opus-f (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item adds no behaviour (its Acceptance).
2. **CI is green on the head:** run 41350548805 (`284b57b77`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's test changes:** `tests/checkout-tools-bash.test.mjs` (`Module: MOD-checkout-tools`).
4. **The cause, as a data-flow path.**
   - The case runs `sleep 30 & echo $! > pid1; wait` (:48). Bash creates `pid1` empty before `echo` writes it. The case
     waited only for the file to exist (:49), read "" and took `Number("") = 0` as the process id (:50).
   - `alive(0)` is `process.kill(0, 0)`, which signals the test's own process group, so it is always `true` (:51, :53).
   - The tool itself had ended the tree: its timeout (`shell.mjs:113`) → `terminate` (:58) → `stopTree`, SIGTERM to the
     group (`processes.mjs:31`) → `ESRCH` at the first poll, about 550 ms in.
   - Both CI failures took 658 ms. A sleep left alive would have held `terminate` for 3 s.
5. **The Acceptance holds:**
   - `pidIn` waits until the file holds a whole process id. `ends(pid)` polls until the process is gone, with a deadline
     of 10 s, shorter than the 30 s sleep, so a sleep left alive still fails.
   - The assertions' values and messages stay, and the declarations name the wait.
   - With the gap between creating and writing the file widened to 50 ms, the old case failed 40 of 40 with CI's message,
     and the new case passed 40 of 40. Unchanged, under load, both passed 400 of 400.
   - Planted fault: `terminate` using `child.kill` instead of `stopTree` fails the new case with "the background sleep is
     ended with its command".

## Reading taken

- `A REFACTORING JOB CHANGES NO EXPECTED RESULT`: no asserted value changed. The check that the process has ended now waits
  for it, within a deadline shorter than the sleep.

## Noted

- The item's Outcome supposed the case read the state before the SIGKILL. The cause is the process id 0 read from an empty
  file. This record states the cause found, and the item is not changed.
