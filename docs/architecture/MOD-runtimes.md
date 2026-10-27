---
id: MOD-runtimes
title: The three routes a job takes
folder: src/runtimes/
realises:
follows:
  - ARC-046
uses:
  - MOD-job-runner.runJob
  - MOD-job-runner.provenanceLines
  - MOD-job-runner.driverPrompt
  - MOD-job-runner.Driver
  - MOD-job-runner.Prepared
  - MOD-job-runner.JobContext
  - MOD-job-runner.JobResult
  - MOD-job-runner.Strategies
  - MOD-job-runner.WriteOutcome
  - MOD-job-ledger.startRecord
  - MOD-job-ledger.appendToRecord
  - MOD-job-ledger.jobCost
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.JobStart
  - MOD-job-ledger.JobRecord
  - MOD-job-ledger.LiveState
  - MOD-endpoint-calls.endpointDriver
  - MOD-endpoint-calls.endpointExchange
  - MOD-endpoint-calls.EndpointConfig
  - MOD-participant-list.Participant
  - MOD-participant-list.reachedThrough
  - MOD-participant-list.eligible
  - MOD-job-catalogue.KindDefinition
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.listCiRuns
  - MOD-repository-hosts.cancelCiRun
  - MOD-repository-hosts.ciRunLog
  - MOD-repository-hosts.startWorkflow
  - MOD-repository-hosts.openPullRequest
  - MOD-repository-hosts.listPullRequests
  - MOD-repository-hosts.readHistory
  - MOD-repository-hosts.readFileAt
  - MOD-repository-hosts.HistoryEntry
  - MOD-repository-hosts.PullRequest
  - MOD-repository-hosts.CiRun
  - MOD-repository-hosts.repositoryInfo
  - MOD-work-plans.targetBranch
  - MOD-work-plans.planSchemas
  - MOD-product-process.declarationSchema
  - MOD-product-process.branchesOf
  - MOD-documents.readDocument
  - MOD-bridge-client.Bridge
  - MOD-bridge-client.ask
  - MOD-bridge-client.handOver
  - MOD-bridge-client.bridgeJobs
  - MOD-bridge-client.bridgeJobLog
  - MOD-bridge-client.cancelOnBridge
  - MOD-test-document.testDeclarations
  - MOD-trace-graph.traceGraph
  - MOD-browser-store.openStore
  - MOD-browser-store.readSetting
  - MOD-browser-store.writeSetting
  - MOD-identifiers.instanceOfPagesAddress
provides:
  - Route
  - RouteOffer
  - ResourceNeed
  - routesFor
  - queueJob
  - handOverJob
  - tabContext
  - runOnTab
  - bridgeDriver
  - resumeJob
  - liveState
  - jobLog
  - cancelJob
  - retryJob
  - jobTrail
  - revertAfterCancel
  - jobWorkflowFiles
  - gitlabVariableScopes
  - routeStrategies
---
# MOD-runtimes The three routes a job takes

## Responsibility

It belongs to Participants and jobs (ARC-046). It puts the three routes a job can take — this browser tab, CI, a Bridge
— behind one interface (`A RUNTIME IS INTERCHANGEABLE`): which routes a participant has; queueing a job by its start
record; running it in the tab, with the driver of an endpoint — called directly or through the Bridge its configuration
names — or of an agent on a Bridge; resuming it after its gate;
asking its runtime for its live state and log; cancelling and retrying it. A conversation of the prompt bar runs in the
tab as a job without a record (`A JOB IS RECORDED IN ITS PRODUCT REPOSITORY`); the work it hands over is queued here as a
job of its own, whose record names its inputs and whose task travels with the hand-over, never in the record (`A
CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON`). It also gives a product the files of Agent M's
job workflow, and offers the writer that checks and records a coding participant's branch and pull request. The page uses
it in a browser; its writer and its workflow files are used in Node as well.

## Parts

- `index.mjs` — the interface.
- `routes.mjs` — which routes a participant has.
- `tab.mjs` — jobs running in this tab, kept in memory while the tab is open.
- `ci.mjs` — the CI route: queueing, live state, log and cancel through the repository host.
- `bridge.mjs` — the Bridge route through the Bridge client, and the driver of an agent or an endpoint on a Bridge.
- `workflow/github.yml`, `workflow/gitlab.yml` — the templates of the job workflow.
- `pull-request.mjs` — the writer `branch-and-pull-request`.
- `hand-over.mjs` — a conversation's work handed over.
- `retry.mjs` — a job started again: `retryJob`.
- `trail.mjs` — what a job left in its product: `jobTrail`.

