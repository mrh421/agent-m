---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ebfe42239026995f9fe2441790e9641b58e36b22
  - https://github.com/akmaier/agent-m/pull/1542
date: 2026-10-31 05:27 UTC
---
# Development → Release testing: ITM-1329, a refused Start sprint leaves no branch

**REGISTER**

## Reason

ITM-1329, pull request #1542 into `sprint/team1/130`, passes on `ebfe4223`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41171884874 (`pull_request`, attempt 1) on `ebfe4223` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed.
2. **The first commit holds only tests and is red for the item's reason.**
   - `ab5a2f8a9` adds `tests/work-plans-start-refused.test.mjs` alone.
   - Run 41171270766 on it fails in one job, `unit-pull-request (10)`, on TST-1329001 ("no branch is created by a refused
     start") and TST-1329002 (the order of the writes).
3. **Only the item's module and its own test change**, by developer-sonnet-k (`Agent-M-Participant` on both commits).
   - `src/work-plans/saves.mjs`, +3 −2: `createBranch(branch, head)` moves after `commitFiles`, with the same head and
     guard, and the doc comment says so.
   - It imports nothing new and changes no type of `startSprint`.
4. **The Acceptance holds.**
   - TST-1329001: over a host whose default branch has moved, `startSprint` rejects with `Moved` and never calls
     `createBranch`. Its counter-proof is in the same case: on the current head the start resolves and creates
     `sprint/team1/01` at `HEAD`. Its known positive is the base: the red run above.
   - TST-1329002: a start that is written sends two writes, the commit first, then the branch from the same head.
   - TST-803015 stays `todo`.
5. **Counter-proof, planted by me** on the head, in my checkout, and restored after.
   - With `createBranch` moved back before `commitFiles`, both cases fail (0 pass, 2 fail).
   - Restored: 2 pass.
6. **MOD-test-document's reader,** in an export of `ebfe4223`:
   - The new file has 2 declarations and 0 findings, each `unit` and MOD-work-plans. Its header gives one module at
     level `unit`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 1,492 test files, 5,850 declarations, 5,850 identifiers and 0 repeats.
7. **The tests of the callers,** in the export: the new file, `work-plans-saves`, UC-032's system test and
   `release-uc-032-derived-state-and-sprints`, `implementation-pages-backlog`, `dashboard-backlog-teams` and
   `test-document-one-line` give 69 tests: 60 pass, 9 `todo` (ITM-803's findings), 0 fail.
8. **The reading of the pull request holds:** the commit first, from the same head, as the item's Readiness says.

## Noted

- The developer's report says that `docs/process-models/scrum-wip.md` was read only in part. That is for the Scrum Master
  under the first-line agreement; it does not touch this gate's condition.
