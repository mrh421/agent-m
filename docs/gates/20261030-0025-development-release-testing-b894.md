---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ad3682cb02f8fe62588a2fd5325e32b3312f49ef
  - https://github.com/akmaier/agent-m/pull/1483
date: 2026-10-30 00:25 UTC
---
# Development → Release testing: ITM-894, the impact list stands in a box that scrolls

**REGISTER**

## Reason

ITM-894, pull request #1483 into `sprint/team1/123`, passes on `ad3682cb`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **First tests-only commit `66d9b4aa`:** run 40978227940 (`pull_request`, attempt 1) fails. Only
     `unit-pull-request (14)` fails.
     - TST-894001 fails: `.change-impact` has no box (`actual: false`).
     - TST-894004 and TST-894005 fail: the section's `tabindex` is `null`, expected `'0'`.
     - TST-894002 and TST-894003, the stylesheet reading's counter-proofs, pass.
   - **Second tests-only commit `f360656f`:** run 40978326625 fails with the same three cases and the same job.
   - **Head:** run 40978459140 (`pull_request`, attempt 1) succeeds, 58 jobs, 17 skipped, none failed.
2. **The second tests-only commit weakens nothing.** It changes only TST-894005:
   - Its first form asserted that Review all draws exactly one impact list, and checked `tabindex` on the first alone.
   - Review all is "every open or changed file of the kind in sequence" (MOD-review-pages.md:212, accepted at
     `b65cefcc9`). On `decision` it shows ARC-001 and MOD-reader, two changed files of the architecture, so two lists.
   - The new form asserts the exact count for each route, one on `module` and two on `decision`, and `tabindex` "0" on
     every list. It checks more than the first form, not less.
   - On the second commit it is red with `[ null ]` against `[ '0' ]`, the item's reason.
   - The `src/` diff changes nothing of which files Review all shows, so the count is the page's behaviour as accepted,
     not a value fitted to the change.
3. **Only the item's files change:**
   - `src/site-frame/look.css`: one rule, `.change-impact { max-height: 420px; overflow: auto; }`, after
     `.accepted-diff .diff`;
   - `src/review-pages/sections.mjs`: `impactSection` gives its section `tabindex="0"`;
   - the new `tests/review-pages-impact-box.test.mjs`.
   These are MOD-site-frame's and MOD-review-pages' files, the two modules the item names. No other test changes, and no
   expected result.
4. **It builds the item's Acceptance and nothing beyond it.**
   - The accepted MOD-review-pages text names a box that scrolls for the difference only (:212-213). The impact list's
     box comes from the item's Acceptance, akmaier's request through ITM-876 ("also needs to go into a text box with
     slider").
   - Its realised texts, UC-023 and AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST, are accepted.
   - No accepted text says otherwise: `look.css` is MOD-site-frame's part for the routes' look (MOD-site-frame.md:107),
     and `impactSection` stays the function MOD-review-pages draws the list with.
   - The brief's clause is "build only the accepted text and the item's Acceptance". A rule and an attribute that the
     Acceptance asks for are within it. No interface changes.
   - The `tabindex` follows THE SITE SERVES A SCREEN READER (SPEC.md:967-972, WCAG 2.2 AA): a box that scrolls is reached by
     the keyboard, as the site's other boxes are.
5. **The developer's two readings are right.**
   - The rule is read in the shape of `.accepted-diff .diff`, a top-level rule with a `max-height` in pixels and
     `overflow: auto`.
   - The attribute is the string "0" on each `section.change-impact`. The stored-impacts list (`src/review-pages/stored.mjs:21`)
     and the draft's (`conversation-draft.mjs:62`, through `changeImpact`) are drawn by the same `impactSection`, so they
     get it too.
6. **Counter-proofs.**
   - The pull request did not record the pages' counter-proofs it promised, so I made them on the head, each restored
     after:
     - Taking out `section.setAttribute("tabindex", "0")` fails TST-894004 and TST-894005.
     - Taking out the rule fails TST-894001.
     - Writing the rule with `max-height: 30em` fails TST-894001.
   - Restored, the file gives 5 pass, 0 fail.
   - TST-894002 and TST-894003 are the reading's own counter-proofs and pass.
7. **MOD-test-document's reader:**
   - `tests/review-pages-impact-box.test.mjs` gives 5 declarations, 0 findings, and a header without findings. The header
     is read with `Module: MOD-site-frame`; its declarations name MOD-site-frame (894001 to 003) and MOD-review-pages
     (894004, 894005).
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations, 0 findings.
   - Each value stands on one line. Their `given`, `input` and `expect`, as the reader reads them:
     - **TST-894001** —
       - given: "src/site-frame/look.css as the repository holds it";
       - input: "the rules of the selector .accepted-diff .diff (the known positive), then those of the selector
         .change-impact";
       - expect: ".accepted-diff .diff makes a box with a max-height in pixels and overflow auto; .change-impact makes one
         as well".
     - **TST-894002** —
       - given: "stylesheets with the rule of .change-impact planted wrong: without overflow, with overflow hidden, with a
         max-height in em, without a max-height, only inside @media, and under another selector";
       - input: "the reading of TST-894001 on each, and on a sheet with the rule right";
       - expect: "none of the wrong ones makes a box; the right one does".
     - **TST-894003** —
       - given: "the stylesheet of the repository with the rule of .change-impact taken out of it";
       - input: "the reading of TST-894001 on the stylesheet without the rule";
       - expect: ".change-impact makes no box, while .accepted-diff .diff still does".
     - **TST-894004** —
       - given: "the accepted MOD-reader and ARC-001 both changed since";
       - input: "the routes module for MOD-reader and decision for ARC-001, each drawn for one file";
       - expect: "each page draws exactly one section.change-impact (the known positive), and its tabindex is the string
         "0"".
     - **TST-894005** —
       - given: "the same repository; Review all of the architecture shows every changed file of the whole architecture,
         ARC-001 and MOD-reader";
       - input: "the routes module and decision, each drawn with the id all (Review all)";
       - expect: "Review all draws one section.change-impact for each changed file it shows (the known positive: one on
         module, two on decision), and each has the tabindex "0"".
8. **Locally on the head:** the new file and `tests/test-document-one-line.test.mjs` give 7 pass, 0 fail. My planning run
   of the same change, over 114 files, found no case that fails only with it.

## Noted

- The pull request's description still says "to be filled" for its runs. The runs are those above.
- The header's `Module:` line holds both modules separated by `;`, and the reader gives MOD-site-frame from it.
  Both declarations' modules are the item's.
