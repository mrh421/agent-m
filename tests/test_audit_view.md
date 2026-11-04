# Audit view cases

The cases of `tests/test_audit_view.py`, the check SPEC.md names for `THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE`. Each case is a product at the tag `v2026.4.0` whose release commit is `cccccccccccccccccccccccccccccccccccccccc`: the files of the tagged commit
(`### File`), the records of the branch `test-results` as rows `[test, level, outcome, runs]` of the release commit (`### Records`), the files of the default branch (`### Head File`), whether an approval record names the report's text
(`approval: names the report` or `approval: none`), and what MOD-release-evidence's `auditRows` must give: the rows `[requirement, [[test, outcome]...]]`, the number of requirements with passing evidence, without a test and with a test that did not
pass, whether the report is accepted, and the limitations it names.

## every requirement of the SPEC at the tag has a row, those with no test or no passing outcome included

approval: names the report

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A PASSING RULE** *(Vibe Coding)*
It passes.
*Check:* `tests/rules.test.mjs`

**A FAILING RULE** *(Vibe Coding)*
It fails.
*Check:* `tests/rules.test.mjs`

**A RULE NOT RUN** *(Vibe Coding)*
It was not run.
*Check:* `tests/rules.test.mjs`

**A RULE WITH NO TEST** *(Vibe Coding)*
Nothing guards it.
*Check:* no automatic check; at review
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A PASSING RULE
// given: a widget
// input: a call
// expect: a result
// TST-502 · level: unit · module: MOD-widget
// guards: A FAILING RULE
// given: a widget
// input: a call
// expect: a result
// TST-503 · level: unit · module: MOD-widget
// guards: A RULE NOT RUN
// given: a widget
// input: a call
// expect: a result
```

### Records

```json
[["TST-501", "unit", "passed", ""], ["TST-502", "unit", "failed", ""]]
```

### Expected

```json
{ "rows": [["A PASSING RULE", [["TST-501", "passed"]]], ["A FAILING RULE", [["TST-502", "failed"]]], ["A RULE NOT RUN", [["TST-503", "not run"]]], ["A RULE WITH NO TEST", []]],
  "passing": 1, "noTest": 1, "notPassed": 2, "accepted": true, "limitations": [] }
```

## a requirement added to the SPEC after the tag has no row

approval: names the report

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A TAGGED RULE** *(Vibe Coding)*
It was valid at the tag.
*Check:* `tests/rules.test.mjs`
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A TAGGED RULE
// given: a widget
// input: a call
// expect: a result
```

### Head File SPEC.md

```text
# Fixture — Specification

## Rules

**A TAGGED RULE** *(Vibe Coding)*
It was valid at the tag.
*Check:* `tests/rules.test.mjs`

**A LATER RULE** *(Vibe Coding)*
It was added after the tag.
*Check:* no automatic check; at review
```

### Records

```json
[["TST-501", "unit", "passed", ""]]
```

### Expected

```json
{ "rows": [["A TAGGED RULE", [["TST-501", "passed"]]]], "passing": 1, "noTest": 0, "notPassed": 0, "accepted": true, "limitations": [] }
```

## a requirement with a test that passed and one that did not run is not counted as passing

approval: names the report

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A TWICE GUARDED RULE** *(Vibe Coding)*
Two tests guard it.
*Check:* `tests/rules.test.mjs`
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A TWICE GUARDED RULE
// given: a widget
// input: a call
// expect: a result
// TST-502 · level: release · module: system
// guards: A TWICE GUARDED RULE
// given: a widget
// input: a call
// expect: a result
```

### Records

```json
[["TST-501", "unit", "passed", ""]]
```

### Expected

```json
{ "rows": [["A TWICE GUARDED RULE", [["TST-501", "passed"], ["TST-502", "not run"]]]], "passing": 0, "noTest": 0, "notPassed": 1, "accepted": true, "limitations": [] }
```

## the acceptance names the person, the date and the text the approval names

approval: names the report

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A TAGGED RULE** *(Vibe Coding)*
It was valid at the tag.
*Check:* `tests/rules.test.mjs`
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A TAGGED RULE
// given: a widget
// input: a call
// expect: a result
```

### Records

```json
[["TST-501", "unit", "passed", ""]]
```

### Expected

```json
{ "rows": [["A TAGGED RULE", [["TST-501", "passed"]]]], "passing": 1, "noTest": 0, "notPassed": 0, "accepted": true, "limitations": [],
  "acceptance": { "person": "akmaier", "date": "2026-10-12 08:30 UTC", "namesTheReport": true } }
```

## a report that no approval record names is not accepted

approval: none

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A TAGGED RULE** *(Vibe Coding)*
It was valid at the tag.
*Check:* `tests/rules.test.mjs`
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A TAGGED RULE
// given: a widget
// input: a call
// expect: a result
```

### Records

```json
[["TST-501", "unit", "passed", ""]]
```

### Expected

```json
{ "rows": [["A TAGGED RULE", [["TST-501", "passed"]]]], "passing": 1, "noTest": 0, "notPassed": 0, "accepted": false, "limitations": ["missing: approval record naming blob"], "acceptance": null }
```

## a release before the test records says which parts cannot be derived and keeps its rows

approval: no report

### File SPEC.md

```text
# Fixture — Specification

## Rules

**A TAGGED RULE** *(Vibe Coding)*
It was valid at the tag.
*Check:* `tests/rules.test.mjs`

**A RULE WITH NO TEST** *(Vibe Coding)*
Nothing guards it.
*Check:* no automatic check; at review
```

### File tests/rules.test.mjs

```text
// TST-501 · level: unit · module: MOD-widget
// guards: A TAGGED RULE
// given: a widget
// input: a call
// expect: a result
```

### Records

```json
[]
```

### Expected

```json
{ "rows": [["A TAGGED RULE", [["TST-501", "cannot be derived"]]], ["A RULE WITH NO TEST", []]], "passing": 0, "noTest": 1, "notPassed": 0, "accepted": false,
  "limitations": ["cannot be derived: outcomes", "cannot be derived: acceptance"], "acceptance": null }
```
