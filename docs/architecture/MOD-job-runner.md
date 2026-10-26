---
id: MOD-job-runner
title: The one runner of every job kind
folder: src/job-runner/
realises:
follows:
  - ARC-046
uses:
  - MOD-job-catalogue.kindOf
  - MOD-job-catalogue.KindDefinition
  - MOD-job-catalogue.toolsOf
  - MOD-job-catalogue.ToolDefinition
  - MOD-participant-list.eligible
  - MOD-participant-list.differs
  - MOD-participant-list.Participant
  - MOD-documents.documentFindings
  - MOD-documents.readDocument
  - MOD-documents.artifactSchemas
  - MOD-documents.artifactSchemaOf
  - MOD-documents.classifyCandidates
  - MOD-documents.Candidate
  - MOD-documents.Classified
  - MOD-documents.loadSchema
  - MOD-trace-graph.traceGraph
  - MOD-trace-graph.graphFindings
  - MOD-trace-graph.selfSufficiencyFindings
  - MOD-spec-document.requirementFindings
  - MOD-spec-document.parseSpec
  - MOD-group-document.parseGroupFile
  - MOD-group-document.applyMoves
  - MOD-group-document.hierarchy
  - MOD-group-document.GroupMove
  - MOD-test-document.testFindings
  - MOD-test-document.testDeclarations
  - MOD-test-document.isTestFile
  - MOD-text-tools.finding
  - MOD-text-tools.formatFinding
  - MOD-text-tools.Finding
  - MOD-identifiers.kindOfIdentifier
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.openPullRequest
provides:
  - Strategies
  - Driver
  - DriverInput
  - ToolUse
  - driverPrompt
  - estimate
  - Usage
  - JobContext
  - Part
  - Destination
  - Prepared
  - Round
  - JobResult
  - WriteOutcome
  - registerStrategies
  - prepareJob
  - runJob
  - writeResult
  - provenanceLines
  - roundsText
  - sourcesOf
  - handOverParams
  - refusedEdit
---
# MOD-job-runner The one runner of every job kind

## Responsibility

