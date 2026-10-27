---
id: ITM-713
title: The old review writes go
level: module
realises:
  - CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT
modules:
  - MOD-review-pages
builds_on:
  - ITM-680
  - ITM-683
  - ITM-810
tests:
  - unit
origin:
  - ITM-680's draft stop (sprint team1/73), from developer-sonnet-d's draft
built_by:
  - 5736e4d9bfbbe94140dac3db0a448d927d60e540
---
# ITM-713 The old review writes go

**REGISTER**

## Outcome

MOD-review-pages' Parts remove `docs/assets/dashboard/writes.mjs` once the live app shows the review routes through the
module, which ITM-680 does. But `docs/assets/dashboard/settings-view.mjs:12` imports `savePseudonymisation`,
`saveCollaborators` and `clickAuthority` from it. The app imports `tokenBannerHtml` from `settings-view.mjs`
(`src/site-frame/dashboard-app.mjs:37`). So `writes.mjs` stays until ITM-683 removes `settings-view.mjs`.

Then this item, a job of MOD-review-pages, removes `writes.mjs` as the Parts say. It also moves or removes
`tests/review-core.d/dashboard-writes.test.mjs`:
- a test of only `writes.mjs` goes with it;
- the requirement it guarded is kept by a test of the module, named in the pull request.

## Acceptance

- `writes.mjs` is gone, and no file imports it.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- It is declared as refactoring: CI is green on every commit.
