---
id: MOD-result-records
title: Result records and counter-proofs, and what they say per commit, test and release
folder: src/result-records/
realises:
follows:
  - ARC-043
uses:
  - MOD-documents.Schema
  - MOD-documents.Document
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.readRegister
  - MOD-test-document.TestDeclaration
  - MOD-test-document.testDeclarations
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.tracesTo
  - MOD-resource-list.Resource
  - MOD-resource-list.resourceSchema
  - MOD-resource-list.paidServices
  - MOD-test-schedule.scheduleSchema
  - MOD-test-schedule.defaultSchedule
  - MOD-test-schedule.occasionsOf
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.listTags
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-identifiers.kindOfIdentifier
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
  - MOD-job-runner.JobResult
provides:
  - Outcome
  - resultSchema
  - parseOutcomes
  - appendResult
  - resultsAt
  - flakyTests
  - rateComparison
  - testHistory
  - resultStrategies
---
# MOD-result-records Result records and counter-proofs, and what they say per commit, test and release

## Responsibility

It belongs to Tests and releases (ARC-043). Every test run leaves a record of each test's outcome on the commit it ran
on (`EVERY TEST RUN LEAVES A RESULT RECORD`), kept on the branch `test-results` of the product repository, which only
grows (`TEST RESULTS ARE KEPT IN THE REPOSITORY`, `A RESULT RECORD IS NEVER REWRITTEN`); every new test carries the
record of its counter-proof (`A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT`). It reads a run's outcomes from the JUnit
XML report its test steps write. From these records it reads back the outcomes of a commit per level, flaky tests
(`A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY`), model-dependent rates against the last release
(`A MODEL-DEPENDENT TEST IS MEASURED AS A RATE`) and a test's history. It offers the job kinds that propose, write and
run tests their recipes, their check — of proposed cases against the existing tests
(`TEST GENERATION SEES THE EXISTING TESTS`), and of written tests against their counter-proofs —, and the writer of a
run's record. It runs in the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `result-record.schema.md`, `counter-proof.schema.md` — the two schemas, in MOD-documents' schema language.
- `append.mjs` — adding a record to the branch `test-results`, and only adding.
- `junit.mjs` — a run's outcomes from its JUnit XML report.
- `read.mjs` — outcomes per commit, flaky tests, rates, a test's history.
- `strategies.mjs` — the recipes, check and writer of `resultStrategies`.

## Data

It keeps nothing. It owns two formats.

**Schema `result-record`** (`result-record.schema.md`), a file `runs/<commit>/<run>.md` on the branch `test-results`,
where `<run>` is `<yyyymmdd>-<hhmm>-<occasion>-<4 hex>` and the occasion one of `commit`, `pull-request`, `nightly`,
`release-candidate`, `on-demand`:

