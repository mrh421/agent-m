---
id: ITM-1268
title: The last accepted text is read as one file at one commit
level: module
realises:
  - A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-approvals
  - MOD-site-frame
builds_on: []
tests:
  - unit
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1268 The last accepted text is read as one file at one commit

**REGISTER**

## Outcome

`lastAcceptedText` (`src/approvals/status.mjs:142-170`), which every changed use case, decision and module shows its
difference against, and which `onMainChanged` calls for every changed architecture file, reads the head
(`readSnapshot`, `:144`), one history per record of the identifier (`:147-150`), the records, and then
`host.readSnapshot(last.commit)` (`:163`): the commit and the whole recursive tree of that older commit — at Agent M's
size about 6,900 entries, ~309 KB gzipped — to compare one blob and read one file. `tests/load-per-view.test.mjs` pins
this today (`#uc/UC-002, changed`: `["era commit","era tree","era file UC2"]`).

The text's own blob is already compared after it is read (`blobSha(text) !== blob`, `:167`), so the tree adds no
check. MOD-repository-hosts' `readSnapshot(ref, { folders })` reads, with a token on GitHub, the commit and the entries
of the named files in one request, and no whole tree (MOD-repository-hosts.md:196-203, built by ITM-1266).

After the change: `lastAcceptedText` reads the older commit as `readSnapshot(last.commit, { folders: [<the file's
path>] })`, reads the file from that snapshot, and fails as now when the text's blob is not the one the record names.
MOD-approvals' text is unchanged.

The review pages call it with the host the frame gives every route, `pagesHost()` (`src/site-frame/dashboard-app.mjs:656-662`).
Its `readSnapshot` takes the `ref` alone and calls `real.readSnapshot(ref)`, so it drops `folders` and the older tree is still
read. MOD-site-frame.md:186-190 gives a route `host: Host`, "`Host` … as MOD-repository-hosts … define[s] them", and that
`readSnapshot` takes `options?: { folders }` (MOD-repository-hosts.md:196). So the wrapper's dropped options are a defect left
by ITM-1266, mended here: the wrapper hands `options` on to the real host, and returns the load's snapshot only for the
load's `ref` with no `folders` named, as now. Its interface reads "the history of the records and of the file through the host",
and its Uses name `MOD-repository-hosts.readSnapshot` (MOD-approvals.md:12, :199).

Reading taken (AGENTS.md §6a.6): `readFileAt` would read the file in one request, but MOD-approvals' Uses do not name
it. Its `uses:` names each function of the host it calls beside `Host` (MOD-approvals.md:8-13), and a function they do
not name is a draft for akmaier first, as ITM-816 has it for `HostError`. `readSnapshot` with `folders` needs no draft,
so it is the one taken.

Design principles (AGENTS.md §2 *Designing*): §2.2 *nothing twice* — the blob is compared once, on the text read,
not on a tree and then on the text; ch. 12 KISS — one request for one file.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/approvals-last-accepted-one-file.test.mjs` (MOD-approvals, unit), over a fake host: for a use case with one
  record, `lastAcceptedText` reads the older commit's snapshot with `folders` naming only the file, and reads that one
  file from it; counter-proof: a file whose text at that commit has another blob fails with `NotFound` naming it, as
  today.
- `tests/load-per-view.test.mjs`: `#uc/UC-002, changed` sends the era commit, one request for the era's folders and one
  read of UC2 at that commit, and no era tree.

Measurable outcome: with a token, a changed use case, decision or module, opened on the live page, reads no older tree
(~309 KB gzipped less at Agent M's size); *Review all* saves the same for each changed file it shows.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/approvals/` and the tests that name MOD-approvals change. Of MOD-site-frame, only `pagesHost`'s `readSnapshot`
  in `src/site-frame/dashboard-app.mjs` changes, which hands `options` on as above, and the cases of
  `tests/load-per-view.test.mjs` and `tests/review-page.test.mjs` that count the reads of a changed file's last accepted
  text. A unit or component test names MOD-site-frame and shows the options reaching the real host; counter-proof: the
  wrapper as it stands drops them.
