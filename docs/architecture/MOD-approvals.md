---
id: MOD-approvals
title: Approval records and the status of reviewed files
folder: src/approvals/
realises:
follows:
  - ARC-041
uses:
  - MOD-artifact-edits.fallbackEditLinks
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.webLinks
  - MOD-documents.Schema
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.artifactSchemas
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-text-tools.blobSha
  - MOD-identifiers.kindOfIdentifier
  - MOD-spec-document.parseSpec
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
provides:
  - approvalSchema
  - statusOf
  - statuses
  - removedFiles
  - lastAcceptedText
  - acceptShown
  - acceptanceBlockers
  - fallbackAcceptLink
  - rejectShown
  - commitRejection
  - approvalStrategies
---
# MOD-approvals Approval records and the status of reviewed files

## Responsibility

It belongs to Specification and design (ARC-041). It keeps every reviewed file — use case, architecture decision,
module file, SPEC change entry, release test report — open until an approval record names its exact text, and derives
every status from those records alone (`STATUS IS DERIVED FROM THE RECORDS`). It composes an acceptance as one commit
under the accepting person's account (`ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON`), composes a rejection as one
commit under the rejecting person's account with the reason in its message (`A REJECTION REMOVES THE PROPOSAL`), and offers the job kinds the
recipes of use cases and of the architecture and the preconditions that a draft rests on accepted artifacts. It runs in
the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `approval-record.schema.md` — the schema of the approval record, in MOD-documents' schema language.
- `status.mjs` — statuses, the removed files and the last accepted text.
- `accept.mjs` — composing an acceptance commit, the blockers, GitHub's prefilled page.
- `reject.mjs` — rejecting a reviewed file that was shown, and the one commit of every rejection, or GitHub's pages for it.
- `strategies.mjs` — the recipes and preconditions of `approvalStrategies`.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_approval_records.py`: rewritten on this module, or removed with the old core.

## Data

It keeps nothing. It owns one format, the approval record; every record is evidence, written once and never changed
(`A RECORD IS EVIDENCE, NOT A PROPOSAL`).

**Schema `approval-record`** (`approval-record.schema.md`):

| Part of the schema | Value |
|---|---|
| shape | fields — one `key: value` line each, no front matter fences, no sections |
| path | `docs/approvals/<ID>-<blob12>.md`; `<ID>` the identifier of what is accepted — `UC-<nnn>`, `ARC-<nnn>`, `MOD-<slug>`, `spec-<queue>-<NN>` for an entry of a change queue, `release-v<YYYY.MINOR.PATCH>` for a release test report —; `<blob12>` the first twelve hex digits of `blob` |
| `kind` | one of `use-case`, `architecture-decision`, `module`, `spec`, `release-report`; required |
| `file` | the path of the accepted file; required for every kind except `spec` |
| `blob` | the 40-hex git blob SHA of the text shown; for `spec`, of the proposal; for a removed decision or module file, the blob of the empty text (`e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`), which is what the default branch holds of it; required |
| `queue`, `entry`, `proposal`, `target`, `anchor`, `section` | required for `spec`: the queue's folder, the entry's two-digit number, the proposal's path, the file it changes, the heading its section starts with, the blob SHA of the section shown beside the proposal |
| `limitation` | for `release-report`: one line per failing test or worse rate, `<TST-<nnn> or rate> — <reason>`; zero or more |

Examples:

```text
kind: use-case
file: docs/use-cases/UC-008-review-and-accept-a-use-case.md
blob: 2699e35d0c413d3a814286dec77c49ad7598b4b1
```

```text
kind: spec
queue: docs/spec-freigaben/2026-09-23d_instanz-und-token
entry: 01
proposal: docs/spec-freigaben/2026-09-23d_instanz-und-token/01-konfiguration-token.md
blob: 47a9e8a383b0f1db6e98760b9a1f1325d8303844
target: SPEC.md
anchor: ## 7. Configuration and secrets
section: f8fbf7328c329ac0d2fc73e3901f1db1027a0f61
```

The status of a reviewed file is one of `open` (no record names any text of its identifier), `accepted` (a record names
its current blob), `changed` (a record names an earlier text of its identifier, none the current one). It is computed,
never written. A decision or module file that a record names and the snapshot no longer holds is not a reviewed file of the snapshot, so it has no status; `removedFiles` names it.

## Interfaces

- `approvalSchema: Schema` — the approval record's schema, for MOD-documents and for the modules that read records
  (MOD-spec-changes, MOD-release-evidence).
- `statusOf(path: string, blob: string, snapshot: Snapshot) -> "open" | "accepted" | "changed"` — the status of one
  reviewed file from the records in the same snapshot, matched by the identifier in the file name, so a renamed file
  keeps its status. Considers: the blob is the file's current blob in that snapshot; a record whose `kind` does not fit
  the file's folder is not counted. Errors: `NotReviewed` for a path that is no reviewed file.
- `statuses(snapshot: Snapshot) -> Map<string, { id: string, kind: string, status: "open" | "accepted" | "changed" }>` —
  the status of every reviewed file of a snapshot, keyed by path; computed in one pass over `docs/approvals/`.
- `removedFiles(snapshot: Snapshot) -> Array<{ id: string, kind: "architecture-decision" | "module", path: string, lastBlob: string }>` — every
  decision or module file that a record names and of whose identifier the snapshot holds no file, and whose removal no record accepts (no record of
  that identifier names the empty text's blob): `path` and `lastBlob` are those of the most recent record of the identifier. It is computed in the
  same pass over `docs/approvals/` as `statuses`, in the order of the identifiers.
- `lastAcceptedText(id: string, host: Host) -> Promise<{ text: string, blob: string, path: string } | null>` — the text
  named by the most recent approval record of an identifier, also when the file has been renamed since; `null` when no
  record names it. A record whose content names another blob than its name, or a file of another identifier, counts as
  no record (`AN APPROVAL NAMES THE EXACT TEXT`). Considers: "most recent" is the order of the commits that added the records. Crosses the network:
  reads the history of the records and of the file through the host; fails with the host's errors (`TokenRefused`,
  `RateLimited`, `NotFound`, `Unreachable`).
- `acceptShown(host: Host, shown: Array<{ path: string, blob: string }>, person: string) -> Promise<{ commit: string,
  recorded: string[], leftOut: Array<{ path: string, reason: "changed since shown" | "rests on what is not accepted",
  names: string[] }> }>` — accepts every file that was shown, in one commit made with the person's token on the head it
  read: one record per file, each naming the blob that was shown (`AN APPROVAL NAMES THE EXACT TEXT`, `SEVERAL FILES ARE
  ACCEPTED IN ONE CLICK`). A shown file with the empty text's blob is a removal: it is recorded, naming the empty text's blob, while the head holds no file of
  its identifier, and left out as "changed since shown" when the head holds one. A file whose blob on the head differs from the one shown, or that rests on a requirement or use
  case that is not accepted, gets no record and is named with the reason. Considers: called only as the direct result of
  a person's click (`THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK`); entries of change queues are accepted by
  MOD-spec-changes, not here. Crosses the network. Errors: `Moved` (the branch moved after it was read — nothing is
  written, the caller shows the newer state), `TokenRefused`, `PermissionMissing` (the caller offers the GitHub route,
  where the commit becomes a pull request), `RateLimited`, `Unreachable`; `NothingToAccept` when every file was left out.
- `acceptanceBlockers(path: string, snapshot: Snapshot) -> string[]` — the requirements and use cases a reviewed file
  names (a use case's `realises`, a decision's `forced_by`) that are not accepted: a requirement that is not in the SPEC
  but only in an open queue, a use case without a record naming its current text. Empty when the file rests only on
  accepted artifacts (`ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS`).
- `fallbackAcceptLink(record: { path: string, text: string }, snapshot: Snapshot) -> { url: string, path: string,
  text: string } | { refused: "gitlab" }` — without a token, GitHub's new-file page prefilled with the record's path and
  the record itself — a link carries nothing else, never the reviewed text (`NO TEXT TRAVELS IN A URL`, `WITHOUT A
  TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK`); the path and the record are returned as well, for a copy button when
  the prefill does not arrive. For a product on a GitLab server it refuses (`A GITLAB PRODUCT IS WRITTEN WITH A TOKEN`).
- `rejectShown(host: Host, shown: { path: string, blob: string }, person: string, reason: string) -> Promise<{ commit: string } |
  { fallback: Array<{ url: string, path: string, text: string | null, differs: boolean }> }>` — rejects the use case,
  architecture decision or module file that was shown (`A PROPOSAL IS REJECTED WITH A REASON`, `A REJECTION REMOVES THE
  PROPOSAL`): through `commitRejection`, the file's text becomes the one `lastAcceptedText` gives for its identifier, at the
  path the file has now, or the file is deleted when no record names one. No record is written. Throws, before anything is
  written: a TypeError for a missing or blank reason, and for a path that is no use case, decision or module file;
  `ChangedSinceShown { path }` when the head no longer holds the blob shown (`A STALE APPROVAL IS NOT APPLIED`);
  `NothingToReject { path }` when the blob shown is the accepted text. Considers: called only as the direct result of a
  person's click. Crosses the network; fails as `commitRejection`, and with the errors of `lastAcceptedText`.
- `commitRejection(host: Host, head: Snapshot, rejection: { id: string, files: Array<{ path: string, text: string } | {
  path: string, delete: true }> }, person: string, reason: string) -> Promise<{ commit: string } | { fallback: Array<{ url:
  string, path: string, text: string | null, differs: boolean }> }>` — the files of a rejection of `id` in one commit on
  the default branch, on the head that was read, made with the person's token; its message names `id`, the person and the
  reason. Without a token (`RepositoryInfo.canWrite` false), or when GitHub refuses the commit with `PermissionMissing`,
  nothing is written and GitHub's pages for the same files come back — MOD-artifact-edits' `fallbackEditLinks`, a deleted
  file as its text `null` (`WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK`); GitHub's pages change one file each,
  so the person commits one page after another. Used by `rejectShown` and by MOD-spec-changes' `rejectEntry`, so that
  every rejection is committed and fallen back from in one place. Errors: a TypeError for a missing or blank reason and
  `TokenRequired` for a product on a GitLab server without a token, before anything is written; `Moved`, `TokenRefused`,
  `PermissionMissing` on GitLab, `RateLimited`, `Unreachable`.
- `approvalStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `use-cases` — every use case of the product, each with its status, as one part per file, which carries its
    use case as an artifact keyed by the key of its format;
  - recipe `accepted-use-cases` — every use case whose current text a record names, one part per file;
  - recipe `use-case-with-neighbours` — the use case named in the job's parameters, every requirement it realises with
    its text from the SPEC, and every other use case (`A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS`); the part of
    a use case carries it as an artifact as `use-cases` does, and the part of a requirement carries it as an artifact
    with its name as the identifier and its name and its rule as the key, so that the job runner counts them (`NO USE
    CASE IS LEFT OUT OF A PROMPT SILENTLY`);
  - recipe `whole-architecture` — every architecture decision and module file, one part per file, which carries its
    file as an artifact keyed by the key of its format;
  - precondition `rests-on-accepted` — an error finding naming every requirement or use case the job's selection names
    that is not accepted, and, when the parameter `architecture` is true, every architecture decision and module file
    that is not accepted; the requirements and use cases are those of the parameters `requirements` and `useCases`
    (`NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED`, `ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES`);
  - precondition `architecture-ready` — an error finding when a use case is open or changed (naming each) or when the
    product already has an architecture (pointing to UC-023); a warning finding naming every open SPEC change — an
    entry that neither an approval record nor a decision row naming the commit that wrote it into the SPEC decides
    (`THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE`, `STATUS IS DERIVED FROM THE RECORDS`).

