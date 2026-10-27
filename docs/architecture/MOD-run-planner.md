---
id: MOD-run-planner
title: Runs over a selection, their next actions, and the inputs of an implementation job
folder: src/run-planner/
realises:
follows:
  - ARC-042
uses:
  - MOD-work-plans.ItemState
  - MOD-work-plans.startable
  - MOD-product-process.Workflow
  - MOD-product-process.holdsRole
  - MOD-progress-measures.Facts
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.systemDecisions
  - MOD-trace-graph.moduleOrder
  - MOD-trace-graph.moduleRows
  - MOD-job-ledger.JobRecord
  - MOD-job-ledger.JobRow
  - MOD-job-ledger.appendToRecord
  - MOD-job-ledger.RecordPart
  - MOD-runtimes.routesFor
  - MOD-participant-list.eligible
  - MOD-participant-list.differs
  - MOD-documents.Document
  - MOD-documents.readDocument
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.commitFiles
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
  - MOD-job-runner.sourcesOf
provides:
  - Run
  - Action
  - runOf
  - nextActions
  - raiseLimits
  - finishRun
  - runStrategies
---
# MOD-run-planner Runs over a selection, their next actions, and the inputs of an implementation job

## Responsibility

It belongs to Process (ARC-042). A run carries a selection — steps of the implementation plan, or backlog items, in a model with sprints those of one
team's current sprint —
through the product's process model as jobs (`A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION`), recorded as a job
that names its jobs (`A RUN IS A JOB THAT NAMES ITS JOBS`). This module reads a run from its record and computes, from
the records alone, its next actions: CI set up first (`A RUN SETS UP CI BEFORE IT IMPLEMENTS`), then the steps in the
order of the modules' interfaces and of the model's phases and gates (`A RUN FOLLOWS THE MODULES' INTERFACES`,
`A JOB STOPS AT EVERY GATE`), then the tests, then the validation of what was built
(`A RUN ENDS WITH THE VALIDATION OF ITS MODULES`), never above the limits fixed at its start
(`A RUN HAS LIMITS FIXED AT ITS START`), or above those a person raised to continue it. The function is pure, so any
driver that notices a change — the page, the Workflows, a Bridge — computes the same actions and starts those of its own
route, and the run goes on without a click between its jobs (`A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS`). It
also offers the recipe of an implementation job's inputs (`DEVELOP AGAINST INTERFACES`). It runs in the browser and in
Node.

## Parts

- `index.mjs` — the interface.
- `run.mjs` — a run from its record, and its raised limits.
- `next.mjs` — the next actions.
- `inputs.mjs` — the recipe of `runStrategies`.

## Data

It keeps nothing. A run is a job record of kind `run`, in the format MOD-job-ledger defines: its `works_on` is the
selection — the steps or items, by identifier —; its parameters are its limits — `jobsAtOnce` (preset to the model's
work-in-progress limit, or 3), `cost` (counted only from costs the runtimes report), `rounds` (the correction rounds per
draft, preset 5) —; a `## Job started` part names each job it started, and each of those jobs names the run in its own
record (`run:`); a `## Limits raised` part holds the limits a person raised to continue it, the newest in force.

A run's end is MOD-job-ledger's `## End`: `done` for a finished run, whose results name its validation — the module view
of its selection —, or `cancelled` for a run a person stopped. A run held by a limit has no end: it waits until a person raises the
limit or stops it.

## Interfaces

- `Run` — `{ id: string, selection: string[], limits: { jobsAtOnce: number, cost: number | null, rounds: number }, jobs:
  Array<{ job: string, kind: string, worksOn: string }>, state: "running" | "waiting at a gate" | "held by a limit" |
  "finished" | "stopped" }`; `limits` are those in force.
- `Action` — `{ do: "start" | "resume" | "hold" | "finish" | "refuse", kind: string | null, worksOn: string | null,
  route: string | null, participant: string | null, job: string | null, reason: string | null }`.
- `runOf(record: JobRecord, jobs: JobRow[]) -> Run` — a run from its record and the rows of its jobs, with the limits of
  its newest `## Limits raised` part, or of its parameters. Errors: `NotARun` for a record of another kind.
