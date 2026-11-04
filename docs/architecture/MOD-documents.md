---
id: MOD-documents
title: Documents, records and registers from their schemas
folder: src/documents/
realises:
follows:
  - ARC-048
uses:
  - MOD-text-tools.parseFrontMatter
  - MOD-text-tools.formatFrontMatter
  - MOD-text-tools.finding
  - MOD-text-tools.historyMarks
  - MOD-text-tools.FrontMatter
  - MOD-text-tools.Finding
provides:
  - Schema
  - Document
  - Row
  - Candidate
  - Classified
  - loadSchema
  - readDocument
  - writeDocument
  - documentFindings
  - readRegister
  - appendSection
  - classifyCandidates
  - artifactSchemas
  - artifactSchemaOf
---
# MOD-documents Documents, records and registers from their schemas

## Responsibility

It belongs to the artifact model (ARC-048). It is the one interpreter of every document of the common shape — front
matter, a title, named sections, tables, and, for records, sections appended over time — and of every record of plain
`key: value` lines: given a format's schema, it reads, writes and checks any document of that format, and it decides,
once for every kind of artifact, whether a drafted candidate is new, a change, a duplicate or a conflict. Each format's
schema is a data file in the folder of the module that owns the format (`A DATA FORMAT IS DEFINED ONCE`); this module
owns the schema language, and the schemas of use cases, architecture decisions, module files and items. It runs
unchanged in a browser and in Node, and performs no input or output.

## Parts

- `index.mjs` — the interface.
- `schema-language.mjs` — reading and checking a schema.
- `read-write.mjs` — reading a document or record by its schema, and writing it back.
- `checks.mjs` — the findings a schema can decide.
- `candidates.mjs` — the classes of candidates.
- `schemas/use-case.json`, `schemas/decision.json`, `schemas/module.json`, `schemas/item.json` — the schemas this module
  owns, shown under Data.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/artifact_checks.py`, `tests/test_architecture_files.py`, `tests/release-sprint-02-a-artifacts.test.mjs`, `tests/release-sprint-02-c-artifacts.test.mjs`, `tests/architecture-format.test.mjs`, `tests/review-core.d/artifacts.test.mjs`, `tests/test_artifact_format.py`, `tests/test_self_sufficient.py`, `tests/test_release_sprint_02_d.py`, `tests/test_no_history.py`, `tests/test_derivation_classes.py`: their headers name this module; one of only the old artifacts is rewritten on this module.

## Data

It keeps nothing. It owns the schema language, and four schemas written in it.

**The schema language.** A schema is a JSON object:

| Key | Holds |
|---|---|
| `schema` | the format's name, for example `use-case` |
| `shape` | `document` — front matter, a title line, sections —, or `lines` — the whole file is `key: value` lines, as an approval record is |
| `rule` | the requirement the format applies, by its name exactly as the SPEC writes it, for example `ONE USE CASE, ONE FILE`; every schema names one, and a finding names it when no part of the schema closer to the finding names its own |
| `path` | the file's path pattern, or a list of them, with the placeholders `{id}`, `{nnn}` (three or more digits), `{slug}` (lowercase words joined by `-`), `{blob12}` (twelve hexadecimal digits) and `{any}` (one path segment); a pattern may be written `{ "pattern": "…", "rule": "…" }`, and a document at that path then names its rule in place of the schema's own |
| `identifier` | where a document's identifier stands — `{ "field": "id", "kind": "UC" }` — and that it must match the identifier in its path |
| `frontMatter` | for a document: its keys in their order, each with a value specification; a key not listed is an error |
| `lines` | for the `lines` shape: its keys in their order, each with a value specification |
| `title` | the pattern of the document's first heading, for example `# {id} {title}` |
| `sections` | the sections, in order: each `{ "heading": "## Context", "required": true }`, or `{ "underTitle": true, "required": true }` for the text under the document's title (*Sections and their tables*, below), optionally with `rule` — the requirement the section applies — and with `fields` (`key: value` lines inside the section, each with a value specification) or `table` — `{ "columns": [{ "name", "value", "optional" }], "header": true \| false, "appendOnly": true \| false }`, its columns in order, each with `"optional": true` where a header may leave it out, whether it has a header row (by default it has), and whether it only grows |
| `otherSections` | `allowed` or `forbidden`: whether a heading of the same level that the list does not name may stand in the document |
| `appended` | for a record: the sections that may be appended after it was written — each `{ "heading", "fields", "repeat": true \| false }`, optionally with `rule` as a section has it |
| `diagrams` | `required`, `allowed` or `none`: whether the body must hold a Mermaid block; an image is never allowed (`DIAGRAMS ARE MERMAID IN MARKDOWN`) |
| `noHistory` | `true` for a document that must hold no history (`A DOCUMENT HOLDS NO HISTORY`); records and measurements leave it out |
| `key` | the fields whose values, normalised, are the format's key for finding exact duplicates among candidates |

