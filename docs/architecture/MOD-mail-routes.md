---
id: MOD-mail-routes
title: One mailbox interface over Microsoft Graph and over the Bridge
folder: src/mail-routes/
realises:
follows:
  - ARC-044
  - ARC-053
  - ARC-051
uses:
  - MOD-bridge-client.mailCall
  - MOD-mail-records.mailId
  - MOD-text-tools.sha256
  - MOD-identifiers.instanceOfPagesAddress
  - MOD-identifiers.pagesAddress
provides:
  - routeFor
  - signIn
  - mailbox
  - providerLinks
  - Mailbox
  - MailConnection
  - Mail
  - Draft
  - DraftRef
  - ShownMail
---
# MOD-mail-routes One mailbox interface over Microsoft Graph and over the Bridge

## Responsibility

It belongs to Issues and mail (ARC-044). It reaches a mailbox through one interface, `Mailbox`, with two routes as
plug-ins (`A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE`): a Microsoft 365 mailbox directly
from the page through Microsoft Graph, opened by Microsoft's own sign-in (ARC-053); every other mailbox — Gmail included
— through Access's Bridge client to the Bridge its connection names, which speaks IMAP and SMTP (ARC-051,
MOD-mail-protocols). On both routes
reading changes nothing in the mailbox, a reply waits as a draft in the mailbox's Drafts folder, and a draft is sent only
as the exact mail a person was shown. It runs in the browser.

## Parts

- `index.mjs` — the interface: `routeFor`, `signIn`, `mailbox`, `providerLinks`.
- `graph-route.mjs` — the Microsoft Graph route.
- `bridge-route.mjs` — the IMAP and SMTP route through the Bridge.
- `errors.mjs` — the module's failures, each an error with the name and fields this file gives it, shared by both
  routes.
- `providers.json` — the servers of known providers, Gmail's among them, preset on the IMAP route.
- `vendor/msal-browser.min.js` and its licence — Microsoft's sign-in library (ARC-053).
- `vendor/postal-mime/` and its licence — the mail parser's ECMAScript modules, for mails Microsoft Graph returns in their
  raw form (ARC-051).

## Data

It keeps nothing of a mail: a mail's text, sender, reply address and attachments exist only in memory while a page shows
them (`MAIL STAYS IN THE MAILBOX`). It owns the format of a mailbox connection, which Access keeps in this browser
(MOD-browser-store) and nowhere else:

```json
{
  "address": "reports@example.org",
  "route": "graph",
  "folders": ["INBOX", "Reports"],
  "places": [
    { "place": "this machine", "outsideEu": false },
    { "place": "a provider in the USA", "outsideEu": true, "notCompliantNoted": true }
  ],
  "graph": { "clientId": "the app registration's client identifier", "account": "reports@example.org" },
  "imap": {
    "bridge": "lab-pc",
    "jumpHostNoted": true,
    "imap": { "host": "imap.example.org", "port": 993, "security": "tls" },
    "smtp": { "host": "smtp.example.org", "port": 587, "security": "starttls" },
    "account": "reports@example.org",
    "password": "…"
  }
}
```

`folders` are read and searched — `INBOX` unless others are named; `places` are the processing places to which this
mailbox's mails may be given (`THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED`), a place outside the EU recorded with
the fact that the person saw the notice; `graph` belongs to the web-API route, `imap` to the Bridge route, and only one of
them is present. On the Bridge route, `bridge` names the Bridge the connection goes through, by the name under which the
browser keeps it, and `jumpHostNoted` records that the person acknowledged, before saving, that the jump host can read
the password and the mails, where that Bridge is reached through the jump host (`A MAILBOX THROUGH THE JUMP HOST IS NAMED
AS READABLE THERE`). `account` is the login on both servers, unless the connection names `smtpAccount`, the login on
the SMTP server. A mail the connection drafts and sends is from `account`, unless the connection names `sender` — `{
name: string | null, address: string }` —, from which it is then sent, with the connection's `address` as its
`Reply-To` where `sender.address` differs from it (UC-037). The password is stored only after its own notice was acknowledged on the page (`THE MAILBOX PASSWORD
IS STORED ONLY AFTER ITS OWN DISCLOSURE`). The tokens of the Graph route are not part of the connection: Microsoft's library
keeps them in its own cache in `localStorage`, whose keys Access lists among the browser's settings and removes on a clear
(ARC-053).

