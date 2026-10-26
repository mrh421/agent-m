---
id: MOD-main-page
title: The main page and every job of the instance
folder: src/main-page/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.instanceOf
  - MOD-site-frame.menuOf
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.productHostFollowingStore
  - MOD-site-frame.tokenKeyOf
  - MOD-notifications.watchForAcceptance
  - MOD-browser-store.readSetting
  - MOD-bridge-client.bridgeAt
  - MOD-bridge-client.settingsOf
  - MOD-repository-hosts.parseAddress
  - MOD-repository-hosts.connect
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.webLinks
  - MOD-progress-measures.productFacts
  - MOD-progress-measures.stageShares
  - MOD-progress-measures.currentStage
  - MOD-progress-measures.buildInProgress
  - MOD-progress-measures.waitingForAPerson
  - MOD-progress-measures.storedOverview
  - MOD-progress-measures.latestOverview
  - MOD-product-process.mayDecide
  - MOD-product-process.recordGateDecision
  - MOD-job-ledger.listJobs
  - MOD-job-ledger.jobState
  - MOD-job-ledger.jobCost
  - MOD-runtimes.routesFor
  - MOD-runtimes.liveState
  - MOD-runtimes.jobLog
  - MOD-runtimes.cancelJob
  - MOD-runtimes.retryJob
  - MOD-runtimes.jobTrail
  - MOD-runtimes.revertAfterCancel
  - MOD-work-plans.startable
  - MOD-prompt-bar.currentJob
  - MOD-prompt-bar.Subject
  - MOD-source-register.sourceStrategies
provides:
  - view
---
# MOD-main-page The main page and every job of the instance

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the page at the root of the instance's Pages address: what
goes on in the instance — each product's progress as a bar of six stages, or Agent M's own while the browser manages no
product, the build as it happens, what waits for a person — and every job of every product, with its detail and the
decisions a person takes on a job. It serves UC-046 and UC-036.

It shows only what the services derive; it computes no share and no state of its own (`PROGRESS AND JOB STATE ARE
DERIVED, NOT STORED`). Its own routes run no job in the tab; the prompt bar on this page does, so it hands the frame the
strategies a conversation's kinds need beyond the runner's own — `sourceStrategies`, for the book's chapters of the page.
Retrying a job that ran in a tab opens the view that runs its kind, with the job's inputs.

It runs in a browser, loaded by `index.html` through MOD-site-frame.

## Parts

- `index.mjs` — the interface: `view`.
- `greeting.mjs` — the greeting: Agent M's name, one sentence on what Agent M is, what to do first, and the folded
  explanation of the page.
- `home.mjs` — the route `home`: it draws the cards and the link *Jobs*, and starts the readings again.
- `cards.mjs` — a card per product or Agent M's own card, its stage bar, whose stages are links, and its build.
- `waits.mjs` — what waits for a person, drawn on the route `jobs`.
- `reread.mjs` — the readings again: the jobs' states of the cards drawn, and nothing else.
- `jobs.mjs` — the list of every job and a job's detail. It also gives the parts of reading jobs that the cards share
  with it: `bridgesOf`, a handle for each Bridge the records of jobs not ended name, and `liveStatesOf`, the live state
  of each job whose record has not ended; and `sourcesOf`, the sources of the list — the instance's repository, then
  each product this browser keeps.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `index.html`: named here as the main page, whose place the Pages site fixes; it loads `start.mjs` with this module's view; its greeting is drawn by `greeting.mjs`, and its footer by MOD-site-frame's `footer.mjs`.
  - `tests/test_main_page.py`: its header names this module, with MOD-progress-measures and MOD-site-frame for the menu.

## Data

