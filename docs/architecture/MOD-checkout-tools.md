---
id: MOD-checkout-tools
title: A model endpoint's tools in a job's checkout
folder: src/checkout-tools/
realises:
follows:
  - ARC-046
uses:
  - MOD-job-runner.Strategies
  - MOD-job-runner.JobContext
  - MOD-job-runner.withheld
  - MOD-agent-processes.stopTree
provides:
  - checkoutStrategies
  - checkoutPrompt
---
# MOD-checkout-tools A model endpoint's tools in a job's checkout

## Responsibility

It belongs to Participants and jobs (ARC-046). It gives a model endpoint that works in the checkout of a job's product —
in CI — the tools a coding agent works with: reading, writing and editing the checkout's files, running
commands in it, searching it, and fetching a web page; and the prompt that names the endpoint's environment and how it
uses those tools. Each tool is a strategy of the job runner, which carries a call out when the endpoint makes it in the
execution loop of MOD-endpoint-calls (Vibe Coding, ch. 11). The tools are ported from opencode, under its MIT licence,
whose notice every file that ports its code keeps. It runs in Node only: the Workflows register its
strategies; the browser does not, and keeps the read-only tools of MOD-job-runner. It keeps nothing.

## Parts

- `index.mjs` — the interface.
- `paths.mjs` — every path held inside the checkout.
- `files.mjs` — `read` and `write`.
- `edit.mjs` — `edit` and its matcher.
- `shell.mjs` — `bash`.
- `search.mjs` — `grep` and `glob`.
- `webfetch.mjs` — `webfetch`.
- `prompt.md` — the prompt, as data.

## Data

**The tools.** Their names, the capability each needs, the descriptions the endpoint reads and the schemas of their
arguments are rows of MOD-job-catalogue's `tools.md`, kept once (`ONE DEFINITION, THREE DRIVERS`). What each does:

| Tool | Needs | What it does |
|---|---|---|
| `read` | read the repository | a file, each line as `N: text`, from line `offset` (1), at most `limit` lines (2000) and 50 KB, a line cut at 2000 characters; the closing line `(Showing lines a-b of N. Use offset=n to continue.)`, `(Output capped at 50 KB. Showing lines a-b. Use offset=n to continue.)` or `(End of file - total N lines)`; a folder's entries; a binary file refused; for a missing file, up to three names of its folder that resemble it |
| `write` | write to the repository | a whole file, its folders created; the byte-order mark of the file or of the content kept, and a file's CRLF line endings kept where the content has none of its own |
| `edit` | write to the repository | one text replaced, or every occurrence with `replaceAll`, found by opencode's matcher: exactly, then with typographic quotes, dashes and spaces made plain, then line by line without trailing whitespace — on the LF view of the file, its own line endings and byte-order mark kept. Its refusals are opencode's: an empty `oldString` (use `write`), `Could not find oldString in <path>…`, `Found N matches for oldString, but expected exactly one…`, `No changes to apply…` |
| `bash` | run code and tests | one command run by the shell with `-c`, in the checkout or its folder `workdir`, with no input; its combined output, of which the model reads the last 2000 lines and 50 KB, the whole then saved to a file outside the checkout that the text names; its exit code in the text; after `timeout` ms — two minutes by default — SIGTERM to the command's whole process group and SIGKILL three seconds later, in opencode's words |
| `grep` | read the repository | the lines that match a regular expression in the files `git ls-files -co --exclude-standard` lists below `path`, whose name matches the glob `include`; at most 100, in opencode's form: `Found N matches`, each file's path followed by `  Line n: text`, the note on truncated results, or `No files found` |
| `glob` | read the repository | the files git lists below the folder `path` whose path matches a glob; at most 100, each by its full path, with the note on truncated results, or `No files found` |
| `webfetch` | reach the web | a page by its http or https address, as markdown, text or html, within `timeout` seconds — 30 by default, at most 120 —, at most 5 MB, refused in opencode's words otherwise; its text begins by saying that it is web content, not a registered source |

Every path a tool is given is read against the job's checkout, `JobContext`'s `product.checkout`, and resolved through
every symbolic link, and so is every file `grep` reads among those git lists. A path that lies outside, a link that
leads out, and a job without a checkout are refused, the refusal naming why; `grep` names each listed file it refuses at
the end of its answer. `read`, `edit` and `grep` refuse a path whose content is a restricted source's that the drafter's
place is not allowed, in MOD-job-runner's words (`RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS`). A command of
`bash` runs with the rights of the program that runs the job, as a coding agent's command does; only its working folder
is held inside the checkout. The environment variables the registering program names — the endpoint's key and every
variable a CI secret fills — are not in its environment (`A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET`). On
the server's own runners that program — and with it every tool, in its process and in `bash` — runs as the model's own
user, who holds no key and no token and may not use sudo, while the key stays with the machine's user in the key holder
(MOD-workflow-entries, *The model's user*); there no credential is within a command's reach (`NO MODEL READS A
CREDENTIAL`). A
tool answers each failure of its own as text and throws nothing, so that every call gets a result.

**The prompt**, `prompt.md`, about forty lines: the environment — the working folder, the platform, the date, and
whether the folder is a git checkout and on which branch —; how the tools are used — the dedicated tools rather than
`cat`, `grep` or `sed` in bash, `workdir` rather than `cd`, never the `N: ` prefix of `read` in an edit —; verifying a
change with the project's own tests, found in the project rather than assumed; and Agent M's rule for git in a job: a
branch of one's own, never the default branch, no key, token or words of the task in a commit message, no force-push.

## Interfaces

- `checkoutStrategies({ hidden }: { hidden: string[] }) -> Partial<Strategies>` — the strategies `tools.read`,
  `tools.write`, `tools.edit`, `tools.bash`, `tools.grep`, `tools.glob` and `tools.webfetch`, each `(args, context) ->
  Promise<string>`, by the names of their rows in `tools.md`; `hidden` names the environment variables a command of
  `bash` does not receive. A program registers them once, with MOD-job-runner's `registerStrategies`.
- `checkoutPrompt({ folder, now }: { folder: string, now: Date }) -> Promise<string>` — the prompt with its environment
  filled in for the checkout `folder` at the date of `now`; the driver sends it as the endpoint's system prompt.

## Files

It reads and writes the files of the checkout it is given, and nothing else of Agent M's. `bash` runs commands in that
checkout and writes the whole of an output it cut to a new file in the system's temporary folder. It reads its own
`prompt.md`.

## Uses

- `MOD-job-runner.Strategies`, `MOD-job-runner.JobContext` — the strategy type its tools are, and the context a call
  reads, its checkout among it.
- `MOD-job-runner.withheld` — the refusal of a restricted source's content.
- `MOD-agent-processes.stopTree` — ending a command's whole process group.
