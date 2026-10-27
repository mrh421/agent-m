---
name: write-tests
serves:
  - UC-026
  - UC-043
participant: one
needs:
  - read the repository
  - write to the repository
  - run code and tests
resources: product
preconditions:
  - rests-on-accepted
recipes:
  - instruction?
  - draft
  - test-selection
  - chapters-for-tests
  - resource-pins
checks:
  - test-declarations
  - test-proposals
person_decides:
steps:
gate_points:
  - before-merge
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

Writes the reviewed test cases as automated tests on a branch of its own, each shown to fail on a planted fault, and
opens a pull request for them.
