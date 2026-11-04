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
  - MOD-job-ledger.JobRecord
  - MOD-job-ledger.JobRow
  - MOD-runtimes.routesFor
  - MOD-participant-list.eligible
  - MOD-documents.Document
  - MOD-documents.readDocument
  - MOD-repository-hosts.Snapshot
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
`A JOB STOPS AT EVERY GATE`), never more at once than its start allows (`A RUN HAS LIMITS FIXED AT ITS START`). The
function is pure: the same run and facts give the same actions. It also offers the recipe of an implementation job's
inputs (`DEVELOP AGAINST INTERFACES`). It runs in the browser and in
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

A run's end is MOD-job-ledger's `## End`: `done` for a finished run, or `cancelled` for a run a person stopped. A run
held by a limit has no end: it waits until a person raises the limit or stops it.

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
  resources (`facts.resourceNeeds`), as many as `jobs at once` allows; the steps of a phase only once the gate before it is recorded; resume a job whose gate has been decided.
  It starts nothing that depends on a failed job while the others go on, and nothing after a person stopped the run. It
  starts nothing whose condition depends on a fact that is `"unknown"`. `refuse` names the modules of a cycle in the
  modules' uses, before anything starts.
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

`Facts` is MOD-progress-measures'; `JobRecord` and `JobRow` MOD-job-ledger's; `Snapshot` MOD-repository-hosts'.

## Files

- Reads, through the facts and the snapshot, `docs/jobs/` (the run's record and its jobs'), `docs/plan/` or
  `docs/backlog/`, `docs/gates/`, `docs/process.md`, the architecture under `docs/architecture/`, `SPEC.md`, the code and
  tests of the selected modules.
- Writes nothing.

## Uses

- MOD-work-plans.ItemState, startable — which steps or items may start, and why not.
- MOD-product-process.Workflow, holdsRole — the phases, gates and roles of the product.
- MOD-progress-measures.Facts — the facts of the product, gathered once.
- MOD-trace-graph.traceGraph, moduleOrder — the order of modules by their uses, and a cycle; MOD-trace-graph.systemDecisions —
  the decisions of the system and of its subsystems.
- MOD-job-ledger.JobRecord, JobRow — the run's record, and its jobs with their states and costs.
- MOD-runtimes.routesFor — the routes of a participant.
- MOD-participant-list.eligible — who may receive a job's content.
- MOD-documents.Document, readDocument — the module files and decisions of the inputs.
- MOD-repository-hosts.Snapshot — the product's files.
- MOD-text-tools.Finding, finding — the finding of a refused run.
- MOD-job-runner.Strategies, JobContext, Part — the form of the recipe; MOD-job-runner.sourcesOf — the sources a part carries.
