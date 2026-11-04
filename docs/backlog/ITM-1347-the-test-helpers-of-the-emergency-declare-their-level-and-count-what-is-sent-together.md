---
id: ITM-1347
title: The test helpers of the emergency declare their level and count only what is sent together
level: module
realises:
  - EVERY TEST HAS ONE LEVEL
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-site-frame
  - MOD-repository-hosts
builds_on: []
tests:
  - unit
origin:
  - a review of akmaier's emergency commits of 2026-11-01, sent by the Scrum Master of team 1
---
# ITM-1347 The test helpers of the emergency declare their level and count only what is sent together

**REGISTER**

## Outcome

- **Seven helpers have no `Level:` line.** `tests/github-trees-fake.mjs` (`Module: MOD-repository-hosts`) and the six
  `tests/site-frame-start.d/*/routes.mjs` (`Module: MOD-site-frame`) name their module and no level. MOD-test-document's
  `testHeader` reports a header without a `Level:` line as an error under `EVERY TEST HAS ONE LEVEL`
  (MOD-test-document.md:104-109). Their siblings, such as `tests/site-frame-start.d/view-a/index.mjs`, say `Level: unit`.
- **The harness counts consecutive tree requests as one.** `tests/app-harness.mjs` (`Module: MOD-site-frame`), in
  `folderPart` and its caller (:61-80), counts tree requests of one commit as one `folders` read while no other request
  comes between them. MOD-repository-hosts counts as one the requests "sent together" (MOD-repository-hosts.md:200-203).
  A second round of tree requests, sent after the first has ended, is counted into the first, so
  `tests/load-per-view.test.mjs` cannot see it.

After the change, the seven helpers declare `Level: unit`, and the harness counts as one `folders` read only the tree
requests that are in flight together.

## Acceptance

- `testHeader` reports no finding for the seven helpers.
- A case of its own, headed `Module: MOD-site-frame`: two rounds of tree requests of one commit, the second sent after the
  first has answered, count as two `folders` reads; requests sent together count as one. Counter-proof: the harness as it
  stands counts one.
- An existing expectation that moves with the harness is named by the probe, and the item names the module of each test it
  changes; one that shows a page reading the tree twice is a finding, named in the pull request.
- The item adds no behaviour of the product; no failing first commit is required.
- Only the seven helpers, `tests/app-harness.mjs` and the tests the probe names change.
