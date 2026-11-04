# The counter-proof record

The schema of a counter-proof record `docs/tests/counter-proofs/TST-<nnn>.md` on the product's default branch, in
MOD-documents' schema language: the format that MOD-result-records' file (`docs/architecture/MOD-result-records.md`)
states under Data. It enters with the test's pull request, written by the participant that wrote the test
(`A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT`); its body holds no title line, the text after the front matter
beginning directly with `## Fault`.

- `outcome` is always `failed`: a test that stays green with its fault planted is not written (MOD-result-records.md,
  Data).
- `## Fault` and `## Result` name no `fields`/`table`: MOD-documents reads their raw text — the file and the change
  planted into the code the test guards, as a difference, for `## Fault`; the test's failing result with the fault
  and its passing result once the fault was removed, for `## Result` — and MOD-result-records reads them itself, as
  MOD-job-ledger's schema leaves `## Destinations` and `## Parameters` to its own module to parse
  (`src/job-ledger/job.schema.md`).

```json
{
  "schema": "counter-proof",
  "shape": "document",
  "rule": "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT",
  "path": "docs/tests/counter-proofs/TST-{nnn}.md",
  "identifier": { "field": "test", "kind": "TST" },
  "frontMatter": {
    "test": { "type": "identifier", "of": ["TST"], "required": true },
    "commit": { "type": "sha", "digits": 40, "required": true },
    "participant": { "type": "text", "required": true },
    "date": { "type": "time", "required": true },
    "outcome": { "type": "enum", "values": ["failed"], "required": true }
  },
  "sections": [
    { "heading": "## Fault", "required": true },
    { "heading": "## Result", "required": true }
  ],
  "otherSections": "forbidden"
}
```
