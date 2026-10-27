---
name: derive-use-cases
serves:
  - UC-007
participant: one
needs:
  - draft text
resources: none
preconditions:
  - rests-on-accepted
recipes:
  - instruction?
  - chosen-requirements
  - use-cases
  - chapters-for-requirements
checks:
  - document-schema
  - graph-checks
  - candidate-classes
person_decides:
steps:
gate_points:
review: none
writer: open-files
limit: 5
---
## Purpose

Drafts use cases for the chosen requirements, against every existing use case of the product, so that a goal already
covered becomes a change of its use case and not a second one.
