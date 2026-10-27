---
id: ITM-1230
title: opencode is ready with a free model
level: module
realises:
  - THE BRIDGE FINDS THE INSTALLED AGENTS
  - A LOCAL AGENT USES THE PERSON'S OWN LOGIN
  - UC-044
modules:
  - MOD-agent-processes
builds_on:
  - ITM-1002
tests:
  - unit
origin:
  - akmaier: "It must work with free models too" — opencode installed on a Mac with no credential answers with a free model, yet the Bridge marks it not logged in and refuses to run it
---
# ITM-1230 opencode is ready with a free model

**REGISTER**

## Outcome

opencode answers with its free models without any credential. On this Mac, opencode 2.1.4 (Homebrew) with no
credential stored: `opencode auth list` prints `No authenticated integrations`; `opencode models` lists
`opencode/big-pickle`, `opencode/glm-5.3-flash-free` and seven more; `opencode run --format json "Answer with the one
word: ok"` prints one event `{"type":"text",…,"part":{…,"text":"ok"}}` and ends with status 0. opencode 1.19.0 (npm,
the version CI installs) behaves alike: `auth list` ends `0 credentials`, `models` lists eleven `opencode/…` models.

The register row of opencode (`src/agent-processes/agents.md`) asks whether it is logged in with `auth list` and counts
at least one credential (`countPattern` `(\d+)\s+credentials?`). `installedAgents` (`src/agent-processes/index.mjs:56`)
therefore gives `loggedIn: false`, and `processes.mjs:130` refuses the task (`AgentNotLoggedIn`): the Bridge shows
opencode as not logged in and never runs it.

The row's Login check asks instead whether opencode has a model it can use — `opencode models`, ready where it lists a
model (`provider/model`) — which holds with a free model and with a credential, on 1.19 and 2.1 alike, and fails where
no model is usable (on 2.1.4, with free models switched off by `OPENCODE_DISABLE_FREE_MODELS=1` and no credential,
the list is empty; 1.19.0 does not read that variable). The row's `login` stays `opencode auth login`, shown where no model is usable. This is a changed row of the
register, which the architecture states as data (MOD-agent-processes, Data: "a changed CLI is a changed row"); the code
does not change unless a check form the row needs is missing.

## Acceptance

- Unit tests naming MOD-agent-processes, with a fixture `opencode` on a controlled path: listing a model, with no
  credential, it is installed and logged in; listing none, it is not, and its login step is `opencode auth login`.
  Counter-proof: before the change the first reads `loggedIn: false`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/agent-processes/` and the tests that name MOD-agent-processes change.
