---
id: ITM-1379
title: A job on the server's runners says its calls are billed per use
level: module
realises:
  - UC-010
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-review-pages
builds_on:
  - ITM-373
tests:
  - unit
origin:
  - finding UC010-F2 of ITM-373's system test TST-373210 (#1654), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1118-development-release-testing-0373.md)
---
# ITM-1379 A job on the server's runners says its calls are billed per use

**REGISTER**

## Outcome

UC-010 (Precondition): on Agent M's first level "the calls are billed per use by the agent's provider — the run panel says
so". MOD-site-frame's run panel names the destinations, and "What the panel of a use case names besides — the route, the
gates the jobs will meet — the view shows beside it" (MOD-site-frame.md:256-257). The sentence stands only in the folded
explanation of the Settings page's job-workflow line (`src/site-frame/explanations.md:500`).

## Acceptance

- Where the drafting page of the use cases offers a job on the server's runners, the route it shows beside the run panel
  says that the calls are billed per use by the agent's provider.
- Other views that offer the CI route are named in the pull request; nothing waits on them.
- TST-373210 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
