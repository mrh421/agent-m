---
id: MOD-review-pages
title: One review flow for every reviewed kind
folder: src/review-pages/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.readProblem
  - MOD-site-frame.runPanel
  - MOD-site-frame.confirmDecision
  - MOD-markdown-render.renderArtifact
  - MOD-markdown-render.openEditor
  - MOD-markdown-render.showDifference
  - MOD-browser-store.readSetting
  - MOD-bridge-client.bridgeAt
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.webLinks
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.readFileAt
  - MOD-text-tools.blobSha
  - MOD-text-tools.formatFinding
  - MOD-documents.artifactSchemas
  - MOD-documents.readDocument
  - MOD-documents.documentFindings
  - MOD-documents.readRegister
  - MOD-spec-document.parseSpec
  - MOD-spec-document.sectionText
  - MOD-spec-document.requirementFindings
  - MOD-test-document.testDeclarations
  - MOD-group-document.parseGroupFile
  - MOD-group-document.groupFileText
  - MOD-group-document.applyMoves
  - MOD-group-document.hierarchy
  - MOD-trace-graph.storedGraph
  - MOD-trace-graph.latestGraph
  - MOD-trace-graph.graphFindings
  - MOD-trace-graph.coverageGaps
  - MOD-trace-graph.requirementImpact
  - MOD-trace-graph.architectureImpact
  - MOD-trace-graph.storedImpacts
  - MOD-approvals.statuses
  - MOD-approvals.removedFiles
  - MOD-approvals.statusOf
  - MOD-approvals.lastAcceptedText
  - MOD-approvals.acceptShown
  - MOD-approvals.acceptanceBlockers
  - MOD-approvals.fallbackAcceptLink
  - MOD-approvals.rejectShown
  - MOD-approvals.approvalSchema
  - MOD-approvals.approvalStrategies
  - MOD-spec-changes.queues
  - MOD-spec-changes.openQueueOf
  - MOD-spec-changes.proposeSection
  - MOD-spec-changes.saveEntry
  - MOD-spec-changes.entrySections
  - MOD-spec-changes.entryView
  - MOD-spec-changes.acceptEntries
  - MOD-spec-changes.rejectEntry
  - MOD-spec-changes.specStrategies
  - MOD-artifact-edits.saveFile
  - MOD-artifact-edits.keptIdentifier
  - MOD-artifact-edits.saveGroupFile
  - MOD-artifact-edits.fallbackEditLinks
  - MOD-artifact-edits.editStrategies
  - MOD-release-evidence.acceptAndRelease
  - MOD-source-register.sourceSchemas
  - MOD-source-register.linkedVersion
  - MOD-source-register.restrictedPlaces
  - MOD-source-register.personSource
  - MOD-source-register.personAccount
  - MOD-source-register.sourceStrategies
  - MOD-reuse-facts.reuseStrategies
  - MOD-participant-list.participantSchema
  - MOD-participant-list.eligible
  - MOD-participant-list.differs
  - MOD-job-catalogue.kindOf
  - MOD-job-runner.prepareJob
  - MOD-job-runner.writeResult
  - MOD-job-runner.provenanceLines
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.listJobs
  - MOD-job-ledger.recordsNewestFirst
  - MOD-runtimes.routesFor
  - MOD-runtimes.queueJob
  - MOD-runtimes.runOnTab
  - MOD-runtimes.liveState
  - MOD-runtimes.tabContext
  - MOD-prompt-bar.Subject
  - MOD-prompt-bar.latestDraft
  - MOD-prompt-bar.dropDraft
  - MOD-prompt-bar.ConversationDraft
provides:
  - view
---
# MOD-review-pages One review flow for every reviewed kind

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the review flow of every reviewed kind of artifact, written
once as a template method: a list with statuses; one file with its difference to its last accepted text; accepting one,
the ticked ones or all shown; rejecting one, with a reason; editing; the draft of a change asked for in the prompt bar; drafting; and arranging groups.
A kind takes part through its
**descriptor** — data —, and the flow calls the service the descriptor names for each decision, once. The kinds are use
cases, architecture decisions, module files, SPEC change entries and release test reports; arranging groups covers every
kind of `EVERY HIERARCHY IS KEPT IN A GROUP FILE OF ITS OWN`, requirements and tests included.

