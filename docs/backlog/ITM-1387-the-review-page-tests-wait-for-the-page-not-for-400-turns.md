---
id: ITM-1387
title: The review page tests wait for the page, not for 400 turns
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-review-pages
  - MOD-approvals
builds_on:
  - ITM-1287
tests:
  - unit
origin:
  - developer-opus-e's note in ITM-1287's pull request (#1673), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1501-development-release-testing-1287.md)
---
# ITM-1387 The review page tests wait for the page, not for 400 turns

**REGISTER**

## Outcome

ITM-1287 found why `review-pages-release-limitations` flipped: its `until` gave a condition 400 turns of `setImmediate`,
about 7 ms, while the page awaits a digest on Node's threadpool, which a busy runner returns later. Eleven other test files
hold the same `until` (`grep -l 'turn < 400' tests/*.mjs`): ten of MOD-review-pages, among them `review-pages-edit-architecture`,
whose first flip sprint 141 counted, and `tests/release-itm-1314-put-back-after-removal.test.mjs`. Each is a copy of one
wait.

## Acceptance

- The eleven files wait with one helper of MOD-review-pages' tests, the wait ITM-1287 wrote: it polls until the condition
  holds or the page has settled, and fails by name at a deadline. No copy of the 400-turn wait stays.
- No expected result changes, and no declaration. It adds no behaviour, so it begins without a failing test.
- `tests/release-itm-1314-put-back-after-removal.test.mjs`, a release file, is changed in a commit of its own by a
  participant who built none of ITM-1314.
