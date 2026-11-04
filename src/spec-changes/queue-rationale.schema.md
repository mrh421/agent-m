# The rationale of an entry of a SPEC change queue

The schema of an entry's rationale, `NN-<slug>.begruendung.md` in a queue's folder, in MOD-documents' schema language: the format that MOD-spec-changes' file states under Data. A
rationale has a title line of its own, `# <section>: <what changes>`, which changes from entry to entry and has no heading of its own, so the schema names its one section
`{ "underTitle": true }`; the text under it is paragraphs that begin with a bold label — **The change.**, **Why.**, **Impact list.**, **Origin.** and, for an entry that a job drafted,
**Provenance.** — which the language cannot say and a caller reads from the section's text. For an entry drafted from an issue, the line
`**Issue:** #<number> of <product address>` names the issue, by its number, and the product whose issue it is, by its address; a caller reads it from the section's text. A rationale
without that line names no issue. The impact list is what `A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST` asks for.

```json
{
  "schema": "queue-rationale",
  "shape": "document",
  "rule": "A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST",
  "path": "docs/spec-freigaben/{any}/{any}.begruendung.md",
  "sections": [
    { "underTitle": true, "required": true }
  ]
}
```
