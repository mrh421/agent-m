---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2bad68a7cc2a8a4c0c7e7651923457aeab15edf3
  - https://github.com/akmaier/agent-m/pull/1563
date: 2026-10-31 11:58 UTC
---
# Development → Release testing: ITM-1328, in a planned model the backlog page links the implementation plan and draws no backlog

**REGISTER**

## Reason

ITM-1328 is by developer-opus-f, pull request #1563 into `sprint/team1/132`.

1. **First commit only tests, red:** `c60d424d1` holds only `tests/implementation-pages-backlog-planned-model.test.mjs`
   (new, TST-1328001) and TST-681008's changed expectation in `tests/implementation-pages-backlog.test.mjs`. Run 41198437679
   is red on it with those two files alone failing: the link is `#progress` and the backlog is drawn. That is the item's reason.
2. **CI green on the head:** run 41198588737 on `2bad68a7c`. The code commit `91119ddfc` is green on 41198523311.
3. **Scope:**
   - `src/implementation-pages/backlog.mjs` (`paint`).
   - The new test, and TST-681008 and TST-803024. These are in files headed MOD-implementation-pages, and the Acceptance names both tests.
   - `2bad68a7c` is developer-sonnet-l's, who implemented none of the item. It takes away TST-803024's `todo` and moves
     `1b-link-to-the-plan` to `FLOW_EVIDENCE`. In TST-803014 it changes only the stale `FINDING` clause of its `expect` text;
     its assertions are unchanged, so no expected result changes.
4. **Requirement, module, counter-proof:** TST-1328001 guards UC-032 and names MOD-implementation-pages. Its counter-proofs
   are in the pull request. MOD-test-document's reader finds 1, 13 and 26 declarations in the three files, with 0 findings.
   Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
5. **Acceptance:**
   - In a V-model product, `#backlog` links `#plan` and draws no part `backlog` or `uncovered`.
   - The Scrum product still draws both, its known positive.
   - The base fails, its counter-proof.
   - TST-681008 now asserts `#plan`.
   - TST-803024 has no `todo`.

**The reading taken on the warning's wording.** The Acceptance says TST-803024's known positive, "plans its work in
advance: there is no backlog (UC-032 1b)", stays, "and so does the warning's wording". Those words stay. The same
Acceptance moves the warning's link from `#progress` to `#plan`, and the old words after the dash were that link's text
("its progress is shown on Progress"). So they change with the link, to "its work follows the implementation plan
(UC-045)". I take "the warning's wording" as the words its known positive asserts. Named for the review.