It serves UC-005, UC-006, UC-007, UC-008, UC-018, UC-019, UC-021, UC-022, UC-023 and UC-049, and the acceptance of an open
release test report of UC-030. It derives no status of its own: every status comes from MOD-approvals (`STATUS IS
DERIVED FROM THE RECORDS`).

It runs in a browser, loaded by `docs/index.html` through MOD-site-frame.

## Parts

- `index.mjs` — the interface: `view`.
- `flow.mjs` — the template method: list, file, review all, accept, edit, drafting, arrange.
- `common.mjs` — what the pages of every kind share: the elements of a page, the token kept for the page's product, and
  the kind of server a product is on.
- `subjects.mjs` — the subject each route gives the prompt bar.
- `conversation-draft.mjs` — the route `draft`: the conversation's draft for the subject the address names, against the
  current text.
- `file-drafts.mjs` — drafted files in editors as their difference, saved together in one commit.
- `requirements-draft.mjs` — a draft of requirements: the candidates beside the requirements they refer to, saved as
  sections of the person's open queue.
- `candidates.mjs` — the candidates of a draft of requirements as the author reviews them, with their classes.
- `file-edit.mjs`, `edit.mjs`, `entry-edit.mjs` — the editors of a reviewed file, of a requirement, and of an open SPEC
  entry in place.
- `spec-entries.mjs` — what the flow asks of the kind whose files are the entries of a change queue.
- `reject.mjs` — *Reject* beside *Accept*: the field for the reason and the button, and GitHub's pages without a token.
- `kinds.mjs` — the five descriptors.
- `jobs.mjs` — preparing, starting and following the drafting jobs of a kind, and letting a result that waits for the
  person go on.
- `sections.mjs` — the extra sections a descriptor names: the architecture's rounds and due diligence, a SPEC entry's
  current text, rationale and impact list, an architecture change's impact list, a report's limitations.
