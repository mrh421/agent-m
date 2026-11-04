---
id: MOD-work-plans
title: Implementation plans, backlogs and sprints, and the state of each item
folder: src/work-plans/
realises:
follows:
  - ARC-042
uses:
  - MOD-product-process.Workflow
  - MOD-product-process.gateStates
  - MOD-product-process.productWorkflow
  - MOD-product-process.holdsRole
  - MOD-model-catalogue.Model
  - MOD-approvals.statuses
  - MOD-spec-changes.Queue
  - MOD-spec-changes.queues
  - MOD-spec-changes.proposeSection
  - MOD-spec-document.parseSpec
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.graphFindings
  - MOD-trace-graph.TextSource
  - MOD-trace-graph.systemDecisions
  - MOD-trace-graph.moduleOrder
  - MOD-trace-graph.coverageGaps
  - MOD-documents.Schema
  - MOD-documents.Document
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.appendSection
  - MOD-documents.classifyCandidates
  - MOD-documents.artifactSchemas
  - MOD-identifiers.identifiersIn
  - MOD-identifiers.nextIdentifier
  - MOD-job-ledger.JobRow
  - MOD-job-ledger.listJobs
  - MOD-test-document.isTestFile
  - MOD-test-document.testDeclarations
  - MOD-participant-list.Participant
  - MOD-result-records.flakyTests
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.PullRequest
  - MOD-repository-hosts.Issue
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.listPullRequests
  - MOD-repository-hosts.listIssues
  - MOD-repository-hosts.createBranch
  - MOD-repository-hosts.commitFiles
  - MOD-text-tools.Finding
  - MOD-text-tools.finding
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.Part
  - MOD-job-runner.sourcesOf
  - MOD-job-runner.JobResult
  - MOD-job-runner.provenanceLines
provides:
  - ItemState
  - Held
  - planSchemas
  - itemStates
  - startable
  - heldItems
  - undecidedHeads
  - conflicts
  - planFindings
  - backlogFindings
  - sprintFacts
  - sprintsToClose
  - targetBranch
  - giveUpIncrement
  - savePlan
  - saveItems
  - startSprint
  - endSprint
  - closeSprint
  - workStrategies
---
# MOD-work-plans Implementation plans, backlogs and sprints, and the state of each item

## Responsibility

It belongs to Process (ARC-042). It keeps the work of a product: the implementation plan of a model that plans its work,
in its order (`THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY`, `AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM
ITS MODULES`, `A PLAN STEP NAMES THE TESTS OF ITS LEVEL`), and the backlog and sprints of a model that pulls its work
(`THE BACKLOG LIVES IN THE PRODUCT REPOSITORY`, `A BACKLOG ITEM NAMES WHAT IT REALISES`, `A BACKLOG ITEM NAMES THE MODULES IT
CHANGES`). A backlog keeps no order of its own: its items are listed after the items they build on. In a model with
sprints, every team runs sprints of its own, and a sprint holds its items until their change is in the default branch or
they return to the backlog. A team's selection is refused when one of its items changes a module that an item of another
team's sprint changes or uses, or uses a module that such an item changes (`EVERY TEAM RUNS SPRINTS OF ITS OWN`, `A SPRINT
HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH`, `SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR
USES`, `SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD`). It derives each step's or item's state and every reason
it cannot start (`NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED`, `NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT`, `A TIME
BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT`), never storing a state (`PROGRESS AND JOB STATE ARE DERIVED, NOT STORED`), and
records a sprint from its start to its review and retrospective (`A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT`, `A SPRINT
ENDS WITH A RETROSPECTIVE`). It commits each save of a plan, of items, and of a sprint's start, end and close as one commit
on the head that was read, checked by its findings — a person's own input on the page, and the same functions behind the
writers of the kinds that draft a plan, propose items and close a sprint, whose recipes and checks it offers too. It runs
in the browser and in Node.

## Parts

- `index.mjs` — the interface.
- `plan-order.schema.md`, `sprint.schema.md` — the schemas, in MOD-documents' schema language.
- `states.mjs` — item states and startability.
- `checks.mjs` — the findings of a plan and of a backlog.
- `sprints.mjs` — the facts of a sprint, the items the sprints hold, and what keeps an item from a team's selection.
- `saves.mjs` — the commits of a plan, of items and of a sprint.
- `strategies.mjs` — the recipes, checks, step and writers of `workStrategies`.

## Data

It keeps nothing. It owns two formats; the files of the steps and items themselves (`ITM-<nnn>-<slug>.md`) are of the
item schema of MOD-documents (`artifactSchemas().item`).

| Schema | File | Content |
|---|---|---|
| `plan-order` | `docs/plan/order.md` | a table `Step`, `Phase`: every step of the plan by identifier, in its order, with the phase of the model it belongs to |
| `sprint` | `docs/backlog/sprints/<team>/<nn>.md`, numbered within the team; `<team>` is the name of the team's role assignment | front matter `sprint`, `goal`, `start`, `end` (the date the time box gives, empty without one), `closer` (the participant who closes it), `branch` (its own branch, empty for none), `selection` (the items); then sections appended as the sprint goes on, never rewritten: `## Selection` when the selection is changed by a new start decision, `## Ended` when the Product Owner ends a sprint without a time box, `## Increment given up` (`at:`, `by:` the Product Owner, `reason:`) when the Product Owner gives up an increment that was not merged, `## Review` (the increment, the items not done with their reasons, each feedback line with where it goes — new item, change to an item, noted —, who took part, and for an agent the sources of its feedback), `## Unfinished items` (each to the backlog or into the next sprint, with the reason), `## Retrospective` (what went well, what did not, each change with where it goes — process model, Definition of Done, a participant's instructions, team agreement —; an agent's changes as proposals only) |

