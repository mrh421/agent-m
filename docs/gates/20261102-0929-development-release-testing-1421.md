---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1ecbf6210222dfcbcfc0c6532e5bb59b5fe240ce
  - https://github.com/akmaier/agent-m/pull/1722
date: 2026-11-02 09:29 UTC
---
# Development → Release testing: ITM-1421, #1722

**REGISTER**

## Reason

ITM-1421 (Implement shows why a ready item returned) may go on. The pull request is #1722 into `sprint/team1/142`, at
`1ecbf6210`. developer-sonnet-k wrote the tests-only commits `58790e9d0`, `cb379bf80` and `f9648a546` and the code `5ed2d7bad`;
developer-sonnet-l wrote `1ecbf6210`, the lift of TST-805218's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The tests-only commits are red for the item's reason.** They add TST-1421001 to 1421005 to the tests of Implement
   (MOD-implementation-pages) and a helper `implementation-pages-ended-job.mjs`. The third compares the paragraphs' texts
   instead of their nodes, on which a failing comparison hung. In run 41419676276 (`f9648a546`) the failing cases are
   TST-1421001, 003, 004 and 005; 002 is their counter-proof and passes.
2. **CI is green on the head:** run 41420384184 (`1ecbf6210`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/implementation-pages/implement.mjs`.
   - Since ITM-1416, `states.mjs:211` gives an item a rejected gate returned `ready`, with the End's reason. Implement drew
     only the state's badge in its State cell, for the backlog's rows, the plan's and the view stored last. The reason
     reached only the reasons of a row that cannot start.
   - Now one `returnedBy(state)` draws the reason of a ready state that carries one, in those three cells.
4. **The Acceptance holds:**
   - A ready item or step that a rejected gate returned shows its reason in its row, startable or not, from the live and
     from the stored view. One with no reason shows none.
   - The five counter-proofs in the pull request each fail named cases.
5. **TST-805218 loses its `todo`.**
   - Its world now holds the End that MOD-runtimes' `resumeJob` writes, with the host TST-805219 uses.
   - It keeps its known positives (blocked while the job only waits) and adds one: the writer's commit holds `## End`.
   - Its expectation is unchanged: ready, startable, the reason on the row.
   - It is red at `f9648a546` on the reason alone, and green with the code. The UC-034 system file gives 21 of 21.
   - sonnet-j wrote the case, and sonnet-l built none of the behaviour.

## Readings taken

- The reason is drawn in the State cell of any ready row, startable or not (UC-034 7a and the item's Acceptance).
- The plan's rows and the view stored last draw it too (UC-024 10a). Every page that draws the state is checked, as the
  brief asks of an item that changes what a view derives.
- Only a ready state's reason is drawn here.

All are taken.

## Noted

- sonnet-l read `SPEC.md` up to line 650, and the brief with `cat`. Its change is a test's world and keeps the
  expectation. It stands, as at ITM-1389's gate; the brief's full reads hold for the next change.

## Flips counted

- `review-core.d/review-pages-reject` (TST-2026271023, "waited for the rejection commit") failed in run 41419773756 on
  `5ed2d7bad`, outside the item's module, and passes on the head. Its `until` (lines 41-47) waits 400 turns of the event
  loop, as the files ITM-1387 changed did. It is its first flip, counted here; a second makes it an item.