It belongs to Participants and jobs (ARC-046). It is the one runner shared by every subsystem and both programs: it
interprets a job kind's definition from MOD-job-catalogue — preconditions, recipes, the fit of the input to the
participant's context, the destinations, the correction loop with its checks and reviewing participants, the steps, the
gates, the writer —, keeps the registry of the strategies the kinds name, offers the strategies built on the artifact
model, and gives every commit a job makes its provenance lines. Where a kind names tools, it offers the drafter those its
capabilities allow and carries out each call, so that a model endpoint works in the execution loop of the book (Vibe
Coding, ch. 11) — the model proposes a call, the runner carries it out deterministically and returns the result —, and
it holds the edits a participant proposes until a person saves them. It composes the input of every call of a language
model Agent M makes — a job's, and a message of the prompt bar's, which is a job too —, and that input begins with Agent
M's own `AGENTS.md`, the one at the root of the instance repository, in full, whatever repository the job works on; for a
participant that works in a checkout of the instance, with the file's path there (`EVERY MODEL READS AGENT M'S AGENTS.MD
FIRST`). It knows no kind and no service by name. It runs unchanged in a browser and in Node.

## Parts

- `index.mjs` — the interface.
- `registry.mjs` — the strategies registered by name, for the life of the program.
- `prepare.mjs` — preconditions, recipes, sizes, counts, places, destinations.
- `loop.mjs` — the correction loop.
- `driver-prompt.mjs` — the prompt and transient correction context serialized at a driver's sending boundary.
- `builtins.mjs` — the built-in strategies.
- `tools.mjs` — offering a kind's tools to a drafter and carrying out their calls; the built-in tools.
- `provenance.mjs` — the provenance lines of a commit.
- `rounds.schema.md` — the schema of the round record, in the schema language of MOD-documents.

## Data

It keeps the registry of strategies of the program it runs in, in memory, filled once by the program that composes it
(the Site's entry pages, MOD-workflow-entries, the Bridge's MOD-desktop-shell); it keeps nothing else.

**Built-in strategies**, registered by the runner itself:

| Name | Kind of strategy | What it does |
|---|---|---|
| `instruction` | recipe | the person's words, from the job's parameters, as one part |
| `conversation` | recipe | the conversation so far, from the job's parameters, each message with who wrote it, as one part; none for the first message |
| `page` | recipe | the page the person sees, as its route's subject gives it in the job's parameters (MOD-prompt-bar), as one part |
| `list-files`, `read-file`, `search-files` | tool | the product's files at the commit the job read: the paths under a folder, one file's text, the lines that match a text in the files below the call's `path` — a search that would read more than 200 files is refused, naming their number, and reads none —; a path the context's `places.contents` names for a restricted source is refused unless that source allows the drafter's processing place (`RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS`), and the refusal says why (UC-049 4e) |
| `propose-edit` | tool | holds a new text for one document below `docs/` — added to the draft's `edits` — and writes nothing (`THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK`). It refuses, naming where the document is changed — the rule `refusedEdit` states once: `SPEC.md`, a use case, an architecture decision and a module file, which their pages change with their neighbours (`A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES`, `A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS`, `THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT`); every record — approval, gate, job, conversation and test result records, counter-proofs — (`A RECORD IS EVIDENCE, NOT A PROPOSAL`); every change queue under `docs/spec-freigaben/`; every test declaration, which test generation writes (`A TEST JOB RECEIVES THE CHAPTER ON TESTING`); a settings file whose change states a notice first — `docs/settings.md`, `docs/collaborators.md`, `docs/conversation-recording.md` (`SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS`, `SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS`); and every file outside `docs/`, since code, tests and workflows reach the default branch only by a pull request (`CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI`), through `hand-over` |
| `hand-over` | tool | holds a proposed hand-over — a kind of the catalogue with a participant, what it works on, and the task in the drafter's words — in the draft's `handOver`, and runs or queues nothing itself: where a person attends, the prompt bar carries it out (MOD-prompt-bar); where nobody attends, the program that runs the job does (MOD-workflow-entries) (UC-049 4a, 4f) |
| `draft` | recipe | the draft the job is handed: the draft under review, for a reviewing kind; the cases as the person left them, for `write-tests`; the conversation's draft as it stands, for a change kind's follow-up |
| `return-draft` | writer | writes nothing; hands the result to the caller |
| `proposed-edits` | writer | the edits of a `converse` job nobody attends (UC-049 4f): every edit of the draft's `edits` that `refusedEdit` does not refuse, in one commit on a new branch `agent-m/<job>` from the commit the job read, its message ending with the provenance lines, and a pull request of that branch into the default branch, titled with the job and the kind, its description the provenance lines — never a commit on the default branch (`A CI AGENT'S DRAFT ENTERS AS OPEN`, `CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI`); an edit `refusedEdit` refuses is not written, and a note names it with the refusal; without an edit to write it writes nothing and hands the draft back |
| `document-schema` | check | MOD-documents' `documentFindings` on every drafted document, read with the schema `artifactSchemaOf` names for its path; a path no schema's pattern matches is not judged here |
| `candidate-classes` | check | MOD-documents' `classifyCandidates` of the drafted candidates against the existing artifacts the job's parts carry, each round: an error for a candidate the rule finds a duplicate of an existing artifact while its drafter classed it otherwise, naming that artifact (`EXACT DUPLICATES ARE FOUND WITHOUT A MODEL`), and for a change, a duplicate or a conflict that names no existing artifact or one no part carries (`A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT`). The classes of the last round — the candidates of one key merged, naming every one they came from, and exact duplicates decided by rule — are the result's `classes`. A draft whose parts carry no artifact has nothing to classify |
| `graph-checks` | check | MOD-trace-graph's `graphFindings` on the snapshot with the drafted files put in place of their paths, and its `selfSufficiencyFindings` there against the instance's repository, the `owner/name` of the context's instance, read in the snapshot's batches; a draft that holds no files has none and reads nothing |
| `requirement-form` | check | MOD-spec-document's `requirementFindings` on every drafted requirement, the candidates written as a SPEC section with the job's `source` as their source and read with `parseSpec` |
| `group-rules` | check | the drafted moves — MOD-group-document's `GroupMove`s — applied with `applyMoves` to the group file of the kind the job's parameters name, read from the product's snapshot: each refused move, and the findings `hierarchy` reports for the result against the kind's items, read from the snapshot too |
| `test-declarations` | check | MOD-test-document's `testFindings` on every declaration in the files the reported branch adds or changes, read with `testDeclarations`, and an error under `A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS` for a file the branch adds that `isTestFile` calls a test file and that declares none. A branch the host does not hold is a finding sent back, since the drafter reported a branch it has not pushed; any other failure of the host is thrown by name |

