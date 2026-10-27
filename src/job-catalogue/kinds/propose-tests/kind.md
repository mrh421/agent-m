---
name: propose-tests
serves:
  - UC-026
  - UC-043
participant: one
needs:
  - read the repository
  - write to the repository
  - run code and tests
resources: none
preconditions:
  - rests-on-accepted
recipes:
  - instruction?
  - test-selection
  - chapters-for-tests
checks:
  - test-proposals
  - candidate-classes
person_decides:
steps:
gate_points:
review: person
writer: return-draft
limit: 5
tools:
  - read
  - write
  - edit
  - bash
  - grep
  - glob
  - webfetch
---
## Purpose

Proposes test cases for the selected requirements, use cases and modules at the chosen levels, against every existing
test that guards them, for the person to review before they are written.
