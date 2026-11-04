---
id: ITM-1260
title: Progress and the backlog draw a view stored for their commit; plan and board look at the model first
level: module
realises:
  - UC-035
  - UC-032
  - UC-045
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-progress-measures
  - MOD-implementation-pages
  - MOD-repository-hosts
  - MOD-workflow-entries
  - MOD-site-frame
  - MOD-main-page
builds_on:
  - ITM-1258
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "We spent a lot of time on how to optimize the other pages. Inspect how it is done before suggesting solutions. A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." On the proposal of a stored view per page: "Do it please."
---
# ITM-1260 Progress and the backlog draw a view stored for their commit; plan and board look at the model first

**REGISTER**

## Outcome

What the pages of Implementation read today, for Agent M itself at 73d6524d (1,033 items, 199 sprint records, 1,476
gate records, 478 job records, 56 module files, two teams):

- `#progress`: the route's first wave (`reads`, `src/implementation-pages/progress.mjs:313`) names every item, sprint,
  role assignment, gate record, module file and job record — 3,246 files, 33 batches, 17.2 MB —, which the frame reads
  before `render` (`src/site-frame/index.mjs:175`, `src/site-frame/dashboard-app.mjs:797`); then `contextOf`
  (`progress.mjs:135`) → `productFacts` with the scope `now` (`src/progress-measures/facts.mjs:328`) →
  `storedFactsWithJobs` (`facts.mjs:337`, `stored.mjs:62`) reads `<commit>.facts.json` from `overview-cache`, about 20 MB,
  in every scope; then two pull-request listings (`facts.mjs:264-270`). The page shows the running sprints, their items,
  the gates, what is blocked and who works on what: a few kilobytes.
- `#backlog`: the live page's own wave (`dashboard-app.mjs:348-352`) reads the declaration, the SPEC, every item, sprint
  and role assignment and, with two teams, every module file — 1,292 files, 13 batches, 6.0 MB —; then `contextOf`
  (`backlog.mjs:54`) → `productFacts` with the scope `work` reads the 20 MB facts file and lists every pull request; the
  page shows one row per item.
- `#plan` (`plan.mjs:101`) and `#board` (`backlog.mjs:404-405`) read the whole facts of the scope `work` — the facts file and
  every pull request — before they find that Agent M's model works from a backlog without a work-in-progress limit,
  and say that there is no plan and no board.
- `#implement` reads the facts twice: its own `productFacts` (`implement.mjs:334`) and the backlog's `contextOf`
  (`implement.mjs:341`), each reading the facts file, since `readOn` keeps nothing (`src/repository-hosts/index.mjs:264`).

After the change, as UC-035, UC-032, UC-045 and the architecture say:

- MOD-progress-measures: `progressView` and `backlogView` derive what the two routes show from the facts;
  `publishOverview` adds `<commit>.progress.json.gz` and `<commit>.backlog.json.gz` beside the overview, in
  the same commit, with `latest.json`; `storedView` reads the head's view, or, while it is not stored, the view
  `latest.json` names with its commit. The scope `now` is withdrawn, and with it the pull requests listed since a date.
  The page's `mergedAtOf` (`progress.mjs:45`) moves into the views, as the merges of a sprint's items.
- MOD-workflow-entries: `onMainChanged` stores the views with the overview and names them in its summary.
- MOD-implementation-pages: `progress` and `backlog` draw the stored view and read no record, facts or pull request;
  `progress` names no first wave; the as-of line while the head's view is being stored; where the repository stores no
  view — a product whose files do not run `onMainChanged` yet (ITM-1261) — the same view is derived in the page from the scope `work`. *Plan
  sprint* and *Cancel* draw from the view read; *Start sprint* and *End sprint* are offered on the head's own view and
  write on its commit. `plan` and `board` read the declaration and the declared model's file (`readFileAt`) first and
  nothing else where they do not apply. `implement` reads the facts of the scope `work` once, from the files.
- MOD-repository-hosts: `listPullRequests` loses `updatedSince` and the GitHub adapter's search for it
  (`src/repository-hosts/github.mjs:509-532`); the pages of a listing are still asked for at once, since `implement`, the
  board of a model with a limit, the job page and `onMainChanged` list every pull request.
- MOD-site-frame: the live page's wave for `backlog` (`dashboard-app.mjs:348-352`) is removed; the frame keeps no list of
  files for any route.

