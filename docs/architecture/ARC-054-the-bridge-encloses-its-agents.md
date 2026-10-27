---
id: ARC-054
title: The Bridge encloses the agents it starts
refines: ARC-040
forced_by:
  - NO MODEL READS A CREDENTIAL
  - A LOCAL AGENT USES THE PERSON'S OWN LOGIN
  - THE BRIDGE IS ONE FILE PER PLATFORM
  - THE BRIDGE FINDS THE INSTALLED AGENTS
  - THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT
  - THE BRIDGE IS PAIRED ONCE
  - THE BRIDGE CREATES ITS OWN SSH KEY
  - THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
  - A REUSE DECISION RECORDS ITS DUE DILIGENCE
  - DUE DILIGENCE IS FETCHED, NOT RECALLED
  - A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
  - UC-011
  - UC-044
designs:
  - MOD-agent-enclosure
  - MOD-bridge-jobs
  - MOD-agent-processes
  - MOD-desktop-shell
---
# ARC-054 The Bridge encloses the agents it starts

## Context

The Bridge starts coding-agent CLIs on the person's computer (UC-011, UC-044), as the person's own user. Each of them
works with its own tools — reading files, running commands, reaching the web — and every result of a tool reaches the
agent's model. The Bridge holds credentials: its pairing token, the tokens of the remote sessions and whatever else its
settings keep, and its own SSH key, in its data folder (MOD-bridge-http, MOD-desktop-shell, MOD-tunnels); an endpoint's
key and a mailbox password in its memory, for one request (MOD-bridge-jobs, MOD-mail-protocols); and it reaches the
repositories with the computer's own git login — SSH keys, an SSH agent, a credential helper and its store, the system's
keychain (MOD-bridge-jobs). `NO MODEL READS A CREDENTIAL` says that none of these reaches a model, neither in what is sent
to it nor through a tool it calls.

As the person's user, an agent's tools reach all of it. Measured on macOS (`docs/measurements/2026-10-27_what-an-agent-on-a-bridge-reaches.md`):
a child of the person's user reads files of mode 0600 of that user, and the keychain answers its searches, which is where
git's `osxkeychain` helper keeps the computer's git login; it reads the environment of other processes of the user; it
cannot open their memory. Until now the agent also pushed its branch and opened its pull request itself, with the
computer's git login and its own tools (MOD-bridge-jobs). On the server's runners the same rule is met by running the
model as another OS user beside a key holder (ARC-046); on a Bridge it was not met.

The Bridge ships for macOS, Windows and Linux (`THE BRIDGE IS ONE FILE PER PLATFORM`) to a person who may never have used
a terminal, often without administrator rights on a computer they do not administer.

## Decision

**Every process of a coding agent that the Bridge starts runs in an enclosure the operating system enforces; the Bridge
itself does not.** Inside the enclosure the agent reads everything except the places that hold a credential of the
Bridge or of the computer's git login, writes only its own home, the job's checkout and temporary files, and reaches the
network. The enclosure is the new module MOD-agent-enclosure of the Bridge (ARC-040); MOD-agent-processes starts a CLI
through the enclosure it is given, and MOD-bridge-jobs gives every agent process one — a job, an ask, the check whether
the agent is logged in and the harmless probe.

- **The separation is by what the system lets a process reach, not by what a tool may say** — ARC-046's principle for the
  server's runners. A rule an agent's tool has to keep would be kept by the model it serves.
