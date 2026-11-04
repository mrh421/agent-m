---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 95482caccdf204443aa8a25850174e84f8be0618
  - https://github.com/akmaier/agent-m/pull/1464
date: 2026-10-29 16:34 UTC
---
# Development → Release testing: ITM-1312, the tunnels runtime release test waits for the states it asserts

**REGISTER**

## Reason

ITM-1312, pull request #1464 into `sprint/team1/120`, passes on `95482cac`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item changes one test and no code, so its one commit is
green, and no failing first commit is asked of it.

1. **CI is green.** Run 40911595131 (`pull_request`, head `95482cac`) succeeds: 58 jobs, none failed.
2. **Only the test changes.** The diff against `sprint/team1/120` is TST-286904 in
   `tests/release-itm-286-tunnels-runtime.test.mjs`: its `input:` line and its worker script. The other three cases of
   the file are unchanged.
3. **What the test measures now** (the path named in the item):
   - The cycling host records, for each connection, when it opened (before the handshake) and when it closed. A wait is
     `conns[i].opened - conns[i-1].closed`, so the connect and handshake that follow it are left out.
   - The test waits until the asserted states are reached, four connections among them. After 15 s it fails with the
     named error "asserted states not reached in 15000ms" and the states it saw.
4. **Checked by me on `95482cac`.**
   - The file passes, 4 of 4, with `test-document-one-line`: 6 pass and 0 fail.
   - MOD-test-document's reader gives 4 declarations and 0 findings. Its control,
     `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
   - **The Acceptance's repetition:** 40 runs beside 60 busy processes on 20 cores, 40 pass. On `main` before, the same
     repetition failed 1 in 40 (`docs/backlog/sprints/team1/120.md`).
   - **Planted fault:** a constant wait of 200 ms (`src/tunnels/index.mjs:123`) makes TST-286904 fail. Reverted, the tree is
     clean.
5. **The writer implemented none of what it checks** (SPEC.md:1537-1541). developer-sonnet-k built none of MOD-tunnels.

## The reading ruled

The item's Acceptance keeps "the reconnect waits grow" as the expected result. The `expect:` line is unchanged. The
developer asserts the growth over the second and third waits, not the first and second.
- **The developer's finding.** Measured without the handshake, `waits[1] > waits[0]` still failed 3 in 40 under load. The
  first wait is inflated by up to about 200 ms: the runtime's first timer fires late while three cold handshakes hold the
  event loop.
- **What is asserted.**
  - Before: `gaps[0] ≥ 80`, `gaps[1] ≥ 180` and `gaps[1] > gaps[0]`.
  - Now: `waits[0] ≥ 80`, `waits[1] ≥ 180` and `waits[2] ≥ 1.5 · waits[1]`, with a fourth connection.
  - Both lower bounds stay. Growth is still asserted, between the nominal 200 and 400 ms waits.
- **No counter-proof is weakened.** A wait that does not grow fails, as my planted constant of 200 shows. The ratio is
  stricter than `>` for a nearly constant wait. A wait that grows only from the first to the second, then stays, also
  fails.
- **Right.** It is the same expected result, measured where load does not mask it. This follows the item's path: the
  runtime's waits are 100, 200 and 400 ms (`src/tunnels/index.mjs:122-123`), and MOD-tunnels states only "growing waits"
  (MOD-tunnels.md:61).

## Noted

- ITM-1312 is itself a release test, written by a participant other than the implementer. developer-sonnet-l adds none
  for it.
