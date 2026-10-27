---
name: implement
serves:
  - UC-024
  - UC-034
  - UC-043
participant: one
needs:
  - write to the repository
  - run code and tests
resources: product
preconditions:
  - rests-on-accepted
recipes:
  - instruction?
  - implementation-inputs
  - chapters-for-implementation
  - resource-pins
checks:
person_decides:
steps:
gate_points:
  - before-merge
  - question
review: none
writer: branch-and-pull-request
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

Implements one step of the plan, or one backlog item, test first, on a branch of its own, and opens a pull request for
it.
