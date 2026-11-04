---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5e4f89c47096ce6d6862febc8cf0c8ec7732314d
  - https://github.com/akmaier/agent-m/pull/1507
  - tests/release-itm-730-removed-files.test.mjs
  - tests/release-itm-1067-register-entries.test.mjs
  - tests/release-itm-1307-schedule-one-rule.test.mjs
date: 2026-10-30 06:28 UTC
---
# Release testing → Sprint review: team 1's sprint 125

**REGISTER**

## Reason

The release tests of sprint 125's items pass on `sprint/team1/125` at `5e4f89c4`, the head of #1507 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **Green on the sprint branch.**
   - Run 41013853598 on `5e4f89c4` (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none failed.
   - The release tests' own pull requests were green on their heads. All three are merged into the sprint branch:
     - #1506 (ITM-730) on `d951afcf`: run 41013443957, attempt 1;
     - #1505 (ITM-1067) on `65afc77f`: run 41013087988, attempt 1;
     - #1504 (ITM-1307) on `61544bb8`: run 41012809469, attempt 1.
2. **Written by a participant who implemented none of the behaviour they test.** Each release commit carries
   `Agent-M-Participant: developer-sonnet-l`, who implemented none of the four items:
   - ITM-730 was built by developer-opus-e (`c5722793`, `09df957e`, `03326195`);
   - ITM-1067 by developer-sonnet-k;
   - ITM-1307 by developer-opus-f;
   - ITM-659 by developer-sonnet-j.
3. **The release tests of each item.**
   - **ITM-730: TST-730301 to TST-730303** (`tests/release-itm-730-removed-files.test.mjs`). A person opens
     `#decision/id=all` over a restructuring with a changed, a new and a removed module file.
     - Review all draws the removed file with the badge "removed since acceptance", its last accepted text as removed
       lines, and its impact list naming the module and its code file. The button reads "Accept all 3 shown".
     - The click writes one commit of three records, the removal's naming the empty text's blob. The next load shows no
       removed file.
     - A file put back between the page and the click is left out as changed since shown, and no record of its removal is
       written.
   - **ITM-1067: TST-1067301 and TST-1067302** (`tests/release-itm-1067-register-entries.test.mjs`).
     - On a product's entry page, a file under `docs/sources/` that is no `SRC-` entry, shaped like one, gives the prompt
       bar no source and is never asked for.
     - On the instance's own entry page and its Review all, the batches name exactly the files `registerPaths` names.
   - **ITM-1307: TST-1307301** (`tests/release-itm-1307-schedule-one-rule.test.mjs`). A person opens Tests → Schedule for a
     product with no stored view.
     - The rows show `scheduleView`'s counts for its eight declarations. Of the two of the level `paid`, the one that
       calls no paid service counts under no row.
     - The test files are read in one batch.
   - **ITM-659** changes no behaviour (its Acceptance: "No expected result of a test changes"), so it has no release test.
4. **The readings sonnet-l named hold.**
   - **ITM-1067:** "read as a register entry" is observed in two ways:
     - on a product's page, through the source the page gives the prompt bar's subject (THE PERSON WHO PROMPTS IS A
       SOURCE);
     - on the instance's own page, through the batches.
     Both are what the page does with an entry. A file the page never asks for and never offers as a source is not read
     as one.
   - **ITM-730:** "the head holds a file of its identifier" at the click is a file `MOD-shelf.md` put on the default
     branch between the page and the click. That is the case "left out as 'changed since shown' when the head holds one"
     (MOD-approvals.md:129-130).
   - A file put back after its removal was accepted is not asserted, as my Development gate of #1503 ruled: it is for an
     item of its own.
5. **MOD-test-document's reader on the head:**
   - `release-itm-730-removed-files`: 3 declarations, 0 findings;
   - `release-itm-1067-register-entries`: 2 declarations, 0 findings;
   - `release-itm-1307-schedule-one-rule`: 1 declaration, 0 findings;
   - each header gives level `release`, its modules one per `Module:` line, and no finding;
   - the control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
6. **Locally on the head,** in an export of `5e4f89c4`: the three release files and `tests/test-document-one-line.test.mjs`
   give 8 pass, 0 fail.
   - My own counter-proof: the old pattern put back in `sourcesOf`'s `entryPaths` fails TST-1067301 and TST-1067302.
     Restored, 2 of 2.
   - Each case names its planted faults in its declaration's notes.
7. **Nothing of a draft is relied on.** `docs/architecture/` is unchanged on the branch, and every module file the tests
   rest on is accepted on `main`.

## Noted

- The defect my Development gate of #1503 found stands for the close's feedback as a new item: a file put back after its
  removal was accepted makes `lastAcceptedText` throw `NotFound`.
