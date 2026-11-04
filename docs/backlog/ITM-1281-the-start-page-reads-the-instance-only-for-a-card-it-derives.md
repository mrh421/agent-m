---
id: ITM-1281
title: The start page reads the instance only for a card it derives
level: module
realises:
  - UC-046
  - THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-main-page
builds_on: []
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1281 The start page reads the instance only for a card it derives

**REGISTER**

## Outcome

`home` (`src/main-page/home.mjs:126-129`) reads the instance's commit and whole tree before any card, as
`reading.instanceSnapshot`. It is used only by `factsOf` (`:77-79`), for a card with no stored overview, and as the
snapshot of Agent M's own card (`:139`). With products whose overviews are stored, it is read and not used: 6,864
entries, ~309 KB gzipped at Agent M's head, on every load of the main page — beside the prompt bar's own read of the
same snapshot (`src/prompt-bar/bar.mjs:498`).

After the change, as MOD-main-page says: the instance's snapshot is read once, when the first card is drawn from the
scope `all`, and for Agent M's own card; while every card has its overview, `home` reads none of the instance.

Design principle (AGENTS.md §2 *Designing*): akmaier — what is read is what the page draws.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/main-page-home-instance.test.mjs` (MOD-main-page, component), over a counting fake: two products with stored
  overviews draw their cards as `tests/main-page-home.test.mjs` expects and `home` sends no commit or tree of the instance;
  with one product without an overview, one read of the instance. Counter-proof: without a product, Agent M's card
  reads the instance once.

Measurable outcome, on the live main page with products whose overviews are stored: two requests and ~309 KB gzipped
fewer per load.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/main-page/` and the tests that name MOD-main-page change.
- **The function it needs is named in MOD-main-page's Uses:** `MOD-repository-hosts.readSnapshot`
  (MOD-main-page.md:24). The text gives the route this behaviour (MOD-main-page.md:127-129): "The instance's snapshot …
  is read only for a card drawn from that scope, once for all such cards, and for Agent M's own card; while every card
  has an overview, the route reads none of the instance."
- **Tests of the module's own that count the instance's reads on `home`, to be checked in the tests-only commit:**
  - `main-page-home` (`:205-214`, `:453`, `:524`);
  - `main-page-root-entry`'s TST-684003, Agent M's own card reading the instance once, which the Outcome keeps.
  - An expectation that changes stands in the tests-only commit.
- **Tests of other modules this Outcome changes: none.**
  - The search was every file under `tests/` that loads `main-page-home-harness`, `main-page/index.mjs` or
    `main-page/home.mjs`, on `main` at `82f63cbf`, read to its end: 35 files.
  - Of the files of other modules, `release-itm-1272`, `release-itm-1273` and `review-pages-entry-own-queue` count
    requests. They count those of the product, its `overview-cache` and its queue files, and none of the instance.
  - MOD-notifications', MOD-maintenance-pages' and MOD-site-frame's files count no request of the instance.
  - Its known positive is `main-page-root-entry`'s TST-684003.
- It removes no test.
