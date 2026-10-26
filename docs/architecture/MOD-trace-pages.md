---
id: MOD-trace-pages
title: One trace page for every view over the trace graph
folder: src/trace-pages/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.readProblem
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.embedRoute
  - MOD-markdown-render.renderArtifact
  - MOD-markdown-render.renderMermaid
  - MOD-markdown-render.showDifference
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.readFileAt
  - MOD-repository-hosts.listTags
  - MOD-repository-hosts.webLinks
  - MOD-repository-hosts.ciRunLog
  - MOD-repository-hosts.repositoryInfo
  - MOD-documents.artifactSchemas
  - MOD-documents.readDocument
  - MOD-spec-document.parseSpec
  - MOD-group-document.parseGroupFile
  - MOD-group-document.hierarchy
  - MOD-test-document.testDeclarations
  - MOD-trace-graph.storedGraph
  - MOD-trace-graph.latestGraph
  - MOD-trace-graph.tracesTo
  - MOD-trace-graph.coverageGaps
  - MOD-trace-graph.compareGraphs
  - MOD-trace-graph.moduleRows
  - MOD-trace-graph.graphFindings
  - MOD-approvals.statuses
  - MOD-spec-changes.queues
  - MOD-spec-changes.entryView
  - MOD-spec-changes.requirementHistory
  - MOD-progress-measures.storedOverview
  - MOD-source-register.sourceSchemas
  - MOD-source-register.linkedVersion
  - MOD-source-register.affectedRequirements
  - MOD-test-schedule.occasionsOf
  - MOD-test-schedule.scheduleSchema
  - MOD-test-schedule.defaultSchedule
  - MOD-result-records.resultsAt
  - MOD-result-records.flakyTests
  - MOD-result-records.rateComparison
  - MOD-result-records.testHistory
  - MOD-result-records.resultSchema
  - MOD-release-evidence.auditRows
  - MOD-product-process.declarationSchema
  - MOD-product-process.productWorkflow
  - MOD-product-process.gateSchema
  - MOD-product-process.gateStates
  - MOD-release-evidence.auditDocument
  - MOD-artifact-edits.saveFile
  - MOD-source-register.personSource
  - MOD-source-register.personAccount
  - MOD-prompt-bar.Subject
provides:
  - view
---
# MOD-trace-pages One trace page for every view over the trace graph

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is every view that reads the trace graph of one version of a
product, written once as a template method: choosing a version — the default branch or a release tag, and a second one
to compare —, showing a tree or a table, narrowing it by filters, opening a row, and following its links. A view takes
part through its **descriptor**. The views are the specification browser with each requirement's traces, proposals and
history; the coverage gaps; the modules view with its component diagram; the tests browser; and the audit of a release
with its export. Everything is derived when it is shown, from the artifacts of the chosen version; nothing is read from a
stored matrix (`THE TRACEABILITY MATRIX IS DERIVED`).

The specification, the gaps and the modules view read the graph of the default branch's head through `latestGraph`. While
that graph is not stored yet and `latestGraph` gives the graph of an earlier commit, the view shows the whole version of
that commit: its snapshot, read once, and every file the view reads, read from it in the batches the view reads them in,
so that requirements and traces come from the same version. Above it stands `latestGraph`'s line, followed by *Until then
it shows that commit's version, read-only.*; as at a release tag, nothing that writes or leads to writing is offered —
no *Edit*, *+ Requirement*, *Arrange*, change entries waiting, impact lists or next steps of the modules view. Where the
head's graph is stored, the view reads nothing more than the graph itself. At a release tag the view reads the tag's graph
through `storedGraph`, and no other.

It serves UC-020, UC-025, UC-029 and UC-030, and gives the prompt bar the subject of what it shows (UC-049). Editing,
the draft of a change asked for in the prompt bar, and arranging are the review pages' routes, which its links lead to.

It runs in a browser, loaded by `docs/index.html` through MOD-site-frame.

## Parts

- `index.mjs` — the interface: `view`.
- `flow.mjs` — the template method: version choice and comparison, tree or table, filters, a row's detail, links.
- `subject.mjs` — the subject the specification view gives the prompt bar: the page, what is open, its draft route, the
  person's own source.
- `views.mjs` — the five descriptors.
- `diagram.mjs` — the component diagram of the modules view, as Mermaid.
- `tests.mjs` — the tests view: the tests of the version as a tree or grouped, their filters, the incomplete ones, and the comparison of two
  releases.