A **value specification** is `{ "type": …, "required": true | false, "nonEmpty": true | false, "rule": …, … }`, with these
types; a specification of type `list` may add `"unique": true`: no item stands in the list twice.

| Type | A value of it |
|---|---|
| `text` | one line of text |
| `enum` | one of `values` |
| `number` | a whole or decimal number |
| `date` | `YYYY-MM-DD` |
| `time` | a date and time, in ISO 8601 with its offset or as `YYYY-MM-DD HH:MM UTC` |
| `sha` | lowercase hexadecimal digits — `40` for git, `64` for SHA-256, `12` for a short form — as `digits` says |
| `path` | a path in a repository, relative to its root |
| `url` | an `https` address |
| `identifier` | an identifier of a kind `of` names, for example `["UC"]` or `["ARC"]` |
| `requirement` | a requirement's name, in capitals |
| `interface` | an interface of a module, `MOD-<slug>.<name>` |
| `name` | an interface's name, `[A-Za-z_][A-Za-z0-9_]*` |
| `either` | a value of one of the types in `of`, for example a requirement's name or a use case's identifier |
| `list` | a list of values of the type `item` gives; in front matter one per line, in a table cell separated by commas |

A value specification may add `describedIn`: each value must stand in the named section as a bullet that begins with
the value in backticks — the rule by which a module's provided interfaces are described. It may name in `rule` the
requirement that its key, field or column applies, for example `A PARTICIPANT HAS ONE OF FIVE TYPES` for a participant's
`Type`.

**Values that depend on other values.** A value specification may depend on other values of the same document, or of the
same row of a table:

- `requiredWhen: Condition` — the value is required when the condition holds, and may be left out otherwise;
- `forbiddenWhen: Condition` — the value must be left out when the condition holds;
- `variants: [{ "when": Condition, … }]` — the first variant whose condition holds takes the place of the specification's
  type and constraints, for example another type of pin for another kind of resource.

A condition names a front matter key, a key of a `lines` record, or a column of the same row, with the values for which
it holds — `{ "field": "Type", "in": ["person"] }` or `{ "field": "Type", "notIn": ["person"] }` —, or patterns of the
schema's own `path`, and holds for a document whose path matches one of them — `{ "path": ["docs/backlog/ITM-{nnn}-{slug}.md"] }`
—; conditions combine as `{ "all": [ … ] }` and `{ "any": [ … ] }`. A condition, a combination of conditions and a
variant may each name in `rule` the requirement they apply; a variant may change nothing but the rule. In a table, an
empty cell or `—` is a value left out.

```json
{ "name": "Model", "value": { "type": "text",
    "requiredWhen": { "field": "Type", "notIn": ["person"], "rule": "A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL" } } }
{ "name": "Pin", "value": { "type": "text", "rule": "A RESOURCE IS PINNED TO AN EXACT STATE",
    "requiredWhen": { "field": "Kind", "in": ["repository", "data", "model", "endpoint", "agent"] },
    "variants": [ { "when": { "field": "Kind", "in": ["repository"] }, "type": "sha", "digits": 40 } ] } }
```

**The requirement a finding names.** A finding of `documentFindings` names the requirement that `documentFindings` names
for it below, where it names one. Every other finding names the `rule` of the part of the schema closest to what it
concerns, among the parts that name one:

- a value that a condition requires or forbids: that condition — of combined conditions, the first part that holds and
  names a rule, before the combination —, then as every finding on a value;
- every finding on a value — missing, required or forbidden by a condition, not of its type or of the variant that holds,
  empty where `nonEmpty`, an item twice where `unique`, not described where `describedIn` asks, an identifier that is not
  the one its path gives —: the
  variant that holds for it, then its value specification;
- for a value of a section's fields or of its table, after the value's own parts, and for a section that is missing, out
  of order, or whose table's header or rows do not fit it: the section, or the appended section;
- last, the rule of the path pattern the document's path matches, where that pattern names one, and else the schema's
  own `rule`: for the path, a key the schema does not list, keys out of order, the title, a section the schema forbids,
  and every finding that no closer part names a rule for.

`loadSchema` refuses a `rule` that is not a requirement's name in capitals; whether that requirement stands in the SPEC is
not decided here.