- `arrange.mjs` — the hierarchy of a group file, moves, pending changes.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/dashboard-spec-impact.test.mjs`, `tests/review-core.d/dashboard-reads.test.mjs`, `tests/review-pages-edit-entry.test.mjs`, `tests/uc-006-batched-reads-harness.mjs`: their headers name this module; a test of only a removed view goes with it.

## Data

It keeps nothing but the screen, the edits in an open editor, and the result of a drafting job that waits for the
person's click. It owns the **descriptor** of a reviewed kind:

```text
ReviewKind = {
  key: "use-case" | "decision" | "module" | "spec-entry" | "release-report",
  entry: "use-cases" | "architecture" | "requirements" | "releases",   // the menu entry it is under
  files: { folder: string, pattern: string },                           // where its files are
  schema: "useCase" | "decision" | "module" | null,                     // its schema among MOD-documents' artifactSchemas; null for a SPEC entry and a report
  marks: (text, context) -> Finding[],                                  // the editor's marks, from the artifact model
  draftKinds: string[],                                                 // kinds of MOD-job-catalogue that draft it
  changeKinds: string[],                                                // the kind that changes one of its files, to which a conversation hands a change
  save: "file" | "entry" | null,                                        // MOD-artifact-edits.saveFile, MOD-spec-changes.saveEntry, or never edited
  accept: "records" | "queue" | "release",                              // MOD-approvals.acceptShown, MOD-spec-changes.acceptEntries, MOD-release-evidence.acceptAndRelease;
                                                                        // its service also rejects: MOD-approvals.rejectShown, MOD-spec-changes.rejectEntry, none for a release
  groupKind: string | null,                                             // its group file, for arranging
  sections: string[]                                                    // the extra sections shown with a file
}
```

| Kind | Files | Draft and change kinds | Save | Accept | Extra sections |
|---|---|---|---|---|---|
| use case | `docs/use-cases/UC-<nnn>-<slug>.md`, schema `useCase` | `derive-use-cases`; `change-use-case` | file | records | — |
| decision | `docs/architecture/ARC-<nnn>-<slug>.md`, schema `decision` | `derive-architecture`; `change-architecture` | file | records | rounds, due diligence, impact list of a change, what it rests on that is not accepted |
| module | `docs/architecture/MOD-<slug>.md`, schema `module` | `derive-architecture`; `change-architecture` | file | records | rounds, impact list of a change, what it rests on that is not accepted |
| SPEC entry | `docs/spec-freigaben/<queue>/`, read by MOD-spec-changes | `derive-requirements`; `change-requirements` | entry | queue | the current section beside the proposal with the difference, rationale, impact list, other proposals on the same section, the queue's order and anchors |
| release test report | `docs/tests/releases/v<version>.md` | — | never edited | release | the limitations — a reason for every failing test and every worse rate — and the changelog entry the person confirms |

## Interfaces

- `view: View` — the routes of the review flow, and the strategies its kinds use in the tab — `specStrategies`,
  `approvalStrategies`, `editStrategies`, `sourceStrategies`, `reuseStrategies`. Its routes, for each kind `<k>`, the key
  of its descriptor, are also the addresses by which other pages and the browser's notifications lead to a kind's list
  and to a file (MOD-main-page, MOD-notifications):
  - `<k>` — first, only while a file of the kind is open or changed since acceptance, those files, each with its status
    and a tick, and no such part where none is; then every file of the kind with its status — open, accepted, changed
    since acceptance —; and a link to `<k>/history`. A
    SPEC entry's tick names the blob of its proposal, from the tree, and the blob of the section that holds now, from the
    SPEC read once with `sectionText` and `blobSha`; the list builds no impact list, which is built for an entry only
    when it is opened. An entry of the instance's own SPEC whose approval record is committed but whose section is not
    written, because the instance's workflows are not turned on, is shown *approved*, not *in SPEC*, with why and a link
    to the Actions step of MOD-settings-pages' `get-your-own` (UC-014 step 4, 4a).
  - `<k>/history` — the history of the kind's changes: its approval records, newest first, each with the file it names,
    the person who committed it and the date, read twenty commits of `docs/approvals/` at a time, and *Older* for the
    next twenty, read from the parent of the last commit shown; opened only from the link on `<k>`.
  - `<k>/<id>` — one file, `<id>` the identifier an approval record names it by (MOD-approvals): `UC-<nnn>`,
    `ARC-<nnn>`, `MOD-<slug>`, `spec-<queue>-<NN>` for an entry of a change queue, `release-v<version>` for a release
    test report — one part of the address's fragment, since none of them holds a `/`. The file rendered, with its
    diagram; changed since acceptance, its difference to the text the most recent approval record of its identifier
    names (`A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT`), in a box of its own that scrolls, opened with its
    first change in the middle of the box; its extra sections; beside an open file a job
    wrote, the notes of that job's end record — a realised name it removed, a use case that realises none (UC-007 4a,
    4b); *Accept*, *Edit*; and, for a use case, decision or module file that is not accepted and a SPEC entry that is not
    decided — open, stale or waiting for its anchor —, *Reject* below them, with a field for the reason
    (`A PROPOSAL IS REJECTED WITH A REASON`): a click without a reason writes nothing, says so and puts the focus in the field;
    with one, the kind's service rejects the item shown on its blob (MOD-approvals' `rejectShown`, MOD-spec-changes'
    `rejectEntry`) and the page is drawn again with the commit named, or, where the item changed after it was shown, with
    that said and nothing written. A release test report is not rejected. Its subject for the prompt bar names the file and its version — the use case, or the architecture
    file —, as context (MOD-prompt-bar's `Subject`), with `draft` as its draft route. Without a token for GitHub, *Accept* and
    *Edit* open GitHub's prefilled pages, the text never in the
    address (`NO TEXT TRAVELS IN A URL`), and *Reject* lists the pages its service hands back — one that deletes a file,
    or the editor with the text to paste — with the reason to commit each with; for a GitLab product without a token,
    neither *Accept* nor *Edit* is offered, *Reject* names the token's step, and the token's step is linked.
  - `<k>/all` — *Review all*: every open or changed file of the kind in sequence, a changed one as its difference, in a box
    of its own that scrolls, opened with its first change in the middle of the box, a new one in full, and *Accept all N shown*: one commit with one record per file shown; a file that changed after it was
    shown, or that names a requirement or use case not yet accepted, is left out and named (`SEVERAL FILES ARE ACCEPTED IN
    ONE CLICK`, `ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS`). For the architecture, this is the review page of the whole
    architecture: the decision that states the system first, then the subsystems' decisions, the module files, the
    further decisions with their due diligence, and the rounds of the job that drafted them. It also lists every decision or
    module file that `removedFiles` names, each with its impact list (`architectureImpact` with `after: null`) and the empty
    text as the text shown, so that *Accept all N shown* counts it and records its removal in the same commit
    (`AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST`).
  - For a changed decision or module file, on `<k>/<id>` and in `<k>/all`, the page first reads the impact lists stored for
    the commit it shows (MOD-trace-graph's `storedImpacts`, one request). Where an entry's blob is the file's blob, the
    page takes the file's impact list from it. It reads the last accepted text at the entry's `before` commit with one
    `readFileAt` per file, and calls neither `traceGraph` nor `lastAcceptedText` for them. Where no
    entry fits, it derives both as before. The stored lists are records of the repository, derived from that commit
    alone by `onMainChanged` (MOD-workflow-entries), never kept in the browser.
  - `<k>/<id>/edit`, and `requirement/<name>/edit` and `requirements/new` for a requirement — whose subject for the
    prompt bar is the file, or the requirement, as on the file's route — the editor with live
    preview and the descriptor's marks, whose unsaved changes the route's `leave` keeps by the editor's `close` (UC-018
    7a); for a requirement, its SPEC section, a *Why* field and its impact list, saved as
    an entry of the person's open queue of the day (`A SPEC EDIT IS SAVED AS A PROPOSAL`); `requirements/new` with the four
    fields empty, for the SPEC section the specification browser hands it (UC-018 3d); an open SPEC entry saved in
    place, in its own queue (UC-006 3a, UC-018 1a); every save only on the blob the file or section was opened on. Before saving an edit of the architecture, *Check this edit* runs the kind
    `review-architecture` on the edited files as its draft, and its findings stand beside them for the author to weigh.
  - `draft` — the draft of the conversation (UC-019 step 8, UC-049 step 5): MOD-prompt-bar's `latestDraft` for the subject
    the person came from, shown against the current text before anything can be saved (`A DRAFTED CHANGE IS SHOWN AGAINST
    THE CURRENT TEXT`) — files each in the editor as their difference, a use case with a changed identifier the loop left
    restored first with `keptIdentifier` (UC-019 7a); requirements as the sections `entrySections` composes from the
    draft and its classes as the author leaves them, each requirement beside the one it refers to with its class, a
    conflict undecided kept out of what is saved (UC-019 8a); an architecture file with its rounds, the due diligence and
    the impact list of a change, as the descriptor's sections show them —, with the rounds and the findings the loop
    left. *Save* saves the draft as an edit of UC-018 is saved — the files with one `saveFile`, in one commit (UC-019 8b),
    each section with `proposeSection` as an entry of the person's open queue of the day —, only on the text the job
    read, with GitHub's pages without a token, and with the job's provenance lines, which name no message of the
    conversation (UC-019 step 9, 9a); *Discard* drops the draft. A further change is asked for in the prompt bar: the subject carries
    the draft as it stands as `draft`, the conversation hands the change on to the draft's kind with it (UC-049 4a.1),
    and this route then shows the newer draft. For a change of
    requirements, the subject's parameters carry the person's own source, which `personSource` names among the product's
    linked sources; without one, the change does not start and names the step that is missing (UC-004, UC-015,
    UC-019 4b). A draft of the kind `converse` — documents the participant proposed — is shown and saved the same way,
    each file with `saveFile` after its owner's schema found no error. A draft handed to CI or a Bridge arrives as an
    open file, a queue entry or a pull request instead.
  - `<k>/draft` — drafting: for use cases, the requirements to cover — by default those no use case realises —; for
    requirements, the linked source and, to send less, the files of its version to work on (UC-005 2a); for the
    architecture, what the derivation covers, its preconditions,
    the drafting and the reviewing participant — a reviewer offered only if it differs from the drafter in participant
    and model —; then the run panel and *Run*. A job the person starts here and waits for runs in this tab, attended: a
    kind whose result waits for a person ends with its draft — the candidates of a derivation of requirements, grouped by
    class beside the requirement each refers to, with their classes changeable and every conflict decided, and a
    candidate whose source the product does not link listed apart as the hint to link it first (UC-005 5a); the
    architecture as a whole with its rounds, the findings left and the due diligence, its reuse candidates choosable —,
    and *Write proposals* lets it go on, writing the draft as the person left it; while a step leaves an error — a reuse
    decision whose due diligence could not be fetched —, nothing is written and the findings left are named. A kind
    whose result does not wait — drafting use cases — writes its files open at once, and they appear in the list. A job
    on another route — a CI agent, an agent behind a Bridge it is handed to — is queued there and followed on the page;
    its route writes its result as open files or queue entries.
  - `arrange/<group kind>` — *Arrange* for requirements, use cases, decisions, modules or tests: the hierarchy with every
    item once, moves, new and renamed groups, the pending changes listed, *Propose groups*, whose proposal arrives as
    pending changes, and *Save arrangement*, which commits the group file only.

## Files

It writes nothing itself: every decision is one call of the service the descriptor names — MOD-approvals,
MOD-spec-changes, MOD-artifact-edits, MOD-release-evidence —, a drafting job's start record through MOD-runtimes, or,
for a result that waited for the person, the writer of its kind through MOD-job-runner. It reads the product's snapshot
through its host — the reviewed files, the SPEC, the group files, the tests, the approval records, the job records —,
and `docs/participants.md` of the instance.

## Uses

- MOD-site-frame.View, MOD-site-frame.chosenProduct, MOD-site-frame.explain, MOD-site-frame.notice, MOD-site-frame.readProblem,
  MOD-site-frame.runPanel, MOD-site-frame.confirmDecision — the frame's parts of every route.
- MOD-markdown-render.renderArtifact, MOD-markdown-render.openEditor, MOD-markdown-render.showDifference — files,
  editors, differences.
- MOD-browser-store.readSetting — the endpoints' configurations and the Bridges' settings a job in the tab needs;
  MOD-bridge-client.bridgeAt — a handle for each Bridge, handed to the runtimes.
- MOD-repository-hosts.readSnapshot, MOD-repository-hosts.repositoryInfo, MOD-repository-hosts.webLinks — the
  product's files, whether the person may write and the repository's visibility, GitHub's own pages;
  MOD-repository-hosts.readHistory — on `<k>/history` only, the commits that added the approval records under
  `docs/approvals/`, each with its author and date.
- MOD-text-tools.blobSha — the blob of each text as it was shown, which an acceptance names (`AN APPROVAL NAMES THE EXACT
  TEXT`); MOD-text-tools.formatFinding — a finding the loop left, shown in its one fixed text form (`A FINDING READS
  LIKE A COMPILER MESSAGE`).
- MOD-documents.artifactSchemas, MOD-documents.readDocument, MOD-documents.documentFindings,
  MOD-documents.readRegister — the kinds' files, their marks, the participant list; MOD-spec-document.parseSpec,
  MOD-spec-document.sectionText, MOD-spec-document.requirementFindings — requirements, their sections and marks;
  MOD-test-document.testDeclarations — the tests to arrange.
- MOD-group-document.parseGroupFile, MOD-group-document.groupFileText, MOD-group-document.applyMoves,
  MOD-group-document.hierarchy — arranging.
- MOD-trace-graph.storedGraph, MOD-trace-graph.graphFindings, MOD-trace-graph.coverageGaps,
  MOD-trace-graph.requirementImpact, MOD-trace-graph.architectureImpact — the marks across artifacts, the requirements
  no use case realises, and the impact lists; MOD-trace-graph.storedImpacts and MOD-repository-hosts.readFileAt — the
  impact lists stored for the commit, and the last accepted texts they name. The graph is the one `onMainChanged`
  stored for the commit shown (MOD-workflow-entries), read through `storedGraph`; no page builds a graph, also not over
  an edited text: the editor shows the stored graph's findings of the file, and the edit is checked across artifacts
  once it is committed. Where that graph is not stored yet, an impact list, the marks of an editor and an arrangement
  are not derived from another commit's graph, since each states the commit shown or is written to it. Only the drafting
  of use cases reads the graph through `latestGraph`: while the commit's graph is not stored, its default selection — the
  requirements no use case realises — comes from the graph stored last, with that function's line above it; the
  requirements it lists are the head's SPEC's, as are those the drafting of the architecture lists, which reads
  `SPEC.md` while the head's graph is not stored and shows no earlier graph.
- MOD-approvals.statuses, MOD-approvals.removedFiles, MOD-approvals.statusOf, MOD-approvals.lastAcceptedText, MOD-approvals.acceptShown,
  MOD-approvals.acceptanceBlockers, MOD-approvals.fallbackAcceptLink — statuses, the files removed since their acceptance, and acceptance;
  MOD-approvals.rejectShown — rejecting a use case, decision or module file; MOD-approvals.approvalSchema —
  the schema an approval record is read with, on `<k>/history` too.
- MOD-spec-changes.queues, MOD-spec-changes.openQueueOf, MOD-spec-changes.proposeSection, MOD-spec-changes.saveEntry,
  MOD-spec-changes.entrySections, MOD-spec-changes.entryView, MOD-spec-changes.acceptEntries — SPEC edits, an open entry
  saved in place, the sections a draft of the conversation holds, SPEC entries and their acceptance in the queue's order, with the product's links and
  the instance's register, so that an entry whose requirement names no linked source is named and not accepted;
  MOD-spec-changes.rejectEntry — rejecting an entry.
- MOD-artifact-edits.saveFile, MOD-artifact-edits.saveGroupFile, MOD-artifact-edits.fallbackEditLinks — saves;
  MOD-artifact-edits.keptIdentifier — a drafted change's identifier restored before the editor opens.
- MOD-release-evidence.acceptAndRelease — accepting an open release test report.
- MOD-source-register.sourceSchemas, MOD-source-register.linkedVersion — the product's links file and register, and its
  linked sources with their parts; MOD-source-register.restrictedPlaces — the `places` of the context of a job it
  prepares, over every restricted source of the register and not only the linked ones, so that a drafter's tools refuse a
  restricted source's content at a place it does not permit wherever the product holds it; the offer of participants for
  a job is judged against the places of the sources the product links, which the job's parts can carry, and the module
  keeps no copy of the rule that computes them; MOD-source-register.personSource, MOD-source-register.personAccount — the source of
  the person who gives an instruction.
- MOD-approvals.approvalStrategies, MOD-spec-changes.specStrategies, MOD-artifact-edits.editStrategies,
  MOD-source-register.sourceStrategies, MOD-reuse-facts.reuseStrategies — the strategies of its kinds, handed to the frame.
- MOD-participant-list.participantSchema, MOD-participant-list.eligible, MOD-participant-list.differs — who may draft and
  who may review, a reviewer differing from the drafter in participant and model.
- MOD-job-catalogue.kindOf — a kind's purpose and whether its result waits for a person; MOD-job-runner.prepareJob —
  the run panel; MOD-job-runner.writeResult — a result that waited for the person, written on their click;
  MOD-job-runner.provenanceLines — the trailers of a draft of the conversation the person saves.
- MOD-prompt-bar.Subject — the subject each route gives the prompt bar; MOD-prompt-bar.latestDraft,
  MOD-prompt-bar.ConversationDraft — the conversation's draft the route `draft` shows; MOD-prompt-bar.dropDraft — the
  draft dropped once it is saved or discarded.
- MOD-job-ledger.newJobId — the identifier of a job started here; MOD-job-ledger.listJobs — the jobs a page lists;
  MOD-job-ledger.recordsNewestFirst — the record of the job that drafted a file, with its rounds, read newest first and
  no further than that record.
- MOD-runtimes.routesFor, MOD-runtimes.queueJob, MOD-runtimes.tabContext, MOD-runtimes.runOnTab,
  MOD-runtimes.liveState — the route of a participant, the start record, a drafting job's context and its run in this
  tab attended, and a job followed on its route.
