---
name: run-tests
serves:
  - UC-028
  - UC-013
participant: one
needs:
  - run code and tests
resources: product
preconditions:
recipes:
  - commit-and-levels
  - resource-pins
checks:
person_decides:
steps:
gate_points:
review: none
writer: result-record
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

Runs the tests of the named levels on one commit with the commands the product's schedule names, and reports each test's
outcome.
