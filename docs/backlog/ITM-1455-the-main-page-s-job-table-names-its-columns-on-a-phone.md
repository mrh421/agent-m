---
id: ITM-1455
title: The main page's job table names its columns on a phone
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
modules:
  - MOD-main-page
builds_on:
  - ITM-1450
tests:
  - unit
origin:
  - ITM-1450's gate (docs/gates/20261102-1904-development-release-testing-1450.md, Noted)
---
# ITM-1455 The main page's job table names its columns on a phone

**REGISTER**

## Outcome

MOD-site-frame says that on a phone, each cell of a table shows its column's title from the cell's `data-label`, which the
route that draws the table sets. `drawList` (`src/main-page/jobs.mjs:85-86`) sets none. So on a phone the job table's
cells carry no column name.

## Acceptance

- Every cell of the table `jobs` carries `data-label` with its column's title. Counter-proof: a cell without it fails.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
