---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 903bd7a7b4e9149415342e06ae7b5b956b8fd821
  - https://github.com/akmaier/agent-m/pull/1632
date: 2026-11-01 17:30 UTC
---
# Development → Release testing: ITM-1347, #1632

**REGISTER**

## Reason

ITM-1347 (the test helpers of the emergency declare their level and count what is sent together) may go on. The pull
request is #1632 into `sprint/team1/141`, at `903bd7a7b`, by developer-sonnet-k (`Agent-M-Participant` on `c87bd4759`
and `bf259e464`). The head is the Scrum Master's merge of the sprint branch, with no change of its own. I wrote none of it.
1. **No failing first commit is required:** the item adds no behaviour of the product. It changes test helpers and adds a
   test of the harness.
2. **CI is green on the head:** run 41293223232 (pull_request, `903bd7a7b`), at the first attempt. Its earlier run
   41291832366 failed only TST-738002, the sprint branch's clash with ITM-1355, which #1634 fixed.
3. **Only test files of the item's modules change.**
   - `Level: unit` is added to `tests/github-trees-fake.mjs` and the six `tests/site-frame-start.d/*/routes.mjs`.
   - In `tests/app-harness.mjs`, a tree request joins the current round only while a request of that round is in
     flight.
   - `tests/site-frame-harness-folder-rounds.test.mjs` is new (TST-1347001 to 1347003).
   - I checked with `testHeader` that every changed file names MOD-site-frame or MOD-repository-hosts. No code of
     `src/` changes.
4. **The Acceptance holds:**
   - The seven helpers declare their level. `testHeader` reported EVERY TEST HAS ONE LEVEL on the old
     `github-trees-fake.mjs` (the known positive), and on all seven it now reports level `unit` with no finding.
   - The harness counts only the tree requests sent together. Counter-proof on the unchanged harness: TST-1347002 fails
     (1 vs 2) and TST-1347003 fails (2 vs 1).
   - The probe ran the 152 files that use the harness. After the merge, no expectation moves and no page reads the tree
     twice.

## The reading, ruled

**"Sent together" is read as in flight together** (MOD-repository-hosts.md:200-203, `readSnapshot` sending a snapshot's
commit and trees together). A request of another kind no longer ends a round, and TST-1347003 states it. Taken.
