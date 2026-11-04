---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c1ffa1659f35a5a456e593f9ced1c54e9763e948
  - https://github.com/akmaier/agent-m/pull/1581
date: 2026-10-31 15:29 UTC
---
# Development → Release testing: #1581, ITM-1138 The pages of roles, process, releases and settings read the repository they show once per load

**REGISTER**

## Reason

ITM-1138 by developer-opus-e may be merged into `sprint/team1/136`.
1. **The tests-only commit is red for the item's reason.** `95bc1c4e4` holds only `tests/load-per-view.test.mjs`.
   Run 41214513650: component (5) fails TST-1138001 and TST-1138002 and nothing else. Unit (12) fails TST-2026271023
   (`review-core.test.mjs`), a known flake. It is green on the base `489d428ee` and on the head.
2. **CI is green on the head:** run 41214598224 on `c1ffa1659`.
3. **Scope:**
   - `src/site-frame/dashboard-app.mjs` (MOD-site-frame); `src/implementation-pages/roles.mjs` and `process.mjs`
     (MOD-implementation-pages); `src/test-pages/release.mjs` (MOD-test-pages).
   - `tests/load-per-view.test.mjs` (header MOD-site-frame): two new cases and one more name imported from
     `app-harness.mjs`. No existing expectation changed.
   - `src/settings-pages/` is unchanged (reading C). No new import.
   - The branch is based on the sprint branch's head, `489d428ee`.
4. **Declarations:** MOD-test-document's reader finds 15 declarations and 0 findings on load-per-view, against 13 and 0
   on the base. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0. Each new test names
   A PAGE LOAD READS THE REPOSITORY IN BATCHES and MOD-site-frame. Three counter-proofs stand in the pull request's
   description.
5. **Acceptance:** `#roles`, `#process` and `#release` are drawn with `reviewContext()` (`renderLoaded`).
   - The instance gives `product: null`, and the routes take `product ?? instance`.
   - `#settings` waits for `firstLoad` and keeps, for the instance, a product context on the same host (reading C).
   - `#release` reads the default branch once and hands it to `pendingCandidate` and `paintForm`.
   - The shown repository's commit and tree are read once for the instance and for another product. The instance's
     commit read by the prompt bar on a product's page is not counted, as the Acceptance says.

## Noted

- Reading accepted from the description: the frame's wrapper matches `ref === T.ref`, so with `?ref=`, or a GitHub
  product whose default branch is not `main`, the route reads its branch anew.
