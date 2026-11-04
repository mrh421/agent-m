---
id: MOD-implementation-pages
title: The pages of implementation
folder: src/implementation-pages/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.runPanel
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.schemaForm
  - MOD-markdown-render.renderArtifact
  - MOD-markdown-render.renderMermaid
  - MOD-markdown-render.showDifference
  - MOD-browser-store.readSetting
  - MOD-bridge-client.bridgeAt
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.listPullRequests
  - MOD-repository-hosts.pullRequestFacts
  - MOD-repository-hosts.mergePullRequest
  - MOD-repository-hosts.listCiRuns
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.webLinks
  - MOD-documents.artifactSchemas
  - MOD-documents.readDocument
  - MOD-documents.writeDocument
  - MOD-documents.readRegister
  - MOD-artifact-edits.saveFile
  - MOD-approvals.approvalStrategies
  - MOD-model-catalogue.catalogue
  - MOD-model-catalogue.modelSchema
  - MOD-model-catalogue.modelFindings
  - MOD-model-catalogue.planGrid
  - MOD-model-catalogue.modelDiagram
  - MOD-product-process.declarationSchema
  - MOD-product-process.declarationFindings
  - MOD-product-process.roleAssignmentSchema
  - MOD-product-process.roleAssignmentFindings
  - MOD-product-process.workflowOf
  - MOD-product-process.holdsRole
  - MOD-product-process.doneCheck
  - MOD-work-plans.planSchemas
  - MOD-work-plans.targetBranch
  - MOD-work-plans.itemStates
  - MOD-work-plans.startable
  - MOD-work-plans.heldItems
  - MOD-work-plans.conflicts
  - MOD-work-plans.planFindings
  - MOD-work-plans.backlogFindings
  - MOD-work-plans.savePlan
  - MOD-work-plans.saveItems
  - MOD-work-plans.startSprint
  - MOD-work-plans.endSprint
  - MOD-work-plans.workStrategies
  - MOD-trace-graph.storedGraph
  - MOD-trace-graph.latestGraph
  - MOD-run-planner.runStrategies
  - MOD-progress-measures.productFacts
  - MOD-progress-measures.progressIn
  - MOD-progress-measures.ProgressView
  - MOD-progress-measures.BacklogView
  - MOD-progress-measures.progressView
  - MOD-progress-measures.backlogView
  - MOD-progress-measures.storedView
  - MOD-repository-hosts.readFileAt
  - MOD-test-schedule.scheduleStrategies
  - MOD-result-records.resultStrategies
  - MOD-participant-list.participantSchema
  - MOD-participant-list.participantsOf
  - MOD-participant-list.eligible
  - MOD-source-register.sourceSchemas
  - MOD-source-register.restrictedPlaces
  - MOD-spec-document.parseSpec
  - MOD-job-catalogue.kindOf
  - MOD-job-runner.prepareJob
  - MOD-job-runner.writeResult
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.listJobs
  - MOD-job-ledger.jobState
  - MOD-runtimes.routesFor
  - MOD-runtimes.queueJob
  - MOD-runtimes.runOnTab
  - MOD-runtimes.liveState
  - MOD-runtimes.cancelJob
  - MOD-runtimes.retryJob
  - MOD-runtimes.routeStrategies
provides:
  - view
---
# MOD-implementation-pages The pages of implementation

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the menu entry Implementation: how a product is developed,
who fills its roles, and the process models of the instance; the implementation plan, or the backlog with its sprints;
starting the jobs of steps or items; and progress in the model's own measure. It shows what
Process derives and turns each decision into one call of the service that owns it.

It serves UC-002, UC-024, UC-031, UC-032, UC-034, UC-035, UC-045 and UC-048.

It runs in a browser, loaded by `docs/index.html` through MOD-site-frame.

## Parts

- `index.mjs` — the interface: `view`, the routes of routes.mjs with the strategies of the view's kinds.
- `routes.mjs` — the routes' heads, the view module the frame loads at start; it imports index.mjs, and with it the
  strategies, only when a job is prepared (`loadStrategies`).
