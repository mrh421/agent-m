---
id: MOD-progress-measures
title: A product's facts gathered once, and its progress in every measure
folder: src/progress-measures/
realises:
follows:
  - ARC-042
uses:
  - MOD-work-plans.ItemState
  - MOD-work-plans.Held
  - MOD-work-plans.itemStates
  - MOD-work-plans.heldItems
  - MOD-work-plans.conflicts
  - MOD-work-plans.undecidedHeads
  - MOD-work-plans.planSchemas
  - MOD-product-process.Workflow
  - MOD-product-process.declarationSchema
  - MOD-product-process.productWorkflow
  - MOD-product-process.gateSchema
  - MOD-product-process.gateStates
  - MOD-product-process.roleAssignmentSchema
  - MOD-model-catalogue.Model
  - MOD-model-catalogue.planGrid
  - MOD-approvals.statuses
  - MOD-spec-changes.Queue
  - MOD-spec-changes.queues
  - MOD-spec-document.parseSpec
  - MOD-test-schedule.scheduleSchema
  - MOD-test-schedule.defaultSchedule
  - MOD-test-schedule.configurationDrift
  - MOD-result-records.resultsAt
  - MOD-release-evidence.reportsAwaitingAcceptance
  - MOD-test-document.TestDeclaration
  - MOD-test-document.testDeclarations
  - MOD-test-document.isTestFile
  - MOD-trace-graph.Graph
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.tracesTo
  - MOD-job-ledger.JobRow
  - MOD-job-ledger.listJobs
  - MOD-runtimes.jobWorkflowFiles
  - MOD-runtimes.ResourceNeed
  - MOD-resource-list.resourceSchema
  - MOD-resource-list.reachableBy
  - MOD-participant-list.Participant
  - MOD-participant-list.participantSchema
  - MOD-participant-list.participantsOf
  - MOD-documents.Document
  - MOD-documents.readDocument
  - MOD-documents.readRegister
  - MOD-documents.artifactSchemas
  - MOD-repository-hosts.containsCommit
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.RepositoryInfo
  - MOD-repository-hosts.PullRequest
  - MOD-repository-hosts.CiRun
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.listPullRequests
  - MOD-repository-hosts.listCiRuns
  - MOD-repository-hosts.listTags
provides:
  - Facts
  - productFacts
  - publishOverview
  - storedOverview
  - latestOverview
  - waitingQueues
  - ProgressView
  - BacklogView
  - progressView
  - backlogView
  - ScheduleView
  - scheduleView
  - storedView
  - progressIn
  - stageShares
  - currentStage
  - gateOverview
  - blocked
  - whoWorksOnWhat
  - buildInProgress
  - waitingForAPerson
  - waitingForAcceptance
---
# MOD-progress-measures A product's facts gathered once, and its progress in every measure

## Responsibility

It belongs to Process (ARC-042). It gathers, once per page or per entry that reads them, every fact of one product that
progress depends on, and derives from them — never from a stored status (`PROGRESS AND JOB STATE ARE DERIVED, NOT
STORED`) — the product's progress in the measure its model names (`PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE`), the
state of every gate, what is blocked and who works on what (UC-035), and, for the main page, the bar of six stages, the
stage the product is in, the build in progress and what waits for a person (`THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS
BY STAGE`, `WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS`, `THE BUILD IS SHOWN AS IT HAPPENS`). From a
repository's snapshot and tags alone it derives what waits there for the person's acceptance, for the Site's
notifications (`A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE`). For the pages of Implementation it derives from
the same facts the view each shows — what goes on now, and the backlog —, which is stored for a commit beside its overview,
so that a page reads the view of its commit and no record, fact or pull request behind it. It runs in the browser and in
Node.

## Parts

