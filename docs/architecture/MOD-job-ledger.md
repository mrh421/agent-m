---
id: MOD-job-ledger
title: The record, state and cost of every job
folder: src/job-ledger/
realises:
follows:
  - ARC-046
uses:
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.appendSection
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-job-runner.Usage
  - MOD-job-runner.Round
  - MOD-job-runner.roundsText
  - MOD-participant-list.Participant
  - MOD-text-tools.parseFinding
provides:
  - JobStart
  - RecordPart
  - JobRecord
  - LiveState
  - JobState
  - Cost
  - JobRow
  - newJobId
  - startRecord
  - appendToRecord
  - takeJob
  - jobState
  - listJobs
  - recordsNewestFirst
  - jobCost
---
# MOD-job-ledger The record, state and cost of every job

## Responsibility

It belongs to Participants and jobs (ARC-046). It owns the job record — the evidence, in the repository of the product a
job works on, of everything the job did (`A JOB IS RECORDED IN ITS PRODUCT REPOSITORY`, `A RECORD IS EVIDENCE, NOT A
PROPOSAL`) —: identifiers that are never reused, the start, the parts appended as the job goes on, and taking a queued job
so that only one route runs it. From a record and the live state its runtime reports it derives the job's state, lists
the jobs of every product in one list (`ONE DASHBOARD SHOWS EVERY JOB`), and gives each its cost, never guessed (`NO COST
IS GUESSED`). Nothing about a job's state is stored but its record (`PROGRESS AND JOB STATE ARE DERIVED, NOT STORED`). It
runs unchanged in a browser and in Node.

## Parts

- `index.mjs` — the interface.
- `job.schema.md` — the schema of the job record, in the schema language of MOD-documents.
- `states.mjs` — the derivation of a job's state.
- `cost.mjs` — the cost of a job.

## Data

**The job record** `docs/jobs/JOB-<yyyymmdd>-<hhmm>-<4 hex>.md` in the product's repository — the instance's own for a job
of the instance —, the date and time those of its start in UTC, the four hexadecimal digits random. It is written once as
its start and then only appended to, one section per event; nothing in it is ever changed or removed.

Its start: the front matter, the destinations and the parameters.

| Key | Holds |
|---|---|
| `id` | the job's identifier |
| `kind` | the kind's name from MOD-job-catalogue, or `run` |
| `works_on` | the identifiers it works on — requirements, use cases, decisions, modules, items, sources —, an issue's address or a commit |
| `participant`, `model` | the participant's name and model, `—` for a kind without one |
| `declares` | for a model endpoint the instance's list does not hold, which a hand-over of the prompt bar names (`THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE`), its `context` in tokens and its `capabilities`, as its configuration declares them; its place stands in `## Destinations`; absent otherwise |
| `route` | `tab`, `ci hosted`, `ci runner:<label>` or `bridge <name>` |
| `run` | the run it belongs to, if any |
| `retries` | the job it retries, if any |
| `started_by` | the account whose click started it, or the run that started it |
| `start` | the date and time of the start |
| `agent_m` | the Agent M version and the commit of the instance it runs |
| `inputs` | each input with its pin: a file with its blob SHA, a source version with its hash, a commit, a resource's pin |
| `limit` | the number of correction rounds fixed before the first |
| `task` | `in parameters`, or `with the hand-over` for a job a conversation of the prompt bar handed over, whose task travels to its route with the hand-over and stands nowhere in the record (`A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON`) |
| `conversation` | the path of the conversation record the hand-over came from, where the instance records conversations; empty otherwise |

A section `## Destinations` follows, stating every participant that receives something, its place and what it receives,
as the run panel stated it; then a section `## Parameters`, holding as one fenced JSON block the parameters the kind's
recipes read — the person's instruction, the selection and the levels, a draft a person left for the job to go on with,
such as the cases of `write-tests` —, so that every route runs the job from its record alone; for a job whose task travels
with the hand-over, its route has the task from the hand-over and the record holds no message of the conversation. Then, appended as they
happen, each with `at:` and its own lines:

