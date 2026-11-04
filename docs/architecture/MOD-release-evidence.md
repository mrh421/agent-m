---
id: MOD-release-evidence
title: Versions, release candidates, the release test report, the release and its audit
folder: src/release-evidence/
realises:
follows:
  - ARC-043
uses:
  - MOD-result-records.resultSchema
  - MOD-result-records.resultsAt
  - MOD-result-records.flakyTests
  - MOD-result-records.rateComparison
  - MOD-test-schedule.scheduleSchema
  - MOD-approvals.approvalSchema
  - MOD-approvals.statusOf
  - MOD-runtimes.queueJob
  - MOD-job-ledger.listJobs
  - MOD-job-ledger.recordsNewestFirst
  - MOD-job-ledger.JobRecord
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.listTags
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.createTag
  - MOD-documents.Document
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-spec-document.parseSpec
  - MOD-test-document.testDeclarations
  - MOD-trace-graph.storedGraph
  - MOD-trace-graph.tracesTo
  - MOD-source-register.sourceSchemas
  - MOD-source-register.linkedVersion
  - MOD-text-tools.blobSha
provides:
  - nextVersion
  - startReleaseCandidate
  - releaseReport
  - acceptAndRelease
  - reportsAwaitingAcceptance
  - auditRows
  - auditDocument
---
# MOD-release-evidence Versions, release candidates, the release test report, the release and its audit

## Responsibility

It belongs to Tests and releases (ARC-043). It gives each product its own calendar version line (`CALENDAR VERSIONS`,
`EVERY PRODUCT HAS ITS OWN VERSION LINE`), marks a release candidate and starts the complete run on it (`A RELEASE RUNS
EVERY TEST AT EVERY LEVEL`), composes the release test report from the result records, tells whether a report waits for
that acceptance (`A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE`), and releases when a person accepts the report: the
report, its approval record with every known limitation and the changelog entry in one commit, then the tag on the
tested commit (`THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON`, `ACCEPTING THE RELEASE TEST REPORT RELEASES`, `A RED
RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED`, `A RELEASE IS TAGGED AND LOGGED`). It derives the audit of a
release and its export (`THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE`). A released version is never re-tagged
(`A VERSION IS NOT REWRITTEN`). It runs in the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `version.mjs` — the next version and the tags of a product's line.
- `candidate.mjs` — the release candidate and its complete run.
- `report.mjs` — the release test report, whether one waits for acceptance, and releasing on its acceptance.
- `audit.mjs` — the audit rows, their summary and the export.

## Data

It keeps nothing. It owns three formats.

**The release test report**, `docs/tests/releases/v<YYYY.MINOR.PATCH>.md` — a reviewed file, accepted through an approval
record of kind `release-report`:

| Part | Content |
|---|---|
| front matter | `version`, `candidate` (the tag `v<version>-rc.<N>`), `commit` (the tested commit), `date` |
| `## Limitations` | first: every failing test and every rate worse than the last release's, each with the requirements it guards; empty when the run is green |
| `## Levels` | per level: passed, failed, flaky, not run |
| `## Tests` | every test: identifier, level, outcome or rate, the identifiers it guards |
| `## Requirements` | every requirement valid at the commit with the tests that guard it, by level — the evidence per requirement |
| `## Changelog entry` | the entry the person chose at *Start release candidate*, as it will stand in `CHANGELOG.md` |

**The changelog entry**, appended to `CHANGELOG.md`: a heading `## v<YYYY.MINOR.PATCH> — <YYYY-MM-DD>`, the entry's text
as the report holds it, and, for a release accepted with limitations, the list `Known limitations:` with each failing
test or worse rate and its reason.

**The audit document**, `docs/audits/<tag>.md` when a person commits it: the release tag and its commit SHA; the summary;
one row per requirement valid at the release — its name, what it constrains, its sources with authority, version and the
hashes of the version, the tests that guard it by level with their outcome or rate — a rate with the last release's rate
and whether it passed — and their counter-proof, for a process requirement the gate records and artifacts it added and
each of its gates no record holds, and the acceptance of the report — who, when and the blob SHA of the
accepted text —; the blob SHAs of the report and of the approval records, so that every statement can be checked against
the repository without Agent M.

Tags of a product's line: `v<YYYY.MINOR.PATCH>` for a release, `v<YYYY.MINOR.PATCH>-rc.<N>` for its candidates.

## Interfaces

- `nextVersion(tags: string[], step: "minor" | "patch", today: string) -> string` — the next version of the product's own
  line: a minor step by default; in a new calendar year `YYYY.1.0`. Considers: tags of other products are never given.
