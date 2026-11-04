---
id: ITM-1264
title: Implement judges its items from the head's backlog view
level: module
realises:
  - UC-024
  - UC-034
  - UC-036
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1260
  - ITM-1263
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way." And: "I think I want the 20 mb facts file gone."
---
# ITM-1264 Implement judges its items from the head's backlog view

**REGISTER**

## Outcome

With `<commit>.facts.json` gone (ITM-1263), the three readers that ITM-1260 left on it read the files of the scope `work` instead:
`productFacts` (`src/progress-measures/facts.mjs:328`) tells the snapshot every item, sprint, role assignment, gate
record, module file and job record — at Agent M's head 3,246 files, 33 batches, 17.2 MB (ITM-1260's count) — and lists
every pull request (14 pages).

- `#implement` (`src/implementation-pages/implement.mjs:334`, `:341`): shows the items that are not done, each with its
  state and, if it cannot start, the reasons; and the pull requests of the jobs. `drawPulls` (`implement.mjs:217-262`)
  takes every pull request that names a job of kind `implement` or `refactor` — open, merged and closed — and asks for
  each `pullRequestFacts` and the runs of its first commit and its head: three requests each, for each of the 109
  implement records' pull requests. For an open one it reads the module files of its items and hands `doneCheck` every
  gate record (`facts.gates`, 1,476 files), of which `doneCheck` keeps those whose `on` names the pull request.

What they use is what ITM-1260's `BacklogView` of the head holds — each item's state, its hold and what keeps it from a
team, the teams' running sprints with their selection —, plus the declaration, the model's file, the role assignments
and the instance's participants, which `startable`, `holdsRole` and `mayDecide` take (`src/work-plans/states.mjs:289`).
The Definition of Done of a pull request is already checked once, in CI, by the job `agent-m done`
(`src/workflow-entries/product.mjs:908`, `onDoneCheck`), whose result is among the runs of the head that the page
lists.

After the change, as MOD-implementation-pages says:

- `implement`, in a model that works from a backlog, reads the head's backlog view (`storedView`, `asOf` null), the
  declaration, the model's file, the role assignments and the running sprints' records, in one batch; while the head's
  view is not stored yet it says so and offers no *Start jobs*; where the repository stores no view it derives the
  view from the scope `work`. In a model that plans its work it reads the scope `work`, as `plan` does.
- `drawPulls` lists the open pull requests (`listPullRequests({ state: "open" })`), reads the records of the jobs they
  name in one batch, and shows for each the runs of its first commit and its head; the Definition of Done is the
  result of the run `agent-m done` on the head, linked; no gate record or module file is read. A merged one is shown
  on its job's page (route `job`, `jobTrail`), as UC-024 step 13 asks of the dashboard.

Design principles (AGENTS.md §2 *Designing*): §2.2 *nothing twice* — the Definition of Done is decided once, by
`onDoneCheck` in CI, and the page shows that decision instead of computing it again from every gate record; the items'
states are derived once, by `backlogView` in CI, and read by the three routes. §2.5 *no special first case* — the
actions are offered on the head's own view, as ITM-1260 offers *Start sprint* and *End sprint*. §2.1 — no reader of a
second responsibility (gate records for the Definition of Done) remains in the route.

## Route survey

What each route of the two entry pages reads when it is opened, against what it shows, read from the code at 87798bf4d
with the facts file assumed gone (ITM-1263). Every route of `docs/index.html` also reads the product's commit and its
whole tree (ITM-1266) and every module of every view (ITM-1267). Excess is flagged only where a route reads clearly more
than it shows; the column *Item* names the item that changes it, `—` where none is drafted.

