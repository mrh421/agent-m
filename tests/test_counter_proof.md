# Counter-proof cases

The cases of `tests/test_counter_proof.py`, the check SPEC.md names for `A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT`. Each case is a branch that a test-writing participant pushed, the
report it made of it, the reviewed cases it implemented, and the findings MOD-result-records' check `test-proposals` must give. A `### File` block holds a file of the branch whole; the
product's own default branch holds `src/widget.mjs` and no test.

## valid counter-proof passes

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-961 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => {});
```

### File docs/tests/counter-proofs/TST-961.md

```text
---
test: TST-961
commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
participant: dev
date: 2026-11-01T09:00:00Z
outcome: failed
---
## Fault

- return "round";
+ return "square";

## Result

fails with the fault planted, passes once it is removed
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-961", "outcome": "passed" }] }
```

### Cases

```json
[{ "identifier": "TST-961", "level": "unit", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[]
```

## a new test without a counter-proof record is an error

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-962 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => {});
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-962", "outcome": "passed" }] }
```

### Cases

```json
[{ "identifier": "TST-962", "level": "unit", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[{ "test": "TST-962", "rule": "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT" }]
```

## a counter-proof that records the test passing is an error

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-963 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => {});
```

### File docs/tests/counter-proofs/TST-963.md

```text
---
test: TST-963
commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
participant: dev
date: 2026-11-01T09:00:00Z
outcome: passed
---
## Fault

- return "round";
+ return "square";

## Result

stays green with the fault planted
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-963", "outcome": "passed" }] }
```

### Cases

```json
[{ "identifier": "TST-963", "level": "unit", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[{ "test": "TST-963", "rule": "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT" }]
```

## a record without a fault is an error

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-964 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => {});
```

### File docs/tests/counter-proofs/TST-964.md

```text
---
test: TST-964
commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
participant: dev
date: 2026-11-01T09:00:00Z
outcome: failed
---
## Fault



## Result

fails with the fault planted, passes once it is removed
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-964", "outcome": "passed" }] }
```

### Cases

```json
[{ "identifier": "TST-964", "level": "unit", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[{ "test": "TST-964", "rule": "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT" }]
```

## a test that fails on the current code awaits its implementation

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-965 · level: unit · module: MOD-widgets
// guards: A ROUND RULE
// given: a widget
// input: its shape
// expect: round
test("widget is round", () => {});
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-965", "outcome": "failed" }] }
```

### Cases

```json
[{ "identifier": "TST-965", "level": "unit", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[]
```

## a test of the level user takes no counter-proof

branch: tests-branch

### File tests/widgets.test.mjs

```text
// TST-966 · level: user · module: system
// guards: A ROUND RULE
// given: a widget in a customer's hands
// input: the customer looks at it
// expect: round
test("customer sees a round widget", () => {});
```

### Report

```json
{ "branch": "tests-branch", "commits": ["c1"], "pullRequest": "https://example.org/pull/1", "tests": [{ "identifier": "TST-966", "outcome": "passed" }] }
```

### Cases

```json
[{ "identifier": "TST-966", "level": "user", "guards": ["A ROUND RULE"], "expected": "round" }]
```

### Expected

```json
[]
```

## a branch the host does not hold is one error

branch: not-pushed

### Report

```json
{ "branch": "not-pushed", "commits": [], "pullRequest": "", "tests": [] }
```

### Expected

```json
[{ "test": "not-pushed", "rule": "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT" }]
```
