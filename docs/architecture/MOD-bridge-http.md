---
id: MOD-bridge-http
title: The Bridge's API and its server on loopback
folder: src/bridge-http/
realises:
follows:
  - ARC-040
uses:
provides:
  - bridgeApi
  - BridgeHandlers
  - serveBridge
  - pairAnew
---
# MOD-bridge-http The Bridge's API and its server on loopback

## Responsibility

It belongs to the Bridge (ARC-040). It defines the protocol of the Bridge's API — the one format the page's Bridge client
in Access speaks — and runs the server that answers it: only on loopback (`THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY`), only
to a request with the Bridge's pairing token (`THE LOCAL BRIDGE REQUIRES A TOKEN`), and across origins only to the
instance's Pages origin. It dispatches every route to the handler the app hands it and knows nothing of what a handler
does. It uses no other module. It runs in Node, in the Bridge's main process.

## Parts

- `index.mjs` — the interface.
- `protocol.mjs` — `bridgeApi`: the routes, headers, request and answer formats, and errors, as data the server and the
  Bridge client both read.
- `server.mjs` — the server: binding, the token, cross-origin answers, dispatch, the log.
- `pairing.mjs` — the pairing token's file.

## Data

**The pairing token**: 32 random bytes, base64url, in the file `pairing-token` of the Bridge's own per-user data folder,
which lies outside every repository and is readable and writable by its user only. It is kept across restarts until the
person pairs anew (`THE BRIDGE IS PAIRED ONCE`).