- **Per platform, the simplest enclosure that holds** (`KEEP IT SIMPLE`). The three are the ones Anthropic's
  sandbox-runtime uses for coding agents: "`sandbox-exec` on macOS, `bubblewrap` on Linux", and on Windows "a dedicated
  `srt-sandbox` local user account" (its README, [3] below).
  - **macOS — a Seatbelt profile**, applied by `/usr/bin/sandbox-exec`, which every macOS has: no installation and no
    administrator. The profile allows by default, then denies every write, allows writing the agent's home, the job's
    checkout, `/private/tmp` and `/dev`, denies reading and writing the places that hold credentials, denies the
    keychain's services and denies connecting to the SSH agent's socket. Measured: each of these rules holds for the
    child and what it starts, and HTTPS still works.
  - **Linux — bubblewrap** (`bwrap`), a program of the system: the whole file system bound read-only, the agent's home and
    the job's checkout bound writable, a private `/tmp`, an empty folder over each place that holds credentials and over
    the user's runtime folder — the session bus with its secret service, the SSH and GPG agents —, `/dev/null` over each
    such file, a PID namespace of its own, so that no process of the person is seen, a new session, and an end with the
    Bridge. bubblewrap needs no privilege where the kernel lets a user make namespaces.
  - **Windows — a local account of the Bridge's own**, without administrator rights. Windows offers no enclosure that a
    user without administrator rights can put around a child of their own and that hides the Credential Manager — where
    Git Credential Manager keeps the git login — and the Bridge's process memory: both are open to every process of the
    user. The account has its own profile, its own Credential Manager, and no access to the person's profile or processes.
    The Bridge starts the agent as that account with the account's password, which only the Bridge keeps, in its data
    folder; the job's checkout and the clone of the instance are granted to the account, the checkout for writing.
