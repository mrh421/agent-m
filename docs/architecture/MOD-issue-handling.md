---
id: MOD-issue-handling
title: An issue handled as a bug or a change, and moved into the backlog
folder: src/issue-handling/
realises:
follows:
  - ARC-044
uses:
  - MOD-repository-hosts.commentOnIssue
  - MOD-repository-hosts.setIssueLabels
  - MOD-repository-hosts.setIssueState
  - MOD-repository-hosts.webLinks
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.Snapshot
  - MOD-mail-records.issueLabels
  - MOD-mail-records.noteText
  - MOD-mail-records.IssueText
  - MOD-spec-document.parseSpec
  - MOD-spec-document.requirementNamesIn
  - MOD-identifiers.kindOfIdentifier
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.tracesTo
  - MOD-run-planner.runStrategies
  - MOD-personal-data.pseudonymisationOf
  - MOD-documents.artifactSchemas
  - MOD-documents.readDocument
  - MOD-documents.Document
  - MOD-work-plans.saveItems
  - MOD-job-runner.Strategies
provides:
  - confirmClass
  - backlogItemFrom
  - moveToBacklog
  - closeWithLinks
  - issueStrategies
  - IssueClass
---
# MOD-issue-handling An issue handled as a bug or a change, and moved into the backlog

## Responsibility

It belongs to Issues and mail (ARC-044). It handles an issue the way the SPEC lets software evolve (`EVOLUTION ENTERS
THROUGH THE SPECIFICATION`, UC-012, UC-033): it gives the participant that analyses an issue, or fixes a bug, the issue
with the requirements, use cases and tests it touches — never a mail —; it records the class a person confirms; it
prefills the backlog item of a classified issue and moves the issue into the backlog in one decision; and it closes an
issue with links to what solved it. It runs in the browser and in Node, where the job runner runs the issue kinds.

## Parts

- `index.mjs` — the interface.
- `classes.mjs` — the classes of an issue and their labels; closing with links.
- `backlog.mjs` — the item prefilled from an issue.
- `strategies.mjs` — the recipes `issue-context` and `fix-inputs`.

## Data

It keeps nothing. The class of an issue is recorded only as one of MOD-mail-records' labels on the issue; the item it
prefills is a document of the item schema of MOD-documents, written by Process (MOD-work-plans).

## Interfaces

- `IssueClass` — `"bug" | "change" | "not-reproducible" | "rejected"`. *Bug*: the SPEC is right, code or a test is
  wrong; *change*: the SPEC is wrong, incomplete or silent for the case — a missing requirement is a change, not a bug
  (UC-012); *not reproducible*; *rejected*: the issue is closed with its reason and nothing else changes.
- `confirmClass(host: Host, issue: number, cls: IssueClass, reason: string | null) -> Promise<void>` — the person's one
  click on the class: sets the label `defect`, `change` or `not-reproducible` and removes the other two; for *rejected*,
  comments the reason and closes the issue. Crosses the network to the product's tracker. Errors: Access's
  `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`.
- `backlogItemFrom(issue: IssueText & { title: string, address: string }, cls: IssueClass, analysis: { violated: string |
  null, modules: string[] }, changed: string[]) -> { item: Document }` — the backlog item a
  person checks before adding it (UC-033): its title from the issue's title, its outcome from the issue's description,
  its origin the issue's address, what it realises — for a bug the requirement the analysis names as violated, for a
  change the requirements `changed` names: those the entries of the queues that name this issue change or add, which
  the caller finds with MOD-spec-changes' `queues` and `entryView` —,
  and the modules the analysis names, which the person confirms or corrects (`A BACKLOG ITEM NAMES WHAT IT REALISES`, `A
  BACKLOG ITEM NAMES THE MODULES IT CHANGES`). Errors: `NotClassified` for an issue without a class — no item is offered.
