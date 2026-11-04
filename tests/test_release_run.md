# Release run cases

The cases of `tests/test_release_run.py`, the check SPEC.md names for `A RELEASE RUNS EVERY TEST AT EVERY LEVEL`, `ACCEPTING THE RELEASE TEST REPORT RELEASES` and `A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED`.

A case that holds an `Each` block is run once for each of its entries, with `{level}` and `{test}` in the case and its expectation replaced by the entry's. `{blob}` and `{blob12}` in an expectation stand for the blob (and its first twelve digits) of the report the release committed.

Each case is a product in memory with a release candidate, driven step by step (`tests/release-run-world.mjs`). The product's tests are `five` — TST-001 unit, TST-002 component, TST-003 system, TST-004 release, TST-005 user, each guarding
`A SAMPLE RULE` — or those the case lists; a test with `"rate": true` is model-dependent. A step is:

- `start` — tag the commit the default branch stands at as the release candidate and queue its run (MOD-release-evidence `startReleaseCandidate`), keeping the changelog entry;
- `records` — add a result record of the candidate's commit (`"on": "other"` for another commit) with `add` rows `[test, level, outcome, runs]`, or `"all"` rows (every test passed), less the tests in `omit`, with `set` giving
  the outcome of a test (`"TST-002": "failed"`) and `rates` the runs of a model-dependent test;
- `land` — an unrelated commit lands on the default branch;
- `accept` — the person accepts the release test report as shown, with `limitations` (`stale` for a report that changed since it was shown) — `acceptAndRelease`;
- `tag` — a tag stands already, on another commit;
- `panel-open`, `panel-start`, `panel-check`, `panel-accept` — the same through the dashboard's release panel: open it, press *Start release candidate*, press *Check results*, press *Accept and release* with the reasons typed.

`Expected` gives, for each step, the part of what followed that the case states: `error` (the name of the refusal, or null), `tests` (the tests a refusal names), `tags` (the release tags and the commit each stands on), `writes` (commits written so far),
`order` (the calls that write, in order), `lastWrite` (the files of the commit written), `report` (whether the default branch holds the report), `changelogHas` and `changelogLacks`, `approvalLines` (the lines of the approval record, or
`approvalNone`), and for the panel `uiResult` (a pattern the answer matches), `uiButtons`, `uiReasonIds` and `uiIncomplete`.

## every test of every level has run on the candidate's commit

test: TST-1434001

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "accept" }
] }
```

### Expected

```json
[
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1 },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": ["commitFiles", "createTag"], "report": true }
]
```

## a test of one level that has not run stops the release, and its record releases it

test: TST-1434002

### Each

```json
[ { "level": "unit", "test": "TST-001" }, { "level": "component", "test": "TST-002" }, { "level": "system", "test": "TST-003" },
  { "level": "release", "test": "TST-004" }, { "level": "user", "test": "TST-005" } ]
```

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "omit": ["{test}"] },
  { "do": "accept" },
  { "do": "records", "add": "only", "only": ["{test}"] },
  { "do": "accept" }
] }
```

### Expected

```json
[
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1 },
  {},
  { "error": "Incomplete", "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "order": [], "report": false },
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": ["commitFiles", "createTag"], "report": true }
]
```

## a record of another commit is no run on the candidate's commit

test: TST-1434003

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "on": "other", "add": "all" },
  { "do": "records", "add": "all", "omit": ["TST-003"] },
  { "do": "accept" },
  { "do": "records", "add": "only", "only": ["TST-003"] },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  {},
  { "error": "Incomplete", "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2 }
]
```

## nothing is released while no candidate was started

test: TST-1434004

### Case

```json
{ "tests": "five", "steps": [
  { "do": "records", "add": "all" },
  { "do": "accept" },
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  { "error": "Incomplete", "tags": {}, "writes": 0, "order": [], "report": false },
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1 },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true }
]
```

## starting a release candidate tags the candidate and queues its run, and sets no release tag

test: TST-1434005

### Case

```json
{ "tests": "five", "steps": [
  { "do": "land" },
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "start", "changelog": "Adds the sample, again." }
] }
```

### Expected

```json
[
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "order": ["createTag", "commitFiles"], "report": false },
  { "error": null, "tags": { "v2026.4.0-rc.1": "earlier candidate", "v2026.4.0-rc.2": "candidate commit" }, "writes": 2, "report": false }
]
```

## a green report accepted releases in the one click: the entry, the record and the tag on the tested commit

test: TST-1434006

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "land" },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": ["commitFiles", "createTag"],
    "lastWrite": ["docs/tests/releases/v2026.4.0.md", "docs/approvals/release-v2026.4.0-{blob12}.md", "CHANGELOG.md"], "report": true,
    "changelogHas": ["^## v2026\\.4\\.0 — 2026-11-02\\n\\nAdds the sample\\.\\n"], "changelogLacks": ["Known limitations"],
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}"] }
]
```

