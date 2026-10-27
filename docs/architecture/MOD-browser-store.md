---
id: MOD-browser-store
title: One person's configuration in their browser
folder: src/browser-store/
realises:
follows:
  - ARC-047
  - ARC-053
uses:
provides:
  - Store
  - SettingKey
  - SettingInfo
  - ExportFile
  - StoreError
  - openStore
  - readSetting
  - writeSetting
  - clearSetting
  - clearEverything
  - listSettings
  - exportSettings
  - importSettings
  - readExport
  - expiringSoon
  - secretValues
  - readTabValue
  - writeTabValue
---
# MOD-browser-store One person's configuration in their browser

## Responsibility

It belongs to Access (ARC-047). It keeps everything that belongs to one person on one browser — tokens with their
expiry, the list of products, endpoints and their keys, each Bridge under its name with its address or its port on the
jump host and its token, the mailbox connection, the jump host, the mails marked *not an issue*, the notifications of what waits for acceptance and what they
notified — in that browser's `localStorage` and nowhere else
(`CONFIGURATION LIVES IN THE BROWSER`, `CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE`); it knows every key it
writes, so that each can be shown, tested and cleared on one page (`EVERY SETTING IS REACHED FROM ONE PAGE`); and it
exports all of it, secrets included, into one file that may be locked with a passphrase, and imports it again
(`SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS`, `AN EXPORT CAN BE LOCKED WITH A PASSPHRASE`). Apart from the
settings, it keeps what lives only as long as one browser tab — the conversation of the prompt bar (MOD-prompt-bar) — in
that tab's `sessionStorage`, which is no setting: it is neither listed, exported nor imported. It runs in a
browser; reading an export runs in Node as well, so that the Bridge can take over its part.

## Parts

- `index.mjs` — the interface.
- `catalogue.mjs` — every setting it keeps: its key, label, whether it is a secret, what it grants, and the use case that
  sets it up.
- `store.mjs` — reading, writing and clearing in `localStorage`, and the tab's values in `sessionStorage`.
- `export.mjs` — the export file, plain or locked, and its import.
- `sign-in.mjs` — the keys Microsoft's sign-in library writes for one mailbox connection (`mailbox-sign-in`), found,
  cleared and carried in an export under the library's own names.
- `legacy-keys.mjs` — the entries an earlier dashboard kept in this browser under the prefix `agent-m.`, moved once into
  the instance's keys.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_clear_removes_storage.py`, `tests/test_config_client_side.py`, `tests/test_no_config_cookie.py`, `tests/release-sprint-02-d-settings-store.test.mjs`, `tests/review-core.d/settings-store.test.mjs`, `tests/dashboard-product-store-migration.test.mjs`, `tests/test_products_folder.py`: their headers name this module; a test of only the old store is rewritten on this module or goes with it.

## Data

It keeps the settings in `localStorage`, under the prefix `agent-m:<owner>/<repository>:` of the instance, so that two
instances in one browser never share an entry. Each value is JSON. The settings it keeps — its catalogue:

