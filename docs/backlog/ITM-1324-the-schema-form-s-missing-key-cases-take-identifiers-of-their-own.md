---
id: ITM-1324
title: The schema form's missing-key cases take identifiers of their own
level: module
realises:
  - THE NAME IS THE ID AND IT SURVIVES
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-site-frame
builds_on:
tests:
  - unit
origin:
  - po-opus-c's gate Release testing → Sprint review of sprint 128 (docs/gates/20261030-1930-release-testing-sprint-review-e128.md, Noted), and team1's sprint 128 Review (docs/backlog/sprints/team1/128.md)
---
# ITM-1324 The schema form's missing-key cases take identifiers of their own

**REGISTER**

## Outcome

TST-1290001 and TST-1290002 are each declared by two test cases:
- `tests/site-frame-preloads.test.mjs`, since `66afb81ff` (2026-10-24), the first to hold them;
- `tests/site-frame-schema-form-missing-key.test.mjs`, ITM-1290's, since `6b6d0a01d` (2026-10-29).

A reference to either names two cases. The later file gives way. With this item, its two cases take TST-1290011 and
TST-1290012 on their declaration lines (`:43` and `:59`), the only places the file names them.

`site-frame-preloads` keeps TST-1290001 to 1290003, which ITM-1267 and ITM-1319 name.

Records stay as they are (A RECORD IS EVIDENCE, NOT A PROPOSAL). Sprint 119's Review and
`docs/gates/20261029-1501-development-release-testing-bcb0.md` name ITM-1290's cases by the old identifiers, as they
stood then.

## Readiness

It is ready. It changes two declarations of one test file, and no case body or expected result. The history was
searched: no commit names TST-1290011 or TST-1290012, and the same search finds the commits of TST-1290003, its known
positive.

## Acceptance

- MOD-test-document's `testDeclarations`, over every test file of the repository, finds TST-1290001 and TST-1290002
  once each, in `tests/site-frame-preloads.test.mjs`.
  - Known positive: on the base the same reading finds each twice.
- The file's reader gives 0 findings, and every case passes as before.
- One commit, which holds only the file. CI is green on it.
- ITM-1321's repository-wide case then finds no repeat on `main`.
