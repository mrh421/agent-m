---
id: ITM-1266
title: A review page reads only the folders it shows of its commit's tree
level: module
realises:
  - UC-008
  - UC-020
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
  - STATUS IS DERIVED FROM THE RECORDS
modules:
  - MOD-repository-hosts
  - MOD-site-frame
  - MOD-review-pages
  - MOD-notifications
  - MOD-settings-pages
  - MOD-trace-pages
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1266 A review page reads only the folders it shows of its commit's tree

**REGISTER**

## Outcome

Every load of `docs/index.html` reads the product's commit and its whole recursive tree (`loadSnapshot`,
`src/site-frame/dashboard-app.mjs:292-304`; GitHub adapter `src/repository-hosts/github.mjs:220-228`,
`git/trees/<sha>?recursive=1`). At Agent M's head that tree names 6,864 files, about 309 KB gzipped as the API sends it,
and it grows with every record: `docs/gates/` 1,476, `tests/` 1,351, `docs/backlog/` 1,233, `docs/approvals/` 965,
`src/` 512, `docs/jobs/` 478. The adapter does not look at the API's `truncated` flag, which GitHub sets above 100,000
entries or 7 MB.

What a review route takes from the tree: the paths and blobs of the files it shows, and the names of the approval
records, from which the status of each comes (`statuses`, `src/approvals/status.mjs:63-82`; no record is read). The
batches read by `<commit>:<path>` (`github.mjs:123-128`, `:363`) and need no blob. So `#uc` uses
`docs/use-cases/`, `docs/approvals/` and `docs/groups/` — 1,016 entries, ~45 KB gzipped —, `#arc` `docs/architecture/`
with the same two — 1,041, ~46 KB —, `#spec` `SPEC.md`, `docs/sources.md`, `docs/sources/`, `docs/spec-freigaben/`,
`docs/approvals/` and `docs/groups/` — 1,392, ~61 KB. GitHub's GraphQL `Tree.entries` gives a folder's entries with
their `oid`, several folders aliased in one request, as `readMany` already asks for many blobs.

After the change, as MOD-repository-hosts and MOD-site-frame say:

- MOD-repository-hosts: `readSnapshot(ref, { folders })` — with a token on GitHub, the commit, then the entries of the
  named folders at every depth and the named files in one GraphQL request; elsewhere the whole tree, narrowed. A read
  outside them fails with `OutsideSnapshot`. Without `folders`, unchanged. The whole-tree read refuses a truncated
  tree with an error that names it, never a partial list.
- MOD-site-frame: a route may name `folders(params)`; the frame reads the page's snapshot with them; a route that names
  none gets the whole tree, as now.
- MOD-review-pages: the routes `use-case`, `decision`, `module` and `spec-entry` and the addresses `#uc`, `#arc`, `#spec`
  name their folders. Routes that build or read across the repository — the trace graph's fallback, `#implement`'s
  taken job identifiers — name none and keep the whole tree.

Design principles (AGENTS.md §2 *Designing*): §2.4 *adding one of a kind changes nothing of another kind* — a route that
names no folders is unchanged, so the change is open for extension and closed for change (ch. 10, open-closed); §2.1
— which folders a route shows is the route's, how a snapshot is read is the host's; ch. 10 *least astonishment* — a
path outside the snapshot fails by name instead of answering as a missing file.

Reading taken: SPEC `A PAGE LOAD READS THE REPOSITORY IN BATCHES` bounds a load's reads — "its commit and that commit's
tree once", and the files it shows in batches; reading of that tree only the folders the route shows, in one request,
reads it once and less of it. No SPEC change is needed.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/repository-hosts-snapshot-folders.test.mjs` (MOD-repository-hosts, unit), over a fake GitHub: `readSnapshot("main",
  { folders: ["docs/use-cases", "docs/approvals", "SPEC.md"] })` sends the commit and one GraphQL request, and its
  `paths` and `blob` are exactly those of the three; `read("docs/jobs/JOB-1.md")` fails with `OutsideSnapshot`.
  Counter-proofs: without `folders` the commit and the recursive tree, as now; a recursive tree answered with
  `truncated: true` fails by name.
- `tests/load-per-view.test.mjs` (MOD-site-frame, component): the start page, `#arc` and `#spec` send their commit, one
  request for their folders and their batches, and no `git/trees`; `#settings` sends none of them. The cases that
  count `["commit","tree",…]` are rewritten with the folders request.

Measurable outcome, on the live page of the instance in the browser's network panel:

| Route | Today | After |
|---|---|---|
| `#uc`, `#use-case/…` | commit + tree of 6,864 entries (~309 KB gzipped) | commit + 1,016 entries (~45 KB) |
| `#arc`, `#decision/…`, `#module/…` | the same | commit + 1,041 entries (~46 KB) |
| `#spec`, `#spec-entry/…` | the same | commit + 1,392 entries (~61 KB) |

The sizes are of the REST tree's entries; GraphQL entries carry no `url` and are smaller.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of MOD-repository-hosts, MOD-site-frame and MOD-review-pages and the tests that name them change, and,
  of MOD-notifications, MOD-settings-pages and MOD-trace-pages, only the fakes of their tests that GitHub's query of the
  folders' entries reaches: a read sent as POST to `/graphql`. No code of those three modules changes.
