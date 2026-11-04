---
id: ARC-040
title: The Agent M Bridge
refines: ARC-037
forced_by:
  - ONE DEFINITION, THREE DRIVERS
  - THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
  - REMOTE ACCESS TO THE BRIDGE GOES THROUGH A TUNNEL
  - A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL
  - A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK
  - A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST
  - THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN
  - THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE
  - THE LOCAL BRIDGE REQUIRES A TOKEN
  - THE BRIDGE IS PAIRED ONCE
  - BROWSER REACHABILITY IS MEASURED, NOT ASSUMED
  - AGENT M WORKS WITHOUT A LOCAL INSTALLATION
  - THE BRIDGE IS ONE FILE PER PLATFORM
  - THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE
  - THE BRIDGE IS SIGNED BY ITS PUBLISHER
  - THE BRIDGE RUNS AS AN APP
  - THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW
  - THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
  - THE BRIDGE FINDS THE INSTALLED AGENTS
  - THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT
  - A LOCAL AGENT USES THE PERSON'S OWN LOGIN
  - THE BRIDGE OPENS ITS TUNNELS ITSELF
  - THE BRIDGE CREATES ITS OWN SSH KEY
  - THE BRIDGE IS UPDATED ONLY BY THE PERSON'S CHOICE
  - THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE
  - THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
  - THE MAIL SERVER IS REACHED ONLY OVER TLS
  - READING THE MAILBOX CHANGES NOTHING IN IT
  - THE BRIDGE SENDS ONLY WITH A CONFIRMATION OF THE MAIL SHOWN
  - A REPLY IS THREADED ON THE REPORTER'S MAIL
  - A MAIL IS FOUND AGAIN BY ITS IDENTIFIER
  - A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER
  - A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF
  - UC-003
  - UC-011
  - UC-017
  - UC-037
  - UC-039
  - UC-040
  - UC-044
  - UC-049
designs:
  - MOD-bridge-http
  - MOD-bridge-jobs
  - MOD-mail-protocols
  - MOD-tunnels
  - MOD-desktop-shell
  - MOD-bridge-build
  - MOD-agent-enclosure
---
# ARC-040 The Agent M Bridge

## Context

Some work can only be done on a person's computer: running a coding agent with the login it already has there,
speaking IMAP and SMTP to a mail server, calling a local model server or a cluster, and reaching a computer behind NAT
through a jump host (UC-011, UC-037, UC-040). A browser can do none of this. The Bridge is Agent M's second level: an app
a person who never used a terminal installs by double-click and pairs by copying one token (UC-044). It must listen only
on loopback, answer only with its token, hold a mailbox password only for one request, and be built from the same code
the page uses (`THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE`). When no tab is open, the Bridge is also where a run whose
jobs are its agents' keeps going (ARC-037, process view).

## Decision

The Bridge is a driver of ARC-037: **a desktop app with a local HTTP API, built from the shared modules, whose handlers
are its own modules and whose window is its only user interface**. Its runtime and packaging are decided in ARC-050, its
mail libraries in ARC-051, its SSH in ARC-052, the enclosure of the agents it starts in ARC-054. It defines the protocol of its API in a module that uses no other, so the
page's Bridge client in Access speaks it without a cycle. The app's main module composes everything; no handler module
uses another handler module.

**What the Bridge shares rather than repeats.** It runs jobs with the same job runner, catalogue, ledger and run planner
as the page and CI (ARC-046, ARC-042); it reads and writes product repositories through the same host interface as every
other program, with Access's adapter for a local clone and the computer's own git login (ARC-047); it reads the
dashboard's settings export with the same function that writes it (MOD-browser-store); and its window is rendered with
the site's frame and renderer (ARC-038), so its look, explanations and texts are the site's.

### Responsibility within the system

Offering the page and the Bridge client a token-guarded API on loopback; running the jobs of the agents it offers —
those of its computer's agents the person chose in its window, each in its working folder; those handed over by the page
and those it takes itself from the product repositories it serves —; calling a model endpoint for a job of the page;
speaking IMAP and SMTP over TLS for one request at a time; opening and keeping its SSH tunnels with its own key; showing
its pairing token, agents, tunnels and updates in its window; and being released as one signed file per platform. A
person may run Bridges on several computers; each has its own name, which the page, its settings and the participants'
routes share.

### The interface it offers

