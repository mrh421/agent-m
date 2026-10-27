---
id: ITM-401
title: The instance's workflow entry that fetches EU legal texts
level: module
realises:
  - UC-004
  - AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
  - WHAT NO MODULE OWNS IS CHANGED BETWEEN JOBS
modules:
  - MOD-workflow-entries
builds_on:
  - ITM-364
  - ITM-385
tests:
  - unit
origin:
  - UC-004 step 7, 7a
built_by:
  - 55060f3d7e94b7fdb4114f77af3e2834471c62fd
  - 42d327bb3ed01e52d53b1c334061657b04ad5a12
---
# ITM-401 The instance's workflow entry that fetches EU legal texts

**REGISTER**

## Outcome

MOD-workflow-entries' `onSourcesCommitted`, in `instance.mjs`, as its file states it: for each register entry of an EU
legal text that waits for its fetch, the official text fetched (ITM-385) and committed with its retrieval date, the
repository's version identifier and its SHA-256, completing the entry; a failed fetch writes nothing and ends the entry
`failed`, its summary naming the register entry and the failure. Adding the instance's workflow file that runs only this
entry, on a push to `docs/sources/` and on dispatch, is a change between jobs.

## Acceptance

- Unit tests that name MOD-workflow-entries state, before the code exists, with the fetch replaced and a fixture
  checkout: a waiting entry completed in one commit; an entry with a version left alone; a failed fetch writing nothing
  and ending `failed` with the entry named.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/workflow-entries/` and the tests that name MOD-workflow-entries change.