- `test-detail.mjs` — an opened test of the tests view: its declaration, schedule, counter-proof, code and history.
- `audit.mjs` — the audit view of a release: its summary, filters and rows.
- `export.mjs` — saving the audit document in the browser.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/trace-pages-edit-links.test.mjs`: its header names this module.

## Data

It keeps nothing but the screen. It owns the **descriptor** of a trace view:

```text
TraceView = {
  key: "specification" | "gaps" | "modules" | "tests" | "audit",
  entry: "requirements" | "architecture" | "tests",                // the menu entry it is under
  versions: "branch-and-tags" | "tags",                            // what the version choice offers; a second version compares
  shape: "tree" | "table",
  rows: (graph, facts) -> Row[],                                   // built from the trace graph and the services' facts
  groupings: string[],                                             // the ways its rows can be grouped
  filters: Filter[],                                               // { name, values, keep(row) -> boolean }
  detail: (row, facts) -> Section[],                               // what opening a row shows
  links: (row) -> Link[],                                          // routes it leads to, its own or the review pages'
  extras: string[]                                                 // "component-diagram", "export"
}
```

| View | Versions | Shape and rows | Opening a row | Extras |
|---|---|---|---|---|
| specification | branch and tags | first, only while an entry of a change queue waits for acceptance, those entries, each with its status and a link to it (MOD-review-pages' `spec-entry/<id>`), and nothing where none waits; then the tree of `docs/groups/requirements.md`, every requirement once with its status, one that no group names at the top level, marked *not yet placed* (UC-021 3b) — in SPEC, change proposed, removal proposed, proposed — and, where MOD-source-register's `affectedRequirements` names it for a source the product moved to a newer version after its section last changed, *source changed* until its section changes (UC-016 step 5), each group with how many it holds and how many no use case realises | the four fields; sources with version and part; use cases with their review status; decisions, modules and tests naming it; open proposals; its history of accepted changes | to the review pages, on the default branch only: *Edit* on a requirement, *+ Requirement* once for each section of the SPEC, listed beside the tree and not within it, each of which opens `requirements/new` for that section (UC-018 3d), and *Arrange*; *History of SPEC changes*, which opens MOD-review-pages' `spec-entry/history`. Its subject for the prompt bar is context only (MOD-prompt-bar's `Subject`): the page and, on the default branch, the open requirement, or the group with the names it holds, as `requirements`, the person's own source where the product links one, and the review pages' `draft` as its draft route (UC-019 step 1); at a released version, the requirement as it read there, and no draft route (UC-020 1a, UC-049 2a) |
| gaps | branch and tags | table of requirements realised by no use case and named by no module or test, use cases realising none, names matching nothing | the artifact as it read in that version | what became covered and what lost its coverage between two versions |
| modules | branch | table of modules: subsystem, the requirements its tests guard with their statuses, its file, code, tests; and every gap | the module's file and folder | component diagram: one box per module in its subsystem's box, one arrow per use, gaps marked, a missing provider as a box marked *missing*; *Change the architecture* and *Implement* |
| tests | branch and tags | tree by level, file and case, or by requirement, use case or module, each test with its outcome on the latest commit | its declaration, its schedule, its counter-proof, its code, its history across commits and releases | comparing two releases |
| audit | tags | one row per requirement valid at the tag, with a summary at the top | the guarding tests with outcomes or rates and counter-proofs, process gates, the acceptance of the report | *Export* as one Markdown document; *Commit export* |

## Interfaces

- `view: View` — the routes of the five trace views, `trace/<key>`, each with its version and filters in its `params`,
  and `trace/<key>/<row>` for an opened row, each with its subject for the prompt bar: the specification view's as its
  descriptor says, every other view's the frame's default with the version shown among its page; its route's `entry` is
  `requirements`, the entry it is listed under, and its `entryShown` the `entry` of the descriptor its `key` names, or `null`, the route's `entry`, where `key` names
  no descriptor, so that
  the tests browser and the audit are shown under Tests and the modules view under Architecture; its strategies are
  none, since it starts no job itself.

## Files

It writes one file, and only on a person's click: the audit document under `docs/audits/<tag>.md` (*Commit export*).
It reads the product's snapshot at the chosen version through its host — the SPEC, the group files, use cases,
architecture files, code files, tests, approval records, the product's links to sources —, the history of the SPEC and
the result records on the branch `test-results`. The specification asks at once what does not wait for another read —
the snapshot, the default branch and the tags; then the SPEC, the person's source, the entries waiting, the group file,
the stored graph and the history of the links —, and reads the change queues from the overview stored for the commit
where there is one. For the audit it reads the product's `docs/process.md` and `docs/gates/`
at the release's commit, and the instance's `SPEC.md`, whose requirements are the process requirements. Through the
instance's host that the frame gives every route, it also reads the instance's process models at the commit that this
`docs/process.md` names (`model_version`), for the model the product had declared at the release (UC-031 6a).

A mark of an opened test's history (UC-029 step 5) finds the id of its run in the `run` address of the result records of its
commit on the branch `test-results` that hold the test: the last part of the address's path, as `WebLinks`' `run` builds it
(`…/actions/runs/<id>` on GitHub, `…/-/pipelines/<id>` on GitLab); a mark whose records name no run has no link to a log.
The link to the full log is `WebLinks`' `run` for that id; where `ciRunLog` gives `null` for it, the server no longer keeps the
log, the link reads *no longer available*, and the mark keeps its outcome (UC-029 5b).

## Uses

- MOD-site-frame.View, MOD-site-frame.chosenProduct, MOD-site-frame.explain, MOD-site-frame.notice, MOD-site-frame.readProblem,
  MOD-site-frame.confirmDecision — the frame's parts of every route; MOD-site-frame.embedRoute — the Tests entry's views,
  MOD-test-pages' route `tests-views`, shown under the heading of the tests browser and of the audit of a release tag,
  with `shown` naming the view; the audit of a release candidate (`commit` among its params), which the release panel
  shows inside itself, shows none. They are drawn by the route, not given by the descriptor's `links`, which are a row's.
  Where MOD-test-pages is not loaded on the page, the frame's link to the route stands in their place (`RouteNotLoaded`),
  and the view is drawn on.
- MOD-markdown-render.renderArtifact, MOD-markdown-render.renderMermaid, MOD-markdown-render.showDifference — rows'
  details, the component diagram, the comparison of versions.
- MOD-repository-hosts.readSnapshot, MOD-repository-hosts.readHistory, MOD-repository-hosts.readFileAt,
  MOD-repository-hosts.listTags,
  MOD-repository-hosts.webLinks — the version, the history of a requirement's section, the text of a file at the commits
  of its history, the release tags, a test's code (`WebLinks`' `file`, the page of the test's file at the version shown)
  and a run's log on the server; for the audit, the instance at the commit the release's declaration names;
  MOD-repository-hosts.repositoryInfo — the default branch, on which alone a requirement leads to editing, and at which
  the instance's links are read for the person's own source; MOD-repository-hosts.ciRunLog — whether the server still keeps a
  run's log (UC-029 5b).
- MOD-documents.artifactSchemas, MOD-documents.readDocument, MOD-spec-document.parseSpec, MOD-group-document.parseGroupFile,
  MOD-group-document.hierarchy, MOD-test-document.testDeclarations — the artifacts of the version.
- MOD-trace-graph.storedGraph, MOD-trace-graph.latestGraph, MOD-trace-graph.tracesTo, MOD-trace-graph.coverageGaps, MOD-trace-graph.compareGraphs,
  MOD-trace-graph.moduleRows, MOD-trace-graph.graphFindings — the rows, gaps, unknown names and comparisons.
- MOD-approvals.statuses — the review status of use cases and architecture files.
- MOD-spec-changes.queues, MOD-spec-changes.entryView, MOD-spec-changes.requirementHistory — open proposals, what each
  open entry changes, withdraws or adds (its `impact`), and a requirement's history.
- MOD-progress-measures.storedOverview — the change queues with an entry not in the SPEC yet, as the workflow stored them
  for the version's commit, of which the specification lists those waiting for acceptance without reading every queue;
  where no overview is stored, `queues` reads them all.
- MOD-source-register.sourceSchemas, MOD-source-register.linkedVersion — a requirement's sources with version and part;
  MOD-source-register.affectedRequirements — the requirements marked *source changed*;
  MOD-source-register.personSource, MOD-source-register.personAccount — the person's own source, which the subject of a
  requirement carries.
- MOD-prompt-bar.Subject — the subject each route gives the prompt bar.
- MOD-test-schedule.occasionsOf — when the schedule runs a test; MOD-test-schedule.scheduleSchema reads the product's
  `docs/tests/schedule.md` at the version shown, and MOD-test-schedule.defaultSchedule gives the book's schedule where the
  product has none, the document `occasionsOf` is given.
- MOD-result-records.resultsAt, MOD-result-records.flakyTests, MOD-result-records.rateComparison,
  MOD-result-records.testHistory — outcomes, flaky tests, rates and history; MOD-result-records.resultSchema reads a
  test's counter-proof record, whose `participant` is shown as the one who wrote the test.
- MOD-release-evidence.auditRows, MOD-release-evidence.auditDocument — the audit and its document; the audit is given the
  instance's SPEC, where the process requirements stand.
- MOD-product-process.declarationSchema, productWorkflow, gateSchema, gateStates — the product's workflow and its gate
  records at the release's commit, from which the audit's process rows take each process requirement's gates and records
  (UC-030). The workflow is `productWorkflow` of the declaration at the release, so it is derived from the model the
  product had declared then.
- MOD-artifact-edits.saveFile — *Commit export*, as the person's own input.
