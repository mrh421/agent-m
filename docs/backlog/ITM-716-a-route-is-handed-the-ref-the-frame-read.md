---
id: ITM-716
title: A route is handed the ref the frame read
level: module
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-site-frame
  - MOD-review-pages
builds_on:
  - ITM-680
tests:
  - unit
origin:
  - ITM-680's second draft stop (sprint team1/73), from developer-sonnet-d's data-flow path
---
# ITM-716 A route is handed the ref the frame read

**REGISTER**

## Outcome

Every route of MOD-review-pages starts with `readPlace` (`src/review-pages/common.mjs:123-133`). Through `defaultSnapshot`
(`:113-116`) it calls `host.repositoryInfo()`, a `GET /repos/<repo>`, for the default branch, and then reads the snapshot of that branch.
The frame has already read the snapshot of the ref it shows. With a token, `#uc`, `#arc` and `#review/uc` therefore make
one request more per load than the frame alone.

`repositoryInfo` also gives whether the person may write and the repository's visibility, which the module's text names
as its reasons to use it. So that read cannot simply go.

## The reading of the accepted text

The frame already hands a route the snapshot it read. `Route.reads` is given "the repository the route shows as the frame
has read it for the page" (MOD-site-frame.md:163), and the frame calls it before `render`.
- The routes of MOD-review-pages draw from that snapshot, and read no default branch of their own.
- They ask `repositoryInfo` only where they need what it gives: whether the person may write, or the repository's
  visibility.
- No member of `ViewContext` or `Route` changes.

## Acceptance

- With a token, `#uc`, `#arc` and `#review/uc` send their commit and tree once and their batches, and MOD-review-pages
  itself asks no `repositoryInfo` beyond those the page needs for writing or visibility. `load-per-view.test.mjs` counts
  it. The `repositoryInfo` of MOD-trace-pages on `#arc` (`onDefaultBranch`) and of MOD-approvals on `#review/uc`
  (`lastAcceptedText`) stay: they are not this item's modules.
- Whether the person may write is still shown where the pages show it today.
- After a decision written on a page (*Accept*, *Save*, *Reject*), the page is drawn again with the commit the write
  named (MOD-review-pages.md:206), read through `readSnapshot` at that commit, not through the default branch. The
  release cases of UC-008 1–5, 3a and UC-006 1–7, 3a, 5a in `tests/release-sprint-01-dashboard-app.test.mjs` (`:408`,
  `:473`, `:635`, `:650`, `:666`, `:913`) stay green unchanged, and its `:387` count stays.
- The existing expectations this item changes, each named in the tests-only commit (old → new):
  - `tests/load-per-view.test.mjs`: `:127` (TST-1266101) repository 1 → 0; `:237` 1 → 0 and `:238` on `#arc` 0 → 1 —
    the page still reads the repository's information once while it is open; `:353` (TST-1266110) 1 → 0; `:366`
    1 → 0; `:432`, `:434` (TST-1266105) without "repository"; `:462` (TST-1266106) `#use-case`/`#decision` 1 → 0;
    `:491` (TST-1319007) the pulled product's `{ repository: 1 }` against the plain one's `{ repository: 0 }`; `:508`
    `#use-case`/`#decision` 1 → 0; `:522`, `:524` (TST-1266107) without "repository".
  - `tests/release-itm-1319-page-reads.test.mjs:57` (TST-1319204): the pulled product's repository 0 → 1 against the
    plain one; this is developer-sonnet-l's commit, as the release test of another item.
  - `tests/review-pages-release-reports.test.mjs` (header: MOD-review-pages): only how it prepares its fixture changes —
    the fake host at `:83` also serves the commit its `commitFiles` returns, so that the page drawn again at that commit
    can be read (TST-910103, `:186`); no expected result changes.
  The pull request names the caller of the `repositoryInfo` the pulled product keeps.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
