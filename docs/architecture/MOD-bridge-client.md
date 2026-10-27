---
id: MOD-bridge-client
title: The page's client of a Bridge, and the tunnels that reach it
folder: src/bridge-client/
realises:
follows:
  - ARC-047
uses:
  - MOD-bridge-http.bridgeApi
provides:
  - Bridge
  - BridgeEntry
  - BridgeSettings
  - JumpHost
  - TunnelPlan
  - BridgeError
  - settingsOf
  - bridgeAt
  - pair
  - testBridge
  - handOver
  - ask
  - bridgeJobs
  - bridgeJobLog
  - cancelOnBridge
  - mailCall
  - probe
  - allocatePort
  - tunnelCommands
  - proxyConfiguration
---
# MOD-bridge-client The page's client of a Bridge, and the tunnels that reach it

## Responsibility

It belongs to Access (ARC-047). It is the client side of the Bridge's API (ARC-040) and follows that API's protocol,
`bridgeApi`, exactly as MOD-bridge-http defines it — its routes, the header that carries the pairing token, its request
and answer fields, its error codes; the protocol is the Bridge's, and this client reads it from `bridgeApi` itself, so the
two never disagree. It reaches a Bridge directly on the computer's loopback, through a forward to the jump host, or at the
jump host's HTTPS address with the web server's own login, always with the Bridge's token (`THE LOCAL BRIDGE REQUIRES A
TOKEN`); a person may pair several Bridges, each known by its name. It pairs, tests, hands over jobs, asks an agent to
draft or a model endpoint to answer, follows and cancels jobs, passes mail operations and probes; and it names why a
Bridge cannot be reached, as far as a browser lets a page know. It also owns the plan of a
tunnel to a computer behind NAT, and writes for a person the commands of both ends and the configuration of the jump
host's web server (`THE DASHBOARD WRITES THE TUNNEL COMMANDS`). It runs in a browser and in Node.

## Parts

- `index.mjs` — the interface.
- `client.mjs` — requests to a Bridge along `bridgeApi`, and the failures they meet.
- `tunnels.mjs` — the tunnel plan, the allocation of ports and the commands.
- `proxy.mjs` — the configuration of the jump host's web server.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_bridge_tunnel.py`, `tests/review-core.d/bridge-tunnel.test.mjs`, `tests/test_mail_routes.py`, `tests/test_mail_password_route.py`: their headers name this module; one of only the old tunnel goes with it.

## Data

It keeps nothing; its callers read the Bridges, each under its name, and the jump host from the browser's store and hand
them in. A Bridge reached through the jump host is addressed at the path `/bridge/<name>` of the jump host's HTTPS
address; the path is made in one place of this module, which `settingsOf` and `proxyConfiguration` both use. It owns the **tunnel plan**, which the Bridge's MOD-tunnels opens and the commands
below write out:

```json
{ "direction": "reverse", "jumpHost": "jump.example.org", "user": "alice", "sshPort": 22,
  "remotePort": 40101, "bind": "127.0.0.1", "bridgePort": 4711, "keyFile": "~/.ssh/agent-m-lab" }
```

`direction` is `reverse` on the computer behind NAT — the jump host's `remotePort` forwarded to the Bridge's
`bridgePort` — or `forward` on the person's computer — its local `remotePort` forwarded to the jump host's `remotePort`.
`bind` is always the jump host's loopback (`A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK`). `bridgePort` is
the Bridge's port, `bridgeApi`'s default unless the Bridge's settings name another. `keyFile` names the key the command
uses; the key itself stays on its computer.

## Interfaces

- `Bridge` — `{ address: string, route: "loopback" | "forward" | "jump-host" }`: the handle of one Bridge that `bridgeAt`
  returns and every call below takes — its address, and whether it is reached on this computer's loopback, through a
  forward to the jump host, or at the jump host's HTTPS address. It carries the Bridge's token, and the jump host web
  server's login, for its own requests only, and exposes neither.
- `BridgeEntry` — `{ name: string, address: string, token: string } | { name: string, port: number, token: string }`: a
  Bridge as the browser's store keeps it under its name — reached directly at its address, or through the jump host at
  its port of the jump host's range.
- `BridgeSettings` — `{ name: string, address: string, token: string, login?: { user: string, password: string } }`: the
  Bridge's name and address — `http://127.0.0.1:<port>`, a forwarded `http://localhost:<port>`, the jump host's HTTPS
  address with the Bridge's path, or, without one, the forward `http://localhost:<port>` of its port —, its pairing
  token, and the jump host web server's login where the address is the jump host's.
- `JumpHost` — `{ hostname: string, user: string, sshPort: number, portRange: [number, number], httpsAddress?: string,
  login?: { user: string, password: string } }`.
