# The result record

The schema of a run's record `runs/<commit>/<run>.md` on the branch `test-results`, in MOD-documents' schema
language: the format that MOD-result-records' file (`docs/architecture/MOD-result-records.md`) states under Data.
`<run>` is `<yyyymmdd>-<hhmm>-<occasion>-<4 hex>`; the path names no placeholder for that exact shape, so both the
commit and the run stand for `{any}` — one path segment each. A record is evidence, written once by `appendResult`
and never rewritten; its body holds no title line, the text after the front matter beginning directly with
`## Outcomes`, as MOD-job-ledger's job record does with `## Destinations` (`docs/architecture/MOD-job-ledger.md`
Data; `src/job-ledger/job.schema.md`).

- `uncommitted` has no boolean type in this language (Data: *The schema language*, the value types); it is written
  only when the working tree had changes not in the commit, with the one value `true` — present or absent, as a
  flag — never written `false`.
- `Reason` is the one optional column of `## Outcomes`: a record of the four columns before it is valid, and read with
  no reason.
- `## Failures` stands only where a test failed: it is not required, so a record with nothing failing leaves it out.

```json
{
  "schema": "result-record",
  "shape": "document",
  "rule": "EVERY TEST RUN LEAVES A RESULT RECORD",
  "path": "runs/{any}/{any}.md",
  "frontMatter": {
    "commit": { "type": "sha", "digits": 40, "required": true },
    "levels": { "type": "list", "item": { "type": "enum", "values": ["unit", "component", "system", "release", "user"] },
      "required": true, "nonEmpty": true, "rule": "EVERY TEST HAS ONE LEVEL" },
    "occasion": { "type": "enum", "values": ["commit", "pull-request", "nightly", "release-candidate", "on-demand"], "required": true },
    "participant": { "type": "text", "required": true },
    "date": { "type": "time", "required": true },
    "run": { "type": "url", "required": false },
    "uncommitted": { "type": "enum", "values": ["true"], "required": false }
  },
  "sections": [
    { "heading": "## Outcomes", "required": true, "table": { "columns": [
      { "name": "Test", "value": { "type": "text", "required": true } },
      { "name": "Level", "value": { "type": "enum", "values": ["unit", "component", "system", "release", "user"], "required": true } },
      { "name": "Outcome", "value": { "type": "enum", "values": ["passed", "failed", "not run", "undeclared"], "required": true } },
      { "name": "Runs", "value": { "type": "text", "required": false } },
      { "name": "Reason", "value": { "type": "text", "required": false }, "optional": true }
    ] } },
    { "heading": "## Failures", "required": false, "table": { "columns": [
      { "name": "Test", "value": { "type": "text", "required": true } },
      { "name": "Expected", "value": { "type": "text", "required": false } },
      { "name": "Observed", "value": { "type": "text", "required": true } },
      { "name": "Log", "value": { "type": "text", "required": true } }
    ] } }
  ],
  "otherSections": "forbidden"
}
```
