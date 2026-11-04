---
id: ITM-700
title: The review pages are started by the frame
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - THE PAGES ROOT IS THE REPOSITORY ROOT
modules:
  - MOD-site-frame
builds_on:
  - ITM-680
  - ITM-681
  - ITM-682
  - ITM-683
  - ITM-686
  - ITM-687
  - ITM-689
  - ITM-690
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
---
# ITM-700 The review pages are started by the frame

**REGISTER**

## Outcome

The final switch. `docs/index.html` loads `start.mjs` with the views of the modules, and the live app moved in by
ITM-574 goes, with `docs/assets/dashboard/built.json`, `src/site/`, `src/theme/lme.css` and `src/brand/`
(`docs/assets/style.css` is gone since `c358b76ca`). `stepHtml` (`src/site-frame/dashboard-app.mjs:115`) goes with the
app (queue `2026-10-17b`). Today `docs/index.html:365` still loads `src/site-frame/dashboard-app.mjs`. The live addresses
of the old app lead, through the frame's routing, to the routes that took them over.

It waits for akmaier's acceptance of the module-file draft committed with the plan, which names these files as taken over in the module's Parts.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**Found at ITM-574's gate (2026-10-17, po-opus).** `src/site-frame/dashboard-app.mjs:11` and `docs/index.html:2` still
read `Module: MOD-dashboard-app`, a module with no file. This item removes the line. No test selects files by it any more
(`tests/review-core.d/dashboard-app.test.mjs` is headed `Module: MOD-site-frame`).

**Noted at sprint team1/138's probe:** it cannot be built as the accepted texts say; the reasons are in
`docs/backlog/sprints/team1/138.md` (`## ITM-700 leaves the selection`). Waits for akmaier.
