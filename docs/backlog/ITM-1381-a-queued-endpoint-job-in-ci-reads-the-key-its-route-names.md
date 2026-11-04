---
id: ITM-1381
title: A queued endpoint job in CI reads the key its route names
level: module
realises:
  - UC-010
  - A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
modules:
  - MOD-workflow-entries
builds_on:
  - ITM-1378
tests:
  - unit
origin:
  - developer-sonnet-k's note in ITM-1378's pull request (#1659), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1143-development-release-testing-1378.md)
---
# ITM-1381 A queued endpoint job in CI reads the key its route names

**REGISTER**

## Outcome

MOD-participant-list: "a model endpoint's route may add ` secret <NAME>`, the CI secret of its key, for work handed to CI".
MOD-workflow-entries runs a queued job "with the driver of its participant … the participant's key from its secret"
(MOD-workflow-entries.md:217-221). For a queued job, the entry reads the secret's name only from a route `ci <runner>
secret <NAME>` (`src/workflow-entries/product.mjs:36`, `:201`, `:302`), so a model endpoint's job, whose route is `endpoint
<name> secret <NAME>`, runs without its key, and the machine that holds that key does not take it.

## Acceptance

- A queued job of a model endpoint whose route names ` secret <NAME>` is taken by the machine that holds that secret, and
  its driver gets that key, read from the participant's route in the register, as for a CI agent.
- TST-373211 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed;
  that commit also gives `tests/uc-010-harness.mjs` the stored endpoint of `ci-bot`.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