| Route | Reads on load | Shows | Excess | Item |
|---|---|---|---|---|
| start page, cards (`src/main-page/home.mjs:56-78`) | per repository a snapshot, `<commit>.json` or `latest.json`, the live state of each unended job of the build; without any overview the scope `all` | stage bar, build, waits | the instance's snapshot also where every card has its overview (`home.mjs:128`); only a commit is needed for an overview | — |
| start page, rereading (`src/main-page/reread.mjs`) | every 60 s per card a snapshot, the changed records, live states | job states | no | — |
| `jobs` (`src/main-page/jobs.mjs:168-177`) | every record under `docs/jobs/` of every repository, one request each, and a listing of the job workflow's runs for each unended CI job | every job | the records are shown; the reads are not batched and the run listing is repeated per job | — |
| `job` (`jobs.mjs:255-262`) | all of `jobs`' reading, then trail, log | one job | yes: every record of every repository for one | ITM-1269 |
| `job`, *Retry*, *Pass gate* (`jobs.mjs:338`, `:440`) | the scope `work`: 3,246 files, every pull request | holders, routes, the gate | yes | ITM-1305 |
| `#uc`, `#use-case`, `#arc`, `#decision`, `#module` (`dashboard-app.mjs:324-333`) | every file of the kind in one wave; statuses from record names (`src/approvals/status.mjs:63-82`) | id, title, status | mild: the body of each file for its title | — |
| one changed use case or module (`src/review-pages/flow.mjs:544-561`) | the file; `lastAcceptedText` with an older commit's whole tree; for an open file every job record (`jobNotes`) | the difference, the notes | yes | ITM-1268, ITM-1271 |
| `#review/arc` (`flow.mjs:104-113`, `:343-421`) | the open files, their last accepted texts, every job record (`draftingRounds`) | every open file, the drafting rounds | the job records | ITM-1268, ITM-1271 |
| `#spec` with the specification (`src/trace-pages/flow.mjs`) | SPEC, sources, waiting queues' files, the stored graph, the rationale of each waiting entry, 30 commits of `docs/sources.md` | waiting entries, the requirements tree, marks | the rationales are read and not shown | — |
| `#spec/<queue>/<nn>` (`src/review-pages/spec-entries.mjs:125-133`) | every queue with its targets and approved records, the whole stored graph, the register for the subject | one entry, its queue's order, others on its anchor | yes: every queue for one entry | — |
| requirement edit, arrange (`edit.mjs:40-60`, `arrange.mjs:40-42`) | the whole stored graph, every queue | one section, a group tree | yes | — |
| `trace` tests, gaps, modules, audit | what they show | tables of all | no | — |
| `trace` test detail (`src/trace-pages/test-detail.mjs:165-181`) | the run records of every commit on `test-results`, the test files of each release until found | one test's history | yes | — |
| `progress`, `backlog`, `plan`, `board` | ITM-1260 | | | ITM-1260 |
| `implement` (`src/implementation-pages/implement.mjs:334`, `:341`, `:217-262`) | the scope `work` twice, every pull request, three requests per job pull request ever opened, every gate record | open items, job pull requests | yes | ITM-1264 |
| `process`, `roles` | the declaration, the catalogue, participants, sources, role assignments | the model, the teams | no | — |
| `models` (`process.mjs:409-418`) | a snapshot of every kept product for its `docs/process.md` | which products use which model | a tree per product for one file | — |
| `runs` (`src/test-pages/runs.mjs:341-395`) | the whole tree of `test-results`, every test file one by one, the records of two commits | one commit's results | the tree of every run for two commits' records | — |
| `schedule` (`src/test-pages/schedule.mjs:83-102`) | 1,542 test files (19.3 MB), every run of the generated workflow | six counts, the last run per occasion | yes | ITM-1265 |
| `generate` (`src/test-pages/generate.mjs:81-102`) | every test file, one by one | names with their levels | the files are read to take id and level | — |
| `release` | tags, job records newest first until a match | the form or the candidate | no | — |
| `settings`, `setup`, `endpoints`, `bridge`, `mail`, `mailbox`, `resources`, `sources` | their own files | the forms | no | — |
| `participants` (`src/settings-pages/participants.mjs:86-98`) | `docs/participants.md` and every register entry, one by one | the participants and places | unsure which source fields are shown | — |
| `library` (`src/settings-pages/library.mjs:105-120`) | every register entry; every run of the fetch workflow and the log of each failed one | the register, failed fetches | yes: every failed run's log on every load | — |
| `issues` (`src/maintenance-pages/issues.mjs:62-82`) | every open issue and the comments of each | number, title, class | yes | ITM-1270 |
| `issue`, `replies/<issue>` (`issues.mjs:323-335`, `replies.mjs:220`) | every issue ever, with every comment | one issue | yes | ITM-1270 |
| prompt bar at start (`src/prompt-bar/bar.mjs:497-505`) | the instance's snapshot (the page's own where it is the instance), `docs/participants.md` | the bar | no | — |
| notifications (`src/notifications/checks.mjs`) | every 5 minutes, per repository a snapshot, every queue's files, tags | notifications | every queue in full each time | — |

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/implementation-pages-implement-stored-view.test.mjs` (MOD-implementation-pages, component), over a counting
  fake of GitHub with a Scrum fixture whose head's backlog view is stored: `#implement` shows the rows that
  `tests/implementation-pages-implement.test.mjs` expects, and its requests hold one read of `overview-cache`, one
  batch of at most 100 files (declaration, model, role assignments, running sprints), one listing of open pull
  requests, no `.facts.json`, no file under `docs/gates/` and no listing with `state=all`. A pull request of a job whose
  head's run `agent-m done` failed offers no *Merge* and links that run; with the run green, *Merge* is offered.
  Counter-proofs: with only c0's view stored, the as-of line and no *Start jobs*; with no branch `overview-cache`, the
  rows derived from the scope `work` are the same.

Measurable outcome, on the live page of the instance in the browser's network panel (numbers expected from Agent M's
head, 1,233 items, 1,476 gate records, 478 job records, 109 of kind implement):

| Route | Today, without the facts file | After |
|---|---|---|
| `#implement` | 33 batches (17.2 MB), every pull request (14 pages), 3 requests for each job pull request ever opened | 1 file of `overview-cache` (~72 KB gzipped), 1 batch (~6 files), 1 page of open pull requests, 1 batch of their job records, 3 requests for each open job pull request |

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.
- `implement` builds the declared workflow with MOD-product-process' `workflowOf`, which MOD-implementation-pages' Uses
  name, from the declared model's file it reads, as `process` does (`src/implementation-pages/process.mjs:237-242`), and
  not with `productWorkflow`, which its Uses do not name. Where that needs a function its Uses do not name, the item
  stops and names it.
- *Retry* and *Pass gate* on the job page are ITM-1305's: reading them from the head's view needs functions
  MOD-main-page's Uses do not name.
- Tests of other modules this Outcome changes: none.
  - The tests that draw `#implement` name MOD-implementation-pages.
  - `dashboard-notifications` and `dashboard-notifications-wiring` (MOD-notifications) and `site-frame-preloads`
    (MOD-site-frame) load the two modules for other routes, and do not change.
  - `load-per-view`'s `#implementation` case is progress's, not `#implement`'s.
