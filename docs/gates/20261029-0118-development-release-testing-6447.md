---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8494a9119028186168551bd81f6434225f4ff126
  - https://github.com/akmaier/agent-m/pull/1385
date: 2026-10-29 01:18 UTC
---
# Development → Release testing: ITM-1272, the waiting change queues are read from the overview stored for the commit

**REGISTER**

## Reason

ITM-1272, pull request #1385 into `sprint/team1/110`, passes on `8494a911`, its head when this was decided.

The condition and the Definition of Done are those of `docs/process-models/scrum-wip.md:53` and SPEC.md:1870-1873,
the default: "its CI run is green, the job's first commit held only failing tests …, it changes only the job's modules,
every new test names the requirement it guards and the module it exercises".

1. **CI is green.** Run 40798356914 on `8494a911` passes 38 of 38 pull-request jobs. The 17 jobs of other triggers are
   skipped.
2. **The first commit held only failing tests.**
   - `596f823e` adds only `tests/progress-measures-waiting-queues.test.mjs`.
   - Run 40797262494 is red on it in one job, unit shard 16 (job 123196729922). The cause in its log is "The requested
     module '../src/progress-measures/index.mjs' does not provide an export named 'waitingQueues'". That is the item's
     reason: `waitingQueues` is not built.
   - No test that existed before failed.
3. **Only its modules change.** `src/progress-measures/index.mjs`, `stages.mjs`, `src/trace-pages/flow.mjs`, and the new
   test, which names MOD-progress-measures.
4. **Every new test names its requirement and module.** TST-110272 to 110276, MOD-progress-measures. They guard OPEN
   PROPOSALS ARE SHOWN IN THE BROWSER, A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE and A PAGE LOAD READS THE
   REPOSITORY IN BATCHES, with UC-020 and UC-047.
   - The description records three planted faults, each failing only its own test.
5. **The behaviour is the accepted text.** `waitingQueues` gives the stored overview's queues, else the last one's with
   `asOf`, else `queues`, and "fails with the host's errors but `NotFound`" (MOD-progress-measures.md:322-327).
   - `waitingForAcceptance` and `waitingEntries` call it, so the rule stands once.
   - `tests/trace-pages-specification.test.mjs` is unchanged and green, as the Acceptance asks.

## Noted

- **One difference of behaviour, as the accepted text gives it.** A host error on reading the overview now ends
  `waitingEntries` with no entries. Before, it fell through to every queue (`flow.mjs:591-597`). The description names
  this reading.
- **`storedOverview` is now cached per repository and commit** (`stages.mjs`, `OVERVIEWS`), so that two snapshots of one
  commit read `<commit>.json` once. TST-110276 pins it. A snapshot without a `repository` object is kept by itself, as
  before.