**Sections and their tables.** A section runs from its heading line to the next heading of the same or a higher level: a
lower heading, with its table, stays inside it, and a line in a fenced block is no heading. A schema names a section by
its heading line exactly as written, of any level, so the heading it names is the same in every file of the format. The
level of a schema's sections is that of the headings it names, `##` when it names none, and the document's title is its
first heading when that is of level one.

A format whose table stands under its title, with no heading of its own, and whose title changes from file to file — a
product's `docs/sources.md`, a change queue's `index.md` and `entscheidungen.md` — names that section
`{ "underTitle": true }` in place of a heading: the text under the document's title, from the line after the title line up
to the first heading that begins a section.
Read, its heading is the title line as written. A schema names at most one section under the title, as its first section,
and then no section of level one; a document without a title has no such section.

```json
{ "underTitle": true, "required": true,
  "table": { "header": false, "appendOnly": true, "columns": [ { "name": "When", "value": { "type": "time", "required": true } }, … ] } }
```

A section's table is the first table in it whose header row names the table's columns, in their order, where a column marked
`"optional": true` may be named or left out; a header that names a column the schema does not name, names the columns in another
order, or leaves out a column that is not optional is not the table's header. A table without a header row is the section's first
table. So the entry table of a queue's `index.md` is found after the tables of
its impact analysis.

**A table without a header row.** A table whose specification says `"header": false` has neither a header line nor a
separator line: the cells of each row are read by position into the columns in their order. The decisions file of a
change queue is written so:

```text
| 2026-10-05 16:46 UTC | 1 | uebernommen | approval:spec-2026-10-05e_the-main-page-01-1c4960c065ed.md |
```

A table whose specification says `"appendOnly": true` only grows: rows are added at its end, every row that stands keeps
its bytes, and no row is changed or removed.

**The schemas it owns.** The decision schema and the module schema are those every file of this architecture is written
in:

```json
{ "schema": "decision", "shape": "document", "rule": "ONE ARCHITECTURE DECISION, ONE FILE",
  "path": "docs/architecture/ARC-{nnn}-{slug}.md",
  "identifier": { "field": "id", "kind": "ARC" },
  "frontMatter": {
    "id": { "type": "identifier", "of": ["ARC"], "required": true, "rule": "EVERY ARTIFACT HAS AN IDENTIFIER" },
    "title": { "type": "text", "required": true },
    "refines": { "type": "identifier", "of": ["ARC"], "required": false },
    "forced_by": { "type": "list", "item": { "type": "either", "of": ["requirement", { "type": "identifier", "of": ["UC"] }] }, "required": true, "nonEmpty": true, "rule": "EVERY ARTIFACT NAMES ITS ORIGIN" },
    "designs": { "type": "list", "item": { "type": "identifier", "of": ["MOD"] }, "required": false, "rule": "EVERY ARTIFACT NAMES ITS ORIGIN" } },
  "title": "# {id} {title}",
  "sections": [
    { "heading": "## Context", "required": true, "rule": "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES" },
    { "heading": "## Decision", "required": true, "rule": "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES" },
    { "heading": "## Alternatives", "required": true, "rule": "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES" },
    { "heading": "## Due diligence", "required": false, "rule": "A REUSE DECISION RECORDS ITS DUE DILIGENCE" },
    { "heading": "## Consequences", "required": true, "rule": "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES" } ],
  "otherSections": "forbidden", "diagrams": "allowed", "noHistory": true, "key": ["title"] }
```

```json
{ "schema": "module", "shape": "document", "rule": "ONE MODULE, ONE FILE",
  "path": "docs/architecture/MOD-{slug}.md",
  "identifier": { "field": "id", "kind": "MOD" },
  "frontMatter": {
    "id": { "type": "identifier", "of": ["MOD"], "required": true, "rule": "EVERY ARTIFACT HAS AN IDENTIFIER" },
    "title": { "type": "text", "required": true },
    "folder": { "type": "path", "required": true, "rule": "A MODULE IS A FOLDER" },
    "realises": { "type": "list", "item": { "type": "either", "of": ["requirement", { "type": "identifier", "of": ["UC"] }] }, "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    "follows": { "type": "list", "item": { "type": "identifier", "of": ["ARC"] }, "required": true, "nonEmpty": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    "uses": { "type": "list", "item": { "type": "interface" }, "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    "provides": { "type": "list", "item": { "type": "name" }, "required": true, "unique": true, "describedIn": "## Interfaces", "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" } },
  "title": "# {id} {title}",
  "sections": [
    { "heading": "## Responsibility", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    { "heading": "## Parts", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    { "heading": "## Data", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    { "heading": "## Interfaces", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    { "heading": "## Files", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" },
    { "heading": "## Uses", "required": true, "rule": "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES" } ],
  "otherSections": "forbidden", "diagrams": "allowed", "noHistory": true, "key": ["id"] }
```

