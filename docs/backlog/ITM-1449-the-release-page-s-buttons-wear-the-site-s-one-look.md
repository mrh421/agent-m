---
id: ITM-1449
title: The release page's buttons wear the site's one look
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
  - THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
modules:
  - MOD-test-pages
builds_on:
  - ITM-1444
tests:
  - unit
origin:
  - akmaier's report of the live site, 2026-11-02 (controls not in the site's style); the probe of ITM-1444 (#1752), by module
---
# ITM-1449 The release page's buttons wear the site's one look

**REGISTER**

## Outcome

`EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`: every page draws its buttons, menus, tables and lists with the same style
sheets. ITM-1444's probe found in MOD-test-pages: Buttons without `btn`: `release.mjs:79, 130, 185` (Accept and release, Check results, Start release candidate). The probe is a static scan, so this item first draws its pages and
confirms each hit; a hit whose element a scoped rule already styles is left.

## Acceptance

- Every button of the release page carries `btn`.
- Every fix uses the classes the site's style sheets already give; no second style is added.
- A test draws the pages and names each element out of the look; known positive: an element in the look passes;
  counter-proof: one of the elements above as it is fails.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