## Interfaces

- `MailConnection` — the connection above.
- `Mail` — `{ id: string, messageId: string | null, inReplyTo: string | null, references: string[], from: Address,
  replyTo: Address[], to: Address[], cc: Address[], subject: string, date: string, text: string, attachments: { name:
  string, type: string, size: number, text: string | null }[], folder: string }`, where `Address` is `{ name: string |
  null, address: string }` and `id` the `MAIL-` identifier of MOD-mail-records. A `Mail` is never written anywhere.
- `Draft` — `{ replyTo: Mail, to: Address, subject: string, body: string }`: a reply to one mail, addressed to one
  reporter only (`A REPLY GOES TO ONE REPORTER`); the route sets `In-Reply-To` and `References` from the mail's
  `Message-ID` (`A REPLY IS THREADED ON THE REPORTER'S MAIL`).
- `DraftRef` — `{ route: "graph", id: string } | { route: "bridge", uid: number, uidValidity: number }`: a draft in the
  mailbox's Drafts folder.
- `ShownMail` — `{ ref: DraftRef, sha256: string, from: Address, to: Address[], cc: Address[], subject: string, body:
  string, attachments: { name: string, type: string, size: number }[] }`: the complete mail as the person was shown it,
  and the SHA-256 of its bytes as stored in Drafts (`EVERY OUTGOING MAIL IS RELEASED BY A PERSON`).
- `routeFor(address: string) -> Promise<{ route: "graph" | "imap", servers: object | null, reason: string }>` — the
  route to preselect for a mail address: it asks Microsoft's sign-in service, the provider's one origin the page names,
  whether the address's domain belongs to a Microsoft 365 organisation; a domain of a known provider presets the IMAP
  route with its servers from `providers.json`. Crosses the network; when Microsoft's service cannot be reached, it
  answers the IMAP route with the reason, and the person may change it.
- `signIn(clientId: string, address: string | null) -> Promise<{ account: string }>` — Microsoft's sign-in in Microsoft's
  own window, asking for exactly `Mail.ReadWrite`, `Mail.Send` and `offline_access` and nothing else (`THE MAIL SIGN-IN
  ASKS ONLY FOR READING, DRAFTING AND SENDING`), through the authorisation-code flow with PKCE (ARC-053), at the
  institution's own tenant, `https://login.microsoftonline.com/<domain of the mail address>`, where its administrators
  registered Agent M. Microsoft
  returns its single-use authorisation code in the address of its own window when that window comes back to the
  instance's page; the code grants nothing without the PKCE verifier, which never leaves the page, and is exchanged once.
  No token is ever placed in an address or link (`A CREDENTIAL IS NEVER PLACED IN A URL`); a token goes only into the
  authorisation header of requests to Microsoft Graph (`THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER`). Crosses the
  network. Errors: `PopupBlocked`, `SignInCancelled`, `PermissionDeclined` with the permission declined,
  `RegistrationRefused` with Microsoft's message — the client identifier or the return address is not registered —,
  `Unreachable`.
- `mailbox(connection: MailConnection, bridge: Bridge | null) -> Mailbox` — the mailbox on the connection's route;
  `bridge` is Access's Bridge from `bridgeAt` for the Bridge the connection names, and is needed only on the Bridge route.
  Errors: `BridgeNeeded` on the Bridge route without one.
