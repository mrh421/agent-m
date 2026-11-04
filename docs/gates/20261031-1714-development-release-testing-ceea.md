---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 901e301104d9f5f95bdf3e58a189b5a4e5559c23
  - https://github.com/akmaier/agent-m/pull/1586
date: 2026-10-31 17:14 UTC
---
# Development → Release testing: #1586, ITM-1267 The review page loads the modules of the route it shows, in one wave

**REGISTER**

## Reason

ITM-1267 by developer-opus-e may be merged into `sprint/team1/137`.
1. **The tests-only commit is red for the item's reason.** `c509d75c5` changes only test files, and run 41221331234
   fails 35 of them. Each fails on TST-1267001 to TST-1267004 or TST-1267101, or on a moved case at `route.module()`
   (`review-pages-draft-world.mjs:23`, `settings-pages-subject`). The only other ✖ lines are the `todo` FINDINGs
   TST-600603 and TST-803015. `bfc511b77` (41221514690) fails the same way.
2. **CI is green on the head:** run 41222652358, attempt 2. Attempt 1 failed only
   `review-pages-release-limitations` with "waited for the tag", at `until` after the click (`:237`), past the
   route's import. That is ITM-1287's flip, which is on the known-flip list. Locally the test passes on the head 10 of 10
   times and on the base `bf985badb` 10 of 10.
3. **Scope:** `src/` of the seven modules (c490ae315), and `docs/index.html` as the generator's output alone
   (331eebfb1). That run, 41222166402, was red only on the frame's route preload link in `test_no_backend` and
   `test_release_sprint_02_d`; TST-418121 is a `todo` FINDING. The moved tests `review-pages-draft-world.mjs`,
   `review-pages-draft-architecture`, `review-pages-handed-snapshot` and `settings-pages-subject` each read the
   member from `await route.module()`, as the Acceptance names. The new cases are in `site-frame-preloads`, and the new
   file is `site-frame-route-modules`, both with the header MOD-site-frame. `tests/test_no_backend.py` changed in
   `bfc511b77` and `901e30110`, both by developer-sonnet-l (`Agent-M-Participant`). The site-frame loading-element
   count goes from 3 to 4 and its counter-proof from 4 to 5. Each of the six views' `import()` entries carries evidence
   and a counter-proof, and none is weakened.
4. **Declarations:** MOD-test-document's reader gives 7 declarations and 0 findings on `site-frame-preloads`, and 1 and 0
   on `site-frame-route-modules`. Its control, `release-itm-1254-issue-move`, gives 4 and 0. The counter-proofs are
   recorded in the pull request.
5. **Acceptance:** each head is written once, in the view's `heads` (for example `src/settings-pages/index.mjs:19`),
   and the route files spread it (`...heads.bridge`). `docs/index.html` goes from 280 to 213 modules, and
   `index.html` is unchanged.

## Noted

- The Acceptance named one commit for `test_no_backend.py`, and it took two. The second fits the evidence to the form
  of `routing.mjs` after the red run on the generator commit.
- The six copies of `headed` (for akmaier's draft), Node ≥ 22.15 for `preloads.mjs`, the measured sizes, and a
  head's `subject` giving `null` before its route is imported (the frame imports first) are readings named in the pull
  request.