An item's state, `ItemState`, is derived from the approval records, the queues, the job records and the pull requests:
`waiting for acceptance`, `waiting for an item it builds on`, `ready`, `in progress` (a job runs, or its pull request is
open; and once its newest job has ended as done, until a pull request of it opened after that job's `start` is merged or
closed without merge), `blocked` (a job failed other than at a rejected gate, or waits for a person), `done` (its pull request is merged, or — for an item built
without a pull request naming it — its record names the commits that built it, `built_by`). A merged
pull request decides first: an item whose pull request is merged is `done` whatever else holds, including a job of
it started, or a pull request of it opened, after the merge, and stays `done`; an item whose record names `built_by`
is `done` in the same way, from its record alone, with no request. A
requirement or use case it realises that is withdrawn, changed or not accepted, or an item it builds on that is not done,
marks a `done` item: its `reason` names that. A plan step that waits for the gate before its phase is `waiting` with
that gate named. A step or item whose newest job a rejected gate ended — its End `failed`, with the reason `the gate
<gate> was rejected by <gate record>`, followed by `: <the record's reason>` where the record gives one — is `ready`,
with that reason, unless it is `done`, `waiting for acceptance`, `waiting for an item it builds on` or `waiting`.

An item is held by a team's sprint from its selection until a pull request with its change is merged into the default
branch, or until its sprint's close sends it back to the backlog or into the team's next sprint: once the close is recorded
— its record holds `## Review` —, the sprint holds none of its items without a merged pull request. Once its record also
holds `## Increment given up`, it holds none of its items at all, and its done items stay `done` (UC-041 7b). An item's role
assignment is the one of the team whose sprint holds it, and the product's one in a model without sprints.

## Interfaces

- `ItemState` — `{ item: string, state: "waiting for acceptance" | "waiting for an item it builds on" | "waiting" |
  "ready" | "in progress" | "blocked" | "done" | "unknown", reason: string | null, job: string | null, pullRequest:
  string | null }`; `unknown` when the state needs pull requests the host could not read; `reason` for a `done` item its
  mark, null without one; `job` the newest job whose
  record works on the item, also once that job has ended, and null when there is none.
- `Held` — `{ item: string, sprint: string, team: string, changes: string[], uses: string[] }`: an item a team's sprint
  holds, with the modules it changes and the modules whose interfaces those use.
- `planSchemas: { planOrder: Schema, sprint: Schema }` — the two schemas, for MOD-documents and
  for the page's forms.
- `itemStates(items: Document[], order: Document | null, facts: { statuses: Map<string, { id: string, kind: string, status:
  string }>, queues: Queue[], jobs: JobRow[], pullRequests: PullRequest[] | "unknown", gates: Array<{ gate: string,
  state: string }>, workflow: Workflow | null }) -> ItemState[]` — every step in the plan's order, or every item after the items it builds on — a backlog has no
  `order` —, with its state, from
  the approval statuses, the change queues, the jobs, the pull requests and the gate states `gateStates` gives; with the
  pull requests `"unknown"` — a host that does no server operations —, a step or item whose state needs them is
  `unknown`, never guessed; a `done` item is marked as the states above say; one done by its `built_by` has
  `pullRequest` null.
