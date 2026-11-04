# Test generation context cases

The cases of `tests/test_test_generation_context.py`, the check SPEC.md names for `TEST GENERATION SEES THE EXISTING TESTS`. Each case is the selection a person made (`### Params`: the names of the requirements, use cases and modules), and what the input of the generating participant must and must not hold
(`### Expected`: `holds` and `lacks` are texts of the recipe test-selection's part). The section `the product` holds the files of the product whole (`### File` blocks); its SPEC holds the rules A ROUND RULE and A SQUARE RULE, its use case UC-001 realises
the first, its tests are TST-971 (unit, module MOD-widgets, guards A ROUND RULE), TST-972 (release, guards A ROUND RULE), TST-973 (system, guards UC-001) and TST-974 (unit, module
MOD-gadgets, guards A SQUARE RULE).

## the product

### File SPEC.md

```text
# Widget shop — Specification

## Shapes

**A ROUND RULE** *(Product Owner)*
Widgets are round.
*Check:* `tests/widgets.test.mjs`

**A SQUARE RULE** *(Product Owner)*
Gadgets are square.
*Check:* `tests/gadgets.test.mjs`

**AN UNGUARDED RULE** *(Product Owner)*
Widgets are never triangular.
*Check:* no automatic check; at review.
```

### File docs/use-cases/UC-001-look-at-a-widget.md

```text
---
id: UC-001
title: Look at a widget
area: shapes
actors:
  - Customer
realises:
  - A ROUND RULE
---
# UC-001 Look at a widget

**Goal.** A customer looks at a widget.
```

### File docs/architecture/MOD-gadgets.md

```text
---
id: MOD-gadgets
title: Module MOD-gadgets
folder: src/gadgets/
realises:
  - A SQUARE RULE
follows:
uses:
provides:
  - f
---
# MOD-gadgets Module
```

### File docs/architecture/MOD-widgets.md

```text
---
id: MOD-widgets
title: Module MOD-widgets
folder: src/widgets/
realises:
  - A ROUND RULE
follows:
uses:
provides:
  - f
---
# MOD-widgets Module
```

### File tests/widgets.test.mjs

```text
// TST-971 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => { widgetIsRound(); });

// TST-972 · level: release · module: system
// guards: A ROUND RULE
// given: a widget on the shelf
// input: a customer looks at it
// expect: it looks round
test("widget looks round", () => { widgetLooksRound(); });

// TST-973 · level: system · module: system
// guards: UC-001
// given: a widget in a box
// input: the customer opens the box
// expect: the widget is shown
test("widget in a box", () => { widgetInABox(); });
```

### File tests/gadgets.test.mjs

```text
// TST-974 · level: unit · module: MOD-gadgets
// guards: A SQUARE RULE
// given: a gadget
// input: its shape
// expect: square
test("gadget is square", () => { gadgetIsSquare(); });
```

## a requirement's tests are all part of the input

### Params

```json
{ "requirements": ["A ROUND RULE"] }
```

### Expected

```json
{ "holds": ["TST-971 · level: unit", "widgetIsRound()", "TST-972 · level: release", "widgetLooksRound()"], "lacks": ["TST-973", "TST-974", "gadgetIsSquare()"] }
```

## a use case's tests are all part of the input

### Params

```json
{ "useCases": ["UC-001"] }
```

### Expected

```json
{ "holds": ["TST-973 · level: system", "widgetInABox()", "UC-001"], "lacks": ["TST-971", "TST-972", "TST-974"] }
```

## a module's tests are all part of the input

### Params

```json
{ "modules": ["MOD-gadgets"] }
```

### Expected

```json
{ "holds": ["TST-974 · level: unit", "gadgetIsSquare()", "MOD-gadgets"], "lacks": ["TST-971", "TST-972", "TST-973"] }
```

## several names bring the tests of each

### Params

```json
{ "requirements": ["A SQUARE RULE"], "useCases": ["UC-001"] }
```

### Expected

```json
{ "holds": ["TST-974", "TST-973"], "lacks": ["TST-971", "TST-972"] }
```

## a name no test guards brings no test and the input says so

### Params

```json
{ "requirements": ["AN UNGUARDED RULE"] }
```

### Expected

```json
{ "holds": ["AN UNGUARDED RULE", "(none)"], "lacks": ["TST-971", "TST-972", "TST-973", "TST-974"] }
```
