---
id: ITM-1422
title: A case guards the generate page's trusted click
level: module
realises:
  - THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
modules:
  - MOD-test-pages
builds_on:
  - ITM-1420
tests:
  - unit
origin:
  - ITM-1420's planted fault 1 (#1719), which stripped the trusted-click check and failed no case of the generate page, ruled at its gate in team1's sprint 142 (docs/gates/20261102-0847-development-release-testing-1420.md)
---
# ITM-1422 A case guards the generate page's trusted click

**REGISTER**

## Outcome

MOD-test-pages' generate page acts only on a click the browser marks trusted, through the module's one `button` in
`look.mjs`. No case of the generate page guards it: with the check stripped, no case of that page failed.

## Acceptance

- A case of the generate page shows that a script's click on its writing control writes nothing, and that a person's click
  writes. Counter-proof: with the trusted-click check removed, the case fails.
- Only tests change. The item adds no behaviour, so it begins without a failing test.
