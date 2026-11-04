---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - ac503c22d35b73eec8661e0cbbf65ab0f74ca519
  - https://github.com/akmaier/agent-m/pull/1582
date: 2026-10-31 15:40 UTC
---
# Development → Release testing: #1582, ITM-1261 A product stores its trace graph, overview and views for each commit of its default branch

**REGISTER**

## Reason

ITM-1261 by developer-opus-f is rejected once. Check 5 does not hold: on the instance's page, the Acceptance asks for
"`GraphNotStored`'s line alone".
- `#spec` and `#arc` draw the trace route through `renderSpecification` and `renderComponents`
  (`src/site-frame/dashboard-app.mjs:753-770`). These hand it `{ instance: { host }, product: { host } }`, with no
  `repository` and no `address`.
- `ofInstance` (`src/trace-pages/flow.mjs:114`) is then false, and `notStoredStep` adds "This product's graph is not
  stored yet: press Install on its Settings page." after the instance's `GraphNotStored`.
- Verified at the head, on the route's gaps view with the harness of `tests/trace-pages-graph-not-stored-step.test.mjs`:
  - In that shape, one problem line and the step appear.
  - The known positive, TST-1261302's own context, gives the line and no step.
- TST-1261302 builds its instance's context as only `#trace` (`implementationContext`) gives it.

The other checks hold as far as read:
1. **Tests-only commit:** `89575985b` holds only tests and is red on 41214663364. Each failure is in a test file the
   Acceptance names or one of the three new ones.
2. **Head:** green on 41215478669.
3. **Scope:** only the item's modules and the entry pages' generator output (`ac503c22d`), as the Acceptance allows.
   The changed expectations are exactly the ones named.
4. **Declarations:** MOD-test-document's reader gives 2 / 0 on each new file, 14 / 0 and 12 / 0 on the changed runtimes
   files, as on the base. Its control, `release-itm-1254-issue-move`, gives 4 / 0.

The developer may rework once, on this condition.
