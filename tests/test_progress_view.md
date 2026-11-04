# Progress View Release Cases

The cases of `tests/test_progress_view.py`, the check SPEC.md names for PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE: a
V-model, a Scrum and a Kanban fixture each render their declared measure; a definition naming an unknown measure fails
validation.

A case of the kind `page` is the fixture product of `tests/implementation-pages-sprints.mjs` (the requirement RULE ONE,
the items ITM-001 to ITM-005, team1 running its sprint 03 with ITM-001 and ITM-002, team2 running none) with the process
model at `model`, a path from `tests/`; `running_since: "yesterday"` starts team1's sprint 03 on the day before the test
runs. What the page draws is read as: `heading`, the headings of the measure panel; `cells`, each grid cell as
[requirement, phase] in the page's order; `burnDowns`, the team each burn-down is named by; `cards`, the items of the
board's cards, sorted; `flowCharts`, the number of cumulative flow charts.

A case of the kind `validation` is the model at `model` with its front matter's `measure` set to `measure`, read with
MOD-model-catalogue's model schema; `errors` are the rules of the error findings `modelFindings` gives for it.

## The V-model renders plan entries per phase

### Case

```json
{
  "given": "The fixture product with the instance's V-model, whose measure is plan entries per phase.",
  "input": { "kind": "page", "model": "../src/model-catalogue/models/v-model.md" },
  "expected": {
    "heading": ["plan entries per phase"],
    "cells": [["RULE ONE", "Concept"], ["RULE ONE", "Requirements"], ["RULE ONE", "Design"], ["RULE ONE", "Implementation"], ["RULE ONE", "Testing"],
      ["RULE ONE", "Validation & Verification"], ["RULE ONE", "Operation & Maintenance"]],
    "burnDowns": [],
    "cards": [],
    "flowCharts": 0
  }
}
```

## Scrum renders remaining items per time box

### Case

```json
{
  "given": "The fixture product with the Scrum fixture, whose measure is remaining items per time box; team1's sprint 03 runs since yesterday, within its two-week time box.",
  "input": { "kind": "page", "model": "./fixtures/flow/scrum.md", "running_since": "yesterday" },
  "expected": {
    "heading": [],
    "cells": [],
    "burnDowns": ["team1"],
    "cards": [],
    "flowCharts": 0
  }
}
```

## Kanban renders items per state over time

### Case

```json
{
  "given": "The fixture product with the Kanban fixture, whose measure is items per state over time.",
  "input": { "kind": "page", "model": "./fixtures/flow/kanban.md" },
  "expected": {
    "heading": ["items per state over time"],
    "cells": [],
    "burnDowns": [],
    "cards": ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"],
    "flowCharts": 1
  }
}
```

## A definition naming an unknown measure fails validation

### Case

```json
{
  "given": "The instance's V-model with the measure lines of code per week, which no model kind names.",
  "input": { "kind": "validation", "model": "../src/model-catalogue/models/v-model.md", "measure": "lines of code per week" },
  "expected": { "errors": ["PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE"] }
}
```

## The same definition with its own measure passes validation

### Case

```json
{
  "given": "The instance's V-model with its measure plan entries per phase.",
  "input": { "kind": "validation", "model": "../src/model-catalogue/models/v-model.md", "measure": "plan entries per phase" },
  "expected": { "errors": [] }
}
```
