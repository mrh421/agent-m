---
id: ITM-1445
title: The frame's fields and buttons wear the site's one look
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
  - THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
modules:
  - MOD-site-frame
builds_on:
  - ITM-1444
tests:
  - unit
origin:
  - akmaier's report of the live site, 2026-11-02 (controls not in the site's style); the probe of ITM-1444 (#1752), by module
---
# ITM-1445 The frame's fields and buttons wear the site's one look

**REGISTER**

## Outcome

`EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`: every page draws its buttons, menus, tables and lists with the same style
sheets. ITM-1444's probe found in MOD-site-frame: `src/site-frame/look.css:50` and `:80` style `select` and `input` only under `.product`, `.filter`, `.job-retry`, `.spec-narrow`, `.version-bar`, `.arrange`, `.reject`, `.editor` and `.prompt-bar`. So the fields of the Settings pages are drawn bare: about 17 `select` and 80 `input` (bridge, endpoints, mailbox, participants, library, resources, sources, settings, products, setup). These are the "menus" of akmaier's report. The frame's own buttons carry no `btn`: `forms.mjs:153` (`schemaForm`'s Save), `decision.mjs:22, 24` (Cancel, Accept), `run-panel.mjs:55, 65` (Run, Cancel). The probe is a static scan, so this item first draws its pages and
confirms each hit; a hit whose element a scoped rule already styles is left.

## Acceptance

- The site's style sheet gives every `select`, text `input` and `textarea` one look, wherever the page draws it. No second style is added; the scoped rules that become the same are folded into it.
- The frame's own buttons (`forms.mjs:153`, `decision.mjs:22, 24`, `run-panel.mjs:55, 65`) carry `btn`.
- Every fix uses the classes the site's style sheets already give; no second style is added.
- A test draws the pages and names each element out of the look; known positive: an element in the look passes;
  counter-proof: one of the elements above as it is fails.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
