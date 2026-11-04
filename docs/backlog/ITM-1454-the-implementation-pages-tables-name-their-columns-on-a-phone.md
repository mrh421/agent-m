---
id: ITM-1454
title: The implementation pages' tables name their columns on a phone
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1447
tests:
  - unit
origin:
  - ITM-1447's gate (docs/gates/20261102-2013-development-release-testing-1447.md, Noted)
---
# ITM-1454 The implementation pages' tables name their columns on a phone

**REGISTER**

## Outcome

MOD-site-frame says that on a phone, each cell of a table shows its column's title from the cell's `data-label`, "which the
route that draws the table sets to the column's title". The plan's table (`src/implementation-pages/plan.mjs:423`) and the
tables of `implement.mjs` set none. So on a phone their cells carry no column name.

## Acceptance

- Every cell of the plan's and the implement page's tables carries `data-label` with its column's title. Known positive: a
  route that already sets it passes. Counter-proof: a cell without it fails.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
