---
id: ITM-1301
title: The specification says which waiting entry marks a requirement
level: module
realises:
  - OPEN PROPOSALS ARE SHOWN IN THE BROWSER
modules:
  - MOD-trace-pages
builds_on:
  - ITM-1274
tests:
  - unit
origin:
  - developer-sonnet-l's release tests of ITM-1274 (PR #1409), and po-opus-c's gate of sprint 112's release tests, docs/gates/20261029-0705-release-testing-sprint-review-f760.md, point 1
---
# ITM-1301 The specification says which waiting entry marks a requirement

**REGISTER**

## Outcome

When two waiting entries name one requirement, `arrangement` (`src/trace-pages/flow.mjs:552`) takes the first that the
waiting queues give, the newest queue's, for the requirement's mark. Both entries stand in the page's list of waiting
entries, each with its status and a link (MOD-trace-pages.md:130), as OPEN PROPOSALS ARE SHOWN IN THE BROWSER asks. Its
comment says only "in the order of the entries", which reads as the queues' own order. The comment says that the mark is
the newest queue's, as `waitingQueues` lists them, and a unit test pins it.

## Acceptance

- A unit test naming MOD-trace-pages: two waiting entries, of two queues, name one requirement, one changing it and one
  withdrawing it. The requirement's mark is the newer queue's, and both entries are listed. Counter-proof: the older
  queue's mark planted fails it.
- The comment at `arrangement` says the same. No behaviour changes.
- Only `src/trace-pages/` and the tests that name MOD-trace-pages change.
- Tests of other modules this Outcome changes: none. No behaviour changes.
