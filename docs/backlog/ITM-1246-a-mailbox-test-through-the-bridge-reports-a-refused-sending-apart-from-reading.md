---
id: ITM-1246
title: A mailbox test through the Bridge reports a refused sending apart from reading
level: module
realises:
  - UC-037
modules:
  - MOD-mail-protocols
builds_on: []
tests:
  - unit
origin:
  - tester-opus-mail's system tests of UC-037 (ITM-433, pull request #1372, merged in 4b194a52), finding TST-433713
---
# ITM-1246 A mailbox test through the Bridge reports a refused sending apart from reading

**REGISTER**

## Outcome

UC-037 7d: "Reading works, sending does not. Agent M shows both results separately; reading (UC-038) is possible, sending
(UC-039) is not". MOD-mail-routes' `test()` answers `{ counts, drafts, sent, sending: "works" | string, … }`, "whether
sending works — on the Bridge route an SMTP login over TLS that sends nothing" (MOD-mail-routes.md:131-133), and the
Bridge's handlers answer "in the fields of MOD-mail-routes'" types (MOD-mail-protocols.md, Interfaces).

The Bridge does otherwise: `testMailbox` (`src/mail-protocols/index.mjs:10-15`) awaits `testSmtp` after the IMAP test, so a
refused SMTP login rejects the whole test with `login-refused`, and where it passes the answer's `sending` is always the
literal `"works"`. The mailbox page then shows only "The mail server refused the login", with no folder counts and no
separate sending result (TST-433713, `tests/system-uc-037-connect-mailbox.test.mjs`, marked todo as a finding).

The test answers the IMAP results and, where the SMTP step fails with `login-refused` or `upstream-failed`, `sending` is
the server's answer; the IMAP step's failures, and the SMTP step's `no-encryption` (no login is sent: `THE MAIL SERVER IS
REACHED ONLY OVER TLS`, UC-037 7c), still fail the test as they do.

## Acceptance

- Unit tests naming MOD-mail-protocols, against the local test servers of `tests/mail-protocols-fixture.mjs`: an SMTP
  server refusing the login gives the counts and `sending` with the server's answer; both servers working give `sending:
  "works"`; an IMAP login refused still fails with `login-refused`; an SMTP server without TLS still fails with
  `no-encryption` and receives no login. Counter-proof: before the change the first rejects with `login-refused`.
- TST-433713's todo mark is removed, and it passes.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/mail-protocols/`, the tests that name MOD-mail-protocols and the todo mark of TST-433713 change.