- `TunnelPlan` — as defined under Data.
- `BridgeError` — the failures of every call below that reaches a Bridge:
  `TokenMissing` — no token is stored for this Bridge; no request is made.
  `NoAnswer { likely: ("blocked by the browser" | "not running" | "wrong address" | "another instance" | "certificate not
  trusted")[] }` — the browser let the page read no answer. A browser does not tell a page why, so the failure names what
  may be the cause, the most likely first: `blocked by the browser` where the page, served over HTTPS, calls
  `http://127.0.0.1` in a browser that refuses it, as Safari does, or a local-network permission was not given — with the
  route over HTTPS through the jump host named as the way around —; `not running`; `wrong address`; `another instance`,
  since a Bridge answers across origins only for the instance it is paired with, and its refusal cannot be read by a
  page of another origin; and, for the jump host's HTTPS address, `certificate not trusted`.
  `TokenRefused` — the Bridge answered `token-refused`: no token, or another one than it is paired with; the person pairs
  again.
  `JumpHostLoginRefused` — the jump host's web server refused its own login, before the Bridge saw the request.
  `BridgeFailed { error: "origin-refused" | "not-found" | "invalid-request" | "confirmation-refused" | "no-encryption" |
  "login-refused" | "upstream-failed" | "paused", message: string }` — one of the Bridge's own errors, by its code in
  `bridgeApi`, with the message the Bridge gave.
  `AskFailed { message: string }` — the agent asked to draft failed; `message` is the `error` of the ask's answer.
  `Timeout` — a request got no answer in time; what it asked for may still be carried out on the Bridge.
- `settingsOf(entry: BridgeEntry, jumpHost: JumpHost | null) -> BridgeSettings` — the settings of a stored Bridge: its
  own address, or, for one reached through the jump host, the jump host's HTTPS address with the path `/bridge/<name>`
  and the web server's login, or the forward of its port where the jump host has no HTTPS address. Throws
  `JumpHostMissing` for a Bridge at a port while no jump host is stored. No request is made.
- `bridgeAt(settings: BridgeSettings) -> Bridge` — the handle of a Bridge for these settings; no request is made.
- `pair(address: string, pairingToken: string, login?: { user: string, password: string }) -> Promise<{ name: string,
  settings: BridgeSettings }>` — `GET /v1/pair` at the address, with the token the person copied from the Bridge's
  window, and returns the name the Bridge reports and the settings to store under it (`THE BRIDGE IS PAIRED ONCE`). The
  page proposes `http://127.0.0.1` with `bridgeApi`'s default port as the address. Crosses the network; fails with
  `NoAnswer`, `TokenRefused`, `JumpHostLoginRefused`, `Timeout`.
- `testBridge(bridge: Bridge) -> Promise<{ bridge: { name: string, version: string | null, platform: string },
  origin: string, agents: { name: string, version: string, ready: boolean, loggedIn: boolean }[],
  missing: { name: string }[] }>` — a
  harmless test in two requests: `GET /v1/pair`, whose answer names the Bridge and the `origin` it is paired with — the
  instance's Pages origin it answers —, and `GET /v1/agents`, the coding agents it offers, each ready or not and logged
  in or not, and the supported agents missing on its computer (UC-044, UC-017). Crosses the network; fails with
  every `BridgeError` but `AskFailed`.
- `handOver(bridge: Bridge, job: { product: string, record: string, commit: string, task?: string }) -> Promise<{
  accepted: string }>` — `POST /v1/jobs`: hands over a job whose start record is committed — the product's address, the
  path of its start record, and the commit that holds it. The Bridge runs the job from that record, so nothing else
  travels with it — but `task`, for a job a conversation of the prompt bar handed over, whose record says that its task
  travels with the hand-over (UC-049 4a);
  `accepted` is the job's identifier. Crosses the network; fails with every `BridgeError` but `AskFailed`, among them
  `BridgeFailed` with `paused` while the Bridge is paused.
- `ask(bridge: Bridge, target: { agent: string } | { endpoint: bridgeApi's endpoint configuration }, input: unknown) ->
  Promise<{ text: string, calls: { id: string, name: string, args: object }[], usage: unknown | null }>` — `POST /v1/ask`
  with `{ agent, input }`, `{ endpoint, input }`, or `{ endpoint, exchange }` for one request of a tool loop the page runs,
  whose answer's `calls` carry the endpoint's tool calls back to the page (empty otherwise),
  then `GET /v1/ask/{ask}` until the answer's state is `done` or `failed`: the draft of an agent the Bridge offers, or the
  answer of a model endpoint the Bridge calls, and the usage reported. The endpoint's configuration and key travel only in
  that request's body. MOD-runtimes makes a participant driver of it. Crosses the network; fails with every
  `BridgeError`, `AskFailed` when the answer's state is `failed`, and `BridgeFailed` with `paused` while the Bridge is
  paused.
- `bridgeJobs(bridge: Bridge) -> Promise<{ id: string, product: string, kind: string, agent: string, state: string,
  started: string, usage: unknown | null }[]>` — `GET /v1/jobs`: the jobs the Bridge runs or ran since it started.
  Crosses the network; fails with every `BridgeError` but `AskFailed`.
- `bridgeJobLog(bridge: Bridge, id: string, from: number) -> Promise<{ lines: string[], next: number, ended: boolean }>` —
  `GET /v1/jobs/{id}/log?from={line}`: a job's log from a line on, so that a page can follow it. Crosses the network;
  fails with every `BridgeError` but `AskFailed`, among them `BridgeFailed` with `not-found` for a job the Bridge does not
  know.
