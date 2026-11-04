---
id: ITM-1437
title: A participant added from a Bridge or a runner names its model, place and agent as offered
level: module
realises:
  - UC-017
  - A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL
  - A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
modules:
  - MOD-settings-pages
builds_on:
  - ITM-375
tests:
  - unit
origin:
  - UC017-F1, F2 and F4, TST-375213, 375214 and 375216 of ITM-375's system tests of UC-017 (#1740), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1311-development-release-testing-0375.md)
---
# ITM-1437 A participant added from a Bridge or a runner names its model, place and agent as offered

**REGISTER**

## Outcome

UC-017 step 3 has the person choose an agent from those the Bridge offers, and the row names that agent's model and where it
processes data. The Participants page of MOD-settings-pages falls short three times:
- **F1:** the one-click *Add* sets the model to the agent's name (`claude`), not its model (TST-375213).
- **F2:** a CI agent on a self-hosted runner keeps the place "GitHub hosted runner" (TST-375214).
- **F4:** the agent is free text, so a name no Bridge offers is saved (TST-375216).

## Acceptance

- *Add* fills the model the Bridge reports for the agent.
- A CI agent on a self-hosted runner names that runner's place.
- The agent is chosen from those the Bridge offers; a name it does not offer is not saved.
- TST-375213, 375214 and 375216 lose their `todo` in a commit by a participant who built none of the page (not
  developer-sonnet-j), written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
