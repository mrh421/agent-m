---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5da6aaf2bcaa5692f57f8896fa36cf5bdf9164a3
  - https://github.com/akmaier/agent-m/pull/1672
date: 2026-11-01 14:59 UTC
---
# Development → Release testing: ITM-580, #1672, the system and release tests of UC-007

**REGISTER**

## Reason

ITM-580 was written by developer-sonnet-k (`Agent-M-Participant` on `5da6aaf2b`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41318549511 (`5da6aaf2b`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only new test files:** `tests/uc-007-harness.mjs`, `tests/system-uc-007-derive-use-cases-from-requirements.test.mjs`,
   `tests/release-uc-007-derive-use-cases-from-requirements.test.mjs`.
4. **MOD-test-document's reader** reads 13 system cases (TST-580201 to 580213) and 19 release cases (TST-580301 to
   580319), each `module: system`, with no finding.
5. **Who wrote what it tests.** sonnet-k built ITM-1271 (UC-007 4b's note) and ITM-1317 (6a). Their behaviour is walked by
   the system cases TST-580210 and 580211 only; no release case guards behaviour sonnet-k built
   (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER` binds level `release`). Most of UC-007's commits (ITM-298 to 390,
   451) carry no trailer.
6. **The Acceptance holds:** every requirement UC-007 realises has a release case, with TST-580301 mapping them; the system
   file walks the main flow and the alternative flows; the pull request records 16 planted faults, each case that is not a
   map or a `todo` failing on one at least.
7. **Reads.** sonnet-k read AGENTS.md, SPEC.md and chapter 13, the use case and the module files in full. AGENTS.md §1
   asks chapter 13 for work on tests, which a battery is; 142.md's brief named chapters 9, 11, 12 and 13 for every item,
   more than §1 asks. Taken: for a battery, §1's list.

## Findings, ruled

Each is registered in this commit, by the reading of ITM-1061's gate.
- **UC007-F1 (TST-580209) → ITM-1384 (MOD-artifact-edits, MOD-job-ledger).** The note of a removed realised name holds a
  comma, which `writeDocument` refuses as a list item of the record's `## End`; the use case is committed, the job gets no
  end, and the page shows a `DocumentError`. The probe names which module's change it is.
- **UC007-F2 (TST-580305) → ITM-1385 (MOD-documents).** `documentFindings` gives "a diagram missing where `required`", and
  `checks.mjs` does not check it yet. Its probe stops the item if an accepted use case or architecture file would change.
- **UC007-F3 (TST-580318) → ITM-1386 (MOD-review-pages).** The drafting page shows the rounds' count and not each round's
  findings, which `THE ROUNDS ARE COUNTED AND SHOWN` asks and which the page already shows for the architecture.

## Readings taken

- "Marks for review" is the note of the job's end.
- An empty `person_decides` means a conflict is not sent back.
- Of the warning rule, only the error half is reachable on this page.
- "Shown with the draft" is the drafting page after *Run*.

All are taken.

## Noted

- A drafted path outside `docs/use-cases/UC-<nnn>-<slug>.md` makes the writer throw a `TypeError`. No case walks it; a
  candidate for a battery finding later. Nothing waits on it.
