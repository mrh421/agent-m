# The index of a SPEC change queue

The schema of a change queue's `index.md`, in MOD-documents' schema language: the format that MOD-spec-changes' file
states under Data. The entry table stands under the queue's own title, which changes from queue to queue and has no
heading of its own, so the schema names its section `{ "underTitle": true }`; free text — the decision taken, and an
impact analysis with a table of its own — may stand between the title and the entry table, which is found by its
header, not by position (ITM-226).

What the language cannot say is written where it applies:

- The title line is `# SPEC approvals — queue <package> · <heading>` (MOD-spec-changes, Data), `<heading>` the
  section's heading without its number; the schema names no `title` pattern, since a queue has no front matter to hold
  `<package>` or `<heading>` as a key — a caller reads the whole heading line.
- The line `**Zieldatei aller Einträge:**` names, in backticks, the file every entry of the queue targets; a caller
  reads it from the section's text.
- `Datei` is written in backticks, `Anker (Überschrift, wortgetreu)` as the heading line it names, verbatim; a cell
  `—` is a value left out (`bis (exklusiv)`, `Commits`).

```json
{
  "schema": "queue-index",
  "shape": "document",
  "rule": "A QUEUE IS ACCEPTED IN ITS ORDER",
  "path": "docs/spec-freigaben/{any}/index.md",
  "sections": [
    { "underTitle": true, "required": true, "table": { "columns": [
      { "name": "Nr", "value": { "type": "number", "required": true } },
      { "name": "Datei", "value": { "type": "text", "required": true } },
      { "name": "Anker (Überschrift, wortgetreu)", "value": { "type": "text", "required": true } },
      { "name": "bis (exklusiv)", "value": { "type": "text" } },
      { "name": "Commits", "value": { "type": "text" } }
    ] } }
  ]
}
```