**What a destination holds.** For `notFitting`, the requirements and use cases the parts of a destination hold are counted
from the `artifacts` of its parts, and from nothing else, whatever recipe gave the part: an artifact whose identifier
`kindOfIdentifier` gives as `requirement` is a requirement, as `UC` a use case, and any other kind is neither. An
identifier counts once, at the first part that carries it: a requirement shown in two parts is one requirement.

How many of them fit: the room is the participant's context less the kind's prompt and Agent M's `AGENTS.md`, that is,
the destination's `size` less the sizes of its parts. Taking the parts in the order the destination lists them, a part has its size and the
artifacts of a part share it equally, each rounded up. An item fits when the sizes of everything before it, its own
included, are within the room; the count stops at the first item that does not, so that the items after it are counted as
not fitting. A repeated identifier takes its share of the room and counts nothing. With a `context` of `null` none fits.

**The round record.** Every round of the correction loop is kept and recorded with the job (`THE ROUNDS ARE COUNTED AND
SHOWN`). Its text form, which MOD-job-ledger writes into the end of a job's record and the pages show beside a draft:

```markdown
## Rounds

### Round 1 — 2 findings
- UC-007:12: error: realises "EXPORT AS PDF" matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS] — use an existing name or remove the line.
  - fixed
- SPEC:3: warning: rule contains "and" [ONE STATEMENT PER REQUIREMENT] — split it, or keep it and give a one-line reason.
  - justified: the two clauses name one condition.

### Round 2 — no finding

Left: none · stopped because: passed · limit: 5
```

Each finding stands in MOD-text-tools' one form; under it, how the drafter answered — `fixed`, `justified:` with its one
line, or, for a reviewer's finding, `answered:` with the reason it does not hold. A round's heading counts its findings —
`no finding`, `1 finding`, `<n> findings` —, and the last line counts what is left the same way, or says `none`.
Findings a person decides follow that line, one per line under `For a person:`, and were never sent back.

**Reading an answer.** An answer is read as the envelope MOD-job-catalogue states, its draft by the kind's schema of its
draft — `type`, `properties`, `required`, `items`, `enum` —; a property that is not required may be left out or be
`null`, and a text fenced as JSON is read inside its fence. An answer that cannot be read is a finding of the loop:

```text
answer:1: error: the answer cannot be read: it is not JSON [A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT] — answer with one JSON object of the form the output schema gives.
```

A reviewing kind's draft is a list of findings, each with `artifact`, `line`, `rule`, `what` and `fix`; the runner reads
each as a warning, whatever kind the reviewer gave it.

**Provenance lines.** The lines every commit a job makes carries at the end of its message, as git trailers; the
artifacts it writes name none of them (`AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT`):

```text
Agent-M-Version: <calendar version, or "unreleased">, commit <instance commit>
Agent-M-Job: JOB-<yyyymmdd>-<hhmm>-<4 hex>, for a job with a record
Agent-M-Kind: <kind>
Agent-M-Participant: <participant's name>
Agent-M-Model: <model>
Agent-M-Rounds: <number of correction rounds>
```

