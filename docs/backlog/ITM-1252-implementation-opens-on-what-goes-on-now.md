---
id: ITM-1252
title: Implementation opens on what goes on now; the backlog keeps what is done
level: module
realises:
  - UC-035
  - UC-032
  - PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-implementation-pages
  - MOD-progress-measures
  - MOD-repository-hosts
  - MOD-site-frame
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "Implementation should only show on the first page what is currently going on (active sprints and jobs). History should be on a separate page such that we don't have to load for such a long time."
built_by:
  - 09ecc46b7e319a63a90b33a5ab9b15c2d89588b8
  - 2bf8e34775f6c9f936f116911ae616a363c4a451
  - 79f1cc15c2d8ef37d027da7fd9f4d2efd44a10a2
  - bb51d7cf3ca6ef7c5da262e1eedab1e6cca88ee5
---
# ITM-1252 Implementation opens on what goes on now; the backlog keeps what is done

**REGISTER**

## Outcome

The entry Implementation opens the route `backlog`, which took about 40 s to draw for Agent M itself (1,026 items,
about 1,370 pull requests), and *Plan sprint* about 30 s more. Path: the menu entry (`src/site/menu.mjs:12`, views
`progress`, `backlog`, `roles`; `progress` is not built, so `backlog` is shown) → `draw` (`src/implementation-pages/backlog.mjs:349`)
→ `contextOf` (`:54`) → MOD-progress-measures' `productFacts` with the scope `work` (`src/progress-measures/facts.mjs:315`) →
`host.listPullRequests()` with no filter (`facts.mjs:326`) → GitHub's `listPullRequests` (`src/repository-hosts/github.mjs:489`),
`pulls?state=all` → `everyPage` (`github.mjs:172-180`), which asks page 1, waits, asks page 2, … — 14 requests one after
the other. Then `containsCommit` for each head `undecidedHeads` names, one after the other (`facts.mjs:368-372`). *Plan
sprint* and *Cancel* call `again()` (`backlog.mjs:382-386`), which runs `contextOf` and `derivedOf` anew, the whole
listing included.

Of what the page reads, only the history needs every pull request: the state of every item of the backlog (an item is
done by a merged pull request naming it, or by `built_by`), the last sprint's final burn-down, and the holds of sprints
closed long ago. Each team's running sprint, its items' states and its burn-down need only the pull requests open now and
those updated since that sprint started.

After the change, as UC-035 and UC-032 and the architecture say:

- MOD-repository-hosts: `listPullRequests` takes `updatedSince`, and asks the pages of a listing at once once the server
  has said how many there are (GitHub's `Link` `rel="last"`, GitLab's `X-Total-Pages`). GitHub's list of pull requests has
  no such filter: the GitHub adapter learns how many are updated since the date from the search API's `total_count`
  (`is:pr is:closed updated:>=<date>`) and then asks those pages of `pulls?state=closed&sort=updated&direction=desc` at
  once, keeping those updated on or after the date — or another way that asks no page after another; the adapter decides.
- MOD-progress-measures: `productFacts` takes the scope `now`; `containsCommit` is asked for all heads at once.
- MOD-implementation-pages: the route `progress` is built for a model with sprints, from `teamPanel`, `wipLine`, the
  burn-down chart and *End sprint* of `backlog.mjs`, which move to `progress.mjs`, with `gateOverview`, `blocked` (only
  the items the running sprints hold) and `whoWorksOnWhat`, each current job linked to its page on the job dashboard; for
  a model without sprints it links `plan`, `board` or `backlog` and names its measure as not drawn yet. The route
  `backlog` keeps the backlog, what no item realises, each team's last ended sprint with its final burn-down, and the
  planning; with `plan=<team>` it opens with that team's planning, and opening or cancelling a planning draws from what
  was read. `progress` stands first among the view's routes.
- MOD-site-frame: the entry Implementation leads to `progress` — on the frame's pages by the order of the view's routes,
  on the live page (`dashboard-app.mjs`) by counting a route that a loaded view provides as built, without changing
  `src/site/views.mjs` or `src/site/menu.mjs`, which can only be moved in or removed (`CODE OUTSIDE THE ARCHITECTURE IS
  MOVED INTO IT`); the route `progress` names its first wave through `reads`.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/repository-hosts-pull-request-pages.test.mjs` (MOD-repository-hosts, unit), over a counting fake of GitHub's
  and GitLab's API that records how many requests are in flight: with 1,370 pull requests, `listPullRequests()` asks page
  1 and then pages 2 to 14 together — at least 13 in flight at once —, and returns all 1,370; with `updatedSince`
  2026-10-20, of which 4 are updated on or after it, it returns those 4 and sends no `state=all`. Counter-proof: the
  `everyPage` of today, one page after another, fails the first case.
- `tests/progress-measures-scope-now.test.mjs` (MOD-progress-measures, unit): a Scrum fixture with team1's sprint 03
  running (`start: 2026-10-20`, no `## Review`) and team2's sprint 02 closed: with the scope `now`, `sprints` holds
  team1/03 alone; the host is asked `listPullRequests({ state: "open" })` and `listPullRequests({ state: "closed",
  updatedSince: "2026-10-20" })` and nothing else of the pull requests; without a running sprint, only the open ones;
  two heads of `undecidedHeads` are asked with `containsCommit` together. Counter-proof: the scope `work` asks for all.
- `tests/implementation-pages-progress.test.mjs` (MOD-implementation-pages, component): `#progress` of that fixture shows
  team1/03 with its items, their states, its burn-down and *End sprint*; team2 "no running sprint", a link to
  `#backlog/plan=team2` and a link to `#backlog`, and no chart; who works on what with the running job linked; no item
  outside the running sprint. Counter-proof: an item no sprint selects does not appear.
- `tests/implementation-pages-backlog-history.test.mjs` (MOD-implementation-pages, component): `#backlog` shows every item
  with its state and team2's sprint 02 with its final burn-down; `#backlog/plan=team1` opens with team1's planning; a
  click on *Plan sprint* and on *Cancel* sends no request. Counter-proof: today's `again()` sends the listing anew.
- `tests/load-per-view.test.mjs` (MOD-site-frame, component): `#implementation` draws the route `progress`, and its
  requests hold no `pulls?state=all` and no `pulls?state=closed` without the bound, whatever the number of closed pull
  requests in the fake.
- `tests/dashboard-backlog-teams.test.mjs` and `tests/implementation-pages-backlog-end-sprint.test.mjs` are rewritten on
  the route `progress` where they test the running sprint and *End sprint*; their expected results do not change.

Measurable outcome: the first page of Implementation lists no pull request closed before the oldest running sprint
started; its requests about pull requests are a constant number, independent of the 1,370 the repository holds; and the
history page asks its 14 pages at once. On the live page, `#implementation` for the instance sends no `pulls?state=all`
(at review, in the browser's network panel).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of the four modules, the files they name as taken over, and the tests that name them change.
