---
id: ITM-1236
title: The Tests pages lead to a use case through go
level: module
realises:
  - EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
modules:
  - MOD-test-pages
builds_on:
  - ITM-1223
tests:
  - unit
origin:
  - the check of the documents akmaier accepted since 2026-10-25 against the code: MOD-test-pages (:172-173) — a route leads to another only through go; three raw links remain
---
# ITM-1236 The Tests pages lead to a use case through go

**REGISTER**

## Outcome

MOD-test-pages (:172-173): a route leads to another only through the context's `go`. Three links still set the address
directly: `src/test-pages/generate.mjs:183,185` and `src/test-pages/runs.mjs:286` (`href="#use-case/id=UC-0xx"`), so
they drop the chosen product and break when the view is embedded. They lead through `go`.

## Acceptance

- Unit tests naming MOD-test-pages: clicking these links calls `go("use-case", { id })`. Counter-proof: before the
  change none does.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/test-pages/` and the tests that name MOD-test-pages change.
