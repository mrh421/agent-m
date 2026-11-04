---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c3cbc3aa12c328ac1fb0d5ef89e4b28b27d77b74
  - https://github.com/akmaier/agent-m/pull/1733
date: 2026-11-02 11:08 UTC
---
# Development → Release testing: ITM-775, #1733, the system and release tests of UC-030

**REGISTER**

## Reason

ITM-775 was written by developer-sonnet-k (`Agent-M-Participant` on `c3cbc3aa1`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41432746759 (`c3cbc3aa1`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-030-harness.mjs`;
   - `system-uc-030-audit-the-tests-of-a-release` (TST-775201 to 775220);
   - `release-uc-030-audit-the-tests-of-a-release` (TST-775301 to 775323; 775301 maps the 21 requirements UC-030
     realises);
   - `tests/test_audit_view.py` with its data file (TST-775401, 775402), the check the SPEC names for `THE AUDIT VIEW LISTS
     EVERY REQUIREMENT OF THE RELEASE`.
4. **The Acceptance holds:**
   - The pull request records 71 planted faults, each run and restored, and every passing case fails on at least one.
   - TST-775304 was strengthened in the same commit when its first fault failed nothing, and adding its assertion cannot
     make a fault pass.
   - The fault that first changed nothing was replaced, and now fails TST-775401 and 775402.

## Ruled

- **TST-775313 stays with sonnet-k.** sonnet-k built ITM-1285, how `testDeclarations` reads a backquote in a quoted string
  or a comment. TST-775313 guards `EVERY TEST HAS ONE LEVEL` as the audit shows each test's level, which sonnet-a, b, e
  and opus-b built. That the level is read through `testDeclarations` does not make ITM-1285's quoting the behaviour the
  case guards. `RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER` is met.

Each finding points at a module whose accepted text assigns the function. They are items, registered in this commit:
- **UC030-F1, TST-775207 → ITM-1430 (MOD-release-evidence):** a model-dependent test's row gives its rate alone, not
  whether it passed.
- **UC030-F5, TST-775204 → ITM-1431 (MOD-release-evidence):** a process requirement's row names gate records, not the
  artifacts the gate added.
- **UC030-F2, F3 and F4, TST-775214, 775217 and 775205 → ITM-1432 (MOD-trace-pages):** one item for what the rows link.
  The rows lack the limitation (2b), mark no dropped log as unavailable (2d), and lack the accepted text's blob SHA.
- **UC030-F6, TST-775220 → ITM-1433 (MOD-trace-pages):** `gatesOf` keeps only gates with a record, so a process
  requirement whose gate has none has no row.

Two notes of the writer are items too:
- **`tests/test_release_run.py` does not exist** → ITM-1434 (MOD-release-evidence, release tests). The SPEC names it as
  the check of three requirements of a release. It is written by a participant who built none of what it guards.
- **A regular-expression literal holding a backquote** makes `testDeclarations` miss the declarations after it →
  ITM-1435 (MOD-test-document). The writer worked around it with `new RegExp`.

## Not walked

- The precondition is UC-013's and UC-028's, whose batteries walk it.
- Printing to PDF is the browser's.

## Readings taken

- The route `trace/audit` exists with release tags only.
- The numbers open and restore rows.
- 2a's offer is the link to `#release` for every viewer, as TST-768013 holds.
- 2d marks the run's link "unavailable", and the outcomes still come from `test-results`.
- "Nothing written" is no write method of the host called.
- Self-sufficient means repository paths only, no web address.
- The instance's requirements enter only through a gate held.

All are taken.
