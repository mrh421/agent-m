---
name: refactor
serves:
  - UC-024
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
tool_limit: 200
---
## Purpose

Restructures the code of a step without changing what it does, on a branch of its own, with the tests that guard it
passing before and after, and opens a pull request for it.
