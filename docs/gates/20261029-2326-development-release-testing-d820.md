---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9ec78402d1b9378e5b16b86ad5ab0ec3c826664b
  - https://github.com/akmaier/agent-m/pull/1478
date: 2026-10-29 23:26 UTC
---
# Development → Release testing: ITM-820, a local run of the node tests runs no file of the architecture fixture

**REGISTER**

## Reason

ITM-820, pull request #1478 into `sprint/team1/122`, passes on `9ec78402`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item is declared as refactoring, so CI is green on every
commit and no expected result changes.

1. **CI is green on every commit.**
   - `e9e21aaf`: run 40933281923 (`pull_request`) succeeds, 58 jobs.
   - `9ec78402`: run 40934997147 (`pull_request`). Attempt 1 was cancelled in the job "agent-m records" alone; attempt 2
     succeeds, 58 jobs, 17 skipped, none failed.
2. **Only the item's files change.** `tests/fixtures/architecture/tests/reader.test.js` is renamed, at 100 % similarity,
   to `reader.test.js.fixture`, as ITM-702 named its fixture. The 16 readers that walk the whole fixture take the suffix
   off in their walk (`.replace(/\.fixture$/, "")`, or `removesuffix(".fixture")` in Python), each with a one-line
   comment. These are the 16 files the item's list names as walking the folder; the three that read named files of the
   fixture are unchanged, as none of them reads that file.
   - The three release tests among them change in `9ec78402` alone, whose trailer names developer-sonnet-l, who
     implemented none of ITM-1266, ITM-1268 or ITM-1311. `e9e21aaf` touches none of them.
3. **No expected result changes.** Each changed line is the key of the walk, and a comment. No declaration, assertion or
   message changes.
4. **`node --test tests/` runs no file below `tests/fixtures/architecture/`.** On the head, a search of that folder for
   names holding `.test.` finds `tests/reader.test.js.fixture` alone, which no pattern of Node's test runner matches. Known
   positive: the same search on the sprint's base finds `tests/reader.test.js`.
5. **Every reader finds the fixture as before.** Each walk gives the file under its old name, `tests/reader.test.js`, with
   its contents unchanged.
6. **Checked by me on `9ec78402`.**
   - The 19 files that name the fixture: 75 Node cases and 23 Python cases pass, 0 fail, as on the sprint's base at
     planning.
   - MOD-test-document's reader over the 19: 0 findings, before and after. No declaration is new or changed, so there is
     no `given`, `input` or `expect` to print. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4
     declarations and 0 findings.

## Noted

- Release testing of ITM-820 needs no release test: it changes no behaviour.
