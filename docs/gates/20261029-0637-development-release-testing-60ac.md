---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 361d46e634de956e1aa3ab0cc58e1ad95bd43177
  - https://github.com/akmaier/agent-m/pull/1406
  - docs/backlog/ITM-1260-progress-and-backlog-draw-a-view-stored-for-their-commit-plan-and-board-look-at-the-model-first.md@def415474
date: 2026-10-29 06:37 UTC
---
# Development → Release testing: ITM-1260, progress and the backlog draw a view stored for their commit

**REGISTER**

## Reason

ITM-1260, pull request #1406 into `sprint/team1/112`, is returned on `361d46e6`, its head when this was decided. CI is
green, and the code does what the Outcome says. Two defects are in the tests.

The Definition of Done is the default (SPEC.md:1870-1873): "every new test names the requirement it guards and the
module it exercises".

1. **Four guards of the new tests name a use case's step.** A guards entry is "the requirements it guards by name, or use
   cases by identifier" (MOD-test-document.md:60). MOD-test-document's reader reports, under A REFERENCE NAMES THE
   IDENTIFIER, NOT THE POSITION:
   - `tests/implementation-pages-model-first.test.mjs:26`, "UC-045 1a", and `:48`, "UC-032 step 7";
   - `tests/implementation-pages-backlog-stored-view.test.mjs:54` and `:71`, "UC-032 step 6".
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - **The mend:** "UC-045" and "UC-032", as TST-1257003 and 004 were mended (#1395).
2. **TST-1260003's counter-proof was weakened in the implementation commit.**
   - ITM-1260's Acceptance: "Counter-proofs: an item no running sprint selects is not in `progressView`".
   - The tests-only commit `6ad61bb4` asserted it for both such items:
     `for (const outside of ["ITM-003", "ITM-004"]) assert.ok(!progress.includes(outside), …)`.
   - `f37bf63e` narrowed it to ITM-004 alone. For ITM-003, selected by team2's closed sprint, it now only checks that
     ITM-003 stands among no team's sprint items (`tests/progress-measures-views.test.mjs:152-153`). Anywhere else in the
     view, ITM-003 would pass unnoticed.
   - **The code needs no change.** I ran `progressView` on the test's own facts at `361d46e6`: ITM-001 is in its text, the
     known positive, and ITM-003 and ITM-004 are not.
   - **The mend:** restore the assertion of `6ad61bb4` for both items. It passes on the code as it stands.

**What holds, read for the next decision.**
- **CI:** run 40829630189, on `361d46e6` after the sprint branch was merged in, passes 38 of 38 pull-request jobs.
- **Red first:** the tests-only commit `6ad61bb4` is red in run 40825796665, in the item's cases. Its TST-1169002 failure
  is a new declaration's two-line `given:`, mended in the implementation commit. That is the new tests' own form, as was
  accepted for ITM-1254 and ITM-1266.
- **Scope:**
  - Code: MOD-progress-measures, MOD-implementation-pages, MOD-repository-hosts, MOD-workflow-entries, MOD-site-frame.
  - `index.html` and `docs/index.html` are the entry pages whose preloads are MOD-site-frame's part `preloads.mjs`
    (MOD-site-frame.md:85).
  - `readFileAt`, which plan and board call, is in MOD-implementation-pages' Uses (:70, :272).
  - The changed tests name the item's modules, MOD-main-page's setup among them, as ruled.
- **The changed and removed tests follow from the Outcome:**
  - TST-1252203 and `progress-measures-scope-now.test.mjs` go with the scope `now`.
  - TST-1117009 expects the four files `publishOverview` adds (MOD-progress-measures.md:304-309). TST-1117010 drops `now`.
  - The fakes of the plan and board tests gain `readFileAt`.
  - `dashboard-backlog-teams` counts 11 requests on the derived path, because no view is stored in its fake.
  - TST-1259002 loses `updated_after`, as ruled.
  - TST-1260203's input gains the closer, which `startSprint` requires.
- **The developer's readings:**
  1. The module text gives `publishOverview` three files and `latest.json` (MOD-progress-measures.md:304-309). The
     Acceptance's "four files" counts the schedule's view, which is ITM-1265's. The text binds.
  2. The measure limited to the running sprints' items holds: it is what "the running sprints alone" and the
     counter-proof ask.
  3. The running sprint as the newest record without `## Review` holds.
  4. `implement` reading the stored backlog view is ITM-1264's, which builds on this item.
  5. `views.mjs`'s own gzip lines repeat MOD-trace-graph's, which its interface does not offer. That is against AGENTS.md
     §2 principle 2, and sharing it needs an interface no module file names. It is registered as ITM-1299, waiting for a
     draft, and is no reason for this return.
- **The reader on the other new and changed tests:**
  - `progress-measures-views` 3, `progress-measures-publish-views` 2, `implementation-pages-progress-stored-view` 3,
    `progress-measures-product-facts` 39, `load-per-view` 10, `repository-hosts-pull-request-pages` 2,
    `workflow-entries-main-changed` 10, `workflow-entries-merge-request-closed` 4, `main-page-root-entry` 4 and
    `progress-measures-build-and-waits` 7.
  - All with 0 findings.
  - `implementation-pages-progress` keeps the two findings it had before this PR ("UC-035 steps 3, 4 and 5", "UC-035
    2b"). They are ITM-1300's, registered in this commit, and no reason for this return.