- **The enclosed agent has a home of its own** — `home/` in the agent's working folder, on Windows the account's profile —,
  with its own configuration and its own login (`A LOCAL AGENT USES THE PERSON'S OWN LOGIN`, read as: the agent's own
  login on this computer, made by the person with the agent's own login step; Agent M asks for no key). The person's own
  configuration of the agent is neither read nor written by the enclosed one: a hook written into it would run outside the
  enclosure the next time the person uses the agent. On macOS this follows anyway: the keychain, where Claude Code keeps
  its login, is closed, and Claude Code inside the profile reports no login (measured).
- **The environment is chosen, not inherited** — the same rule as on the server's runners (MOD-workflow-entries, *The
  model's user*): the agent receives the variables a program needs to run — the path, the language, the terminal, its
  home and the folders below it — and the git identity the computer's configuration names for its commits, and nothing
  else: no key variable, no SSH agent, no session bus.
- **Git stays with the Bridge** (`NO MODEL READS A CREDENTIAL`; nothing twice — the push address of CI's agent machine,
  MOD-workflow-entries). The Bridge clones the job's checkout with the computer's git login before the agent starts and
  sets its push address to an outbox, a bare repository beside it, in which the agent's pushes land. After the agent has
  answered, the Bridge fetches the outbox's branches into its own clone of the product — which the agent cannot write —
  and pushes every branch the agent made or moved to the origin, never forced; the job's writer then reads the branch and
  opens the pull request through the Bridge's host of the product, which opens it with the server's own command-line
  client logged in as the person (`gh` on GitHub), outside the enclosure. The Bridge never runs git with the computer's
  login in a repository the agent can write: a hook or a command in that repository's configuration would run with the
  person's rights, the alternative ARC-046 rejects for CI.
- **No enclosure, no agent** — no silent weakening. Before it starts an agent, the Bridge asks the enclosure whether it
  works on this computer. Where it does not — bubblewrap missing or refused its namespaces, the account not made — the
  Bridge starts no agent: the agent is shown as not ready, a job ends failed and an ask fails, each naming the reason and
  the one-time step that makes it work.
- **The one-time steps** are named by the enclosure and shown in the Bridge's window:
  - on every platform, once per agent: the agent's own login step, run in the enclosure, with its home;
  - on Linux, where bubblewrap is missing: an administrator installs the package `bubblewrap`; where it is installed but
    may not make namespaces, an administrator allows it;
  - on Windows: an administrator confirms, once, that the Bridge makes its account — Windows' own elevation prompt —;
    then the person installs the agent for that account and logs it in, in a console the Bridge opens as that account.
- **Endpoint keys stay where they are.** The Bridge gives no CLI a model endpoint and no key variable (`A LOCAL AGENT USES
  THE PERSON'S OWN LOGIN`); the key of an endpoint it calls for the page lives in its own memory for that request, which
  the enclosure keeps out of reach: macOS refuses another process's memory to a process of the same user, the Bridge is
  built with the hardened runtime (MOD-bridge-build), Linux's agent sees no process of the person, and on Windows it is
  another account. MOD-endpoint-calls' key holder, which serves where a model works in a checkout with a key the machine
  holds, has no such model on a Bridge.

### Responsibility within the system

MOD-agent-enclosure states, for the platform it runs on, what an agent process may read, write and reach, builds the
command that starts a CLI inside it and the environment it receives, says whether the enclosure works on this computer,
and names the one-time step where it does not. It belongs to the Bridge (ARC-040); nothing else starts a coding agent on
a person's computer.

### The interface it offers

| Module | Functions other subsystems use |
|---|---|
| MOD-agent-enclosure | `AgentEnclosure`, `agentEnclosure` |

MOD-agent-processes, of Participants and jobs (ARC-046), defines the type `Enclosure` — what it needs to start a CLI
inside an enclosure — and takes one as an option of its driver, of its list of installed agents and of its probe.
MOD-agent-enclosure implements that type, as the drivers implement MOD-job-runner's `Driver`: the Bridge's module points
to the lower layer, never the other way.

## Alternatives

- **A separate OS user on every platform, as on the server's runners.** It holds everywhere. Rejected for macOS and
  Linux: it needs an administrator on every computer — the user, and a rule that lets the person's user start processes
  as it —, a home the Bridge copies the checkouts into and reads back from, and a login of the agent made as that user,
  while the system's own sandbox holds there without an administrator (`KEEP IT SIMPLE`). Chosen for Windows, where no
  same-user enclosure holds.
- **macOS App Sandbox.** It is given to an app by entitlements in the app's own signature; the agents' executables are
  their vendors', signed by them. Rejected.
- **Linux Landlock.** It restricts a process from inside, through system calls Node does not offer: a native module in
  every Bridge, and only rules that allow, without the PID namespace bubblewrap gives. Rejected (`KEEP IT SIMPLE`).
- **Linux firejail.** A program installed set-user-ID root, whose adoption is a hundredth of bubblewrap's (below).
  Rejected.
- **Windows AppContainer, or a restricted token.** Both are put on a child without an administrator, and both deny the
  child the person's profile — and with it the agent's own installation, its configuration and every tool it runs from
  the profile —, until the Bridge grants each folder; an AppContainer also cannot reach the computer's loopback without
  an exemption an administrator sets. Rejected for the grants they need everywhere, which the Bridge could not know.
- **Adopting sandbox-runtime.** It encloses with the same three mechanisms, and adds what Agent M does not need: proxies
  that filter the network by domain, a configuration language of its own, and on Windows a machine-wide network filter
  installed by an administrator; its versions are `0.0.x`. The enclosure the Bridge needs is a profile, a list of
  arguments and an account. Rejected (`KEEP IT SIMPLE`, `YOU AREN'T GONNA NEED IT`); its choices are the evidence for
  this decision's.
- **Protecting only the places that hold credentials, and letting the agent write everywhere else.** Rejected: an agent
  that may write the person's `~/.gitconfig`, a git or ssh binary below a folder the person can write (Homebrew's), or
  the Bridge's own clones makes the Bridge's next git command run its code with the person's rights, outside the
  enclosure.
- **Hiding only the Bridge's data folder.** Rejected: the git login the Bridge pushes with is a credential the Bridge uses
  as much as the ones it keeps.
- **The agent keeping the computer's git login to push and to open its pull request.** Rejected: through that login its
  model reaches the credential — `git credential fill`, the SSH agent.
- **The person's own configuration and login of the agent shared with the enclosed agent.** Rejected: on macOS the
  keychain that holds the login is the keychain that holds git's; and a hook the enclosed agent writes into the shared
  configuration runs unenclosed.
- **Routing endpoint keys through the key holder on the Bridge.** Not needed: the Bridge starts no CLI with an endpoint,
  and its own endpoint calls run in its own process (`YOU AREN'T GONNA NEED IT`).
- **Running agents unenclosed where the enclosure does not work, with a warning.** Rejected: a weakening the person did
  not choose; the agent is not started and the one-time step is named.

## Due diligence

