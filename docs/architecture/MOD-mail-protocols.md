---
id: MOD-mail-protocols
title: IMAP and SMTP in the Bridge, one request at a time
folder: src/mail-protocols/
realises:
follows:
  - ARC-040
  - ARC-051
uses:
  - MOD-bridge-http.bridgeApi
  - MOD-bridge-http.BridgeHandlers
  - MOD-mail-routes.Mail
  - MOD-mail-routes.Draft
  - MOD-mail-routes.DraftRef
  - MOD-mail-routes.ShownMail
  - MOD-mail-records.mailId
  - MOD-text-tools.sha256
provides:
  - mailHandlers
---
# MOD-mail-protocols IMAP and SMTP in the Bridge, one request at a time

## Responsibility

It belongs to the Bridge (ARC-040). It answers the mail routes of the Bridge's API for every mailbox that is not on
Microsoft 365 — Gmail included —, speaking IMAP and SMTP to the mailbox's servers (`A MAILBOX IS REACHED THROUGH ITS
PROVIDER'S WEB API OR THROUGH THE BRIDGE`) with the libraries ARC-051 adopts: imapflow, nodemailer and postal-mime. It
sends a login only over TLS, reads without changing anything, holds the password only for the request that carried it,
and sends a mail only with the single-use confirmation of the exact mail a person was shown. It runs in Node, in the
Bridge's main process.

## Parts

- `index.mjs` — the interface: `mailHandlers`.
- `imap.mjs` — reading folders, finding a mail, Drafts and Sent, storing a draft.
- `smtp.mjs` — sending a draft's bytes.
- `confirmations.mjs` — the single-use confirmations.

## Data

It keeps no mail, no password and no connection: everything a request carried is dropped when its answer is given
(`THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST`), and nothing of it is logged — the libraries' own logging
stays off (ARC-051). The only state across requests is the open confirmations: each `{ value, ref, sha256, expiresAt,
spent }`, in memory only, valid for minutes and spent by one `send`; a restart of the Bridge forgets them, and the page
asks again.

## Interfaces

- `mailHandlers` — the handlers of the `mail` routes of `bridgeApi`, of MOD-bridge-http's type `BridgeHandlers`. Each
  takes the connection — servers, ports, encryption, account, SMTP account and sender where named, password, named
  folders — from the request and the operation's arguments, logs in to each server with the account MOD-mail-routes'
  `MailConnection` gives it, builds and sends every draft from the sender it gives, the SMTP envelope included, and answers in the fields of MOD-mail-routes' `Mail`, `Draft`, `DraftRef` and `ShownMail`. Every
  operation crosses the network to the mail servers and fails with `no-encryption` naming the server when it offers
  neither implicit TLS nor STARTTLS — no login is sent to it (`THE MAIL SERVER IS REACHED ONLY OVER TLS`) —,
  `login-refused` with the server's answer, `not-found` for a named folder that does not exist, and `upstream-failed`
  with the server's message.
  - `test` — logs in to the IMAP server, opens each named folder read-only and counts its mails, recognises Drafts and Sent
    by their special-use markings, logs in to the SMTP server and disconnects without sending.
  - `read` — the mails of the named folders, each opened read-only so that nothing is marked as read, moved, flagged or
    deleted (`READING THE MAILBOX CHANGES NOTHING IN IT`), parsed into `Mail`s, each with its `MAIL-` identifier.
  - `find` — the mail of one identifier in the named folders, found by hashing the `Message-ID`s their envelopes carry;
    *not found* when none matches (`A MAIL IS FOUND AGAIN BY ITS IDENTIFIER`).
  - `drafts`, `sent` — the folders the mailbox marks as Drafts and Sent.
  - `store-draft`, `update-draft` — a reply built as one message with `In-Reply-To` and `References` from the reporter's
    `Message-ID` and that reporter as its only recipient, appended to Drafts (`A REPLY DRAFT IS KEPT IN THE MAILBOX'S
    DRAFTS FOLDER`); an update replaces the Bridge's own draft.
  - `show-draft` — the draft's bytes as stored, their SHA-256, and the draft parsed into a `ShownMail`.
  - `confirm-send` — a single-use confirmation for one draft and one SHA-256.
  - `send` — reads the draft's bytes from Drafts again, and sends them only when their SHA-256 is the one the
    confirmation names and the confirmation is neither spent nor expired; the very bytes shown go out over TLS, a copy is
    appended to Sent, and the draft is removed from Drafts. A second request with the same confirmation sends nothing.
    Errors: `confirmation-refused`; `upstream-failed` with the SMTP server's answer — then the draft stays.

## Files

It reads and writes no file. On the mail servers it appends and removes only the Bridge's own drafts and appends to Sent;
it never changes, moves or deletes a mail it read.

## Uses

- `MOD-bridge-http.bridgeApi`, `MOD-bridge-http.BridgeHandlers` — the routes it answers and their errors.
- `MOD-mail-routes.Mail`, `Draft`, `DraftRef`, `ShownMail` — the fields the page's mail route and this handler share.
- `MOD-mail-records.mailId` — the identifier of every mail, and the search of `find`.
- `MOD-text-tools.sha256` — the SHA-256 of a draft's bytes, shown and confirmed.