No commit's facts file is stored (ITM-1263): the facts behind a view are read from the files, by CI where it stores the
view, and in the page only where no view is stored.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/progress-measures-views.test.mjs` (MOD-progress-measures, unit): a Scrum fixture whose facts hold team1's sprint
  03 running (`start: 2026-10-20`, two items, one merged by a pull request at 2026-10-21T10:00Z, one with an open pull
  request) and team2's sprint 02 closed. `progressView` gives team1 with sprint 03, its two items with their states and
  modules, `merges` `[{ item, at: "2026-10-21T10:00:00.000Z" }]`, team2 with no sprint, the gates, `blocked` of sprint
  03's items alone and who works on what. `backlogView` gives every item as a row in `itemStates`' order with its state,
  hold and what keeps it from each team, team2's sprint 02 as its last ended with its merges, and the requirements and
  use cases no item realises. Counter-proofs: an item no running sprint selects is not in `progressView`; a marker
  planted in a job record's body appears in neither view's text.
- `tests/progress-measures-publish-views.test.mjs` (MOD-progress-measures, unit), over a fake host: `publishOverview`
  adds the four files of the commit and `latest.json` in one commit; on a branch that holds all four, `written` is false
  and nothing is committed. `storedView` reads the head's view in one request (`asOf` null); with the head's missing and
  `latest.json` naming c0, c0's view in three requests (`asOf` c0); with neither, null. Counter-proof: a view of another
  format is null.
- `tests/implementation-pages-progress-stored-view.test.mjs` (MOD-implementation-pages, component), over a counting fake
  of GitHub: with the head's view stored, `#progress` shows what `tests/implementation-pages-progress.test.mjs` expects,
  and its requests hold one read of `overview-cache`, no `pulls`, no `.facts.json` and no batch of files; with only
  c0's view stored, the line `As of c0…` and three reads of `overview-cache`, and no *End sprint*; with no branch
  `overview-cache`, the page derived from the scope `work` shows the same rows. Counter-proof: today's route reads the
  facts file.
- `tests/implementation-pages-backlog-stored-view.test.mjs` (MOD-implementation-pages, component): `#backlog` the same
  way; *Plan sprint* and *Cancel* send no request; on the head's view, *Start sprint* reads the declaration, the model,
  the module files and the running sprint, and commits with the view's commit as the expected head; on c0's view it is
  not offered.
- `tests/implementation-pages-model-first.test.mjs` (MOD-implementation-pages, component): for a Scrum fixture without
  a limit, `#plan` links the backlog and `#board` says there is no board; beyond the commit and the tree, each reads the
  declaration and the model's file and nothing else — no `pulls`, no `overview-cache`, no `trace-cache`. Counter-proof: a
  fixture whose model has a limit draws the board.
- `tests/load-per-view.test.mjs` (MOD-site-frame, component): `#backlog` sends its commit and tree once and no batch of
  files and no `.facts.json`. Its case "#implementation draws progress, and its requests about pull requests are bounded …"
  (`:301-336`) now states that, with the head's progress view stored, `#implementation` draws progress (team1's running
  sprint) and sends no request about pull requests, no `/pulls` and no `/search/issues` (MOD-implementation-pages.md:211-212).
  Its counter-proof is today's route, which reads them. No other case of the file changes.
- `tests/repository-hosts-pull-request-pages.test.mjs` keeps its case of the pages asked at once and drops `updatedSince`;
  `tests/progress-measures-scope-now.test.mjs` is removed with the scope it tests.

Measurable outcome, at review on the live page for the instance, in the browser's network panel (numbers expected from
73d6524d; the rows of the backlog's view measured as id, path, title, what it realises and a state for each item):

| Route | Today | After |
|---|---|---|
| `#progress` | 33 batches (17.2 MB), the facts file (~20 MB), 2 listings of pull requests | 1 file of `overview-cache`, under 16 KB (3 while the head's view is being stored); no `pulls`, no `.facts.json`, no batch |
| `#backlog` | 13 batches (6.0 MB), the facts file (~20 MB), every pull request (14 pages) | 1 file of `overview-cache`, ~72 KB gzipped (~420 KB of JSON, ~70 bytes gzipped more for each further item); no `pulls`, no `.facts.json`, no batch |
| `#plan`, `#board` (Scrum, no limit) | the facts file (~20 MB), every pull request | the declaration and the model's file; nothing else |
| `#implement` | the facts file twice (~40 MB) | no facts file (ITM-1263) |

Every route still reads its commit and the commit's tree once; that tree, of 6,861 files, is not changed here.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of MOD-progress-measures, MOD-implementation-pages, MOD-repository-hosts, MOD-workflow-entries and
  MOD-site-frame, the files they name as taken over, and the tests that name them change. Of MOD-main-page, only the
  shared setup `cachedContext` of `tests/main-page-root-entry.test.mjs` changes: it expects the files `publishOverview`
  adds (MOD-progress-measures.md:304-309). No code of MOD-main-page changes.
