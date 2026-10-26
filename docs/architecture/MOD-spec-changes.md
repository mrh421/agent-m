---
id: MOD-spec-changes
title: SPEC change queues, from proposal to the accepted section
folder: src/spec-changes/
realises:
follows:
  - ARC-041
uses:
  - MOD-approvals.approvalSchema
  - MOD-artifact-edits.fallbackEditLinks
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.readFileAt
  - MOD-repository-hosts.commitFiles
  - MOD-documents.Schema
  - MOD-documents.Document
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.readRegister
  - MOD-documents.classifyCandidates
  - MOD-documents.Classified
  - MOD-documents.appendSection
  - MOD-spec-document.parseSpec
  - MOD-spec-document.sectionText
  - MOD-spec-document.replaceSection
  - MOD-spec-document.requirementNamesIn
  - MOD-spec-document.renamedRequirements
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.storedGraph
  - MOD-trace-graph.requirementImpact
  - MOD-trace-graph.coverageGaps
  - MOD-source-register.sourceSchemas
  - MOD-source-register.sourceFindings
  - MOD-source-register.linkedVersion
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-text-tools.blobSha
  - MOD-text-tools.lineDiff
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
  - MOD-job-runner.JobResult
  - MOD-job-runner.provenanceLines
provides:
  - Queue
  - queues
  - openQueueOf
  - proposeSection
  - saveEntry
  - entrySections
  - entryView
  - acceptEntries
  - applyApproved
  - requirementHistory
  - specStrategies
---
# MOD-spec-changes SPEC change queues, from proposal to the accepted section

## Responsibility

It belongs to Specification and design (ARC-041). A SPEC is never written directly: every change to it is an entry of a
change queue under `docs/spec-freigaben/` — the whole section as proposed, beside the section it replaces — and is
written into the SPEC byte for byte, with its approval record and its decision, in one commit, only when a person
accepts it on the text that was shown (`A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN`, `THE APPROVED TEXT IS
TAKEN VERBATIM`, `AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL`). It keeps the person's edits in one open queue
of the day and an edit of an open entry in that entry, composes the sections that drafted candidates change and writes
them as entries, applies approvals committed without a token for the instance's workflow, and tells each requirement's
history. It runs in the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `queue-index.schema.md`, `queue-rationale.schema.md`, `queue-decisions.schema.md` — the schemas of a queue's files, in
  MOD-documents' schema language.
- `queues.mjs` — reading queues and the state of each entry.
- `propose.mjs` — writing an entry into the person's open queue, saving an open entry in place, the sections that
  classified candidates change, and the writer of classified candidates.
- `accept.mjs` — accepting entries in their queue's order, and applying approvals without a token.
- `history.mjs` — the history of a requirement.
- `strategies.mjs` — the recipes, the precondition and the writer of `specStrategies`.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_prompted_source.py`, `tests/test_artifact_provenance.py`, `tests/test_derivation_context.py`, `tests/test_prompted_change_context.py`: their headers name this module; one of only the old writer is rewritten on `applyApproved`.

## Data

It keeps nothing. It owns the change queue; a queue is a folder `docs/spec-freigaben/<YYYY-MM-DD><letter>_<slug>/`,
the letter (`b`, `c`, …) distinguishing several queues of one day, absent for the first.

| File | Schema | Content |
|---|---|---|
| `index.md` | `queue-index` | the title line `# SPEC approvals — queue <folder date> · <title>`; free text: the decision taken and the impact analysis as a table of the names it changes or withdraws and what references them; the line `**Zieldatei aller Einträge:** ` with the target in backticks; and the entry table |
| `NN-<slug>.md` | — | an entry: the complete section as proposed, from its heading line to its end, nothing else; `NN` two digits |
| `NN-<slug>.begruendung.md` | `queue-rationale` | the title line `# <section>: <what changes>`, the paragraphs **The change.** and **Why.**, the impact list, and the origin — the source passage and version, a conversation in the prompt bar on the page it names, never a message
of it (`A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON`), or the issue —; for a drafted entry also the Agent M version, the participant, the model, the date and the correction rounds |
| `entscheidungen.md` | `queue-decisions` | the title line `# Decisions — queue <folder> <title>`, the line `Append-only.`, then one row per decision, appended, never changed |

The entry table of `index.md`, a register with exactly these columns:

```text
| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |
|---|---|---|---|---|
| 01 | `SPEC.md` | ## 7. Configuration and secrets | — | — |
```

