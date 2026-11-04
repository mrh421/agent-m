---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c82546e35f3b78f2d7c906883f41ae4b342650e7
  - https://github.com/akmaier/agent-m/pull/1648
date: 2026-11-01 10:32 UTC
---
# Development → Release testing: ITM-1363, #1648

**REGISTER**

## Reason

ITM-1363 (a registered source's entry carries its title line) may go on. The pull request is #1648 into
`sprint/team1/141`, at `c82546e35`. developer-opus-f wrote the tests and the code (`Agent-M-Participant` on both commits).
I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `4a2b61783` changes
   `tests/settings-pages-library.test.mjs` (MOD-settings-pages) only. In run 41297372156 the one failing job is
   `unit-pull-request (12)`, and its one failing case is TST-1363001, the entry's title line.
2. **CI is green on the head:** run 41297568077 (`c82546e35`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/settings-pages/library.mjs`. `titleLineOf` fills the entry schema's own
   `title` pattern from the fields; `draft` uses it, and `save` writes the document with that title line. It reads nothing
   more than the base.
4. **The Acceptance holds:**
   - On each of the four routes of *+ Register source*, and after a rename, the written entry's title line is
     `# <id> <title>` (TST-1363001). The pull request records the old code and a partial fix as its counter-proofs.
   - The probe moved no existing expectation.
   - It changes no file of MOD-documents. The title check of `documentFindings` is ITM-1366 (ruled before this gate,
     `94c936022`).

## Reading taken

- "On every route" means the four routes of *+ Register source*. *+ New version* writes no title line. Taken.