**The protocol, `bridgeApi`.** A Bridge listens on the port `4711` unless its settings name another, and the dashboard
proposes that address when pairing. Every request carries the pairing token in the header `X-Agent-M-Bridge-Token`. A request
through the jump host also carries the web server's own login, which the web server checks first (`THE JUMP HOST FORWARDS
TO A BRIDGE ONLY AFTER ITS OWN LOGIN`); the Bridge does not read it. Bodies are JSON. Routes:

**Endpoint configuration.** The `args` of `endpoint-test`, and the `endpoint` of an ask, is `{ name: string, kind:
"openai-compatible" | "anthropic", baseUrl: string, model: string, key: string | null }`: a model endpoint the Bridge
calls for the page. The `answer` of `endpoint-test` is `{ works: true, model: string }` or
`{ works: false, diagnosis: { reason: "cross-origin refused" | "opt-in header missing" | "blocked by the browser" |
"not reachable" | "key refused" | "model unknown" | "too long" | "rate limited" | "endpoint error", message: string,
routes: ("ci" | "bridge")[] } }`. These fields are the Bridge API's own wire format.

| Method and path | Request | Answer | Handler |
|---|---|---|---|
| `GET /v1/pair` | — | `{ bridge: { name, version, platform }, origin }` | the server itself |
| `GET /v1/agents` | — | `{ agents: [{ name, version, ready, loggedIn }], missing: [{ name }] }` — the agents the Bridge offers, and the supported agents missing on its computer | jobs |
| `POST /v1/jobs` | `{ product, record, commit, task? }` — a job handed over: the product's address, the path of its start record and the commit that holds it, and, for a job whose task travels with the hand-over, that task | `{ accepted }` — the job's identifier | jobs |
| `GET /v1/jobs` | — | `{ jobs: [{ id, product, kind, agent, state, started, usage }] }` | jobs |
| `GET /v1/jobs/{id}/log?from={line}` | — | `{ lines, next, ended }` — the log from that line on | jobs |
| `POST /v1/jobs/{id}/cancel` | — | `{ confirmed }` — `true` once the agent's process has ended | jobs |
| `POST /v1/ask` | `{ agent, input }` — a drafting request to an agent the Bridge offers — or `{ endpoint, input }` — a request to a model endpoint, `endpoint` in the endpoint configuration's format — or `{ endpoint, exchange }` — one request of a tool loop the page runs, the messages so far and the tools offered | `{ ask }` | jobs |
| `GET /v1/ask/{ask}` | — | `{ state: "running" \| "done" \| "failed", text, calls, usage, error }` — `calls` the tool calls an endpoint made in the one exchange of a tool loop the request carried, each `{ id, name, args }`; empty for any other request | jobs |
| `POST /v1/probes/{kind}` | `{ args }`; `kind` is `agent`, `endpoint-models`, `endpoint-test` or `partitions`; `endpoint-test` and `endpoint-models` take the endpoint configuration; `partitions` takes `{}` | `{ answer }`; for `endpoint-test`, the endpoint-test answer; for `endpoint-models`, `{ models: string[] }` or `{ diagnosis }`; for `partitions`, `{ partitions: { name, state }[] }` | jobs |
| `POST /v1/mail/{operation}` | `{ connection, args }` — the IMAP connection with its password, for this request only | the operation's answer | mail |
| `GET /v1/tunnels` | — | `{ tunnels: [{ name, kind, state, reason }] }` | tunnels |

The mail operations are `test`, `read`, `find`, `drafts`, `sent`, `store-draft`, `update-draft`, `show-draft`,
`confirm-send` and `send`. `confirm-send` takes `{ ref, sha256 }` and answers `{ confirmation }`: a single-use value bound
to that draft and that SHA-256, valid for minutes; `send` takes `{ ref, sha256, confirmation }` (`THE BRIDGE SENDS ONLY
WITH A CONFIRMATION OF THE MAIL SHOWN`). The server passes the other operations' arguments and answers through without
reading them; their fields are those of the mail route, which the page's mail route and the Bridge's mail handler share
(MOD-mail-routes defines them).

**Errors** answer `{ error, message }`: `token-refused` (401) — no token or another one; `origin-refused` (403); `not-found`
(404); `invalid-request` (422); `confirmation-refused` (409) — missing, spent, expired, or for other bytes; `no-encryption`
(502) — the mail server offers no TLS, no login was sent; `login-refused` (502) and `upstream-failed` (502) with the mail
server's or the agent's own message; `paused` (503).

## Interfaces

- `bridgeApi` — the protocol above, as data: its default port, its routes with their methods, request and answer fields,
  the token's header, and the errors with their codes.
- `BridgeHandlers` — `{ jobs: RouteHandlers, mail: RouteHandlers, tunnels: RouteHandlers }`, where `RouteHandlers` maps a
  route of `bridgeApi` to `(request: { params: object, body: object }) -> Promise<object>`; a handler throws an error of
  `bridgeApi` by its code.
- `serveBridge(config: { host: string, port: number, origin: string, dataFolder: string, paused: () => boolean,
  name: () => string, version: string | null }, handlers: BridgeHandlers) -> Promise<{ address: string, token: string,
  pairedWith: () -> string | null, close: () -> Promise<void> }>` — starts the server, and returns its address and the
  pairing token in force, made on the first start, for the Bridge's window; `pairedWith()` is the origin of the first
  request since this start that carried the token in force and came from `origin`, and `null` before one did and again
  after `pairAnew` (UC-044, pairing). It is kept in memory only. `GET /v1/pair` answers with `name()` at the time of the
  request, with `version`, the release the Bridge runs or `null` for a start that names none, and with the platform it
  runs on. It refuses any `host` but `127.0.0.1`, `::1` or `localhost` with `BindRefused`, and a port in use with
  `PortInUse`. It answers a request only with the pairing token, whatever its route; it answers cross-origin requests,
  and the browser's preflight for a request to the local network, only for `origin`, the instance's Pages origin —
  through the jump host its web server does the same (`THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE
  INSTANCE`); while `paused()` holds, a request that starts work — a hand-over, an ask, a probe, a mail operation —
  answers `paused`, and the others still answer, so that running jobs can be followed and cancelled. Its log keeps a
  request's method, route, status and duration — never a body, a query value or a header's value.
- `pairAnew(dataFolder: string, token: string | null) -> Promise<string>` — a new pairing token, random or the one given
  — such as the token of a Bridge reached through the jump host, from the dashboard's settings export —, written to the
  token's file; from then on the old token is refused, by a server already running too. Errors: `NotWritable` with the
  folder.

## Files

Reads and writes `pairing-token` in the Bridge's per-user data folder, readable by its user only. Writes no repository
file and logs no body.

## Uses

Nothing: the protocol and the server stand on their own, so the Bridge client in Access and every handler of the Bridge
can use them without a cycle.
