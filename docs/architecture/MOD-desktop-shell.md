---
id: MOD-desktop-shell
title: The Bridge's app — its icon, its window, its settings and its updates
folder: src/desktop-shell/
realises:
follows:
  - ARC-040
  - ARC-050
uses:
  - MOD-bridge-http.bridgeApi
  - MOD-bridge-http.BridgeHandlers
  - MOD-bridge-http.serveBridge
  - MOD-bridge-http.pairAnew
  - MOD-bridge-jobs.jobHandlers
  - MOD-bridge-jobs.startWatching
  - MOD-bridge-jobs.stopWatching
  - MOD-bridge-jobs.testAccess
  - MOD-mail-protocols.mailHandlers
  - MOD-tunnels.ensureKey
  - MOD-tunnels.openTunnels
  - MOD-tunnels.closeTunnels
  - MOD-tunnels.tunnelState
  - MOD-tunnels.tunnelHandlers
  - MOD-bridge-client.TunnelPlan
  - MOD-bridge-client.JumpHost
  - MOD-bridge-client.BridgeEntry
  - MOD-bridge-client.tunnelCommands
  - MOD-browser-store.readExport
  - MOD-agent-processes.Agent
  - MOD-agent-processes.installedAgents
  - MOD-job-runner.registerStrategies
  - MOD-approvals.approvalStrategies
  - MOD-spec-changes.specStrategies
  - MOD-artifact-edits.editStrategies
  - MOD-source-register.sourceStrategies
  - MOD-reuse-facts.reuseStrategies
  - MOD-resource-list.resourceStrategies
  - MOD-work-plans.workStrategies
  - MOD-run-planner.runStrategies
  - MOD-product-process.processStrategies
  - MOD-test-schedule.scheduleStrategies
  - MOD-result-records.resultStrategies
  - MOD-issue-handling.issueStrategies
  - MOD-runtimes.routeStrategies
  - MOD-site-frame.PageSetup
  - MOD-site-frame.View
  - MOD-site-frame.Route
  - MOD-site-frame.startPage
  - MOD-site-frame.explain
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.notice
  - MOD-markdown-render.renderArtifact
provides:
  - appDescription
---
# MOD-desktop-shell The Bridge's app — its icon, its window, its settings and its updates

## Responsibility

It belongs to the Bridge (ARC-040). It is the app of ARC-050: it composes the Bridge's other modules and the shared ones
into one program, and it is everything a person sees of the Bridge. It starts by a double click and runs with its icon in
the menu bar or the tray, or with its window open where there is no tray (`THE BRIDGE RUNS AS AN APP`). Its window, drawn
with the site's frame and renderer, shows the agents of this computer and how to install a missing one, which of them
the Bridge offers and the working folder of each, the pairing token, the jump host with the Bridge's public key, the tunnels, the settings and a newer release. It keeps the Bridge's
settings, set in the window or taken from the dashboard's export; it pauses and quits; and it installs a newer release
only after the person's click and only with the publisher's signature. Its main process runs in Node, inside Electron;
its window runs in Electron's browser part. The window serves UC-044 and UC-011.

## Parts

- `index.mjs` — the interface: `appDescription`.
- `app.json` — `appDescription` as data.
- `main.mjs` — the app's entry, Electron's main process: one running Bridge per user, the icon, the window, pause and
  quit.
- `compose.mjs` — the strategies registered with the job runner, the server with its handlers, the watching of the
  served products, the tunnels.
- `settings.mjs` — the settings file, and taking over a settings export.
- `updates.mjs` — the offer of a newer release, its download on the click, its signatures, its installation on the
  click.
- `window.html`, `window.mjs` — the window's page and its routes; `preload.cjs` — the fixed set of calls the window may
  make to the main process. The window has no other access to Node.
- `icons/` — the app's icon for each platform, and the icon of the menu bar and the tray.

## Data

**The Bridge's settings**, the part of the dashboard's export the Bridge takes over (ARC-040): `settings.json` in the
Bridge's per-user data folder, written only by this module.

```json
{ "agent-m-bridge-settings": 1, "name": "lab-pc", "port": 4711,
  "agents": [{ "name": "claude", "folder": "/home/alice/agent-m-work/claude" }],
  "products": ["https://github.com/alice/example-product"], "every": 300, "paused": false,
  "jumpHost": { "hostname": "jump.example.org", "user": "alice", "sshPort": 22 },
  "tunnels": [{ "direction": "reverse", "jumpHost": "jump.example.org", "user": "alice", "sshPort": 22,
    "remotePort": 40101, "bind": "127.0.0.1", "bridgePort": 4711, "keyFile": "ssh/id_ed25519" }] }
```

- `agent-m-bridge-settings` — the version of the format, `1`.
- `name` — the Bridge's name, which the route of its participants carries in the instance's `docs/participants.md`
  (`bridge <name> agent <agent>`); by default the computer's own name.