The Bridge API, over HTTP, defined in MOD-bridge-http and described in its file: pairing test, the agents it offers, jobs
(hand over, list, log, cancel), asks (a draft of an agent, or the answer of a model endpoint the Bridge calls), mail (read
folders read-only, find by identifier, read Drafts and Sent, store a draft, send with a single-use confirmation, test),
probes (an agent's harmless request, an endpoint's served models, the short test of an endpoint whose configuration names
this Bridge, a cluster's partitions), tunnels (state). Every request
carries the Bridge's token in its own header; a request through the jump host also carries the web server's login, which
the web server checks first.

| Module | Functions other subsystems use |
|---|---|
| MOD-bridge-http | `bridgeApi` — the protocol, with its routes, request and answer formats and failures |

### Its modules

| Module | Folder | Responsibility |
|---|---|---|
| MOD-bridge-http | `src/bridge-http/` | the API's protocol and the server: binding to `127.0.0.1`, `::1` or `localhost` only; the token on every request; the pairing token kept across restarts in a file outside every repository that only its user can read, renewed by *pair anew*; cross-origin answers for the instance's Pages origin only; routes dispatched to the handlers the app hands it; no request body ever logged |
| MOD-bridge-jobs | `src/bridge-jobs/` | the Bridge as a route: jobs handed over by the page — a conversation's with its task, held in memory only —, and queued jobs of the agents it offers that it takes itself from the product repositories through Access's local clone with the computer's own git login; running them with the job runner and the agent processes, each in its agent's working folder with the clones of the instance and the products, the agent in the enclosure of MOD-agent-enclosure; pushing the branches the agent made and opening their pull requests itself; their records; starting an agent's sprint close when the sprint ends; the asks of an agent or a model endpoint; the probes; the test of the computer's git login |
| MOD-mail-protocols | `src/mail-protocols/` | IMAP and SMTP for the mail routes: a login only over implicit TLS or STARTTLS; folders opened read-only, no flag changed; finding a mail by the identifier of its `Message-ID`; Drafts and Sent by their markings; storing a draft; sending only with a valid single-use confirmation of the mail's hash, and a copy to Sent; the password held only for the request |
| MOD-tunnels | `src/tunnels/` | the Bridge's own SSH key pair, made on first use, its private key readable only by its owner and never exported; the reverse tunnel bound to the jump host's loopback, or the forward on the person's computer, opened from the tunnel plan in the Bridge's settings, kept open and reopened after sleep or network changes; their state |
| MOD-desktop-shell | `src/desktop-shell/` | the app: icon in the menu bar or tray, or its window open where there is no tray; the window, rendered with the site's frame and renderer — agents with versions, how to install a missing one and *Check again*, the agents it offers with their working folders and *Test access*, the pairing token with *Copy* and *Pair anew*, the jump host and the public key, tunnel state, importing the dashboard's settings export —; pause and quit; offering a newer release and installing it only after the click, only with a valid signature; composing the other modules |
| MOD-agent-enclosure | `src/agent-enclosure/` | the enclosure every coding agent the Bridge starts runs in (ARC-054): per platform — a Seatbelt profile on macOS, bubblewrap on Linux, the Bridge's own account on Windows — what an agent may read, write and reach, nothing that holds a credential of the Bridge or of the computer's git login among it; the agent's own home and environment; whether the enclosure works on this computer, and the one-time step where it does not; a terminal in the enclosure for the agent's own login step |
| MOD-bridge-build | `src/bridge-build/` | the release build of the instance's release workflow: one file per platform — a disk image for macOS, an installer for Windows, an executable for Linux —, each signed, and notarised for macOS; the checksums; the update feed with signatures; no file published unsigned |

```mermaid
flowchart BT
  BH[MOD-bridge-http]
  BJ[MOD-bridge-jobs]
  MP[MOD-mail-protocols]
  TU[MOD-tunnels]
  DS[MOD-desktop-shell]
  BB[MOD-bridge-build]
  AE[MOD-agent-enclosure]
  BJ --> BH
  MP --> BH
  TU --> BH
  DS --> BH
  DS --> BJ
  DS --> MP
  DS --> TU
  DS --> AE
  BJ --> AE
  BB --> DS
```

MOD-bridge-jobs uses Participants and jobs — the runner, the catalogue, the agent processes, the job ledger —, Process's
run planner and progress facts, and Access's repository hosts; on a Bridge the facts that need a server are unknown. MOD-tunnels reads the tunnel plan whose format Access's Bridge client defines. MOD-mail-protocols answers in the
mailbox types of MOD-mail-routes and names mails with MOD-mail-records' identifier. MOD-desktop-shell, which composes the
app, uses the Site's frame and renderer, Access's reading of a settings export and its tunnel commands, the agent
processes' list of installed agents, and registers the strategies of the services with the job runner.

### The formats it owns

The Bridge API (MOD-bridge-http); the Bridge's settings file, the part of the dashboard's export it takes over
(MOD-desktop-shell); the update feed (MOD-bridge-build).

## Alternatives

- **A command-line program the person starts in a terminal.** Rejected: `THE BRIDGE RUNS AS AN APP`; the person may never
  have used a terminal.
- **A browser extension instead of an app.** Rejected: an extension cannot start a coding agent's process, open SSH
  tunnels or speak IMAP.
- **A separate program per function — one for agents, one for mail, one for tunnels.** Rejected: one token, one pairing
  and one app to install (`KEEP IT SIMPLE`).
- **Handlers that call each other.** Rejected: the app composes them; each handler stays testable on its own.

## Consequences

- Without the Bridge, Agent M still works at level 1; with it, local agents use the person's subscription and logins.
- Each release costs a build on three platforms and the publisher's signing certificates.
- A Bridge that is quit ends its running jobs as cancelled; the jobs queued for its agents wait until it runs again.
