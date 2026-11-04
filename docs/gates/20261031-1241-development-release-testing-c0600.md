---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a9d56d22992637f8883226744d6d36116e58cf94
  - https://github.com/akmaier/agent-m/pull/1568
date: 2026-10-31 12:41 UTC
---
# Development → Release testing: #1568, ITM-600 Two versions are compared in the specification and gaps views

**REGISTER**

## Reason

1. **The tests-only commit is red for the item's reason.** `e320337c7` holds only tests. Run 41201454365 is red on it:
   TST-600401, 600402 and 600411 to 600415 fail, since `compareGraphs` and the second choice do not exist yet.
   `23abed17e` changes only its own new test file.
2. **CI is green on the head:** run 41201786343 on `a9d56d229`.
3. **Scope.**
   - The code changes are in `src/trace-graph/` and `src/trace-pages/`.
   - The two new test files name MOD-trace-graph and MOD-trace-pages in their headers.
   - No existing expectation changed.
   - The new imports, `compareGraphs` and `showDifference`, are in MOD-trace-pages' Uses.
4. **New tests.** Each names its requirement and its module, and has a counter-proof in the pull request.
   MOD-test-document's reader finds 2 and 5 declarations with 0 findings. Its control,
   `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
5. **The Acceptance holds.**
   - `compareGraphs` gives the `Comparison` its file states, over the `Graph` its file states.
   - The specification marks what was added, changed and removed, and a changed requirement opens with its difference.
   - The gaps show what became covered and what lost its coverage.
   - A second version whose graph is not stored is named with `GraphNotStored`.

## Noted

- **For akmaier: UC-020 1b's "changed" cannot be built in full as the architecture stands.** MOD-trace-graph's `Graph`
  keeps no text or blob of a requirement, only its sources (MOD-trace-graph.md:146-148 and Data). So `compareGraphs`
  finds a changed requirement only when its sources differ. A change of its rule or check alone is not found. This is the
  architecture's gap, not this change's, so it does not fail the item.
- **Reading accepted:** the second choice offers the other versions of the version choice; at a tag, only tags
  (MOD-trace-pages.md:72-73 leaves it open).
