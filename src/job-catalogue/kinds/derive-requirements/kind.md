---
name: derive-requirements
serves:
  - UC-005
participant: one
needs:
  - draft text
resources: none
preconditions:
recipes:
  - instruction?
  - source-excerpt
  - spec-with-queues
  - chapters-for-requirements
checks:
  - requirement-form
  - candidate-classes
person_decides:
  - A CONFLICT IS DECIDED BY A PERSON
steps:
gate_points:
review: person
writer: queue-entries
limit: 5
---
## Purpose

Derives requirement candidates from the excerpt of a linked source version, against every existing requirement of the
product — its SPEC and its open change queues —, each classed as new, a change, a duplicate or a conflict, for the
person to review before they are written as a queue.