- `startReleaseCandidate(host: Host, version: string, commit: string, changelog: string, person: string) -> Promise<{
  candidate: string, run: string }>` — tags the commit `v<version>-rc.<N>`, the next free `N`, and queues the complete
  run on it — every test at every level, model-dependent tests their fixed number of times, user-level tests as a
  checklist for the people assigned to them — as a job of kind `run-tests` through MOD-runtimes, whose parameters name
  the candidate — its version and tag — and keep the changelog entry the person chose, so that the candidate carries it
  to its report. Considers: release tests are run by a participant other than the one that implemented what they test;
  if only the implementer can run them, it says so (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`). Crosses the
  network. Errors: `TagExists`, `NoRunner` (no participant can run a level, named), `TokenRefused`, `PermissionMissing`,
  `RateLimited`, `Unreachable`.
- `releaseReport(at: Snapshot, results: Snapshot, candidate: { version: string, tag: string, commit: string, changelog:
  string }) -> { text: string, complete: boolean, failing: string[], worse: string[] }` — the release test report of a
  finished complete run, its `## Changelog entry` the one the candidate's run keeps among its parameters; `complete` is
  false while any test has not run on the candidate's commit, and then no tag can be set.
- `acceptAndRelease(host: Host, report: { path: string, blob: string }, decision: { limitations: Record<string, string>
  }, person: string, today: string) -> Promise<{ commit: string, tag: string }>` — on the person's one click, on the
  release panel or in the review list alike: commits the report, its approval record naming the report's blob and every
  limitation, and the changelog entry the report holds — the person is not asked for it again — together; then sets the
  tag `v<version>` on the tested commit, not on a later one. It refuses while a failing test or a worse rate has no
  recorded reason, while the report is incomplete, and when the tag exists — an existing tag is never moved. Crosses the
  network. Errors: `LimitationMissing` (naming the tests and rates), `Incomplete`, `TagExists`, `Moved`, `TokenRefused`,
  `PermissionMissing`, `RateLimited`, `Unreachable`.
- `reportsAwaitingAcceptance(host: Host, snapshot: Snapshot) -> Promise<{ version: string, candidate: string, record:
  string, blob: string } | null>` — the release test report that waits for a person's acceptance in one repository, if
  one does: that of the newest release candidate — the newest tag `v<version>-rc.<N>` — whose version has neither its
  release tag `v<version>` nor its report `docs/tests/releases/v<version>.md`, which `acceptAndRelease` writes only
  together with the report's approval record, once that candidate's complete run — the job of kind `run-tests` that
  `startReleaseCandidate` queued — has ended as done. It reads the tags once. Only while such a candidate is pending
  does it read job records: newest first, through MOD-job-ledger's `recordsNewestFirst`, and only up to the first run of
  a release candidate it meets: that candidate's run or, when that run was never recorded, an earlier candidate's — only
  for a first candidate whose run was never recorded does it read every record. `candidate` is the candidate's tag,
  `record` the path of its run's record and `blob` its blob, which no longer changes once the job has ended. Considers:
  the report itself is composed on the release panel by `releaseReport`; a candidate whose user-level tests are still
  being entered waits all the same, and the panel names what is missing. Crosses the network: the tags through the host,
  the records through the snapshot; fails with their errors — `TokenRefused`, `PermissionMissing`, `RateLimited`,
  `Unreachable` —, and with `NotSupported` through a host that does no server operations, such as a local clone.
- `auditRows(at: Snapshot, results: Snapshot, head: Snapshot, release: { tag: string, commit: string }, gates: Array<{
  requirement: string, gate: string, record: string, artifacts?: string }>, instanceSpec: string, register: Document[],
  accepted: { person: string, date: string } | null, unrecorded: Array<{ requirement: string, gate: string }> = []) -> {
  summary: { passing: number, noTest: number, notPassed: number, flaky: number,
  worse: number, byImplementer: number, accepted: boolean, limitations: string[] }, rows: Array<{ requirement: string,
  constrains: "product" | "process", sources: Array<{ id: string, authority: string, version: string, hashes: string[] }>,
  tests: Array<{ id: string, level: string, outcome: string, counterProof: string | null, worse: boolean,
  byImplementer: boolean, passed: boolean, lastRate: string | null }>, gates: string[], artifacts: string[], unrecorded:
  string[] }>,
  evidence: { report: { path: string, blob: string } | null, records: Array<{ path: string, blob: string }>, acceptance:
  { person: string, date: string, blob: string } | null } }` — one
  row per requirement valid at the release, a requirement without a test or without a passing outcome included and
  counted: each requirement of the product's SPEC at the release, which constrains the product, and each process
  requirement whose gate the product's workflow holds — a requirement of the instance's SPEC, `instanceSpec`, which
  constrains the development process (MOD-spec-document) — with its gate records. `gates` are those records, which the
  caller reads through Process, since Process lies above this subsystem; an entry's `artifacts` are the artifacts its gate
  asks for, as the workflow names them. `unrecorded` are the gates the workflow holds that no record holds, read by the
  caller the same way: their requirement has its row as one whose gate `gates` names does. A row's `artifacts` give, for
  each of its `gates` in their order, the artifacts that gate asked for, `""` where its entry gives none, and its
  `unrecorded` the names of its gates no record holds. A release before Agent M's records says which parts
  cannot be derived: `summary.limitations` names them, and each test's `outcome` is `cannot be derived`. The implementer of a
  release test is a participant of an `implement` job whose `worksOn` names an item or use case that traces to the requirement;
  its writer is a participant of a `write-tests` job whose `results` name the test's file. `evidence` is read from `head`:
  the report `docs/tests/releases/v<version>.md` with its blob; every approval record that names it,
  `docs/approvals/release-v<version>-<blob12>.md`, with its blob; and the acceptance: the person and date of the commit
  that added the record naming the report's current blob, with the blob that record names. `accepted` is that commit's
  author and date, which the caller reads through MOD-repository-hosts' `readHistory` of the record's path with
  `changes: false`, as it reads `gates`, since this module reads no history. A release with no report or no such record
  on `head` gives `report: null` or `acceptance: null`, and `summary.limitations` names what is missing.
  A test's `worse` says that its rate on the release commit is worse than on the last release's, and its `byImplementer`
  that it is a release test whose writer is an implementer of the requirement (above), so that the rows a summary number
  counts are told from the rows alone: `summary.worse` counts the rows holding a test with `worse`, and
  `summary.byImplementer` the distinct tests with `byImplementer`, each in the rows that hold it. A test's `passed` says
  that its run completed and passed and that its rate is no worse than the last release's, and its `lastRate` is its rate
  on the last release's commit, `null` where there is none; a model-dependent test's `outcome` stays its rate.
  `summary.passing` counts the rows with tests, each of them `passed`.
- `auditDocument(audit: { summary: object, rows: object[], evidence: object }, release: { tag: string, commit: string })
  -> string` — the
  self-contained Markdown document of the audit; the browser saves it, and a person with write access may commit it to
  `docs/audits/<tag>.md`.

`Host` and `Snapshot` are MOD-repository-hosts'; `at` is the product at the release's commit, `results` its
branch `test-results`, `head` its default branch, which holds the report and its approval record, committed after the
tagged commit by `acceptAndRelease`; `register` is the instance's source register.

## Files

- Reads the product at the tagged commit — `SPEC.md`, `docs/sources.md`, the tests, its `docs/jobs/` —, the report and its
  approval record on the default branch, the branch `test-results`, the schedule, and the instance's source register and
  `SPEC.md`, whose requirements are the process requirements.
- Reads, for `reportsAwaitingAcceptance`, the tags, the default branch's `docs/tests/releases/`, and, only while a release
  candidate is pending, its `docs/jobs/` newest first back to the first run of a candidate.
- Writes `docs/tests/releases/v<version>.md`, `docs/approvals/release-v<version>-<blob12>.md`, `CHANGELOG.md`, the tags
  `v<version>-rc.<N>` and `v<version>`, and, on a person's click, `docs/audits/<tag>.md`.

## Uses

- MOD-result-records.resultSchema, resultsAt, flakyTests, rateComparison — the outcomes of the candidate's commit.
- MOD-test-schedule.scheduleSchema — the commands and runners with which the complete run runs each level.
- MOD-approvals.approvalSchema, statusOf — the report's record and whether the report is accepted.
- MOD-runtimes.queueJob — the complete run, queued as a job.
- MOD-job-ledger.listJobs — who implemented the behaviour a release test guards, against who wrote the test;
  MOD-job-ledger.recordsNewestFirst, MOD-job-ledger.JobRecord — the run of a pending release candidate, read newest first
  and no further back than the first run of a candidate.
- MOD-repository-hosts.Host, Snapshot, readSnapshot, listTags, commitFiles, createTag — the product at a commit, its
  tags — also the candidates and releases a waiting report is found among —, the release commit and the tags.
- MOD-documents.Document, loadSchema, readDocument, writeDocument — the report and the records by their schemas.
- MOD-spec-document.parseSpec — the product's requirements valid at the release, and the process requirements of the
  instance's SPEC.
- MOD-test-document.testDeclarations — the tests at the release.
- MOD-trace-graph.storedGraph, tracesTo — the tests and sources of each requirement.
- MOD-source-register.sourceSchemas, linkedVersion — each source's authority, version and hashes.
- MOD-text-tools.blobSha — the blob SHAs the audit names.