- `port` — the port on loopback the API listens on; by default the one `bridgeApi` names.
- `agents` — the agents the Bridge offers, each a supported agent installed on this computer and chosen by the person in
  the window, with its working folder, chosen there too, in which MOD-bridge-jobs keeps that agent's clones (`THE BRIDGE
  FINDS THE INSTALLED AGENTS`, `THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT`); an agent no longer installed
  stays listed and is shown as missing.
- `products` — the addresses of the product repositories whose queued jobs and runs this Bridge serves.
- `every` — the seconds between two readings of the served products; by default 300.
- `paused` — whether the Bridge was paused when it last ran; it starts paused again.
- `jumpHost` — the jump host's `hostname`, `user` and `sshPort`, the fields of MOD-bridge-client's `JumpHost` a Bridge
  needs; the web server's login and the port range stay in the dashboard.
- `tunnels` — the tunnel plans in MOD-bridge-client's format, `TunnelPlan`, which MOD-tunnels opens; their `keyFile` is
  always the Bridge's own key.

**Taking over an export** (`THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT`). Of the settings Access's
`readExport` returns, the Bridge takes `products`, `jump-host` and the `bridge:<name>` entries reached through the jump
host. The person says in the window whether this computer is their own — then each of those Bridges becomes a forward —
or which of them it is — then that entry's name becomes the Bridge's name, its port that of the reverse tunnel, and its
token the pairing token, so that the dashboard reaches this Bridge with the token it already holds. The plans are made by MOD-bridge-client's
`tunnelCommands`, the function that writes the dashboard's commands, so both ends agree. Nothing else of the export is
kept: no token of a repository server, no endpoint key, no mailbox connection or password (`THE MAILBOX PASSWORD LEAVES
THE BROWSER ONLY TO THE BRIDGE`), no sign-in token. An export of another instance is refused, since the Bridge answers
only its own instance's origin.

**The Bridge's per-user data folder**: a folder named after the app's identifier, in the platform's place for an app's
per-user data — `~/Library/Application Support/` on macOS, `%APPDATA%` on Windows, `~/.config/` on Linux —, readable and
writable by its user only, so that the Bridges of two instances on one computer never share one. It holds
`settings.json`, MOD-bridge-http's `pairing-token` and MOD-tunnels' `ssh/`. Nothing in it enters a repository or an
export. The clones lie in the working folders of the agents the Bridge offers, which the person chooses.

**What the build places among the app's resources**, read at start:

- `build.json` — `{ "instance": "alice/agent-m", "appId": "io.github.alice.agent-m.bridge", "origin":
  "https://alice.github.io", "version": "2026.10.0", "commit": "<commit>" }`: the instance whose release this is, the
  app's identifier, the instance's Pages origin — the one origin the API answers across origins —, the version and its
  commit.
- `update-key.pem` — the publisher's public update key, Ed25519, in PEM.
- `app-update.yml` — electron-updater's configuration, written by electron-builder, naming the instance repository's
  releases as the update feed.

A start without them — from the source folder, as in the Bridge's component tests — takes the instance and its origin
from its command line and offers no update.

## Interfaces

- `appDescription` — `{ productName: "Agent M Bridge", main: "src/desktop-shell/main.mjs", window:
  "src/desktop-shell/window.html", preload: "src/desktop-shell/preload.cjs", icons: { macos: string, windows: string,
  linux: string }, resources: { build: "build.json", updateKey: "update-key.pem" } }` — what MOD-bridge-build packages:
  the app's name; its main entry and its window, from which the module folders the app carries are reached through
  their `index.mjs`; its preload; its icons; and the names under which the build places the files above among the app's
  resources.

The rest of its surface faces the person, not another module:

- **Start.** One Bridge runs per user; a second start opens the first one's window. The shell makes the data folder, and
  through MOD-tunnels the key pair (`THE BRIDGE CREATES ITS OWN SSH KEY`); registers with the job runner the strategies of
  every kind a Bridge may run; starts the server on `127.0.0.1` at the settings' port, for the instance's origin, with
  the name of the settings in force and the version of `build.json`, `null` for a start without it, and with the
  handlers of MOD-bridge-jobs, MOD-mail-protocols and MOD-tunnels (`THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY`); opens
  the tunnels (`THE BRIDGE OPENS ITS TUNNELS ITSELF`); and, unless paused, starts watching the served products, so that
  their runs go on while no tab is open (`A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS`). A port in use is shown with
  a field for another; a data folder that cannot be written is shown with its path.
- **Icon and window.** On macOS and Windows the icon in the menu bar or the tray opens the window, pauses or resumes, and
  quits; closing the window leaves the Bridge running. On Linux, where not every desktop shows a tray icon, the window
  stays open while the Bridge runs. The window loads only the app's own files, under a protocol of the app's own, never
  a remote page; a link — an agent's installation page, the dashboard — opens in the person's browser.
- **The window's views**, drawn with the site's frame as the page `bridge`, each with its explanation:
  - *Agents* — every supported agent with its version, ready and logged in, installed but not logged in with its own
    login step (`Agent.login`), or missing with its vendor's installation page for this platform, and *Check again* (`THE BRIDGE FINDS THE INSTALLED AGENTS`, `THE BRIDGE GUIDES THE
    INSTALLATION OF A MISSING AGENT`); a tick for each installed agent the Bridge is to offer, and the working folder of
    each ticked one, chosen with the system's folder dialog; *Test access*, through MOD-bridge-jobs' `testAccess`,
    which names each repository this computer's own git login does not reach, with the reason.
  - *Pairing* — the Bridge's address and its pairing token with *Copy* (`THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS
    WINDOW`); *paired with* the origin MOD-bridge-http's `pairedWith()` gives, or *not yet paired since this start*; and
    *Pair anew*, a decision that names that every paired browser must pair again (`THE BRIDGE IS PAIRED
    ONCE`).
  - *Tunnels* — the jump host; the Bridge's public key with *Copy* and where to add it on the jump host; each tunnel's
    state with its reason.
  - *Settings* — the name, the port, the served products and the interval; *Import a settings export*, with its
    passphrase when the export is locked; what was taken over.
  - *Updates* — the running version, and a newer release when there is one.
- **Pause and quit.** *Pause* stops taking jobs, and the API answers new work with `paused`; jobs already running go on
  and can still be followed and cancelled. *Quit* names the jobs still running, which then end as cancelled, and stops the
  watching, the tunnels and the server.
- **Updates** (`THE BRIDGE IS UPDATED ONLY BY THE PERSON'S CHOICE`), through electron-updater with `autoDownload` off and
  `autoInstallEvent` set to `manual`. At start and once a day the shell reads the update feed of the instance it was
  built for, which downloads no release; it offers a newer release only when the feed's detached signature holds
  against the publisher's key built into the app and the signed feed names the version and files electron-updater
  read. The offer shows the release's notes, rendered by the site's renderer. *Download* — the person's click — fetches
  the file, which becomes installable only when its own detached signature holds, checked in electron-updater's
  `verifyUpdateFile` step on every platform; otherwise the file is deleted and the window says that it is not the
  publisher's. *Install and restart* — a second click, after a decision that names the jobs that would end as cancelled
  — calls `quitAndInstall()`. On macOS and Windows electron-updater also checks the file's code signature. A feed that
  cannot be read, a download that fails and a signature that does not hold each leave the running Bridge as it is, and
  the window says which.

