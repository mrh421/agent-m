---
id: ITM-561
title: A context too small names the requirements or use cases that do not fit
level: module
realises:
  - UC-019
  - NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
  - NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY
modules:
  - MOD-job-runner
  - MOD-spec-changes
  - MOD-approvals
  - MOD-prompt-bar
  - MOD-site-frame
builds_on:
  - ITM-514
tests:
  - unit
origin:
  - ITM-514's finding S10 (TST-377011, TST-418121), gate docs/gates/20261016-1655-development-release-testing-70c2.md
  - TST-579207 of ITM-579 (UC-005 2a), the same finding on the run panel, ruled at its gate in team1's sprint 142 (docs/gates/20261101-1611-development-release-testing-0579.md)
---
# ITM-561 A context too small names the requirements or use cases that do not fit

**REGISTER**

## Outcome

When the context is too small, the job runner's `prepareJob` names the tokens and a larger participant, where UC-019
(4a) names the number of requirements or use cases that do not fit.

**Not ready for a sprint yet.** Its readings are settled from UC-019 4a and MOD-job-runner's `Prepared` before it is
selected: which module words the reason, whether `notFitting` carries the count, and how the bar and the run panel show
it.

**What `Prepared` holds**, read at sprint team1/50. `notFitting` gives `{ participant, size, context }` per participant
(MOD-job-runner, Interfaces, `Prepared`), and nothing names how many requirements or use cases a part holds, or how many
of them fit. The count and "how much fits" therefore need either a field of `Prepared` or a function of MOD-job-runner
that gives them. Either is a draft of MOD-job-runner's interface, made once the source of the count is read from the
recipes that give `named-requirements`, `spec-with-queues` and `use-case-with-neighbours`.

## Acceptance

- ITM-514's todo tests TST-377011 and TST-418121 pass, with counter-proofs; TST-579207 loses its `todo` in a commit by a
  participant other than the implementer.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The drafts are on `main`**, by developer-sonnet-d, one per module. The item is built once all five are accepted.
- `093bffd7` (MOD-job-runner): the runner counts every part's `artifacts` by `kindOfIdentifier`, and names no recipe.
- `3449dc2c` (MOD-spec-changes): `named-requirements` carries each requirement as an artifact.
- `9776c220` (MOD-approvals): `use-case-with-neighbours` carries each use case and requirement as an artifact.
- `5b78c1b4` (MOD-prompt-bar): the bar's wording.
- `701fc406` (MOD-site-frame): the run panel's wording, which rests on MOD-site-frame's draft `3ef0fce2`.

**The artifacts and `candidate-classes`, read for the drafts.** Of the kinds that use `named-requirements` or
`use-case-with-neighbours`, only `change-requirements` runs `candidate-classes` (MOD-job-catalogue.md, its kinds' table).
Its `spec-with-queues` part already carries every requirement of the SPEC as an artifact, keyed by its name and its rule
(MOD-spec-changes.md, `spec-with-queues`). So the artifacts `named-requirements` now carries add no key, and the classes
do not change. `change-use-case` runs no `candidate-classes`.

