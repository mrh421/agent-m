---
name: check-resource
serves:
  - UC-040
participant: one
needs:
  - run code and tests
resources: none
preconditions:
recipes:
  - resource-check
checks:
person_decides:
steps:
gate_points:
review: none
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
tool_limit: 200
---
## Purpose

Makes the one harmless request a declared resource answers, on the runner that reaches it, and reports what answered.