- `process.mjs` — how the product is developed, and the instance's process models.
- `roles.mjs` — who fills the roles: the product's role assignments.
- `plan.mjs` — the implementation plan.
- `backlog.mjs` — the backlog, each team's last sprint that has ended, the planning of a team's sprint, the board.
- `implement.mjs` — starting the jobs of steps or items, the merge of a pull request.
- `progress.mjs` — progress in the model's measure, each team's running sprint, gates, what is blocked, who works on
  what.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/dashboard-process-view.test.mjs`, `tests/dashboard-backlog-teams.test.mjs`: their headers name this module.

## Data

It keeps nothing but the screen, an unsaved form, and the result of a drafting job that waits for the person's click.
Its formats are those of the modules it uses.

## Interfaces

- `view: View` — its routes, and the strategies its kinds use in the tab — `workStrategies`, `runStrategies`,
  `scheduleStrategies`, `resultStrategies`, `routeStrategies`, `approvalStrategies`:
  - `process` — *How this product is developed*: the five models in their two groups, each with what its `about` holds —
    the risk it manages well, the risk it accepts, an example project it suits, its chapter —, the roles with
    whether a person, an agent or either may hold them, the capabilities each needs and whether one participant fills it
    or several may, phases, transitions, verification
    pairs and gates with their deciders, a branch for a phase or sprint, practices, what the product's process
    requirements add, the Definition of Done, in a form from the declaration's schema; the findings of
    `declarationFindings`; *Save* writes the declaration with `saveFile`, naming the declared model's version by the commit of the
    instance its catalogue was read at. When the author selects another model than the declared one, the route lists the
    kinds of artifact the declared model's phases produce and the selected one's do not, and deletes none. When the
    catalogue as it stands holds another version of the declared model than the commit the declaration names — their
    `version`s differ —, the route shows what the new version changes for the product before *Save* names it (UC-031
    6a):
    - the phases, gates and roles of `workflowOf` under each version, side by side;
    - the difference of the two model files, with `showDifference`;
    - what becomes invalid: what `declarationFindings` finds for the declaration as it would be saved, naming the current
      commit, against the catalogue as it stands, and what `roleAssignmentFindings` finds for the role assignments
      against that version's workflow.
  - `roles` — *Roles* (UC-048): the product's role assignments — its teams, in a model with sprints —, each with who fills
    which role, and the roles of the model with what each needs and how many fill it; for a role, the participants of the
    instance's list that have every capability it needs, each with where it processes data; *+ Team* in a model with
    sprints; the findings of `roleAssignmentFindings`, given the entries of the instance's source register that the
    product's `docs/sources.md` links; *Save* writes a role assignment with `saveFile`; a team is removed only while no
    sprint of it holds an item (`heldItems`): *Remove team* deletes its role assignment file in one commit with
    MOD-repository-hosts' `commitFiles`, on the head that was read and with the person's token, and otherwise names the
    items its sprints hold (UC-048 4b).
  - `models`, `models/<name>` — the instance's process models: the catalogue, *Adapt* and *+ New model* with a form from
    the model's schema, the live diagram, the errors beside their fields, the preview of every accepted requirement in
    every phase, *Save* only without errors, with `saveFile`. Which products of this browser declare a model, it reads
    from each product's `docs/process.md` alone, through a snapshot of its default branch narrowed to that file
    (MOD-repository-hosts' `readSnapshot` with `folders`), never the product's whole tree.
  - `plan` — first the declaration and the declared model's file at the commit the declaration names, read with
    MOD-repository-hosts' `readFileAt`: for a model that works from a backlog, a link to `backlog`, and nothing else is
    read (UC-045 1a); otherwise the architecture's subsystems and modules beside the plan's steps with their derived states and what each
    waits for, a step marked where `planFindings` with the history names its module or subsystem changed or removed since
    the step was saved, and a module without a step named (UC-045); *Draft the plan* with its run panel, run in this tab and attended, whose result waits for the planner; the
    draft reviewed in order, reordered, split, merged or edited where its dependencies allow; *Save plan*, which lets the
    drafted plan go on as the planner left it, or writes a plan made by hand with `savePlan`; *+ Step*.
  - `backlog`, `board` — the items, each after the items it builds on, with their derived states, the requirements and
    use cases no item realises; in a model with sprints, for each team its last sprint that has ended, linked to its
    record, with its final burn-down; *Propose items* with its run panel, whose drafts wait for the Product Owner, and *Add to
    backlog*, which lets them go on as edited; *+ Item*, an item pointed at a replacing requirement or removed, with
    `saveItems`; in a product with several teams, what the other teams' sprints hold, from `heldItems`, and on each item
    the marks `conflicts` gives; *Plan sprint* and *Start sprint* for the person's team with `startSprint` — with the
    parameter `plan` naming a team, as `progress` links it, the route opens with that team's planning, and a planning
    opened or cancelled on the page is drawn from what the route has read, without reading it again; in the panel of each
    team with a running sprint, *Start sprint work*, a link to `implement` with the parameter `sprint` naming that sprint,
    `<team>/<nn>`, its slash encoded, since the frame splits an address at every slash before it decodes; for a model with a
    work-in-progress limit, the board and *Pull*, refused at the limit with the items in progress named. The route
    `backlog` draws the view stored for the head (MOD-progress-measures' `storedView`) and reads no record, no facts and
    no pull request: each item, sprint and job links to its own file, which is read only when the person opens it; while
    the head's view is not stored yet, it draws the view stored last, with the line `storedView` gives, and only where the
    repository stores no view does it derive the same view in the page (`backlogView`, from the facts of the scope
    `work`). *Plan sprint* and *Cancel* draw from the view read. *Start sprint* is offered on the head's own view only:
    on the click it reads the declaration, the declared model, the module files and the team's running sprint at the
    view's commit, and hands them with the view's states and holds to `startSprint`, which writes on that commit. The
    route `board` reads the declaration and the declared model's file first, as `plan` does: for a model without a
    work-in-progress limit it says so and reads nothing else; with one, it reads the product's facts with the scope
    `work`, every pull request among them.
  - `implement` — the steps of the plan or the ready items — with the parameter `sprint`, the items of that running
    sprint's selection that are not done —, each with its state and, if it cannot start, the reasons;
    the participants that hold the implementing role in the item's role assignment and can write and run tests, the attempt limit, who merges, the
    target branch, the gates the jobs will meet and who decides them; *Start jobs*, which queues each job on its
    participant's route — handed to a Bridge at once where the route is one; for each pull request its CI runs and
    whether the Definition of Done holds, and *Merge* once it does; where `repositoryInfo` gives `greenToMerge` false,
    that the server does not enforce "merge only on green", with the page `branchProtection` (UC-024 12a). In a model that
    works from a backlog, it takes every item's state, hold and what keeps it from a team from the backlog's view of the
    head (MOD-progress-measures' `storedView`, `asOf` null), and reads besides only the declaration, the declared model's
    file, the role assignments and the running sprints' records, from which `startable` judges each item; while the
    head's view is not stored yet, it says so and offers no *Start jobs*, and where the repository stores no view, it
    derives the same view in the page from the facts of the scope `work`. In a model that plans its work, it reads the
    facts of the scope `work`, as the route `plan` does. The pull requests it shows are the open ones that name a job
    (`listPullRequests` with the state `open`), and the records of those jobs, in one batch; whether the Definition of
    Done holds is the result of the check `agent-m done` among the runs of the head (MOD-workflow-entries'
    `onDoneCheck`), and no gate record or module file is read for it. A merged pull request is shown on its job's page
    (MOD-main-page, route `job`).
  - `progress` — the progress in the model's measure — the grid of requirements by phases with the steps of the plan,
    the burn-down of each team's running sprint, or the board's cumulative flow —, the gates passed, pending and not reached, what is
    blocked, who works on what; a cell, card or point leads to the trace page of what is behind it. In a model with
    sprints it shows what goes on now (UC-035): each team's running sprint with its goal, start, end, branch and closer,
    its items with their states and the modules they change and use, and its burn-down; *End sprint* with `endSprint`
    for a running sprint without a time box, and, for one that has ended, that its review and retrospective are not
    recorded yet; a team without a running sprint says so; *Plan sprint* and *Change the selection* lead to `backlog` with
    `plan=<team>`, *Start sprint work* to `implement` with that sprint, as on `backlog`, and a link leads to `backlog`, where every item and each team's last ended sprint stand; what is
    blocked among the items the running sprints hold; who works on what, each current job linked to its page on the job
    dashboard (UC-036). It draws the view stored for the head (MOD-progress-measures' `storedView`) and reads no record,
    no facts and no pull request, and it names no first wave (`reads`); while the head's view is not stored yet, it draws
    the view stored last, with the line `storedView` gives, and only where the repository stores no view does it derive
    the same view in the page (`progressView`, from the facts of the scope `work`). *End sprint* is offered on the head's
    own view only, and writes on its commit. It draws no final burn-down.

## Files

It writes, only on a person's click and as that person's commit: the product's `docs/process.md`, its role assignments
under `docs/role-assignments/`, and a model under `docs/process-models/` of the instance, with `saveFile`; the plan,
items and sprints through MOD-work-plans'
functions, or, for a drafted plan or drafted items, through the writer of their kind; a job's start record, and the end of a cancelled job, through
MOD-runtimes; and merges of pull requests. It reads the product's snapshot, the views of progress and backlog stored on its branch
`overview-cache` (through MOD-progress-measures), its pull requests and CI runs, and the instance's
participants, process models, source register and `SPEC.md`, whose requirements are the process requirements, and the
product's `docs/sources.md`.

## Uses

- MOD-site-frame.View, MOD-site-frame.chosenProduct, MOD-site-frame.explain, MOD-site-frame.notice,
  MOD-site-frame.runPanel, MOD-site-frame.confirmDecision, MOD-site-frame.schemaForm — the frame's parts, the run panel,
  and the forms of the declaration, the models, items and sprints.
- MOD-markdown-render.renderArtifact, MOD-markdown-render.renderMermaid, MOD-markdown-render.showDifference — items,
  diagrams of models, plans and progress, and differences of a drafted plan.
- MOD-browser-store.readSetting — the endpoints' configurations and the Bridges' settings a job needs;
  MOD-bridge-client.bridgeAt — a handle for each Bridge, handed to the runtimes.
- MOD-repository-hosts.readSnapshot, MOD-repository-hosts.repositoryInfo — the product, its visibility, and whether
  its server enforces green CI before a merge;
  MOD-repository-hosts.listPullRequests,
  MOD-repository-hosts.pullRequestFacts, MOD-repository-hosts.mergePullRequest,
  MOD-repository-hosts.listCiRuns — pull requests, their CI and their merge; MOD-repository-hosts.webLinks — the
  server's page for branch protection; MOD-repository-hosts.commitFiles — a removed team's role assignment deleted.
- MOD-documents.artifactSchemas, MOD-documents.readDocument, MOD-documents.writeDocument, MOD-documents.readRegister —
  the item schema of a form, documents of the common shape, the text of a declaration or model to save, the participant
  list; MOD-artifact-edits.saveFile — the declaration and a model, only on the blob they were opened on.
- MOD-model-catalogue.catalogue, MOD-model-catalogue.modelSchema, MOD-model-catalogue.modelFindings,
  MOD-model-catalogue.planGrid, MOD-model-catalogue.modelDiagram — models: the catalogue as it stands, and as it stood at
  the commit a declaration names.
- MOD-product-process.declarationSchema, MOD-product-process.declarationFindings, MOD-product-process.workflowOf,
  MOD-product-process.roleAssignmentSchema, MOD-product-process.roleAssignmentFindings, MOD-product-process.holdsRole,
  MOD-product-process.doneCheck — the declaration, its role assignments, its workflow and gates, and the Definition of
  Done of a pull request; the declaration is checked, and the workflow read, with the instance's SPEC,
  where the process requirements stand, and with the catalogue at the commit the declaration names, read with
  MOD-repository-hosts' `readSnapshot`.
- MOD-work-plans.planSchemas, MOD-work-plans.itemStates, MOD-work-plans.startable,
  MOD-work-plans.planFindings,
  MOD-work-plans.backlogFindings, MOD-work-plans.heldItems, MOD-work-plans.conflicts —
  plans, backlogs, sprints, their states, and what the teams' sprints hold; MOD-work-plans.targetBranch — the target
  branch the route `implement` shows for each step or item;
  MOD-work-plans.savePlan, MOD-work-plans.saveItems, MOD-work-plans.startSprint,
  MOD-work-plans.endSprint — every save of a plan, a backlog or a sprint.
- MOD-trace-graph.storedGraph — the
  architecture's subsystems and modules beside the plan, from the graph of the commit shown. Each graph is asked for
  with its commit, so that the graph `onMainChanged` stored for it is read where there is one (MOD-workflow-entries).
  MOD-trace-graph.latestGraph — for the plan, while the graph of the commit shown is not stored yet, the graph stored last,
  with that function's line above the page; the steps, their states and the statuses of the architecture files stay the
  commit's own.
- MOD-progress-measures.productFacts, MOD-progress-measures.progressIn — the product's facts and its progress, for the
  routes that act on the head; MOD-progress-measures.ProgressView, BacklogView, progressView, backlogView, storedView —
  what `progress` and `backlog` draw: the view stored for a commit, or, where the repository stores none, the same view
  derived in the page.
- MOD-repository-hosts.readFileAt — the declared model's file at the commit the declaration names, which `plan` and
  `board` read before anything else.
- MOD-participant-list.participantSchema, MOD-participant-list.participantsOf, MOD-participant-list.eligible — the
  participants a role or a job may have.
- MOD-source-register.sourceSchemas, restrictedPlaces — the product's links to its sources and the linked entries of the
  instance's register, which `roleAssignmentFindings` judges the holders' places against; and the places each restricted
  source permits, against which the route `implement` judges the participants it offers: a participant whose place a
  linked source forbids is offered only where the job needs none of that source's content, and the content is named
  (UC-024 5b).
- MOD-spec-document.parseSpec — where the repository stores no view, the names of the requirements the product's SPEC
  holds, which the backlog's view derived in the page lists where no item realises them; the facts of the scope `work`
  carry none, so the route reads the SPEC and parses it with `parseSpec`.
- MOD-job-catalogue.kindOf — a kind's purpose and whether its result waits for a person; MOD-job-runner.prepareJob — the
  run panels; MOD-job-runner.writeResult — a drafted plan or drafted items written on the person's click.
- MOD-job-ledger.newJobId, MOD-job-ledger.listJobs, MOD-job-ledger.jobState — the jobs a page starts and follows;
- MOD-runtimes.routesFor, MOD-runtimes.queueJob, MOD-runtimes.runOnTab, MOD-runtimes.liveState,
  MOD-runtimes.cancelJob, MOD-runtimes.retryJob — starting, following, stopping and retrying jobs on their
  routes, offered for the product's resource needs in its facts.
- MOD-work-plans.workStrategies, MOD-run-planner.runStrategies,
  MOD-test-schedule.scheduleStrategies, MOD-result-records.resultStrategies, MOD-runtimes.routeStrategies,
  MOD-approvals.approvalStrategies — the strategies of its kinds, handed to the frame.