`Anker` is the heading line the section starts with, verbatim; `bis (exklusiv)` an end heading where the section ends
before another heading than the next one of its level, `—` otherwise; `Commits` is `—`.

A row of `entscheidungen.md`, a register without a header row:

```text
| 2026-09-23 21:47 UTC | 1 | uebernommen | approval:spec-2026-09-23d_instanz-und-token-01-47a9e8a383b0.md |
```

The state of an entry, derived and never written: `open` — no approval record names its proposal and no decision row
names the commit that wrote it into the SPEC; `approved` — a record names the proposal's current blob and no decision row
names the record yet (the instance's workflow has still to write it); `in SPEC` — a decision row `uebernommen` names its
record, or names the commit that wrote it into the SPEC (`STATUS IS DERIVED FROM THE RECORDS`); `stale` — a record or the reviewer's view names a proposal
or SPEC section whose blob is no longer current; `waiting for its anchor` — its anchor is not in the target, and an
earlier entry of the queue creates it.

## Interfaces

- `Queue` — `{ folder: string, title: string, target: string, entries: Array<{ number: number, file: string,
  anchor: string, until: string | null, proposal: { path: string, blob: string }, rationale: string,
  record: string | null, decision: string | null, state: "open" | "approved" | "in SPEC" | "stale" |
  "waiting for its anchor", createdBy: number | null }> }`, where `createdBy` is the number of the entry whose proposal
  creates the anchor.
- `queues(snapshot: Snapshot) -> Promise<Queue[]>` — every queue of a snapshot with every entry and its state, newest
  first: the entries with their anchors from each queue's `index.md`, its decisions from `entscheidungen.md`, the records
  from `docs/approvals/`. Crosses the network through the snapshot, for the files it has not read yet; fails with the
  snapshot's errors — `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`.
- `openQueueOf(person: string, date: string, host: Host) -> Promise<string | null>` — the folder of the person's newest
  queue of that day that has no entry in SPEC yet, or `null` (`A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE`). The person
  of a queue is the author of the commit that created its index. Crosses the network; fails with the host's errors.
- `proposeSection(host: Host, change: { target: string, anchor: string, until: string | null, text: string,
  why: string, origin: string, person: string, openedBlob: string, openedHead: string, trailers?: string[] }) -> Promise<{ commit: string, queue: string,
  entry: number, alsoReplacing: Array<{ queue: string, entry: number }> } | { refused: "changed meanwhile", current:
  string } | { fallback: Array<{ url: string, path: string, text: string, differs: boolean }> }>` — writes one edited
  section as an entry, in one commit under the person's account: into the person's open queue of the day, or a new
  queue; a second edit of the same section in that queue replaces its entry instead of adding one. The impact list of
  every requirement the edit changes, withdraws or adds is computed and written with the rationale (`A REQUIREMENT IS NOT
  CHANGED WITHOUT AN IMPACT LIST`); a changed name is proposed as the old name withdrawn and the new one added (`A RENAMED
  REQUIREMENT IS WITHDRAWN AND ADDED`); the target file is not touched (`A SPEC EDIT IS SAVED AS A PROPOSAL`). Refuses
  when the section's blob on the default branch differs from `openedBlob`, returning the newer text so that the caller
  keeps the edit beside it (`A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE`, `A REFUSED SAVE KEEPS THE EDIT`).
  `alsoReplacing` names other open entries that replace the same section. `trailers` end the commit's message: a job's
  provenance lines when a person saves the draft of a change by prompt (UC-019 step 9), none for the person's own edit.
  Without a token on GitHub, or when GitHub refuses the commit for a missing write permission (`PermissionMissing`), it
  writes nothing and returns GitHub's pages for each file of the entry, each file's `differs` saying whether it exists
  on the default branch otherwise than at `openedHead`, the commit the edit was opened on (UC-018 4a, 6b); on GitLab
  without a token it refuses with `TokenRequired`, and a refused commit there throws `PermissionMissing`. Considers: called only on a person's click. Crosses the network. Errors:
  `Moved`, `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`, `TokenRequired`.
- `saveEntry(host: Host, edit: { queue: string, entry: number, text: string, why: string, person: string, openedBlob:
  string, openedHead: string }) -> Promise<{ commit: string } | { refused: "changed meanwhile", current: string } | { refused: "not open",
  state: string } | { fallback: Array<{ url: string, path: string, text: string, differs: boolean }> }>` — saves an
  edited entry in place, in its own queue, in one commit under the person's account: its proposal replaced by `text`, its
  rationale's impact list computed anew. No second queue is made, since the entry already is a proposal (UC-006 3a,
  UC-018 1a). Refuses when the proposal's blob on the default branch differs from `openedBlob`, returning the newer text
  (`A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE`, `A REFUSED SAVE KEEPS THE EDIT`), and when the entry is no longer
  open, naming its state. Without a token, as `proposeSection`. Considers: called only on a person's click. Crosses the
  network. Errors: those of `proposeSection`.
