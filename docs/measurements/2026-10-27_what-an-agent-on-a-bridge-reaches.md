# What a coding agent started by a Bridge reaches on macOS, and what Seatbelt closes

**MEASUREMENT** — 2026-10-27, macOS 27.0.1 (build 26A434), Node 25.9.0, Python 3.14, as the computer's ordinary user
(member of `admin` and `_developer`; developer mode disabled), worktree at commit `1a812927e`. Method: every probe runs
once as a plain child process — what a coding agent's tool is — and once under `/usr/bin/sandbox-exec -f <profile>`,
with fixture files and fixture processes only; no credential of the computer was read. Each negative is shown beside a
known positive of the same probe. The profiles and probe scripts were temporary files outside the repository.

## Results

| Probe | Plain child | Under the profile | Profile rule |
|---|---|---|---|
| `security find-certificate -c "Apple Root CA" …/SystemRootCertificates.keychain` (a public certificate: the known positive of a keychain search) | found, exit 0 | not found, exit 44 | `(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd.xpc") (global-name "com.apple.secd"))` |
| `claude auth status`, output discarded | exit 0 (logged in) | exit 1 (not logged in) | the same rule: Claude Code keeps its login in the keychain |
| `node -e fetch("https://api.github.com/zen")` | — | 200 | the same rule: HTTPS still works |
| read a fixture file in a fixture "data folder" | — | `Operation not permitted`; listing the folder too | `(deny file-read* file-write* (subpath "<data folder>"))` |
| write a fixture file outside the writable folders | — | `Operation not permitted`; writes in the writable folders and to `/dev/null` succeed; `$TMPDIR` of the user is not writable | `(deny file-write*)` followed by `(allow file-write* (subpath …))` — a later rule overrides an earlier one |
| connect to a fixture Unix socket | `hello` | `EPERM` | `(deny network-outbound (remote unix-socket (path-regex …)))` |
| read the environment of the parent process (`sysctl` `KERN_PROCARGS2`, a fixture marker variable) | marker found | marker found; neither `(deny process-info* (target others))` nor `(deny sysctl-read (sysctl-name-prefix "kern.proc"))` hides it; only denying every `sysctl-read` does, which breaks Python's start | — |
| read the environment of a sibling `node` process | marker found | marker found | — |
| `task_for_pid` on another process of the same user (`node`) | `KERN_FAILURE` (5); on itself 0, the known positive | — | — |
| `ps` | runs | `execvp() of 'ps' failed: Operation not permitted` (a set-user-ID program) | — |

## What follows from it

- A process the person's user starts reads every file of that user, and the keychain answers its searches; the Bridge's
  data folder, its mode 0600 notwithstanding, and git's keychain login are within reach of a plain child.
- Seatbelt closes files, the keychain and Unix sockets for the child and everything it starts; it leaves the network open.
- It does not close the environment of other processes of the user: whatever stands in the environment the Bridge was
  started with is readable. Process memory is closed by the system itself (`task_for_pid` fails without developer mode).
