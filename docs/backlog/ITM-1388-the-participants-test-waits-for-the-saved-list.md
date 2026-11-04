---
id: ITM-1388
title: The participants test waits for the saved list
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-settings-pages
builds_on: []
tests:
  - unit
origin:
  - the second flip of `tests/settings-pages-participants.test.mjs` (job of `unit-pull-request (6)`, run 41319529673, #1676), counted at ITM-1384's gate in team1's sprint 142 (docs/gates/20261101-1518-development-release-testing-1384.md)
---
# ITM-1388 The participants test waits for the saved list

**REGISTER**

## Outcome

`tests/settings-pages-participants.test.mjs`, "each participant type is added through the schema form and saved in one
commit", failed at `:329` on run 41319529673 with `actual: 'No participants are registered yet.'` against
`/campus-model.*model endpoint/s`, and passed on the next commit. It failed once in sprint 141 too (ITM-1298's gate), so
it flips (`A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY`). The assertion reads the list before the page has drawn it from
the saved register.

## Acceptance

- First, the cause is named as a data-flow path, from *Save* to the list the case reads, before any change.
- The case waits for the page's state, not for a number of turns, as ITM-1287's wait does, and keeps its expected results.
- Only the test and its helpers change. It adds no behaviour, so it begins without a failing test.
