---
id: MOD-artifact-edits
title: Saving edited and drafted files on the text they were opened on
folder: src/artifact-edits/
realises:
follows:
  - ARC-041
uses:
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.webLinks
  - MOD-documents.readDocument
  - MOD-identifiers.kindOfIdentifier
  - MOD-identifiers.identifiersIn
  - MOD-identifiers.nextIdentifier
  - MOD-spec-document.specSkeleton
  - MOD-spec-document.parseSpec
  - MOD-group-document.parseGroupFile
  - MOD-group-document.hierarchy
  - MOD-trace-graph.traceGraph
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-text-tools.blobSha
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
  - MOD-job-runner.JobResult
  - MOD-job-runner.provenanceLines
provides:
  - saveFile
  - keptIdentifier
  - saveGroupFile
  - fallbackEditLinks
  - reviewLayoutCommit
  - editStrategies
---
# MOD-artifact-edits Saving edited and drafted files on the text they were opened on

## Responsibility

It belongs to Specification and design (ARC-041). It writes every file a person edits on a page — a reviewed file (a
use case, an architecture decision, a module file, a test file), a group file, a register (the participants, a
product's source links, the resources, a product's settings, collaborators and declaration, the process models) and the
audit export —, each only on the blob it was opened on, so that nobody overwrites what changed meanwhile; a SPEC change
is written by MOD-spec-changes, and the plan, the backlog and the sprints by MOD-work-plans. It writes drafted use cases
and architecture files as open files (`A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN`), and restores the identifier of
a drafted change before it is edited. It also writes the missing review layout into a newly added product (`ADDING A
PRODUCT CREATES ITS LAYOUT`). It runs in the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `save.mjs` — saving one file on its opened blob, keeping its identifier, and a group file's single places.
- `fallback.mjs` — GitHub's editor, new-file and delete pages without a token.
- `layout.mjs` — the review layout of a new product.
- `strategies.mjs` — the recipe, check and writer of `editStrategies`.

## Data

It keeps nothing and owns no format of its own: a saved file keeps the format of its kind — use cases, decisions and
module files as MOD-documents' schemas define them, test files as MOD-test-document reads them, group files as
MOD-group-document defines them, the registers and the audit export in their owners' formats, which the caller writes.

The review layout it writes into a product, skipping whatever exists:

| Path | Content |
|---|---|
| `docs/use-cases/README.md`, `docs/architecture/README.md`, `docs/approvals/README.md`, `docs/spec-freigaben/README.md` | one short paragraph each, saying what the folder holds and that its status is derived from the approval records (`ONE REVIEW LAYOUT FOR EVERY PRODUCT`) |
| `SPEC.md` | the skeleton MOD-spec-document gives a new product |
| `CHANGELOG.md` | its title and nothing else |

## Interfaces

- `saveFile(host: Host, edit: Edit | Edit[]) ->
  Promise<{ commit: string, blob: string | string[] } | { refused: "changed meanwhile", current: string | null, currentBlob: string |
  null } | { refused: "identifier changed", openedId: string, nowId: string | null } | { refused: "not one place", items:
  string[] }>`, `Edit` being `{ path: string, text: string, openedBlob: string | null, openedId: string | null, trailers?:
  string[] }` — saves one file a person edited on a page, in one commit on the default branch of the repository that
  holds it, only if the file's blob there is still `openedBlob`; `null` stands for a file that did not exist when it was
  opened, which is created only while it still does not exist (`A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE`). The
  commit is made with the token the host was connected with, so it is under the person's account; its message names no
  one, and ends with `trailers` — a job's provenance lines when a person saves the draft of a change by prompt (UC-019
  step 9), none for the person's own edit. It serves every such file: a reviewed file — a use case, an architecture
  decision, a module file, a test file —; a group file; the instance's `docs/participants.md`, `docs/resources.md`,
  `docs/conversation-recording.md` and process models under `docs/process-models/`; a product's `docs/sources.md`, `docs/resources.md`, `docs/settings.md`,
  `docs/collaborators.md` and `docs/process.md`; and the audit export under `docs/audits/`. On refusal it writes nothing
  and returns the newer text, so that the caller keeps the edit beside it (`A REFUSED SAVE KEEPS THE EDIT`); a file
  whose identifier differs from the one it was opened with is refused (`AN EDITED FILE KEEPS ITS IDENTIFIER`); a group
  file is refused while an item stands in more than one place (`AN ITEM HAS ONE PLACE IN ITS HIERARCHY`). A saved
  reviewed file counts as open, or as changed since acceptance, because no record names its new blob. Given several
  edits — the files one instruction changed by prompt (UC-019 8b) —, it saves them in one commit, each only on its own
  `openedBlob`, or none of them, returning the refusal of the first one refused, and else each file's new blob in the
  order of the edits. Considers: called
  only on a person's click; the caller checks a register's text with its owner's schema and findings first, since this
  module judges only identifiers and a group file's places; a SPEC section is never saved here, but by
  MOD-spec-changes. Crosses the network. Errors: `Moved`, `SecretRefused` (the text holds a configured secret: nothing
  is written), `TokenRefused`, `PermissionMissing` (the caller offers the GitHub route, where the commit becomes a pull
  request), `RateLimited`, `Unreachable`, `TokenRequired` for a GitLab product without a token.
- `keptIdentifier(text: string, openedId: string) -> string` — the text with its front matter's `id` set back to
  `openedId`, every other byte unchanged: a drafted change whose loop left a changed identifier opens in the editor with
  the identifier it was opened with (UC-019 7a). A text whose `id` is `openedId` comes back unchanged.