- `cancelOnBridge(bridge: Bridge, id: string) -> Promise<{ confirmed: boolean }>` — `POST /v1/jobs/{id}/cancel`: asks the
  Bridge to end the agent's process; `confirmed` is true once it has. Crosses the network; fails as `bridgeJobLog`.
- `mailCall(bridge: Bridge, operation: "test" | "read" | "find" | "drafts" | "sent" | "store-draft" | "update-draft" |
  "show-draft" | "confirm-send" | "send", connection: unknown, args: unknown) -> Promise<unknown>` —
  `POST /v1/mail/{operation}` with `{ connection, args }`: one mailbox operation, with the IMAP connection and its
  password inside the request, which is the only way the password leaves the browser (`THE MAILBOX PASSWORD LEAVES THE
  BROWSER ONLY TO THE BRIDGE`). The fields of the connection, the arguments and the answer are those MOD-mail-routes
  defines; `confirm-send` and `send` carry the single-use confirmation as `bridgeApi` defines it. Crosses the network;
  fails with every `BridgeError` but `AskFailed`, among them `BridgeFailed` with `confirmation-refused`, `no-encryption`,
  `login-refused`, `upstream-failed` — the mail server's own message — or `paused`.
- `probe(bridge: Bridge, kind: "agent", args: unknown) -> Promise<unknown>`, `probe(bridge: Bridge, kind: "endpoint-models",
  args: bridgeApi's endpoint configuration) -> Promise<{ models: string[] } | { diagnosis }>` (the diagnosis as bridgeApi carries it), `probe(bridge:
  Bridge, kind: "partitions", args: {}) -> Promise<{ partitions: { name: string, state: string }[] }>` and
  `probe(bridge: Bridge, kind: "endpoint-test", args: bridgeApi's endpoint-test configuration) -> Promise<bridgeApi's
  endpoint-test answer>` — `POST /v1/probes/{kind}` with `{ args }`, resolving with the answer's
  `answer`: an agent answers a harmless request, an endpoint lists its served models, the explicitly chosen local
  endpoint configuration receives UC-003's short test on the Bridge, or a cluster lists its partitions. The endpoints
  page maps its saved `{ url, kind, model, key?, bridge }` record to the Bridge API endpoint configuration only for the
  Bridge its `bridge` names: its selected name and kind, `url` as `baseUrl`, optional `key` as `key ?? null`, and
  model.
  A result with `works: false` is the provider or local-endpoint diagnosis returned by `testEndpoint`; an invalid body or
  Bridge transport failure is the named `BridgeError`, not a diagnosis. Crosses the network; fails with every
  `BridgeError` but `AskFailed`, among them `BridgeFailed` with `upstream-failed` or `paused`.
- `allocatePort(range: [number, number], bridges: BridgeEntry[]) -> number` — the lowest port of the range that no Bridge
  reached through the jump host holds (`EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE`). Throws
  `NoFreePort` naming the range, and `TypeError` for a range that does not lie between 1024 and 65535 from its lower end.
- `tunnelCommands(jumpHost: JumpHost, bridge: { name: string, port: number }, bridgePort: number, keyFiles: { remote:
  string, local: string }) -> { reverse: string, forward: string, plans: TunnelPlan[], service: string }` — the two
  commands of UC-011,
  filled in: the reverse tunnel for the computer behind NAT, `ssh -N -R 127.0.0.1:<port>:127.0.0.1:<bridge port>`, and
  the forward for the person's computer, `ssh -N -L <port>:127.0.0.1:<port>`, each with keep-alive options and the key
  file it uses, to `<user>@<jump host>`; the plans they carry out; and how to keep the reverse tunnel running as a
  service. Every value is checked before it enters a command, so that no setting adds an option or an address to it: a
  `TypeError` names a jump host that is no host name or IPv4 address, a user that is no login name, and a key file that is
  no file name; and a command any of whose forwards would bind elsewhere than the loopback, forward elsewhere than to
  `127.0.0.1`, or let other hosts connect, is refused and not written. No request is made.
- `proxyConfiguration(jumpHost: JumpHost, bridges: { name: string, port: number }[], instanceOrigin: string, server:
  "apache" | "nginx") -> string` — the configuration of the jump host's web server for the route over HTTPS: its own login over TLS before
  anything is forwarded (`THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN`); cross-origin requests allowed
  for the instance's Pages origin only, preflights answered by the web server itself and never forwarded (`THE JUMP HOST
  ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE`); each Bridge's path `/bridge/<name>` forwarded to its port on the
  jump host's loopback (`A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST`); and the note that its certificate must come from
  an authority the browsers trust. No request is made.

## Files

It reads and writes no file.

## Uses

- `MOD-bridge-http.bridgeApi` — the protocol of the Bridge's API, as data: its default port, its routes with their methods,
  request and answer fields, the header that carries the token, and its error codes. This client builds every request
  from it and reads every answer by it. A remote use: the Bridge answers over HTTP.
