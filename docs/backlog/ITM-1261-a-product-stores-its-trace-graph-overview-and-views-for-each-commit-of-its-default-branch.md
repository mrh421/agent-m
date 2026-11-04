---
id: ITM-1261
title: A product stores its trace graph, overview and views for each commit of its default branch
level: module
realises:
  - UC-020
  - UC-035
  - UC-046
  - A REQUIREMENT SHOWS WHAT TRACES TO IT
  - THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
modules:
  - MOD-runtimes
  - MOD-workflow-entries
  - MOD-trace-graph
  - MOD-trace-pages
  - MOD-site-frame
builds_on:
  - ITM-1260
  - ITM-1202
tests:
  - unit
origin:
  - akmaier, 2026-10-28, on ITM-1260's sentence that a product derives the views in the page because `onMainChanged` runs only in the instance: "products should precompute too."
  - akmaier, 2026-10-28: a product that has not written the new file yet gets no graph built in the page; its trace pages say how to get it, through *Install* on its Settings page (ITM-1202 first)
---
# ITM-1261 A product stores its trace graph, overview and views for each commit of its default branch

**REGISTER**

## Outcome

Today `onMainChanged` runs only from the instance's `.github/workflows/main-changed.yml`; its one caller of
`publishGraph` and `publishOverview` is `src/workflow-entries/instance.mjs`, and no file Agent M writes into a product
runs it (`src/runtimes/workflow/github.yml` and `gitlab.yml` run the job entries alone). So a product's branches
`trace-cache` and `overview-cache` never exist: its trace pages end in `GraphNotStored`, whose text names the instance's
workflow "main changed" (`src/trace-graph/build.mjs`), its card on the main page reads the scope `all`, and its
`#progress` and `#backlog` derive their views in the page.

After the change, as MOD-runtimes and MOD-workflow-entries say:

- MOD-runtimes: `jobWorkflowFiles` also returns, beside the job workflow and pinned to the same instance commit,
  `.github/workflows/agent-m-main-changed.yml` or `.gitlab/agent-m-main-changed.yml` (included from `.gitlab-ci.yml`),
  from the templates `workflow/github-main-changed.yml` and `workflow/gitlab-main-changed.yml`: one job on the server's
  runners, on a push to the default branch, on the schedule and on a start from the server's page, that makes the two
  branches once and runs `onMainChanged`; on GitHub with the workflow's own token (`contents: write`), on GitLab in the
  environment `agent-m-write` with the person's token; no key.
- MOD-workflow-entries: `onMainChanged` moves to `main-changed.mjs` and runs alike in the instance and in a product; in a
  product it reads the instance through the checkout at the pinned commit, as `instanceAt`. It stores what
  MOD-trace-graph's `publishGraph` and MOD-progress-measures' `publishOverview` store, whatever those hold when this item
  is implemented.

A product whose files are not written again stays as it is: its pages read what its branches hold, and derive the views
where they hold nothing.

## The reading of the accepted text

The Outcome is accepted text: MOD-runtimes.md:112 and :212-218, and MOD-workflow-entries.md:132 and :363-372. The file
`agent-m-main-changed.yml` and `main-changed.mjs` run alike in the instance and in a product.
- `storedGraph` stays as MOD-trace-graph states it: it "reads no other file" and "rejects with `GraphNotStored`, naming
  the commit and the workflow that stores it" (MOD-trace-graph.md:186-191). In a product, after this item, that workflow
  is the product's own "main changed".
- The step "press *Install* on its Settings page" is the trace page's wording, where it shows a `GraphNotStored` on a
  product's page (MOD-trace-pages). It reads nothing more, so it is shown on every product page whose graph is not
  stored; *Install* writes the files again where they stand.

## Acceptance

- Unit tests naming MOD-runtimes: for GitHub and GitLab, `jobWorkflowFiles` returns the main-changed file at the
  instance commit it is given; on GitHub it reads no secret and asks `contents: write`; on GitLab its job is of
  `agent-m-write` and reads the token by its name; neither runs `chooseAgentKey` or an agent's entry. Counter-proof: a
  file that names a key fails.
- Unit tests naming MOD-workflow-entries: in a fixture product with a fixture instance checkout, `onMainChanged` adds the
  graph to the product's `trace-cache` and the overview and views to its `overview-cache`; run again, `nothing to do`.
  Counter-proof: before the change the entry has no product route.
- A unit test naming MOD-trace-pages: on a product's page whose `trace-cache` holds no graph, the page shows
  `GraphNotStored`'s line and "This product's graph is not stored yet: press *Install* on its Settings page."; on the
  instance's page, `GraphNotStored`'s line alone, naming the workflow "main changed" as now. Counter-proof: before the
  change the product's page names only the instance's workflow.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- The existing expectations that change, each because MOD-runtimes.md:212-219 and :328-339 add the main-changed file
  and its include (found by the probe build of sprint team1/136):
  - `tests/runtimes-workflow.test.mjs:90-91` (TST-472723): the paths, for GitHub and GitLab, gain
    `agent-m-main-changed.yml`; `:421` `TEMPLATE_FILES`, used by TST-472728 (`:455`) and TST-1202101 (`:475`), two
    templates → four.
  - `tests/runtimes-gitlab-ci-merge.test.mjs` TST-548001 to TST-548006 and TST-548008: each expected `.gitlab-ci.yml`
    gains the entry `- local: .gitlab/agent-m-main-changed.yml`, added only where missing.
  - `tests/settings-pages-job-workflow-gitlab-ci.test.mjs:122` (TST-548101): *Install* writes three files, not two, and
    the merged text gains that entry. Its `Module:` line is MOD-settings-pages, but its header names MOD-runtimes'
    `jobWorkflowFiles`, whose result it asserts: a test that names one of this item's modules
    (`AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES`).
  - `tests/test_runtime_levels.md:149`, `:174`, `:255`, `:280`: `files` 1 → 2 on GitHub, 2 → 3 on GitLab; and
    `tests/test_runtime_levels.py:101` joins only the job workflow's files, not `agent-m-main-changed.yml`, for the
    checks of the SPEC's key and token sentences, whose Check names "the generated job workflow". Every counter-proof
    there stays and still fails.
- Only `src/runtimes/`, `src/workflow-entries/`, `src/trace-graph/`, `src/trace-pages/` and the tests that name these
  modules change, and, of MOD-site-frame, only the entry pages `index.html` and `docs/index.html`. Each gains the
  preloads of `src/runtimes/workflow/github-main-changed.yml` and `gitlab-main-changed.yml`, as
  `node src/site-frame/preloads.mjs` writes them (MOD-site-frame.md:85-93, :125), in one commit of that output alone, so
  that `tests/site-frame-preloads.test.mjs` (TST-1290001, TST-1290002) holds unchanged.
