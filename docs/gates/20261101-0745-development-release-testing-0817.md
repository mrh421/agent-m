---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8227c04f831229c29667fd051f58675c3801ffc0
  - https://github.com/akmaier/agent-m/pull/1612
date: 2026-11-01 07:45 UTC
---
# Development → Release testing: ITM-817, #1612

**REGISTER**

## Reason

ITM-817 (a backlog's findings follow the SPEC's module rule and their own rules) may go on. The pull request is #1612 into
`sprint/team1/141`, at `8227c04f8`, by developer-sonnet-j (`Agent-M-Participant` on every commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `2a1369e2d` changes only
   `tests/work-plans-backlog-findings.test.mjs` and `tests/work-plans-backlog-checks.test.mjs`. In run 41281743949
   (pull_request) the only failures are TST-688008, TST-817001, TST-817002 and TST-616003.
2. **CI is green on the head:** run 41282303560 (pull_request, `8227c04f8`), at the first attempt. The head merges the
   sprint branch, including `4fbaca4a7` with `main`'s edit of ITM-474, and `git merge-tree` with the branch's current head
   is clean.
   - The code commit `ac59875b3` was red in run 41281998059, but only on `tests/test_backlog_item_fields.py` and only for
     the old ITM-474 of the earlier base.
   - That is the one new finding the planning foresaw, and the item's reading removes it by having ITM-474 name
     MOD-work-plans alone. It is not a defect of the code.
3. **Only the item's module and its tests change.** The code is `src/work-plans/checks.mjs`, and both test files are
   headed `Module: MOD-work-plans`.
4. **The Acceptance holds:**
   - An item naming one described and one undescribed module gets an error naming the undescribed one (TST-817001).
   - A circle of three, and of four, is an error on each item of the circle (TST-688008, TST-817002). A chain or a
     diamond gives none.
   - The red run is the counter-proof.
   - An item naming no described module keeps its one finding (TST-688004 is unchanged). The finding of a pair that builds
     on each other keeps its text and rule.

## The changed expectations, ruled

All three are in the tests-only commit, and each pinned the reading this item replaces (the item's *The reading of the
accepted text*):
- **TST-688008:** a circle of three changes from "no finding" to an error on each item.
- **TST-688005:** the counter-proof "MOD-store and MOD-ghost: no finding" is removed. TST-817001 asserts the opposite now,
  and MOD-store alone remains the counter-proof.
- **TST-616003:** MOD-store and MOD-ghost is now an error, and MOD-store alone is the counter-proof.

Allowed. The item names MOD-work-plans' tests as the ones it changes.

## Readings, ruled

- **An item with no described module keeps its single existing finding.** It does not get one finding per module. Taken.
- **A circle of any length uses the existing text of a pair:** "the item builds on <next>, which builds on it in turn".
  Taken.
