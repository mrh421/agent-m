---
id: ITM-1354
title: The form of a planned model has no flow control
level: module
realises:
  - UC-031
  - A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-779
tests:
  - unit
origin:
  - finding UC-031-2A-FLOW of ITM-779's release test TST-779112 (#1603), ruled by the Product Owner of team1's sprint 141
---
# ITM-1354 The form of a planned model has no flow control

**REGISTER**

## Outcome

UC-031 marks **Flow control** as "pulled only", and 2a says that once the author picks the kind of work, "Agent M adapts
the form to it". MOD-model-catalogue gives `## Flow control` "for `pulled` only" (MOD-model-catalogue.md:66). The route
`models/<name>` draws "a form from the model's schema" (MOD-implementation-pages.md:157-158). Today *+ New model* with the
kind *planned* still shows an empty Flow control section (`src/implementation-pages/process.mjs`, the editor of
`models/<name>`).

## Acceptance

- For a model of the kind *planned*, the editor's form shows no Flow control section. For a model of the kind *pulled*,
  it shows one, as now.
- TST-779112 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
