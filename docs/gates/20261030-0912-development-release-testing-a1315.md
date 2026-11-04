---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b7c84cefe65da4b8cb2de7e8ff87a1fac14971fb
  - https://github.com/akmaier/agent-m/pull/1515
date: 2026-10-30 09:12 UTC
---
# Development → Release testing: ITM-1315, Accept stays on a file's page, disabled, while the file rests on what is not accepted

**REGISTER**

## Reason

ITM-1315, pull request #1515 into `sprint/team1/127`, passes on `b7c84cef`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `8cbe47d5`:** run 41030114126 (`pull_request`, attempt 1) fails in two jobs, 123977664795 and
     123977665384. Their only failing cases are the item's three:
     - the changed `#arc/<id>` case of `tests/load-per-view.test.mjs`;
     - the changed TST-472610 and the new TST-1315001 of `tests/review-pages-architecture.test.mjs`.
     - That is the item's reason: on the code as it stood, `offerAcceptance` returned after the section of what the file
       rests on and drew no *Accept* (`src/review-pages/flow.mjs:618` of the base).
   - **Implementation commit `92dd7b58`:** run 41030402845 succeeds: 41 jobs succeed, 17 are skipped, none failed.
   - **Head `b7c84cef`:** run 41030690586 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed.
2. **Only the item's files change.**
   - MOD-review-pages: `flow.mjs`, six lines in `offerAcceptance`. Where the file rests on what is not accepted and a
     token is stored, it draws `button("btn accept", "Accept")` with `disabled` set and no listener, after the section.
     Without a token nothing is drawn there, as before. It imports nothing new and adds no top-level await.
   - The tests the Acceptance names: TST-472610 and the new TST-1315001 (`review-pages-architecture`, MOD-review-pages),
     the `#arc/<id>` case of `load-per-view` (MOD-site-frame), and, in developer-sonnet-l's commit, the system test.
   - `8cbe47d5` holds only tests and `92dd7b58` only the code, both by developer-sonnet-j. `b7c84cef` changes only
     `tests/system-uc-023-modify-the-architecture.test.mjs`, by developer-sonnet-l (`Agent-M-Participant`).
3. **It builds the accepted text and the item's Acceptance** (UC-023 4b: "*Accept* stays disabled and names it";
   MOD-review-pages.md:200-201).
   - TST-1315001: ARC-004, resting on UC-002, which no record names, shows the section naming UC-002 and, after it, one
     *Accept*, disabled. A click commits nothing, and the page stays as it was. Known positive, in the same case: with a
     record naming UC-002 there is no section, and one enabled *Accept* whose click commits one record naming ARC-004's
     path and blob, on the head that was read.
   - TST-472610: ARC-004 and MOD-finer each show one *Accept*, disabled, and no GitHub page; nothing is written.
   - The `load-per-view` case: MOD-review shows one disabled *Accept*. The counter-proof, MOD-page, shows an enabled one.
   - TST-739104 is unchanged and passes: the page "offers no Accept that can be pressed".
   - developer-sonnet-l's commit takes TST-739012's `todo` away, moves `4b-accept-disabled` from `FLOW_FINDINGS` to
     `FLOW_EVIDENCE` with TST-739012 as its evidence, and removes the line of UC023-S5 from the file's header and the
     FINDING sentence from TST-739012's `expect`. The case's body is unchanged. The Acceptance asks for this, made by a
     participant who implemented none of the item.
4. **The pull request's readings hold.**
   - The new case stands in `review-pages-architecture`, whose `fakeHost` it reuses, rather than in a file of its own.
     The Acceptance asks for "a unit case of the decision's page" and names no file.
   - The changed `load-per-view` case is MOD-site-frame's. The Acceptance names it, and its request counts are untouched.
5. **Counter-proofs.**
   - The Acceptance's counter-proof, "on the code as it stands, the page holds no button *Accept*", is the red run of
     point 1.
   - Planted on the head in an export, each restored after. The files: the two changed, the system test, UC-023's release
     files `review-pages` and `reject`, the release and unit files of ITM-1314, `trace-graph-import-uses` and
     `test-document-one-line`.
     - *Accept* drawn enabled: the `load-per-view` case, TST-472610, TST-1315001, TST-739104, TST-739007 and TST-739012
       fail.
     - No *Accept* drawn, as the base: the `load-per-view` case, TST-472610, TST-1315001 and TST-739012 fail.
     - A second, enabled *Accept* beside the disabled one: the same six fail as for the first plant.
   - Restored: 76 of 80 pass, 3 `todo` (UC023-S1, S3, S4). The one failure is TST-106805, which needs `.git`. Run in a
     checkout at `b7c84cef`, its 5 cases pass.
6. **MOD-test-document's reader:**
   - `tests/review-pages-architecture.test.mjs`: 13 declarations, 0 findings. TST-1315001 is read with level `unit` and
     module MOD-review-pages. The header gives MOD-review-pages and level `unit`.
   - `tests/load-per-view.test.mjs`: 11 declarations, 0 findings. The header gives MOD-site-frame and level `component`.
   - `tests/system-uc-023-modify-the-architecture.test.mjs`: 13 declarations, 0 findings. The header gives four
     modules, one per line, and level `system`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - TST-1315001, as declared:
     - Given: ARC-004, open, which names UC-002, a use case that no approval record names; and a token.
     - Input: the route decision rendered for ARC-004, then a person's click on its Accept. Then the same page on a
       product where a record names UC-002's text, and a person's click on its Accept.
     - Expect: the section of what it rests on that is not accepted, naming UC-002, and after it one button Accept,
       disabled; the click commits nothing, and the page still shows the section and the disabled Accept. Known
       positive: with the record, no such section, and one button Accept, enabled, whose click commits one record
       naming ARC-004's path and blob at `docs/approvals/ARC-004-<blob12>.md`, on the head that was read.
     - Each part of it, the known positive included, is asserted in the case.
7. **Reads, against the planning count** (`team1/127.md`): the change reads nothing. The names come from the
   `acceptanceBlockers` call the page makes already, and every request count of `load-per-view` passes on the head.

## Noted

- The changed `load-per-view` case has no `TST-` declaration of its own, as on the base. The reader therefore counts it
  in no declaration. The item did not write that gap.
- The Developer did not read MOD-site-frame.md, though it changed one of that module's tests. The change touches no
  value or interface of MOD-site-frame, and the Acceptance names the case, so nothing of the item rests on that file.
- The pull request's description names no `JOB-` identifier and leaves the run ids "to follow". The runs are those the
  Scrum Master gave, read above.
