---
name: check-affected-modules
serves:
  - UC-008
participant: one
needs:
  - draft text
resources: none
preconditions:
  - rests-on-accepted
recipes:
  - use-case-with-neighbours
  - whole-architecture
checks:
  - backlog-checks
person_decides:
steps:
  - leave-out-named-modules
gate_points:
review: none
writer: backlog-items
limit: 5
---
## Purpose

Checks which modules of the architecture the text of an accepted use case changes, and drafts one backlog item for each of
them, realising the use case and naming that module; an item for a module that an item not yet done names is left out.
