---
id: ITM-1363
title: A registered source's entry carries its title line
level: module
realises:
  - UC-004
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-settings-pages
builds_on:
  - ITM-370
tests:
  - unit
origin:
  - developer-opus-f's note in ITM-370's pull request (#1631), ruled by the Product Owner of team1's sprint 141
---
# ITM-1363 A registered source's entry carries its title line

**REGISTER**

## Outcome

The source schema gives an entry's title line as `# {id} {title}` (`src/source-register/source.schema.md:45`), as the
instance's own entries have it (`docs/sources/SRC-vibe-coding.md:8`). An entry that *+ Register source* writes starts
with a bare `#`, and `documentFindings` reports nothing for it.

## Acceptance

- An entry that the page writes, on every route, has the title line `# <its id> <its title>` of the source schema.
- MOD-documents' text gives `documentFindings` a finding for the title (MOD-documents.md:276-284), which
  `src/documents/checks.mjs` does not check yet. That check is ITM-1366, an item of its own; this item changes no file of
  MOD-documents.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
