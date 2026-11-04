---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7237458c2b1e4ecbc48fc04137bec94441039301
  - https://github.com/akmaier/agent-m/pull/1459
date: 2026-10-29 15:11 UTC
---
# Development → Release testing: ITM-1302, every test identifier is held by one declaration

**REGISTER**

## Reason

ITM-1302, pull request #1459 into `sprint/team1/119`, passes on `7237458c`, its head when this was decided. It was
returned once on `d874dd11` (`docs/gates/20261029-1504-development-release-testing-8059.md`), and the mend holds.

The Definition of Done is the default (SPEC.md:1869-1874). The item is a refactoring, so its commits are green, as A
REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469).

1. **CI is green on both commits.**
   - `d874dd11`: run 40896746394, read at the return.
   - `7237458c`: run 40898267859, `pull_request`, succeeds.
2. **The mend is the swap the return asked for, in one commit with no force-push.**
   - `agent-processes-prompt-delivery` is byte-identical to `sprint/team1/119`. It keeps TST-1225001 and 002, which its
     counter-proof records name.
   - `site-frame-test-topics` takes TST-1302001 and 002, in its declarations and titles, and names TST-1225 nowhere.
   - The two files changed by 8 lines each way, nothing else.
3. **The whole change, as at the return.** Only identifiers change, in the files of the item's modules. No expected
   result changes and no test is removed. The 17 pairs take TST-1302001 to 017, each named in the pull request.
4. **No identifier is held twice.** I ran a reader over every test file under `tests/`, fixtures and Markdown left out,
   on `7237458c`. It finds 5,553 identifiers and none held twice; on `main` before the item, 17 were held twice.
5. **The reader.** On `7237458c`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `agent-processes-prompt-delivery` and `site-frame-test-topics`: 2 declarations each, 0 findings.
   - The other twelve changed files gave 0 findings at the return, and are unchanged since.
6. **The tests, run by me on `7237458c`:** the two files and `test-document-one-line`, 12 pass and 0 fail. At the
   return, every file of the pairs and every test naming one by its path gave 181 pass. The one failure there,
   TST-1281004, is a Bridge case this machine cannot run.

## Noted

- ITM-1302 changes tests and no behaviour, so no release test of it is due.
- The counter-proof records `TST-1225001.md` and `-002.md` stand unchanged, and now belong to the one declaration of
  each identifier.
