---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 83da98e18e42c2965e87ee4081e7720d806daf6e
  - https://github.com/akmaier/agent-m/pull/1636
date: 2026-11-01 19:30 UTC
---
# Development → Release testing: ITM-1361, #1636

**REGISTER**

## Reason

ITM-1361 (the library shows each version's files with their SHA-256) may go on. The pull request is #1636 into
`sprint/team1/141`, at `83da98e18`, by developer-opus-f (`Agent-M-Participant` on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `c3ac0c48b` adds a case to
   `tests/settings-pages-library.test.mjs` (MOD-settings-pages). In run 41294052889 (pull_request) only TST-1361001 fails.
2. **CI is green on the head:** run 41294304760 (pull_request, `83da98e18`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module changes:** two lines of `src/settings-pages/library.mjs`. Each file of a version reads
   "<name> — stored — SHA-256 <sha256>", taken from MOD-source-register's `linkedVersion` (`SourceVersion.files`,
   MOD-source-register.md:141-142), which is among MOD-settings-pages' Uses and which the page already calls. No import and
   no read are added, and the preload check passes.
4. **The Acceptance holds:**
   - Each version lists its files with the recorded SHA-256, for a stored source and for one that is only hashed
     (TST-1361001).
   - The counter-proof, asserted: neither entry shows the other's hash.
   - "stored" and "not stored" stay, so no existing expectation moves (TST-472758 still matches).

## The reading, ruled

**A file's "path" is the name the entry's `### Files of <version>` table records.** Taken.

## Next

TST-370213's `todo` (UC004-S1) is taken away by a participant other than the implementer, after the code:
developer-sonnet-l.
