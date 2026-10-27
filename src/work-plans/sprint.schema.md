# The schema of a team's sprint

The schema of `docs/backlog/sprints/<team>/<nn>.md`, in MOD-documents' schema language: the format MOD-work-plans' file
states under Data. A team's sprints stand in a folder of their own, named as the team's role assignment, and are numbered
within the team (`EVERY TEAM RUNS SPRINTS OF ITS OWN`).

- The front matter is written when the sprint starts: `sprint`, its number; `goal`; `start`; `end`, the date its time box
  gives, left empty without one; `closer`, the participant who closes it; `branch`, its own branch, left empty for none;
  `selection`, the items it holds.
- The sections after it are appended as the sprint goes on, never rewritten:
  - `## Selection` when the selection is changed by a new start decision: `at`, the day, and `selection`, the items it
    holds from then on;
  - `## Ended` when the Product Owner ends a sprint without a time box: `at`, the day;
  - `## Review`, the review of the increment;
  - `## Unfinished items`: `to the backlog`, the items that go back to the backlog, and `into the next sprint`, those that
    go into the team's next sprint; the reasons follow as text;
  - `## Retrospective`;
  - `## Increment given up` when the Product Owner gives up the increment of a closed sprint whose branch was not merged:
    `at`, the day; `by`, the Product Owner; `reason`, why.
- A sprint record may hold other sections of its own, such as notes taken while the sprint runs.

```json
{
  "schema": "sprint",
  "shape": "document",
  "rule": "EVERY TEAM RUNS SPRINTS OF ITS OWN",
  "path": "docs/backlog/sprints/{any}/{any}.md",
  "frontMatter": {
    "sprint": { "type": "number", "required": true },
    "goal": { "type": "text", "required": true },
    "start": { "type": "date", "required": true, "rule": "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT" },
    "end": { "type": "date", "required": false, "rule": "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT" },
    "closer": { "type": "text", "required": true, "rule": "CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT" },
    "branch": { "type": "text", "required": false, "rule": "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN" },
    "selection": { "type": "list", "required": true, "nonEmpty": true, "item": { "type": "identifier", "of": ["ITM"] },
      "rule": "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT" }
  },
  "otherSections": "allowed",
  "appended": [
    { "heading": "## Selection", "repeat": true, "fields": {
      "at": { "type": "date", "required": true },
      "selection": { "type": "list", "required": true, "nonEmpty": true, "item": { "type": "identifier", "of": ["ITM"] } }
    } },
    { "heading": "## Ended", "repeat": false, "fields": {
      "at": { "type": "date", "required": true }
    } },
    { "heading": "## Review", "repeat": false },
    { "heading": "## Unfinished items", "repeat": false, "fields": {
        "to the backlog": { "type": "list", "required": false, "item": { "type": "identifier", "of": ["ITM"] } },
        "into the next sprint": { "type": "list", "required": false, "item": { "type": "identifier", "of": ["ITM"] } }
      } },
    { "heading": "## Retrospective", "repeat": false },
    { "heading": "## Increment given up", "repeat": false, "fields": {
      "at": { "type": "date", "required": true },
      "by": { "type": "text", "required": true },
      "reason": { "type": "text", "required": true }
    } }
  ]
}
```
