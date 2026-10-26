---
id: MOD-prompt-bar
title: The prompt bar, where a person talks to an agent about the page
folder: src/prompt-bar/
realises:
follows:
  - ARC-038
uses:
  - MOD-browser-store.Store
  - MOD-browser-store.readSetting
  - MOD-browser-store.listSettings
  - MOD-browser-store.readTabValue
  - MOD-browser-store.writeTabValue
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.listCiRuns
  - MOD-repository-hosts.ciRunLog
  - MOD-repository-hosts.webLinks
  - MOD-documents.Schema
  - MOD-documents.loadSchema
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.readRegister
  - MOD-participant-list.Participant
  - MOD-participant-list.participantSchema
  - MOD-participant-list.participantsOf
  - MOD-participant-list.eligible
  - MOD-job-catalogue.kindOf
  - MOD-job-runner.prepareJob
  - MOD-job-runner.Prepared
  - MOD-job-runner.JobResult
  - MOD-job-runner.Strategies
  - MOD-approvals.approvalStrategies
  - MOD-spec-changes.specStrategies
  - MOD-artifact-edits.editStrategies
  - MOD-source-register.sourceStrategies
  - MOD-source-register.sourceSchemas
  - MOD-source-register.registerPaths
  - MOD-source-register.restrictedPlaces
  - MOD-reuse-facts.reuseStrategies
  - MOD-resource-list.resourceStrategies
  - MOD-work-plans.workStrategies
  - MOD-run-planner.runStrategies
  - MOD-product-process.processStrategies
  - MOD-test-schedule.scheduleStrategies
  - MOD-result-records.resultStrategies
  - MOD-issue-handling.issueStrategies
  - MOD-runtimes.routeStrategies
  - MOD-job-ledger.listJobs
  - MOD-job-ledger.JobRecord
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.JobStart
  - MOD-runtimes.tabContext
  - MOD-runtimes.runOnTab
  - MOD-runtimes.routesFor
  - MOD-runtimes.handOverJob
  - MOD-work-plans.startable
  - MOD-work-plans.itemStates
  - MOD-product-process.holdsRole
  - MOD-progress-measures.productFacts
  - MOD-runtimes.liveState
  - MOD-runtimes.jobLog
  - MOD-runtimes.cancelJob
  - MOD-bridge-client.Bridge
  - MOD-bridge-client.settingsOf
  - MOD-bridge-client.bridgeAt
  - MOD-bridge-client.testBridge
  - MOD-markdown-render.renderArtifact
  - MOD-text-tools.Finding
provides:
  - Subject
  - Message
  - ConversationDraft
  - startPromptBar
  - latestDraft
  - dropDraft
  - currentJob
  - recordingSchema
  - recordingOf
  - handOverStrategies
  - endpointLacks
  - endpointsOffered
  - spawnEndpointJob
  - followJob
---
# MOD-prompt-bar The prompt bar, where a person talks to an agent about the page

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the conversation of UC-049: the prompt bar attached to the
bottom of every main and review page, the only place where a person writes to an endpoint or a CLI session. It offers
what this browser's configuration reaches — its model endpoints, and the CLI sessions its Bridges offer —, each named
with the place where it processes data (`THE PAGE NAMES WHERE IT SENDS`); it holds the conversation in the browser tab;
it sends each message as a job of the kind the page's subject names, with the page as its context, run in this tab
without a job record; it shows the answer, and leads a draft to the review page that shows it; it shows a hand-over the
participant proposes, queues it only on the person's click and only where Process's start rules let it start, and
follows it until it has ended; and, where the instance switches recording on, it appends every message to a conversation
record (`A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON`, `A RECORDED CONVERSATION IS KEPT WHERE IT
WAS HELD`).

It is no view: the frame starts it on the main and the review pages, never in the Bridge's window, and hands it what it
needs from the frame — the subject of the route shown, the folded explanations, and the frame's navigation — so that it
uses neither the frame nor a view (`MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE`). It runs in a browser.

## Parts