## a report that changed since it was shown is not released

test: TST-1434007

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "accept", "stale": true },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": "Moved", "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "order": [], "report": false, "approvalNone": true },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true }
]
```

## a released version is never tagged again

test: TST-1434008

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "accept" },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2 },
  { "error": "TagExists", "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": [] }
]
```

## a tag that stands on another commit is not moved, and nothing is committed

test: TST-1434009

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "tag", "name": "v2026.4.0", "at": "other" },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  { "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "ddddddd" } },
  { "error": "TagExists", "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "ddddddd" }, "writes": 1, "order": [], "report": false, "approvalNone": true }
]
```

## the dashboard's Accept and release releases in the one click

test: TST-1434010

### Case

```json
{ "tests": "five", "steps": [
  { "do": "panel-open" },
  { "do": "panel-start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "panel-check" },
  { "do": "panel-accept" }
] }
```

### Expected

```json
[
  { "uiButtons": ["Start release candidate"] },
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "uiButtons": ["Check results"] },
  {},
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false, "uiButtons": ["Check results", "Accept and release"], "uiReasonIds": [], "uiIncomplete": false },
  { "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": ["commitFiles", "createTag"],
    "lastWrite": ["docs/tests/releases/v2026.4.0.md", "docs/approvals/release-v2026.4.0-{blob12}.md", "CHANGELOG.md"], "report": true,
    "changelogHas": ["^## v2026\\.4\\.0 — \\d{4}-\\d{2}-\\d{2}\\n\\nAdds the sample\\.\\n"], "uiResult": "^Released v2026\\.4\\.0 \\(commit [0-9a-f]{40}\\)\\.$" }
]
```

## not accepting the report sets no tag, and the dashboard offers no way to reject it

test: TST-1434011

### Case

```json
{ "tests": "five", "steps": [
  { "do": "panel-open" },
  { "do": "panel-start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "panel-check" },
  { "do": "panel-check" },
  { "do": "panel-accept" }
] }
```

### Expected

```json
[
  {},
  {},
  {},
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false, "approvalNone": true, "uiButtons": ["Check results", "Accept and release"] },
  { "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false, "approvalNone": true, "uiButtons": ["Check results", "Accept and release"] },
  { "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true }
]
```

## a failing test is released only with its reason recorded

test: TST-1434012

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "set": { "TST-002": "failed" } },
  { "do": "accept" },
  { "do": "accept", "limitations": { "TST-002": "known flaky fixture" } }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": "LimitationMissing", "tests": ["TST-002"], "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "order": [], "report": false, "approvalNone": true },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "order": ["commitFiles", "createTag"], "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}", "limitation: TST-002 — known flaky fixture"],
    "changelogHas": ["Known limitations:\\n- TST-002: known flaky fixture\\n"] }
]
```

## a test that passed and failed on the candidate's commit is released only with its reason recorded

test: TST-1434013

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all" },
  { "do": "records", "add": "only", "only": ["TST-003"], "set": { "TST-003": "failed" } },
  { "do": "accept" },
  { "do": "accept", "limitations": { "TST-003": "flips on a slow machine" } }
] }
```

### Expected

```json
[
  {},
  {},
  {},
  { "error": "LimitationMissing", "tests": ["TST-003"], "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}", "limitation: TST-003 — flips on a slow machine"] }
]
```

## a rate worse than the last release's is released only with its reason recorded

test: TST-1434014

### Case

```json
{ "tests": "five+rate", "last": { "commit": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "records": [["TST-006", "unit", "passed", "8 of 10"]] }, "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "rates": { "TST-006": "6 of 10" } },
  { "do": "accept" },
  { "do": "accept", "limitations": { "TST-006": "model drift, accepted" } }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": "LimitationMissing", "tests": ["TST-006"], "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}", "limitation: TST-006 — model drift, accepted"],
    "changelogHas": ["Known limitations:\\n- TST-006: model drift, accepted\\n"] }
]
```

## a rate no worse than the last release's needs no reason

test: TST-1434015

### Case

```json
{ "tests": "five+rate", "last": { "commit": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "records": [["TST-006", "unit", "passed", "8 of 10"]] }, "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "rates": { "TST-006": "8 of 10" } },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}"], "changelogLacks": ["Known limitations"] }
]
```

## every failing test needs a reason of its own, and a blank one is none

test: TST-1434016

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "set": { "TST-002": "failed", "TST-003": "failed" } },
  { "do": "accept", "limitations": { "TST-002": "known flaky fixture" } },
  { "do": "accept", "limitations": { "TST-002": "known flaky fixture", "TST-003": "   " } },
  { "do": "accept", "limitations": { "TST-002": "known flaky fixture", "TST-003": "slow machine" } }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": "LimitationMissing", "tests": ["TST-003"], "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  { "error": "LimitationMissing", "tests": ["TST-003"], "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}", "limitation: TST-002 — known flaky fixture", "limitation: TST-003 — slow machine"] }
]
```