- `moveToBacklog(host: Host, issue: { number: number, address: string }, item: Document, existing:
  string | null) -> Promise<{ item: string, comment: { text: string, issue: string } | null }>` — the
  person's one click *Add* (UC-033): the item — the one `backlogItemFrom` prefilled and the person checked, or, when
  `existing` names an item, that item with this issue added to its origins — written through Process's `saveItems`; then the comment `item-added` on the issue, naming the item and the address of the item
  file in the product's repository, and the label `backlog`, also for a second issue added to an existing item. When the token may not comment,
  the item is written all the same and the comment's text and the issue's address are returned for the person to copy
  (UC-033). Crosses the network. Errors: `saveItems`' own — nothing is written then —, and Access's.
- `closeWithLinks(host: Host, issue: number, links: { pullRequest: string | null, commit: string | null, item: string |
  null }) -> Promise<void>` — the comment `closed-with` and the issue closed; run when the pull request of a bug fix or of
  an item from the issue is merged. Errors: Access's.
- `issueStrategies` — of MOD-job-runner's type `Strategies`:
  - recipe `issue-context` — for analysing an issue, and for drafting the change it asks for: one part with the issue's title, text and comments; parts with the
    requirements the issue names, and the use cases, tests and modules it names together with the requirements the trace
    graph links to them — each with its text from the snapshot. An issue that names nothing gets the whole SPEC. A job
    without the parameter `issue` gets no part, as `draft?` gives none without a draft: a change by prompt has no issue,
    and `analyse-issue` and `fix-bug` are started only from an issue's route, which always gives it. The
    issue's text from a mail is neutral by construction; no mail is ever a part.
  - recipe `fix-inputs` — for fixing a bug: the parts of `issue-context`; the confirmed analysis — the violated
    requirement, whether code or a test is wrong, the modules —; the implementation inputs of those modules from
    MOD-run-planner's recipe `implementation-inputs`, given them as its parameter `modules`; and the instruction to
    write first a regression test that fails on the reported behaviour, with invented data only, never the reporter's
    (UC-012). Report data is in the issue only as
    the product's pseudonymisation left it, which the part says (`A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES
    A MAIL`).

`Host` is the host Access's `connect` returns.

## Files

It reads the SPEC and the files the trace graph needs, from a snapshot. It writes comments and
labels and closes issues in the product's tracker through Access; the item is written by Process's `saveItems`.

## Uses

- `MOD-repository-hosts.commentOnIssue`, `setIssueLabels`, `setIssueState` — the class, the notes and closing, with the
  person's token; `MOD-repository-hosts.webLinks` — the address of the item file in the product's repository;
  `MOD-repository-hosts.repositoryInfo`, `readSnapshot` — the default branch's head that `moveToBacklog` reads the module
  files and an existing item from;
  `MOD-repository-hosts.Snapshot` — the files its recipes read.
- `MOD-mail-records.issueLabels`, `MOD-mail-records.noteText`, `MOD-mail-records.IssueText` — the labels and comments
  Agent M writes on an issue, defined once there.
- `MOD-spec-document.parseSpec`, `MOD-spec-document.requirementNamesIn` — the requirements an issue names, with their
  text.
- `MOD-identifiers.kindOfIdentifier` — the use cases, tests and modules an issue names.
- `MOD-trace-graph.traceGraph`, `MOD-trace-graph.tracesTo` — what links to them.
- `MOD-run-planner.runStrategies` — the recipe `implementation-inputs`, reused for the modules of a fix.
- `MOD-personal-data.pseudonymisationOf` — whether the issue's report data was rewritten without persons.
- `MOD-documents.Document` — the prefilled item; `MOD-documents.artifactSchemas`, `MOD-documents.readDocument` — the
  item and module schemas, the module files of the architecture that `saveItems` checks the item against, and an existing
  item that takes this issue as a further origin.
- `MOD-work-plans.saveItems` — writing the item.
- `MOD-job-runner.Strategies` — the type of `issueStrategies`.
