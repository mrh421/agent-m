---
id: MOD-agent-processes
title: Coding-agent CLIs as processes on a machine
folder: src/agent-processes/
realises:
follows:
  - ARC-046
uses:
  - MOD-job-runner.Driver
  - MOD-job-runner.DriverInput
  - MOD-job-runner.driverPrompt
  - MOD-job-runner.Usage
  - MOD-participant-list.Participant
  - MOD-documents.loadSchema
  - MOD-documents.readRegister
provides:
  - Agent
  - Enclosure
  - installedAgents
  - agentDriver
  - keyProvider
  - testAgent
  - stopTree
---
# MOD-agent-processes Coding-agent CLIs as processes on a machine

## Responsibility

It belongs to Participants and jobs (ARC-046). It knows the coding-agent CLIs Agent M supports — Claude Code, Codex and
opencode —: which of them are installed on the machine it runs on, with their versions (`THE BRIDGE FINDS THE INSTALLED
AGENTS`), and how to run one as a participant: the driver that gives an agent its task in a working folder, streams its
output, and stops it on a cancel. The agent works with the login it already has on the machine (`A LOCAL AGENT USES THE
PERSON'S OWN LOGIN`); in CI it reads its key from the environment variable the CI fills from the secret the participant
names (`A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET`), or, where CI runs it as the model's own user, reaches
its provider through the key holder with no key of its own (`NO MODEL READS A CREDENTIAL`). It runs in Node only — inside the Bridge and in the
Workflows — and keeps nothing but the processes it started.

## Parts

- `index.mjs` — the interface.
- `agents.md` — the supported agents, as a register.
- `agents.schema.md` — the register's schema, in the schema language of MOD-documents.
- `discovery.mjs` — finding the installed agents and their versions.
- `processes.mjs` — starting an agent, streaming its output, stopping it.

## Data

**The supported agents**, `agents.md`, a register read with MOD-documents:

| Column | What it holds |
|---|---|
| Agent | the name by which a participant names the agent, one row per supported agent: `claude`, `codex`, `opencode` |
| Command | the command the CLI is started by |
| Version | how its version is asked for |
| Task | the arguments that make it read a task from its standard input without a conversation, and how its final answer is told from its other output |
| Login check | how it is asked, harmlessly, whether it is logged in, and the agent's own login step (`login`), the command a person runs to log in |
| Key variable | the environment variable from which it reads a key, used only in CI |
| Endpoint | how it is made to work with a model endpoint of the kind OpenAI-compatible or Anthropic — the options or settings that name the endpoint's address and model —, or `—` where it cannot |
| Key holder | the provider a key in its Key variable is for — its kind and address — and the options or settings that send its requests to a key holder in its place, `{keyHolder}`, with a placeholder, `{placeholder}`, as its key (`NO MODEL READS A CREDENTIAL`): Claude Code's `ANTHROPIC_BASE_URL`, Codex's `openai_base_url` given with `-c`; `—` where it cannot be, as opencode, which names no key variable of its own and whose provider Agent M does not know without an endpoint |
| Install | the vendor's installation page for each platform (`THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT`) |

The exact commands and options are data in this register, not code, so a changed CLI is a changed row. The prompt is
never an argument: it is written to the agent's standard input, so no size of a prompt can fail the agent's start.

## Interfaces

- `Agent` — `{ name: string, installed: boolean, version: string | null, loggedIn: boolean | null, login: string,
  install: Record<"macos" | "windows" | "linux", string> }`: `login` is the agent's own login step from its row's Login
  check, which the Bridge's window shows for an agent that is not logged in (UC-044 3b); `name` is the Agent of a row of `agents.md`, so that a supported
  agent added is a row added, not a change of this interface (`OPEN FOR EXTENSION, CLOSED FOR CHANGE`).
- `Enclosure` — `{ wrap(command: string, args: string[], at: { workdir: string, writable: string[] }) -> { command:
  string, args: string[], env: Record<string, string>, input: string | null } }`: what an agent is started inside on a
  Bridge (ARC-054) — the command that starts `command` with `args` in the enclosure, with `workdir` as its working folder
  and the folders of `writable` writable, the whole environment it receives, and the text written to its standard input
  before the agent's own, where the enclosure needs one. The Bridge's MOD-agent-enclosure implements it. Where an
  enclosure is given, this module starts nothing of an agent outside it and adds nothing to its environment.
