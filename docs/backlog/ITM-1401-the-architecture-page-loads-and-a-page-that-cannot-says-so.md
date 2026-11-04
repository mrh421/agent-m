---
id: ITM-1401
title: The Architecture page loads, and a page that cannot load says so in plain words
level: module
realises:
  - UC-022
  - UC-023
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-site-frame
  - MOD-review-pages
builds_on: []
tests:
  - unit
origin:
  - akmaier's report on the live site, relayed to team1's sprint 142: the Architecture page shows only the menu and "Cannot access 'SERVICES' before initialization." — "This is not very useful and the user does not understand this. I think it just shows that the graph is being rebuilt. It should say so."
---
# ITM-1401 The Architecture page loads, and a page that cannot load says so in plain words

**REGISTER**

## Outcome

On the live site, the Architecture page showed only the menu and the raw exception "Cannot access 'SERVICES' before
initialization."

The cause is fixed on `main` by akmaier's direct change `7f22d8294`. `#arc` imported `src/review-pages/flow.mjs` twice at
once. WebKit resolved the second import before the module had run, so `reviewRoute` read `SERVICES` (`flow.mjs:185`)
uninitialised. Every kind route of `routes.mjs` now waits on the first import. No test guards that fix yet.

What is left: a view that fails is still shown as its raw message. The dashboard's catch writes `errorText` of the error
into the page (`src/site-frame/dashboard-app.mjs:1009`), and a route that fails to render shows MOD-site-frame's
`readProblem`, "that this page could not be drawn, with the error's message". The person learns neither what happened nor
what to do.

## Acceptance

- A regression test of MOD-review-pages: two concurrent loads of the kind routes, as `#arc` makes them, both draw their
  route. Counter-proof: the `import` of `flow.mjs` per route, as it was before `7f22d8294`, fails it where node can show
  it, or the case names why node cannot.
- A view or route that cannot be drawn says in plain words what happened and what the person can do, for example reload
  the page or report it. The error's message stays available below that text, not in its place.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it for the plain-words part. No stub is committed.
