---
id: ITM-1348
title: An impact list is read from the references stored beside the graph, in a test
level: module
realises:
  - A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-trace-graph
  - MOD-spec-changes
builds_on: []
tests:
  - unit
origin:
  - a review of akmaier's emergency commits of 2026-11-01, sent by the Scrum Master of team 1
---
# ITM-1348 An impact list is read from the references stored beside the graph, in a test

**REGISTER**

## Outcome

MOD-trace-graph's `storedReferences` reads `<commit>.references.json.gz`, and MOD-spec-changes takes an entry's impact
list from it, reading the graph itself only where those are not stored (MOD-spec-changes.md:285-287,
`src/spec-changes/accept.mjs:81-83`). No test serves that file: each fake that is asked for it answers that it is not
stored (`tests/spec-changes-impact-graph.test.mjs:66-67`, `tests/dashboard-spec-impact.test.mjs:185`,
`tests/release-uc-006-batched-reads.test.mjs:38`), so only the way back to the graph is tested.

## Acceptance

- A test of MOD-trace-graph: the file `publishGraph` stores is read back by `storedReferences` as the same map that
  `requirementImpact` gives for the graph; `null` for a missing file and for one of another format.
- A test of MOD-spec-changes: with the references stored, an entry's impact list is the same as from the graph, and the
  graph is not read. Counter-proof: with the references not stored, the graph is read.
- Each new test's counter-proof is recorded in the pull request.
- The item adds no behaviour; no failing first commit is required. Only new test files change.
