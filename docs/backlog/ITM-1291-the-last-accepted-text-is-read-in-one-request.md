---
id: ITM-1291
title: The last accepted text is read in one request
level: module
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-approvals
  - MOD-site-frame
  - MOD-review-pages
  - MOD-repository-hosts
builds_on:
  - ITM-1268
tests:
  - unit
origin:
  - po-opus-c's decision on ITM-1268's stop, docs/backlog/sprints/team1/111.md ("ITM-1268's stop: decided")
---
# ITM-1291 The last accepted text is read in one request

**REGISTER**

## Outcome

After ITM-1268 `lastAcceptedText` reads the file at the commit that added the record through
`readSnapshot(last.commit, { folders: [file] })`: the commit and one request for the folder's entries, then the file.
MOD-repository-hosts' `readFileAt(path, [commit])` reads one file at a commit in one request. With it,
`lastAcceptedText` reads the file in one request and compares its blob as it does now.

## The reading of the accepted text

`readFileAt` is a function of the Host: "`Host` — the object `connect` returns; the functions below, from `readSnapshot`
on, are its functions" (MOD-repository-hosts.md:111). MOD-approvals' Uses name `MOD-repository-hosts.Host`
(MOD-approvals.md:10), and `lastAcceptedText` is given the host. So it calls `host.readFileAt`, as it calls
`readSnapshot` and `readHistory` of the same object.

## The reading of the scope

The build moves expectations in two MOD-site-frame tests: `tests/review-pages-impact-box.test.mjs` and
`tests/review-page.test.mjs` (TST-894004 and TST-894005, whose fake host has no `readFileAt`, and TST-1294005, batches
1 → 2). `A BACKLOG ITEM NAMES THE MODULES IT CHANGES` (SPEC.md:1683-1686): the item changes those tests, so it names
MOD-site-frame, and `AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES` (SPEC.md:1482-1486) then allows them, since they
name MOD-site-frame. In MOD-site-frame the item changes only these tests' fakes and the counts of its own call; no code
of `src/site-frame/` changes. The counts below were measured before MOD-repository-hosts' `readSnapshot` sent a
snapshot's commit and trees together (MOD-repository-hosts.md:200-203); the probe measures them again.

## Acceptance

- A unit case counts one request for the older file and none for its commit or a tree; it fails on the code as
  ITM-1268 leaves it.
- Only `src/approvals/` and its tests change, and the tests' fakes that the call reaches.
- The fakes that the call reaches, changed only in how they serve the older text (`readFileAt`, instead of a snapshot of
  the older commit): `tests/approvals-last-accepted.test.mjs`, `approvals-last-accepted-one-file`,
  `approvals-last-accepted-requests`, `approvals-put-back-after-removal`, `review-core`,
  `specification-and-design-together`, `specification-drafting-together`, and those of TST-472608, 680102, 729003,
  472651, 472682 and 472688.
- The expectations that move, each a count or a failure of reading the older text, which this item changes
  (A PAGE LOAD READS THE REPOSITORY IN BATCHES; MOD-repository-hosts' `readFileAt`): TST-472019 (a fake's TypeError
  becomes NotFound), TST-1268003, TST-929002 (on GitLab, commit 2 → 1, tree 0 → 1, as its `readFileAt` reads), TST-1266104,
  TST-1266108, TST-1294009, TST-1294005 (batches 1 → 2), TST-942003, TST-942004, TST-921003, TST-921004, TST-1334001,
  TST-680101, TST-728001, TST-894004, TST-894005, TST-729001, TST-729002 and TST-730004. "None for a tree" holds with a
  token on GitHub.
- The implementer's own red unit test comes first.
- The release cases TST-1268301 to TST-1268305 and TST-1314301 to TST-1314303 are changed by developer-sonnet-l in one
  commit, written from the pushed code. It goes onto this pull request's branch before the gate, so CI is green there.
- The item names MOD-review-pages and MOD-repository-hosts for tests only (`A BACKLOG ITEM NAMES THE MODULES IT
  CHANGES`), as it names MOD-site-frame. The fakes of the `review-pages-*` files and of `tests/memory-host.mjs` serve
  `readFileAt`, and no code of those modules' folders changes. A test names a module by its header's `Module:` line
  (MOD-test-document's header), not by any mention in its text.
- TST-929002 is counted as the probe measures it on today's `readSnapshot`: on GitLab the tree goes 2 → 1.
- Where ITM-1349 changes the same test file, whichever pull request merges second rebases onto the sprint branch and runs
  the moved files again.

**The planning run (sprint team1/124).** A stand-in on `main` at `fb0322f08` reads the older file with one
`readFileAt(file, [commit])` and compares its blob.
- Counted over a fake host: the snapshot at the record's commit and its file become one `readFileAt`; the reads of the
  head, the history and the record stay.
- 264 files that name MOD-approvals, `lastAcceptedText`, `readFileAt`, MOD-review-pages, MOD-workflow-entries or
  `load-per-view`: 45 cases fail only with it, most of them fakes that serve the older commit as a snapshot and no
  `readFileAt`. Among them tests of MOD-review-pages and the release cases TST-1268301 to TST-1268305. The item
  names those files before it is selected.