| Section | Lines |
|---|---|
| `## Taken` | `by:` the route that took it — a CI run's address, a Bridge's name, or `tab <browser>` for a tab, `<browser>` the identifier of the browser or tab that took it (MOD-runtimes, Data) |
| `## Gate reached` | `gate:` its name, `decider:` the role, agent or check that decides it — or `question:` for a question to the author |
| `## Resumed` | `gate record:` the record whose decision resumed it |
| `## Job started` | in a run's record: `job:` the identifier of a job the run started, `kind:`, `works on:` — one part per job, committed together with that job's start record |
| `## Limits raised` | in a run's record: `by:` the person, and `jobs at once:`, `cost:`, `rounds:` — the limits in force from then on; the start's limits and every earlier part stay as they were |
| `## End` | `state:` `done`, `failed` or `cancelled`; `results:` commits, files, pull request, issues — or `waits for a person` for a draft its kind leaves to a person's click, whose commit names this job in its provenance lines; `draft:` for a job whose kind hands its draft back and that ran away from the page — on CI, on a Bridge that runs it, in a run —, that draft as one fenced JSON block, from which the page shows it and a run starts the job that follows, such as `write-tests` with the cases of `propose-tests`; the round record of MOD-job-runner — a job whose task travels with the hand-over holds no `draft:`, since its answer is a
message of the conversation —; `usage:` as reported; `cost:`; `reason:` for a failed or cancelled job; `log:` the runtime's address of its log, where it keeps one |

No part of a record holds a mail's text, sender, reply address or attachment (`MAIL STAYS IN THE MAILBOX`).

A run (MOD-run-planner) is a record of kind `run`: its `works_on` is its selection, its `## Parameters` hold its limits
as `jobsAtOnce`, `cost` and `rounds`, and it gains the two parts of a run above as they happen.

````markdown
---
id: JOB-20261005-1432-7f3a
kind: derive-use-cases
works_on:
  - EXPORT IS A PDF
participant: drafter-a
model: example-model
route: tab
run:
retries:
started_by: alice
start: <date and time of the start, UTC>
agent_m: <version>, commit <instance commit>
inputs:
  - SPEC.md@<blob SHA>
limit: 5
---
## Destinations

- drafter-a, at this machine: the chosen requirements, every use case.

## Parameters

```json
{ "requirements": ["EXPORT IS A PDF"] }
```

## Taken

at: <date and time, UTC>
by: tab <identifier>
````

## Interfaces

- `JobStart` — `{ id: string, kind: string, worksOn: string[], participant: string | null, model: string | null, route:
  string, run: string | null, retries: string | null, startedBy: string, start: Date, agentM: { version: string, commit:
  string }, inputs: string[], limit: number, task: "in parameters" | "with the hand-over", conversation: string | null,
  declares: { context: number, capabilities: string[] } | null, destinations: { participant: string, place: string,
  parts: string[] }[], params: Record<string, unknown> }`.
- `RecordPart` — `{ part: "taken", at: Date, by: string } | { part: "gate reached", at: Date, gate: string, decider:
  string } | { part: "question", at: Date, question: string } | { part: "resumed", at: Date, gateRecord: string } | {
  part: "job started", at: Date, job: string, kind: string, worksOn: string[] } | { part: "limits raised", at: Date, by:
  string, limits: { jobsAtOnce: number, cost: number | null, rounds: number } } | {
  part: "end", at: Date, state: "done" | "failed" | "cancelled", results: string[], draft: unknown | null, rounds: Round[],
  usage: Usage | null, cost: Cost, reason: string | null, log: string | null }`.
- `JobRecord` — the record as read: the fields of `JobStart`, its `path`, and `taken`, `gates` (each reached, with the
  record that resumed it), `question`, `jobs` (the jobs a run started), `limitsRaised` (every raise of a run's limits, oldest
  first) and `end` as appended, each `null` or empty while absent.
- `LiveState` — `{ reachable: boolean, reason: string | null, known: boolean, running: boolean, cancelling: boolean, log:
  string | null, usage: Usage | null, writtenAfterCancel: string[] }`: what a job's runtime reports while it has not ended,
  given by MOD-runtimes.
