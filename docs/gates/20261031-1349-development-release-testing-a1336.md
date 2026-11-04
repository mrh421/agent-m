---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - dbbe8e2f9b4382d96f17d4003a4c3879cc5e3f2e
  - https://github.com/akmaier/agent-m/pull/1575
date: 2026-10-31 13:49 UTC
---
# Development → Release testing: #1575, ITM-1336 The progress page of a model without sprints shows what is blocked

**REGISTER**

## Reason

ITM-1336 by developer-sonnet-k, with developer-sonnet-l's commit its Acceptance names, may be merged into
`sprint/team1/134`.
1. **The tests-only commit is red for the item's reason.** `6f1496bbc` holds only
   `tests/implementation-pages-progress-blocked.test.mjs`. Run 41206576960 fails TST-1336001 to 1336003 only;
   TST-1336004 holds on the base.
2. **CI is green on the head:** run 41206798636 on `dbbe8e2f9`. The code commit `b81cfd7bb` is green on 41206710073.
3. **Scope:** `src/implementation-pages/progress.mjs` (MOD-implementation-pages); the new test file, whose header
   names MOD-implementation-pages; `tests/release-itm-800-progress-page.test.mjs`, where `dbbe8e2f9` takes away
   TST-800105's `todo` and puts a planted fault where the FINDING line stood, as the Acceptance names.
4. **Declarations:** MOD-test-document's reader gives 4 declarations and 0 findings on the new file, and 5 and 0 on the
   release file. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0. Counter-proofs A to E stand
   in the pull request's description; TST-800105's stands in its header.
5. **Acceptance:** the V-model and Kanban pages draw *Blocked* from the view's `blocked`, each entry with its reason
   (TST-1336001, 1336002); an empty one says "No item or plan entry is blocked." (TST-1336003). With sprints the line
   stays word for word (TST-1336004).

## Noted

- Reading accepted: the panel's folded explanation now quotes UC-035 step 4, so for a model with sprints it also names
  plan entries. No test asserts that text.
- TST-800105's planted-fault line names the code as `${blockedPanel(ctx)}`; the call is `${blockedPanel(ctx, sprints)}`.
  The fault it describes still fails the case.