No line names the person's instruction or any other message of a conversation (`A CONVERSATION IS WRITTEN TO A REPOSITORY
ONLY WHEN RECORDING IS ON`).

## Interfaces

- `Strategies` — `{ recipes: Record<string, (context: JobContext, params: Record<string, unknown>) => Promise<Part[]>>,
  checks: Record<string, (draft: unknown, context: JobContext) => Finding[] | Promise<Finding[]>>, preconditions:
  Record<string, (context: JobContext) => Promise<Finding | null>>, steps: Record<string, (draft: unknown, context:
  JobContext) => Promise<{ draft: unknown, findings: Finding[] }>>, writers: Record<string, (result: JobResult, context:
  JobContext) => Promise<WriteOutcome>>, tools: Record<string, (args: Record<string, unknown>, context: JobContext) =>
  Promise<string>> }`: the plug-in contract. A tool's description and the schema of its arguments are data in
  MOD-job-catalogue; its strategy only carries a call out and returns what the participant reads, a refusal included. A strategy throws only for a failure of its own input or
  output — a hash that does not match, a repository that refuses — and names it; a finding is returned, never thrown. A
  writer whose every file already stands on the head byte for byte as it would write it commits nothing and returns an
  outcome without a commit (UC-010 4a).
- `Driver` — `{ participant: Participant, send(input: DriverInput, options?: { onOutput?: (chunk: string) => void,
  signal?: AbortSignal }) -> Promise<{ text: string, usage: Usage | null }> }`: one participant behind its route. `send`
  makes one exchange and returns the participant's answer as text and the usage its runtime reported, or `null`; it
  throws the failure of its route by name — the endpoint's refusal, a browser that blocked the call, an agent that is
  missing or ended with an error, a cancel — and never retries until an answer pleases.
- `DriverInput` — `{ prompt: string, parts: Part[], output: object | null, findings: Finding[], previous: string | null,
  workdir: string | null }`: the prepared job's `rules` — Agent M's `AGENTS.md`, its text or its path in a checkout of
  the instance, followed by a blank line —, then the kind's prompt with each recipe's parts in that recipe's named place, each under its name,
  and `(none)` where a recipe gave no part, followed by *The form of your answer*: the envelope every answer is read by,
  as a JSON schema — a driver sends this prompt as it is and does not add the parts again —; the
  parts; the output schema the answer must follow; the findings of the last round with the draft they concern — or, in
  the first exchange of a job given `refine`, no finding and the draft to change —; for an agent that works in a
  folder, that folder; and `tools`, a `ToolUse` or `null`.
- `ToolUse` — `{ definitions: { name: string, description: string, input: object }[], call(name: string, args:
  Record<string, unknown>) -> Promise<string>, limit: number }`: the tools offered to the drafter of this exchange, read
  from MOD-job-catalogue's tools; `call` carries one call out through the tool's strategy, and answers a tool that is not
  offered, or arguments its schema refuses, with a refusal the participant reads; `limit` the most calls of one exchange,
  the kind's `tool_limit`. The runner gives it only to a drafter that declares *use tools* and is a model endpoint —
  called directly, or through the Bridge its configuration names, the loop running in the program either way —, offering
  only the tools whose capability the drafter declares and that the job's parameter `refuses` does not name — the
  page's subject's (MOD-prompt-bar); a coding agent gets
  `null` and works with its own tools. What a draft holds of a tool that `refuses` names — `edits` for `propose-edit`,
  `handOver` for `hand-over` — is dropped from it, whether a tool held it or the answer gave it.
- `driverPrompt(input: DriverInput) -> string` — the text a driver sends: the prepared `prompt` unchanged, followed by
  the current draft when `previous` is not null and the findings when any are present, each in MOD-text-tools'
  `formatFinding` form. It adds neither the recipe parts nor the output schema again: those already stand in the
  prepared prompt. Endpoint, agent and Bridge drivers call this once at their sending boundary; callers pass the
  structured input without pre-rendering that context. With no previous draft and no findings, it returns the prompt
  unchanged. It performs no I/O and changes no input.
- `Usage` — `{ inputTokens: number | null, outputTokens: number | null, minutes: number | null, cost: { amount: number,
  currency: string } | null }`: exactly what a runtime reported; nothing is estimated.
- `JobContext` — `{ kind: KindDefinition, params: Record<string, unknown>, product: { address: string, snapshot: Snapshot,
  host: Host | null }, instance: { snapshot: Snapshot, host: Host | null }, connect: (address: string) => Promise<Host>,
  participants: Participant[], places: { sources: Record<string, string[]>, mailbox: string[] | null, contents: {
  source: string, paths: string[] }[] }, gates: { name:
  string, point: string, passed: boolean }[], person: string | null, now: Date, agentM: { version: string, commit: string
  }, jobId: string | null }`, its `instance` also holding `checkout: string | null`: everything a strategy may read.
  `instance.checkout` is the folder of a checkout of the instance in which the participant works and reads files itself
  — on a Bridge the instance at the job's `agent_m` commit in the offered agent's working folder (MOD-bridge-jobs), in
  CI the job workflow's checkout of the instance —, from which the instance's `snapshot` is then read; it is `null` in a
  browser. `connect` opens another repository with the credentials of
  the program — the token in a browser, the CI secret in CI, the computer's login on a Bridge; `places` gives, for every
  restricted source and for the mailbox, the places they allow, and the paths of the product that hold a restricted source's content; `gates` the gates of the product's workflow at this job's
  points, with whether their decisions are recorded.
- `Part` — `{ name: string, text: string, size: number, sources: string[], required: boolean, recipe: string, artifacts:
  { id: string, keys: string[] }[] }`: one piece
  of a job's input; `size` in tokens as estimated: its characters divided by three, rounded up — more than most texts
  take, so that a participant whose context is too small is named before anything is sent rather than after —; `sources`
  the identifiers of the requirement sources whose content it
  carries; `required` false only where the kind says the part may be left out, and then only with the reason shown;
  `recipe` the recipe that gave it, whose named place of the prompt it fills — set by the runner, not by the recipe;
  `artifacts` the existing artifacts the part shows the participant, each with its identifier and the values of its
  format's key — for a requirement its name and its rule —, against which `candidate-classes` classifies a draft; empty
  for a part that shows none.
- `Destination` — `{ participant: Participant, role: "drafter" | "reviewer" | "checker", place: string, parts: string[],
  size: number }`: one participant that will receive something, and what; `size` is the kind's prompt, the job's `rules`
  and every part it receives, each estimated as a part's size is.
- `Prepared` — `{ kind: KindDefinition, params: Record<string, unknown>, drafter: Participant | null, reviewers:
  Participant[], rules: Part | null, parts: Part[], destinations: Destination[], fits: boolean, notFitting: { participant: Participant, size:
  number, context: number | null, holds: { requirements: number, useCases: number }, fitting: { requirements: number,
  useCases: number } }[], leftOut: { part: string, reason: string }[], blocking: Finding[], limit: number }`:
  what a run panel or the prompt bar shows before the person's click (`THE PAGE NAMES WHERE IT SENDS`); `rules` is Agent
  M's `AGENTS.md`, read from the instance's snapshot at the root of the instance repository — its text, or, where the
  context names `instance.checkout`, the path of the file in that checkout followed by one sentence asking the participant
  to read it in full first —, `null` where the instance has none: the part with which every input to the drafter and to
  each reviewer begins, before anything else the runner composes, carrying no source, since the restricted-source rules
  concern requirement sources and it is the instance's own file; `parts` holds the parts of
  the drafter's and the reviewers' recipes, each once; `leftOut` the parts a recipe whose part may be left out could not
  give, each with the failure's words as its reason; a `notFitting` entry's `holds` counts the requirements and use cases
  the destination's parts hold and `fitting` how many of them fit its context, as Data states, so that the difference is
  what does not fit — the pages word the reason from these numbers (UC-019 4a); `blocking` the findings of preconditions,
  of eligibility, and of a check that needs what the context lacks — `test-declarations` without the product's host —, which keep the job from
  starting.
- `Round` — `{ number: number, findings: Finding[], answers: { finding: Finding, how: "fixed" | "justified" | "answered",
  text: string | null }[], changed: boolean }`.
- `JobResult` — `{ draft: unknown, raw: string | null, drafter: Participant | null, rounds: Round[], remaining: Finding[],
  forPerson: Finding[], stepFindings: Finding[], classes: Classified[] | null, stoppedBecause: "passed" | "limit" |
  "unchanged" | "unusable" | "not checked" | "gate", gate: string | null, usage: { participant: string, usage: Usage | null }[], written: WriteOutcome |
  null }`: the draft as the output schema reads it; the raw answer, kept folded for a person when it could not be read;
  the participant that drafted it, whom a writer's provenance lines name; every round; what the loop left; what a person
  decides; what the kind's steps found, which the page shows and the writer reads — the mark of a reuse decision without
  its due diligence among them (MOD-reuse-facts); the classes of `candidate-classes`' last round, which the page shows
  and the person may change, `null` for a kind without that check; why the loop stopped; the gate it stopped at; what
  the writer did when it ran at once — `null` while the result waits for a person, or when nothing was written.
- `WriteOutcome` — `{ commits: string[], files: string[], pullRequest: string | null, shown: unknown, notes: string[] }`:
  what a writer did; `shown` is what `return-draft` hands back; `notes` what the writer changed of the draft while
  writing, one line each, which the job's end record lists — a realised name it removed (UC-007 4a).
- `registerStrategies(owner: string, strategies: Partial<Strategies>) -> void` — adds the named strategies a module
  offers. Throws `DuplicateStrategy { strategy, owners }` when a name is registered twice with another strategy — the
  strategy's name in `strategy`, since an error's own `name` is its type —, and then adds none of them; the same strategy
  handed again, by any owner, stays registered under its first owner. A program registers each owner once, before its
  first job.
- `estimate(text: string) -> number` — a text's size in tokens as the runner estimates it: its characters divided by
  three, rounded up; the size prepareJob gives each part, and the one MOD-endpoint-calls' execution loop bounds its tool
  results by.
- `prepareJob(kind: string, context: JobContext, choice: { drafter: Participant | null, reviewers: Participant[], limit?:
  number }) -> Promise<Prepared>` — sends nothing. It reads the kind, evaluates its preconditions, reads Agent M's
  `AGENTS.md` once from the instance's snapshot as the job's `rules`, builds the parts from its recipes, estimates their
  sizes — the `rules` counted in every destination's size —, and checks each destination with MOD-participant-list's `eligible`: the
  capabilities the kind needs, the places every part's sources and the mailbox allow, the context against the size, and
  for a reviewer or checker that it `differs` from the drafter and, for checkers, from each other. Nothing is truncated:
  what does not fit is named in `notFitting`, with how many requirements and use cases each destination holds and how many of
  them fit (`NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY`, `NOTHING IS LEFT OUT
  OF AN ARCHITECTURE PROMPT SILENTLY`, `NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY`). The limit is fixed here, before
  the first round: the caller's, else the kind's (`THE CORRECTION LOOP HAS A FIXED LIMIT`). Throws `UnknownKind`,
  `UnknownStrategy { strategy }` for a strategy no module registered, and whatever a recipe throws by name — except a recipe
  whose part may be left out: its part is left out, in `leftOut`.
- `runJob(prepared: Prepared, drivers: { drafter: Driver | null, reviewers: Driver[] }, options: { attended: boolean,
  context: JobContext, from?: unknown, refine?: unknown, onRound?: (round: Round) => void, onOutput?: (chunk: string) =>
  void, onGate?: (gate: string) => Promise<void>, signal?: AbortSignal }) -> Promise<JobResult>` — refuses to start while
  `prepared.blocking` or `prepared.notFitting` is not empty (`NotStartable`). With `refine`, the drafter's first exchange
  carries that draft as `previous`, beside the job's parts with the person's follow-up instruction among them, and the
  drafter changes it as the instruction says — the follow-up message of a conversation on a draft (UC-019 step 8). Where
  the kind names tools, each exchange with the drafter carries the `ToolUse` the drafter may have; the edits it proposes
  through `propose-edit` become the draft's `edits` and are checked in the round as every drafted document is. It sends
  the input to the drafter — or, with
  `from`, begins with that draft, one a person changed and wants checked again as a whole (UC-022, UC-023), and without a
  drafter only checks it once and returns the findings on it, stopped `passed` when nothing is found, `limit` when a
  finding is left, and `not checked` when a reviewer's answer cannot be read —, reads the answer by the output schema —
  an answer that cannot be read is a
  finding of the loop, and if it still cannot be read after the last round the result is `unusable` —, runs the kind's
  checks and then its reviewing participants, whose findings are warnings
  whatever they say (`A REVIEWER'S FINDING IS A WARNING`); an answer of a reviewer that cannot be read is a check not done,
  asked again within the limit, and the result is `not checked` if it never can be read. Findings whose rule the kind
  leaves to a person go to `forPerson` and are never sent back (`WHAT A PERSON DECIDES IS NOT SENT BACK`); errors and
  warnings go back to the drafter, which must fix every error and fix or justify each warning in one line, and answer a
  reviewer's finding that does not hold with its reason (`A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON`): a warning
  it justified, or a reviewer's finding it answered, is settled and not sent back again, while an error stays open until
  a check no longer finds it. The loop stops when nothing is left open, at the limit, or when a round leaves the same
  findings open as the round before; after a round in which only a reviewer's answer could not be read, the next round
  checks the same draft again — its checks and its reviewing participants — without sending the drafter anything. Then
  the kind's steps run, so
  that a person sees what they add, such as the due diligence (UC-022), and what they find goes into `stepFindings`,
  never back to the drafter. At a gate point of the kind whose gate in `context.gates` is not passed, it calls `onGate`
  — the route appends the gate to the job's record — and stops with `gate`: at `before-write` before the writer runs, so
  that nothing is written, and at `before-merge` after it, once the pull request exists. The point `question` is not
  handled: an answer's envelope has no field in which a participant asks a question, so the runner cannot see one. What
  follows depends on the kind's `review` and on `attended`, which the caller sets when a person started the
  job on the page and waits for its result, outside a run:
  - a kind of `review: person`, attended: the job ends with the draft, its rounds and the findings left, and writes
    nothing; `writeResult` writes it on the person's click;
  - otherwise — `review: none`, or nobody attends: a job on CI or on a Bridge that runs it, an agent planner's among them
    (UC-045), and every job of a run (UC-043) —: it calls the kind's writer at once (`A CI AGENT'S DRAFT ENTERS AS OPEN`),
    which refuses by name what it must not write, unless the signal was aborted: after a cancel, nothing more is written
    (`A CANCELLED JOB WRITES NOTHING MORE`).

  A driver's failure ends the job and is thrown by name; `Cancelled` when the signal is aborted.
- `writeResult(prepared: Prepared, draft: unknown, options: { result: JobResult, context: JobContext }) ->
  Promise<WriteOutcome>` — writes a result that waited for a person, on their click — *Write proposals*, *Save*, *Save
  plan*, *Add to backlog*: runs the kind's steps again on the draft as the person left it, since they may have changed
  what a step works on, such as the reuse candidate they chose, and then calls the kind's writer with `result`, its draft
  and its `classes` replaced by theirs and its `stepFindings` by those the steps return now. `result` is what `runJob`
  returned, whose drafter and rounds the provenance lines name; `context` is read at the click, so that the writer commits on the current
  head. Throws what the writer throws by name — `DueDiligenceMissing` from `open-files`, which then writes nothing, while
  a reuse decision carries the mark of a registry that could not be read (UC-022); a refused commit because the branch
  moved.
- `sourcesOf(context: JobContext, path: string) -> string[]` — the sources of every `context.places.contents` entry that
  names the path or a folder above it, once each: what a part holding that file carries (`RESTRICTED CONTENT GOES ONLY
  WHERE ITS SOURCE PERMITS`).
- `handOverParams(worksOn: string[], snapshot: Snapshot) -> Record<string, unknown>` — the parameters a hand-over's job
  takes for what it works on, by the keys the kinds' strategies read: `requirements` for the names that are
  neither an identifier nor a web address, `useCases` for the use cases and `useCase` beside it for one alone, `steps` for the plan's steps — the
  `ITM-<n>` the snapshot holds as a file under `docs/plan/` — and `items` for the other `ITM-<n>`; a key it would leave
  empty is left out, and any other identifier is in the job's `works_on` only. Pure, but for reading the snapshot's
  paths.
- `refusedEdit(path: string) -> string | null` — why `propose-edit` refuses a document, naming where it is changed, as
  the table under Data states; `null` for a document it holds; the writer `proposed-edits` reads it too, so that the rule stands once.
- `provenanceLines(job: { agentM: { version: string, commit: string }, jobId: string | null, kind: string, participant:
  Participant, rounds: number }) -> string[]` — the trailer lines defined under Data; a job without a record — a
  conversation held in the tab — has no `Agent-M-Job` line.
- `roundsText(rounds: Round[], left: Finding[], forPerson: Finding[], stoppedBecause: string, limit: number) -> string` —
  the round record's text form defined under Data, for the job's record.

## Files

It reads the data files of MOD-job-catalogue through `kindOf`, its own `rounds.schema.md`, the instance's `AGENTS.md`
through the instance's snapshot, for `test-declarations` the
branch a coding participant reports, through the host, and for `group-rules` the group file and the items of its kind in
the product's snapshot. It writes nothing itself: the writers write — its own `proposed-edits` a branch `agent-m/<job>`
and its pull request, through the product's host —, and the route appends to the job's record.

## Uses

- `MOD-job-catalogue.kindOf`, `MOD-job-catalogue.KindDefinition` — the definition it interprets;
  `MOD-job-catalogue.toolsOf`, `MOD-job-catalogue.ToolDefinition` — the descriptions and argument schemas of the tools a
  kind names.
- `MOD-participant-list.eligible`, `MOD-participant-list.differs`, `MOD-participant-list.Participant` — who may receive
  what, and that reviewers and checkers differ.
- `MOD-documents.documentFindings`, `MOD-documents.readDocument`, `MOD-documents.artifactSchemas`,
  `MOD-documents.artifactSchemaOf`, `MOD-documents.classifyCandidates` and the types `MOD-documents.Candidate` and
  `MOD-documents.Classified`, `MOD-trace-graph.traceGraph`, `MOD-trace-graph.graphFindings`,
  `MOD-trace-graph.selfSufficiencyFindings`, `MOD-spec-document.requirementFindings`, `MOD-spec-document.parseSpec`,
  `MOD-group-document.parseGroupFile`, `MOD-group-document.applyMoves`, `MOD-group-document.hierarchy` and the type
  `MOD-group-document.GroupMove`, `MOD-test-document.testFindings`, `MOD-test-document.testDeclarations`,
  `MOD-test-document.isTestFile` — the built-in checks.
- `MOD-documents.loadSchema` — the round record's schema.
- `MOD-text-tools.finding`, `MOD-text-tools.formatFinding`, `MOD-text-tools.Finding` — findings of its own, such as an
  answer that cannot be read, and their text in the round record.
- `MOD-identifiers.kindOfIdentifier` — whether an artifact of a part is a requirement or a use case, for the counts of
  `notFitting`.
- `MOD-repository-hosts.Snapshot`, `MOD-repository-hosts.Host` — the types of the context.
- `MOD-repository-hosts.readSnapshot` — the branch a coding participant reports, for `test-declarations`.
- `MOD-repository-hosts.repositoryInfo`, `MOD-repository-hosts.commitFiles`, `MOD-repository-hosts.openPullRequest` — the
  branch and the pull request of `proposed-edits`.
