---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0a86fdc4af0a0d9318f3553068390b789885fa9a
  - https://github.com/akmaier/agent-m/pull/1520
date: 2026-10-30 10:03 UTC
---
# Development → Release testing: ITM-1317, a change under its existing identifier is not classed a duplicate of itself

**REGISTER**

## Reason

ITM-1317, pull request #1520 into `sprint/team1/127`, passes on `0a86fdc4`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `2616f67b`:** run 41034713984 (`pull_request`, attempt 1) fails.
   - **Tests-only commit `1395bc17`**, which moves the new architecture entry of `tests/test_derivation_classes.md` after
     ARC-013's, as the runner orders them: run 41034848633 (`pull_request`, attempt 1) fails in two jobs, only for the
     item's reason.
     - Job 123993620928 (unit): TST-1317001 and TST-1317004 of `tests/documents-change-under-own-key.test.mjs`.
     - Job 123993620790 (release): `test_derivation_classes`, case "architecture files are classed by their format
       keys". The loop stops at its limit with the duplicate error left, where the case expects it passed. Its other
       `AssertionError` lines are the known `todo` findings (ITM-657 in `release-uc-016`, TST-739209 and 739210,
       TST-418121).
   - **Implementation commit `8bf2dbc3`:** run 41035399976 succeeds, 41 jobs.
   - **Head `0a86fdc4`:** run 41037198706 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed.
2. **Only the item's files change.**
   - MOD-documents: `src/documents/candidates.mjs`, one line of `classifyCandidates` and its comment. Where the first
     candidate of a merged group is proposed as a change, the artifact its `of` names is left out of the search for a
     duplicate. The types are unchanged. It adds no import and no top-level await.
   - The new `tests/documents-change-under-own-key.test.mjs`, and the architecture case of the Python battery's data,
     `tests/test_derivation_classes.md`. The data stays in its Markdown file and the loader is unchanged (AGENTS.md §7).
   - The first three commits are developer-sonnet-k's: two hold tests only, then the code.
   - `0a86fdc4` is developer-sonnet-l's, and changes only `tests/system-uc-023-modify-the-architecture.test.mjs`, as the
     Acceptance asks:
     - TST-739010 loses its `todo` and its FINDING sentence;
     - `2-changes-under-existing-identifiers` moves from `FLOW_FINDINGS` to `FLOW_EVIDENCE` with TST-739010 as its
       evidence;
     - the header's range of findings reads UC023-S2 to UC023-S4, since S2 stays `todo` until ITM-1318.
3. **It builds the accepted text and the item's Acceptance** (MOD-documents.md:301-305: "a candidate whose normalised
   key equals that of an existing artifact other than the one its participant proposed it as a change of is a duplicate
   of it").
   - TST-1317001: a module changed under its own identifier, and a decision that keeps its title, keep the class
     change, decided by the participant.
   - TST-1317002, the counter-proof: the same candidates proposed new are duplicates by rule. So are candidates proposed
     as a duplicate or a conflict.
   - TST-1317003, the known positive: a change whose key equals another existing artifact's is a duplicate of that other
     artifact, by rule.
   - TST-1317004: a requirement changed under its name keeps the class change. A restatement under another name is still
     a duplicate.
   - The battery's architecture case: a decision that keeps the title it changes and a module changed under its own
     identifier stay changes; a module file with another existing module's identifier is a duplicate of it, by rule.
   - TST-739010 passes, and TST-739005 (UC-023 2a) still passes.
4. **The pull request's readings hold.**
   - "Proposed as a change of" is class `change` with `of` naming that artifact, so a proposed duplicate or conflict is
     not exempt. The accepted sentence names only "the one its participant proposed it as a change of".
   - For merged candidates the first proposal decides, as `classifyCandidates` already takes the first candidate's class
     and artifact for a merged group (`candidates.mjs`, its comment).
5. **Counter-proofs.**
   - The red runs of point 1 are the code as it stood.
   - Planted on the head in an export, each restored after:
     - No exemption, as on the base: TST-1317001, TST-1317004 and the Python battery fail. With the head's system test,
       TST-739010 fails too.
     - Every proposed class exempted: TST-1317002 and the battery fail.
     - A change searching no artifact at all: TST-1317003 fails. The battery's data does not catch this one; TST-1317003
       does.
   - Restored, in an export of `8bf2dbc3`: 103 files, every one that names `classifyCandidates`, `candidate-classes` or
     MOD-documents, with UC-023's system and release files. 786 pass, 7 `todo`, 0 fail, and `test_derivation_classes`
     passes.
   - The head's system test: 13 cases, 11 pass, 2 `todo` (UC023-S3, S4), 0 fail.
6. **MOD-test-document's reader, which the Developer did not run:**
   - `tests/documents-change-under-own-key.test.mjs`: 4 declarations, 0 findings, TST-1317001 to TST-1317004, each of
     level `unit` and module MOD-documents. The header names one module.
   - `tests/system-uc-023-modify-the-architecture.test.mjs` at the head: 13 declarations, 0 findings.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
7. **Reads, against the planning count** (`team1/127.md`): the change is pure and reads nothing. Its planning stand-in,
   over every test file, moved no other test, and none moved here.

## Noted

- **For akmaier: a change that restates its own text stays a change.** TST-1317004's second case is a requirement
  proposed as a change of itself whose rule is unchanged apart from case and white space. Before this item it was a
  duplicate by rule; now it keeps the class change. That follows the accepted MOD-documents.md:301-305 and akmaier's
  ruling that resolving a duplicate is a different process from proposing a change. It reads against the letter of
  EXACT DUPLICATES ARE FOUND WITHOUT A MODEL (SPEC.md:276-278): "A candidate whose name or normalised rule text equals an
  existing requirement's is classified as a duplicate deterministically". No reading of the accepted texts settles
  whether such a change should be a duplicate, so it is akmaier's to confirm, or to settle with a sentence. Nothing of
  this item waits for it.
- The pull request's description names no `JOB-` identifier and leaves its run ids "to follow". The runs are those the
  Scrum Master gave, read above.
- This is po-opus-c's last gate of sprint 127. A fresh Product Owner takes over from the records: `team1/127.md`, and
  the gate records of ITM-1315 (`-0912-…-a1315.md`), ITM-782 (`-0927-…-b782.md`) and this one. ITM-1187 is the one
  item without its Development gate.
