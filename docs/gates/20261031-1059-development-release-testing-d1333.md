---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - fa8ca66a74fc943cd6f1d30d2a19218977ed3cc5
  - https://github.com/akmaier/agent-m/pull/1553
date: 2026-10-31 10:59 UTC
---
# Development → Release testing: ITM-1333, a start refused as Moved names the collision at the moved head

**REGISTER**

## Reason

ITM-1333, pull request #1553 into `sprint/team1/131`, passes on `fa8ca66a7`, its head when this was decided. All three
commits carry `Agent-M-Participant: developer-sonnet-k`.

1. **The first commit holds only tests and is red for the item's reason.** `488294837` adds
   `tests/work-plans-start-moved-collision.test.mjs` alone. Run 41193528261 fails in `unit-pull-request (13)` on
   TST-1333001: the start rejects with `Moved`, not `SprintRefused`.
2. **CI.** Run 41194419130 (`pull_request`, attempt 1) on `fa8ca66a7` succeeds: 41 jobs succeed, 17 are skipped. The
   intermediate `f54a08a61` was red on `work-plans-one-definition` (a second module-file pattern). The Scrum Master gave
   it back before any gate, and `fa8ca66a7` takes the one `moduleFiles` of `strategies.mjs`.
3. **Only the item's scope changed.**
   - `src/work-plans/saves.mjs`: `commitOrRefuse` and `conflictReasons`.
   - `src/work-plans/strategies.mjs`: `moduleFiles` exported, unchanged otherwise.
   - The new test.
   - `tests/work-plans-start-refused.test.mjs`: fixture only, the fake host gains `listPullRequests`.
   - All of these are MOD-work-plans'.
4. **The import cycle** `saves.mjs` ↔ `strategies.mjs`. Each uses the other's bindings only inside functions, and no
   top-level await is added (sprint 125's agreement). On Node 22.23.4, `saves.mjs`, `strategies.mjs`, `sprints.mjs` and
   `index.mjs` each load first without error. The new test, `work-plans-start-refused`, `work-plans-saves`, UC-032's
   system test (22 pass, 4 `todo`) and `test-document-one-line` pass on Node 22.
5. **The new tests** TST-1333001 and 1333002 name UC-032, SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES
   OR USES and MOD-work-plans. Their counter-proofs are in the pull request. Planted by me: with the `SprintRefused`
   throw removed, TST-1333001 fails (1 pass, 1 fail). Restored, 2 pass.
6. **The Acceptance holds.**
   - At the moved head, a colliding hold refuses with `SprintRefused` naming the sprint, item and module, with no commit
     and no branch.
   - Without a collision, `Moved` stands (TST-1333002).
   - On the base, `Moved` (the red run).
7. **MOD-test-document's reader** on the head:
   - the new file: 2 declarations, 0 findings;
   - `work-plans-start-refused`: 2 and 0;
   - the control: 4 and 0.

## Noted

- The developer's reading is that `conflicts` takes the module files of the moved head, not `context.architecture`. That
  follows "`heldItems` of its sprint records, items and module files" at that head.
