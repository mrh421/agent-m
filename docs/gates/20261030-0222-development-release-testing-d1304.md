---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 78dd50317d568af642e659756244a4adab13c206
  - https://github.com/akmaier/agent-m/pull/1485
date: 2026-10-30 02:22 UTC
---
# Development → Release testing: ITM-1304, a declaration's value stands on its one line

**REGISTER**

## Reason

ITM-1304, pull request #1485 into `sprint/team1/123`, passes on `78dd5031`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item is declared as refactoring, so CI must be green on every
commit and no expected result may change.

1. **CI is green on every commit,** each `pull_request`, attempt 1, 58 jobs, 17 skipped, none failed.

   | Commit | What it holds | Run |
   |---|---|---|
   | `8cf3c9ab` | tests of participants, jobs, the Bridge, the Workflows and Access | 40990545438 |
   | `b2aca2b5` | tests of process, releases, sources and the artifact model | 40990551766 |
   | `439c0beb` | tests of the Site's pages, with TST-354001's five leftover lines | 40979419779 |
   | `78dd5031` | developer-sonnet-l's commit of the six release test files | 40990411275 |

   - The first two ran through CI-only draft pull requests #1486 and #1487, which are closed unmerged.
2. **Only the item's files change: 168 test files, and no other file.**
   - They are exactly the 168 files of my planning stand-in's list of changes (`team1/123.md`).
   - Their headers name 37 modules, each of which the item names, beside MOD-test-document.
   - The six release test files change only in `78dd5031`; no earlier commit touches them.
3. **Nothing but comment lines changes.** I compared each of the 168 files on the sprint's base and on the head:
   - the lines that are not comment lines are the same, in the same order, in every file;
   - every removed comment line's text stands, joined, in the head's comments, except one;
   - that one is a line of TST-354001's five repeated lines ("participant register with the capabilities a Developer
     needs"), whose removal the item names.
4. **No expected result changes, and every value is read whole.** I read MOD-test-document's reader over every test file
   under `tests/`, on the base and on the head:
   - 5,615 declarations both times, and 22 findings both times.
   - Every declaration keeps its identifier, title, level, module, guards and `input`.
   - 441 `expect:` and 3 `given:` values (TST-531001, TST-548005, TST-548007) are longer. Each begins with its old value.
   - My count of comment lines left after a declaration's last key line, over the head: only the 26 notes my planning
     listed stay. They are 23 lowercase `counter-proof:` notes, TST-342008's `fault:` and `counter-proof:`, TST-290122's
     `covered cases:`, and TST-294001's "GitHub Ubuntu additionally …". Besides them stand the labelled notes, 460
     `Planted fault:` lines among them.
5. **The named readings, checked by hand.**
   - **Seven more values were cut** at a line that begins with a lowercase word and a colon, which the reader passes over
     as an unknown key. My planning count saw three of these. The head reads seven more whole, against my stand-in:
     - TST-964003 (`tracker:`);
     - TST-626004 (`queued:`);
     - TST-587103 and TST-587003 (`https:`);
     - TST-548005 and TST-548007, their `given` (`include:`);
     - TST-705003 (`https:`);
     - TST-531001, its `given` (`https:`);
     - TST-531006 (`https:`).
     Each head value is its first line followed by its rest, joined unchanged.
   - **TST-519011 and TST-519012** (`tests/test_artifact_provenance.py`): the line beginning `Agent-M-Kind:` continues the
     six trailer lines of the `expect:`. It is no note. The reader now gives all six lines, ending "Agent-M-Rounds: 1".
     Right.
   - **The lowercase `counter-proof:` lines kept as notes** are those after a value that has ended. Where one continues a
     value, it is joined, as in TST-1206001 and TST-856001. Right.
6. **MOD-test-document's reader with its control:** `tests/release-itm-1254-issue-move.test.mjs` gives 4 declarations and
   0 findings on the head. `tests/test-document-one-line.test.mjs` gives 2 pass and 0 fail there.
7. **Release tests are changed by a participant who implemented none of their behaviour** (SPEC.md:1537-1541): the six
   release files by developer-sonnet-l, in a commit of its own, as `team1/123.md` asks.

## Noted

- The pull request reports 413 declarations in 162 files and 31 in the six release files, 444 in all. That is my planning
  count of 437 and the seven cut values above.
- Release testing of ITM-1304 needs no release test: it changes no behaviour.