| Key after the prefix | Holds | Secret |
|---|---|---|
| `github-token` | `{ value, name, expires, stored }` — the instance's GitHub token and the expiry the person confirmed | yes |
| `github-token:<owner>/<repository>` | `{ value, name, expires, stored }` — the fine-grained token of one GitHub product (`A GITHUB PRODUCT USES A TOKEN OF ITS OWN`) | yes |
| `gitlab-token:<server>/<project>` | `{ value, name, expires, stored }` — the project access token of one GitLab product | yes |
| `products` | the addresses of the products this browser manages (`THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER`) | no |
| `endpoint:<name>` | `{ url, kind, model, key?, bridge?, place, context, secret? }` — a model endpoint; `bridge` names the Bridge that calls it, where the browser cannot, and is left out where the browser calls it directly; `place` the place where it processes data, `context` the model's context in tokens; `secret` the name of the CI secret that holds its key, for work handed to CI | the key |
| `session:<bridge>:<agent>` | `{ place, context, model, capabilities }` — the CLI session the Bridge `<bridge>` offers for its agent `<agent>`: the place where it processes data, its context in tokens, its model, and its capabilities, prefilled as for a CLI agent | no |
| `bridge:<name>` | `{ address, token }` — a Bridge reached directly, on this computer's loopback or at an SSH forward's address — or `{ port, token }` — a Bridge reached through the jump host, at its port of the jump host's range (`THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS`); `<name>` is the Bridge's name, which its own settings and its participants' routes carry | the token |
| `jump-host` | `{ hostname, user, sshPort, portRange, httpsAddress?, login? }` (`THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS`) | the login |
| `mailbox` | the connection's fields as MOD-mail-routes defines them — route, address, folders, allowed places, the client identifier of the app registration, or servers and password | the password |
| `mailbox-sign-in` | not a key of its own: the keys the Microsoft sign-in library writes for its token cache under its own names (ARC-053), found by the client identifier the `mailbox` entry names and by the library's own key names | yes |
| `resource-key:<name>` | `{ value, stored }` — the key of the resource `<name>` whose list entry names its secret `browser` (MOD-resource-list), sent only to that resource's own server (UC-040) | the value |
| `browser` | this browser's identifier, sixteen random hexadecimal digits made at its first use, which a job record names when this browser's tab takes a job (MOD-job-ledger, `## Taken`) | no |
| `not-an-issue` | the identifiers of mails marked *not an issue* | no |
| `notifications` | `{ checked }` — present while the person has switched the notifications of what waits for acceptance on in this browser (UC-047), absent while they are off; `checked` the date and time of this browser's last check, `null` before the first | no |
| `notified` | `{ "<repository>": { "<path>": "<blob>" } }` — what was notified: for each repository by the address a person opens, every file that waits there, by its path — a SPEC change entry by its proposal's —, with the blob of the text that was notified | no |
| `acknowledged:<notice>` | the date a notice was ticked as read, such as the shared-origin notice | no |
| `last-test:<key>` | `{ at, outcome, tools?, sending? }` — the last test of a setting; for an endpoint's test, `tools` is `true` when the model called the tool it was offered and `false` when it answered in text only (UC-003 step 5), and is left out where the test did not reach the model; for the mailbox's test (`last-test:mailbox`), `sending` is a string, `"works"` or why sending does not work, as MOD-mail-routes' `test()` gives it (UC-037 7d), and is left out where the test did not reach sending | no |

A key outside this catalogue is never written: `writeSetting` refuses it, so no key exists that the settings page does
not show.

The **export file** is JSON, offered for download as `agent-m-settings-<owner>-<date>.json`:

```json
{ "agent-m-settings": 1, "instance": "akmaier/agent-m", "exported": "2026-10-05T09:00:00Z", "locked": false,
  "settings": { "github-token": { "value": "…", "name": "Agent M · agent-m", "expires": "2027-01-03" }, "products": ["…"] },
  "foreign": { "<a sign-in library's key>": "<its value>" } }
```

A locked export carries, instead of `settings` and `foreign`, the same object encrypted in the browser with WebCrypto:
`"kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" }`, `"cipher": { "name":
"AES-GCM", "iv": "<base64>" }`, `"data": "<base64>"`. The key is derived from the passphrase the person chooses; without
it the file cannot be read, and the passphrase cannot be recovered.

## Interfaces

- `Store` — the store of one instance in this browser, as `openStore` returns it; the functions below take it.
- `SettingKey` — a key of the catalogue after the prefix, such as `github-token` or `endpoint:hub`.
- `SettingInfo` — `{ key: SettingKey, label: string, secret: boolean, grants: string, setUpIn: string, expires: string |
  null, lastTest: { at: string, outcome: string } | null }`: what the settings page shows for one setting.
- `ExportFile` — the export file as defined under Data.
- `StoreError` — `StorageUnavailable` (the browser refuses `localStorage`, for example in a private window),
  `UnknownSetting { key }`, `NotAnExport`, `WrongPassphrase`.
