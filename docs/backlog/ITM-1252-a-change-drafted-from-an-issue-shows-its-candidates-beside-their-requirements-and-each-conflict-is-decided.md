---
id: ITM-1252
title: A change drafted from an issue shows its candidates beside their requirements, and each conflict is decided
level: module
realises:
  - UC-012
  - UC-033
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-584
tests:
  - unit
origin:
  - the review of ITM-584 (PR #1379) by reviewer-sonnet: the issue route lists the candidates and writes no conflict, and offers no way to decide one
---
# ITM-1252 A change drafted from an issue shows its candidates beside their requirements, and each conflict is decided

**REGISTER**

## Outcome

MOD-maintenance-pages.md:119-120: on the issue route, the change drafted from an issue is "run attended, its candidates
shown by class beside the requirements they refer to and every conflict decided by the person, then *Save*".

ITM-584 lists the candidates by class only (`src/maintenance-pages/issues.mjs`, `changeSection`), and a conflict is not
written, since `queueEntries` composes a conflict only as the person resolved it (`src/spec-changes/propose.mjs:18`, `:83`);
the page offers no decision. The review pages already show candidates by class with the conflicts and their decisions
(`src/review-pages/jobs.mjs:341-414`, `src/review-pages/candidates.mjs`); the issue route shows the same, not a copy of it.

## Acceptance

- Unit tests naming MOD-maintenance-pages, over the issue route with a drafted change: each candidate is shown beside the
  requirement it refers to; a conflict offers the person's decision, and *Save* writes it as decided; *Save* is offered
  only when every conflict is decided. Counter-proof: before the change a conflict cannot be decided and is not written.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/maintenance-pages/` and the tests that name MOD-maintenance-pages change.
