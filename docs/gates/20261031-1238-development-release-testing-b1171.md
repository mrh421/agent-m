---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 58cb465d1b182c491adb9865d7a0d71a3f9f09e6
  - https://github.com/akmaier/agent-m/pull/1567
date: 2026-10-31 12:38 UTC
---
# Development → Release testing: #1567, ITM-1171 An item's pull request targets its sprint's branch where the sprint has one

**REGISTER**

## Reason

1. **The tests-only commit is red for the item's reason.** `76edd2253` holds only tests. Run 41201268586 is red on it,
   and only these two fail:
   - TST-1171001: actual `develop`, expected `sprint/team1/7`;
   - the changed TST-733002: actual `test/ITM-012`.
2. **CI is green on the head:** run 41201607242 on `58cb465d1`.
3. **Scope.** The code changes stay in the item's four modules: MOD-work-plans, MOD-product-process, MOD-runtimes and
   MOD-implementation-pages.
   - `tests/runtimes-pull-request-target.test.mjs` is new, and its header names MOD-runtimes.
   - TST-733002 is the one changed expectation. The item names it, and `targetBranch` (MOD-work-plans.md:203) changes
     what it asserts.
   - Every import is in its module's Uses. `branchesOf` has the signature of MOD-product-process.md:154.
4. **New tests.** TST-1171001 and 1171002 name their requirements and their module. Their counter-proofs, and
   TST-733002's, are in the pull request. MOD-test-document's reader finds 2 and 6 declarations with 0 findings. Its
   control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
5. **The Acceptance holds.** A pull request goes into the sprint's branch where the sprint has one, and into the default
   branch where it has none, with a counter-proof. The `<item>` placeholder is gone.

## Noted

Readings accepted, as the pull request names them:
- The writer reads the sprint records, the plan order and the declaration from the job's snapshot.
- With several steps or items, the base comes from the first one named (MOD-runtimes.md:366 names one item or step).
- The implement page takes `workflow.branches`, since its Uses name `workflowOf`.
