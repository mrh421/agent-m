---
id: ITM-1302
title: Every test identifier is held by one declaration
level: module
realises:
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-agent-processes
  - MOD-site-frame
  - MOD-endpoint-calls
  - MOD-identifiers
  - MOD-implementation-pages
  - MOD-prompt-bar
  - MOD-job-ledger
  - MOD-runtimes
  - MOD-job-runner
  - MOD-mail-handling
  - MOD-repository-hosts
  - MOD-spec-document
  - MOD-trace-graph
  - MOD-spec-changes
  - MOD-main-page
builds_on:
  - ITM-1297
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1297 (PR #1413), docs/gates/20261029-0722-development-release-testing-e535.md
---
# ITM-1302 Every test identifier is held by one declaration

**REGISTER**

## Outcome

MOD-test-document's reader, over every test file under `tests/` (fixtures left out), finds 17 identifiers that two
declarations hold:
- TST-1225001 and 1225002: `agent-processes-prompt-delivery`, `site-frame-test-topics`;
- TST-1206001: `endpoint-tool-loop`, `site-frame-tests-menu`;
- TST-472244: `identifiers-kind`, `identifiers-next`;
- TST-1300005: `implementation-pages-plan-stored-graph`, `prompt-bar-spawn-reads`;
- TST-472718: `job-ledger-append`, `runtimes-tab`;
- TST-472335: twice in `job-runner-prepare`;
- TST-1110001 and 1110002: `mail-handling-release`, `repository-hosts-pull-requests`;
- TST-1201001: `prompt-bar-offer`, `test_requirement_fields.py`;
- TST-1300001 to 1300003: `prompt-bar-spawn-reads`, `trace-graph-latest`;
- TST-1300004: `prompt-bar-spawn-reads`, `trace-graph-publish`;
- TST-472541: `repository-hosts-file-pages`, `repository-hosts-history`;
- TST-677005: `spec-changes-accept-batched`, `spec-changes-queues-batched`;
- TST-1281001: `places-prepare-every-offered-kind` (added in `dbf9956a`), `main-page-home-instance` (added in `e08b9c56`,
  ITM-1281).

EVERY ARTIFACT HAS AN IDENTIFIER gives each artifact one of its own (SPEC.md:52-54). In each pair, the declaration added
later, by the version history, takes a new identifier that no current file and no history holds (THE NAME IS THE ID AND IT
SURVIVES). The earlier one keeps its own. One exception applies: where a record names the identifier with one
declaration, that declaration keeps it and the other takes a new one. A record is never changed, and a counter-proof
record under `docs/tests/counter-proofs/` is read by its identifier. That is the case for TST-1225001 and 1225002,
whose records name `agent-processes-prompt-delivery`'s cases (commit `9482a66b`).

## Acceptance

- Over every test file under `tests/`, the reader finds no identifier held by two declarations. The pull request names the
  run, and a known positive: a planted second declaration of one identifier is found.
- Each renumbered declaration is named in the pull request, with its old and new identifier and the commit that added it.
- Only a renumbered identifier changes, wherever its own file names it, and no expected result. That covers the
  declaration's first line, the test's title where it begins with the identifier (as in `site-frame-test-topics`), and
  another case's `given:` or counter-proof that names it (as in `prompt-bar-spawn-reads` and `site-frame-tests-menu`).
  CI is green on every commit (refactoring).
- Tests of other modules this Outcome changes: only the test files listed above, each named by one of the item's modules.
- The planning run was made on `main` at `b40c5059d`.
  - **Before:** a reader over every test file under `tests/`, fixtures and Markdown left out, finds 5,531 identifiers, 17
    of them held twice.
  - **With the change applied:** each later file of the list renamed every naming of its identifier to a free one, and
    `job-runner-prepare` renamed its second declaration. The reader then finds 1 held twice: TST-1281001, then not yet
    on the list.
  - **Tests run:** the 20 Node test files that declare the first 16 identifiers, the two that name one of them by its path
    (`repository-hosts-read-file-at`, `runtimes-tab-endpoint-tools`), `test-document-one-line` and
    `test-document-declarations`, 191 pass and 0 fail; the Python checks of the test corpus and `test_requirement_fields`
    are OK.
  - For TST-1281001, `main-page-home-instance` was renamed alike. It and `release-itm-1281-start-page-instance-reads`,
    which names it by its path, give 7 pass and 0 fail.
  - No other file names one of the identifiers, outside records.
