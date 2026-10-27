---
id: ITM-1249
title: The replies page says when the mailbox's last test found sending not working
level: module
realises:
  - UC-037
  - UC-039
modules:
  - MOD-settings-pages
  - MOD-maintenance-pages
builds_on:
  - ITM-1246
tests:
  - unit
origin:
  - tester-opus-mail's system tests of UC-037 (ITM-433, #1372), finding TST-433714; the architecture bccacd28, accepted in 6c0aa1ab
---
# ITM-1249 The replies page says when the mailbox's last test found sending not working

**REGISTER**

## Outcome

UC-037 7d: "the dashboard says so where a reply would be sent." As accepted: the record `last-test:<key>` is
`{ at, outcome, tools?, sending? }`, `sending` the string MOD-mail-routes' `test()` gives (MOD-browser-store); each test of the
mailbox stores it (MOD-settings-pages, route `mailbox`); where the mailbox's last test recorded a `sending` other than
"works", the route `replies` says so, with that reason, beside *Send* and *Send and wait*, and offers both as before; a record
without `sending` says nothing about sending (MOD-maintenance-pages).

The code does otherwise: the mailbox page writes `{ at, outcome }` only (`src/settings-pages/mailbox.mjs:143`, `:409`, `:457`),
and `src/maintenance-pages/replies.mjs` reads no test record. TST-433714 (`tests/system-uc-037-connect-mailbox.test.mjs`) is
marked todo as a finding.

## Acceptance

- Unit tests naming MOD-settings-pages: each test of the mailbox stores the `sending` its `test()` gave, and a test that threw
  stores none. Unit tests naming MOD-maintenance-pages: with a recorded `sending` other than "works", the reason is shown
  beside *Send* and *Send and wait*, both still offered; with "works" or no `sending`, nothing is said. Counter-proof: before
  the change the record holds no `sending` and the page says nothing.
- TST-433714's todo mark is removed, and it passes.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/settings-pages/`, `src/maintenance-pages/`, the tests that name these modules and the todo mark of TST-433714 change.
