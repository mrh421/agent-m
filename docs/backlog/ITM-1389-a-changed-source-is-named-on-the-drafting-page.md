---
id: ITM-1389
title: A changed source is named on the drafting page
level: module
realises:
  - UC-005
  - A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
modules:
  - MOD-review-pages
builds_on:
  - ITM-579
tests:
  - unit
origin:
  - TST-579204 of ITM-579's system tests of UC-005 (#1681), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1611-development-release-testing-0579.md)
---
# ITM-1389 A changed source is named on the drafting page

**REGISTER**

## Outcome

UC-005 1a says: when "the file's hash differs from the one recorded for the linked version", nothing is sent, and "Agent M
says that the content changed and that a new version must be registered (UC-016)". MOD-source-register's `content` throws
`HashMismatch { file, expected, actual }` "so that a changed file is caught before anything is derived from it". The
requirements' drafting page (`<k>/draft` of MOD-review-pages, "the linked source and … the files of its version") lets the
error fall to MOD-site-frame's `readProblem`. That shows it as a fault of the page: `This page could not be drawn: <path>
has the SHA-256 …`. No sentence says that the content changed or that a new version is to be registered.

## The reading taken

MOD-review-pages' `<k>/draft` route reads the linked source for a derivation of requirements and serves UC-005. So it
names a `HashMismatch` of that read itself, with the file, and links registering a new version (UC-016). The module text
assigns the route but does not list these words, and this is noted for akmaier at the gate. MOD-site-frame's
`readProblem` does not change.

## Acceptance

- With a linked source whose stored file no longer matches its recorded SHA-256, the drafting page sends nothing. It names
  the file, says that its content changed and that a new version must be registered, and links registering it.
- TST-579204 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
