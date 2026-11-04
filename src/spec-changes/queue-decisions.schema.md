# The decisions of a SPEC change queue

The schema of a change queue's `entscheidungen.md`, in MOD-documents' schema language: the format that
MOD-spec-changes' file states under Data. Append-only: one row per decision, added by the apply workflow, never
changed. The table stands under the file's own title, with no heading of its own (`{ "underTitle": true }`), and has
no header row — MOD-documents' own illustration of a table without a header row is this very file.

What the language cannot say is written where it applies:

- The title line is `# Decisions — queue <package> <heading>` (MOD-spec-changes, Data), `<heading>` the section's
  heading without its number, followed by the line `Append-only.`.
- A row's third cell is `uebernommen`: a decision row is written only once an entry is accepted, so there is no other
  decision yet.
- A row's fourth cell, `Reference`, names the approval record that was accepted: `approval:<file name, under
  docs/approvals/>`. A row of an earlier, retired form — a bare commit SHA, its time with no `UTC` — names no record
  a caller resolves by this schema's columns alone.

```json
{
  "schema": "queue-decisions",
  "shape": "document",
  "rule": "AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL",
  "path": "docs/spec-freigaben/{any}/entscheidungen.md",
  "sections": [
    { "underTitle": true, "required": true, "table": { "header": false, "appendOnly": true, "columns": [
      { "name": "When", "value": { "type": "time", "required": true } },
      { "name": "Entry", "value": { "type": "number", "required": true } },
      { "name": "Decision", "value": { "type": "enum", "values": ["uebernommen"], "required": true } },
      { "name": "Reference", "value": { "type": "text", "required": true } }
    ] } }
  ]
}
```
