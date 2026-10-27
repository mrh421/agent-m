---
id: ITM-444
title: Specification and design together, for deriving the architecture
level: subsystem
realises:
  - UC-022
  - THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
  - AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT
  - A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
  - AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
modules:
  - MOD-approvals
  - MOD-spec-changes
  - MOD-artifact-edits
integrates: ARC-041
builds_on:
  - ITM-437
  - ITM-438
  - ITM-336
  - ITM-436
  - ITM-328
  - ITM-330
  - ITM-387
tests:
  - component
origin:
  - UC-022 steps 3 to 9
built_by:
  - 124d0167aa7badd21597f07929ba3022b810ca19
---
# ITM-444 Specification and design together, for deriving the architecture

**REGISTER**

## Outcome

Component tests of the strategies with which Specification and design drafts and writes a first architecture:
`derive-architecture` and its review kind `review-architecture` prepared and run through MOD-job-runner with the three
modules' strategies, the source register's chapters, the built-in checks `document-schema`, `graph-checks` and
`candidate-classes`, and MOD-reuse-facts' step `due-diligence` over a fixture registry; a fixture drafter, a fixture
reviewer of another model, and a fixture repository host. The drafter receives the whole SPEC, every accepted use case
and chapters 9 to 12, the reviewer the complete draft with the same; a reviewer's finding goes back and an answered one
ends the loop; the files are written open in one commit whose message names the version, the participant and the model.
A fault the tests find is fixed in the folder of the module it names.

## Acceptance

- Component tests run the kind from preparation to its writer's commit, with the parts each recipe gives, a reviewer's
  finding sent back and answered, the due-diligence section added, and the provenance lines on the commit; each states
  its input, precondition and expected result readable without running it.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only the tests that name MOD-approvals, MOD-spec-changes or MOD-artifact-edits change, and, for a fault a test finds,
  the folder of the module it names.
