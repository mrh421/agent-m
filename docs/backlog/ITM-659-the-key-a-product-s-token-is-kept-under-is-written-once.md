---
id: ITM-659
title: The key a product's token is kept under is written once
level: module
realises:
  - A GITHUB PRODUCT USES A TOKEN OF ITS OWN
modules:
  - MOD-site-frame
  - MOD-review-pages
  - MOD-settings-pages
  - MOD-browser-store
builds_on:
tests:
  - unit
origin:
  - ITM-601's stop before its tests-only commit (sprint team1/67), from developer-sonnet-d's finding
---
# ITM-659 The key a product's token is kept under is written once

**REGISTER**

## Outcome

The key a product's own token is kept under ("MOD-browser-store, Data") is written four times:
- MOD-site-frame's `tokenKeyOf` (`src/site-frame/routing.mjs:51`);
- MOD-review-pages' `storedToken` (`src/review-pages/common.mjs:94-100`);
- MOD-settings-pages' `tokenSettingKey` (`src/settings-pages/products.mjs:116-120`);
- MOD-browser-store's `tokenKey`, for keys it converts (`src/browser-store/legacy-keys.mjs:59-63`).

Found at ITM-601's stop.

## The reading of the accepted text

MOD-site-frame's `tokenKeyOf` is the one place (MOD-site-frame.md:239), and MOD-review-pages and MOD-settings-pages call
it.
- Both already use MOD-site-frame's interface (MOD-review-pages.md:8-14, MOD-settings-pages.md:8-16). The accepted
  check reads a module's Uses at the level of the module: it reports "a code file's `imports` edge to a module of which
  the file's own module names no interface among its `uses`" (MOD-trace-graph.md:212-213; TST-106805, "the module before
  the dot").
- MOD-browser-store keeps its own `tokenKey` for the keys it converts. It owns the key's format (its Data), and it cannot
  use MOD-site-frame, which uses it (`MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE`).

## Acceptance

- The key is computed by `tokenKeyOf` in MOD-review-pages and MOD-settings-pages, which keep no copy of it;
  MOD-browser-store keeps its own.
- No expected result of a test changes.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The planning run (sprint team1/125).** A stand-in on `main` at `785019f50` has `storedToken` and `tokenSettingKey` call
`tokenKeyOf`, imported from MOD-site-frame's index beside what each file imports from it already.
- 198 test files that name MOD-review-pages, MOD-settings-pages, `tokenSettingKey`, `storedToken`, `tokenKeyOf` or their
  folders: no case fails only with it. `trace-graph-import-uses` (TST-106805) passes with it.
- Reads: none change.