- `index.mjs` — the interface.
- `facts.mjs` — gathering a product's facts.
- `measures.mjs` — progress in the model's measure.
- `stages.mjs` — the six stages, what waits for acceptance, and the overview `publishOverview` stores.
- `stored.mjs` — what is read back from `overview-cache` (`storedOverview`, `latestOverview`, `waitingQueues`, `storedView`) and what derives
  from the facts without another module (`currentStage`, `buildInProgress`, `waitingForAPerson`): a page that shows what is stored loads it alone.
- `overviews.mjs` — gates, blocked items, who works on what.
- `views.mjs` — the views of the progress, the backlog and the schedule page: derived from the facts, as a text and back.

## Data

It keeps nothing and owns the structure `Facts`, which MOD-run-planner and the pages read, and the views `ProgressView`
and `BacklogView`, which MOD-implementation-pages draws, and `ScheduleView`, which MOD-test-pages draws. It owns five
kinds of file on the branch `overview-cache` of a repository, which `publishOverview` writes; the first four it adds and
no one changes or deletes:
- `<commit>.json`, the overview of that commit that the pages read in place of the files: `{ commit, shares, waiting,
  model, build, queues }` — the stage shares and what waits for a person, as `stageShares` and `waitingForAPerson` give
  them for the facts of that commit; the name of the declared model, or `null`; the build, `{ states, records }`: the
  states of the steps or items in progress that a job works on, as `buildInProgress` takes them — derived with every
  pull request of the repository —, and the records of those jobs as the commit holds them, each `{ path, text }`; and
  the change queues with an entry that is not in the SPEC yet, as MOD-spec-changes' `queues` gives them. It is small, so
  that a page reads it in one short request;
- `<commit>.progress.json.gz` and `<commit>.backlog.json.gz`, the views of that commit that the routes `progress` and
  `backlog` of MOD-implementation-pages draw in place of the facts: what `progressView` and `backlogView` give for the
  facts of the scope `all` at that commit, as JSON, gzipped as the trace graph is (MOD-trace-graph). Each holds what its
  page shows and nothing else: no record's text, no pull request;
- `<commit>.schedule.json.gz`, the view of that commit that the route `schedule` of MOD-test-pages draws in place of
  the test files: what `scheduleView` gives for the facts of the scope `all` at that commit, as JSON, gzipped as the
  other views; it holds the counts of the tests and no declaration;
- `latest.json`, `{ commit }`: the commit of the overview stored last, which `publishOverview` writes again with every
  commit that adds a file of the three above, and which a page reads (`latestOverview`, `storedView`) while the overview
  or the view of its head is not stored yet.

The six stages of the main page, each a share between 0 and 1:

| Stage | Share |
|---|---|
| Requirements | the share of the product's SPEC change entries that are decided; full when the SPEC holds requirements and no change is open |
| Use cases | the share of the use cases that are accepted |
| Architecture | the share of the architecture's files — decisions and module files — that are accepted |
| Implementation | the share of the steps of the implementation plan, or of the backlog items, that are done; without a declared process model, no share, and the stage says that the process is configured when implementation starts |
| Tests | the share of the requirements that a passing test guards on the default branch; a test passes by the newest result record of a commit of the default branch that ran it |
| Release | full once the product's first release is tagged |

## Interfaces

