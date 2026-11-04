---
id: ITM-1349
title: Only a file the reviewer has read gets a tick on the list
level: module
realises:
  - UC-008
  - SEVERAL FILES ARE ACCEPTED IN ONE CLICK
modules:
  - MOD-review-pages
  - MOD-settings-pages
  - MOD-site-frame
builds_on:
  - ITM-372
tests:
  - unit
origin:
  - finding UC008-S1 of ITM-372's system test TST-372212 (#1605), ruled at its gate in team1's sprint 141 (docs/gates/20261101-0613-development-release-testing-0372.md)
---
# ITM-1349 Only a file the reviewer has read gets a tick on the list

**REGISTER**

## Outcome

UC-008 3d: "Each one read gets a tick; **Accept ticked** writes one commit with one record per ticked file, each naming the
text that was shown." Today the list offers a tick for every file that is not accepted, whether or not the reviewer has
opened it (`src/review-pages/flow.mjs:143`, `rowFor` at :258). *Accept ticked* can then record the blob of a text the
reviewer was never shown, against `SEVERAL FILES ARE ACCEPTED IN ONE CLICK` ("none for a file that was not shown").

## Acceptance

- The list offers a tick only for a file whose text the reviewer has been shown in this tab. The tick names the blob that
  was shown. A file not shown has no tick.
- A file that changed after it was shown is left out of *Accept ticked* and named, as UC-008 3d gives it.
- TST-372212 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- The probe names the existing expectations that move. Each ticks a file straight from the list:
  - unit tests of MOD-review-pages: `review-pages-use-cases`, `-architecture`, `-open-changes-first`,
    `-accessible-names` and `-spec-entries`;
  - `tests/dashboard-review-flows.test.mjs:211, :234, :462, :489` (MOD-settings-pages);
  - `tests/release-sprint-01-dashboard-app.test.mjs:538, :673` and TST-905069 in `tests/site-accessibility.test.mjs:238`
    (MOD-site-frame);
  - the system and release cases TST-372211, TST-372306, TST-372312, TST-1319205, TST-1319207 and TST-371003.

  Each now opens the file's page, or `<k>/id=all`, before it ticks. No other assertion changes.
- The item names MOD-settings-pages and MOD-site-frame for those tests only (`A BACKLOG ITEM NAMES THE MODULES IT
  CHANGES`). No code of their folders changes.
- The system and release cases, and TST-372212's `todo`, change in one commit by developer-sonnet-l (`RELEASE TESTS ARE
  NOT WRITTEN BY THE IMPLEMENTER`). That commit is written from the pushed code and goes onto this pull request's branch
  before its gate, so CI is green at the gate.
- Where ITM-1291 or ITM-1170 changes the same test file, whichever pull request merges second rebases onto the sprint
  branch, runs the moved files again, and its gate reads the rebased head.
- Before the job starts, its probe reads MOD-review-pages' text on the list's ticks (MOD-review-pages.md:186-188). The
  reading taken: "each with its status and a tick" names the tick the list offers for a file read, as UC-008 3d gives
  it. What was shown is kept on the screen only.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
