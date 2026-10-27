---
id: ITM-1241
title: The refused-ask test counts after the first ask is done
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
  - UC-011
modules:
  - MOD-bridge-jobs
builds_on: []
tests:
  - unit
origin:
  - TST-472082 failed with "no agent was started by a refused ask", 8 !== 7, on PR #1365's head 84a6e0c2 (run 40479849400, job 122107200771) and passed on its rerun; it failed alike on PR #1360 before
---
# ITM-1241 The refused-ask test counts after the first ask is done

**REGISTER**

## Outcome

TST-472082 (`tests/bridge-jobs-agents.test.mjs:257`) starts one ask to the fake opencode as a known positive, waits only
until the fake has logged its `opencode run` line (`:265`), and then counts the lines of the calls file (`:266`). The fake
goes on writing to that file: it appends its standard input (`/bin/cat >> calls; printf '\n' >> calls`, `:52`). Where that
line lands after the count, the count after the refused asks is one more (`:271`, `8 !== 7`), though no refused ask started
an agent. The Bridge behaves as MOD-bridge-jobs states; the test reads a file still being written.

The test counts only once the first ask is done (its existing wait at `:273`, moved before the count), so that the fake
has ended and written everything; what it asserts does not change. A refused ask that starts an agent still fails it.

## Acceptance

- Only `tests/bridge-jobs-agents.test.mjs` changes; the Bridge's code does not.
- Counter-proof, stated in the PR: with a delay planted locally (not committed) in the fake opencode between its log line
  and its input, the test as it was fails at `:271` and the changed test passes; with `POST /v1/ask` planted to start the
  agent for a refused ask, the changed test still fails.
- CI is green on the head.
