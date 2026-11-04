---
id: ITM-1342
title: Progress made before a change of model stays readable in that model
level: module
realises:
  - UC-035
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-800
  - ITM-806
tests:
  - unit
origin:
  - finding UC035-S6 of ITM-806's system test TST-806019 (#1590), ruled at its gate in team1's sprint 138 (docs/backlog/sprints/team1/138.md)
---
# ITM-1342 Progress made before a change of model stays readable in that model

**REGISTER**

## Outcome

UC-035 2c: when the product changed its model, the chart starts at the change (TST-806015 holds) and "earlier progress stays readable in the model it was made under". The view's `since` is drawn nowhere (`draw`, `src/implementation-pages/progress.mjs:300-320`): the page does not say that the model changed and offers no way to the earlier progress.

## Acceptance

- A product whose model changed shows that the model changed, and when, and leads to the progress made before the change, drawn in the earlier model's measure.
- TST-806019 loses its `todo`, in a commit of a participant who implements none of this item.
- Before selection, the planning reads whether the accepted module files state this; if they do not, the item is a gap of
  the architecture, for akmaier.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