- `installedAgents(options?: { enclosure?: Enclosure, workdir?: string }) -> Promise<Agent[]>` — every supported agent,
  each found on the machine's path with its version, or marked as missing with its vendor's installation page; an
  installed agent that is not logged in is marked so, and the agent's own login step is named — this module never asks
  for a password (UC-044). With an enclosure, both commands run inside it, in `workdir`, so that *installed* and *logged
  in* are said of the agent as it will run. Starts only the commands of the register's Version and Login check columns;
  changes nothing.
- `keyProvider(keyVariable: string | null) -> { kind: "openai-compatible" | "anthropic", baseUrl: string } | null` — the
  provider a key in that variable is for, from the Key holder of the agent whose Key variable it is; `null` where no agent
  reads its key from it or that agent's Key holder is `—`. A key holder for that provider stands in for it (MOD-workflow-entries,
  *The model's user*).
- `agentDriver(agent: Agent, options: { workdir: string, keyVariable: string | null, endpoint: { kind:
  "openai-compatible" | "anthropic", baseUrl: string, model: string } | null, keyHolder?: string | null, enclosure?:
  Enclosure, writable?: string[] }, participant: Participant) -> Driver` — a
  driver whose `send` starts the agent in the working folder and writes `driverPrompt(input)`, its task, to the agent's
  standard input — where `endpoint` is
  given, made to work with that endpoint as the register's Endpoint column says, its key from `keyVariable` — CI does not
  run a model endpoint's work this way: it runs it in Agent M's own loop (MOD-workflow-entries) —; an agent whose
  Endpoint is `—` refuses it with `EndpointUnsupported`, before it starts —, streams its output
  through `onOutput`, and returns its final answer and the usage it reported, or `null` usage. With an `enclosure`, the
  agent is started through its `wrap`, with `workdir` and the folders of `writable` — `[workdir]` where none are given —
  writable. For a job that works in the
  folder — implementing, fixing, generating tests —, the agent commits and pushes to its checkout's push address and
  reports its branch: in CI a repository the writing machine pushes from with the person's token from a CI secret
  (`A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET`), on a Bridge an outbox the Bridge pushes from with the
  computer's own login (MOD-bridge-jobs). Outside CI, `keyVariable` is `null`: the command carries no
  key and no key variable. In CI, `keyVariable` names the variable the CI filled from the participant's secret; this
  module never sees or passes the value. With `keyHolder`, the address of a key holder on the model's user's side of a
  CI machine, the agent inherits no declared key variable and is started with its row's Key holder options — its requests
  go to that address, its key variable holds a placeholder —, so that no key is in its environment; an agent whose Key
  holder is `—` refuses it with `KeyHolderUnsupported`, before it starts. An abort of the signal stops the agent and every
  process it started, before anything further is pushed. It throws `AgentMissing`, `EndpointUnsupported`,
  `KeyHolderUnsupported`, `AgentNotLoggedIn`, `AgentFailed { exitCode, lastOutput }` and `Cancelled`.
- `stopTree(child: ChildProcess, signal?: string) -> Promise<void>` — sends `signal`, `SIGKILL` where none is given, to the
  process group of a child started detached, so that every process it started receives it; on Windows it ends the
  child's tree with `taskkill`, whatever the signal. A group that is already gone is no failure. The driver stops an agent
  with it on a cancel; MOD-checkout-tools ends a command's process group with it at the command's timeout.
- `testAgent(agent: Agent, options?: { enclosure?: Enclosure, workdir?: string }) -> Promise<{ answered: true, version:
  string } | { answered: false, reason: string }>` — a harmless request, a one-word answer, given on the agent's standard
  input as a task is, to show that the agent answers with its login (UC-017); with an enclosure, inside it.

## Files

It reads its own data files. The agent it starts reads and writes the working folder it is given — the checkout of a
product's branch, which on a Bridge lies in the agent's own working folder beside the Bridge's clone of the instance
(MOD-bridge-jobs) — and nothing else of Agent M's.

## Uses

- `MOD-job-runner.Driver`, `MOD-job-runner.DriverInput`, `MOD-job-runner.Usage` — the driver type it implements, its
  input, and the usage it returns.
- `MOD-job-runner.driverPrompt` — the prepared prompt, current draft and canonical findings sent as one task.
- `MOD-participant-list.Participant` — the participant the driver stands for.
- `MOD-documents.loadSchema`, `MOD-documents.readRegister` — the register of supported agents.
