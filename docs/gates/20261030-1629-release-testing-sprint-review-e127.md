---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7a3bbcc5fd8b75158d7a587dac4a50c6b30db3ee
  - https://github.com/akmaier/agent-m/pull/1525
date: 2026-10-30 16:29 UTC
---
# Release testing → Sprint review: sprint 127's release tests, each under an identifier of its own

**REGISTER**

## Reason

The release tests of sprint 127's four items pass on `sprint/team1/127` at `7a3bbcc5`, the head of #1525.

The condition is "written by a participant other than the implementer of the behaviour they test, green on the sprint
branch" (`docs/process-models/scrum-wip.md:54`). The gate was rejected at `1f663e6d`
(`docs/gates/20261030-1051-release-testing-sprint-review-e127r.md`), because two test cases shared each of TST-1187101 to
1187104. Both parts of the condition held there already. This decision reads what changed since then and whether the
reason is gone.

1. **Written by a participant other than the implementer.**

   | Item | Implementer | Release test | Pull requests |
   |---|---|---|---|
   | ITM-1315 | developer-sonnet-j | `tests/release-itm-1315-accept-disabled.test.mjs`, TST-1315101 to 1315104 | #1521 |
   | ITM-782 | developer-opus-f | `tests/release-itm-782-propose-and-add-items.test.mjs`, TST-782101 to 782104 | #1522 |
   | ITM-1187 | developer-opus-e | `tests/release-itm-1187-bar-offers-sessions.test.mjs`, TST-1187201 to 1187204 | #1523 and #1526 |
   | ITM-1317 | developer-sonnet-k | `tests/release-itm-1317-change-under-own-name.test.mjs`, TST-1317101 to 1317103 | #1524 |

   - Each release commit is developer-sonnet-l's (`Agent-M-Participant`). The new one is `7d02fee9`, of #1526.
   - developer-sonnet-l implemented none of the four items.
2. **Green on the sprint branch.**
   - Run 41089672775 of #1525 on `7a3bbcc5` (`pull_request`, attempt 1): 41 jobs succeed, 17 are skipped, none failed.
   - #1526, updated from the sprint branch, was green on `106cc9f7` in run 41088885629.
   - TST-292101 passes there, which counted the malformed record of `01a1a5bf`.
3. **The reason of the rejection is gone.**
   - **What changed since `1f663e6d`:**
     - `tests/release-itm-1187-bar-offers-sessions.test.mjs`, nine lines;
     - the gate's record in the form's words, `f2bbaa25`.
   - **The change renames only.** In that file, TST-1187101 to 1187104 become TST-1187201 to 1187204. That covers each
     declaration, the name of its `test(...)`, and the reference in TST-1187202's `given`. No body, input or expectation
     changes.
   - **No repeat, at `7a3bbcc5`:**
     - The same list of the declarations under `tests/`, read for repeats, finds none among the identifiers of ITM-1315,
       782, 1187 and 1317. At `1f663e6d` the same command found TST-1187101 to 1187104, its known positive.
     - TST-1187101 to 1187104 stand only in `tests/prompt-bar-endpoints.test.mjs`.
     - TST-1187201 to 1187204 stand only in the release file.
   - **No history held the new identifiers.** `git log --all -S TST-11872`, oldest first, gives `7d02fee9` as the first
     commit. The ones after it are result records of its own runs.
   - **MOD-test-document's reader** on the release file gives 4 declarations and 0 findings, each of level `release` and
     module MOD-prompt-bar. The header names MOD-prompt-bar and MOD-bridge-client, one per line, and level `release`.
4. **Read at `1f663e6d`, and unchanged since** (`…-e127r.md`, "Read, and holding"):
   - the three other release tests and their reader's results;
   - `bridgeFetch` in `tests/uc-019-prompt-bar-harness.mjs`;
   - the real Bridge on `127.0.0.1:9418`, which no other test binds;
   - #1524 leaving akmaier's open point unasserted.

## Noted

- **A new item, from the rejection, for the Product Owner:** no check compares test identifiers across files.
  - Neither MOD-test-document's reader nor CI reported the repeat.
  - Which module owns that check is the item's first reading.
- **akmaier's open point of ITM-1317 stays open:** a requirement proposed as a change of itself with an unchanged rule
  (`docs/gates/20261030-1003-development-release-testing-d1317.md`, Noted). No release test asserts either answer.
