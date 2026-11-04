---
id: ITM-1365
title: The issue page hands its work to no person
level: module
realises:
  - UC-012
  - A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-585
tests:
  - unit
origin:
  - finding UC012-R1 of ITM-585's release test TST-585306 (#1645), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1018-development-release-testing-0585.md)
---
# ITM-1365 The issue page hands its work to no person

**REGISTER**

## Outcome

UC-012's Actors: the participant is "the model endpoint or agent the author hands the work to". The issue page's run
panels offer every participant that has the kind's capabilities, a person of the register included
(`src/maintenance-pages/issues.mjs:134-136`, `runSection`: `participantsOf`, then `eligible` over capabilities only).
MOD-participant-list's `eligible` judges capabilities, places, context and difference only, and its interface tells the
caller: "a person holds roles and decides, but is no driver of a job, so a caller choosing who receives a job asks among
the other four types" (MOD-participant-list.md:92-94).

## Acceptance

- Every run panel of the issue page offers only participants whose type is not `person`; a person with the kind's
  capabilities is not offered. Where no other participant is eligible, the page says so as it does today.
- TST-585306 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