- `saveGroupFile(host: Host, edit: { kind: "requirements" | "use-cases" | "architecture" | "modules" | "tests",
  text: string, openedBlob: string | null }) -> Promise<{ commit: string, blob: string } | { refused:
  "changed meanwhile", current: string | null, currentBlob: string | null } | { refused: "not one place", items:
  string[] }>` — `saveFile` for the group file `docs/groups/<kind>.md`, named by its kind: that file and nothing else,
  committed directly to the default branch (`A REGROUPING IS COMMITTED DIRECTLY`, `REGROUPING LEAVES THE GROUPED FILE
  UNCHANGED`). Crosses the network; the errors of `saveFile`.
- `fallbackEditLinks(files: Array<{ path: string, text: string | null, existing: boolean }>, snapshot: Snapshot) ->
  Array<{ url: string, path: string, text: string | null, differs: boolean }> | { refused: "gitlab" }` — without a token, one
  GitHub page per file: the page that deletes a file whose text is `null` (a rejection, MOD-approvals' `commitRejection`),
  else the editor for an existing file, the new-file page for a new one; the link carries the path
  only and the text goes to the clipboard, never into the link (`NO TEXT TRAVELS IN A URL`, `WITHOUT A TOKEN, GITHUB'S
  WEB INTERFACE IS THE FALLBACK`). `differs` says that the file on the default branch is no longer what the edit started
  from. A GitLab product has no fallback (`A GITLAB PRODUCT IS WRITTEN WITH A TOKEN`).
- `reviewLayoutCommit(host: Host) -> Promise<{ commit: { sha: string, url: string }, written: string[] } | { complete:
  true }>` — writes the missing parts of the review layout into the product's default branch, which `repositoryInfo`
  names, in one commit without a pull request — into an empty repository, in the two commits `commitFiles` makes there —,
  and returns the commit `commitFiles` made — its identifier as `sha`, its
  address, which the page links it by, as `url` —; nothing when the layout is complete. The commit is made with the token the host was connected with,
  so it is under the person's account; its message names no one. Crosses the network. Errors: `Moved`, `TokenRefused`,
  `PermissionMissing` (a public repository the token does not reach yet: nothing was written), `NotFound`,
  `RateLimited`, `Unreachable`.
- `editStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `items-of-kind` — the title and identifier of every item of the kind the job's parameters name, with the
    whole text of each requirement when the kind is requirements, and the current group file;
  - check `identifier-kept` — an error finding when a drafted change of an existing file carries another identifier than
    the file it changes; the finding names the identifier to keep;
  - writer `open-files` — commits drafted use cases or architecture files, in one commit on the default branch, as open
    files: a change to an existing identifier into that file, a new one under the next free identifier of its kind,
    never one the version history holds (`THE NAME IS THE ID AND IT SURVIVES`); a drafted module whose identifier the
    history holds is refused and named. A drafted file that the result's classes make a change or a duplicate of an
    existing one is written as a change to that file, not under a new identifier (UC-007 6a). A name a drafted use case
    realises that still matches no requirement after the loop's last round is removed from it, and the outcome's notes
    name the use case and the name; a use case that then realises nothing is written too, and the notes name it (UC-007
    4a, 4b). While the result's `stepFindings` hold a finding of kind `error` under the rule
    `A REUSE DECISION RECORDS ITS DUE DILIGENCE` whose artifact is a drafted decision's path — the mark MOD-reuse-facts'
    step `due-diligence` leaves on a decision whose registry could not be read, naming the registry (UC-022 7b) —, it
    writes nothing and throws `DueDiligenceMissing { decisions }`, naming each such decision and its registry, since the
    architecture is written as a whole and its other files may name the decision; a candidate the registry does not know
    is only a `warning` under `DUE DILIGENCE IS FETCHED, NOT RECALLED` and does not stop the write. The commit carries
    the provenance lines; the files name no participant, model or version
    (`AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT`).

`Host` and `Snapshot` are MOD-repository-hosts'.

## Files

- Reads the file being saved, `docs/groups/*.md`, the folders of the review layout, and the history of
  `docs/use-cases/` and `docs/architecture/` for the identifiers ever used.
- Writes the saved file — a reviewed file, a group file, a register or the audit export, in the instance or a product —;
  the review layout's files; drafted use cases under `docs/use-cases/` and drafted architecture files under
  `docs/architecture/`.

## Uses

- MOD-repository-hosts.Host, Snapshot, readSnapshot, readHistory, commitFiles, webLinks — the head before a save, the
  paths the history holds, the commit on the opened head, GitHub's pages.
- MOD-documents.readDocument — the identifier a saved or drafted text declares.
- MOD-identifiers.kindOfIdentifier, identifiersIn, nextIdentifier — the kind of a file, the identifiers in use, the next
  free one.
- MOD-spec-document.specSkeleton, parseSpec — the SPEC of a new product; the text of each requirement for
  `items-of-kind`.
- MOD-group-document.parseGroupFile, hierarchy — that every item has one place before a group file is saved.
- MOD-trace-graph.traceGraph — the items of a kind with their identifiers and titles, for `items-of-kind`, as the check
  `group-rules` reads them.
- MOD-text-tools.Finding, finding, blobSha — the finding of `identifier-kept`, and the blob of a text.
- MOD-job-runner.Strategies, JobContext, Part, JobResult, provenanceLines — the form of the strategies and the
  provenance of a drafted commit.
