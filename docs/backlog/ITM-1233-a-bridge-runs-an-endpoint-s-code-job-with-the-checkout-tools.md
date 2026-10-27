---
id: ITM-1233
title: A bridged endpoint's cut answer is continued
level: module
realises:
  - UC-049
modules:
  - MOD-bridge-jobs
  - MOD-bridge-client
builds_on: []
tests:
  - unit
origin:
  - the check of the documents akmaier accepted since 2026-10-25 against the code: the Bridge's endpoint path drops the continuation of a cut answer
---
# ITM-1233 A bridged endpoint's cut answer is continued

**REGISTER**

## Outcome

MOD-endpoint-calls' continuation of an answer cut at the output limit does not reach a bridged endpoint:
`src/bridge-jobs/handlers.mjs:85` keeps only `{ text, calls, usage }` of `endpointExchange`'s answer, and
`src/bridge-client/index.mjs:154` returns no `cut`. Implement it as the module texts state: MOD-endpoint-calls' exchange
returns `{ text, calls, usage, cut?: true }`, and MOD-runtimes' `bridgeDriver` gives the Bridge's `ask` of one exchange,
so that the loop of an endpoint a Bridge calls is that same loop, run in the tab.

## Acceptance

- Tests naming these modules: an exchange ask of MOD-bridge-jobs answered at the output limit is done with `cut: true`,
  one that was not holds no `cut`; MOD-bridge-client's `ask` returns that `cut`; a bridged answer cut at the output limit
  is continued as on the tab and in CI. Counter-proof: before the change none holds.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the modules named and the tests that name them change.