- `openStore(instance: string) -> Store` — the store for the instance `owner/repository`. The entries an earlier dashboard
  kept in this browser under the prefix `agent-m.` — the GitHub token with its expiry and last test, each product's own
  token, the products, the jump host without key files, each remote session without a Bridge port — are first moved into
  the instance's keys; an old entry is removed once what it holds stands there, and a value the instance keeps already is
  never replaced. Throws `StorageUnavailable`.
- `readSetting(store: Store, key: SettingKey) -> unknown | null` — the value, or `null` when it is not set.
- `writeSetting(store: Store, key: SettingKey, value: unknown) -> void` — stores a value under a key of the catalogue.
  Throws `UnknownSetting` for any other key and `StorageUnavailable`. It sets no cookie and puts nothing into an address.
  A notice the person must read first — for the mailbox password, the shared Pages origin — is shown by the page; the
  store records its acknowledgement as a setting of its own.
- `clearSetting(store: Store, key: SettingKey) -> void` — removes the entry from `localStorage` itself, not only from a
  form (`A CLEAR IS A REAL CLEAR`); clearing `mailbox` also removes the sign-in library's keys for that connection.
- `clearEverything(store: Store) -> void` — removes every entry of the instance, the sign-in library's keys for its
  mailbox connection included.
- `listSettings(store: Store) -> SettingInfo[]` — every setting the catalogue knows, set or not, with what it grants and
  where it is set up, and the sign-in library's keys as the mailbox's sign-in; secrets are listed, never returned in the
  list (`A STORED SECRET IS HIDDEN UNTIL SHOWN`: the page reveals one by `readSetting` on *Show*).
- `exportSettings(store: Store, passphrase?: string) -> Promise<string>` — the export file's text, with every setting and
  every secret, and the sign-in library's keys; locked when a passphrase is given. The page states, before it offers the
  file, that it opens the person's repositories and mail to whoever holds it (`AN EXPORT STATES THAT IT CONTAINS
  SECRETS`). The file is offered to the person and nothing else: it is never committed or sent.
- `importSettings(store: Store, text: string, passphrase?: string) -> Promise<{ added: SettingKey[], kept: SettingKey[] }>`
  — adds every setting the file holds that this browser lacks, and keeps every setting it already has; returns both lists
  for the page. Rejects with `NotAnExport`, or `WrongPassphrase` when a locked file does not open. A sign-in token that
  has expired since the export is renewed by signing in again (UC-037).
- `readExport(text: string, passphrase?: string) -> Promise<{ instance: string, settings: Record<SettingKey, unknown> }>`
  — reads an export without a store; runs in Node as well, for the Bridge to take over the settings that concern it.
  Rejects with `NotAnExport` or `WrongPassphrase`.
- `expiringSoon(store: Store, now: Date) -> { key: SettingKey, expires: string }[]` — every stored token whose recorded
  expiry is within fourteen days of `now`, or past (`A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE`).
- `secretValues(store: Store) -> string[]` — the values of every stored secret, for the refusal of a commit that would
  write one (`NO SECRET IN THE REPOSITORY`); a caller passes them on and never shows or logs them.
- `readTabValue(store: Store, key: string) -> unknown | null` — a value this browser tab keeps for the instance, or
  `null`; what one tab keeps no other tab reads.
- `writeTabValue(store: Store, key: string, value: unknown | null) -> void` — keeps a value in this tab's
  `sessionStorage` under the instance's prefix, or removes it for `null`; the browser drops it when the tab closes. A tab
  value is no setting: `listSettings`, `exportSettings` and `importSettings` never carry it, and it holds nothing that a
  setting holds. Throws `StorageUnavailable`.

## Files

It reads and writes `localStorage` of the instance's Pages origin, under its prefix, and the sign-in library's keys of the
mailbox connection; and the tab's values in `sessionStorage` of the same origin, under the same prefix. It writes no file; the export is offered to the person as a download, and an import reads the file
the person picks.

## Uses

It uses no other module. It uses the browser's `localStorage` and `sessionStorage` and the WebCrypto interface of browsers
and Node.