## the dashboard asks a reason for every failing test before it releases

test: TST-1434017

### Case

```json
{ "tests": "five", "steps": [
  { "do": "panel-open" },
  { "do": "panel-start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "set": { "TST-002": "failed" } },
  { "do": "panel-check" },
  { "do": "panel-accept" },
  { "do": "panel-accept", "reasons": { "TST-002": "known flaky fixture" } }
] }
```

### Expected

```json
[
  {},
  {},
  {},
  { "uiButtons": ["Check results", "Accept and release"], "uiReasonIds": ["TST-002"], "tags": { "v2026.4.0-rc.1": "candidate commit" } },
  { "uiResult": "^Enter a reason for every failing test and worse rate before releasing: TST-002\\.$", "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false, "approvalNone": true },
  { "uiResult": "^Released v2026\\.4\\.0 ", "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true,
    "approvalLines": ["kind: release-report", "file: docs/tests/releases/v2026.4.0.md", "blob: {blob}", "limitation: TST-002 — known flaky fixture"] }
]
```

## a record of a working tree with uncommitted changes is no run on the candidate's commit

test: TST-1434018

### Case

```json
{ "tests": "five", "steps": [
  { "do": "start", "changelog": "Adds the sample." },
  { "do": "records", "add": "all", "uncommitted": true },
  { "do": "accept" },
  { "do": "records", "add": "all" },
  { "do": "accept" }
] }
```

### Expected

```json
[
  {},
  {},
  { "error": "Incomplete", "tags": { "v2026.4.0-rc.1": "candidate commit" }, "writes": 1, "report": false },
  {},
  { "error": null, "tags": { "v2026.4.0-rc.1": "candidate commit", "v2026.4.0": "candidate commit" }, "writes": 2, "report": true }
]
```

## the complete run queued for a candidate names every row of the schedule

A candidate's run is the `run-tests` job `startReleaseCandidate` queues. Its recipe `commit-and-levels` (MOD-result-records) gives the levels it runs; `unticked` lists the rows whose `release candidate` column the schedule leaves empty.
`levels` is every row the run must name: the five levels and the row `paid`, which holds the tests that call a paid service. `known` is what the recipe gives today.

test: TST-1434019

### Case

```json
{ "unticked": [] }
```

### Expected

```json
{ "levels": ["unit", "component", "system", "paid", "release", "user"], "known": ["unit", "component", "system", "release", "user"] }
```

## the complete run queued for a candidate names every row whatever the schedule's release candidate column says

test: TST-1434020

### Case

```json
{ "unticked": ["system", "user"] }
```

### Expected

```json
{ "levels": ["unit", "component", "system", "paid", "release", "user"], "known": ["unit", "component", "release"] }
```
