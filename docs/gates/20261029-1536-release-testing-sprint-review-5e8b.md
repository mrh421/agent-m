---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3836359cdc4f490a92b17a8797a09f4d7c89fd8d
  - https://github.com/akmaier/agent-m/pull/1461
  - tests/release-itm-1290-missing-key-beside-field.test.mjs
date: 2026-10-29 15:36 UTC
---
# Release testing → Sprint review: team 1's sprint 119

**REGISTER**

## Reason

The release tests of sprint 119's items pass on `sprint/team1/119` at `3836359c`, the head of #1461 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1290 | `tests/release-itm-1290-missing-key-beside-field.test.mjs` | TST-1290301 to 308 | `151e88c7` (#1460) |

   - **ITM-1294 and ITM-1302** change tests and no behaviour, so they have no release test. Their gates say so:
     `docs/gates/20261029-1458-development-release-testing-d862.md` and `-1511-…-385b.md`.
2. **The writer built none of the behaviour.** These are the trailers of every commit in `origin/main..3836359c`, merges
   aside:
   - ITM-1290 `6b6d0a01`, `6b368cde`, `357e9350` and `8698e17e`: developer-opus-e;
   - ITM-1302 `d874dd11` and `7237458c`: developer-opus-f;
   - ITM-1294 `0569b407`: developer-sonnet-k.
   - developer-sonnet-l has one commit, `151e88c7`, which adds only the release test.
3. **Green on the sprint branch, after one flip outside the sprint.**
   - Run 40901982501, `pull_request`, on `3836359c`, attempt 2, succeeds: 41 jobs pass and 17 are skipped. The release
     test runs there with 8 pass and 0 fail.
   - Attempt 1 failed in one job, `release-pull-request (8)` (job 123546570337). I read its log. The only failing case is
     TST-286904 of `tests/release-itm-286-tunnels-runtime.test.mjs` (MOD-tunnels), where the denied tunnel stood
     `opening` with the reason `auth-refused`. Every other `✖` there is a todo or a `# FINDING`.
   - Attempt 2's same job (123548956750) passed on the same commit. So the test flips on one commit (A TEST THAT FLIPS ON
     THE SAME COMMIT IS FLAKY, SPEC.md:1587-1589).
   - The sprint changed no file of MOD-tunnels or of that test.
   - No item covered it. A search of `docs/backlog/` for `TST-286904` finds none; the same search for
     `review-pages-release-limitations` finds ITM-1287. It is registered with this record as **ITM-1312**, ready, whose
     first task is its reproduction (sprint 118's agreement).
   - A failed attempt of TST-286904 alone, with a green rerun, counts as CI green on a head, as for ITM-1287's test.
4. **Run by me on `3836359c`:** the release test and `test-document-one-line`, 10 pass and 0 fail.
5. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `3836359c`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The release test gives 8 declarations, every case of the table, each of the level `release`, and 0 findings.

## The readings of the release tests

1. **The cases find a required-key finding by the words "the key <key> is required".** That is an observation of what
   the page shows a person, which a release test reads from outside. The product reads no such wording.
   - Should MOD-documents change its words, these cases fail by name. They do not pass by mistake.
   - No item.
2. **The source-entry form is not among the cases.** Release testing checks the behaviour on forms the cases name. The
   planning set and the gate's rerun covered every test of MOD-settings-pages, which calls `schemaForm` for it, with no
   failure caused by the change (`docs/gates/20261029-1517-development-release-testing-55a2.md`). No item.
