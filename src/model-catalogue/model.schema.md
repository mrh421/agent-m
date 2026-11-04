# The schema of a process model

The schema of a process model definition — a shipped model under `src/model-catalogue/models/`, or an instance's model
`docs/process-models/<name>.md` — in MOD-documents' schema language: the format that MOD-model-catalogue's file states
under Data. Free text may stand between the title and the first section.

What the language cannot say is written where it applies, and `validate.mjs` decides it:

- `Produces` lists the kinds of artifact a phase produces, each one of `requirements`, `UC`, `ARC`, `MOD`, `TST`, `ITM`
  and `sprint record`, a kind optionally followed by an explanation in parentheses — the kind is what stands before it,
  and no check reads the explanation. A gate checks the kinds its `Artifacts` names in these words, and each of them is
  produced by the phase the gate follows or by one before it, along the transitions that are not `back`.
- `From`, `To`, `Phase` and `Checked by` name phases of the model, and every phase is reached from the first one along the
  transitions. `Between` names the two phases a gate stands between, as `<phase> → <phase>`.
- A phase's `Role` names the role that works in it, or several, separated by commas; each is a role of the model. A
  gate's `Decider` is a role of the model, or `check: <CI check name>`: a check whose result decides.
- A role's `How many` says whether one participant fills it, `one`, or several may, `several`.
- `## Flow control` is for pulled work, with the rows `WIP limit`, a number, `Time box`, its length or `none` for no time
  box, and `Sprints`, `yes` or `no`; a value left out is `—`, read the same as a `Time box` of `none`. Pulled work names
  exactly one of a time box and a work-in-progress limit.

The measure fits the kind of work — `plan entries per phase` planned work, `remaining items per time box` and `items per
state over time` pulled work —, as the variants of `measure` say. `remaining items per time box` fits only pulled work
that names a time box, which the language cannot say: `validate.mjs` decides it.

```json
{
  "schema": "model",
  "shape": "document",
  "rule": "A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED",
  "path": ["src/model-catalogue/models/{slug}.md", "docs/process-models/{slug}.md"],
  "frontMatter": {
    "name": { "type": "text", "required": true },
    "kind": { "type": "enum", "values": ["planned", "pulled"], "required": true },
    "adapted_from": { "type": "text" },
    "measure": { "type": "enum", "values": ["plan entries per phase", "remaining items per time box",
      "items per state over time"], "required": true, "rule": "PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE",
      "variants": [
        { "when": { "field": "kind", "in": ["planned"] }, "values": ["plan entries per phase"] },
        { "when": { "field": "kind", "in": ["pulled"] }, "values": ["remaining items per time box", "items per state over time"] }
      ] }
  },
  "sections": [
    { "heading": "## About", "required": false, "fields": {
      "manages": { "type": "text" },
      "accepts": { "type": "text" },
      "example": { "type": "text" },
      "chapter": { "type": "text" }
    } },
    { "heading": "## Phases", "required": true, "rule": "THE MODEL DETERMINES THE PHASES AND THE GATES", "table": { "columns": [
      { "name": "Name", "value": { "type": "text", "required": true } },
      { "name": "Role", "value": { "type": "list", "item": { "type": "text" }, "required": true, "nonEmpty": true,
        "rule": "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS" } },
      { "name": "Produces", "value": { "type": "list", "item": { "type": "text" } } }
    ] } },
    { "heading": "## Transitions", "required": true, "rule": "THE MODEL DETERMINES THE PHASES AND THE GATES", "table": { "columns": [
      { "name": "From", "value": { "type": "text", "required": true } },
      { "name": "To", "value": { "type": "text", "required": true } },
      { "name": "Kind", "value": { "type": "enum", "values": ["sequence", "alternative", "back"], "required": true } }
    ] } },
    { "heading": "## Verification pairs", "required": true, "rule": "THE MODEL DETERMINES THE PHASES AND THE GATES", "table": { "columns": [
      { "name": "Phase", "value": { "type": "text", "required": true } },
      { "name": "Checked by", "value": { "type": "text", "required": true } }
    ] } },
    { "heading": "## Gates", "required": true, "rule": "THE MODEL DETERMINES THE PHASES AND THE GATES", "table": { "columns": [
      { "name": "Between", "value": { "type": "text", "required": true } },
      { "name": "Artifacts", "value": { "type": "text", "required": true, "rule": "A GATE NAMES WHAT IT CHECKS" } },
      { "name": "Condition", "value": { "type": "text", "required": true, "rule": "A GATE NAMES WHAT IT CHECKS" } },
      { "name": "Decider", "value": { "type": "text", "required": true, "rule": "A GATE NAMES WHO DECIDES IT" } }
    ] } },
    { "heading": "## Roles", "required": true, "rule": "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS", "table": { "columns": [
      { "name": "Name", "value": { "type": "text", "required": true } },
      { "name": "Filled by", "value": { "type": "enum", "values": ["person", "agent", "either"], "required": true } },
      { "name": "How many", "value": { "type": "enum", "values": ["one", "several"], "required": true,
        "rule": "A ROLE NAMES HOW MANY FILL IT" } },
      { "name": "Capabilities", "value": { "type": "list", "item": { "type": "text" }, "required": true, "nonEmpty": true,
        "rule": "A ROLE NAMES THE CAPABILITIES IT NEEDS" } }
    ] } },
    { "heading": "## Flow control", "required": false, "table": { "columns": [
      { "name": "Kind", "value": { "type": "enum", "values": ["WIP limit", "Time box", "Sprints"], "required": true } },
      { "name": "Value", "value": { "type": "text", "variants": [
        { "when": { "field": "Kind", "in": ["WIP limit"] }, "type": "number" },
        { "when": { "field": "Kind", "in": ["Sprints"] }, "type": "enum", "values": ["yes", "no"] }
      ] } }
    ] } }
  ]
}
```
