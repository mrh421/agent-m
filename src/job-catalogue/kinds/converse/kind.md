---
name: converse
serves:
  - UC-049
participant: one
needs:
  - draft text
resources: none
preconditions:
recipes:
  - page
  - conversation
  - instruction
  - chapters-for-page?
checks:
  - document-schema
  - graph-checks
person_decides:
steps:
gate_points:
review: person
writer: proposed-edits
limit: 5
tools:
  - list-files
  - read-file
  - search-files
  - propose-edit
  - hand-over
tool_limit: 30
---
## Purpose

Answers a person's message about the page they are looking at, in the conversation so far: the answer, the edits the
participant proposes to documents below `docs/`, which a person may save, and the hand-over of work another kind owns or
the tab cannot do, which goes on without a further click (UC-049 4a). Where nobody attends the job, its edits are written
as a pull request (UC-049 4f).
