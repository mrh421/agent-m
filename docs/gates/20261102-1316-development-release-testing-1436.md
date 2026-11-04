---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5ea09949b69d3c28b45bee00cf65e25b15946007
  - https://github.com/akmaier/agent-m/pull/1739
date: 2026-11-02 13:16 UTC
---
# Development → Release testing: ITM-1436, #1739

**REGISTER**

## Reason

ITM-1436 (the tunnel check's forward answers, or says why not) may go on. The pull request is #1739 into
`sprint/team1/142`, at `5ea09949b`. developer-opus-f wrote the tests-only commit `52c3f248b` and the code `5ea09949b`
(`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `52c3f248b` adds
   `tests/bridge-build-tunnel-check-ports.test.mjs` (TST-1436001, MOD-bridge-build). In run 41449791938 it is the only
   failing case: "the Bridge, the reverse tunnel and the forward: 44793, 44793, 44793".
2. **CI is green on the head:** run 41450304199 (`5ea09949b`), at the first attempt, in every job. `git merge-tree` with the
   sprint branch's head is clean.
3. **The probe showed the cause on CI, as the item asked first.**
   - In run 41447980370 (job 125285845753), one of 5935 checks stalled with CI's message.
   - `check.mjs:203` took three ports with `freePort` (:105). Each listened on 0 and closed before the next, so the system
     gave 37235 twice: the Bridge's port and the forward's.
   - The app's Bridge listened on it. MOD-tunnels (`src/tunnels/index.mjs:110`) then could not bind the forward there,
     named the port taken (:117) and retried in vain.
   - The check's poll of the forward's port reached the Bridge, which answered "a token is required", so after 60 s it
     threw.
   - The other candidate, a client closing before `ready` without an error, never occurred in 5935 checks.
4. **Only the item's module changes:** `src/bridge-build/check.mjs`. `freePorts(count)` keeps all three servers open while
   it reads their ports, and then releases them, so the three differ. MOD-tunnels does not change.
5. **The Acceptance holds:**
   - With a system that hands a closed port out again at once, the check gets three different ports and resolves through
     both tunnels.
   - The counter-proof: the old `freePort` fails with "no request was answered through the forward within 15 seconds".
   - The tests of MOD-bridge-build and MOD-tunnels and the Bridge's release tests pass.

## Reading taken

- "Ends with its reason rather than at the deadline": MOD-tunnels already names a port taken. With the check's own
  duplicate removed, the check ends answered. No new reason is written, and no expected result changes.

## Noted

- One probe run, 41439579194, hung for more than 50 minutes and lost its output. A candidate not tested is that
  `fetchOnce` (`check.mjs:114-123`) resolves only on `end`, so a response that stalls after its headers never resolves.
  That is one observation, not a flip of a test. It is a candidate for the review, not registered now.
- The probe branch stays on origin as evidence until this gate; developer-opus-f deletes it after the merge.
