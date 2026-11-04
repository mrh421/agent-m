---
id: ITM-800
title: The progress page of a product
level: module
realises:
  - UC-035
  - PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
  - UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-795
  - ITM-796
  - ITM-797
  - ITM-798
  - ITM-799
tests:
  - unit
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-800 The progress page of a product

**REGISTER**

## Outcome

UC-035 steps 1 to 6 and 1a, 2b to 2d. MOD-implementation-pages states the route `progress` and does not build it. This
item builds it as the module's file states it, from `productFacts` read once: the progress in the model's measure from
`progressIn` — the grid with the plan's steps, each team's burn-down, or the board's cumulative flow —, drawn with
`renderMermaid`; the gates from `gateOverview`; *Blocked* from `blocked`; *Who works on what* from
`whoWorksOnWhat`, linking each job; a cell, card or point leading to the trace page of what is behind it. Each chart and
panel carries a folded *What is this?*. Nothing is written.

ITM-1252, open, builds the route `progress` for a model with sprints; this item's V-model and Kanban measures stay
with it.

## Acceptance

- A V-model, a Scrum and a Kanban fixture product each show their declared measure; a product without a token that
  reaches it shows nothing and says so.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- **No existing expected result changes; searched at sprint team1/133's planning.** No test asserts the panel that
  says a model's measure "is not drawn here yet" (`src/implementation-pages/progress.mjs:239-245`): `drawn here yet` and
  `data-part="measure"` match nothing under `tests/`, while the same search finds `is not drawn` in
  `tests/review-pages-use-cases.test.mjs:227`. The sprint panels of TST-1252201 to 1252205 and
  `tests/dashboard-backlog-teams.test.mjs` stay.
- The reading taken: a model for which `progressIn` gives neither a grid, sprints nor a flow keeps the link to the
  backlog.
- It starts once ITM-1171 is merged into the sprint's branch, since both change MOD-implementation-pages.