- `nextActions(run: Run, facts: Facts) -> Action[]` — what to do now, from the run and the facts of its product, whose
  job rows carry the live states, in this order: while the product has no CI configuration of Agent M's
  (`facts.ci.configured` false), start the kind `set-up-ci` and nothing else until its pull request is merged; start the
  kind `implement` for every selected step or item that `startable` admits and whose modules use only modules already
  done, each on a route of a holder of the implementing role in the item's role assignment who may receive its content that reaches the product's
  resources (`facts.resourceNeeds`), as many as `jobs at once` allows; the steps of a phase only once the gate before it is recorded; resume a job whose gate has been decided; once
  the selected plan steps are implemented, start `propose-tests` for them at every level the product's schedule names —
  its rows but `paid` (`facts.schedule`) —, and when that job has ended, `write-tests` with the cases its record's
  `## End` holds under `draft:` — no person attends a run —, the selection and the levels, the release level on a
  participant other than the implementer (a backlog item's job includes its tests); then `finish`. It returns `hold`
  with the limit named when the cost reported so far reaches the cost limit, or a job of the run stopped at the rounds
  limit with findings left: no further job starts, the running ones finish, and the run waits for a person to raise the
  limit (`raiseLimits`) or stop it (UC-043 6c). It starts nothing that depends on a failed job while the others go on,
  and nothing after a person stopped the run. It starts nothing whose condition depends on a fact that is `"unknown"`:
  on a host that does no server operations, such as a Bridge's local clone, it computes only the resumptions of jobs
  whose gate is recorded, the holds at a limit and the refusals, and the Workflows' entries and the page advance the run
  past merges and CI results. `refuse` names the modules of a cycle in the modules' uses, before anything starts.
  Considers: two drivers may compute the same action; only the one whose start record lands on the head it read takes it
  (MOD-job-ledger's `takeJob`).
- `finishRun(host: Host, run: Run, context: { snapshot: Snapshot, trailers: string[] }) -> Promise<{ commit: string }>` —
  what a route does on `finish`, whichever route got it: appends to the run's record, read from `snapshot`, its `## End`,
  `done`, whose `results` name the default branch's commit the run's validation holds at. The validation — the module view
  of its selection, MOD-trace-graph's `moduleRows` of that commit's graph for the modules of the selected steps or items,
  with their gaps — is derived again from that commit wherever it is shown, and is not copied into the record. Committed
  through `appendToRecord` and `commitFiles` on that head (`A RUN ENDS WITH THE VALIDATION OF ITS MODULES`). Errors:
  `RecordEnded`, and the host's.
- `raiseLimits(host: Host, run: Run, limits: { jobsAtOnce?: number, cost?: number, rounds?: number }, context: {
  snapshot: Snapshot, person: string, now: Date }) -> Promise<{ commit: string }>` — the person's **Continue** after
  raising a limit (UC-043 6c): appends a part `## Limits raised` with the limits then in force, who and when, to the run's
  record read from `snapshot`, through MOD-job-ledger's `appendToRecord`, and commits it on that head with
  MOD-repository-hosts' `commitFiles`, so that `nextActions` reads them; the record keeps the earlier limits beside them. Crosses the network. Errors: `NotRaised { limit }` for a
  limit not above the one in force, with nothing written; `RecordEnded` for a run that has ended; `Moved`,
  `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`.
- `runStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `implementation-inputs` — for a step, an item, or the modules a job's parameter `modules` names itself, as a
    bug's fix does (UC-012); for a module step, an item, and each module so named: the file of each module; the decision
    of their subsystem and the decision that states the system; the SPEC; the interfaces — the `## Interfaces` of their files, not
    the code — of the modules they use; the code in their folders and the tests that name them; the product's coding
    standards file, `AGENTS.md` at its root, if it has one; for a subsystem's integration, the subsystem's decision and the files, code and tests
    of its modules; for the system, the decision that states it, the subsystems' decisions and the use cases. Each part
    names the sources whose content it carries, so that restricted content goes only where its source permits. Throws
    `NoWorkNamed` for a job whose parameters name no step, no item and no module, and `UnknownWork { id }` for a name
    that is no step, item or module of the product.

`Facts` is MOD-progress-measures'; `JobRecord` and `JobRow` MOD-job-ledger's; `Host` and `Snapshot`
MOD-repository-hosts'.

## Files

- Reads, through the facts and the snapshot, `docs/jobs/` (the run's record and its jobs'), `docs/plan/` or
  `docs/backlog/`, `docs/gates/`, `docs/process.md`, the architecture under `docs/architecture/`, `SPEC.md`, the code and
  tests of the selected modules.
- Writes the `## Limits raised` part of a run's record through `raiseLimits`; the drivers write the records of the
  actions they take.

## Uses

- MOD-work-plans.ItemState, startable — which steps or items may start, and why not.
- MOD-product-process.Workflow, holdsRole — the phases, gates and roles of the product.
- MOD-progress-measures.Facts — the facts of the product, gathered once.
- MOD-trace-graph.traceGraph, moduleOrder — the order of modules by their uses, and a cycle; MOD-trace-graph.moduleRows —
  the validation a finished run's end names; MOD-trace-graph.systemDecisions —
  the decisions of the system and of its subsystems.
- MOD-job-ledger.JobRecord, JobRow, appendToRecord, RecordPart — the run's record, its jobs with their states and
  costs, and the part a person's raised limits append.
- MOD-runtimes.routesFor — the routes of a participant.
- MOD-participant-list.eligible, differs — who may receive a job's content, and a release tester other than the
  implementer.
- MOD-documents.Document, readDocument — the module files and decisions of the inputs.
- MOD-repository-hosts.Host, Snapshot, commitFiles — the product's files, and the commit of raised limits.
- MOD-text-tools.Finding, finding — the finding of a refused run.
- MOD-job-runner.Strategies, JobContext, Part — the form of the recipe; MOD-job-runner.sourcesOf — the sources a part carries.