## Files

Reads and writes `settings.json` in the Bridge's per-user data folder, readable by its user only. Reads the app's
resources `build.json`, `update-key.pem` and `app-update.yml`, and a settings export the person chooses, of which it keeps
only its part. A downloaded update lies in electron-updater's cache until it is installed, or is deleted when its
signature does not hold. Writes no repository file; the jobs it composes write through MOD-bridge-jobs.

## Uses

- `MOD-bridge-http.bridgeApi`, `BridgeHandlers`, `serveBridge`, `pairAnew` — the server with the Bridge's handlers and its
  default port; the pairing token shown, and renewed on *Pair anew* or with the token of a Bridge reached through the
  jump host, from an export.
- `MOD-bridge-jobs.jobHandlers`, `startWatching`, `stopWatching`, `testAccess` — the jobs routes; watching the served
  products while not paused; the running jobs named before quitting or installing; the test of the computer's git login.
- `MOD-mail-protocols.mailHandlers` — the mail routes.
- `MOD-tunnels.ensureKey`, `openTunnels`, `closeTunnels`, `tunnelState`, `tunnelHandlers` — the key shown; the tunnels
  opened, closed and shown; the tunnels route.
- `MOD-bridge-client.TunnelPlan`, `JumpHost`, `BridgeEntry`, `tunnelCommands` — the plans in the settings, made from an
  export's jump host and its Bridges reached through the jump host by the same function that writes the dashboard's
  commands.
- `MOD-browser-store.readExport` — reading the dashboard's export with the code that writes it.
- `MOD-agent-processes.Agent`, `installedAgents` — the agents of this computer, with their vendors' installation pages.
- `MOD-job-runner.registerStrategies` — the registry of the Bridge's job runner, filled with the strategies of every kind
  a Bridge may run: `MOD-approvals.approvalStrategies`, `MOD-spec-changes.specStrategies`,
  `MOD-artifact-edits.editStrategies`, `MOD-source-register.sourceStrategies`, `MOD-reuse-facts.reuseStrategies`,
  `MOD-resource-list.resourceStrategies`, `MOD-work-plans.workStrategies`, `MOD-run-planner.runStrategies`,
  `MOD-product-process.processStrategies`, `MOD-test-schedule.scheduleStrategies`,
  `MOD-result-records.resultStrategies`, `MOD-issue-handling.issueStrategies`, `MOD-runtimes.routeStrategies`. The
  strategies of the mail kinds are not registered: a mail kind runs in the page, which asks an agent on the Bridge only
  to draft.
- `MOD-site-frame.PageSetup`, `View`, `Route`, `startPage`, `explain`, `confirmDecision`, `notice` — the window, drawn as
  the page `bridge`; its explanations; the decisions of *Pair anew*, *Quit* and *Install and restart*; its notices.
- `MOD-markdown-render.renderArtifact` — a release's notes, rendered sanitised.
