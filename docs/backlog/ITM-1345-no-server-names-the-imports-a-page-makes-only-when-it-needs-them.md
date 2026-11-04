---
id: ITM-1345
title: NO SERVER names the imports a page makes only when it needs them
level: module
realises:
  - NO SERVER
modules:
  - MOD-repository-hosts
builds_on: []
tests:
  - unit
origin:
  - the Scrum Master's CI-only pull request #1600 on `main` at c96e77bda, run 41274071078: `unit-pull-request (8)` and `release-pull-request (7)` fail; `main`'s push runs run no row of tests, so the break shows on pull requests only
---
# ITM-1345 NO SERVER names the imports a page makes only when it needs them

**REGISTER**

## Outcome

A page now imports a view's strategies, the prompt bar's modules for acting, the notifications' checks and a few readers
only when it needs them (MOD-site-frame, MOD-job-runner's `registerLater`, MOD-prompt-bar's `loadHandOverStrategies`, each
view's `routes.mjs`, MOD-main-page's `sources.mjs`, MOD-progress-measures' `stored.mjs`; all accepted). Each of these is an
`import()` of a module of the site's own origin, by a relative address written out.

`tests/test_no_backend.py` lists every dynamic import with the reason it calls no other origin, and fails on one it does
not list. On `main` at c96e77bda `test_requests_leave_only_through_the_known_channels` reports 24 findings, and
`tests/test_release_sprint_02_d.py`, which runs that check on a copy of the repository, fails with it:
- `import()` not listed: `src/main-page/routes.mjs:18`, `:21`, `:28`; `src/main-page/sources.mjs:11`;
  `src/notifications/checks.mjs:59`; `src/progress-measures/stored.mjs:219`; `src/prompt-bar/bar.mjs:26`, `:27`, `:35`;
  `src/prompt-bar/index.mjs:17`, `:18`; `src/site-frame/index.mjs:422`, `:444`; `src/site-frame/register.mjs:34`;
  `src/site-frame/dashboard-app.mjs:381`, `:569`.
- `src/site-frame/routing.mjs:133`: the listed reason names `../<slug>/index.mjs`; the frame now loads a view's
  `routes.mjs` (MOD-site-frame, Parts, `start.mjs`).
- More than permitted: `src/site-frame/dashboard-app.mjs` (3, permitted 1), and the folders `src/review-pages/` (4, at
  most 3), `src/trace-pages/` (2, 1), `src/implementation-pages/` (7, 6), `src/test-pages/` (6, 5),
  `src/maintenance-pages/` (4, 3) and `src/settings-pages/` (12, 11) — each view's `routes.mjs` imports its `index.mjs`
  for `loadStrategies`.

Every pull request into a sprint branch cut from `main` is red on these two jobs until the check lists them.

## Acceptance

- `tests/test_no_backend.py` lists each of these imports in its existing form: the reason it calls no other origin, a
  file's entry exactly as often as it occurs, a folder's at most as often; the entry of `routing.mjs` names a view's
  `routes.mjs`, as MOD-site-frame's accepted text gives it.
- On a pull request, `unit-pull-request` and `release-pull-request` pass with the two tests run, not skipped;
  `tests/test_release_sprint_02_d.py` passes unchanged.
- No counter-proof of the check is weakened: an `import()` of an address of another origin, planted in one of these files,
  is still a finding, shown in the pull request.
- The item adds no behaviour: its one commit holds only the test's change, and CI is green on it (the base is red, run
  41274071078).
- Only `tests/test_no_backend.py` changes.
