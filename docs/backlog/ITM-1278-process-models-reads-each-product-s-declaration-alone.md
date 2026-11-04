---
id: ITM-1278
title: Process models reads each product's declaration alone
level: module
realises:
  - UC-031
  - THE PROCESS MODEL IS DECLARED PER PRODUCT
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1266
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1278 Process models reads each product's declaration alone

**REGISTER**

## Outcome

`models` (`src/implementation-pages/process.mjs:409-420`, `declarationsOf`) reads, for each product of this browser, its
commit and whole recursive tree (`readSnapshot`, `:416`) to read one file, `docs/process.md` — for a product of Agent
M's size 6,864 entries, ~309 KB gzipped, per product.

After the change, as MOD-implementation-pages says: each product's default branch is read narrowed to `docs/process.md`
(ITM-1266's `readSnapshot(ref, { folders })`), then that file. `readFileAt` does not fit: it reads at commit
identifiers (`src/repository-hosts/index.mjs:298`), and the head's commit is what the narrowed read gives.

Design principle (AGENTS.md §2 *Designing*): §2.2 — the one way of reading part of a commit, ITM-1266's, is reused;
akmaier — one file read for one file shown.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/implementation-pages-models-declarations.test.mjs` (MOD-implementation-pages, component), over a counting fake
  with three products: `#models` shows which product declares which model as today, and per product sends its commit,
  one folders request and one read of `docs/process.md`, and no `git/trees`. Counter-proof: a product without a
  declaration is shown without a model.

Measurable outcome: `#models` reads per product one entry and one file instead of the whole tree (~309 KB gzipped at
Agent M's size).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.
- Tests of other modules this Outcome changes: none. The only test that draws `#models` is
  `implementation-pages-models` (MOD-implementation-pages).