The use-case schema: rule `ONE USE CASE, ONE FILE`; path `docs/use-cases/UC-{nnn}-{slug}.md`; front matter `id`
(identifier `UC`, under `EVERY ARTIFACT HAS AN IDENTIFIER`), `title`, `area` (text), `actors` (list of text, not empty,
under `A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION`), `realises` (list of requirement names, possibly
empty, since `UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN`, under `A USE CASE REALISES NAMED REQUIREMENTS`);
title `# {id} {title}`; the sections `## Actors`, `## Precondition`, `## Main flow`, `## Alternative flows` and
`## Postcondition`, each required and each under `A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION`, other
sections allowed; diagrams `required`; `noHistory`; key `title`.

The item schema, for a plan step and a backlog item alike: rule `THE BACKLOG LIVES IN THE PRODUCT REPOSITORY`; paths
`docs/plan/ITM-{nnn}-{slug}.md`, under `THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY`, and
`docs/backlog/ITM-{nnn}-{slug}.md`, under `THE BACKLOG LIVES IN THE PRODUCT REPOSITORY`; front matter `id` (identifier
`ITM`, under `EVERY ARTIFACT HAS AN IDENTIFIER`), `title`, `level` (enum `module`, `subsystem`, `system`), `realises`
(list of a requirement's name or a use case's identifier, not empty), `modules` (list of `MOD` identifiers, not empty),
`integrates` (identifier `ARC`, the subsystem's decision, for a step of level `subsystem`), `builds_on` (list of `ITM`
identifiers), `tests` (list of enum `unit`, `component`, `system`, `release`), `origin` (list of text: an issue's address,
a requirement's name, a use case's identifier), `built_by` (list of 40-digit `sha`s, optional, under `PROGRESS AND JOB
STATE ARE DERIVED, NOT STORED`: the commits that built an item no merged pull request names, from which MOD-work-plans
derives it `done`); title `# {id} {title}`; sections `## Outcome` and `## Acceptance`
required; `noHistory`; key `title`. A requirement the SPEC states for one kind of item only is named through a variant
whose condition is that kind's path: `realises` under `A BACKLOG ITEM NAMES WHAT IT REALISES` and `modules` under
`A BACKLOG ITEM NAMES THE MODULES IT CHANGES` for a file under `docs/backlog/`, `level` and `tests` under
`A PLAN STEP NAMES THE TESTS OF ITS LEVEL` for a file under `docs/plan/`; for the other kind they name its path's rule.

**A document** as this module reads it: `{ kind, path, id, title, fields, sections, appended, body }` — `fields` by key,
each value as text, list or number; `sections` in order, each `{ heading, line, text, fields?, rows? }` — a section under
the title with the title line as its heading —; `appended`, for a
record, the appended sections in order. **A row** of a table: `{ line, cells }`, its cells by column name.

## Interfaces

- `Schema` — a schema as `loadSchema` returns it, in the language defined under Data.
- `Document` — a document or record as `readDocument` returns it, as defined under Data.
- `Row` — `{ line: number, cells: Record<string, string | string[] | number> }`: one row of a table.
- `Candidate` — `{ ref: string, keys: string[], from: string[], proposed: { class: "new" | "change" | "duplicate" |
  "conflict", of: string | null } }`: one drafted candidate — its reference within the draft, the values of its kind's key
  (for a requirement its name and its rule), the passages it came from, and the class its participant proposed.
- `Classified` — `{ refs: string[], from: string[], class: "new" | "change" | "duplicate" | "conflict", of: string | null,
  decidedBy: "rule" | "participant" }`: one class for the candidates merged into it, with every passage they came from.
- `loadSchema(text: string, owner: string) -> Schema` — reads a schema data file of the module `owner`. Throws
  `SchemaError` naming the key and the owner when the schema breaks the language. A module loads its schemas once, when
  it is loaded; a broken schema stops that module, never a single document.
- `readDocument(schema: Schema, path: string, text: string) -> Document` — reads a document or a record of the schema's
  format. It never throws on the content: whatever does not fit is left for `documentFindings` to name, and the parts
  that fit are read. Throws `TypeError` only when `schema` is not a loaded schema.
