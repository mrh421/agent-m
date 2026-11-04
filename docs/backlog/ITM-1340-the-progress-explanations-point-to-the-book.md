---
id: ITM-1340
title: Every explanation on the progress page points to book ch. 7 or ch. 15
level: module
realises:
  - UC-035
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-800
  - ITM-806
tests:
  - unit
origin:
  - finding UC035-S4 of ITM-806's system test TST-806011 (#1590), ruled at its gate in team1's sprint 138 (docs/backlog/sprints/team1/138.md)
---
# ITM-1340 Every explanation on the progress page points to book ch. 7 or ch. 15

**REGISTER**

## Outcome

UC-035: each chart and panel's folded *What is this?* "points to book ch. 7 or ch. 15". Those of *Gates*, *Blocked* and *Who works on what* point to neither (`src/implementation-pages/progress.mjs:209`, `:218`, `:240`).

## Acceptance

- The folded *What is this?* of every chart and panel of the page names book ch. 7 or ch. 15.
- "Panel" is read as each `section.panel` of the route: *Gates*, *Blocked*, *Who works on what* and *No team yet* gain
  their pointer. The page head (`section.head`) is no chart or panel and stays as it is. A pointer names the chapter
  only, without a section.
- A unit test of its own, TST-1340nnn, headed `Module: MOD-implementation-pages`, guards EVERY STEP EXPLAINS ITSELF and
  UC-035. For each of those four panels it asserts that the folded *What is this?* names book ch. 7 or ch. 15. It is the
  red first commit, and its counter-proof is recorded.
- TST-806011 loses its `todo` in a commit of developer-sonnet-l, written after the code is pushed.
- Before selection, the planning reads whether the accepted module files state this; if they do not, the item is a gap of
  the architecture, for akmaier.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
