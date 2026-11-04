---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 1f663e6de6cb7830672ee1185f1590a2902f68d2
  - https://github.com/akmaier/agent-m/pull/1525
date: 2026-10-30 10:51 UTC
---
# Release testing → Sprint review: sprint 127's release tests, rejected while two test cases share each of four identifiers

**REGISTER**

## Reason

The release tests of sprint 127's four items stand on `sprint/team1/127` at `1f663e6d`, the head of #1525. They do not pass
yet.

The condition is "written by a participant other than the implementer of the behaviour they test, green on the sprint
branch" (`docs/process-models/scrum-wip.md:54`). Both of its parts hold, as points 1 and 2 show. What stops the gate is
point 3: the release test of ITM-1187 declares four identifiers that another test case of the same item already holds.

1. **Written by a participant other than the implementer.**

   | Item | Implementer | Release test | Pull request |
   |---|---|---|---|
   | ITM-1315 | developer-sonnet-j | `tests/release-itm-1315-accept-disabled.test.mjs`, TST-1315101 to 1315104 | #1521, `df355e9d` |
   | ITM-782 | developer-opus-f | `tests/release-itm-782-propose-and-add-items.test.mjs`, TST-782101 to 782104 | #1522, `490226d4` |
   | ITM-1187 | developer-opus-e | `tests/release-itm-1187-bar-offers-sessions.test.mjs`, TST-1187101 to 1187104, and `tests/uc-019-prompt-bar-harness.mjs` | #1523, `53a22c60` |
   | ITM-1317 | developer-sonnet-k | `tests/release-itm-1317-change-under-own-name.test.mjs`, TST-1317101 to 1317103 | #1524, `e55f2afe` |

   - Each release commit is developer-sonnet-l's (`Agent-M-Participant`), and changes only the files named in the table.
   - developer-sonnet-l implemented none of the four items. Its commits on the items' branches changed tests only.
2. **Green.**
   - Each release test's head is green (`pull_request`, attempt 1, 41 jobs succeed, 17 skipped, none failed):
     - #1521 in run 41039664491;
     - #1522 in run 41041841291;
     - #1523 in run 41042233294;
     - #1524 in run 41042513583.
   - **The sprint branch's head `1f663e6d`:** run 41042958717 of #1525 is green in the same way.
3. **TST-1187101 to 1187104 each name two different test cases.**
   - `tests/prompt-bar-endpoints.test.mjs` declares TST-1187101 to 1187106. These are component cases by
     developer-opus-e, from ITM-1187's tests-only commit `f6575f66`, which the Development gate read
     (`docs/gates/20261030-1013-development-release-testing-c1187.md`).
   - `tests/release-itm-1187-bar-offers-sessions.test.mjs` declares TST-1187101 to 1187104 again, for four other cases, of
     level `release`.
     - Example: one TST-1187101 is the component case "the selector offers exactly drafter and mac:claude".
     - The other TST-1187101 is the release case with a real Bridge release-bridge.
   - **Found with** a list of the sprint's declarations at `1f663e6d`, read for repeats.
     - It finds these four, and no repeat among the identifiers of ITM-1315, 782 and 1317.
     - MOD-test-document's reader reads both files with 0 findings, since it checks one declaration at a time.
     - CI is green, since no check of the repository compares declarations across files.
   - **Why this stops the gate.** An identifier is an artifact's name (EVERY ARTIFACT HAS AN IDENTIFIER, THE NAME IS THE ID
     AND IT SURVIVES), and a reference names the identifier (A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION). With two
     cases under one name, a reference to TST-1187101 — in a result record, in the trace graph's view of what guards UC-049
     — names neither of them.
   - **Why it is fixed now.** Once the increment is on `main`, an identifier that is renamed is withdrawn and never used
     again (SPEC.md:57-61). Renaming the release cases before the merge withdraws nothing that was released.
   - **Nothing else of the tests refers to TST-1187101 to 1187104.** No other file names them, only the two declarations
     and the Development gate's record, which means the component cases.

**What moves the gate.**
- developer-sonnet-l gives the four release cases of `tests/release-itm-1187-bar-offers-sessions.test.mjs` identifiers
  that no history holds, in a commit of its own on top of `sprint/team1/127`. That means each declaration and the name of
  its `test(...)`.
  - The scheme of sprint 126's release tests, TST-1187301 to 1187304, would do. Whoever renames them first searches the
    history for each new identifier, `test-results` included.
- No case's body or expectation changes.
- The gate is then read again on the new head of #1525. Everything else read here stands (points 1, 2 and below).

## Read, and holding

- **#1523 adds `bridgeFetch` to `tests/uc-019-prompt-bar-harness.mjs`.** It holds.
  - Where a test gives `bridgeFetch`, the harness answers the requests to `http://127.0.0.1:9418` with it, in place of its
    fixture Bridge. Its default is `null`, so every other scenario runs as before. CI is green on every file that uses the
    harness.
  - The harness is a system-test helper. Its header names MOD-review-pages and level `system`, and the reader finds no
    finding in it.
  - The change is developer-sonnet-l's, who implemented none of ITM-1187.
- **The real Bridge on the fixed port `127.0.0.1:9418` collides with no other test.**
  - **The search.** Of every test at `1f663e6d`, only `release-itm-1187-bar-offers-sessions` binds 9418.
    - The search for `9418` finds it. That is its known positive.
    - The harness, `uc-049-world` and the release tests of UC-019 and UC-049 name the address only in a stand-in for
      `fetch`, which binds nothing.
  - **Every other test that listens:**
    - `bridge-http`, `tunnels-runtime`, `release-itm-286-tunnels-runtime` and `desktop-shell` listen on port 0, or on a
      port first taken that way and read back.
    - The system's range for such ports lies far above 9418 (Linux: 32768 and up).
  - **CI's shards.** `.github/workflows/agent-m-tests.yml` runs each level's files in 16 shards. Each shard is a job of its
    own, on a runner machine of its own.
  - **Within the file,** the comment at line 50 states that a test opening a second page closes the first Bridge first.
  - **Noted.** A developer's machine that runs `git daemon`, whose port is 9418, would refuse the bind. That is a local
    matter and no CI risk.
- **#1524 leaves akmaier's open point unasserted, on purpose.**
  - TST-1317103's known positive `c1` changes the rule under its own name. No case proposes a requirement as a change of
    itself with its rule unchanged, the case that `docs/gates/20261030-1003-development-release-testing-d1317.md`, Noted,
    leaves to akmaier.
  - A release test that fixed either answer would decide what akmaier has not. Leaving it out is right.
  - The unit case TST-1317004 still asserts the behaviour as built. It is read again once akmaier rules.
- **MOD-test-document's reader at `1f663e6d`.** The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4
  declarations and 0 findings.

  | File | Declarations | Findings | Level | Header modules |
  |---|---|---|---|---|
  | `release-itm-1315-accept-disabled` | 4 | 0 | `release` | MOD-review-pages, MOD-approvals |
  | `release-itm-782-propose-and-add-items` | 4 | 0 | `release` | MOD-implementation-pages |
  | `release-itm-1187-bar-offers-sessions` | 4 | 0 | `release` | MOD-prompt-bar, MOD-bridge-client |
  | `release-itm-1317-change-under-own-name` | 3 | 0 | `release` | MOD-documents, MOD-job-runner |

  Each header names its modules one per line.

## Noted

- **For the Product Owner, a new item of MOD-test-document or MOD-trace-graph:** no check compares test identifiers
  across files. A declaration whose identifier another declaration holds goes unreported, by the reader and by CI. Which
  module owns that check is the item's first reading.
