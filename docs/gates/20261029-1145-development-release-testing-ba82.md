---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9538d1a81869401a59cf96659d3cd0c47a18f3ee
  - https://github.com/akmaier/agent-m/pull/1444
date: 2026-10-29 11:45 UTC
---
# Development → Release testing: ITM-1303, the fix trail test gives its open pull request's facts

**REGISTER**

## Reason

ITM-1303, pull request #1444 into `sprint/team1/117`, passes on `9538d1a8`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874). The item changes a test and no behaviour. So its commits are
green, as A REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469), and the sprint's brief says so of
ITM-1303.

1. **CI is green on its one commit.** Run 40867220890, `pull_request`, on `9538d1a8` passes 38 of 38 pull-request jobs.
2. **Only the item's file changes:** `tests/maintenance-pages-fix-583.test.mjs` (MOD-maintenance-pages), as the
   Acceptance says. No code changes, no test of another module changes, and no test is removed.
3. **The Acceptance holds.**
   - The fake host now answers the facts of a listed pull request: the request itself, its commits, files and reviews,
     and its commit's check runs and statuses. It answers 404 for a number it does not list.
   - TST-583207 states that no `issue-problem` is drawn, and its `given:` and `expect:` say so.
   - Every earlier expectation stays: the trail's link to #9 as open, no *Close with links*, the issue not closed.
4. **The counter-proof, run by me on `9538d1a8`.**
   - With the new fixture's answer taken out, the file runs 6 pass and 1 fail, on "The fix could not be read: NotFound:
     pull request #9 of https://github.com/alice/product was not found."
   - That is the path the developer names: `pullRequestFacts` (`src/repository-hosts/github.mjs:608`), then
     `issues.mjs:377`, then the catch at `:414`.
   - Restored, it runs 7 pass.
5. **The reading holds.**
   - The test now waits for `fix-no-expectation` or `issue-problem`, where it waited for `fix-pull`. That is a condition
     to wait on, not an expected result: `fix-no-expectation` is drawn once the facts are read.
   - `fix-pull` and its "is open" text are still asserted after the wait (`:305`).
6. **The reader.** On `9538d1a8`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `maintenance-pages-fix-583`: 7 declarations and 0 findings.
   - `tests/test-document-one-line.test.mjs`: 2 pass.

## Noted

- ITM-1303 changes a test and no behaviour, so no release test of it is due, as for ITM-1300 in sprint 116.
