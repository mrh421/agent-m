---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c042f1ceeb2b65864117d4c5b2c7ff67db4b567e
  - https://github.com/akmaier/agent-m/pull/1412
date: 2026-10-29 07:23 UTC
---
# Development → Release testing: ITM-1301, the specification says which waiting entry marks a requirement

**REGISTER**

## Reason

ITM-1301, pull request #1412 into `sprint/team1/113`, passes on `c042f1ce`, its head when this was decided.

1. **No red first commit is due, and the developer's ruling is upheld.**
   - The item changes no behaviour: its Acceptance says "No behaviour changes".
   - AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST binds "an implementation job that adds or changes behaviour"
     (SPEC.md:1462-1464). The rule that holds is A REFACTORING JOB BEGINS WITHOUT A FAILING TEST: "the product's CI run is
     green on every one of its commits" (SPEC.md:1467-1469).
   - Both commits are green: the tests-only commit `d8475cbf` in run 40834222077, and `c042f1ce` in run 40834692360. Each
     passes 38 of 38 pull-request jobs.
   - No expected result of an existing test changes.
2. **Only its module changes.** `src/trace-pages/flow.mjs`, where only the comments at `arrangement` change (3 lines added,
   2 removed), and the new `tests/trace-pages-newest-queue-marks.test.mjs`, named MOD-trace-pages.
3. **The Acceptance holds.**
   - TST-1301001 pins that, of two queues, the newer one's entry marks the requirement, and that both entries are listed,
     newest first. Its in-test counter-proof exchanges the entries.
   - The comment now says the order is the one `waitingQueues` gives, newest queue first, and that the other entries stand
     in the list of waiting entries.
   - **The planted fault, run by me:** without `&& !status.has(name)` in `arrangement`, the test fails (0 pass, 1 fail).
     Restored, it passes.
4. **The reader.** On `c042f1ce`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `trace-pages-newest-queue-marks`: 1 declaration, TST-1301001, and 0 findings.

## Noted

- TST-595009 pins the mark already, and not the listing. TST-1301001 pins both for two queues, and changes nothing of
  TST-595009.
