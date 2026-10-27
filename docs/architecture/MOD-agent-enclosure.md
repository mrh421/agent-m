---
id: MOD-agent-enclosure
title: The enclosure of an agent on a Bridge
folder: src/agent-enclosure/
realises:
follows:
  - ARC-040
  - ARC-054
uses:
  - MOD-agent-processes.Enclosure
provides:
  - AgentEnclosure
  - agentEnclosure
---
# MOD-agent-enclosure The enclosure of an agent on a Bridge

## Responsibility

It belongs to the Bridge (ARC-040), as ARC-054 decides. It states, for the platform the Bridge runs on, what a coding
agent's processes may read, write and reach: nothing that holds a credential of the Bridge or of the computer's git
login, nothing to write but the agent's own home, the job's checkout and temporary files, and the network
(`NO MODEL READS A CREDENTIAL`). It builds the command that starts a CLI inside the enclosure — a Seatbelt profile on
macOS, bubblewrap's arguments on Linux, the Bridge's own account on Windows — and the environment the CLI receives; it
says whether the enclosure works on this computer and, where it does not, names the one-time step that makes it work;
and it opens a terminal in the enclosure for the agent's own login step. It implements MOD-agent-processes' `Enclosure`.
It runs in Node, in the Bridge's main process, and keeps nothing but what it writes into the agent's home.

## Parts

- `index.mjs` — the interface.
- `holders.mjs` — the places that hold credentials, and the environment an agent receives.
- `seatbelt.mjs` — macOS: the profile.
- `bubblewrap.mjs` — Linux: the arguments.
- `account.mjs` — Windows: the account, its one-time setup, its start through the launcher, its grants.
- `launcher.ps1` — Windows: starts one program as the account, with its standard streams relayed and its processes ended
  with the launcher.
- `setup.ps1` — Windows: the one-time step, run elevated: the account made.

## Data

**The places that hold credentials**, hidden — neither read nor written — in every enclosure: the Bridge's data folder
(its pairing token, its settings, its SSH key; MOD-desktop-shell); and, in the person's home, the git login's places —
`.ssh/`, `.git-credentials`, `.config/git/credentials`, `.netrc`, `.cache/git/credential/`, `.git-credential-cache/`,
`.config/gh/`, `.config/glab-cli/` —, each where it exists. Beside them, per platform:

| | macOS | Linux | Windows |
|---|---|---|---|
| the system's credential store | the keychain: `~/Library/Keychains/` hidden, and its services `com.apple.SecurityServer`, `com.apple.securityd.xpc` and `com.apple.secd` refused | the user's runtime folder (`XDG_RUNTIME_DIR`, else `/run/user/<uid>`), where the session bus with the secret service and the SSH and GPG agents listen, replaced by an empty folder | the account's own Credential Manager; the person's is another user's |
| the SSH agent | a connection to the socket the Bridge's `SSH_AUTH_SOCK` names, and to launchd's `/private/tmp/com.apple.launchd.*/Listeners`, refused | in the runtime folder, or the socket `SSH_AUTH_SOCK` names, hidden | the person's agent is another user's |
| the Bridge's process | its memory is refused by macOS to every other process; its environment is not, so the Bridge puts no credential into one (ARC-054) | not seen: a PID namespace of its own | another user's |
| what may be written | the agent's home, the writable folders the Bridge names — the job's checkout and its outbox —, `/private/tmp`, `/dev` | the same, with a private `/tmp` | the account's own profile; the writable folders the Bridge names, granted to the account for writing; the clone of the instance, granted for reading |

**The agent's home**: `home/` in the agent's working folder, with `tmp/`, `.config/`, `.local/share/`, `.cache/` and
`.local/state/` below it; on Windows the account's own profile, `C:\Users\<account>`. The agent keeps its configuration
and its login there.