- `Mailbox` — the one interface over both routes. Every operation crosses the network — to Microsoft Graph, or to the
  Bridge and from there to the mail servers — and fails with `SignInExpired` (sign in again; Microsoft's refresh tokens
  for a single-page application expire after a day, ARC-053), `PermissionDeclined`, `Throttled` with the time to wait,
  `Unreachable` with the reason, `BridgeUnavailable` with the reason Access names (not running, wrong address, token
  missing or refused, blocked by the browser), and, on the Bridge route, the Bridge's `NoEncryption` naming the server
  that offers no TLS — no login was sent to it —, `LoginRefused` with the server's answer, and `FolderNotFound`.
  - `test() -> Promise<{ counts: Record<string, number>, drafts: boolean, sent: boolean, sending: "works" | string,
    route: string, encryption: string }>` — the number of mails in each named folder, whether Drafts and Sent were
    found, and whether sending works — on the Bridge route an SMTP login over TLS that sends nothing —; changes nothing.
  - `read(since: string | null) -> Promise<Mail[]>` — the mails of the named folders, read without changing anything:
    nothing marked as read, moved, flagged or deleted (`READING THE MAILBOX CHANGES NOTHING IN IT`).
  - `find(id: string) -> Promise<Mail | null>` — the mail with this `MAIL-` identifier in the named folders, found by
    hashing their mails' `Message-ID`s; `null` — *not found in the mailbox* — when none matches, never a guess (`A MAIL
    IS FOUND AGAIN BY ITS IDENTIFIER`).
  - `drafts() -> Promise<{ ref: DraftRef, inReplyTo: string | null, mail: Mail }[]>` and `sent(since: string | null) ->
    Promise<Mail[]>` — the mailbox's Drafts and Sent folders, recognised by the mailbox's own markings.
  - `storeDraft(draft: Draft) -> Promise<DraftRef>` — the reply stored in Drafts and nowhere else (`A REPLY DRAFT IS KEPT
    IN THE MAILBOX'S DRAFTS FOLDER`). Errors: `NoReplyAddress` when the mail's reply address is missing or invalid.
  - `updateDraft(ref: DraftRef, draft: Draft) -> Promise<DraftRef>` — an edit saved to the draft.
  - `showDraft(ref: DraftRef) -> Promise<ShownMail>` — the draft as it is stored, complete, with the SHA-256 of its bytes.
  - `sendDraft(shown: ShownMail) -> Promise<{ sentAt: string }>` — sends the draft only if its bytes still have the
    SHA-256 of the mail shown. On the Graph route the provider sends it, keeps the copy in Sent and removes the draft; on
    the Bridge route the call first obtains the Bridge's single-use confirmation for that SHA-256 and then sends with it,
    and the Bridge sends over TLS, keeps the copy in Sent and removes the draft (`THE BRIDGE SENDS ONLY WITH A
    CONFIRMATION OF THE MAIL SHOWN`). Errors: `DraftChanged` — nothing sent, the draft is shown again —,
    `ConfirmationRefused` with the reason — missing, spent, expired, or for other bytes —, `SendRefused` with the
    server's answer.
- `providerLinks() -> { appRegistration: string, accessWithdrawal: string }` — the addresses of Microsoft's page for
  registering the app (UC-037) and of its page on which the app's access is withdrawn after a disconnect.

## Files

It reads `providers.json` and its vendored libraries. It writes no repository file and keeps no `localStorage` key of its
own: the connection is written by Access, the sign-in library's cache under the keys Access lists.

## Uses

- `MOD-bridge-client.mailCall` — every operation of the Bridge route, on the Bridge the connection names, with the
  connection and its password in the body of that one request (`THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE
  BRIDGE`).
- `MOD-mail-records.mailId` — the identifier of each mail read on the Graph route, and the search of `find`.
- `MOD-text-tools.sha256` — the SHA-256 of a draft's bytes on the Graph route, compared before it is sent.
- `MOD-identifiers.instanceOfPagesAddress`, `MOD-identifiers.pagesAddress` — the address Microsoft's sign-in window
  returns to on the Graph route: the Pages address of the instance whose page it is, as the app registers it (UC-037).
