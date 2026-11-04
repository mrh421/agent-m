# The approval record

The schema of an approval record `docs/approvals/<ID>-<blob12>.md`, in MOD-documents' schema language: the format that
MOD-approvals' file states under Data. A record is evidence, written once and never changed (`A RECORD IS EVIDENCE, NOT A
PROPOSAL`): plain `key: value` lines, no front matter fences, no sections — the schema's shape is `lines`, as MOD-documents'
language names it.

- `kind` is one of `use-case`, `architecture-decision`, `module`, `spec`, `release-report`.
- `file` is the path of the accepted file; every kind names it except `spec`, which names what it accepts through `queue`,
  `entry`, `proposal`, `target`, `anchor` and `section` instead.
- `blob` is the 40-hex git blob SHA of the text the reviewer saw — of the proposal, for `spec` (`AN APPROVAL NAMES THE EXACT
  TEXT`).
- `queue`, `entry`, `proposal`, `target`, `anchor` and `section` stand only for `kind: spec`: the queue's folder, the
  entry's number, the proposal's path, the SPEC file it changes, the heading its section starts with, and the
  blob SHA of that section as it stood beside the proposal.
- `limitation` stands only for `kind: release-report`: zero or more lines `<TST-<nnn> or rate> — <reason>`, one per
  failing test or worse rate.

Examples (MOD-approvals, Data):

```text
kind: use-case
file: docs/use-cases/UC-008-review-and-accept-a-use-case.md
blob: 2699e35d0c413d3a814286dec77c49ad7598b4b1
```

```text
kind: spec
queue: docs/spec-freigaben/configuration-and-secrets
entry: 01
proposal: docs/spec-freigaben/configuration-and-secrets/01-configuration-and-secrets.md
blob: 47a9e8a383b0f1db6e98760b9a1f1325d8303844
target: SPEC.md
anchor: ## 7. Configuration and secrets
section: f8fbf7328c329ac0d2fc73e3901f1db1027a0f61
```

```json
{
  "schema": "approval-record",
  "shape": "lines",
  "rule": "AN APPROVAL NAMES THE EXACT TEXT",
  "path": "docs/approvals/{any}-{blob12}.md",
  "lines": {
    "kind": { "type": "enum", "required": true,
      "values": ["use-case", "architecture-decision", "module", "spec", "release-report"] },
    "file": { "type": "path", "requiredWhen": { "field": "kind", "notIn": ["spec"] } },
    "blob": { "type": "sha", "digits": 40, "required": true },
    "queue": { "type": "path", "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "entry": { "type": "text", "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "proposal": { "type": "path", "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "target": { "type": "path", "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "anchor": { "type": "text", "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "section": { "type": "sha", "digits": 40, "requiredWhen": { "field": "kind", "in": ["spec"] } },
    "limitation": { "type": "list", "item": { "type": "text" } }
  }
}
```
