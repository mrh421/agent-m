---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0c46a0caabda4d9fd27b52e709f13ce48def574b
  - https://github.com/akmaier/agent-m/pull/1513
  - tests/release-itm-1314-put-back-after-removal.test.mjs
  - tests/release-itm-1186-bridge-sessions.test.mjs
  - tests/release-uc-023-review-pages.test.mjs
  - tests/release-uc-023-reject.test.mjs
  - tests/release-uc-023-described-change.test.mjs
date: 2026-10-30 08:02 UTC
---
# Release testing → Sprint review: team 1's sprint 126

**REGISTER**

## Reason

The release tests of sprint 126's items pass on `sprint/team1/126` at `0c46a0ca`, the head of #1513 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **Green on the sprint branch.**
   - Run 41023092796 on `0c46a0ca` (`pull_request`):
     - Attempt 1 failed in one job, 123954844164, and there only on TST-1240031 of `checkout-tools-bash`, "a timeout
       ends the command's whole process tree". That is a known flip of the sprint's brief (`team1/126.md`).
     - Attempt 2 succeeds on the same commit.
     - By A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY (SPEC.md:1587-1590), TST-1240031 is flaky, not a failure of the
       increment.
   - The release tests' own pull requests were green on their heads, and both are merged into the sprint branch:
     - #1511 (ITM-1314) on `7d6ea8ae`: run 41021964932, attempt 1;
     - #1512 (ITM-1186) on `2f831ab5`: run 41022206554, attempt 1.
   - Locally on `0c46a0ca`, Node 26, the five release files with `system-uc-023-modify-the-architecture` and
     `system-uc-049-pages-of-mail-and-settings`: 53 tests, 47 pass, 6 `todo` (UC-023's findings), 0 fail.
2. **Written by a participant who implemented none of the behaviour they test.**
   - Every release commit carries `Agent-M-Participant: developer-sonnet-l`: `7d6ea8ae` (ITM-1314), `2f831ab5`
     (ITM-1186), `c5dc42e8` (ITM-739), and `83838661`, ITM-1186's change of the system test TST-513025.
   - developer-sonnet-l implemented none of the items:
     - ITM-1314 was built by developer-opus-e (`994843d3`, `ca9e9b6f`);
     - ITM-1186 by developer-sonnet-j (`3308aeb9`, `efdd320c`);
     - the items UC-023's battery tests by developer-sonnet-f, sonnet-i, sonnet-e and opus-e (`team1/126.md`).
3. **The release tests of each item.**
   - **ITM-1314: TST-1314301 to TST-1314303** (`tests/release-itm-1314-put-back-after-removal.test.mjs`).
     - A module put back after its accepted removal is shown on its page as changed since acceptance, with every line
       added against the empty text.
     - On the architecture's Review all it stands as a changed file, not as a removed one, and "Accept all 2 shown"
       counts it.
     - *Reject* is one commit that deletes it, with the reason in its message and no record.
     - Each asserts its known positive, MOD-reader, a module accepted and then changed.
   - **ITM-1186: TST-1186301 to TST-1186304** (`tests/release-itm-1186-bridge-sessions.test.mjs`). The Bridge is a stand-in
     for `fetch`, so no Bridge is started.
     - Drawing the route `bridge` sends no request. *Test* sends `/v1/pair` and `/v1/agents` with the Bridge's token, and
       draws a form for the ready agent only, its capabilities the CLI agent's preset.
     - *Save session* keeps the declaration in this browser, the context only as a whole number.
     - A session lacking a place, a context or a model is named as not offered. The counter-proof, one declaring all
       three, is named as lacking nothing.
     - The endpoints page folds the explanation of when the prompt bar appears.
   - **ITM-739** is itself UC-023's system and release battery: TST-739001 to 739013 (system), and TST-739101 to 739114,
     739121 to 739123 and 739201 to 739211 (release). Its Development gate
     (`docs/gates/20261030-0753-development-release-testing-c739.md`) read it. Every one of the 28 requirements of UC-023
     whose check is a test is guarded there, and its six findings, S1 to S5, are ruled there.
4. **MOD-test-document's reader on the head:**
   - `release-itm-1314-put-back-after-removal`: 3 declarations, 0 findings. Its header gives MOD-approvals and
     MOD-review-pages, one per line, and level `release`.
   - `release-itm-1186-bridge-sessions`: 4 declarations, 0 findings. Its header gives MOD-settings-pages and
     MOD-bridge-client, one per line, and level `release`.
   - UC-023's three release files: 14, 3 and 11 declarations, 0 findings.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.

## Noted

- TST-1240031 flipped once more on a commit where it also passed: `checkout-tools-bash` had two outcomes on `0c46a0ca`.
  It is a known flip with no item. Its job's log names the failure node, the process tree's kill after SIGTERM.
