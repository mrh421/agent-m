---
id: ITM-1346
title: A lazy registration that fails is made at the next call
level: module
realises:
  - EVERY PAGE LOADS IN UNDER THREE SECONDS
modules:
  - MOD-job-runner
builds_on: []
tests:
  - unit
origin:
  - a review of akmaier's emergency commits of 2026-11-01, sent by the Scrum Master of team 1
---
# ITM-1346 A lazy registration that fails is made at the next call

**REGISTER**

## Outcome

MOD-job-runner's `registeredAll` "makes every registration handed to `registerLater` that is not made yet, each once, in
the order handed; `prepareJob`, `runJob`, `writeResult` and the offer of tools call it first" (MOD-job-runner.md:299-300).
`src/job-runner/registry.mjs:50` takes a registration off the list before it runs it: `while (later.length) await
later.shift()();`. When its `import()` fails once — a network error while a page loads a view's strategies —, that
registration is gone, it is never made, and every later job of its kinds fails with `UnknownStrategy`. The function's own
comment says "the ones after it are made at the next call", and the failed one is not among them.

After the change, a registration leaves the list only once it is made; a failed one stays first and is made again at the
next call of `registeredAll`.

## Acceptance

- A unit test of its own, TST-1346nnn, headed `Module: MOD-job-runner`: a registration that throws at the first call of
  `registeredAll` and succeeds at the second is made at the second, and the registrations after it follow in the order
  handed. Counter-proof: on the code as it stands, the second call makes nothing and the strategy stays unknown.
- No registration is made twice: a made one is not run again at the next call.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/job-runner/` and the tests that name MOD-job-runner change.