- `entrySections(spec: string, draft: unknown, classes: Classified[], source: string) -> Array<{ anchor: string, until:
  string | null, text: string }>` — the sections of `spec` that the draft's candidates change, each as the whole
  section's new text, composed by `classes`: a `new` candidate added to its section; a `change` in the section of the
  requirement it changes, under its name (`A CHANGE IS PROPOSED UNDER THE EXISTING NAME`); a `duplicate` as an added
  source of the existing requirement (`A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT`); a `conflict` only as the person
  resolved it, an undecided one not at all (`A CONFLICT IS DECIDED BY A PERSON`). Every requirement names `source`, the
  job's, with the passage it draws on, and, where its candidate points to a rule of another source, that source too.
  `draft` is a draft of `derive-requirements` or `change-requirements`, in the form its kind expects (MOD-job-catalogue).
  Every other byte of a section stays as it is. Pure. Throws `TwoChanges { requirement, candidates }` when two
  candidates change the requirement `requirement`, since one block would replace the other, and composes nothing.
- `entryView(queue: string, entry: number, snapshot: Snapshot) -> { current: { text: string, blob: string } | null,
  proposal: { text: string, blob: string }, difference: LineDiff, rationale: string, impact: Array<{ name: string,
  change: "changed" | "withdrawn" | "added", referencedBy: string[] }>, state: string, createdBy: number | null }` —
  what the reviewer sees: the section that holds now beside the proposal, their difference, the rationale and the impact
  list (`NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT`). `LineDiff` is the result of MOD-text-tools' `lineDiff`.
- `acceptEntries(host: Host, shown: Array<{ queue: string, entry: number, proposalBlob: string, sectionBlob: string }>,
  person: string, now: Date, sources: { links: Document, register: Document[] }) -> Promise<{ commit: string } | {
  refused: Array<{ queue: string, entry: number, reason: string }> }>` — accepts the entries shown, in one commit under the person's account: for each, in the order of its
  queue's index, its approval record, the target's section replaced by the proposal byte for byte, and its decision row
  (`A QUEUE IS ACCEPTED IN ITS ORDER`). An entry whose anchor another entry creates is accepted only together with or
  after that entry. If any entry's proposal or section no longer has the blob that was shown, nothing is written and every
  such entry is named (`A STALE APPROVAL IS NOT APPLIED`). Nothing is written either while a requirement of a proposal
  names no source the product links: the entry is named with the requirement, from MOD-source-register's
  `sourceFindings` over the product's links and the instance's register in `sources` (`A REQUIREMENT HAS A REGISTERED
  SOURCE`). Considers: called only on a person's click; without a token,
  the record alone is committed through MOD-approvals' GitHub page and the instance's workflow writes the rest with
  `applyApproved`. Crosses the network. Errors: `Moved`, `TokenRefused`, `PermissionMissing`, `RateLimited`,
  `Unreachable`.
- `applyApproved(snapshot: Snapshot, now: Date) -> { files: Record<string, string>, applied: string[],
  refused: Array<{ record: string, reason: string }> }` — for every record of kind `spec` that no decision row names yet,
  in the order of its queue's index: checks that the proposal and the section still have the blobs the record names and
  that the record's anchor is the queue's anchor for that entry, and that every requirement of the proposal names a source
  the instance links in its `docs/sources.md`, from its register in `docs/sources/` (`A REQUIREMENT HAS A REGISTERED
  SOURCE`), and returns the target with the section replaced and the
  decision row appended. A record that fails a check changes nothing and is named. It writes nothing itself: the
  instance's workflow commits `files` (`WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE`).
