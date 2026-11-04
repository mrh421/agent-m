---
id: ITM-1138
title: The pages of roles, process, releases and settings read the repository they show once per load
level: system
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-site-frame
  - MOD-implementation-pages
  - MOD-test-pages
  - MOD-settings-pages
builds_on:
  - ITM-681
tests:
  - component
origin:
  - docs/measurements/2026-10-19_main-pages-load-work.md §3.7, §3.10, §3.12, read at sprint team2/97
---
# ITM-1138 The pages of roles, process, releases and settings read the repository they show once per load

**REGISTER**

## Outcome

SPEC.md:685: "one load of a dashboard page reads its commit and that commit's tree once". With a token, `#roles`,
`#process`, `#release` and `#settings` read the same commit and tree three or four times. Their Check
(`tests/load-per-view.test.mjs`) covers the start page, `#arc`, `#spec` and `#backlog`; its `#settings` case (`:451-456`)
checks only that the tree is read.

**Where the Hosts are made, and why the tree is read again** (read on `78f10185`):
- The app reads the shown repository once (`src/site-frame/dashboard-app.mjs:292`, `loadSnapshot`).
- For the review pages, `pagesHost()` (`dashboard-app.mjs:598-631`) wraps the host, so a `readSnapshot` during the load
  gets that snapshot back. `reviewContext()` (`:636`) gives `product: null` for the instance.
- The four pages instead get a new Host for the product and one for the instance on each load, `product` never null:
  `#settings` at `:797-806`, `#release` at `:857-863`, `#roles` and `#process` at `:887-890`. Each route calls
  `readSnapshot` on both (`src/implementation-pages/roles.mjs:76-78`, `process.mjs:120-122`,
  `src/settings-pages/settings.mjs:903`, `:1013`, `:1041`).
- `src/test-pages/release.mjs` reads the product's snapshot twice through the same host, in `pendingCandidate`
  (`:151-153`) and `paintForm` (`:171-175`), even for a product that is not the instance.
- A Host keeps no snapshot: MOD-repository-hosts.md:84-85, "It keeps nothing beyond that".

**What the accepted texts already ask.**
- MOD-site-frame.md:292-293: "the default branch of the repository a route shows, asked once per page, and its snapshot
  there".
- MOD-site-frame.md:192: "the empty `product` names the instance itself".

So the fix fits the texts as they stand, and needs no draft:
- The frame gives these routes the context it gives the review pages: the wrapped host, and `product: null` for the
  instance. `#settings` alone keeps, for the instance, the product context it is given now, built on the wrapped host
  (read by the probe build of sprint team1/136: `product: null` there moves UC-042's expectations or MOD-settings-pages'
  own tests, which this item does not name).
- The routes take `product ?? instance` where they now dereference `product.host`; `#settings` does not.
- `paintForm` takes what `pendingCandidate` read.
- `#settings` is shown before the load's snapshot is read (`dashboard-app.mjs:961-967`), so it waits for it.
- The frame's wrapper matches `ref === T.ref`, while the routes ask for `info.defaultBranch`. Read first whether the two
  agree for every product (AGENTS.md §6a.1).

It builds on ITM-681, which removes the adapters of `#roles` and `#process`, so those routes are shown by the frame
directly.

## Acceptance

- `tests/load-per-view.test.mjs` also loads `#roles`, `#process`, `#release` and `#settings`, for the instance and for a
  product that is another repository. Each sends the commit and tree of the repository it shows once (base: 3 for the
  instance's `#roles`, `#process`, `#settings`, 2 for its `#release`, 2 for each on another product). `#process` may
  additionally read the commit its declaration names, when that is another commit. The instance's commit, read on a
  product's page by the prompt bar's own instance host as well, is not counted. Counter-proof: a route that connects a
  host of its own exceeds that count.
- No existing expectation changes (the probe build of sprint team1/136).
- The first commit holds only the tests, and CI is red on it. No stub is committed.
