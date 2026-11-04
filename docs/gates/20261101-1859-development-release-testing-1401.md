---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9ee88659d8dabcaba9ec2379d426ff25d1129b24
  - https://github.com/akmaier/agent-m/pull/1693
date: 2026-11-01 18:59 UTC
---
# Development → Release testing: ITM-1401, #1693

**REGISTER**

## Reason

ITM-1401 (the Architecture page loads, and a page that cannot load says so in plain words) may go on. It answers akmaier's
report from the live site. The pull request is #1693 into `sprint/team1/142`, at `9ee88659d`. developer-opus-f wrote the
tests-only commit `1b9995fe8` and the code `9ee88659d` (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason, the plain words.** `1b9995fe8` adds
   `tests/review-pages-concurrent-kind-routes.test.mjs` (TST-1401001, MOD-review-pages) and
   `tests/site-frame-dashboard-page-fault.test.mjs` (TST-1401003, 1401004). It adds TST-1401002 to
   `site-frame-start-page` and moves TST-683007 of `site-frame-token-notices`, both headed MOD-site-frame. In run
   41338431522 the failing cases are TST-1401002, 1401003, 1401004 and the moved TST-683007, nothing else.
2. **The regression test is green on that commit**, since `7f22d8294` (akmaier's direct fix on `main`) is already on the
   branch.
   - TST-1401001 stands in for WebKit with a module hook: a later `import("./flow.mjs")` returns a flow that throws "Cannot
     access 'SERVICES' before initialization."
   - Both kind routes draw.
   - Counter-proof: `routes.mjs` as it was before `7f22d8294` gives `[fulfilled, rejected]` with that message.
   - The Acceptance asked for exactly this case and counter-proof.
3. **CI is green on the head:** run 41338668253 (`9ee88659d`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
4. **Only the item's module changes:** `src/site-frame/index.mjs` and `dashboard-app.mjs`.
   - `routeProblem` puts, above `readProblem`'s paragraph with the message, a `div.page-fault`: "Something went wrong while
     this page was being drawn, so it cannot be shown. Reload the page to try again. If it happens again, report it,
     together with the message below." This applies to an error that is not a host's failure. A `HostError` keeps
     `readProblem` as it was.
   - It stands in the dashboard's catch, which wrote the bare message, and in its first load. The first load named a read
     of the branch as failed, though none had.
   - It also stands in `startPage`'s four catches.
   - The messages of host failures and rate limits keep their text. No system or release test moved.
5. **The Acceptance holds:**
   - The page that cannot be drawn says in plain words what happened and what the person can do, with the error's message
     below and not in its place.
   - Counter-proof of TST-1401004: a branch that cannot be read is still named as such and shows no fault of the page.

## Readings taken

- `readProblem` keeps its form, because MOD-trace-pages and MOD-test-pages use it for parts of pages and pin its text. The
  plain words stand only where a whole route cannot be drawn. MOD-site-frame's "replaced in its place by `readProblem`"
  allows its paragraph to stand below them.
- The dashboard's first load is a view that cannot be drawn.

## Noted for akmaier

- `routeProblem` is a new export of MOD-site-frame's `index.mjs`. Today it is used only inside the module, and the
  module's text names `readProblem` alone. The general change is a sentence of its Interfaces naming what stands in place
  of a route that cannot be drawn.
