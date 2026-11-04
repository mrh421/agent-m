---
id: ITM-1361
title: The library shows each version's files with their SHA-256
level: module
realises:
  - UC-004
  - A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
modules:
  - MOD-settings-pages
builds_on:
  - ITM-370
tests:
  - unit
origin:
  - finding UC004-S1 of ITM-370's system test TST-370213 (#1631), ruled by the Product Owner of team1's sprint 141
---
# ITM-1361 The library shows each version's files with their SHA-256

**REGISTER**

## Outcome

UC-004's postcondition: "The library lists the source with kind, authority, licence and at least one version, each version
with identifier, date and the SHA-256 of every file read." MOD-settings-pages' `library/<source>` gives "a source's
versions" (MOD-settings-pages.md:218). The page shows a version's content only as "stored" or "not stored"
(`src/settings-pages/library.mjs:98`, `entryView`), and no page shows a file's SHA-256.

## Acceptance

- `library/<source>` lists each version with its identifier, its date and, for each file read, its path and SHA-256, as
  the register entry holds them.
- TST-370213 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
