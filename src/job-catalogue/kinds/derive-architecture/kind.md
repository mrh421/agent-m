---
name: derive-architecture
serves:
  - UC-022
participant: one
needs:
  - draft text
resources: none
preconditions:
  - architecture-ready
recipes:
  - instruction?
  - whole-spec
  - accepted-use-cases
  - chapters-for-architecture
checks:
  - document-schema
  - graph-checks
  - candidate-classes
person_decides:
  - A CONFLICT IS DECIDED BY A PERSON
reviewer: review-architecture
reviewers: 1
steps:
  - due-diligence
gate_points:
review: person
writer: open-files
limit: 5
---
## Purpose

Drafts a product's first architecture as a whole, from the whole SPEC and every accepted use case, in the order from the
system to its modules: context, patterns, subsystems, the four views, the scenarios, the testing, the subsystems'
decisions, the module files, the further decisions.