- `startable(item: string, states: ItemState[], context: { workflow: Workflow, assignment: Document, sprint: Document |
  null, held: Held[], wip: number | null, participants: Participant[] }) -> { startable: true } | { startable: false,
  reasons: string[] }` — every reason a job for this step or item cannot start: the item is `done`, a change to it being
  a new item; not selected for the current sprint of its team, `sprint`; a requirement or use case it names not
  accepted, named; an item it builds on not done, named; the work-in-progress limit reached by the items in progress
  under `assignment`, the item's role assignment, naming them and those waiting for review; the gate before its phase
  not recorded, naming it and its decider; no holder of the implementing role in `assignment` with what the role needs.
- `heldItems(sprints: Document[], items: Document[], architecture: Document[], pullRequests: PullRequest[] | "unknown",
  onDefault?: Set<string>) -> Held[]` — every item a team's sprint holds, from the sprint records and the pull requests,
  with the modules it changes and the modules whose interfaces they use (`A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE
  DEFAULT BRANCH`); with the pull requests unknown, a selected item counts as held. An item's hold ends when a merged pull
  request naming it reaches the default branch through the pull requests that merge its base on, or when that pull
  request's head commit is in `onDefault` — the head commits a caller found on the default branch with the host's
  `containsCommit`, for a change that reached it another way. Without `onDefault`, only the pull requests decide.
- `undecidedHeads(sprints: Document[], pullRequests: PullRequest[]) -> string[]` — the head commits of the merged pull
  requests that name an item a sprint holds and whose chain of pull requests reaches no default branch: the only commits a
  caller needs to ask `containsCommit` about before calling `heldItems`. Pure; no request.
- `conflicts(item: Document, team: string, held: Held[], architecture: Document[]) -> Array<{ sprint: string, team:
  string, item: string, module: string }>` — what keeps an item from the team's selection: each item another team's sprint
  holds that is the item itself, changes a module the item changes or uses, or uses a module the item changes, with that
  module (`SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES`).
- `planFindings(plan: Document, steps: Document[], architecture: Document[], workflow: Workflow, source: TextSource,
  history?: { host: Host }, graph?: Graph) -> Promise<Finding[]>` — a module, a subsystem or the system without a step; with `history`, a
  step whose module or subsystem file was removed, and a step whose module or subsystem file was changed by a commit later
  than the step's own last commit (`readHistory` of both files, `changes: false`), each naming the file and the step, so
  that the plan page marks them after an architecture change (UC-045); a module ordered before one whose interface
  it uses; a step without a phase of the model; and the findings MOD-trace-graph's `graphFindings` gives on
  `traceGraph(source)`, `source` being the product's files with the drafted steps in place, of those steps: a step
  without the tests of its level, or with the tests of another, and a cycle in the modules' uses, naming its modules.
  `graph`, the graph `traceGraph` gives, is passed only by a caller whose steps are the commit's own — the plan page,
  with the graph it asked for with its commit —; `graphFindings` then runs on it and `source` is read for no
  graph. Without `graph`, the graph is built from `source`, as above. Crosses the network through `source` for the
  files it has not read; fails with its errors.
- `backlogFindings(items: Document[], architecture: Document[]) -> Finding[]` — an item that realises nothing; that names
  no module the architecture describes; that builds on an item that does not exist, or on one that builds on it in turn;
  and, as a warning, an item that restates an existing one.
- `sprintFacts(sprint: Document, facts: { items: Document[], tests: Array<{ id: string, guards: string[] }>, states:
  ItemState[], jobs: JobRow[], results: Snapshot, pullRequests: PullRequest[], issues: Issue[] }) -> { increment: Array<{ item: string, pullRequest: string, realises: string[],
  tests: string[] }>, notDone: ItemState[], numbers: { failedJobs: number, retriedJobs: number, correctionRounds: number,
  waitingAtGates: string, waitingForAPerson: string, flakyTests: string[], cost: string } }` — the sprint's increment,
  what is not done and why, and the numbers of the sprint, each derived; `items` are the backlog items or plan steps, from
  which an item's `realises` come, and `tests` the tests of the product with the requirements each guards, so that an
  item's tests are those that guard a requirement it realises; `results` is the branch `test-results`; a cost
  only where a job's row has one (`NO COST IS GUESSED`).
