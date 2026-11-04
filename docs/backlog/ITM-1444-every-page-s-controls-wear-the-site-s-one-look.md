---
id: ITM-1444
title: Every page's controls wear the site's one look, the mailbox page first
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
  - THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
modules:
  - MOD-settings-pages
builds_on: []
tests:
  - unit
origin:
  - akmaier's report of the live site, 2026-11-02 — "some UI elements don't use the style of the website (e.g. configure mailbox). Please see that all pages use the coherent style for the UI elements for button, menu, structuring elements and the like."
---
# ITM-1444 Every page's controls wear the site's one look, the mailbox page first

**REGISTER**

## Outcome

`EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`: every page draws its header, menu, buttons, tables and lists with the
same style sheets. Some pages draw these elements without the site's look, the mailbox page under Settings among them.

The probe comes first. It lists every page and element that does not take the look the site's style sheets already give,
by module, with `file:line`.
- This item fixes what lies in MOD-settings-pages, the mailbox page first.
- Each other module's part becomes an item of its own, which the Product Owner registers from the probe's list.
- Every fix uses the classes and elements the existing style sheets style. No second style is added. Where the shared look
  has no rule for an element, the probe names it, and that part goes to an item of MOD-site-frame's.

## Acceptance

- Every button, menu and structuring element of the Settings pages, the mailbox page first, carries the class or element
  the site's style sheets give it, as the other settings pages do. Known positive: a settings page already in the look
  passes. Counter-proof: the mailbox page as it is fails.
- The probe's list stands in the pull request, by module, each element with its `file:line`.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
