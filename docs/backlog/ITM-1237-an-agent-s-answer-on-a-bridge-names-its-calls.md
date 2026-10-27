---
id: ITM-1237
title: An agent's answer on a Bridge names its calls
level: module
realises:
  - UC-049
modules:
  - MOD-bridge-jobs
builds_on: []
tests:
  - unit
origin:
  - the live test of the Bridge on 2026-10-27 (real Electron 44.5.1, opencode 2.1.4): GET /v1/ask/{ask} of an agent's ask answered without calls
---
# ITM-1237 An agent's answer on a Bridge names its calls

**REGISTER**

## Outcome

MOD-bridge-http's route table gives `GET /v1/ask/{ask}` as `{ state, text, calls, usage, error }`, `calls` "empty for
any other request" than an exchange of a tool loop. On the live Bridge an ask of opencode answered
`{"state":"done","text":"Blue","usage":{…},"error":null}` with no `calls`: `src/bridge-jobs/handlers.mjs:77`
(`"POST /v1/ask"`) keeps `{ state, text, usage, error }` for an agent's ask and an endpoint's `input` ask; only the
exchange (`:82`) sets `calls`. Every answer carries `calls`, `[]` where no exchange made any.

## Acceptance

- Unit tests naming MOD-bridge-jobs: the answer of an agent's ask and of an endpoint's `input` ask holds `calls: []`; an
  exchange's still holds its calls. Counter-proof: before the change the first two have no `calls`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/bridge-jobs/` and the tests that name MOD-bridge-jobs change.