**The environment** an agent receives, chosen rather than inherited: from the Bridge's environment only `PATH`, `LANG`,
`LC_ALL`, `LC_CTYPE`, `LC_MESSAGES`, `TERM`, `TZ`, `SHELL`, `USER`, `LOGNAME`, and on Windows `SystemRoot`,
`SystemDrive`, `windir`, `ComSpec`, `PATHEXT`, `OS`, `PROCESSOR_ARCHITECTURE`, `NUMBER_OF_PROCESSORS`, `ProgramFiles`,
`ProgramFiles(x86)`, `ProgramW6432`, `ProgramData`, `CommonProgramFiles`; set: `HOME` and the XDG folders below the home
(on Windows `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `HOMEDRIVE`, `HOMEPATH`), `TMPDIR` (on Windows `TEMP` and `TMP`) in
the home, `GIT_TERMINAL_PROMPT=0`, and `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`
from the computer's git configuration (`user.name`, `user.email`), where it names them.

**The Windows account**: `agentm-` followed by the first twelve hexadecimal digits of the SHA-256 of the Bridge's data
folder's path — twenty characters, the most a local account's name may have, one account per Bridge of an instance —,
a member of `Users` only, its password random, never expiring, kept in `agent-account.json` in the Bridge's data folder,
hidden from the sign-in screen.

## Interfaces

- `AgentEnclosure` — MOD-agent-processes' `Enclosure`, and:
  - `home: string` — the agent's home.
  - `works() -> Promise<{ works: true } | { works: false, reason: string, setup: string }>` — whether the enclosure works
    on this computer: on macOS whether `/usr/bin/sandbox-exec` runs a program under a profile; on Linux whether `bwrap`
    runs a program with a PID namespace of its own; on Windows whether the account exists and its password is kept.
    Where it does not, `reason` says what failed in the system's own words and `setup` the one-time step: on Linux
    "an administrator installs the package bubblewrap", or, where it is installed and refused its namespaces, "an
    administrator allows bubblewrap to make user namespaces"; on Windows "an administrator confirms that the Bridge makes
    the account <name>, with the Bridge's *Set up*". Starts the probe's program; changes nothing.
  - `prepare(at: { writable: string[], readable: string[] }) -> Promise<void>` — makes the home and its folders; on
    Windows grants the account the folders of `writable` for changing and those of `readable` for reading, below
    them too. Called before every start.
  - `setUp() -> Promise<{ done: boolean, reason: string | null }>` — the one-time step where the Bridge can take it: on
    Windows the account made — the password written first into the data folder, then `setup.ps1` run through Windows'
    elevation prompt, which an administrator confirms —; elsewhere `{ done: false }` with the step the person's
    administrator takes.
  - `openTerminal(command: string, args: string[]) -> Promise<void>` — the system's terminal opened with the command
    running in the enclosure, its home and its environment, so that the person runs the agent's own login step there
    (UC-044 3b): on macOS a `.command` file in the home opened with `open`; on Linux `x-terminal-emulator -e`; on Windows
    a console started as the account.
- `agentEnclosure({ dataFolder: string, folder: string, platform?: string, env?: Record<string, string | undefined>,
  personHome?: string, identity?: { name: string | null, email: string | null } }) -> AgentEnclosure` — the enclosure of
  the agent whose working folder is `folder`, for a Bridge whose data folder is `dataFolder`; the platform, the Bridge's
  environment, the person's home and the git identity default to those of the running process and the computer's git
  configuration. Pure until a function of the result is called.

MOD-agent-processes' `Enclosure.wrap(command, args, at: { workdir, writable })` returns, for macOS,
`/usr/bin/sandbox-exec -p <profile> <command> <args>`; for Linux, `bwrap <arguments> -- <command> <args>`; for Windows,
`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand <script>`, the script being
`launcher.ps1` followed by `Invoke-Launch -Account <name> -Directory <workdir> -Program <command> -ArgumentLine <the
arguments as one Windows command line, in base64>` — the text is carried in the command, since the Bridge's files lie in
its app archive, which PowerShell cannot read —, with `input`, the password's line the launcher reads first, before the
agent's own input; the password stands in no argument, not in the script and in no variable. Every path in a profile or an argument is resolved through its links first, since the system
matches resolved paths. A path the enclosure must hide that does not exist is left out, since bubblewrap can mount over
existing paths only; one made later is hidden from the next start on.

## Files

Reads the computer's git configuration for the identity. Writes the agent's home and its folders, on macOS a `.command`
file there for the login step, and on Windows `agent-account.json` in the Bridge's data folder and the grants of the
folders it is given. Reads its own `launcher.ps1` and `setup.ps1`.

## Uses

- `MOD-agent-processes.Enclosure` — the type it implements, through which MOD-agent-processes starts a CLI inside it.
