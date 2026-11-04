---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1bd1d2ac0777c1a0b91bdc10f68998cab3621bc2
  - https://github.com/akmaier/agent-m/pull/1539
date: 2026-10-30 20:07 UTC
---
# Development → Release testing: ITM-1323, Accept ticked and Accept all N shown put the modules each use case changes into the backlog, tested at release

**REGISTER**

## Reason

ITM-1323, pull request #1539 into `sprint/team1/129`, passes on `1bd1d2ac`, its head and only commit when this was
decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41119433548 (`pull_request`, attempt 1) on `1bd1d2ac` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed.
2. **No failing first commit is due.** AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST (SPEC.md:1460-1463) binds a job
   "that adds or changes behaviour". This one adds a release test of behaviour ITM-1319 built on `main` (#1531), and no
   code. The item says so ("CI is green on it, since the behaviour is built"). The counter-proofs below stand in for the
   red run.
3. **Only the new file changes:** `tests/release-itm-1319-accept-ticked-and-all-shown.test.mjs`, +158, by
   developer-opus-f (`Agent-M-Participant`).
4. **Its writer implemented none of the behaviour it tests** (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER,
   SPEC.md:1535-1539).
   - ITM-1319's code, `src/review-pages/affected-modules.mjs` and the kind `check-affected-modules`, was written by
     developer-opus-e alone, in `9e9c87e92` and `20a7a9c16`. That is my known positive for the search.
   - developer-opus-f's commits to `flow.mjs` and `strategies.mjs` are ITM-1311's `d32b67d7c` and ITM-1255's
     `6013499bb`, both earlier work and not ITM-1319's.
5. **It builds the item's Acceptance.** The reader's declarations:
   - **TST-1319205:**
     - given: a Scrum product with UC-007 and UC-008 open, MOD-reader and MOD-shelf described, and an empty backlog; drafter-a at "this machine";
     - input: the person ticks both and presses *Accept ticked* once;
     - expect: before the click, one note naming drafter-a and its place, with nothing sent or written. After it, the first commit holds the two approval records alone. Then come one item realising UC-007 (MOD-reader) and one realising UC-008 (MOD-shelf), each in a commit of its own naming drafter-a. No item is committed with or before the records.
   - **TST-1319206:** the same, by *Accept all 2 shown* on Review all.
   - **TST-1319207:**
     - given: a V-model product;
     - input: *Accept ticked*, and in another such product *Accept all 2 shown*;
     - expect: counter-proof. No participant is named, each click writes one commit with the two records and no item, and nothing is sent.
   - Guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG, SEVERAL FILES ARE ACCEPTED IN ONE CLICK,
     THE PAGE NAMES WHERE IT SENDS and UC-008. TST-1319205 and 1319206 also guard THE DASHBOARD WRITES ONLY ON A PERSON'S
     CLICK.
6. **Counter-proofs, planted by me on the head in an export, each restored after.**
   - The job is run only for the first use case recorded: `checked` in `src/review-pages/flow.mjs:245` gets
     `result.recorded.slice(0, 1)`. Result: TST-1319205 and 1319206 fail, and TST-1319207 passes.
   - A planned model is checked too: `affected-modules.mjs:54` gets `kind === "none"`. Result: TST-1319207 fails, and
     TST-1319205 and 1319206 pass.
   - Restored: 3 pass, 0 fail.
   - The pull request records three more faults: no check on *Accept ticked*'s path, no check on *Accept all N shown*'s
     path, and the check run before the acceptance. Each fails its case.
7. **MOD-test-document's reader,** in an export of `1bd1d2ac`:
   - The new file has 3 declarations and 0 findings, each `release` and MOD-review-pages. Its header gives one module at
     level `release`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 1,486 test files, 5,808 declarations and 2 repeats. These are TST-1290001 and 1290002,
     the base's (ITM-1324). TST-1319205 to 1319207 stand once each.
8. **The pull request's readings hold.**
   - **"the same click":** the records come first, then each use case's items. This is TST-1319201's reading.
   - **One module per use case.** A second use case naming the same module gets no item while the first item is not done
     (SPEC.md:1683-1684).
   - **How the fixture tells the use case:** it finds the use case it is asked about from the first `UC-<nnn>` in the
     prompt it receives. It reads no document for an expected result (A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A
     DOCUMENT).
   - **Copied helpers:** the helpers repeated from `release-itm-1319-accepting-adds-items` are local to a test file,
     which exports nothing.

## Noted

- The item names no gap, and the file names none it leaves uncovered. No finding is to be ruled.