- `Facts` — one product's facts: `{ address: string, info: RepositoryInfo | "unknown", snapshot: Snapshot, graph: Graph | "unknown",
  requirements: string[] | "unknown", statuses: Map<string, { id: string, kind: string, status: string }>, queues: Queue[],
  declaration: Document | null, workflow: Workflow | null | "unknown", model: Model | null | "unknown", modelUnread: {
  commit: string, error: string } | null, modelSince: string | null | "unknown", participants:
  Participant[], plan: { order: Document | null, items: Document[], states: ItemState[] }, sprints: Document[],
  assignments: Document[], held: Held[], gates: Document[], gateStates: Array<{ gate: string, state: string, record: string | null, needs:
  string | null, difference: string | null }>, jobs: JobRow[], pullRequests: PullRequest[] | "unknown", schedule:
  Document | "unknown", ci: { runs: CiRun[] | "unknown", configured: boolean, drift: Array<{ path: string, difference:
  string }>, jobWorkflow: boolean } | "unknown", tags: Array<{ name: string, commit: string }> | "unknown", results:
  Snapshot | null | "unknown", tests: TestDeclaration[] | "unknown", resourceNeeds: ResourceNeed[] | "unknown",
  resultCommits: string[] | "unknown", own: boolean, modules: Document[] }`: `requirements` the accepted ones;
  `model` the declared model as the
  instance's catalogue held it at the commit the declaration's `model_version` names — the version the product declared
  and keeps (UC-031 6a) —, and `workflow` derived from it. Both are `"unknown"` when that commit cannot be read, and
  `modelUnread` then names the commit and the error it was read with. `modelSince` is the date the declared model was
  declared; `plan`
  the steps of the implementation plan in their order, or the backlog items after the items they build on, with their
  states; `sprints` the sprints of every team, a team's running or last sprint being its newest; `assignments` the
  role assignments; `held` what the teams' sprints hold (MOD-work-plans' `heldItems`), and `modules` the architecture's
  module files it is computed with; `jobs` every job of the product, each with the state its record gives — a caller
  that asks the live
  states of those that have not ended derives the rows again with MOD-job-ledger's `listJobs` —; `schedule` the product's test schedule, or the book's default where none is saved; `ci.runs`
  the runs of the default branch's head; `ci.configured` whether the configuration Agent M generates from the schedule
  is present, `ci.drift` how it differs from the schedule, `ci.jobWorkflow` whether the job workflow of MOD-runtimes is
  present; `results` the branch `test-results`, `null` while there is none; `resultCommits` the commits of the default
  branch that `results` holds records of (`runs/<commit>/`), newest first by the default branch's history (`readHistory`,
  `changes: false`), empty while there is no `results`, and `"unknown"` when that history cannot be read; `own` whether
  the product's repository is the instance's own, the repository of `instance`; `resourceNeeds` the routes that reach the
  product's resources, `reachableBy` of MOD-resource-list over its `docs/resources.md`, which a caller hands to
  MOD-runtimes' `routesFor` for a job whose kind needs the product's resources. A fact only the server gives — `info`,
  `pullRequests`, `ci.runs`, `tags` — is `"unknown"` when the host does no server operations; whatever depends on an
  unknown fact is derived as unknown — a share `null`, a state `unknown` — and never guessed.
- `productFacts(host: Host, instance: Snapshot, instanceAt: (commit: string) -> Promise<Snapshot>, now: Date,
  options?: { scope: "all" | "work" | "build" }) -> Promise<Facts>` — with the scope `build`, what
  `buildInProgress` takes and nothing else — the plan or the backlog, the job records and the pull requests —; with the scope `work`, it reads only what MOD-work-plans' `itemStates` and `startable` and MOD-product-process'
  `holdsRole` take — the approval statuses, the change queues, the declaration with its model and workflow, the
  participants, the plan or the backlog, the sprints, the role assignments, the gate records with their states, the job
  records without asking their live state, and the pull requests with `held` —, and every other fact is `"unknown"`.
  With the scope `all`, the default, it reads everything once: the default branch of the product — through a
  local clone, the branch it has checked out — and what the repository says about it, the approval
  records, the change queues, the declaration with its model and practices as the instance's catalogue held them at the
  commit the declaration's `model_version` names, read with `instanceAt`, and the history of the declaration, the
  instance's participants, the plan or the backlog
  and the sprints, the gate records, the job records, the pull
  requests — and, for the head commits MOD-work-plans' `undecidedHeads` names, whether the default branch contains them,
  through the host's `containsCommit`, asked for all of them at once, which `held` is computed with —, the CI runs of the head, the tags, the branch `test-results`, the test declarations of the files MOD-test-document's `isTestFile` names and the resource list. It builds no trace graph: `graph` is `"unknown"` in both scopes, and a view that shows traces builds them with MOD-trace-graph's `traceGraph` when it is drawn.
  Considers:
  - `instance` is the instance as the caller reads it, for its participants, process models and `SPEC.md`: on a page
    its default branch; in CI the checkout of the instance at the commit of Agent M that runs (MOD-workflow-entries).
  - `instanceAt` reads the instance at any commit, for the commit a declaration names. That is another commit than the
    one a CI job checks out, and the two are not related.
    - On a page, `instanceAt` reads through the frame's host of the instance.
    - In CI and on a Bridge, it reads through the instance's checkout or clone, connected as a host. A commit the clone
      does not hold is fetched from its origin with the clone's own credentials (MOD-repository-hosts' `readSnapshot`).
      So it reaches the commit exactly as far as the checkout or clone reached the instance, through no API and with no
      further token.
  - When `instanceAt` cannot read the commit, `productFacts` does not fail. `model` and `workflow` are `"unknown"`, as a
    fact a host cannot give is, and whatever depends on them is derived as unknown, never guessed. `modelUnread` keeps
    the error, which tells the causes apart:
    - `NotFound`: the instance does not hold the commit the declaration names;
    - `TokenRefused`, `PermissionMissing` or `Unreachable`: the instance cannot be read from there.
  - It also accepts a host that does no server operations, such as a Bridge's local clone, whose functions for the pull
    requests, the CI runs, the tags and the repository's information refuse with `NotSupported`: those facts are then
    `"unknown"`.
  - It asks no job's live state: the rows of `jobs` give the state of the record. A caller that asks the live states —
    from the CI service, from the Bridges and from this tab, through MOD-runtimes' `liveState` — derives the rows again with `listJobs`; a
    runtime that does not answer leaves its jobs as their records say, marked as not reachable (UC-036 1a), and progress is
    still computed from the repository.
  - Crosses the network. Errors, all of the product's host: `NotFound` (a private repository without a token that
    reaches it), `TokenRefused`, `RateLimited`, `Unreachable`.
- `progressIn(facts: Facts, now: Date) -> { measure: string, planned: { grid: { entries: Array<{ requirement: string,
  phase: string, state: "open" | "in progress" | "done" }>, count: string }, timeline: Array<{ phase: string, from: string
  | null, to: string | null, gate: string | null, passed: string | null }>, steps: ItemState[] } | null, sprints: Array<{ team:
  string, items: ItemState[], burnDown: Array<{ day: string, remaining: number }>, final: boolean }>, flow: { columns: Array<{
  name: string, items: string[] }>, wip: number | null, cumulative: Array<{ day: string, counts: Record<string, number>
  }> } | null, since: string | null }` — the progress in the declared model's measure. For a planned model, the grid of
  every accepted requirement in every phase, each cell done when what the phase produces for the requirement is accepted
  — or, for implementation and tests, merged and passing —, in progress while it is open or a job works on it, and open
  otherwise; the phases on a timeline with their gates as milestones; beside it the steps of the implementation plan with
  their states; with no accepted requirement, the phases empty. For a model with time boxes, for each team its sprint's items
  and the remaining items per day of the sprint; for a team with no running sprint, its last sprint's final burn-down.
  For a model with a work-in-progress limit, the board with its columns and its limit — counted per team in a model with
  sprints — and the items per state per day. Each item's state on
  a day is dated by the records and the pull requests. After a change of model, `since` is the change, and the chart starts
  there. Errors: `NoModel` when the product declares none.
- `stageShares(facts: Facts) -> Promise<Array<{ stage: string, share: number | null, detail: string }>>` — the six
  stages of the table above, in their order; a stage whose share needs an unknown fact has none, and its detail says
  which. The Tests stage takes, for each test, its outcome at the first of `resultCommits` whose records name it
  (MOD-result-records' `resultsAt`); a test no such record names is not run. For the instance's own repository (`own`),
  which has no product, the same bar for Agent M, full once its first release is tagged.
- `currentStage(shares: Array<{ stage: string, share: number | null }>) -> string | null` — the first stage that is not
  full; null when every stage is full.
- `gateOverview(facts: Facts) -> Array<{ gate: string, state: "passed" | "passed on an earlier text" | "rejected" |
  "pending" | "not reached", decided: { by: string, date: string, on: string, record: string } | null, needs: string |
  null, difference: string | null, addedBy: { requirement: string, source: string } | null }>` — the workflow's gates in
  their order: passed with who decided, when and on which text, and the record; pending with what it still needs; not
  reached; a gate whose record names a text that has changed since, as passed on an earlier text, with the difference;
  each gate a process requirement adds, with its requirement and source. `decided` is given for each gate whose state
  rests on a record — passed, passed on an earlier text, rejected — and is null for a pending or not reached one; a
  workflow that is null or `"unknown"` has no gate to list, and the list is empty.
- `blocked(facts: Facts) -> Array<{ item: string, reason: "failed job" | "waiting at a gate" | "requirement not
  accepted" | "work-in-progress limit" | "held by another team's sprint", detail: string }>` — every item or plan entry
  that cannot move, each with its reason; for a gate, the role or check that decides it; for a held module, the other
  team's sprint and the module, as MOD-work-plans' `conflicts` gives them over `held` and `modules`.
- `whoWorksOnWhat(facts: Facts) -> { participants: Array<{ participant: string, roles: string[], teams: string[], jobs:
  string[] }>, held: Held[], unreachable: Array<{ route: string, reason: string | null }> }` — each participant of the
  product with its roles, its teams in a product with several teams, and its current jobs; what each team's sprint holds; and each source of jobs that could not be read, whose running jobs are not shown. A job record
  that cannot be read names no route: it stands as a source of its own, its path as `route`, with the reason it could not
  be read; a source not reached with different reasons is listed once for each.
- `buildInProgress(facts: Facts) -> Array<{ item: string, job: string, participant: string, state: string, elapsed:
  number, reachable: boolean }>` — the steps or items in progress, each with the job working on it, its participant,
  state and elapsed time, jobs on Bridges included; a job whose runtime does not answer is listed as not reachable, with
  the state its record gives; a step or item leaves the list as done once its pull request is merged.
- `waitingForAPerson(facts: Facts) -> Array<{ kind: "use case" | "SPEC change" | "gate" | "failed job", id: string, path:
  string }>` — what waits for a person in the product: open use cases, open SPEC change entries, gates whose decider is a
  person and that are pending, failed jobs; `path` is the file or record it concerns, from which the page links to where
  it is decided.
- `ProgressView` — what the route `progress` shows of one commit: `{ commit: string, declared: boolean, modelFile: string
  | null, modelUnread: { commit: string, error: string } | null, model: { name: string, kind: string, sprints: boolean,
  wip: number | null, measure: string | null } | null, measure: <progressIn's result> | null, teams: Array<{ team: string,
  sprint: { name: string, path: string, goal: string, start: string, end: string, branch: string, closer: string, ended:
  string | null, final: boolean, endable: boolean, items: Array<{ item: string, path: string | null, title: string, state:
  ItemState, changes: string[], uses: string[] }>, merges: Array<{ item: string, at: string }> } | null }>, gates:
  <gateOverview's result>, blocked: <blocked's result>, who: <whoWorksOnWhat's result> }`. `teams` are the teams of the
  role assignments and the sprints, each with its running sprint — its newest whose record holds no `## Review` —, or
  null; `final` a running sprint whose time box is over or that was ended; `merges` for each done item of the sprint the
  time of the earliest merged pull request that names it, in its branch or its title, from which the page draws the
  burn-down; `measure` is `progressIn`'s, in a model with sprints over the running sprints alone; `blocked` the items the
  running sprints hold, in a model with sprints.
- `BacklogView` — what the route `backlog` shows of one commit: `{ commit: string, declared: boolean, modelFile: string |
  null, modelUnread: { commit: string, error: string } | null, model: <as in ProgressView>, teams: Array<{ team: string,
  owner: string, running: { name: string, path: string, goal: string, closer: string, selection: string[] } | null,
  lastEnded: { name: string, path: string, start: string, end: string, items: string[], merges: Array<{ item: string, at:
  string }> } | null }>, rows: Array<{ item: string, path: string, title: string, realises: string[], state: ItemState,
  held: Held | null, kept: Array<{ team: string, sprint: string, item: string, module: string | null }> }>, uncovered: {
  requirements: string[], useCases: string[] } }`. `rows` are every item of the backlog, each after the items it builds
  on, as `itemStates` orders them; `kept` what keeps an item from each team other than the one whose sprint holds it, as
  MOD-work-plans' `conflicts` gives it; `owner` the first holder, in the team's role assignment, of the role of the phase
  that produces items, who closes its sprint unless another is named; `lastEnded` the team's last sprint that has ended,
  with its items and their merges, `end` the last day of its final burn-down; `uncovered` the accepted requirements and
  use cases no item realises.
- `progressView(facts: Facts, now: Date) -> ProgressView` — the view of the route `progress` of the facts, derived as
  `progressIn`, `gateOverview`, `blocked`, `whoWorksOnWhat` and MOD-work-plans' `conflicts` derive. Pure; the same
  whether `publishOverview` derives it in CI or a page derives it where none is stored.
- `backlogView(facts: Facts, now: Date) -> BacklogView` — the view of the route `backlog` of the facts, derived as
  `progressView` derives its view. Pure; the same whether `publishOverview` derives it in CI or a page derives it where
  none is stored.
- `ScheduleView` — what the route `schedule` shows of one commit's tests: `{ commit: string, counts: { unit: number,
  component: number, system: number, release: number, user: number, paid: number } }`, the number of the test
  declarations of each level, and of those that call a paid service.
- `scheduleView(facts: Facts) -> ScheduleView` — the counts of `facts.tests`. Pure; `publishOverview` adds
  `<commit>.schedule.json.gz` from it, in the same commit as the other views, and a file the branch holds already is left
  as it is.
- `publishOverview(host: Host, snapshot: Snapshot, facts: Facts) -> Promise<{ commit: string, written: boolean }>` —
  adds `<commit>.json`, `<commit>.progress.json.gz` and `<commit>.backlog.json.gz` to the branch `overview-cache` in one
  commit by `commitFiles`, on the head it read: the overview and the two views listed under Data, from `facts` read with
  the scope `all` at the snapshot's commit. A file the branch holds already is left as it is; `written` is `false` when it
  holds all three. A commit that adds any also writes `latest.json` naming the
  snapshot's commit; where it adds none, `latest.json` is left as it is. Crosses the network; fails as `commitFiles` fails, with `NotFound` naming the branch when the
  repository has none.
- `storedOverview(snapshot: Snapshot) -> Promise<{ shares: Array<{ stage: string, share: number | null, detail: string }>,
  waiting: Array<{ kind: string, id: string, path: string }>, model: string | null, build: { states: ItemState[],
  records: Array<{ path: string, text: string }> }, queues: Queue[] } | null>` — the overview stored for the snapshot's
  commit, as listed under Data, read with the snapshot's `readOn` in one request, once for each commit in a page however
  many snapshots and callers ask, since a commit's overview never changes; `null` without `readOn`, or when the branch or the file is missing or holds another format — an overview
  without the model, the build and the queues among them.
- `latestOverview(snapshot: Snapshot) -> Promise<{ commit: string, shares, waiting, model, build, queues } | null>` — the
  overview stored last on the branch, whichever commit it is of: the commit `latest.json` names and that commit's
  overview, as `storedOverview` gives it, read with the snapshot's `readOn` in two requests. What a page shows while
  the overview of its head is not stored yet, never deriving one itself; `null` without `readOn`, or when the branch,
  `latest.json` or the overview it names is missing or holds another format.
- `waitingQueues(snapshot: Snapshot) -> Promise<{ queues: Queue[], asOf: string | null }>` — the change queues with an
  entry that is not in the SPEC yet, each entry with its state: those of `storedOverview`, and `asOf` null; while that
  is not stored yet, those of `latestOverview`, and `asOf` its commit; where the repository stores no overview, those
  MOD-spec-changes' `queues` derives from every queue of the snapshot, and `asOf` null. The one reading of the waiting
  queues, for the pages and for `waitingForAcceptance`. Crosses the network through the snapshot; fails with the host's
  errors but `NotFound`.
- `storedView(snapshot: Snapshot, page: "progress" | "backlog" | "schedule") -> Promise<{ view: ProgressView | BacklogView | ScheduleView, asOf:
  string | null } | null>` — the page's view of the snapshot's commit, read with the snapshot's `readOn` in one request,
  and `asOf` null; while that is not stored yet, the view of the commit `latest.json` names, in two requests more, and
  `asOf` that commit — what a page shows, with the line `As of <asOf, 7 characters>: the view of the newest commit is
  being stored.`, never deriving one itself. `null` without `readOn`, or where neither is stored or one holds another
  format. Crosses the network; fails with the host's errors but `NotFound`.
- `waitingForAcceptance(host: Host, snapshot: Snapshot) -> Promise<Array<{ kind: "SPEC change" | "use case" |
  "architecture decision" | "module" | "release test report", id: string, path: string, blob: string }>>` — what waits
  for the person's acceptance in one repository, the instance's or a product's, the snapshot being its default branch
  through `host`, derived from its files, records, tags and stored overview alone, as `waitingForAPerson` derives open use cases and SPEC
  changes (`A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE`, `STATUS IS DERIVED FROM THE RECORDS`): every entry of the
  queues `waitingQueues` gives in the state `open`, `stale` or `waiting for its anchor`; every use case, architecture
  decision and module file whose status is `open` or `changed` (MOD-approvals); and the release test report that waits
  for *Accept and release*, if one does (MOD-release-evidence' `reportsAwaitingAcceptance`). `id` is the identifier an
  approval record names it by — `UC-<nnn>`, `ARC-<nnn>`, `MOD-<slug>`, `spec-<queue>-<NN>` for an entry,
  `release-v<version>` for a report —; `path` is its file — for an entry its proposal, for a report the record of its
  candidate's complete run —; `blob` is that file's blob. Considers: it reads the snapshot, the tags and the stored
  overview, not the product's facts, so that a caller that asks every few minutes reads no pull requests, CI runs or test results, and job
  records only while a release candidate is pending, newest first and no further back than the first run of a candidate.
  Crosses the network through the host and the snapshot, for the texts it has not read yet; fails with their errors —
  `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable` —, and with `NotSupported` through a host that does
  no server operations.

`Workflow` is MOD-product-process'; `Model` MOD-model-catalogue's; `ItemState` MOD-work-plans'; `Queue`
MOD-spec-changes'; `TestDeclaration` MOD-test-document's; `Graph` MOD-trace-graph's; `JobRow` MOD-job-ledger's;
`Participant` MOD-participant-list's; `Document` MOD-documents'; `Host`, `Snapshot`, `RepositoryInfo`, `PullRequest` and
`CiRun` MOD-repository-hosts'.

## Files

- Reads, for `productFacts`: the product's `SPEC.md`, `docs/approvals/`, `docs/spec-freigaben/`, `docs/use-cases/`,
  `docs/architecture/`, `docs/process.md` and its history, `docs/plan/` or `docs/backlog/` with `docs/backlog/sprints/`,
  `docs/role-assignments/`,
  `docs/gates/`, `docs/jobs/`, `docs/tests/schedule.md`, the generated configurations, the test files, `docs/resources.md`
  and the branch `test-results`; its pull requests, CI runs and tags; of the instance, `docs/participants.md`, the process models and `SPEC.md`, whose requirements are the process
  requirements, and the process models at the commit the product's declaration names.
- Reads, for `waitingForAcceptance`, through the snapshot it is given: `docs/approvals/`, `docs/use-cases/` and
  `docs/architecture/`, and through `waitingQueues` the overview, or `docs/spec-freigaben/` where none is stored; and, through MOD-release-evidence, the tags, `docs/tests/releases/` and,
  only while a release candidate is pending, `docs/jobs/` back to the first run of a candidate.
- Reads, for `storedOverview`, `latestOverview`, `waitingQueues` and `storedView`, `<commit>.json`, `<commit>.progress.json.gz`,
  `<commit>.backlog.json.gz` and `latest.json` on the branch `overview-cache`.
- Writes, for `publishOverview`, `<commit>.json`, `<commit>.progress.json.gz` and `<commit>.backlog.json.gz` on the
  branch `overview-cache`, only by adding, and `latest.json` there, in the same commit.
- Reads, for `storedView`, and writes, for `publishOverview`, `<commit>.schedule.json.gz` on the branch
  `overview-cache`, as the other views.

## Uses

- MOD-work-plans.ItemState, Held, itemStates, heldItems, undecidedHeads, planSchemas — the steps and items, their order, the sprints,
  what they hold, and each one's state; MOD-work-plans.conflicts — what keeps an item from its team's selection, for
  `blocked` and for the backlog's view.
- MOD-product-process.Workflow, declarationSchema, productWorkflow, gateSchema, gateStates, roleAssignmentSchema — the
  declared process, its gates and their states, and the role assignments. The workflow is `productWorkflow`'s, read with
  the instance's SPEC, where the process requirements stand.
- MOD-model-catalogue.Model, planGrid — the declared model, `productWorkflow`'s `model`, and its plan of requirements
  times phases.
- MOD-approvals.statuses — accepted, open and changed files, for the stages and for what waits.
- MOD-spec-changes.Queue, queues — decided and open SPEC changes, for the stages and for what waits.
- MOD-spec-document.parseSpec — the requirements.
- MOD-test-schedule.scheduleSchema, defaultSchedule, configurationDrift — the schedule, or its default, and whether the
  CI configuration is generated from it.
- MOD-result-records.resultsAt — the outcomes recorded for the default branch.
- MOD-release-evidence.reportsAwaitingAcceptance — the release test report that waits for acceptance, if one does.
- MOD-test-document.TestDeclaration, testDeclarations, isTestFile, MOD-trace-graph.Graph, traceGraph, tracesTo — which
  tests guard which requirement, which files are test files, and the traces behind a cell of the grid.
- MOD-job-ledger.JobRow, listJobs — the product's jobs with their states, elapsed times and costs.
- MOD-runtimes.jobWorkflowFiles, ResourceNeed — the paths of the job workflow, and the type of a resource need.
- MOD-resource-list.resourceSchema, reachableBy — the product's resources and the routes that reach them.
- MOD-participant-list.Participant, participantSchema, participantsOf — the participants and their roles.
- MOD-documents.Document, readDocument, readRegister, artifactSchemas — the files by their schemas, the items and the
  module files among them.
- MOD-repository-hosts.Host, Snapshot, RepositoryInfo, PullRequest, CiRun, readSnapshot, readHistory, repositoryInfo,
  listPullRequests, listCiRuns, listTags — the repository's state and the history that dates it; the snapshots
  `instanceAt` gives of the instance at the commit a declaration names; `commitFiles` — `publishOverview`'s one commit
  to the branch `overview-cache`; `Snapshot.readOn` — the stored overview and views of a commit, and `latest.json`.
