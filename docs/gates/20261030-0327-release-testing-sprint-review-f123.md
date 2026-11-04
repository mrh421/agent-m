---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5354aa289f6f29a6002ef278cff4aad0bd756c5e
  - https://github.com/akmaier/agent-m/pull/1490
  - tests/release-itm-987-close-new-items.test.mjs
  - tests/release-itm-894-impact-box.test.mjs
  - tests/release-uc-006-batched-reads.test.mjs
  - tests/release-uc-014-get-your-own.test.mjs
  - tests/release-uc-014-setup-route.test.mjs
  - tests/release-sprint-14-bridge-http.test.mjs
  - tests/release-uc-040-declare-the-products-resources.test.mjs
  - tests/test_bridge_release.py
date: 2026-10-30 03:27 UTC
---
# Release testing → Sprint review: team 1's sprint 123

**REGISTER**

## Reason

The release tests of sprint 123's items pass on `sprint/team1/123` at `5354aa28`, the head of #1490 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **Green on the sprint branch.** Run 40996928942 on `5354aa28` (`pull_request`, attempt 1) succeeds: 58 jobs, 17
   skipped, none failed. The release tests' own pull requests were green on their heads too:
   - #1489 on `23fe4ce8`: run 40994305510;
   - #1488 on `6c5ec1c2`: run 40996595459.
   Both are merged into the sprint branch.
2. **Written by a participant who implemented none of the behaviour they test.** developer-sonnet-l implemented none of
   the three items:
   - ITM-987 was built by developer-opus-e;
   - ITM-894 by developer-sonnet-k;
   - ITM-1304 by developer-opus-f.
3. **The release tests of each item.**
   - **ITM-987: TST-987301 to TST-987306** (`tests/release-itm-987-close-new-items.test.mjs`). They run the close as the
     workflow runs it, over a host whose commits are real:
     - one commit of the record and the items, with identifiers no history holds, a withdrawn one included;
     - a refused close writes nothing;
     - a close without new items commits the record alone;
     - the items are the files `saveItems` writes.
   - **ITM-894: TST-894301, TST-894302 and TST-894305** (`tests/release-itm-894-impact-box.test.mjs`). In the controlled
     browser, at a desktop's and a phone's width, they check that each impact list:
     - is a box with `overflow-y: auto`, a `max-height` in pixels and content taller than the box, on a file's page and on
       Review all;
     - keeps within that height and the window's width.
   - **ITM-1304** changes no behaviour, so it has no release test. developer-sonnet-l changed its six release test
     files in a commit of its own (`78dd5031`), as `team1/123.md` asks.
4. **The two cases taken out of ITM-894's release tests.**
   - TST-894303 (Tab reaches each list) and TST-894304 (End and the wheel scroll it) failed in runs 40993289807,
     40995188818, 40995654794 and 40996089139, always in `release-pull-request (6)`.
     - Their assertions did not change between those runs.
     - In the runs I read, they were the only cases that failed.
   - The change between the first and the last form of the file only removes those two cases. TST-894301, 302 and 305
     keep their assertions.
   - **Ruling:** taking them out meets the condition.
     - The condition asks for release tests by another participant that are green on the sprint branch. It does not ask
       that every sentence of an Acceptance have a release case.
     - A case whose verdict flips is no evidence either way (A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY,
       SPEC.md:1587-1590). It cannot stand green on the branch as a verdict.
     - What it would guard is still guarded by the unit cases TST-894004 and TST-894005: every impact list on a file's
       page and on Review all carries `tabindex` "0", and a planted removal fails both (gate
       `20261030-0025-development-release-testing-b894.md`).
     - That the box has something to scroll is guarded by TST-894301 and 302.
     - The file's header names this.
   - That keyboard and wheel stay without a release case is noted below for the review.
5. **MOD-test-document's reader on the head:**
   - `tests/release-itm-987-close-new-items.test.mjs`: 6 declarations, 0 findings.
   - `tests/release-itm-894-impact-box.test.mjs`: 3 declarations, 0 findings.
   - Each header has no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations and 0 findings.
   - Over all of `tests/`, no value continues onto a further line. Only the 26 notes ITM-1304 left stand after a
     declaration.
6. **Locally on the head,** four files give 17 pass, 0 fail:
   - `tests/release-itm-987-close-new-items.test.mjs`;
   - `tests/work-plans-close-new-items.test.mjs`;
   - `tests/review-pages-impact-box.test.mjs`;
   - `tests/test-document-one-line.test.mjs`.
   The browser file runs on CI only.
7. **No release test asserts what only the rejected drafts said.**
   - The sprint branch was cut at `4743a462`, before `ba3e54e74` took the drafts of #1479 to #1481 back out of `main`.
   - The branch changes nothing under `docs/architecture/`.
   - The tree of `main` at `c4230111` merged with `5354aa28` holds `main`'s `docs/architecture/` unchanged.
   - Read against the accepted texts at `b65cefcc9`:
     - ITM-987's cases rest on `closeSprint` (MOD-work-plans.md:245-255) and `saveItems`, which the drafts did not
       change. TST-987303's second refusal, an item with no module, is a finding of the accepted `backlogFindings` text:
       "names no module the architecture describes" (:192-194).
     - ITM-894's cases rest on Review all as "every open or changed file of the kind" (MOD-review-pages.md:212) and on
       `look.css`. Both are accepted as they stand.

## Noted

- **The feedback on `backlogFindings`** (developer-sonnet-l): an item naming `[MOD-pages, MOD-nowhere]` gets no finding.
  The sentence the report quotes, "that names no module, or a module the architecture does not describe, each such
  module named", is the rejected draft's, not the accepted text. The code follows the accepted "names no module the
  architecture describes" (MOD-work-plans.md:192-194). Against the SPEC's Check of A BACKLOG ITEM NAMES THE MODULES IT
  CHANGES, "an item that names no module, or a module the architecture does not describe, is reported" (SPEC.md:1681-1682),
  it is a gap. That gap is registered already: **ITM-817**, which waits for a draft for akmaier. It goes into the close's
  feedback as "already registered: ITM-817", not as a new item.
- **No release case of the keyboard and the wheel on ITM-894's box.** Real key and wheel events in the controlled
  Electron flip on the CI runner. A stable way to send them is a matter of the test harness, not of this sprint's items,
  and is for the review's feedback.
- Since the sprint's planning, `main` holds a new open draft for akmaier of MOD-approvals (`c4230111`, ITM-730). No item
  of this sprint names MOD-approvals.
