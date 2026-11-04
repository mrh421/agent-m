---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a93a180b965a7806660a5611a46f32074f99cfaa
  - https://github.com/akmaier/agent-m/pull/1759
date: 2026-11-02 20:24 UTC
---
# Development → Release testing: ITM-1445, #1759

**REGISTER**

## Reason

ITM-1445 (the frame's fields and buttons wear the site's one look) may go on. The pull request is #1759 into
`sprint/team1/143`, at `a93a180b9`. developer-opus-f wrote the tests-only commit `5772e19e2` and the code `a93a180b9`
(trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It adds `tests/site-frame-fields-look.test.mjs`.
   In run 41516839845, only TST-1445002, 1445003 and 1445004 fail. TST-1445001, the known positive, passes.
2. **CI is green on the head:** run 41517758239 (`a93a180b9`), at attempt 1. `git merge-tree` with the sprint branch's
   head `eecac6975` is clean.
3. **Only the item's module changes:** `src/site-frame/look.css`, `forms.mjs`, `decision.mjs` and `run-panel.mjs`
   (MOD-site-frame), plus the new test file. No other module's test and no release test changes.
   - Before, `look.css:51, :80` styled fields only under scoped selectors (`.product`, `.filter`, `.spec-narrow`,
     `.arrange`, `.editor`, `.reject`, `.prompt-bar` …). So a field such as the mailbox page's address
     (`mailbox.mjs:248`) was drawn bare, like 58 fields of the Settings pages, `schemaForm`'s inputs and the decision's
     textarea.
   - Now one rule gives every `select`, `textarea` and text `input` the look. The scoped rules keep only the size that
     differs, so the copies are folded into that one rule.
   - `.spec-narrow`'s radius moves from 4px to the shared 6px.
   - The frame's five buttons (`forms.mjs:153`, `decision.mjs:22, 24`, `run-panel.mjs:55, 65`) carry `btn`.
4. **The new tests name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-site-frame.** TST-1445002 also names
   `THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK`. The pull request records seven counter-proofs.
5. **The Acceptance holds:**
   - The site's style sheet gives every `select`, text `input` and `textarea` one look, wherever a page draws it, with no
     second style.
   - The frame's own buttons carry `btn`.
   - No existing expected result changes.

opus-f read the binding documents and chapters 9, 11, 12 and 13 in full.

## Ruled

opus-f's readings stand:
- a text input is an `input` that is not a checkbox, a radio or a file input;
- "in the look" means the border, radius and colour of the shared rule;
- the pages are the eleven Settings routes plus `schemaForm`, `confirmDecision` and `runPanel`;
- `editor.mjs:32`'s Save is MOD-markdown-render's, already done by ITM-1451;
- the buttons take `btn`, not `btn primary`.

## Noted

- The decision's reason `textarea` has no accessible name (`THE SITE SERVES A SCREEN READER`). It is a candidate for the
  review, not registered.