The enclosure adopts one program that does not come with the operating system: bubblewrap on Linux. `sandbox-exec` is
part of macOS, a local account part of Windows. Agent M's own licence is MIT (its `LICENSE` file). Adoption is the number
of Debian installations that report the package to Debian's popularity contest on 2026-10-26, or, for an npm package, its
downloads in the last month the registry reports.

| Candidate | Licence | Compatible with MIT | First release | Latest release | Releases | Open / closed issues | Adoption | Read from | Read on |
|---|---|---|---|---|---|---|---|---|---|
| bubblewrap — chosen | LGPL-2.1 (its `COPYING`) | yes for this use: the Bridge runs the system's program and neither links nor ships it | v0.1.3, 2016-10-14 (the repository since 2016-02-16) | v0.13.1, 2026-10-14 | 28 (28) on GitHub; 32 tags | 156 / 246 | 135,387 installations | [1] | 2026-10-27 |
| firejail | GPL-2.0 | yes for this use, as above | 0.9.62.2, 2020-08-11, the oldest GitHub lists | 0.9.80, 2026-03-14 | 16 (13) on GitHub | 504 / 3,037 | 1,257 installations | [2] | 2026-10-27 |
| @anthropic-ai/sandbox-runtime | Apache-2.0 | yes | 0.0.1, 2025-10-20 | 0.0.81, 2026-10-20 | 77 (77) | 136 / 40 | 733,216 (2026-06-02 to 2026-07-01, the newest month the registry reported) | [3] | 2026-10-27 |

No candidate is marked: every licence is known to be compatible with MIT for the use made of it.

- [1] https://api.github.com/repos/containers/bubblewrap · https://api.github.com/repos/containers/bubblewrap/releases ·
  https://api.github.com/repos/containers/bubblewrap/tags ·
  https://api.github.com/search/issues?q=repo:containers/bubblewrap+is:issue+is:open and `+is:closed` ·
  https://raw.githubusercontent.com/containers/bubblewrap/main/COPYING ·
  https://qa.debian.org/cgi-bin/popcon-data?packages=bubblewrap · https://sources.debian.org/api/src/bubblewrap/
- [2] https://api.github.com/repos/netblue30/firejail · https://api.github.com/repos/netblue30/firejail/releases ·
  https://api.github.com/search/issues?q=repo:netblue30/firejail+is:issue+is:open and `+is:closed` ·
  https://qa.debian.org/cgi-bin/popcon-data?packages=firejail
- [3] https://registry.npmjs.org/@anthropic-ai%2Fsandbox-runtime ·
  https://api.npmjs.org/downloads/point/last-month/@anthropic-ai/sandbox-runtime ·
  https://api.github.com/search/issues?q=repo:anthropics/sandbox-runtime+is:issue+is:open and `+is:closed` · its README:
  https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

## Consequences

- A model working through an agent on a Bridge cannot read the Bridge's data folder, the computer's git login, its SSH
  keys and agent, or the keychain (macOS), the session bus and the user's runtime folder (Linux), or the person's profile
  and Credential Manager (Windows), and cannot write where the Bridge or the person would run what it wrote.
- Every agent a Bridge offers needs one login of its own, in its enclosure; a Windows computer needs an administrator
  once, a Linux computer without bubblewrap too. Until then the Bridge offers the agent as not ready and says why.
- The agent no longer pushes or opens its pull request: the Bridge does, with the computer's git login and, on GitHub,
  the person's `gh`. Without `gh` the job ends with its branch pushed and no pull request, and says so; on GitLab the
  Bridge opens no merge request.
- What remains within an enclosed agent's reach, stated rather than closed: on macOS the environment the Bridge was
  started with (measured), so the Bridge puts no credential into an environment; on Linux a session bus that listens
  on an abstract socket instead of in the runtime folder; on every platform the person's other files that are not among
  the Bridge's or git's credential holders — a package registry's token in `~/.npmrc`, a cloud's in its own folder —, and
  the agent's own login in its own home.
- The macOS profile and the Linux arguments are tested by construction on every platform and run on macOS; the Linux
  enclosure and the Windows account are tested by construction only until they run on such a computer.