- `index.mjs` — the interface.
- `bar.mjs` — the bar: the selector, the input, *Send* — *Spawn job* for an endpoint that runs through GitHub Actions — and *Stop*, the conversation, the waiting for a handed-over job.
- `offer.mjs` — the endpoints and CLI sessions offered, read from this browser's configuration, and the place each is
  named with.
- `send.mjs` — preparing and running a message as a job in this tab.
- `hand-over.mjs` — a proposed hand-over assessed against the start rules, and queued on the person's click.
- `follow.mjs` — a handed-over job followed by its record and its live state, its log, and *Stop*.
- `record.mjs` — the conversation record and the recording switch.
- `conversation.schema.md`, `recording.schema.md` — the schemas of the two files it owns, in the schema language of
  MOD-documents.

## Data

**The conversation** is held in the browser tab, through MOD-browser-store's tab values, so that it goes on when the
person moves between the main page and the review pages in the same tab and ends with the tab. It holds the messages, the
participant talked to, the latest draft, the job handed over while it runs, and the height the person set with the
bar's grip. Nothing of it is written to a repository
unless recording is on, and nothing of it is kept in `localStorage` or exported with the settings. It holds no state of a
job: while a message runs, the job is this tab's running job; a handed-over job's state is derived from its record and
its runtime (`PROGRESS AND JOB STATE ARE DERIVED, NOT STORED`).

**The recording switch**, `docs/conversation-recording.md` of the instance repository, a document of the common shape read
with `recording.schema.md`: front matter with the key `recording`, `on` or `off`. A missing file or key means `off`. The
settings page edits it (MOD-settings-pages); this module reads it at every *Send*, so that a switch changed on another
page holds for the next message.

```markdown
---
recording: on
---
# Recording of conversations
```

**The conversation record**, `docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md` in the repository of the product whose page
the conversation is held on — the instance's own for a page of the instance —, the date and time those of its first
message in UTC, the four hexadecimal digits random. A conversation held on pages of several repositories has one record
in each. It is written by the first message and then only appended to, one section per message; nothing in it is changed
or removed. It is a record: never shown for acceptance (`A RECORD IS EVIDENCE, NOT A PROPOSAL`), and no reviewed kind's
folder holds it.

| Part | Holds |
|---|---|
| front matter | `started` — the date and time of the first message; `started_by` — the person's account |
| `## <date and time> — <account or participant>` | one per message: `page:` the subject's title, for a participant `model:`, then the message as written; or, instead of the text, `withheld:` with the reason |
| `## <date and time> — handed over` | `job:` the job a message handed over (UC-049 4a) |

A message is withheld — its section names that and why, and nothing of its text — when the page's subject withholds it,
as a page of mail does for a name, address, phone number or account found in that mail (`NO PERSONAL DATA FROM A MAIL
ENTERS A REPOSITORY`), or when the repository host refuses the commit because the text holds a stored secret (`NO SECRET
IN THE REPOSITORY`).

## Interfaces