## Data

It keeps, in memory, the jobs running in this tab, the result of each job of this tab that waits at a gate, and, where
this browser cannot keep its identifier, this tab's own (below); nothing else — this browser's identifier is kept by
MOD-browser-store. A job running in a tab lives as long as the tab; its record then shows it as ended without record
(UC-036).

**This browser**, for the tab's route, is the identifier MOD-browser-store keeps under `browser` in the store of the
instance whose Pages address the tab shows (`instanceOfPagesAddress` of the tab's location). Only `queueJob` makes it:
it reads it, or, where it is not set, makes it as MOD-browser-store's catalogue describes it, and stores it there.
Where the tab's address names no instance, or the browser refuses `localStorage` (`StorageUnavailable`), `queueJob`
makes an identifier of the same form for this tab alone and keeps it in memory, so that no other browser reads the job
as its own. `liveState` only reads: this browser's identifier and this tab's own, each where there is one, are this
browser's; every other browser a `## Taken` names is another. A `## Taken` of bare `tab`, which names no browser, is
read as this browser's.

**Agent M's job workflow in a product.** On GitHub, the file `.github/workflows/agent-m-jobs.yml`; on GitLab, the file
`.gitlab/agent-m-jobs.yml`, which the product's `.gitlab-ci.yml` includes. It is started:

| Event | Entry of MOD-workflow-entries it runs |
|---|---|
| a push to the default branch that changes `docs/jobs/` or `docs/gates/` | `onRecordsChanged` |
| a pull or merge request closed or merged | `onPullRequestClosed` |
| a CI check completed | `onCheckCompleted` |
| a schedule, once a day | `onSchedule` |
| a start from the server's own page, with a job's identifier (UC-010, UC-024), or from a hand-over, with the identifier of the job it queued and the task (UC-049 4a) | `onDispatch` |

Its start from a page or a hand-over takes the inputs `job`, the job's identifier, and, for a hand-over, `task`, the
task in the participant's words, `endpoint`, the address and model of a model endpoint, and `secret`, the name of the CI
secret of that endpoint's key; the task is given to the job and written to no file, and the run's answer is left in the
run's own log and summary, never in the job's record. It reads the person's token from the CI secret `AGENT_M_TOKEN` and
an agent's key from the secret the participant's route names; the file names each secret it reads by its literal name,
never by a name computed while it runs; the dashboard names them and opens the server's page for secrets, and never asks
for a value. Each job checks out the instance repository at the commit the file names and runs an entry of
MOD-workflow-entries with Node.

A run has two machines (`A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET`, `A HOSTED JOB WRITES WITH THE PERSON'S
TOKEN FROM A CI SECRET`). For each route of the product's CI agents — the server's own runners, and each self-hosted
runner by its label — the file has three kinds of job, on GitHub and on GitLab alike:

| Job | Runs on | Secrets it receives | What it does |
|---|---|---|---|
| `<route>-plan` | the server's runners | none | on a start or a push to the default branch: `chooseAgentKey` names the key of the run's job |
| `<route>-agent-<n>` | the route's runner | the n-th key the file reads; none for 0 | only where the plan named its n: the job's entry, then `leaveResult` |
| `<route>` | the server's runners | the person's token and every key | `writeResult`, or the entry of an event that runs no agent; then deletes the result |

On GitLab each job's name begins with `agent-m-`. How a job comes to receive only its secrets is the server's:

- **GitHub** sends a job's runner only the secrets the job names, by their literal names. The agent's job of the n-th key
  names that key's secret alone, the job that writes the token's and every key's, the plan none. The plan gives the
  number as its output `agent`; only the agent's job of that number starts.
- **GitLab** gives a job every CI/CD variable of the project unless the variable is scoped to an environment, which only
  the jobs of that environment receive; a dynamic choice of a variable is not possible. So each job's environment decides
  what it receives: the plan and the agent's job 0 are of no environment, the agent's job of a key of the environment
  `agent-m-key-<the key's name>`, the job that writes of `agent-m-write`, each with the action `verify`, which makes no
  deployment. The person scopes the token to `agent-m-write` alone and each key once to its `agent-m-key-<name>` and once
  to `agent-m-write`, as `gitlabVariableScopes` names them; the Settings page names those scopes and checks them
  (MOD-settings-pages). A rule cannot read what an earlier job of the pipeline gives, so every agent's job of a run
  starts, and its first line ends it, before anything runs, unless the plan's dotenv report `AGENT_M_AGENT` names its
  number. No job takes the product's `default:` or global `variables:`, so that nothing of the product's own pipeline runs
  beside the token or a key. The job that writes runs untagged; a self-hosted runner of a route takes no untagged job.

The agent's machine is the agent's job: it receives the one key of the participant the run names, never the person's
token. It reads the product with the workflow's own read access — GitHub's checkout, GitLab's clone of the project — and
clones the instance without a token; on GitHub neither checkout keeps the workflow's token (`persist-credentials:
false`), since nothing on that machine fetches with it (`NO MODEL READS A CREDENTIAL`). It installs no coding agent: a
start that names an `endpoint` runs that endpoint's job in Agent M's own loop, with the tools of MOD-checkout-tools in
the product's checkout (MOD-workflow-entries). On the server's runners the agent's job names the model's user,
`AGENT_M_MODEL_USER: "agent-m-model"`, as whom that job runs beside the key holder (MOD-workflow-entries, *The model's
user*); a self-hosted runner's names none (`""`). It writes nothing to the
product: what the job commits lands in the run's result, which it leaves as an artifact of the job — on GitHub kept one
day, on GitLab kept one hour and downloadable by no one, only the jobs of the pipeline that need it taking it. The
writing machine is the job that writes: it runs no agent and calls no model, downloads the result, refuses it where it
changes the repository's workflow files or holds a key of the run, and otherwise writes it with the person's token
(MOD-workflow-entries, `writeResult`) — on GitLab pushing through a credential helper of the product's clone alone, which
gives the token to the project's own server only. Then, written or refused, it deletes the result's artifact through the
server's API with the person's token: on GitHub each agent's job's artifact by the identifier the job gives as its
output; on GitLab each artifact of an agent's job of its route, found among the jobs of the pipeline the server lists
(`GET /projects/:id/pipelines/:pipeline_id/jobs`, `DELETE /projects/:id/jobs/:job_id/artifacts`), since GitLab keeps the
newest pipeline's artifacts past their expiry. While the result is kept, anyone who may read the repository's runs may
download it on GitHub. The writing machine runs on the server's runners for every route, so that the token never
reaches a self-hosted runner an agent has worked on.

The instance is read on the agent's machine with the workflow's own read access, which reaches the product itself and any
public repository. A private instance that is not the product is not reachable there: the agent's job then fails at the
instance's checkout, naming it, and such a product's jobs run in the tab or on a Bridge. On GitLab the instance, which
stands on github.com, is cloned without a token on every machine, since the person's token is the GitLab server's.

The file is not the product's test configuration, which starts no run for job records
(`A JOB RECORD STARTS NO CI RUN`), and it does not check the Definition of Done: the test configuration MOD-test-schedule
generates does, through `onDoneCheck`. Moving a product to a newer commit of the instance is writing the file again, on
a person's decision. A job queued on the CI route records, as the Agent M commit it runs at, the commit the product's file
pins — the commit the run's checkout of the instance is at —, not the commit the page that queued it was served from.

## Interfaces

- `Route` — `{ kind: "tab" } | { kind: "ci", runner: "hosted" | string } | { kind: "bridge", bridge: string }`: where a
  job runs; a runner other than `hosted` is a self-hosted runner's label.
- `RouteOffer` — `{ route: Route, available: boolean, reason: string | null }`: a route and, if it cannot be taken, why.
- `ResourceNeed` — `{ resource: string, route: string }`: a resource a job needs and the route that reaches it —
  `bridge <name>`, or `runner:<label>` —, as MOD-resource-list's `reachableBy` gives it for the product's resources; a
  product's facts carry them (MOD-progress-measures).
- `routesFor(participant: Participant, participants: Participant[], product: { visibility: "public" | "private" |
  "internal", jobWorkflow: boolean }, needs: ResourceNeed[]) -> RouteOffer[]` — the routes by the participant's route in the register: a model endpoint in the
  tab, called directly or through the Bridge its configuration names, and, where its route names the CI secret of its
  key, on the server's runners too, where Agent M's own loop calls that endpoint (MOD-workflow-entries); a CI agent in CI, on
  the server's runners or on its runner; a CLI or sandboxed agent through the Bridge its route names; a subagent — whose
  route `reachedThrough` names another participant — the routes of that participant among `participants`, as
  MOD-participant-list's `eligible` finds it there, its job's input naming the subagent for that participant to start. A self-hosted runner is offered only for a repository whose server reports
  it private, and refused with the reason otherwise (`A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE
  REPOSITORY`). A job that needs no resource reached only by a Bridge or a runner is offered on the server's own runners
  whenever a CI agent can take it (`AGENT M WORKS WITHOUT A LOCAL INSTALLATION`); one that needs such a resource is offered
  only on the routes that reach it — for `bridge <name>` a participant whose route names that Bridge, for
  `runner:<label>` that runner (`A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE`); a caller passes as `needs`
  the product's resource needs for a job whose kind says `resources: product`, and none for any other kind. The CI route
  is unavailable, with its files named, while the product has no job workflow.
- `queueJob(host: Host, start: JobStart, route: Route, head: string, bridge?: Bridge) -> Promise<{ path: string, commit:
  string }>` — commits the job's start record, on the head that was read, as the person's commit; on the tab's route the
  start and its taking are one commit, the taking by `tab <browser>`, `<browser>` this browser's identifier, or
  this tab's own (Data). For a job of a run (`start.run`), the same commit appends a `Job started` part
  to the run's record, through MOD-job-ledger's `appendToRecord`: two drivers that computed the same action cannot both
  start it, since the second commit is refused on a head that moved, and its driver computes the run's actions again. The push starts the job workflow on the CI route; a Bridge takes the job when it
  next reads the repository, or at once when `bridge` is given and the job is handed over to it. Crosses the network
  through the host, and to the Bridge; fails with what the host names — the branch moved, a refused token, a used-up rate
  limit —, with what the Bridge client names, and with `WorkflowMissing` for the CI route of a product without the job
  workflow.
- `tabContext(inputs: { kind: KindDefinition, params: Record<string, unknown>, product: { address: string, snapshot:
  Snapshot, host: Host }, instance: { snapshot: Snapshot, host: Host }, participants: Participant[], places: JobContext's
  places, gates: JobContext's gates, person: string, agentM: { version: string, commit: string }, jobId: string | null })
  -> JobContext` — the context of a job that runs in this tab, from what its caller has read: `connect` opens a repository
  with the browser's tokens, `now` is the moment of the call, and `instance.checkout` is `null`. It makes no request; the
  review pages and the prompt bar build every tab job's context with it.
- `runOnTab(prepared: Prepared, context: JobContext, connections: { endpoints: Record<string, { config: EndpointConfig,
  bridge: string | null }>, bridges: Record<string, Bridge> }, hooks: { host: Host, record: JobRecord | null, from?:
  unknown, refine?: unknown, onOutput?: (chunk: string) => void, signal?: AbortSignal }) -> Promise<JobResult>` — runs the prepared job in
  this tab with MOD-job-runner, attended unless its record names a run; with `from`, the draft a person changed and wants
  checked again as a whole (UC-022, UC-023), which it hands to MOD-job-runner's `runJob` as its `from`; with `refine`, the draft the drafter is to change as the person's follow-up instruction says (UC-019 step 8), which it hands to `runJob` as its `refine`; a conversation of the prompt bar passes no record, and then
  nothing is appended anywhere: builds the drafter's and the reviewers' drivers from their routes — an
  endpoint's driver from its configuration, `endpointDriver` where its `bridge` is `null` and `bridgeDriver` with the
  endpoint on the Bridge its `bridge` names, and an agent on a Bridge through `bridgeDriver`, each Bridge by its name among
  `bridges` —, appends a gate reached and the end to the job's record through the host, where it has one, and returns the
  result for the page to show. Only the driver of an endpoint the tab calls itself is given the kind's tools (MOD-job-runner's
  `ToolUse`) — called directly, or through the Bridge its configuration names, where `bridgeDriver` carries each request of
  the loop as one `ask`. Fails as the
  drivers fail, by name.
- `bridgeDriver(bridge: Bridge, target: { agent: string } | { endpoint: EndpointConfig }, participant: Participant) ->
  Driver` — a driver whose `send` hands `driverPrompt(input)` to the named agent on the Bridge, or to the endpoint the Bridge calls,
  through Access's `ask` — for an endpoint given `tools`, the loop of MOD-endpoint-calls runs here in the tab, each of its
  requests one `ask` of one exchange (`endpointExchange`), and each tool call carried out here —, across the network to the Bridge, and returns its answer and the usage reported. Fails with what
  the Bridge client names: not running, wrong address, token missing or refused, blocked by the browser, certificate not
  trusted; and, for an endpoint, with the endpoint's own failure, which the Bridge passes on.
- `resumeJob(record: JobRecord, gateRecord: string, route: Route, host: Host, head: string, bridge?: Bridge) ->
  Promise<void>` — appends the resumption, naming the gate record, on the head read, and hands the job back to its route:
  in the tab it goes on from the result this module kept for it, its end appended as a job of the tab ends; on a Bridge it is handed over again when `bridge` is given, and otherwise taken up when the
  Bridge next reads the repository; on CI the push itself starts the job workflow, which goes on.
- `liveState(record: JobRecord, product: { host: Host }, bridges: Record<string, Bridge>) -> Promise<LiveState>` — asks the
  runtime that holds a job that has not ended: the CI service's runs of the job workflow for the job, through the host;
  the list of jobs of the Bridge its record names, among `bridges`; this tab.
  A runtime that cannot be reached gives `reachable: false` and its reason, never an error; a commit the job's branch got
  after a cancel is reported in `writtenAfterCancel` (UC-036): the commits of the branch named after the job, read with the
  host's `readHistory` (`changes: false`), whose date is after the record's `## End` of state `cancelled`. A job of the tab
  route that another browser took — its `## Taken` names another browser than this one (Data; MOD-job-ledger) — gives
  `reachable: false` with the reason that its live state and log exist only in that browser's tab (UC-036 1b); one this
  browser took and this tab does not hold gives `known: false`, so that it is *ended without record* (1c); which
  browser is this one, and how a bare `tab` is read, says Data.
- `jobLog(record: JobRecord, product: { host: Host }, bridges: Record<string, Bridge>) -> Promise<{ stream:
  AsyncIterable<string> } | { address: string } | { gone: true }>` — the log, streamed from a Bridge or this tab while the
  job runs, the CI run's log by its address, or that the runtime keeps it no longer.
- `cancelJob(record: JobRecord, product: { host: Host }, bridges: Record<string, Bridge>) -> Promise<"cancelled" |
  "cancelling">` — stops the job at its
  runtime: cancels the CI run, tells the Bridge to end the agent's process, or aborts the tab's job. Once the runtime
  confirms, it appends the job's end, `cancelled`, with MOD-job-ledger's `appendToRecord`, as a commit with the
  person's token on the head that was read; `cancelling` while the runtime has not confirmed in time, and nothing is
  appended then. A job no runtime has taken — one still queued, or a run, which no runtime runs — is ended at once. A cancelled job writes nothing more (`A CANCELLED JOB WRITES NOTHING MORE`); a commit the job still
  makes after the cancel is reported by `liveState` as written after the cancel. Errors: those of the host's
  `commitFiles` — `Moved` when the record changed meanwhile, in which case the caller reads the record again.
- `jobTrail(record: JobRecord, product: { host: Host }) -> Promise<{ branch: string, commits: HistoryEntry[], pullRequest:
  PullRequest | null, runs: CiRun[] }>` — what a job left in its product: the commits of the branch named after the job
  (`readHistory`, `changes: false`), the pull request of that branch (`listPullRequests`), and the CI runs of its commits
  (`listCiRuns`). A branch that does not exist gives no commits. Crosses the network; fails as the host fails (UC-036).
- `revertAfterCancel(record: JobRecord, product: { host: Host }, commits: string[], head: string) -> Promise<{ commit:
  string }>` — on a person's click, one commit on the job's branch, on the head that was read, with the person's token:
  every file the given commits changed gets back its text from before the first of them (`readFileAt`), and a file they
  added is removed. Only commits `liveState` reported in `writtenAfterCancel` are accepted; any other is a `TypeError`.
  Fails as `commitFiles` fails, `Moved` among them (UC-036 6a).
- `retryJob(record: JobRecord, choice: { participant: Participant, route: Route }, host: Host, head: string) -> Promise<{
  path: string, commit: string }>` — queues a new job with a new identifier and the same inputs and parameters, which names the one it
  retries; the participant is the same or another holder of the role. A job whose task travelled with its hand-over is
  not retried here, since its record holds no task: the list offers to hand it over again from the prompt bar, where the
  person writes the task anew. Fails with `TaskNotInRecord` for such a job.
- `jobWorkflowFiles(server: "github" | "gitlab", instance: { repository: string, commit: string }, secrets: { token: string,
  keys: string[] }, runners: string[], gitlabCi?: string | null) -> { path: string, text: string }[]` — the files of the job
  workflow described under Data, for the caller to commit on a person's click: for each route, the plan, an agent's job
  for no key and one for each of `secrets.keys` in their order, and the job that writes — on GitHub the agent's job of a
  key naming the secret of that key alone and the job that writes naming `secrets.token` and every key; on GitLab the
  agent's job of a key of the environment `agent-m-key-<its name>`, the job that writes of `agent-m-write`, reading the
  token by the name `secrets.token`, and the plan and the agent's job 0 of none. On GitLab, `gitlabCi` is the product's
  `.gitlab-ci.yml` at the head the caller read, `null` where it has none. The returned `.gitlab-ci.yml` is that text with
  three additions, each made only where it is missing:
  - the inputs `job`, `task` and `endpoint` under its `spec:` header, with the header where the file has none;
  - the entry `- local: .gitlab/agent-m-jobs.yml` under its `include:`, with the key where the file has none;
  - the inputs that entry passes on.
  Every other line stays as it is. Where the product has no `.gitlab-ci.yml`, the returned one is the whole file.
- `gitlabVariableScopes(secrets: { token: string, keys: string[] }) -> { name: string, scopes: string[] }[]` — on GitLab,
  the environment scopes each CI/CD variable the job workflow reads must have, and no other: the token `agent-m-write`
  alone, each key `agent-m-key-<its name>` and `agent-m-write`, one variable for each scope; the token first, then the
  keys in their order. Pure.
- `handOverJob(prepared: Prepared, route: Route, start: JobStart, host: Host, head: string, task: string, target: {
  endpoint: { kind: string, baseUrl: string, model: string } | null, bridge: Bridge | null }) -> Promise<{ path: string,
  commit: string }>` — queues the work a conversation of the prompt bar handed over, on the person's click *Hand over*
  (`THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK`): commits `start` as the person's commit on the head that was read —
  the record naming the participant, the page and the commit it read, the conversation record where the instance records
  conversations, and that its task travels with the hand-over, without the task's words —, then, on the CI route, starts
  the product's job workflow with `startWorkflow` and the inputs `job`, `task` and, for a model endpoint, `endpoint` and
  `secret`, the CI secret its route names, or,
  on a Bridge, hands it over with `handOver` and the task. `prepared` is the job of the kind the participant named, with
  the task as its instruction, prepared by the caller with MOD-job-runner's `prepareJob`; a job it reports as blocking or
  not fitting is refused with its findings. A kind with the gate point `before-write` is refused, since such a job would
  wait for its task at the gate; at `before-merge` the work is written, and its resumption needs no task. Fails with
  `WorkflowMissing` for the CI route of a product without the job workflow, with what the host names, and with what the
  Bridge client names; nothing is queued when the record's commit fails, and a start that the server refuses after the
  commit ends the job's record as failed with the server's reason. A secret the run lacks ends it `not run`, naming the
  secret (MOD-workflow-entries), and the prompt bar shows that (UC-049 4c).
- `routeStrategies` — `Partial<Strategies>` with the writer `branch-and-pull-request`.  reads the branch named after the job
  and its commits. With a host of a server's API, it opens the pull request if the coding participant has not — into
  MOD-work-plans' `targetBranch` of the item or step the job works on, over the product's sprint records, plan order
  and declared branches, with the default branch the host's `repositoryInfo` names —, gives it
  a description that names the job, the plan step or backlog item, its modules, the requirements its new tests guard —
  read with MOD-test-document's `testDeclarations` — and the provenance lines, and returns its address. With a local host
  — a Bridge's clone, which makes no server requests and throws `NotSupported` for them — it opens nothing and returns
  the branch and the pull request the agent reports. Either way the Definition-of-Done check in CI verifies the pull
  request. It never merges: a pull request is merged once the Definition of Done holds (ARC-042). Fails with `NoBranch`,
  `NoCommits`, and what the host names.

## Files

It writes, through the host, the start records of jobs, the parts it appends, and pull requests; it returns the job
workflow's files for its caller to commit. It reads the job's branch and its test files. In this browser's store,
through MOD-browser-store, it reads `browser`, and writes it where it is not set, when the tab takes a job
(Data).

## Uses

- `MOD-job-runner.runJob`, `MOD-job-runner.provenanceLines`, `MOD-job-runner.Driver`, `MOD-job-runner.Prepared`,
  `MOD-job-runner.JobContext`, `MOD-job-runner.JobResult`, `MOD-job-runner.Strategies`, `MOD-job-runner.WriteOutcome` —
  running a job in the tab, the drivers it builds, and the writer it offers.
- `MOD-job-runner.driverPrompt` — the prepared prompt, current draft and canonical findings sent once through the
  Bridge; tab callers do not pre-render this context for an endpoint or Bridge driver.
- `MOD-job-ledger.startRecord`, `MOD-job-ledger.appendToRecord`, `MOD-job-ledger.newJobId`, `MOD-job-ledger.JobStart`,
  `MOD-job-ledger.JobRecord`, `MOD-job-ledger.LiveState` — the records it writes and the live state it reports;
  `MOD-job-ledger.jobCost` — the cost an end of a job it ran in the tab records.
- `MOD-endpoint-calls.endpointDriver`, `MOD-endpoint-calls.EndpointConfig` — the driver of an endpoint the browser calls,
  and the configuration a Bridge receives for one it calls; `MOD-endpoint-calls.endpointExchange` — one request of the
  tool loop of an endpoint the Bridge calls.
- `MOD-participant-list.Participant` — a participant's route.
- `MOD-repository-hosts.Host`, `MOD-repository-hosts.readSnapshot`, `MOD-repository-hosts.commitFiles`,
  `MOD-repository-hosts.listCiRuns`, `MOD-repository-hosts.cancelCiRun`, `MOD-repository-hosts.ciRunLog`,
  `MOD-repository-hosts.openPullRequest`, `MOD-repository-hosts.listPullRequests` — the CI route and the pull request;
  `MOD-repository-hosts.readHistory`, `MOD-repository-hosts.readFileAt` — a job's branch, the commits written after its
  cancel, and the texts a revert restores;
  `MOD-repository-hosts.repositoryInfo` — the default branch; `MOD-work-plans.targetBranch`,
  `MOD-work-plans.planSchemas`, `MOD-product-process.declarationSchema`, `MOD-product-process.branchesOf`,
  `MOD-documents.readDocument` — the branch a pull request the writer opens goes into, from the sprint records, the
  plan's order and the declared branches;
  `MOD-repository-hosts.startWorkflow` — the start of a handed-over job, with its task.
- `MOD-participant-list.reachedThrough` — a subagent's route through the participant that starts it.
- `MOD-bridge-client.Bridge`, `MOD-bridge-client.ask`, `MOD-bridge-client.handOver`, `MOD-bridge-client.bridgeJobs`,
  `MOD-bridge-client.bridgeJobLog`, `MOD-bridge-client.cancelOnBridge` — the Bridge route, on the Bridges its callers
  hand in.
- `MOD-test-document.testDeclarations` — the requirements a pull request's new tests guard.
- `MOD-browser-store.openStore`, `MOD-browser-store.readSetting`, `MOD-browser-store.writeSetting` — this browser's
  identifier, `browser`, for the tab's route; `MOD-identifiers.instanceOfPagesAddress` — the instance whose store
  holds it, from the tab's location.
- `MOD-trace-graph.traceGraph` — the modules of the plan step or backlog item a pull request names: its `changes` edges.

The workflow files name the entries of MOD-workflow-entries by their path in the instance repository; this module does not
call them.
