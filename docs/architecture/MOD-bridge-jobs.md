---
id: MOD-bridge-jobs
title: The Bridge as a route for its computer's agents
folder: src/bridge-jobs/
realises:
follows:
  - ARC-040
  - ARC-054
uses:
  - MOD-agent-enclosure.AgentEnclosure
  - MOD-agent-processes.Enclosure
  - MOD-repository-hosts.PullRequest
  - MOD-repository-hosts.HostError
  - MOD-bridge-http.bridgeApi
  - MOD-bridge-http.BridgeHandlers
  - MOD-endpoint-calls.EndpointConfig
  - MOD-endpoint-calls.testEndpoint
  - MOD-endpoint-calls.listModels
  - MOD-endpoint-calls.endpointDriver
  - MOD-endpoint-calls.endpointExchange
  - MOD-repository-hosts.connect
  - MOD-repository-hosts.parseAddress
  - MOD-repository-hosts.readSnapshot
  - MOD-documents.readDocument
  - MOD-documents.readRegister
  - MOD-participant-list.participantSchema
  - MOD-participant-list.participantsOf
  - MOD-agent-processes.installedAgents
  - MOD-agent-processes.agentDriver
  - MOD-agent-processes.testAgent
  - MOD-job-runner.JobContext
  - MOD-job-runner.Prepared
  - MOD-job-runner.prepareJob
  - MOD-job-runner.runJob
  - MOD-job-runner.failedBecause
  - MOD-job-catalogue.kindOf
  - MOD-job-ledger.JobRecord
  - MOD-job-ledger.RecordPart
  - MOD-job-ledger.takeJob
  - MOD-job-ledger.appendToRecord
  - MOD-job-ledger.jobState
  - MOD-job-ledger.recordsNewestFirst
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.jobCost
  - MOD-progress-measures.productFacts
  - MOD-runtimes.queueJob
  - MOD-product-process.declarationSchema
  - MOD-product-process.gateStates
  - MOD-work-plans.sprintFacts
  - MOD-work-plans.sprintsToClose
provides:
  - jobHandlers
  - startWatching
  - stopWatching
  - testAccess
---
# MOD-bridge-jobs The Bridge as a route for its computer's agents

## Responsibility

