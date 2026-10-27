---
id: ITM-385
title: An EU legal text fetched, and a new version of a source
level: module
realises:
  - UC-004
  - UC-016
  - AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
  - A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
  - A SOURCE VERSION IS NEVER OVERWRITTEN
  - A LIVING SOURCE IS PINNED
modules:
  - MOD-source-register
builds_on:
  - ITM-313
  - ITM-314
tests:
  - unit
origin:
  - UC-004 step 7, 7a
built_by:
  - 97a26d7aba3041b909e2d3f1424595c28ad95a2a
  - cc0ebe252d4b1b86ff4dbbc938a864d99ca799d8
---
# ITM-385 An EU legal text fetched, and a new version of a source

**REGISTER**

## Outcome

MOD-source-register's `fetchLegalText(identifier)` and `versionCommits(entry, files, version)`, as its file states them:
in Node, the official text of a CELEX number or ELI from the EU's publication repository, with its retrieval date and
the repository's version identifier, `NotFound` and `Unreachable` by name and nothing guessed; and a new version
appended to an entry with its files' SHA-256 and the version's hash, `SameBytes` when it equals an existing version.
What an entry waiting for its fetch is, the entry whose `identifier` `recogniseLegalText` recognises and whose versions
are empty, is derived and never written. The instance's workflow entry (ITM-401) calls them.

## Acceptance

- Unit tests that name MOD-source-register state, before the code exists, with the publication repository replaced by a
  fixture server: a text fetched with its date and version identifier; `NotFound` and `Unreachable`; a version appended
  with its hashes, the earlier versions byte for byte unchanged; `SameBytes`; an entry waiting for its fetch told from
  one that has a version.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/source-register/` and the tests that name MOD-source-register change.