- `requirementHistory(name: string, host: Host) -> Promise<Array<{ date: string, person: string, commit: string,
  record: string | null, before: string | null, after: string | null }>>` — every accepted change to the text of a
  requirement, oldest first: the date and person of the accepting commit, its record, and the requirement's text before
  and after; a section written before any record shows the commit that introduced it and `record: null` (`A REQUIREMENT
  SHOWS ITS HISTORY`). Crosses the network; fails with the host's errors.
- `specStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `spec-with-queues` — every requirement of the SPEC and of every open entry of every queue, each with its
    section and state (`DERIVATION SEES THE EXISTING REQUIREMENTS`); its part carries each of them as an artifact, keyed
    by its name and its rule, against which `candidate-classes` classifies a draft;
  - recipe `whole-spec` — the SPEC as it stands, as one part;
  - recipe `named-requirements` — the requirements the job's parameters name, each with its whole section; each part
    carries its requirement as an artifact, as `spec-with-queues` does — its name as the identifier, its name and its
    rule as the key — so that the job runner counts it (`NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY`);
  - recipe `chosen-requirements` — the requirements the person chose; without a choice, every requirement of the SPEC
    that no use case realises;
  - precondition `person-source` — an error finding under `THE PERSON WHO PROMPTS IS A SOURCE` when the job's parameter
    `source` names no source, naming the steps that are missing: registering the person as a source and linking that
    source to the product (UC-019 4b); none otherwise, so that a change of requirements by prompt starts only with the
    person's own source, wherever it runs;
  - writer `queue-entries` — writes the candidates by the result's classes, as the person left them, as a new queue of
    the SPEC each belongs in, where it stands being what it constrains (MOD-spec-document): a candidate classed as
    constraining the development process goes to a queue of the instance's SPEC, its class decided against that SPEC and
    its open queues as for the product's, every other candidate to a queue of the product's SPEC — one queue, and one
    commit, for each of the two that gets one. Within a queue, one entry per section the candidates touch, as
    `entrySections` composes it with the job's `source`. A candidate that points to a source the product does not link
    (`linkedVersion` gives none) is not written, and the outcome's notes name it with that source, as the hint to link it
    first (UC-005 5a). Each rationale names its origin and the impact list; the commit carries the provenance lines.

`Host` and `Snapshot` are MOD-repository-hosts'.

## Files

- Reads `docs/spec-freigaben/*/` — `index.md`, entries, rationales, `entscheidungen.md` —, `docs/approvals/spec-*.md`,
  the target of each queue (`SPEC.md`), and every artifact the trace graph needs for an impact list.
- Writes, in one commit each time: a new queue folder or a new entry with its rationale and index row; on acceptance,
  `docs/approvals/spec-<queue>-<NN>-<blob12>.md`, the target's section and a row of `entscheidungen.md`.

## Uses

- MOD-approvals.approvalSchema — the record of a SPEC entry is an approval record.
- MOD-artifact-edits.fallbackEditLinks — GitHub's pages for the files of an entry without a token.
- MOD-repository-hosts.Host, Snapshot, readSnapshot, readHistory, commitFiles — reading queues and the head, the author
  of a queue and the history of a requirement, and the one commit of a proposal or an acceptance;
  MOD-repository-hosts.readFileAt — `SPEC.md` at every commit that changed it, for the history of a requirement, in
  batches.
- MOD-documents.Schema, Document, loadSchema, readDocument, writeDocument, readRegister, appendSection — the queue's files
  by their schemas, the links and register handed in, and the appended decision row; MOD-documents.classifyCandidates —
  the classes of process candidates against the instance's SPEC; the type MOD-documents.Classified — the classes by which
  `entrySections` composes a section.
- MOD-spec-document.parseSpec, sectionText, replaceSection, requirementNamesIn, renamedRequirements — the requirements,
  a section's exact bytes and its replacement, the names an edit touches.
- MOD-trace-graph.traceGraph, requirementImpact, coverageGaps — impact lists, and the requirements no use case realises, in a job;
  MOD-trace-graph.storedGraph — the impact list of an entry on a page (entryView, proposeSection, saveEntry), from the graph stored for the commit.
- MOD-source-register.sourceSchemas, sourceFindings, linkedVersion — the instance's links and register as the workflow
  reads them, the requirements that name no linked source, and a candidate's source that the product does not link.
- MOD-text-tools.Finding, finding, blobSha, lineDiff — findings, blob SHAs and the difference shown.
- MOD-job-runner.Strategies, JobContext, Part, JobResult, provenanceLines — the form of the strategies and the
  provenance of a drafted queue's commit.
