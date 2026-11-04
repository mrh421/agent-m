---
id: ITM-1336
title: The progress page of a model without sprints shows what is blocked
level: module
realises:
  - UC-035
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-800
tests:
  - unit
origin:
  - finding 800-BLOCKED-PLANNED of ITM-800's release test TST-800105 (#1573), ruled at team1's sprint 133's review (docs/backlog/sprints/team1/133.md)
---
# ITM-1336 The progress page of a model without sprints shows what is blocked

**REGISTER**

## Outcome

UC-035 step 4: "A panel **Blocked** lists every item or plan entry that cannot move — in a model with sprints, every item a
running sprint holds that cannot move —, each with its reason" (`docs/use-cases/UC-035-*.md:76-77`).
- MOD-progress-measures' `blocked` gives "every item or plan entry that cannot move" (MOD-progress-measures.md:251), and
  the route `progress` draws from it.
- The route draws the panel only for a model with sprints: `${sprints ? blockedPanel(ctx) : ""}`
  (`src/implementation-pages/progress.mjs:269`). So the progress page of a V-model or a Kanban product has none.

## Acceptance

- A planned and a Kanban fixture product's progress page each hold the panel *Blocked*, listing the items or plan entries
  that `blocked` gives, each with its reason. A product with sprints keeps the panel as it is.
- The release case TST-800105 loses its `todo`, in a commit of developer-sonnet-l, who implements none of this item.
- No other existing expected result changes. The tests that render the route `progress` for a model without sprints are
  `tests/implementation-pages-progress-measures.test.mjs` (TST-800001 to 800004) and
  `tests/release-itm-800-progress-page.test.mjs` (TST-800101 to 800105); none asserts the absence of the panel, and
  TST-800104 asks of every panel a folded "What is this?", which the panel keeps. Every other test of the route renders a
  product with sprints.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
