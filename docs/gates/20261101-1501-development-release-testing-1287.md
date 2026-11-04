---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 331748cb674e3fb354cf1ac707d5d7dcf302d920
  - https://github.com/akmaier/agent-m/pull/1673
date: 2026-11-01 15:01 UTC
---
# Development → Release testing: ITM-1287, #1673

**REGISTER**

## Reason

ITM-1287 (the release-limitations test waits for the tag without flipping) may go on. The pull request is #1673 into
`sprint/team1/142`, at `331748cb6`, one commit by developer-opus-e (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item changes a test's wait and adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41318709373 (`331748cb6`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the test changes:** `tests/review-pages-release-limitations.test.mjs` (MOD-review-pages), +16/−9. No expected
   result and no declaration changes.
4. **The cause, named before the change.** The two failures of sprint 141 (jobs 124834480622 and 124874771399) stopped at
   "waited for the tag". *Accept* runs `acceptAndRelease`, which hashes the blob with `crypto.subtle.digest` on Node's
   threadpool before `commitFiles` and `createTag`; the old `until` (`:119-125`) gave the condition 400 turns of
   `setImmediate`, about 7 ms. A probe holding the threadpool to one thread reproduced CI's message.
5. **The Acceptance holds:** the wait polls until the condition holds, or until the flow's `p.result` shows the page
   settled, failing then by name, and at a 10 s deadline for a page that never settles. With the threadpool held, 30 of 30
   and 30 of 60 runs failed before, none after; with a free pool, none either way. Counter-proofs: without `createTag`
   three cases fail naming the tag; with a promise that never settles they fail at the deadline, by name.

## Reading taken

- "The awaited page state" is the flow's `p.result`; "neither comes" is the deadline. Taken.

## Finding, ruled

- **Eleven other test files hold the same 400-turn wait → ITM-1387 (MOD-review-pages, MOD-approvals, for their tests
  only), registered in this commit:** one helper, the wait of this item, replaces the copies.
  `review-pages-edit-architecture`, among them, flipped once in sprint 141.
- Job 124834480549 of run 41301903430 failed in `tests/runtimes-ci.test.mjs`; not read. It is counted as that file's
  first flip if it was one.
