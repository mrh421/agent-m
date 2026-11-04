---
name: review-architecture
serves:
  - UC-022
  - UC-023
participant: one
needs:
  - draft text
resources: none
preconditions:
recipes:
  - instruction?
  - whole-spec
  - accepted-use-cases
  - whole-architecture
  - draft
  - chapters-for-architecture
checks:
person_decides:
steps:
gate_points:
review: none
writer: return-draft
limit: 5
---
## Purpose

Reviews a complete architecture draft against the whole SPEC, level by level: every use case against the system, every
subsystem against the system, every module against its subsystem; each finding a warning.
