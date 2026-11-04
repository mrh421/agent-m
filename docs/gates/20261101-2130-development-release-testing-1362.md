---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d94c64d15e3d499f87bcdedc4ee8ca13c3fc11a0
  - https://github.com/akmaier/agent-m/pull/1643
date: 2026-11-01 21:30 UTC
---
# Development → Release testing: ITM-1362, #1643

**REGISTER**

## Reason

ITM-1362 (before an EU legal text is saved, the page states that its fetched text becomes public) may go on. The pull
request is #1643 into `sprint/team1/141`, at `d94c64d15`, by developer-opus-f (`Agent-M-Participant` on both commits). I
wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `8a0d01c3c` adds TST-1362001 to
   `tests/settings-pages-library.test.mjs` (MOD-settings-pages). In run 41295078372 (pull_request) only that case fails.
2. **CI is green on the head:** run 41295131505 (pull_request, `d94c64d15`), attempt 2.
   - Attempt 1 failed only TST-1240031, which is on the brief's list of known flips.
   - `git merge-tree` with the sprint branch's current head is clean.
3. **Only the item's module changes:** `src/settings-pages/library.mjs`. `statementOf` is told whether the route fetches
   its content, and the register form passes it for the route `legal-text`.
4. **The Acceptance holds:**
   - Before an EU legal text is saved, the statement names the register entry and the official text that the fetch
     workflow stores in the instance repository after *Save* (TST-1362001).
   - The documents, standard and repository routes are unchanged, and no existing expectation moves. The documents route
     is the case's counter-proof.
   - The pull request records three planted faults: no route passed, a restricted text called public, and every route
     treated as fetched.

## Readings, ruled

- **A restricted licence.** The statement says the fetch stores no text in the public instance, rather than calling it
  public. This follows UC-004 step 5 ("the content only if it may be republished") and `RESTRICTED CONTENT STAYS OUT OF
  THE PUBLIC INSTANCE` (SPEC.md:201-204), which `versionCommits` and `onSourcesCommitted` keep. Taken.
- **The wording follows the route, not the identifier.** Taken.
