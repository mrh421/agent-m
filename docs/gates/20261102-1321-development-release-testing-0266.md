---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3f963345aab72b66eafd00590ab2b5c8f4f96628
  - https://github.com/akmaier/agent-m/pull/1741
date: 2026-11-02 13:21 UTC
---
# Development → Release testing: ITM-266, #1741, the system and release tests of UC-003

**REGISTER**

## Reason

ITM-266 was written by developer-sonnet-k (`Agent-M-Participant` on `3f963345a`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41451445622 (`3f963345a`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - the harnesses `tests/uc-003-harness.mjs` and `uc-003-job-harness.mjs`;
   - `system-uc-003-configure-a-model-endpoint` (TST-266201 to 266213) and `system-uc-003-a-job-through-the-bridge`
     (266221);
   - `release-uc-003-configure-a-model-endpoint` (266301 to 266307) and `release-uc-003-a-job-through-the-https-route`
     (266311, 266312).

   They drive the real Settings page, the Bridge as its own program, a model server on loopback and a job of the prompt
   bar. The four existing files of UC-003 are mapped and not changed.
4. **Who wrote what it tests.** By the trailers, UC-003's code is others'. sonnet-k's ITM-1378 and 1381, a CI job reading
   the key an endpoint's secret names, is guarded by no case here.
5. **The Acceptance holds:**
   - The pull request records 44 planted faults, and every passing case fails on at least one.
   - One fault that first failed nothing was replaced. One run that overlapped another was discarded and all were redone.

## Ruled

- **UC003-F1, TST-266213 → ITM-1441 (MOD-settings-pages), registered in this commit.** The *Clear* on an endpoint's line
  says nothing, where UC-003 2b has Agent M confirm that nothing is stored; the form's *Clear* does. It waits for
  MOD-settings-pages after ITM-1437, 1438 and 1439.

## Not walked

- UC-017 step 4 and UC-049 step 4 are their batteries'.
- The SSH forward and the jump host's set-up are UC-011's and UC-044's. The HTTPS front is a fixture.

## Readings taken

- An endpoint kept as a CI secret, without a Bridge, is walked as its stored name.
- "A job's request" is a conversation job of the prompt bar.
- 2b's confirmation is a sentence saying the endpoint is cleared.
- The page's `GET /v1/pair` and `/v1/agents` are not test requests.
- A GraphQL `POST` that only reads is a read.

All are taken.

## Noted

These are candidates for the review and are not registered now:
- A Bridge that cannot reach the model shows only "✗ fetch failed".
- The *Test* of an endpoint's line shows "working", not the capability.
