---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6bed7a02919faec3b26e6f5a19f4805278b45eb8
  - https://github.com/akmaier/agent-m/pull/1773
date: 2026-11-03 15:21 UTC
---
# Development → Release testing: the shared-mailbox repair, #1773

**REGISTER**

## Reason

The repair of an Exchange shared mailbox on the IMAP route may go into `main`. It is #1773 (`repair/shared-mailbox` →
`main`) at `6bed7a029`, outside any sprint, at akmaier's direction ("This is not scrum, but emergency repair"). It builds
the texts he accepted today: UC-037, UC-039, MOD-mail-routes, MOD-mail-protocols and MOD-settings-pages (`6e411e9b6`,
`8027a9b14`). developer-opus-e wrote both commits (trailers). I wrote none of it.
1. **The first commit holds only tests and is red for the repair's reason.** In run 41661386716, `721c9e21d` fails only
   its six new cases: TST-1771001 to 1771003 in `mail-protocols-send`, and TST-1771005 to 1771007 in
   `settings-pages-mailbox-imap`. TST-1771004, the known positive, passes.
2. **CI is green on the head:** run 41662141126 (`6bed7a029`), at attempt 1, with UC-037's and UC-039's system and release
   tests. `git merge-tree` with `origin/main` (`8027a9b14`) is clean.
3. **Only the modules the accepted texts change are touched.** The code changes are in `src/mail-protocols/`,
   `src/settings-pages/mailbox.mjs` and a type comment in `src/mail-routes/index.mjs`; the rest is tests. No other
   module's test and no release test changes.
   - SMTP logs in with `smtpAccount` where it is set, else with `account` (`smtp.mjs:8`).
   - A draft is From the sender, with Reply-To the connection's address where the two differ (`index.mjs`).
   - The envelope's sender is the sender's address, else the account (`sendBytes`).
   - The mailbox page offers the three fields, stores each only when it is filled, and shows them again. TST-472777
     stands as the known positive: a connection without the new fields is stored exactly as before.
4. **The new tests name their use cases, requirements and modules.** The pull request records nine counter-proofs.
5. **The accepted texts hold, as far as reading the change and its tests shows.**

opus-e read the binding documents, chapters 9, 11, 12 and 13 and the five accepted texts in full.

## Ruled

- **opus-e's readings stand:**
  - `smtpAccount` and `sender` sit in the IMAP part beside `account`;
  - the Graph route is unchanged;
  - "differs" means the strings are not equal;
  - an empty field stores no key;
  - a display name without an address stores no sender.
- **Outside the backlog.** The repair names no backlog item, at akmaier's direction for an emergency repair. Its texts are
  accepted, and its code reaches `main` through a pull request with green CI
  (`CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI`).
- **A gap noted.** MOD-mail-routes' example connection does not show the new fields; the type names them. It is noted for
  the next module-text draft, not registered.
