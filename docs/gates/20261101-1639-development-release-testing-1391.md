---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8d248ad2060041b88db7115dbdf35275129519d3
  - https://github.com/akmaier/agent-m/pull/1684
date: 2026-11-01 16:39 UTC
---
# Development → Release testing: ITM-1391, #1684

**REGISTER**

## Reason

ITM-1391 (a proposal names the version of its source) may go on. The pull request is #1684 into `sprint/team1/142`, at
`8d248ad20`. developer-sonnet-j wrote the tests-only commit `9c4fc93d0` and the code `da8145afa`; developer-sonnet-l wrote
`8d248ad20`, the lift of TST-579219's `todo`, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `9c4fc93d0` changes
   `tests/spec-changes-queue-entries.test.mjs` (MOD-spec-changes) only. In run 41325653860 its failing cases are the new
   TST-1391001, 1391002 and 1391003 and the two moved expectations TST-666003 and 1247102, nothing else.
2. **CI is green on the head:** run 41326344322 (`8d248ad20`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/spec-changes/propose.mjs`. `queueEntries` reads the version that
   `linkedVersion` gives for the job's source through `linkOf`, which `isLinked` now uses too. `rationaleOf` writes
   ` Source version: <version>.` after the sentence naming the source and its passages. A source linked at no version is
   named without one.
4. **The Acceptance holds:** every rationale of an entry derived from a linked source names the version the product links,
   with an issue and by prompt as well, and not the newest the register holds. Planted faults (the version dropped with an
   issue, the newest row taken, `?? "unknown"`) each fail their own case. TST-579219 loses its `todo`: red at `9c4fc93d0`,
   green on `da8145afa`. sonnet-j wrote that case and implemented the item; sonnet-l, who lifted it, built none of it.

## Readings taken

- "The source passage and version" of a rationale's origin (MOD-spec-changes, Data) is the version the product links,
  the one the job read (UC-005 step 1). It is a sentence of its own, so TST-579309's pattern still matches.
- **The two moved expectations.** TST-666003 counts one read of `docs/sources.md` and one of the source's register entry
  more, since the writer now always reads the link that names the version. TST-1247102's origin text gains the version. Both
  moved in the tests-only commit and were red there. MOD-spec-changes' Uses name `linkedVersion`, so the accepted text
  allows the reads.
