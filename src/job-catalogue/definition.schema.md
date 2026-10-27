# The definition of a kind of job

The schema of a kind's definition `kinds/<name>/kind.md`, in MOD-documents' schema language: the format MOD-job-catalogue's
file states under Data. Its front matter holds, in this order:

- `name` — the kind's name, its folder's name;
- `serves` — the use cases whose jobs it runs;
- `participant` — `one`, or `none` for a kind done without a participant;
- `needs` — the capabilities its participant must declare; none for a kind without a participant;
- `resources` — `none`, or `product` where a job of the kind may need the product's resources;
- `preconditions`, `recipes`, `checks`, `steps` — the names of strategies; a recipe whose name ends with `?` gives a part
  that may be left out with its reason;
- `person_decides` — the rules whose findings go to a person and never back to the participant;
- `reviewer` and `reviewers` — the kind its reviewing participants run, and how many;
- `gate_points` — `before-write`, `before-merge`, `question`;
- `review` — `person` or `none`; `writer` — the strategy that writes the result; `limit` — the default number of
  correction rounds;
- `tools` — the tools of `tools.md` its drafter may be offered; left out for a kind that offers none;
- `tool_limit` — the most tool calls of one exchange, a number; left out, no number of calls ends the exchange, whether or
  not the kind names tools.

Its body is one section, `## Purpose`, saying in a paragraph what the kind does.

```json
{
  "schema": "job-kind",
  "shape": "document",
  "rule": "ONE DEFINITION, THREE DRIVERS",
  "path": "src/job-catalogue/kinds/{slug}/kind.md",
  "frontMatter": {
    "name": { "type": "text", "required": true },
    "serves": { "type": "list", "item": { "type": "identifier", "of": ["UC"] }, "required": true, "nonEmpty": true },
    "participant": { "type": "enum", "values": ["one", "none"], "required": true },
    "needs": { "type": "list", "item": { "type": "enum", "values": ["draft text", "read the repository",
      "write to the repository", "run code and tests", "use tools", "reach the web"] }, "nonEmpty": true,
      "requiredWhen": { "field": "participant", "in": ["one"] }, "forbiddenWhen": { "field": "participant", "in": ["none"] } },
    "resources": { "type": "enum", "values": ["none", "product"], "required": true },
    "preconditions": { "type": "list", "item": { "type": "text" } },
    "recipes": { "type": "list", "item": { "type": "text" } },
    "checks": { "type": "list", "item": { "type": "text" } },
    "person_decides": { "type": "list", "item": { "type": "requirement" } },
    "reviewer": { "type": "text" },
    "reviewers": { "type": "number" },
    "steps": { "type": "list", "item": { "type": "text" } },
    "gate_points": { "type": "list", "item": { "type": "enum", "values": ["before-write", "before-merge", "question"] } },
    "review": { "type": "enum", "values": ["person", "none"], "required": true },
    "writer": { "type": "text", "required": true },
    "limit": { "type": "number", "required": true },
    "tools": { "type": "list", "item": { "type": "text" } },
    "tool_limit": { "type": "number" }
  },
  "sections": [
    { "heading": "## Purpose", "required": true }
  ],
  "otherSections": "forbidden"
}
```