- `writeDocument(schema: Schema, document: Document) -> string` — writes a document in its canonical form: front matter
  keys in the schema's order, lists one item per line, sections in the schema's order, each table with the rows of its
  section — a register's rows among them —, every other byte of the body as it was. A canonical text read and written
  again is byte for byte the same, so writing never makes a change of its own that a reviewer would have to accept.
  Throws `DocumentError` naming the field, or the row and column, when a value does not fit its specification, and
  `NotAppendable` naming the row when an append-only table would lose or change a row of the text it was read from.
- `documentFindings(schema: Schema, document: Document) -> Finding[]` — every finding the schema can decide: the path
  against its pattern; the identifier against the path; front matter keys missing — also where a `requiredWhen`
  condition holds —, unknown, out of order, or present where a `forbiddenWhen` condition holds; values that do not fit
  their type or the variant that holds, empty where `nonEmpty`, a list that names an item twice where `unique`; each row of a table, cell by cell, in the same way, and a
  row with more cells than the table has columns, named at its line with the cells beyond the last column, whether the
  table has a header row or none; a
  section whose schema names a table with a header row, that holds a table but none whose header row names the
  table's columns in their order, where an optional column may be named or left out, named at its first table's header with the columns that header adds, lacks or puts out of order — a left-out optional column is not a lack; the
  title; required sections missing, sections out of order, sections the schema forbids; values that `describedIn`
  requires and the section does not describe; a diagram missing where `required`, and any image
  (`DIAGRAMS ARE MERMAID IN MARKDOWN`); and, for a `noHistory` schema, each mark of history
  (`A DOCUMENT HOLDS NO HISTORY`). Each finding is an error and names its line and the requirement it applies: the one
  named here in brackets, else the `rule` of the part of the schema closest to it (Data, *The requirement a finding
  names*). What needs other artifacts — whether a named requirement exists, whether a used interface is provided — is
  not decided here but on the trace graph (MOD-trace-graph).
- `readRegister(schema: Schema, path: string, text: string) -> { document: Document, rows: Row[] }` — reads a register:
  the document, and the rows of the one table its schema names. A register is written with `writeDocument`, its rows in
  the document's section.
- `appendSection(schema: Schema, text: string, heading: string, fields: Record<string, string | string[] | number>) ->
  string` — the record's text byte for byte, followed by the new section: a record is only ever appended to, never
  rewritten (`A RECORD IS EVIDENCE, NOT A PROPOSAL`). Throws `NotAppendable` when the schema does not let that section be
  appended, or appended a second time, and `DocumentError` when a field does not fit.
- `classifyCandidates(candidates: Candidate[], existing: { id: string, keys: string[] }[]) -> Classified[]` — the classes
  of one run's candidates against the existing artifacts of their kind (`A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A
  CONFLICT`): first the candidates whose normalised key is the same are merged into one, naming every passage they came
  from (`CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES`); then a candidate whose normalised key equals that of an existing
  artifact other than the one its participant proposed it as a change of is a duplicate of it, whatever class its
  participant proposed, decided by rule (`EXACT DUPLICATES ARE FOUND WITHOUT A MODEL`), since a change stands under the
  name of what it changes (`A CHANGE IS PROPOSED UNDER THE EXISTING NAME`); a requirement whose normalised rule equals
  that of the requirement it is proposed as a change of is a duplicate of that requirement all the same; every other
  candidate keeps the class its participant proposed. Keys are normalised by case,
  white space, quotation marks and dashes. The rules are the same for every kind of artifact (`THE DERIVATION RULES HOLD
  FOR ARCHITECTURE`); only the key differs, and the caller gives it. The result is shown to a person, who may change any
  class (`THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED`).
- `artifactSchemas() -> { useCase: Schema, decision: Schema, module: Schema, item: Schema }` — the four schemas this
  module owns, loaded.
- `artifactSchemaOf(path: string) -> Schema | null` — the one of these four schemas whose path pattern the path matches,
  with the placeholders as the schema language defines them and as `documentFindings` matches a path, or `null`: so that
  a caller that holds only a path, such as a drafted file's, needs no copy of the patterns.

## Files

It reads its own schema files under `src/documents/schemas/` when it is loaded. It reads and writes no file of a
repository; its callers give it the texts.

## Uses

- `MOD-text-tools.parseFrontMatter` and `MOD-text-tools.formatFrontMatter` — to read and write the front matter of a
  document.
- `MOD-text-tools.finding` and the type `MOD-text-tools.Finding` — every finding it reports.
- `MOD-text-tools.historyMarks` — the marks of history in a document whose schema forbids them.
- `MOD-text-tools.FrontMatter` — the shape of what it reads before applying a schema.
