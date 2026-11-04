---
id: ITM-886
title: A SPEC entry waiting for its anchor has its colour
level: module
realises:
  - UC-006
modules:
  - MOD-site-frame
builds_on:
  - ITM-874
tests:
  - unit
origin:
  - developer-sonnet-d's finding on ITM-874's pull request #845 (sprint team1/87)
---
# ITM-886 A SPEC entry waiting for its anchor has its colour

**REGISTER**

## Outcome

A SPEC entry in the state "waiting for its anchor" has no colour rule on the review pages. Their page of the entry gives
its badge the status `waiting-for-its-anchor` (`src/review-pages/spec-entries.mjs:80`), and `badge` makes it the class
`b-waiting-for-its-anchor` (`src/review-pages/common.mjs:24-26`). The status rules moved into `look.css` with
`c358b76c`, which removed `docs/assets/style.css`; `src/site-frame/look.css:124-132` colours open, applied, approved,
changed, stale, accepted and superseded only. The trace page already colours the state, as `b-superseded`
(`src/trace-pages/flow.mjs:608`). What is left is the rule in `look.css` for the review pages' class.

## Acceptance

- The badge of an entry waiting for its anchor carries a class that `look.css` colours, distinct from accepted. A test
  checks it, with a counter-proof.
- The status rules the routes use come from `look.css` (built by `c358b76c`).
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- The Product Owner's planning run, on `main` at `ecc7de406`, with a stand-in rule for `b-waiting-for-its-anchor` in
  `look.css`: 24 test files that name `look.css`, a style sheet, the class or the SPEC entries, `site-usability` and
  `site-accessibility`. 506 cases pass and 3 todos stay, with and without it. No test of another module changes.
