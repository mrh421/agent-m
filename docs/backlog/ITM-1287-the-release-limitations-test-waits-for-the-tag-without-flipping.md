---
id: ITM-1287
title: The release-limitations test waits for the tag without flipping
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-review-pages
builds_on: []
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1266 (PR #1388), docs/gates/20261029-0147-development-release-testing-3737.md, point 4
---
# ITM-1287 The release-limitations test waits for the tag without flipping

**REGISTER**

## Outcome

On commit `2f3238dc`, job 123204544193 of run 40799673718 failed `tests/review-pages-release-limitations.test.mjs` with
"waited for the tag" (attempt 1), and its rerun, job 123212708513 (attempt 2), passed all five cases: the test flips on
the same commit. Its `until` (`:119-125`) gives a condition 400 turns of the event loop, which a loaded CI runner can
exceed before the fake host's answers arrive. The test waits on what the page does, not on a count of turns, and gives
the same outcome on every run of one commit.

## Acceptance

- The test's expected results are unchanged; its wait ends when the awaited page state or the fake host's last answer
  is reached, and fails by name when neither comes.
- Only the test and its helpers change.
