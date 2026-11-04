---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 137bee6aa3e8612d801182e4ff9a7c02b4d23288
  - https://github.com/akmaier/agent-m/pull/1474
  - tests/release-itm-886-waiting-badge.test.mjs
  - tests/release-itm-1185-session-declaration.test.mjs
  - tests/release-itm-1159-modules-labels.test.mjs
date: 2026-10-29 18:06 UTC
---
# Release testing → Sprint review: team 1's sprint 121

**REGISTER**

## Reason

The release tests of sprint 121's items pass on `sprint/team1/121` at `137bee6a`, the head of #1474 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541). The
selected items are ITM-1159, ITM-1185, ITM-886 and ITM-699.

1. **The release tests, each declaring the level `release`:**

| Item | File | Cases | Writer | Commit |
|---|---|---|---|---|
| ITM-886 | `tests/release-itm-886-waiting-badge.test.mjs` | TST-886301 to 305 | developer-sonnet-l | `98c59bf3` (#1471) |
| ITM-1185 | `tests/release-itm-1185-session-declaration.test.mjs` | TST-1185301 to 310 | developer-sonnet-l | `a0d231d7` (#1472) |
| ITM-1159 | `tests/release-itm-1159-modules-labels.test.mjs` | TST-1159301 to 305 | developer-sonnet-l | `63e2880d` (#1473) |

   - ITM-699 is a refactoring and changes no behaviour, so it has none
     (`docs/gates/20261029-1734-development-release-testing-a7e6.md`).
2. **No writer built the behaviour it tests.** These are the `Agent-M-Participant` trailers of every commit in
   `origin/main..137bee6a`, merges aside:
   - ITM-1159 `00341663`, `2ca69f36` and `62d210cb`: developer-opus-e;
   - ITM-1185 `497e01a4`, `d35f258e`, `3f900f7d` and `39b01341`: developer-sonnet-j;
   - ITM-886 `e3e39e68` and `57f5a33d`: developer-sonnet-k;
   - ITM-699 `7f48cdbb` and `9ff29dac`: developer-opus-f;
   - the three release test commits: developer-sonnet-l, who implemented none of the four.
3. **Green on the sprint branch.** Run 40926760329 (`pull_request`, head `137bee6a`, attempt 1) succeeds: 58 jobs, 17
   skipped, none failed.
4. **Run by me on `137bee6a`.** The three release files give 20 tests: 19 pass, 0 fail and 1 todo, TST-1185304 (below).
5. **The reader.** MOD-test-document's reader on `137bee6a`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The ITM-886 file gives 5 declarations, the ITM-1185 file 10 and the ITM-1159 file 5, each of the level `release`, and 0
     findings.
   - Each declaration's values stand on one line. The comment lines after them are the planted faults and one todo note,
     not continued values.

## The todo TST-1185304, ruled

- **The case is right, and the code is short of the text.**
  - MOD-browser-store's catalogue names the key `session:<bridge>:<agent>` (MOD-browser-store.md:72).
  - `writeSetting` "stores a value under a key of the catalogue. Throws `UnknownSetting` for any other key" (:116-117).
  - `session:lab`, `session:lab:` and `session::claude` give no Bridge or no agent, so they are no keys of that form. The
    store writes them, because ITM-1185 gave the family as `/^session:.+$/`.
  - Developer-sonnet-l's reading, that a key of the form needs both names, is what the text says. The case stays.
- **It does not hold the gate.** The case is a todo and runs green. No code of `src/` outside MOD-browser-store writes a
  `session:` key yet; the settings page only reads them (`sessionLine`).
- **Registered: ITM-1313** (MOD-browser-store), ready. It narrows the family to a non-empty Bridge and a non-empty agent,
  and lifts the todo. Its Acceptance names the trap my planning run fell into for ITM-1185: `tests/test_settings_page.py`
  sees a family only in the shape `/^<prefix>:.+$/`.

## Noted

- **For the review:**
  - `docs/assets/jobs/propose-backlog-items/prompt.md` stands alone in its folder, named by no module and read by nothing
    (gate of #1469).
  - On `main`, `#arc` and `#module` already fit a phone before ITM-1159; it added the cells' labels (planning of this
    sprint).
  - ITM-1287 was not reproduced at planning, in 500 runs under load.
