---
id: ITM-894
title: The impact list stands in a box that scrolls
level: module
realises:
  - UC-023
  - AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
modules:
  - MOD-site-frame
  - MOD-review-pages
builds_on:
  - ITM-876
  - ITM-886
tests:
  - unit
origin:
  - ITM-876's stop (sprint team1/87), from developer-sonnet-d's reading of the style rules
---
# ITM-894 The impact list stands in a box that scrolls

**REGISTER**

## Outcome

akmaier: the impact "also needs to go into a text box with slider". The impact list is `section.change-impact`
(`src/review-pages/sections.mjs:144`), and no style rule gives it a box that scrolls. Since `c358b76c` the routes' look
lives in `src/site-frame/look.css` and `docs/assets/style.css` is gone; the scrolling boxes there are the editor's preview
(`look.css:164`) and the accepted difference (`.accepted-diff .diff`, `:177`), and none is `.change-impact`'s. The rule for
the impact list's box goes into `look.css`.

## Acceptance

- `look.css` holds a rule that gives `.change-impact` a vertical scrolling box, and the impact list on a file's page and
  on Review all is drawn in it. A test checks the rule and its use, with a counter-proof.
- The box is reached by the keyboard, as the site's other scrolling boxes are: the module that draws each of them gives
  it `tabindex="0"` (MOD-markdown-render's preview, `src/markdown-render/editor.mjs:31`; MOD-review-pages' differences,
  `src/review-pages/flow.mjs:66`). So MOD-review-pages' `impactSection` (`src/review-pages/sections.mjs:144`) gives the
  section `tabindex="0"`, and the item names MOD-review-pages for that line and its test.
- The rule is written in the shape of the existing boxes' rules, a `max-height` in pixels and `overflow: auto`, as
  `.accepted-diff .diff` (`look.css:177`).
- The planning run (sprint team1/123), with the stand-in `.change-impact { max-height: 420px; overflow: auto; }` and the
  `tabindex`: the 114 test files that name `look.css`, a style sheet, `change-impact`, `sections.mjs`, `impactSection`
  or MOD-review-pages, with `site-accessibility` and `site-usability`. No case fails only with it; the five cases of
  `release-itm-1159-modules-labels` failed once there in a hook under the load of the parallel run, as on `main` in the
  same run, and pass alone three times of three.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
