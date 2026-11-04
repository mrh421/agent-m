---
id: ITM-1378
title: A CI start record names its participant's driver
level: module
realises:
  - UC-010
  - AGENT M WORKS WITHOUT A LOCAL INSTALLATION
modules:
  - MOD-runtimes
builds_on:
  - ITM-373
tests:
  - unit
origin:
  - finding UC010-F1 of ITM-373's system test TST-373211 (#1654), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1118-development-release-testing-0373.md)
---
# ITM-1378 A CI start record names its participant's driver

**REGISTER**

## Outcome

UC-010 step 3: the job workflow calls the endpoint. MOD-workflow-entries runs a queued job "from its record alone … with
the driver of its participant, a coding-agent process or a model endpoint" (MOD-workflow-entries.md:217-221), and reads the
driver from the record's parameters (`src/workflow-entries/product.mjs:57-65`). MOD-runtimes offers a model endpoint whose
route names the CI secret of its key "on the server's runners too, where Agent M's own loop calls that endpoint"
(MOD-runtimes.md:235-238). A start the dashboard queues on the CI route carries only the kind's parameters
(`src/review-pages/jobs.mjs:159-195`), so the entry throws `NoDriver` and the job fails.

## The reading taken

The endpoint's address and model live only in the browser's configuration, so the start of a job on the CI route is where
they reach CI. `queueJob` is the one function every page queues a job through, so the record gets them there, for every
page at once.

## Acceptance

- A job `queueJob` commits on the CI route for a model endpoint names in its record the endpoint's address and model and
  the CI secret of its key, as the start from the server's page gives them (`endpoint`, `secret`). No key is written.
- Before the job starts, its probe names every page whose queued start moves with it.
- TST-373211 also needs the key the entry reads; its `todo` is lifted under ITM-1381.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
