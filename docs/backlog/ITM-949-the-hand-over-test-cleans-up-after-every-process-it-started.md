---
id: ITM-949
title: The hand-over test removes its folder only after every process it started has ended
level: unit
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-workflow-entries
builds_on:
tests:
  - unit
origin:
  - ITM-948's pull request #920 (sprint team1/91), run 39151670142, node (5) attempt 1, job 117746414703, found by scrum-master-opus
built_by:
  - 2dd1ccb80926384c2e325d68ebb52bfc86081b20
---
# ITM-949 The hand-over test removes its folder only after every process it started has ended

**REGISTER**

## Outcome

**Measured on #920 (`b1135e0e`).** TST-498005 (`tests/workflow-entries-hand-over.test.mjs:365`) failed once with
"ENOTEMPTY: directory not empty, rmdir /tmp/agent-m-ITM-498-…/product.git". The error came from the test's own cleanup,
`rmSync(root, { recursive: true, force: true })` (`:255`). The rerun passed, and #920 does not touch the file.

The same kind of failure has had a measured cause twice before:
- ITM-653: a process the test started was still writing after the test returned.
- ITM-690's note: git was still writing pack files.

A retry in the cleanup would hide that cause.

**First task:** name which process still writes into `root` when the cleanup runs, from the test's own steps. No change
comes before the cause is named.

## Acceptance

- The test waits for every process it starts before it removes `root`, and needs no retry in its cleanup. A scratch copy
  of the test checks that nothing writes into `root` after the test has returned, with a counter-proof that drops the wait.
- The first commit holds only the tests. No stub is committed.

## Closed on its reading (developer-sonnet-i, sprint team2/105; po-opus-b)

The cause is named, and the writer it names is already gone from the test. ITM-1084 (`2dd1ccb8`, 2026-10-19) removed it.
Nothing is built.
- **The data-flow path, at `b1135e0e`:**
  - `tests/workflow-entries-hand-over.test.mjs:365` (TST-498005);
  - the entry's push, `src/workflow-entries/local-git.mjs:107`, into the bare `product.git`;
  - receive-pack runs `git maintenance run --auto --detach`;
  - the detached child writes `objects/maintenance.lock` after the push has returned;
  - meanwhile `world`'s `finally` runs `rmSync(root, …)` at :255, giving ENOTEMPTY.
- **Measured by i:**
  - GIT_TRACE2 traces on the old test show 15 receive-pack/maintenance and 6 commit/maintenance processes.
  - A file watcher sees the lock appear with git's default configuration, and not with `gc.auto=0`,
    `maintenance.auto=false` and `receive.autogc=false`.
  - ITM-1084 sets exactly those keys in this test. The failure (job 117746414703, 2026-10-18) ran before it.
  - On `fd90222c`: 22 of 22 green, and 3389 git processes traced with no maintenance and no gc.
- **Not measured:** that this writer was the one live at the 10-18 failure, whose log names `rmdir '…/product.git'`.
  48 runs, 12 of them in parallel, gave no failure.
- **Why nothing is built:** a test of this cause cannot be red on the base, since the writer is gone. A green-only guard
  is not an implementation job (AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST).
- **If TST-498005's cleanup fails again,** the flip is reported under agreement 94, and a new item starts from that run's
  full log.
