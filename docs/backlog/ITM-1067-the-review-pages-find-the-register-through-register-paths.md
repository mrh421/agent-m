---
id: ITM-1067
title: The review pages find the register's entries through registerPaths
level: unit
realises:
  - DEVELOP AGAINST INTERFACES
modules:
  - MOD-review-pages
builds_on:
  - ITM-845
tests:
  - unit
origin:
  - ITM-845's pull request #978 (sprint team1/93), from developer-sonnet-a's finding
---
# ITM-1067 The review pages find the register's entries through registerPaths

**REGISTER**

## Outcome

`src/review-pages/spec-entries.mjs:49` keeps its own rule for the register's entries,
`/^docs\/sources\/[^/]+\.md$/`, beside MOD-source-register's `registerPaths` (ITM-845), which takes
`docs/sources/SRC-<slug>.md`. The two copies already differ: the review pages' also take a file whose name does not begin
with `SRC-`.

## The reading of the accepted text

MOD-review-pages' Uses name five functions of MOD-source-register (MOD-review-pages.md:74-78), and not `registerPaths`.
The accepted check reads a module's Uses at the level of the module: it reports "a code file's `imports` edge to a module
of which the file's own module names no interface among its `uses`" (MOD-trace-graph.md:212-213; TST-106805, "the module
before the dot"). So `spec-entries.mjs` may call `registerPaths` (MOD-source-register.md:148), which MOD-source-register
provides.

## Acceptance

- `spec-entries.mjs` finds the register's entries through `registerPaths`, and keeps no path rule of its own. A test shows
  that a file under `docs/sources/` that is no `SRC-` entry is not read as one, with a counter-proof.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The planning run (sprint team1/125).** A stand-in on `main` at `785019f50` imports `registerPaths` beside
`sourceSchemas` and calls it in both places that filtered the paths; the local list of paths is named `entryPaths`, so as
not to hide the import.
- 183 test files that name MOD-review-pages, MOD-source-register, `spec-entries`, `registerPaths`, `docs/sources/`,
  `load-per-view` or the folder: no case fails only with it. `trace-graph-import-uses` passes with it.
- Reads: on `main`, every file under `docs/sources/` is an `SRC-` entry, so the batch is the same; a non-`SRC-` file is
  read no more.