- `Subject` — `{ key: string, title: string, kind: string, entry: string | null, paramsFor: (participant: Participant) ->
  Record<string, unknown>, draftRoute: string | null, withhold: ((text: string) -> string | null) | null, refuses:
  string[] }`: what a message on the page
  shown is about, given by the route that shows it (MOD-site-frame's `Route.subject`), or by the frame for a route that
  gives none. `key` names the subject, so that a draft is shown only for the subject it was drafted on; `title` is what
  the bar and the record say the message was about; `kind` is the kind of MOD-job-catalogue a message runs — `converse`
  unless the route names another, such as `change-requirements` on a requirement; `entry` the menu entry of the page
  shown, as MOD-site-frame's `Route` gives it, which the frame sets on every subject, `null` for a route out of the menu; `paramsFor` gives the
  kind's parameters for the participant chosen — the target and its version, and `page`, the page as the participant may see it, so that a
  page of mail gives a mail's text only to a participant the mailbox allows and that does not write to the repository,
  and its `MAIL-` identifier to any other (UC-049 3b), and a page of settings names each setting and whether it is stored,
  never its value (UC-049 3c); `draftRoute` the route of the review pages that shows a draft of this subject, `null` where
  the kind's answer is text only; `withhold` what a message on this page must not be recorded for, with the reason;
  `refuses` the tools of the kind that are not offered on this page — on a page of mail, `propose-edit` and
  `hand-over`, so that nothing of a mail reaches a participant that writes or a file (UC-049 3b).
- `Message` — `{ at: Date, from: "person" | "participant", who: string, text: string, subject: string }`.
- `ConversationDraft` — `{ subject: string, kind: string, participant: string, params: Record<string, unknown>, result:
  JobResult }`: the latest draft of the conversation, kept in the tab until the person saves or discards it or a newer
  draft replaces it.
- `startPromptBar(target: Element, setup: { page: "main" | "review", store: Store, instance: { repository: string, host:
  Host }, product: () -> { address: string, host: Host } | null, subject: () -> Subject, explain: (topic: string) ->
  Element, go: (route: string, params?: Record<string, string>) -> void, instanceSnapshot?: () -> Snapshot | null }) -> { stop: () -> void }` — draws the bar into
  `target`, fixed to the bottom of the window, and keeps it for the life of the page. Where the page hands `instanceSnapshot`
  and it gives the instance's default branch as the page's own load read it, the bar reads through it and asks the host for no
  commit and no tree again (`A PAGE LOAD READS THE REPOSITORY IN BATCHES`); else it reads the default branch itself. It first reads this browser's
  configuration, and reads no participant list for the offer (UC-049 1). It offers each model endpoint the store keeps
  under `endpoint:<name>`, called by the tab or through the Bridge its setting names, and each CLI session — a coding
  agent that a Bridge the store keeps under `bridge:<name>` offers, as MOD-bridge-client's `testBridge` lists it ready
  —, whose configuration declares a place, a context and a model; one that lacks any of them is not offered (UC-049 1b),
  and with none offered it draws nothing and says nothing (UC-049 1a). It hands each to the job runner as a
  `Participant` of MOD-participant-list's shape, built from its configuration:
  - for an endpoint, the type *model endpoint*, its model, the capabilities *draft text* and *read the repository*, and
    *use tools* where its last test found that the model calls tools (`last-test:endpoint:<name>`), its context and
    place, and the route `endpoint <name>`, with ` secret <NAME>` where its configuration names the CI secret of its
    key;
  - for a CLI session, the type *CLI agent*, and its model, capabilities, context and place as
    `session:<bridge>:<agent>` declares them, and the route `bridge <bridge> agent <agent>`.

  Of those offered it offers, for the page shown, only each that can do the subject's kind: `eligible` judges them
  against the `needs` of `kindOf`'s definition of that kind, so that the offer follows the subject (UC-019 2). Where
  some are offered and none can do the kind, it says so, names the capabilities the kind needs, and links the route
  `endpoints` through `go` (UC-019 3a). Beside this browser's endpoints, and after them, it still offers the participants of
  the instance's list that this browser reaches, other than an endpoint offered already, until the offer of CLI sessions
  is built. With one offered, it names it; with several, a small selector above the input
  chooses, each named with its processing place. A folded *What is this?* explains the bar. An endpoint that names the
  CI secret of its key and no Bridge runs through GitHub Actions, whether or not this browser keeps its key: while it is
  chosen, the button reads *Spawn job* instead of *Send*, and that click — the person's — makes the message the task of
  a job that is the endpoint's own (UC-049 4a.1), of the subject's kind, spawned with `spawnEndpointJob` and followed as
  a hand-over is; nothing is sent from the tab. For every other one it reads *Send*. On *Send* — the decision to
  send — it asks the subject for the kind and the parameters, adds the person's words as `instruction`, the conversation
  so far as `conversation`, the subject's `entry` as `entry` and its `refuses` as `refuses`, prepares the job with
  MOD-job-runner's `prepareJob` in a context from MOD-runtimes' `tabContext` — so that the message reaches the participant
after Agent M's `AGENTS.md`, as MOD-job-runner composes every input (`EVERY MODEL READS AGENT M'S AGENTS.MD FIRST`) —,
and sends nothing while the job does not
  fit or a finding keeps it from starting, naming what (UC-049 3a, UC-019 4a, 4b): for a participant the job does not
  fit, it names the participant, how many requirements and use cases the job holds for it and how many of them fit, from
  the `holds` and `fitting` of that `notFitting` entry, and the tokens of its context against the job's size. It names
  every destination before it sends — the drafter and, for a kind with reviewers, each reviewer, with its processing
  place. With recording on — read from the instance at that moment —, it first appends the person's message to the
  conversation record of the page's repository, as a commit with the token of that repository on the head that was read,
  and again on a moved head; a message the subject withholds, or whose commit the host refuses for a stored secret, is
  appended as withheld and sent; a message whose record cannot be appended for any other reason is not sent, and the bar
  says why (`A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD`). It runs the job with `runOnTab` and no job record,
  attended, and shows the answer: the text, the rounds and the findings the loop left, and, for a draft, *Review the
  draft*, which keeps the `ConversationDraft` and goes to the subject's `draftRoute`; with recording on, the
  participant's answer is appended as the result of the same *Send*. *Stop* aborts the job in the tab (UC-049 5a). A
  hand-over the participant proposed (UC-049 4a) is shown with its kind, what it works on, its task, the participant
  with its processing place and the route it would take, which `routesFor` gives; *Hand over* is the decision. For the
  subject's own kind, the hand-over's job takes, beside what the hand-over works on, only the `source` that the
  subject's `paramsFor` gives for the participant — no other parameter, so that no message and no page text enters the
  job's record (`A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON`); where the subject finds no own
  source of the person, `paramsFor` refuses by name, `NoPersonSource`, and so does the hand-over, with nothing queued
  (`THE PERSON WHO PROMPTS IS A SOURCE`). For a kind of the product's workflow, it is queued only for a participant of
  the instance's list that the hand-over names, never for the endpoint or CLI session itself, and, for a hand-over that
  works on an item of the backlog or a step of the plan (`ITM-<n>`), only when
  MOD-work-plans' `startable`, on the item states `itemStates` derives from the facts MOD-progress-measures'
  `productFacts` reads, finds no reason — not selected for its team's sprint, a requirement or use case not accepted,
  the work-in-progress limit, a gate not recorded — and MOD-product-process' `holdsRole` finds that participant in the
  implementing role of the item's role assignment; otherwise the reasons are shown and nothing is queued (`NOTHING IS
  IMPLEMENTED BEFORE IT IS ACCEPTED`, `A JOB GOES ONLY TO A HOLDER OF ITS ROLE`). It reads those facts only for such a
  hand-over; for one that works on no item or step — a job that is an endpoint's own among them —, no start rule applies,
  its job's own preconditions decide when it is prepared, and of the product it reads only the default branch: its head,
  on which the job's record is committed, its paths — whether it holds the job workflow, and the records under
  `docs/jobs/`, against whose identifiers the job's identifier is new, without reading a record — and its visibility,
  for `routesFor`. It queues and starts the job with
  MOD-runtimes' `handOverJob` — for a job that is the endpoint's own, with a start whose `participant` and `model` name
  the endpoint, whose destinations name its place, and whose `declares` holds its context and capabilities
  (MOD-job-ledger) —, then follows it by its record and
  `liveState` until it has ended — *waiting for GitHub Actions* with the run's address, or for the Bridge —, and shows
  its log's answer and the commits its end record names; *Stop* then cancels it with `cancelJob`. It says above the
  selector when the conversation is recorded (UC-049 6c). Crosses the network: to the participant through its route, and
  to the repository servers to read the subject, the participants, the switch and, for a hand-over that works on an
  item or step, the facts, to append the record, and to queue and start a hand-over. A failure of the participant's route is shown in the conversation by name. A hand-over
  the product cannot take yet says what is missing and links where it is set up (UC-049 4c): while the product has no
  job workflow — the CI route unavailable, `routesFor` naming its files — the route `settings` through `go`, whose
  product section installs it; for a run ended `not run` for a missing secret, the server's page of the repository's
  secrets (MOD-repository-hosts' `webLinks`, `secrets`), naming the secret. Such a run writes neither `## Taken` nor
  `## End` (MOD-workflow-entries), so `liveState` and `jobLog` cannot report it; while a followed hand-over stays queued
  and untaken on the CI route, each poll lists the runs of the job workflow with `listCiRuns`, and when a failed run no
  older than the job's start turns up it reads that run's log once with `ciRunLog` and takes the secret from the entry's
  line `not run — <SECRET> is missing`. The cost is one `listCiRuns` call per 15-second poll while the job stays queued
  and untaken, and one `ciRunLog` call when a failed run turns up.
- `endpointLacks(setting: object) -> string[]` — what an endpoint's configuration lacks for the bar to offer it (UC-049 1b): the
  place where it processes data, its context in tokens, its model; empty when it lacks nothing. `endpointsOffered` offers only
  one that lacks nothing; the settings page names the rest where the endpoint is configured.
- `endpointsOffered(store: Store) -> Participant[]` — this browser's endpoints the bar offers, as `startPromptBar` builds
  them; for the settings page's test job of an endpoint.
- `spawnEndpointJob({ kind, task, participant, store, instance, page, ofProduct, conversation, source, instanceSnapshot?
  }) -> Promise<{ id, path, commit, person } | { refused: string, needsWorkflow: boolean }>` — the job that is an
  endpoint's own, on GitHub Actions, on a person's click: assessed and queued as a proposed hand-over is, working on the
  repository of `page`, with `task` travelling in the workflow's inputs, on the server's own runners. It works on no item
  or step of the plan, so it reads none of the product's facts: of the product, its default branch — its head, its
  paths, its visibility —, and of the instance its participant list and the restricted sources' places, which the job's
  preparation takes; `instanceSnapshot` is the instance's default branch where the bar read it already, for the
  recording switch, so that it is not read again. Where no CI route can be taken — no job workflow, or an endpoint
  naming no CI secret — nothing is written and `refused` says why.
- `followJob({ id, address, host, store, show }) -> { stop, cancel }` — a handed-over job followed every 15 seconds until
  its record has its end, `show` given its state, its run's address, its end and, for a run on CI, the answer the run
  left in its log between `--- answer of <id> ---` and `--- end of the answer of <id> ---` (MOD-workflow-entries), read
  once with `listCiRuns` and `ciRunLog` when its end is read.
- `latestDraft(store: Store, subject: string) -> ConversationDraft | null` — the conversation's latest draft, if it was
  drafted on that subject; for the review pages' route that shows it.
- `dropDraft(store: Store, subject: string) -> void` — drops the conversation's latest draft, if it was drafted on that
  subject; for the review pages' route once the person saves or discards it.
- `currentJob() -> { kind: string, participant: string, started: Date, state: "running" } | null` — the message of this
  page's conversation that is running in this tab at the moment of the call, for the list of every job (`ONE DASHBOARD
  SHOWS EVERY JOB`), which shows it as this tab's, in the state `running`; `null` while none runs. A handed-over job is
  listed by its record like any other.
- `recordingSchema() -> Schema` — the schema of the recording switch, read from this module's data file, for the settings
  page's form.
- `recordingOf(instance: Snapshot) -> Promise<boolean>` — whether the instance records conversations; `false` for a missing
  file or key.
- `handOverStrategies: Strategies[]` — the strategy sets a hand-over of the bar is prepared with in the tab, which it
  hands to the frame as a view hands the strategies of its kinds. These are the sets the job workflow registers in CI
  (MOD-workflow-entries, Uses), since a handed-over job runs on CI or on a Bridge.

`Store` is MOD-browser-store's; `Host` and `Snapshot` are MOD-repository-hosts'; `Schema` is MOD-documents'.

## Files

It reads the instance's `docs/participants.md` and `docs/conversation-recording.md`, and the files the subject's kind
reads, through the job runner. With recording on, it writes, through the host of the page's repository, the conversation
records under `docs/conversations/`. It keeps the conversation in the tab's values of MOD-browser-store.

## Uses

- MOD-browser-store.Store, MOD-browser-store.readSetting, MOD-browser-store.listSettings — the endpoints, the Bridges
  and the CLI sessions' declarations this browser keeps; MOD-bridge-client.testBridge — the CLI sessions a Bridge
  offers; MOD-browser-store.readTabValue, MOD-browser-store.writeTabValue — the conversation, held in the tab.
- MOD-repository-hosts.Host, MOD-repository-hosts.readSnapshot, MOD-repository-hosts.repositoryInfo — the participants,
  the switch, the head the record is appended on; MOD-repository-hosts.commitFiles — appending to the record;
  MOD-repository-hosts.webLinks — the server's page of the repository's secrets, linked when a secret is missing;
  MOD-repository-hosts.listCiRuns, MOD-repository-hosts.ciRunLog — the runs of the job workflow and a failed run's log, to
  learn that a hand-over's run ended `not run` and which secret it named.
- MOD-documents.loadSchema, MOD-documents.readDocument, MOD-documents.writeDocument, MOD-documents.readRegister — its two
  files and the participant list.
- MOD-participant-list.Participant — the shape an endpoint or a CLI session is handed to the job runner in;
  MOD-participant-list.participantSchema, MOD-participant-list.participantsOf — the participants a hand-over of a kind
  of the product's workflow is checked against; MOD-participant-list.eligible, MOD-job-catalogue.kindOf — which of the
  offered can do the subject's kind.
- MOD-job-runner.prepareJob, MOD-job-runner.Prepared, MOD-job-runner.JobResult — a message prepared and checked to fit,
  and its result; MOD-job-runner.Strategies — the type of `handOverStrategies`.
- MOD-approvals.approvalStrategies, MOD-spec-changes.specStrategies, MOD-artifact-edits.editStrategies,
  MOD-source-register.sourceStrategies, MOD-reuse-facts.reuseStrategies, MOD-resource-list.resourceStrategies,
  MOD-work-plans.workStrategies, MOD-run-planner.runStrategies, MOD-product-process.processStrategies,
  MOD-test-schedule.scheduleStrategies, MOD-result-records.resultStrategies, MOD-issue-handling.issueStrategies,
  MOD-runtimes.routeStrategies — the sets of `handOverStrategies`.
- MOD-source-register.registerPaths, MOD-source-register.sourceSchemas — the entries of the instance's register, read from
  its snapshot; MOD-source-register.restrictedPlaces — over every one of them, whether or not the product links it, the
  places of the restricted sources that a message's or a hand-over's job is given (MOD-job-runner's `JobContext.places`),
  and the paths of the product that hold their content, so that the job's `read-file` refuses that content to a participant
  at another place (UC-049 4e). The module keeps no copy of that rule.
- MOD-runtimes.tabContext, MOD-runtimes.runOnTab — the job's context and its run in this tab without a record;
  MOD-runtimes.routesFor, MOD-runtimes.handOverJob — the route of a hand-over, and its job queued and started;
  MOD-work-plans.startable, MOD-work-plans.itemStates, MOD-progress-measures.productFacts, MOD-product-process.holdsRole —
  whether a hand-over of a kind of the product's workflow may start, by the same rules as every implementation job;
  MOD-runtimes.liveState, MOD-runtimes.jobLog, MOD-runtimes.cancelJob, MOD-job-ledger.listJobs,
  MOD-job-ledger.JobRecord — a handed-over job followed, its answer, and *Stop*; MOD-job-ledger.newJobId,
  MOD-job-ledger.JobStart — the identifier and the start of the job a hand-over queues.
- MOD-bridge-client.Bridge, MOD-bridge-client.settingsOf, MOD-bridge-client.bridgeAt — the Bridges handed to the
  runtimes, each from its stored entry and the stored jump host.
- MOD-markdown-render.renderArtifact — the answers, rendered safely.
- MOD-text-tools.Finding — the findings a message's preparation or its loop names.
