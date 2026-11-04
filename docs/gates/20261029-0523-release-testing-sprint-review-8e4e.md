---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 684b8f5a8d1679ac91091f60118b9c17e444aae5
  - https://github.com/akmaier/agent-m/pull/1402
  - tests/release-itm-1257-move-form-lists.test.mjs
  - tests/release-itm-1259-merge-request-closes-issues.test.mjs
  - tests/release-itm-1273-entry-own-queue.test.mjs
  - tests/release-itm-1268-last-accepted-one-file.test.mjs
  - tests/release-itm-1285-backquote-in-string-real-files.test.mjs
date: 2026-10-29 05:23 UTC
---
# Release testing → Sprint review: team 1's sprint 111

**REGISTER**

## Reason

The release tests of sprint 111's items pass on `sprint/team1/111` at `684b8f5a`, the head of #1402 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`). This is RELEASE TESTS ARE
NOT WRITTEN BY THE IMPLEMENTER (SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`:**

| Item | File | Cases | Writer, commit |
|---|---|---|---|
| ITM-1257 | `tests/release-itm-1257-move-form-lists.test.mjs` | TST-1257301 to 303 | developer-sonnet-l, `30991067` (#1394) |
| ITM-1259 | `tests/release-itm-1259-merge-request-closes-issues.test.mjs` | TST-1259301 to 303 | developer-sonnet-l, `30991067` (#1394) |
| ITM-1273 | `tests/release-itm-1273-entry-own-queue.test.mjs` | TST-1273301 to 305 | developer-sonnet-l, `30991067` (#1394) |
| ITM-1268 | `tests/release-itm-1268-last-accepted-one-file.test.mjs` | TST-1268301 to 305 | developer-sonnet-l, `68027b10` (#1399) |
| ITM-1285 | `tests/release-itm-1285-backquote-in-string-real-files.test.mjs` | TST-1285301 to 304 | developer-sonnet-l, `b0e68aa8` (#1401) |

   - **ITM-1296 has none, and none is due.** It changes no behaviour of Agent M's code and declares no test. Its file was
     compared byte for byte at its Development gate (`docs/gates/20261029-0515-development-release-testing-7539.md`).
2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/` and `.github/` in
   `origin/main..684b8f5a`:
   - ITM-1259 `2f72b883` and ITM-1285 `3f149fba`: developer-sonnet-k;
   - ITM-1257 `4657f60b` and ITM-1296 `5ffde5a3`: developer-opus-f;
   - ITM-1273 `b0452604`: developer-opus-e;
   - ITM-1268 `49eec107`: developer-sonnet-j.
   - developer-sonnet-l has none.
3. **Green on the sprint branch.** Run 40822613300, `pull_request`, on `684b8f5a` passes 38 of 38 pull-request jobs. Its
   release jobs give:
   - 1273: 5 pass, 0 fail (job 123278346738);
   - 1257: 3 pass, and 1285: 4 pass (job 123278346783);
   - 1268: 5 pass (job 123278346967);
   - 1259: 3 pass (job 123278347012).
   - All 20 cases pass.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on the sprint branch at
   `684b8f5a`.
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The five files give 3, 3, 5, 5 and 4 declarations, every case of the table, and 0 findings.

## Noted

- ITM-1296's post-merge check, the next pull request closed running `onPullRequestClosed`, comes after the sprint's merge
  into `main`. It is recorded in sprint 111's record then, and is no condition of this gate (ITM-1296's Acceptance).
