---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 79e4e5723eb4e03bbc46e7998ed9f48db7d647d9
  - https://github.com/akmaier/agent-m/pull/1608
date: 2026-11-01 07:15 UTC
---
# Development → Release testing: ITM-1346, #1608

**REGISTER**

## Reason

ITM-1346 (a lazy registration that fails is made at the next call) may go on. The pull request is #1608 into
`sprint/team1/141`, at `79e4e5723`, by developer-sonnet-k (`Agent-M-Participant` on every commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `7210c4201` adds only
   `tests/job-runner-lazy-registration-retry.test.mjs`. In run 41280383796 (pull_request) its one failure is TST-1346001.
2. **CI is green:** run 41280408015 on the code commit `717dd5d3b`, and run 41280792001 on the head `79e4e5723`
   (pull_request, first attempt). `git merge-tree` with the sprint branch's current head is clean.
3. **Only the item's module and its test change.** `src/job-runner/registry.mjs` changes, and the new test is headed
   `Module: MOD-job-runner`. `registeredAll` now runs `later[0]()` and takes it off the list only once it is made, as
   MOD-job-runner.md:299-300 gives it: "makes every registration … that is not made yet, each once, in the order handed".
4. **The Acceptance holds:**
   - A registration that throws at the first call is made at the second, and the ones after it follow in order.
   - A registration already made is not run again.
   - The red run is the counter-proof.
5. **`79e4e5723` changes only TST-1346001's wording.** It no longer calls the made-once check a "known positive". No
   assertion changes. Allowed.

## Noted

The local runs of the importers' tests failed in 12 desktop-shell and places files. Two need Bridge packages that are not
installed locally, and one fails the same way on the base. CI, which installs the packages, is green, so none of them is
a finding of this item.