It belongs to the Bridge (ARC-040). It makes the Bridge one of the three routes a job takes (ARC-046): it runs the jobs
of the coding agents it offers — those of its computer's installed agents the person chose in its window (`THE BRIDGE
FINDS THE INSTALLED AGENTS`) —, each in that agent's working folder (`THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN
EXPORT`): those the page hands over, and the queued ones it takes itself from the product repositories it serves — with
the same job runner, catalogue and ledger as the page and CI, and the agent's own login on this computer (`A LOCAL AGENT
USES THE PERSON'S OWN LOGIN`). Every process of an agent it starts runs in that agent's enclosure (ARC-054); the
repositories are reached only by the Bridge, outside it, with the computer's own git login (`NO MODEL READS A
CREDENTIAL`). For a job of the page, it also calls a model endpoint the page cannot call. While no tab is open, it starts an agent's sprint close when the sprint ends (`A SPRINT CLOSED BY AN AGENT STARTS BY
ITSELF`). It answers the agents, jobs, ask and probe routes of the Bridge's API. It runs in Node, in the Bridge's main
process.

## Parts

- `index.mjs` — the interface.
- `handlers.mjs` — the agents, jobs, ask and probes routes.
- `watch.mjs` — reading the served products, taking and resuming jobs, sprint ends.
- `workfolders.mjs` — a working clone per job, its outbox, and the branches published from it.
- `pull-requests.mjs` — a product's pull requests through the server's command-line client, logged in as the person.
- `enclosures.mjs` — the working enclosure of an agent, or the refusal to start it, naming why.
- `probes.mjs` — the harmless requests of the probes.
- `access.mjs` — whether this computer's own git login reaches the repositories: one fetch of each into an empty
  repository in a temporary folder (`testAccess`).

## Data

It keeps no state of a job beyond its record: in memory, the jobs it runs with their logs and the asks in flight; on
disk, in the working folder of each agent it offers, a clone of the instance, one clone per served product, and one
working clone per running job of that agent with its outbox, both removed when the job ends, and the agent's home
(MOD-agent-enclosure). Before an agent starts a job, the job's working clone holds the product's branch, and the
instance's clone the commit of the instance the job's record names (`agent_m`, MOD-job-ledger).

**The outbox.** The Bridge makes the job's working clone with the computer's own git login, then the outbox beside it —
`jobs/<id>.out.git`, a bare repository cloned from the working clone — and sets the outbox as the working clone's push
address, before the agent starts; the outbox's branches at that moment are the job's base. The agent may write the
working clone and the outbox and nothing else of the working folder: the clones of the instance and of the products, in
which the Bridge runs git with the computer's login, are read-only to it. After the agent has answered, the Bridge fetches
the outbox's branches into its clone of the product, under `refs/agent-m/<job id>/`, pushes every branch that is new or
moved against the base to the origin under its name, never forced, and points the clone's own branch of that name at
it, so that the job's writer reads it there; the branch checked out in the clone is pushed and not pointed. A push the
origin refuses fails the job, naming the branch and what git said. The Bridge runs git in the working clone and the
outbox only before the agent starts; afterwards it only fetches the outbox's objects from its own clone, which runs no
command the outbox's configuration names: a hook or a command written there would run with the person's rights. Which agents it offers with their working folders, which products it serves, and the
Bridge's name — the name the route of its participants carries in `docs/participants.md` —, come from the Bridge's
settings (MOD-desktop-shell).

## Interfaces

- `jobHandlers({ agents, enclosures, … })` — the handlers of the `jobs` routes of `bridgeApi`, of MOD-bridge-http's type
  `BridgeHandlers`, for the agents the Bridge offers (`{ name, folder }`) and their enclosures (`enclosures: (folder:
  string) -> AgentEnclosure`):
  - `GET /v1/agents` — the coding agents it offers, with their versions and whether they are ready and logged in — both
    asked in the agent's enclosure, and not ready where the enclosure does not work —, and the supported agents missing
    on this computer (`THE BRIDGE FINDS THE INSTALLED AGENTS`).
  - `POST /v1/jobs` — a job the page handed over: its start record is already committed by the person's click; the
    Bridge takes it and runs it as a queued job, from its record; the hand-over only spares it the wait for its next
    reading. A job whose record says that its task travels with the hand-over is run with the request's `task` as its
    instruction, which the Bridge keeps only in memory while the job runs and writes to no file, log line, commit message
    or record; such a job's end names its commits, files and pull request and no draft, and the agent's answer stays in
    the job's log, from which the page reads it. Such a job is never taken from the repository by the Bridge's own
    reading, since only its hand-over carries its task. Errors: `invalid-request` for an agent this Bridge does not
    offer, for one whose working folder is not set, and for a job whose task travels with the hand-over handed over
    without a task; `paused`.
  - `GET /v1/jobs`, `GET /v1/jobs/{id}/log` — the jobs it runs with their live states, and their logs as they grow.
  - `POST /v1/jobs/{id}/cancel` — stops the agent's process and confirms once it has ended; the job then commits nothing
    more (`A CANCELLED JOB WRITES NOTHING MORE`), and the person's page appends the record of the cancel.
  - `POST /v1/ask`, `GET /v1/ask/{ask}` — a request of the page's job runner: to one agent it offers, answered with its
    draft and the usage it reported; or to a model endpoint, whose configuration the request carries, sent with
    MOD-endpoint-calls' `endpointDriver` in Node and answered the same way (`A RUNTIME IS INTERCHANGEABLE`) — or, where
    the request carries one exchange of a tool loop, with `endpointExchange`, answered with the endpoint's text, its tool
    calls and the usage. The correction loop and the tool loop stay in the page, which carries every tool call out.
  - `POST /v1/probes/{kind}` — a harmless request: `agent` asks an agent a short question; `endpoint-models` receives the
    endpoint configuration as `endpoint-test` does, calls MOD-endpoint-calls' `listModels` in Node once, and returns its
    `{ models }` or `{ diagnosis }` unchanged; `endpoint-test` receives the valid endpoint configuration of an endpoint
    whose configuration in the page names this Bridge, maps its fields to MOD-endpoint-calls' `EndpointConfig`,
    calls `testEndpoint` in Node once, and returns the structurally corresponding `{ works: true, model }` or
    `{ works: false, diagnosis }` answer unchanged; `partitions` lists a cluster's
    partitions through its scheduler's command on this computer — SLURM's `sinfo --noheader --format=%P|%a`, each line a
    partition's name and its state — as `{ partitions: [{ name, state }] }` (UC-003, UC-017, UC-040); a computer without
    `sinfo`, or a command that fails, is `upstream-failed` naming the command and its message. An invalid endpoint-test body
    is `invalid-request`; a provider or local-endpoint failure is the returned diagnosis; `upstream-failed` names another
    probe-handler failure.
- `startWatching(config: { bridgeName: string, agents: { name: string, folder: string }[], products: { address: string
  }[], every: number, enclosures: (folder: string) -> AgentEnclosure }) -> void` — with the agents the Bridge offers,
  their working folders and their enclosures, starts reading every
  served product through Access's local clone with the computer's own git login, at the
  given interval and after every hand-over: queued jobs whose participant's route names this Bridge and an agent it
  offers are taken — a commit
  only on the head that was read, so that no other route takes them too — and run, a run that MOD-job-runner's
  `failedBecause` fails ending its job `failed` with that reason; jobs of this Bridge waiting at a gate
  whose record now exists are resumed (`A JOB STOPS AT EVERY GATE`); a sprint whose close
  the product assigned to one of this Bridge's agents is closed by that agent, once,
  when MOD-work-plans' `sprintsToClose` names it — its time box ended, or, without one, every selected item done or
  ended by the Product Owner. A product that cannot be read is skipped with its reason, and read again at the next interval.
- `stopWatching(reason: "pause" | "quit") -> Promise<void>` — stops taking jobs; on *quit* every job still running is
  stopped and its record ends as cancelled, naming that the Bridge was quit.
- `testAccess(config: { instance: string, products: string[] }) -> Promise<{ repository: string, reachable: boolean,
  reason: string | null }[]>` — whether this computer's own git login reaches the instance and each served product: one
  fetch of each, changing nothing; a repository it does not reach is named with the reason git gives (UC-044). Crosses
  the network to the repository servers.

Every job it runs, the Bridge runs from its start record alone — its kind, the parameters of its `## Parameters` and its
pinned inputs —, prepared by the job runner on the job's working clone. No person attends a job on a Bridge: as on CI,
its kind's writer writes at once, and a kind that hands its draft back leaves it in the record's end as `draft:`, from
which the page shows it.

