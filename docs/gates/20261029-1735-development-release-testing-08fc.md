---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 57f5a33d202f10630bc70d617d744f0e5a999567
  - https://github.com/akmaier/agent-m/pull/1470
date: 2026-10-29 17:35 UTC
---
# Development → Release testing: ITM-886, a SPEC entry waiting for its anchor has its colour

**REGISTER**

## Reason

ITM-886, pull request #1470 into `sprint/team1/121`, passes on `57f5a33d`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40920192276 (`pull_request`, head `57f5a33d`, attempt 1) succeeds: 58 jobs, 17 skipped, none
   failed. It ran `site-accessibility` and `site-usability`, which the developer did not run.
2. **The first commit holds only the tests, and is red for the item's reason.** `e3e39e68` adds
   `tests/site-frame-look-waiting-badge.test.mjs` alone. Its run 40920118972 fails in `unit-pull-request (15)` only, on
   TST-886001, 003 and 004. TST-886002 tests the reader of rules on planted style sheets, and passes on both commits.
3. **Only the item's files change:** `src/site-frame/look.css`, one rule and its comment, and the new test of
   MOD-site-frame.
4. **The new cases name what they guard and the module they exercise.** Each guards UC-006, which the item realises, and
   THE SITE SERVES A SCREEN READER, and names MOD-site-frame at level `unit`.
   - MOD-test-document's reader over the file gives 4 declarations and 0 findings, and each declaration's values stand on
     one line. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
   - The test reads `look.css`, code, and no SPEC, use case or module file.
5. **It fails on a planted fault, checked by me on `57f5a33d`.** With the rule of `.b-waiting-for-its-anchor` taken out of
   `look.css`, TST-886001, 003 and 004 fail and 002 passes. With the rule back, 4 of 4 pass and the tree is clean.
6. **The class is the one the review pages draw.** `src/review-pages/spec-entries.mjs:97` and `:134` give an entry the
   status `view.state.replaceAll(" ", "-")`, so "waiting for its anchor" becomes `waiting-for-its-anchor`, and `badge`
   makes it the class `b-<status>`, renaming only `in-SPEC` (`src/review-pages/common.mjs:28-29`). The item's pointer to `:80` is out of date;
   the class is the same.
7. **The readings taken are right.**
   - The colours are hex literals, the form of `.b-accepted` and `.b-superseded`, so their contrast is computed from
     `look.css` alone. `#3b2a7a` on `#e6e0f7` is 9.10:1, against WCAG 2.2's 4.5:1.
   - "Distinct from accepted" is read as both colours differing from `.b-accepted`'s.
   - The class name is written in the test, not imported from MOD-review-pages, whose functions MOD-site-frame's Uses do
     not name (MOD-site-frame.md:8-36).

## Noted

- developer-sonnet-l writes ITM-886's release tests: the badge of an entry waiting for its anchor, on a review page,
  carries the class and colours distinct from accepted.
