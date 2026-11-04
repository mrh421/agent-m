---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1eb39843196931cc14aae10b6ab47d09254ad457
  - https://github.com/akmaier/agent-m/pull/1596
date: 2026-10-31 19:27 UTC
---
# Development → Release testing: #1596, ITM-1337 The burn-down has a point for each day of the sprint

**REGISTER**

## Reason

developer-opus-e built ITM-1337, and developer-sonnet-l took away TST-806002's `todo`. I did none of it.
1. **First commit red, tests only.** `a624bba5e` changes only the two expectations the Acceptance (`daa67e55e`) names,
   each on a clock fixed at 2026-09-17 12:00 UTC. It is based on the sprint branch's `7f9ac0ffe`. Run 41233582099
   fails in component (5) on `tests/dashboard-backlog-teams.test.mjs` and in unit (6) on TST-681004
   (`tests/implementation-pages-backlog.test.mjs`), each `fail 1`, and in nothing else.
2. **CI is green** on `d30831ce9` (run 41233660411) and on the head `1eb398431` (run 41233758354), each at the first
   attempt.
3. **Scope** (`git diff 7f9ac0ffe 1eb398431`):
   - `src/implementation-pages/progress.mjs`: `remainingPerDay` is added and drawn by `teamPanel`.
     `remainingOverTime` loses its "now" branch, and the explanation of the sprint panel follows. It adds no read; the
     calls change from `remainingOverTime` to `remainingPerDay`, over the same `merges`.
   - The two tests the Acceptance names, both headed `Module: MOD-implementation-pages`.
   - TST-806002 (`Module: MOD-implementation-pages`) loses its `todo`. Its clock is fixed by `mock.timers`, which
     changes only how it prepares its fixture; its expectation is as ITM-806 wrote it.
4. **No new test.** MOD-test-document's `testDeclarations` reads TST-681004 (unit) and TST-806002 (system) with their
   guards and expected results, and `testFindings` reports none. The control: the same reader on a copy of TST-681004
   with its `expect` taken out reports "no expected result". The counter-proof, `at <= day` → `at < day` failing
   both moved tests, is recorded in the pull request.
5. **The Acceptance holds, as far as reading shows.** A running sprint's chart has one point per UTC day from its start
   to the page's today, labelled MM-DD, each the items left at that day's end. It is drawn from the view's `merges`.
   The backlog's final burn-down keeps `remainingOverTime` and its expectation (TST-681004's team2 half), which is
   unchanged.

## Noted

- `tests/dashboard-backlog-teams.test.mjs` holds no declaration that `testDeclarations` reads (0, at the base too),
  while the same reader reads TST-681004, the known positive. Its moved case has no identifier. This was there before
  the item; it is noted for the review.
