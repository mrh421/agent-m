---
id: ITM-1228
title: The menu marks the entry of the page shown
level: module
realises:
  - THE MENU FOLLOWS THE PROCESS
  - UC-030
modules:
  - MOD-site-frame
  - MOD-trace-pages
builds_on:
  - ITM-1224
  - ITM-1226
tests:
  - unit
origin:
  - akmaier: on Tests → Browser and Tests → Audit the menu does not mark Tests; the architecture accepted in dbf085da and e29667de
---
# ITM-1228 The menu marks the entry of the page shown

**REGISTER**

## Outcome

The menu marks, and the prompt bar's subject carries, the entry of the page shown, as MOD-site-frame's `Route` now states
it: the route's `entryShown(params)` where it gives one and it is not `null`, else the route's `entry`. Today the frame
uses the route's `entry` alone (`src/site-frame/index.mjs:358`, `src/site-frame/subject.mjs:24,31`), and the live page's
app looks the entry up by view name in `src/site/menu.mjs` (`src/site-frame/dashboard-app.mjs:752`, and the bar's subject
at `:1014`), which knows no `trace`. MOD-trace-pages' route `trace` (`src/trace-pages/flow.mjs:826`) gives `entryShown`
from the `entry` of the descriptor its `key` names (`src/trace-pages/views.mjs`), `null` where it names none. Then
`#trace/key=tests…` and `#trace/key=audit…` mark Tests, `#trace/key=modules…` marks Architecture, and the specification
and the gaps mark Requirements, on the frame's pages and on the live page. `menuOf`, which counts only `entry` as served,
and the route a fragment naming only an entry opens, stay as they are.

## Acceptance

- Unit tests naming MOD-site-frame: a route with `entryShown` is marked, and its subject's `entry` set, by what it
  returns; by its `entry` where it returns `null` or gives none; `menuOf` is unchanged. Unit tests naming
  MOD-trace-pages: the route's `entryShown` for each key, and `null` for an unknown one. A test of the live page's app:
  `#trace` with `key` `tests` marks Tests. Counter-proof: before the change each of these marks Requirements, or nothing.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/site-frame/`, `src/trace-pages/` and the tests that name these modules change; preloads, where a new file
  needs them, are regenerated in a commit of their own.