| Part of the schema | Value |
|---|---|
| shape | document: front matter, then one register |
| front matter | `commit` (40 hex), `levels` (the levels run), `occasion`, `participant` (who ran it: the CI service's runner or a participant of the instance), `date`, `run` (the address of the run on the server, if any), `uncommitted` (`true` when the working tree had changes not in the commit — such a record is shown, never counted for the commit) |
| section `## Outcomes` | a table with the columns `Test`, `Level`, `Outcome`, `Runs`, `Reason`; `Test` a `TST-<nnn>`, or the name of a test case that names none; `Outcome` `passed`, `failed`, `not run` or `undeclared`; `Runs` for a model-dependent test `<k> of <n>` with `n` the number of runs fixed before the first, empty otherwise; `Reason` for a test `not run`, why, where the run knows it — such as `secret missing: <name>` (UC-027 4a) —, empty otherwise. `Reason` is optional: a record of the four columns before it, as the branch already holds and never rewrites, is valid, and every reader of the records — `resultsAt`, `flakyTests`, `rateComparison`, `testHistory`, MOD-release-evidence's report — reads its tests with no reason. The module's tests read such a four-column record as the counter-case |
| section `## Failures` | per failed test its expected and observed result and a log excerpt |

**The outcome input.** A run's test jobs hand their outcomes over as JUnit XML reports, one for each job — the report
every common test runner can write —, which are read together as the run's. Each test case is matched to its declaration
by the `TST-<nnn>` at the start of its name; a case without one is reported as `undeclared`, and a declared test without
a case in any of the reports as `not run`.

**Schema `counter-proof`** (`counter-proof.schema.md`), a file `docs/tests/counter-proofs/TST-<nnn>.md` on the product's
default branch, entering with the test's pull request:

| Part of the schema | Value |
|---|---|
| shape | document: front matter, then sections |
| front matter | `test` (`TST-<nnn>`), `commit` (the commit the fault was planted on), `participant`, `date`, `outcome` (`failed` — a test that stays green with its fault is not written) |
| section `## Fault` | the file and the change planted into the code the test guards, as a difference |
| section `## Result` | the test's failing result with the fault, and its passing result once the fault was removed |

## Interfaces

- `Outcome` — `{ test: string, level: string | null, outcome: "passed" | "failed" | "not run" | "undeclared", runs:
  string | null, failure: { expected: string | null, observed: string, log: string } | null, reason: string | null }`:
  one test's outcome in a run — `test` the `TST-<nnn>`, or the case's name for an undeclared case; `runs` `<k> of <n>`
  for a model-dependent test; `failure` the declaration's expected result, the observed one and an excerpt of the case's
  output; `reason` why a test is `not run` where the run knows it, written to the record's column `Reason` —
  `parseOutcomes` gives `null`, its caller sets it; `null` too for a test of a record without that column.
- `resultSchema: { run: Schema, counterProof: Schema }` — the two schemas, for MOD-documents and for MOD-release-evidence.
- `parseOutcomes(reports: string[], declarations: TestDeclaration[]) -> Outcome[]` — the outcomes of one run, for
  MOD-workflow-entries' `onTestsFinished`, from the JUnit XML reports of its jobs, read together as one: each test case
  matched to its declaration by the `TST-<nnn>` at the start of its name; a case with a failure or an error is `failed`,
  a skipped one `not run`, any other `passed`; several cases of a deterministic test, in one report or in several, pass
  only if all pass; the cases of a model-dependent test are its runs, `<k> of <n>` against the number its declaration
  fixes, and `not run` when fewer ran; a case without an identifier is `undeclared`; a declared test without a case in
  any of the reports is `not run`. Errors: `UnreadableReport { index, reason }` for a text that is not a JUnit XML
  report — a report cut off counts as one —, naming its place in `reports`, so that the caller can leave it out and read
  the others.
- `appendResult(host: Host, record: Document) -> Promise<{ commit: string, path: string }>` — adds a run's record to the
  branch `test-results` as a new file, by a commit made only on the head that was read; it never changes or deletes a
  file and never forces a push. Considers: a record whose path already exists is refused, not replaced. Crosses the
  network. Errors: `Exists`, `Moved` (read again and add again), `TokenRefused`, `PermissionMissing`, `RateLimited`,
  `Unreachable`.
- `resultsAt(results: Snapshot, commit: string, tests: Array<{ id: string, level: string }>) -> Array<{ level: string,
  passed: number, failed: number, flaky: number, notRun: number, tests: Array<{ id: string, outcome: "passed" | "failed"
  | "flaky" | "not run", runs: string | null, records: string[] }> }>` — what the records of the branch `test-results`
  say about one commit, per level: a level without a record of this commit reads `not run`, never `passed`; a record
  marked `uncommitted` is left out.
- `flakyTests(results: Snapshot, commit: string) -> Array<{ test: string, passedIn: string[], failedIn: string[] }>` —
  every deterministic test with both a passing and a failing outcome recorded on the same commit, with both records.
- `rateComparison(results: Snapshot, commit: string, lastRelease: string | null) -> Array<{ test: string, now: string,
  then: string | null, worse: boolean }>` — each model-dependent test's rate on a commit beside its rate on the last
  release's commit; `worse` when the rate is lower; no pass or fail on a single run.
- `testHistory(results: Snapshot, test: string, tags: Array<{ tag: string, commit: string }>) -> { commits:
  Array<{ commit: string, outcome: string }>, releases: Array<{ tag: string, outcome: string, runs: string | null }> }` —
  one mark per commit on which the test ran and one row per release tag; a flaky commit marked as such.
- `resultStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `test-selection` — for the kinds `propose-tests` and `write-tests`: the text of each requirement, use case
    and module the job's parameters select; every existing test that guards any of them, with its declaration and code;
    and the product's external services — its resources of kind `endpoint`, `agent` and `data` —, each marked paid or
    free by MOD-resource-list's `paidServices`. `write-tests` receives the reviewed cases besides, through the runner's
    built-in recipe `draft`;
  - recipe `commit-and-levels` — the commit and the levels to run on it, with the commands the product's schedule names;
  - check `test-proposals` — two uses. For `propose-tests`, on the proposed cases: an error finding for a case without
    an expected result, a model-dependent case judged on a single run, a case of a level that runs on a commit or pull
    request and reaches a service `paidServices` marks paid, a case that guards nothing; a case with the same guarded
    identifier, input and expected result as an existing test is classed a duplicate, whatever the participant said. For
    `write-tests`, on the written tests and their counter-proofs in the files it drafts for its pull request: an error
    for a new automated test without its counter-proof record in the schema `counter-proof`, or with one that does not
    record it failing with its fault planted — such a test is not written (UC-026 8b) —, unless the draft reports the
    test failing on the current code: it awaits implementation, and its pull request stays red until the implementing
    job turns it green (UC-026 8a); and an error for a written test whose identifier, level, guarded identifiers or
    expected result differ from the reviewed case it implements (`A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT`,
    `A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS`);
  - writer `result-record` — appends the record of the run the job made, through `appendResult`.

  The kind `write-tests` has no writer of this module: it writes through MOD-runtimes' `branch-and-pull-request` — the
  tests and their counter-proof records in one pull request, whose files the check above has seen.

`Host` and `Snapshot` are MOD-repository-hosts'; a `Snapshot` here is the branch `test-results`.

## Files

- Reads the branch `test-results`, `docs/tests/counter-proofs/`, the test files of the product, its `docs/resources.md`
  and `docs/tests/schedule.md`, and the release tags.
- Writes `runs/<commit>/<run>.md` on the branch `test-results`, only by adding. Counter-proof records are written by the
  participant that wrote the test, in its pull request.

## Uses

- MOD-documents.Schema, Document, loadSchema, readDocument, writeDocument, readRegister — records and resources by their
  schemas.
- MOD-test-document.TestDeclaration, testDeclarations — the tests of the product, their levels, what they guard and the
  runs a model-dependent test fixes.
- MOD-trace-graph.traceGraph, tracesTo — the tests that guard a selected requirement, use case or module.
- MOD-resource-list.Resource, resourceSchema, paidServices — the product's resources, and which of the services it
  calls are paid.
- MOD-test-schedule.scheduleSchema, defaultSchedule, occasionsOf — the product's schedule, or the book's default where
  none is saved: the levels that run on a commit or a pull request, and the commands of `commit-and-levels`.
- MOD-repository-hosts.Host, Snapshot, readSnapshot, commitFiles, listTags — the branch `test-results`, adding to it,
  and the release tags.
- MOD-text-tools.Finding, finding — the findings of `test-proposals`.
- MOD-identifiers.kindOfIdentifier — whether an entry of a case's guards is a module's identifier, and whether a case's
  identifier is a test's, for `test-proposals`.
- MOD-job-runner.Strategies, JobContext, Part, JobResult — the form of the strategies.
