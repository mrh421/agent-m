---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - cc09f0df055e61e42174a0677a544c17aff1268e
  - https://github.com/akmaier/agent-m/pull/1554
date: 2026-10-31 10:57 UTC
---
# Development → Release testing: ITM-1325, the backlog page shows what no item realises at its top

**REGISTER**

## Reason

ITM-1325, pull request #1554 into `sprint/team1/131`, passes on `cc09f0df0`, its head when this was decided. Both commits
carry `Agent-M-Participant: developer-opus-f`.

1. **The first commit holds only tests and is red for the item's reason.** `14af584af` adds
   `tests/implementation-pages-backlog-uncovered-first.test.mjs` and changes the expected order in
   `tests/implementation-pages-backlog.test.mjs` (TST-681001) and `tests/dashboard-backlog-teams.test.mjs` (its order
   case). Run 41193892102 fails on exactly those three cases: `unit-pull-request (2)`, (3) and `component-pull-request
   (5)`. The other lines in those logs are counter-proof records of passing tests, not failures.
2. **CI.** Run 41193936714 (`pull_request`, attempt 1) on `cc09f0df0` succeeds: 41 jobs succeed, 17 are skipped.
3. **Only the item's scope changed.** `src/implementation-pages/backlog.mjs`, `paint`: `uncoveredPanel` moves under the
   head, and *What is this?* names the new order. The two changed tests name MOD-implementation-pages, and only their
   order, title and `expect` changed. That rests on the reading ITM-1325 now names (`dc2e1cb73`), the same one as for
   ITM-1332. The old order is the finding UC032-S2, which no module text gives. `AN IMPLEMENTATION JOB CHANGES ONLY ITS
   MODULES` allows tests that name the item's module.
4. **The new test** TST-1325001 names UC-032 and MOD-implementation-pages. Its counter-proofs are in the pull request.
   Planted by me in an export of the head: with the base's order restored in `paint`, TST-1325001, TST-681001 and the
   order case fail (one each). Restored, all pass.
5. **The Acceptance holds.** `uncovered` stands before the teams and the backlog. On the base it stood after them (the red
   run).
6. **MOD-test-document's reader** on the head: the new file has 1 declaration and 0 findings. The changed
   `implementation-pages-backlog` has 13 and 0, and `dashboard-backlog-teams` declares none. The control,
   `tests/release-itm-1254-issue-move.test.mjs`, has 4 and 0.
7. In the export, UC-032's system test gives 22 pass and 4 `todo`. TST-803004's `todo` is developer-sonnet-l's to take
   away. `test-document-one-line` passes.
