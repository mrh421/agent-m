---
id: ITM-1235
title: The earlier version's subject carries the open requirement
level: module
realises:
  - UC-019
  - UC-049
modules:
  - MOD-trace-pages
builds_on: []
tests:
  - unit
origin:
  - the check of the documents akmaier accepted since 2026-10-25 against the code: MOD-trace-pages (:131) gives the open requirement as subject on the earlier version shown while the head's graph is stored; the code gives none there
---
# ITM-1235 The earlier version's subject carries the open requirement

**REGISTER**

## Outcome

MOD-trace-pages (:131): on the default branch, also on the earlier version shown while the head's graph is stored, the
specification view's subject is the open requirement with the kind `change-requirements`, the person's own source and
the `draft` route. `src/trace-pages/subject.mjs:99-100` decides by `shown.onDefaultBranch`, which is false on that
earlier version (`src/trace-pages/flow.mjs:881,893`), so no requirement, source or draft route is given there.

## Acceptance

- A unit test naming MOD-trace-pages: with the head's graph not yet stored and a requirement open, the subject carries
  `change-requirements`, the requirement, the source and the `draft` route. Counter-proof: before the change it does not.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/trace-pages/` and the tests that name MOD-trace-pages change.
