---
id: ITM-690
title: The old review core goes
level: module
realises:
  - EVERY CODE FILE BELONGS TO A MODULE
  - STATUS IS DERIVED FROM THE RECORDS
modules:
  - MOD-approvals
builds_on:
  - ITM-680
  - ITM-685
  - ITM-692
tests:
  - unit
origin:
  - the plan of moving the code outside the architecture into it (sprint team1/70), under `CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT` and `docs/measurements/2026-10-17_code-outside-every-module.md`
---
# ITM-690 The old review core goes

**REGISTER**

## Outcome

`docs/assets/review-core.mjs` repeated MOD-approvals' records and status, MOD-spec-document's sections and
MOD-text-tools' hashes. It is gone: `790a3584` removed it with its last import, in `src/site-frame/dashboard-app.mjs`,
and its line in MOD-approvals' Parts.

What is left of the files MOD-approvals' Parts name as taken over: `tests/test_approval_records.py`, "rewritten on this
module, or removed with the old core" (`docs/architecture/MOD-approvals.md:63`). It still checks the records through
`record_problems` of `tests/artifact_checks.py:116`, a Python twin, not through MOD-approvals.

## Acceptance

- Every file the module's file names as taken over for this item is moved into the module or removed, as that line says, and no other file outside the module changes.
- The live dashboard keeps working: the release tests of its pages pass on the item's head.
- A test of only a removed file goes with it, and the requirement it guarded is kept by a test of the module, named in the pull request.
- It is declared as refactoring: CI is green on every commit.
- **Read at sprint team1/133's planning:** `tests/test_approval_records.py` is rewritten in place, not removed, since
  SPEC.md:998 and :1002 name it as the Check of ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON and AN APPROVAL NAMES THE
  EXACT TEXT. It checks every record of `docs/approvals/` and its counter-proofs through MOD-approvals' interface (such as `approvalSchema`,
  with MOD-documents' `documentFindings`, and `statuses`), run in node from the Python file as
  `tests/test_progress_derived.py` does. No existing expected result changes; `record_problems` stays in
  `tests/artifact_checks.py`, which this item does not change.

**Noted at sprint team1/89's end gates.** `tests/release-sprint-02-c-review-core.test.mjs:204` failed once on CI (run
39127567347, job 117675817449) in its own cleanup: "ENOTEMPTY: directory not empty, rmdir '…/.git/objects/pack'", from
`rmSync` at `:227`. It looks like a race between the cleanup and git still writing pack files. The cleanup is now `rmSync` at `:244`,
which neither waits for git nor retries; MOD-approvals' Parts no longer name this file as taken over.