- `JobState` — `"queued" | "running" | "cancelling" | "waiting at a gate" | "done" | "failed" | "cancelled" | "ended
  without record"`: the seven states of `ONE DASHBOARD SHOWS EVERY JOB`, `cancelling` shown within `running`.
- `Cost` — `{ known: true, amount: number, currency: string, basis: "reported" | "usage at the declared price" } | {
  known: false, usage: Usage | null }`.
- `JobRow` — `{ record: JobRecord, product: string, state: JobState, elapsed: number, cost: Cost, source: { reachable:
  boolean, reason: string | null } }`: one line of the list of jobs.
- `newJobId(now: Date, taken: Set<string>) -> string` — a new identifier of the form above, none of `taken`. The caller
  gives the identifiers its product holds; a commit that would create an existing record is refused by the host, and the
  caller then asks for another (`A JOB IDENTIFIER IS NEVER REUSED`).
- `startRecord(job: JobStart) -> { path: string, text: string }` — the record's start, for the caller to commit.
- `appendToRecord(text: string, part: RecordPart) -> string` — the record with the part appended after its last section;
  the bytes before stay as they are. Throws `RecordEnded` when the record already has its end, and `NotWaiting` for a
  resumption of a job that has not reached a gate.
- `takeJob(host: Host, path: string, by: string, head: string) -> Promise<{ taken: true, commit: string } | { taken:
  false, by: string | null }>` — reads the record at `head`, appends `Taken` and commits it only on that head; when the
  branch moved, it reads the record again and either takes it on the new head or reports who took it. Crosses the
  network through the host, and fails as the host fails: a refused token, a used-up rate limit, an unreachable server.
- `jobState(record: JobRecord, live: LiveState | null) -> JobState` — from the record's last part; for a job that has not
  ended, with the live state: a runtime that is reachable and does not know the job makes it `ended without record`; an
  unreachable one leaves it as its record says, and the list shows the source as not reachable.
- `listJobs(products: { address: string, snapshot: Snapshot }[], live: Map<string, LiveState>) -> JobRow[]` — every job of
  every product given, newest first, waiting at a gate first among those that have not ended. The records of each
  snapshot are named to its `readMany` first, so that they are read in batches. A record that cannot be read
  is listed with what could be read and the reason.
- `recordsNewestFirst(snapshot: Snapshot) -> AsyncIterable<JobRecord>` — the job records of a snapshot, newest first by
  the start their paths name, each read only when its caller asks for the next one, so that a caller that looks for a
  recent job stops reading where it has found it. Crosses the network through the snapshot, for the records it has not
  read yet; the iteration fails with the snapshot's errors — `TokenRefused`, `PermissionMissing`, `RateLimited`,
  `Unreachable`.
- `jobCost(usage: Usage | null, participant: Participant) -> Cost` — the cost the runtime reported; otherwise the
  reported tokens at the participant's declared price; otherwise unknown, with the usage — never zero, never an estimate.

## Files

It reads and, through the host, writes `docs/jobs/JOB-*.md` of a product's repository, and reads its own `job.schema.md`.
A commit that touches only `docs/jobs/` starts no run of the product's test configuration (`A JOB RECORD STARTS NO CI
RUN`); it does start Agent M's job workflow, which is how a CI route notices it.

## Uses

- `MOD-documents.loadSchema`, `MOD-documents.readDocument`, `MOD-documents.writeDocument`, `MOD-documents.appendSection`
  — the record's schema, reading it, writing its start, appending a part.
- `MOD-repository-hosts.commitFiles`, `MOD-repository-hosts.readSnapshot`, `MOD-repository-hosts.Host`,
  `MOD-repository-hosts.Snapshot` — taking a job by a commit on the head it read, and the snapshots the list is built from.
- `MOD-job-runner.Usage`, `MOD-job-runner.Round`, `MOD-job-runner.roundsText` — the usage a runtime reports, and the
  round record written into a job's end.
- `MOD-participant-list.Participant` — the declared price of a job's cost.
- `MOD-text-tools.parseFinding` — a finding of a round, as the job's end record writes it, read back into its parts.