It keeps nothing but the screen. It builds a handle for each Bridge this browser keeps from its settings, so that the
live states, logs and cancels of jobs on Bridges reach them. While the page is open it reads the jobs' states again at
an interval the repository servers' rate limits allow, so the build stays current — the records of the jobs the cards
were drawn with, and nothing else —, except while its tab is hidden
(`document.visibilityState` is `hidden`): then it starts no reading, and when `visibilitychange` shows the tab again it
reads at once each card whose reading fell due meanwhile. A card whose repository this browser keeps no token for is read
once, when the page is drawn, and never again (UC-046 4b). It stores nothing between readings.

## Interfaces

- `view: View` — the routes of the main page, `{ routes, strategies: [sourceStrategies] }`, each route with the frame's
  default subject for the prompt bar:
  - `home` — the greeting: Agent M's name, one sentence on what Agent M is — requirements-driven software engineering with
    people and agents —, and what to do first: review the requirements and the use cases, then add a product. *Review the
    use cases* leads to the address `menuOf` gives for the entry *Use cases*. The greeting has its folded explanation
    and *Get your own Agent M*, which leads to MOD-settings-pages' `get-your-own` (UC-014 step 1). Its logo of the
    Pattern Recognition Lab is the header's, which every page carries. Below it, one card per product this browser keeps,
    each with its name, its process model, its bar of six stages each filled by its share, the stage it is in marked, and
    its build — the steps or items in progress, each with the job working on it, its participant, state and elapsed time.
    Each stage is a link to the address `menuOf` gives, called with the card's product address, for the entry of the same
    place in the process: the six stages and the first six entries stand in the order of the process, so the nth stage
    leads to the nth entry. Without a product, Agent M's own card from the instance repository takes their place, with
    *+ Add product*; its stages call `menuOf` without a product. A card whose repository cannot be read says which and
    links the token's setting;
    below the cards, the link *Jobs* to the route `jobs`.
    A card first reads the overview stored for its default branch's head (MOD-progress-measures' `storedOverview`, one
    request). Where there is one, the card is drawn from it alone: its stage bar, its model, what waits for a person,
    and its build — the states of the steps or items in progress and the records of the jobs working on them, from which
    `listJobs` derives the rows with the live states of those jobs whose record has no end, asked at once. It lists no
    pull request and reads no other file: what derives from the repository was computed when the commit was pushed.
    While the head's overview is not stored yet, the card reads the overview stored last (MOD-progress-measures'
    `latestOverview`, two requests more) and is drawn from it alone in the same way, saying "As of <its commit's first
    seven characters>: the overview of the newest commit is being stored."; the page never derives what the workflow
    computes. Only where the branch holds neither, the card reads the scope `all` as before. Without a token and
    without facts stored for the head (`storedFacts`), that reading costs one request per test file of the default
    branch (MOD-progress-measures' `stageShares`); that cost is accepted. The stored overview is a record of the
    repository, derived from that commit alone by `onMainChanged` (MOD-workflow-entries), never kept in the
    browser. The rows of the build are the same whether the stage bar comes from a stored overview or from the scope `all`.
  - `jobs` — first, what waits for a person across the instance, each item linked to the page where it is decided
    (MOD-progress-measures' `waitingForAPerson`, from the instance's own stored overview where there is one); then every
    job of
    every product and of the instance in one list — the job of this tab's conversation in the
    prompt bar among them, which has no record and is shown as this tab's (`currentJob`) —, waiting at a gate first, filtered by product,
    state, participant or runtime; each row with identifier, product, what it works on, kind, participant, where it
    runs, state, elapsed time and cost where known; a source that cannot be reached is named with its reason.
  - `job` (`params.id`) — one job: its inputs, its commits and pull request and its CI runs (MOD-runtimes' `jobTrail`), its log while it runs, its
    cost — or *unknown* (`NO COST IS GUESSED`); *Cancel* for a queued, running or waiting job, whose end, cancelled,
    MOD-runtimes' `cancelJob` appends once its runtime confirms, and beside a commit written after the cancel, *Revert*
    (`revertAfterCancel`); *Retry* for a failed, cancelled or ended job whose step or item is still startable
    (MOD-work-plans' `startable` — otherwise the reasons are shown and nothing is queued, UC-036 7a), as a new job, with the same participant or another holder of its role on a route offered for it; for a job waiting
    at a gate, the gate — what it checks, what to examine, who decides — and, for a person who may decide it, *Pass gate*
    and *Reject* with a reason. *Pass gate* stays unavailable, with the role and its holders named, for a person who does
    not hold the deciding role or did the work the gate checks (`A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT
    CHECKS`). The decision is recorded with `recordGateDecision` under the person's account; the job's route resumes or
    ends the job when it notices the record (ARC-037).

## Files

It writes, on a person's click: a gate record, through `recordGateDecision`; through `cancelJob`, the end of a cancelled
job in its record under `docs/jobs/`. It reads each product's repository and the
instance repository through their hosts, and the browser's store for the products, tokens and Bridges it keeps.

## Uses

- MOD-site-frame.View — the interface it provides; MOD-site-frame.chosenProduct, MOD-site-frame.instanceOf — the
  product chosen and the instance; MOD-site-frame.menuOf — the page of a stage, for a card's product, and the use cases'
  page, for the greeting; MOD-site-frame.explain — the folded explanations of the page, its states and runtimes;
  MOD-site-frame.notice — a refused token, a used-up rate limit, a source not reached; MOD-site-frame.confirmDecision —
  cancel, retry and a gate's decision; MOD-site-frame.productHostFollowingStore — each kept product's host for the
  notification checks, through the product's token and the stored secrets at each call; MOD-site-frame.tokenKeyOf — the key of a product's token setting, whose
  name is the person who decides a gate on the job's page.
- MOD-notifications.watchForAcceptance — the checks of what waits for acceptance, which the page starts with the instance's
  host, the product hosts and its writing of a review-pages address.
- MOD-browser-store.readSetting — the products this browser keeps, their tokens, the Bridges' settings.
- MOD-bridge-client.bridgeAt, MOD-bridge-client.settingsOf — a handle for each Bridge this browser keeps, including one
  reached through the jump host, whose address `settingsOf` gives.
- MOD-repository-hosts.parseAddress, MOD-repository-hosts.connect — each product's host;
  MOD-repository-hosts.readSnapshot — the job records of every product, for the list of jobs;
  MOD-repository-hosts.webLinks — a token's
  setting and a run's page.
- MOD-progress-measures.productFacts, MOD-progress-measures.stageShares, MOD-progress-measures.currentStage,
  MOD-progress-measures.buildInProgress, MOD-progress-measures.waitingForAPerson — the cards, the workflow and gate
  states of a product, and what waits; MOD-progress-measures.storedOverview — the overview stored for a commit;
  MOD-progress-measures.latestOverview — the overview stored last, while the head's is not stored yet.
- MOD-product-process.mayDecide — whether this person may decide the gate a job waits at;
  MOD-product-process.recordGateDecision — the decision.
- MOD-job-ledger.listJobs, MOD-job-ledger.jobState, MOD-job-ledger.jobCost — the jobs, their states and costs;
  MOD-prompt-bar.currentJob — the job of this tab's conversation; MOD-prompt-bar.Subject — the subject the route `job` gives the prompt bar for the retry of a job that ran in a tab: the job's kind as its page and its inputs as its parameters, so that the conversation hands the retry on to that kind (UC-049 4a);
- MOD-runtimes.routesFor — the routes a retry may take, for the product's resource needs in its facts;
  MOD-runtimes.liveState, MOD-runtimes.jobLog,
  MOD-runtimes.cancelJob, MOD-runtimes.retryJob — live states, logs, cancel and retry at each job's route, the Bridges
  handed in; MOD-runtimes.jobTrail, MOD-runtimes.revertAfterCancel — a job's commits, pull request and CI runs, and the
  revert of what it wrote after its cancel; MOD-work-plans.startable — whether a retried job's step or item may start.
