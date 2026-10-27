---
name: fix-bug
serves:
  - UC-012
participant: one
needs:
  - write to the repository
  - run code and tests
resources: product
preconditions:
recipes:
  - instruction?
  - fix-inputs
  - chapters-for-tests
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

Fixes a confirmed bug on a branch of its own: first a regression test that fails on the reported behaviour, then the fix
of code or test until it passes, and a pull request linking the issue.
