---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a45017614ba4c27ae5e07077be365ffb357327e1
  - https://github.com/akmaier/agent-m/pull/1706
date: 2026-11-01 20:46 UTC
---
# Development → Release testing: ITM-1410, #1706

**REGISTER**

## Reason

ITM-1410 (a queued job whose route does not answer names the route) may go on. The pull request is #1706 into
`sprint/team1/142`, at `a45017614`. developer-sonnet-k wrote the tests-only commit `140853ebb` and the code `3616d3d5e`;
developer-sonnet-l wrote `a45017614`, the lift of TST-805211's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `140853ebb` adds
   `tests/implementation-pages-implement-queued.test.mjs` (MOD-implementation-pages). In run 41347402276 the failing cases
   are TST-1410001 and 1410002. TST-1410003, their counter-proof, passes there as it should.
2. **CI is green on the head:** run 41347794705 (`a45017614`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/implementation-pages/implement.mjs` and `progress.mjs`.
   - When the route fails after the start record is committed (`failure.queued`), the start's catch names the job, its
     route and its record, and links the job's page.
   - `progress.mjs` exports its one `jobHref` for that link.
4. **The Acceptance holds:**
   - A job whose Bridge does not answer is shown queued, with the route that is down, and with a link to its page, where
     UC-036's Cancel and Retry stand.
   - Counter-proof: a start whose record was never committed still says that nothing was started and links no page.
   - Each new case has a planted fault that only it catches.
   - TST-805211 loses its `todo`: red at `140853ebb`, green at `3616d3d5e`. sonnet-j wrote the case, and sonnet-l built
     none of the page.

## Ruled

- **TST-1410002's expected address changed in the code commit**, from `#job/id=<id>` to `#job/id=<id>/product=<address>`.
  The job page of a product needs the product in its address, as `jobHref` writes it. The case now asserts more, not less,
  and it was red at the tests-only commit for the item's reason, the link missing.

## Readings taken

- UC-034's "the author may cancel or reassign the job" is met by the link to the job's page.
- Only the Bridge's route can fail after the start record is committed.

## Noted

- `implement.mjs:231`, in the plan's part of the page, still names no route. No case guards it. It is a candidate for the
  review, not registered now.
