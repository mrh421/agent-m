---
id: ITM-351
title: Agent M's job workflow and its secrets on the settings page
level: module
realises:
  - UC-010
  - A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
  - A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
  - EVERY SETTING IS REACHED FROM ONE PAGE
  - ONE CLICK PER DECISION
  - EVERY STEP EXPLAINS ITSELF
modules:
  - MOD-settings-pages
builds_on:
  - ITM-311
  - ITM-322
  - ITM-349
tests:
  - unit
origin:
  - UC-010 precondition
built_by:
  - 1f4c9713d0a0ef1146a87a121826fc4e92334ace
  - 8b69d32c3ffe0137f1acfede5c5759b08584e617
  - 715933e631b522076991606f8a41c20aa08753f7
  - 6409b3b75c6f1fbc722df217ded2e248b4fbe4e1
  - 582047ff1af9e252f88f80be356799c86685232e
---
# ITM-351 Agent M's job workflow and its secrets on the settings page

**REGISTER**

## Outcome

In a product's section of the settings page, the line *Agent M's job workflow*, as MOD-settings-pages' file states it:
installed or not, by whether the product's default branch holds the files `jobWorkflowFiles` gives (ITM-322) for the
instance's current commit, the CI participants' secrets and their runners; *Install*, one click, committing those files
as the person's commit — offered again when the committed files differ, which moves the product to the instance's
current commit. Beside it, the two secrets the workflow reads — `AGENT_M_TOKEN` and each CI participant's key secret —
by name only, with the server's secrets page opened from a link (ITM-311); no value is asked for. Its explanation is
shown folded (ITM-349). The participants page and the pages that start a job are not part of this item.

## Acceptance

- Unit tests that name MOD-settings-pages state, before the code exists, with the stand-ins of the existing settings
  tests and a fixture product: without the files, *Install* committing exactly the generated files as one commit; with
  them, shown installed; with an older file, *Install* offered again; the secrets named with the secrets page's link
  and no field for a value; the explanation folded.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/settings-pages/` and the tests that name MOD-settings-pages change.

**Not done: what is missing.** *Install* throws in a browser: `src/runtimes/ci.mjs:234` refuses with "the job
workflow's templates are read in Node; a browser cannot read them yet", so the settings page cannot write the job
workflow. ITM-1202 carries it. TST-351001 (`tests/settings-pages-settings-regressions.test.mjs`) runs in Node and does not
show it.
