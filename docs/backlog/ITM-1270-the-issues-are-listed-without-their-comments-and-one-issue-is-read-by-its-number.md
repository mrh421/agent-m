---
id: ITM-1270
title: The issues are listed without their comments, and one issue is read by its number
level: module
realises:
  - UC-012
  - EVOLUTION ENTERS THROUGH THE SPECIFICATION
modules:
  - MOD-repository-hosts
  - MOD-maintenance-pages
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1270 The issues are listed without their comments, and one issue is read by its number

**REGISTER**

## Outcome

- `#issues` (`src/maintenance-pages/issues.mjs:62-82`) shows number, title and class of each open issue; it calls
  `listIssues({ state: "open" })`, which asks for every page of the open issues and then every page of the comments of
  each issue that has any (`src/repository-hosts/github.mjs:300-311`): one request more for each commented issue.
- `#issue/number=<n>` (`issues.mjs:323-335`) calls `listIssues({ state: "all" })` — every issue the product ever had,
  closed ones included, each with all its comments — and keeps the one whose number is `n`; `replies/<issue>` does the
  same (`src/maintenance-pages/replies.mjs:220`).

After the change, as MOD-repository-hosts and MOD-maintenance-pages say: `listIssues` takes `comments: false`, with
which it asks for no comment; `readIssue(number)` reads one issue and its comments. The list passes `comments: false`;
`issue` and `replies/<issue>` read their issue with `readIssue`. Every other caller of `listIssues` is unchanged.

Design principles (AGENTS.md §2 *Designing*): ch. 10 *a module interface is minimal* — one function for the one issue a
page shows, instead of a filter over all of them; §2.4 — the default of `listIssues` stays, so no other caller changes.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/repository-hosts-read-issue.test.mjs` (MOD-repository-hosts, unit), over fake GitHub and GitLab servers:
  `readIssue(7)` sends one request for the issue and one per page of its comments, and gives the same `Issue` that
  `listIssues` gives for it; `listIssues({ state: "open", comments: false })` sends no comment request. Counter-proof:
  without `comments`, the comments are read as today; `readIssue` of a pull request's number is `NotFound`.
- `tests/maintenance-pages-issues-reads.test.mjs` (MOD-maintenance-pages, component): `#issues` with 40 open issues of
  which 30 have comments sends one page of issues and no comment request; `#issue/number=7` sends no listing.

Measurable outcome, at review on the live page: `#issues` sends one request per hundred open issues and none per
commented issue; `#issue/<n>` and `#replies/<n>` send one request and one per hundred of its comments, instead of
every page of every issue the product has had and the comments of each.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of the two modules and the tests that name them change.
- Tests of other modules this Outcome changes: none.
  - `listIssues` keeps its default, so its callers in MOD-issue-handling, MOD-mail-handling, MOD-work-plans,
    MOD-job-catalogue and MOD-artifact-edits, and their tests, do not change.
  - `site-frame-replies-menu` (MOD-site-frame) draws `#replies/issue=…` and asserts *Read replies* before its click
    (`:77-82`). The route reads its issue only after that click (`arrivalsOf`, `src/maintenance-pages/replies.mjs:219`).