`Host` and `Snapshot` are MOD-repository-hosts'.

## Files

- Reads `docs/approvals/*.md` and every reviewed file — `docs/use-cases/UC-*.md`, `docs/architecture/ARC-*.md`,
  `docs/architecture/MOD-*.md`, `docs/tests/releases/v*.md` — and `SPEC.md` for the requirements a file names.
- Writes `docs/approvals/<ID>-<blob12>.md`, only by adding a file, never by changing or deleting one.
- On a rejection, writes the rejected use case, decision or module file back to its last accepted text, or deletes it;
  and commits the files of a SPEC change entry's rejection that MOD-spec-changes hands it.

## Uses

- MOD-repository-hosts.Host, Snapshot, readSnapshot, readHistory — the files of a commit, the head before a commit, the
  order of records and an earlier text of a file.
- MOD-repository-hosts.commitFiles — the acceptance commit and the rejection commit on an expected head.
- MOD-artifact-edits.fallbackEditLinks — GitHub's pages for the files of a rejection without a token.
- MOD-repository-hosts.webLinks — GitHub's new-file page without a token.
- MOD-documents.Schema, loadSchema, readDocument, writeDocument — reading and writing records by their schema, and reading the
  names a use case or decision declares; MOD-documents.artifactSchemas — the key of each format, for the artifacts a
  recipe's part carries.
- MOD-text-tools.Finding, finding — the findings of the preconditions.
- MOD-text-tools.blobSha — the blob SHA of a text that was shown, and of the empty text of a removal.
- MOD-identifiers.kindOfIdentifier — the kind of a reviewed file from its identifier.
- MOD-spec-document.parseSpec — which requirements are in the SPEC, and their texts for the recipes.
- MOD-job-runner.Strategies, JobContext, Part — the form in which recipes and preconditions are offered.