- `targetBranch(item: string, context: { sprints: Document[], order: Document | null, branches: Record<string,
  string>, defaultBranch: string }) -> string` — the branch a plan step's or backlog item's work is merged into: the
  `branch` of the sprint whose current selection names it and whose record holds neither `## Review` nor `## Increment
  given up`, where that record names one; else the branch `branches` gives the step's phase in `order`; else
  `defaultBranch` (`A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN`, `WORK MERGES INTO THE DEFAULT BRANCH
  UNLESS A BRANCH IS SET`). `branches` is the declaration's `## Branches` as MOD-product-process' `branchesOf` gives
  it. It reads nothing.
- `sprintsToClose(sprints: Document[], states: ItemState[], today: string) -> Array<{ sprint: string, closer: string,
  because: "time box ended" | "every selected item done" | "ended by the Product Owner" }>` — every sprint whose record
  holds no `## Review` and that has ended: its `end` date is before or on `today`; or, without a time box, every item of
  its selection is `done`, or its record holds `## Ended`; each with its `closer` (UC-041, an agent's close; `A SPRINT
  CLOSED BY AN AGENT STARTS BY ITSELF`). It reads nothing.
- `savePlan(host: Host, plan: { steps: Document[], order: Document, removed: string[] }, context: { architecture:
  Document[], workflow: Workflow, head: string, trailers: string[] }) -> Promise<{ commit: string, written: string[] }>` —
  **Save plan** (UC-045): `planFindings` first, and with an error finding nothing is written; a new step gets an
  identifier that no history of `docs/plan/` and `docs/backlog/` holds; one commit of one file per step under
  `docs/plan/` and `docs/plan/order.md`, the files of removed steps deleted. `trailers` are a job's provenance lines,
  empty for a person's own input — the same for every save below. Crosses the network. Errors: `PlanRefused { findings
  }`, `Moved`, `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable` — the host's errors, here and below.
- `saveItems(host: Host, change: { items: Document[], removed: string[] }, context: { architecture:
  Document[], head: string, trailers: string[] }) -> Promise<{ commit: string, written: string[], warnings: Finding[] }>`
  — **Add to backlog** and **+ Item** (UC-032), an item pointed at a replacing requirement or removed (UC-032 1a), and
  **Move to backlog** (UC-033): `backlogFindings` first, and with an error finding nothing is written; a warning — an item
  that restates an existing one — is returned with the commit; a new item gets an identifier that no history holds; one
  commit of the item files under `docs/backlog/`. An item added while a sprint runs enters the backlog, never the
  sprint's selection. Errors: `ItemsRefused { findings }`, and
  the host's.
- `startSprint(host: Host, sprint: { team: string, goal: string, start: string, closer: string, selection: string[] },
  context: { states: ItemState[], model: Model, declaration: Document, held: Held[], architecture: Document[], running:
  Document | null, head: string, trailers: string[] }) -> Promise<{ commit: string, path: string, added: string[],
  removed: string[] }>` — **Start sprint** (UC-032 step 6), for one team: `end` set to the date the model's time box gives
  from `start`, empty without one; `branch` the one the declaration gives the time box, its placeholders `<team>` and
  `<nn>` filled with the team and its next number, created from the head where it does not exist yet; `docs/backlog/sprints/<team>/<nn>.md` committed with the team's next
  number. `held` is read at the head the commit is written on, and each selected item is checked with `conflicts` (UC-032
  6c). Where the host refuses the commit with `Moved { head }`, `held` is read again at that head — `heldItems` of its
  sprint records, items and module files and of the product's pull requests —, and an item `conflicts` names there refuses
  the start with `SprintRefused`; otherwise `Moved` stands. While a sprint runs, a new start decision is appended to its file as `## Selection`, and `added` and `removed` name
  what it changes (UC-032 6a). Errors: `SprintRefused { reasons }` — an item waiting for acceptance, one selected without
  the items it builds on that are not done, or one that `conflicts` names, with the sprint, the held item and the module
  —, and the host's.
- `endSprint(host: Host, sprint: string, context: { head: string, now: Date, trailers: string[] }) -> Promise<{ commit:
  string }>` — **End sprint** (UC-032 6b): appends `## Ended` with the date to a sprint without a time box. Errors:
  `NotFound { path }` for a sprint with no record, `NotEndable` for a sprint with a time box, whose end is its date, or one
  already ended — nothing is written in either case —; and the host's.
- `closeSprint(host: Host, close: { sprint: string, review: { feedback: Array<{ line: string, goes: "new item" | "change
  to an item" | "noted", item: string | null }>, tookPart: string[], sources: string[] | null }, unfinished: Array<{ item:
  string, to: "backlog" | "next sprint", reason: string }>, retrospective: Array<{ text: string, kind: "went well" | "did
  not go well" | "change", goes: "process model" | "Definition of Done" | "a participant's instructions" | "team
  agreement" | null }>, newItems: Document[] }, context: { facts: ReturnType<typeof sprintFacts>, architecture:
  Document[], head: string, trailers: string[] }) -> Promise<{ commit: string, written: string[] }>` —
  the close of a sprint by its agent, through the writer `sprint-record` (UC-041 step 6): appends `## Review` — the increment and the items not done from `facts`, the feedback,
  who took part, for an agent the sources of its feedback —, `## Unfinished items` and `## Retrospective` to the sprint's
  file; adds the feedback's new items to the backlog as `saveItems` does, and records for each unfinished item whether it
  goes back to the backlog or into the team's next sprint; all in one commit. Then each change of the retrospective that
  `goes` to the process model, the Definition of Done or a participant's instructions is written through MOD-spec-changes'
  `proposeSection` as an open entry of the instance's SPEC: a new requirement whose rule is the change, appended to the
  section that holds the requirement governing what it changes — `THE PROCESS MODEL IS DECLARED PER PRODUCT` for the
  process model, `A PRODUCT DECLARES ITS DEFINITION OF DONE` for the Definition of Done, `AN AGENT'S RETROSPECTIVE CHANGES
  NO PROCESS BY ITSELF` for a participant's instructions —, that section found by the requirement's name. Errors: `NotFound { path }` for a sprint with no record, `RetrospectiveMissing` (UC-041 6a), `Undecided { items }` for an unfinished item
  without a decision, `AlreadyClosed`, `ItemsRefused { findings }`, and the host's.
- `giveUpIncrement(host: Host, sprint: string, reason: string, context: { head: string, trailers: string[] }) -> Promise<{
  commit: string }>` — the Product Owner giving up the increment of a closed sprint whose branch was not merged: appends
  `## Increment given up` with the date, the person and the reason, in one commit; the sprint then holds none of its items
  (UC-041 7b). Errors: `NotFound { path }`, `NotClosed` for a sprint without `## Review`, `Merged` for a sprint whose
  branch's pull request is merged, and the host's.
- `workStrategies: Strategies` — the strategies this module offers the job runner (ARC-046):
  - recipe `architecture-and-model` — the decision that states the system, the subsystems' decisions, the module files,
    the process model with its phases and gates, and the existing plan;
  - recipe `backlog-inputs` — the accepted requirements and use cases, those no item realises yet, the architecture, and
    the existing items, which its part carries as artifacts keyed by their title;
  - recipe `sprint-facts` — the sprint's facts, the product's issues opened or closed during the sprint, its job records
    and result records — each named as a source; never a mail. The sprint is the one the job's parameter `sprint` names;
    its facts are `sprintFacts` of the product's items, of its tests with what each guards (`isTestFile`,
    `testDeclarations`), of the items' states (`itemStates`, with the product's workflow), of its jobs (`listJobs`,
    without live states), of the branch `test-results` (the product host's `readSnapshot`), of its pull requests, and of
    the issues whose `opened` or `closed` falls within the sprint; where the product's host gives no issues, they are
    left out and named as not read;
  - check `plan-checks` — `planFindings` on a drafted plan, with the product's workflow and no `graph`, since its steps
    are drafted; where the product has no workflow, one error finding naming the declared model and its commit;
  - check `backlog-checks` — `backlogFindings` on drafted items;
  - step `leave-out-named-modules` — leaves out of the drafted items each item for a module that an item not yet done
    names — one whose state `itemStates` gives is not `done` —, with a finding naming that item and the module;
  - check `sprint-record-checks` — an agent's review that does not name the sources of its feedback, or does not say that
    no stakeholder took part when none did (`AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM`); a retrospective
    without an entry; a change to the process written as applied rather than proposed (`AN AGENT'S RETROSPECTIVE CHANGES
    NO PROCESS BY ITSELF`);
  - writer `plan-steps` — the drafted plan through `savePlan`, with the job's provenance lines;
  - writer `backlog-items` — the drafted items through `saveItems`, with the job's provenance lines;
  - writer `sprint-record` — an agent's close through `closeSprint`, with the job's provenance lines, under the closer's
    name; the proposals of the retrospective stay proposals.

`Workflow` is MOD-product-process'; `Model` MOD-model-catalogue's; `Queue` MOD-spec-changes'; `JobRow` MOD-job-ledger's;
`Participant` MOD-participant-list's; `Schema` and `Document` MOD-documents'; `Host`, `Snapshot`, `PullRequest` and
`Issue` MOD-repository-hosts'.

## Files

- Reads `docs/plan/`, `docs/backlog/`, `docs/backlog/sprints/`, `docs/process.md` through the workflow, the role
  assignments under `docs/role-assignments/`, the architecture
  under `docs/architecture/`, `SPEC.md`, the approval records, the change queues, `docs/jobs/`, the branch `test-results`,
  the pull requests and the issues of the product, and the history of `docs/plan/` and `docs/backlog/`.
- Writes, through its saves, `docs/plan/ITM-*.md`, `docs/plan/order.md`, `docs/backlog/ITM-*.md` and
  `docs/backlog/sprints/<team>/<nn>.md`, and creates a sprint's own branch; through MOD-spec-changes' `proposeSection`, an
  entry of the instance's SPEC change queues for each change a retrospective makes to the process.

## Uses

- MOD-product-process.Workflow, gateStates, holdsRole — the phases and gates, a gate's state, the implementing role's
  holders in a role assignment; MOD-product-process.productWorkflow — the product's workflow in a job, of its
  declaration `docs/process.md`, the instance read through its host's `readSnapshot`, and the instance's SPEC, for
  `plan-checks` and `sprint-facts`.
- MOD-model-catalogue.Model — the phases a plan's steps belong to.
- MOD-approvals.statuses, MOD-spec-changes.Queue, queues, MOD-spec-document.parseSpec — whether what an item names is
  accepted.
- MOD-spec-changes.proposeSection — a retrospective's change to the process, written as an open entry of the instance's
  SPEC.
- MOD-trace-graph.systemDecisions — the decisions of the system and of its subsystems, for `architecture-and-model`.
- MOD-trace-graph.graphFindings, TextSource — the findings of a drafted plan's steps that the graph's checks give, on a
  source of the product's files with the drafted steps in place.
- MOD-trace-graph.traceGraph, moduleOrder, coverageGaps — the order of modules by their uses, and what no item realises.
- MOD-documents.Schema, Document, loadSchema, readDocument, writeDocument, appendSection, classifyCandidates,
  artifactSchemas — the files by their schemas, the item schema, the appended sprint sections, and items that restate
  existing ones.
- MOD-identifiers.identifiersIn, nextIdentifier — new item identifiers, never one the history holds.
- MOD-job-ledger.JobRow, listJobs — the jobs of an item, with their states and costs; a product's jobs, for
  `sprint-facts`.
- MOD-test-document.isTestFile, testDeclarations — the product's tests and what each guards, for `sprint-facts`.
- MOD-participant-list.Participant — the holders of the implementing role and their capabilities.
- MOD-result-records.flakyTests — the flaky tests of a sprint.
- MOD-repository-hosts.Host, Snapshot, PullRequest, Issue, readHistory, listPullRequests, listIssues, createBranch,
  commitFiles — the product's files and history, its pull requests and issues, a sprint's branch, and the saves'
  commits; MOD-repository-hosts.readSnapshot — the branch `test-results` and the instance at a commit, in a job.
- MOD-text-tools.Finding, finding — the findings.
- MOD-job-runner.sourcesOf — the sources a part carries.
- MOD-job-runner.Strategies, JobContext, Part, JobResult, provenanceLines — the form of the strategies and the
  provenance of a drafted commit.