An endpoint configuration and its key — of a test, of a models listing or of an ask — exist only for that request. The handler retains
neither in a clone, job record, log, disk file, shell setting nor process command.

Access's local clone does files and commits only — no pull request, issue or CI run. On a Bridge the host of a product
on GitHub adds the two functions a pull request needs, `listPullRequests` and `openPullRequest` in MOD-repository-hosts'
form, through the server's own command-line client `gh` logged in as the person, run by the Bridge outside every
enclosure with `--repo` naming the product; so the job's writer opens the pull request of the branch the Bridge pushed,
as it does with a server's API. Where `gh` is missing or not logged in, and for a product on GitLab, both functions fail
with `NotSupported`, and the writer records the branch without a pull request. The Bridge records the branch and the pull
request in the job's end record, and the Definition-of-Done check in the product's CI (MOD-workflow-entries'
`onDoneCheck`) verifies it.

**No enclosure, no agent.** The agents' enclosures are given by the composing program, one per working folder
(`enclosures`). Without them, or where an agent's enclosure answers that it does not work, no process of that agent is
started: `GET /v1/agents` names the agent as not ready, a job ends failed and an ask fails, each with the enclosure's
reason and its one-time step.

Its `instance` is the instance as the Bridge's clone of it holds it: the commits that clone last fetched. Its `instanceAt`
reads the instance at the commit a served product's declaration names, through that same clone connected as a host. A
commit the clone does not hold is fetched from its origin with the computer's own git login, the clone's own
credentials (MOD-repository-hosts' `readSnapshot`).

## Files

In each served product, through Access's local clone: reads `docs/process.md`, the plan or backlog, `docs/jobs/` and
`docs/gates/`, and the instance's `docs/participants.md`; appends to job records; pushes the branches the agent made, from
the job's outbox, and opens their pull requests with `gh`. Through its clone of the instance, which fetches that commit: the instance's
process models at the commit a served product's declaration names. In the working folder of each agent it offers: the
clones. Nothing else.

## Uses

- `MOD-bridge-http.bridgeApi`, `MOD-bridge-http.BridgeHandlers` — the routes it answers.
- `MOD-agent-enclosure.AgentEnclosure` — whether an agent's enclosure works, its preparation before a start, its home;
  `MOD-agent-processes.Enclosure` — the part of it given to the agent's driver, to the list of installed agents and to the
  probe.
- `MOD-repository-hosts.PullRequest`, `MOD-repository-hosts.HostError` — the form in which the host of a product on GitHub
  answers its pull requests, and `NotSupported` where gh cannot open them.
- `MOD-repository-hosts.connect`, `MOD-repository-hosts.readSnapshot`, `MOD-repository-hosts.parseAddress` — the served
  products, each connected by its address, through the local clone with the computer's own git login; the instance at
  the commit a declaration or a job's record names, through its clone, which fetches the commit with that login; and the
  test of that login.
- `MOD-documents.readDocument`, `MOD-documents.readRegister`, `MOD-participant-list.participantSchema`,
  `MOD-participant-list.participantsOf`, `MOD-product-process.declarationSchema` — the participants of this Bridge and
  the product's declaration.
- `MOD-agent-processes.installedAgents`, `agentDriver`, `testAgent` — the agents of this computer and their driver.
- `MOD-endpoint-calls.EndpointConfig`, `testEndpoint`, `listModels`, `endpointDriver` — an endpoint's test, its models'
  listing and the requests of a job of the page to a model endpoint.
- `MOD-job-runner.JobContext`, `Prepared`, `prepareJob`, `runJob`, `MOD-job-catalogue.kindOf` — running a job of any kind
  from its record, unattended; `MOD-job-runner.failedBecause` — whether its job ends failed, and why.
- `MOD-job-ledger.JobRecord`, `RecordPart`, `takeJob`, `appendToRecord`, `jobState` — taking, resuming and ending jobs in
  their records, a draft handed back in the end; `recordsNewestFirst` — the job records of a served product it looks
  through; `jobCost` — the cost an end records; `newJobId` — the identifier of a sprint's close it starts.
- `MOD-runtimes.queueJob` — queueing the close of a sprint one of this Bridge's agents closes.
- `MOD-progress-measures.productFacts` — the facts of a served product, read through the local clone, from which the
  sprints to close are found.
- `MOD-product-process.gateStates` — whether a waiting job's gate is decided.
- `MOD-work-plans.sprintFacts`, `MOD-work-plans.sprintsToClose` — a sprint's facts, and whether it has ended and who
  closes it.
