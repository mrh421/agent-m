---
id: ITM-1194
title: TST-367004 reads the Bridge's job list only once the Bridge has ended the job
level: module
realises:
  - UC-011
modules:
  - MOD-desktop-shell
builds_on:
tests:
  - component
origin:
  - job 120150727285, node (1) of #1317 at 5e51e2b0, attempt 1, green on the rerun of the same commit (agreement 94)
---
# ITM-1194 TST-367004 reads the Bridge's job list only once the Bridge has ended the job

**REGISTER**

## Outcome

TST-367004 (`tests/desktop-shell-bridge-jobs.test.mjs:137`, component; MOD-desktop-shell, MOD-bridge-jobs, MOD-bridge-http)
failed once on `5e51e2b0` and passed on the rerun of the same commit. That makes it a flaky test (SPEC.md:1560).

**From the full log of job 120150727285 (lines 424-460):**
- the assertion then at :160 (now :161) expected the Bridge's `GET /v1/jobs` to list `JOB-20261011-0901-aaa1` as `done`;
- it got `running`;
- the test had run 4.3 s.

**The test's own steps:**
1. :145 waits until the served repository's record holds `## End`.
2. Then it checks the record, the sprint file and the working folder.
3. :160-161 ask the Bridge's job list and expect `done`.

So the test waits on the record in the served repository, and then reads a second source, the Bridge's own state of the
job, without waiting for it.

**First task:** name, from the code the test runs, when the Bridge's job list turns `done` relative to the push of the
end record. This is a data-flow path from the job's end to `/v1/jobs`, read before any change. That reading decides
which this is:
- a test that asks too early, whose fix is in the test's wait;
- or a Bridge that reports `running` for a job whose end record it has already pushed, whose fix is in the module that
  reports it, by its text (MOD-bridge-jobs).

## Acceptance

- The cause is named as that path, with the line where the state changes.
- The fix is in the place the cause names, and no retry or longer timeout hides it.
- A case shows the order: a fake that delays the Bridge's state after the push fails today's test, or today's Bridge,
  whichever the cause names.
- The first commit holds only the tests, and CI is red on it.

**A second flip (2026-10-23):** #1322's first run at `b3d30c24`, job 120418977366, node (1). It was the same assertion at
`tests/desktop-shell-bridge-jobs.test.mjs:160`, `'running'` for `'done'`, and it passed on the rerun.
