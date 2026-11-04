---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 589769d55b289077413306c846fd47152e13175e
  - https://github.com/akmaier/agent-m/pull/1582
date: 2026-10-31 15:48 UTC
---
# Development → Release testing: #1582 reworked, ITM-1261 A product stores its trace graph, overview and views for each commit of its default branch

**REGISTER**

## Reason

ITM-1261 by developer-opus-f may be merged into `sprint/team1/136`, after one rework on the condition of
`20261031-1540-development-release-testing-f466.md`.
1. **The rework's tests-only commit is red for its reason.** `f97758366` changes only
   `tests/trace-pages-graph-not-stored-step.test.mjs`. Run 41216115705 fails only TST-1261303 (`#arc`) and TST-1261304
   (`#spec`). Both are drawn in the context that `dashboard-app.mjs:753-770` hands those routes, and each has a
   product's page beside it as counter-proof. The first commit, `89575985b`, was red for the item's reason
   (41214663364).
2. **CI is green on the head:** run 41216168524 on `589769d55`.
3. **Scope:** the rework changes only `src/trace-pages/flow.mjs` (MOD-trace-pages) and that test file, which names
   MOD-trace-pages. The rest is as in the first decision: only the item's modules, the entry pages' generator output,
   and the expectations named in its Acceptance.
4. **Declarations:** MOD-test-document's reader gives 4 declarations and 0 findings on the test file. Its control,
   `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
5. **Acceptance:** `ofInstance` is also true where the product is read through the instance's own host. So the
   instance's `#trace`, `#spec` and `#arc` show `GraphNotStored`'s line alone. A product's page, whose instance host is
   connected apart, adds the *Install* step.

## Noted

- A context with `product: null` (MOD-site-frame's ViewContext for the instance) draws no trace view, on the base and
  here alike. The dashboard hands the trace route none.
