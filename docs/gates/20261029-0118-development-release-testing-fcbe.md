---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5c8dcd9fcb1fdee861dd1973ac331a8f94c5eba6
  - https://github.com/akmaier/agent-m/pull/1386
date: 2026-10-29 01:18 UTC
---
# Development → Release testing: ITM-1254, the issue route offers an existing item, names why Move is not offered, and a comment to copy without a token

**REGISTER**

## Reason

ITM-1254, pull request #1386 into `sprint/team1/110`, passes on `5c8dcd9f`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default, "The job rules hold for every pull request; no condition is added"
(`docs/process.md:31`). SPEC.md:1870-1873: "a pull request is done when its CI run is green, the job's first commit held
only failing tests …, it changes only the job's modules, every new test names the requirement it guards and the module
it exercises, and every gate the workflow places before the merge is recorded."

1. **CI is green.** Run 40797777183 on `5c8dcd9f` passes 38 of 38 pull-request jobs. The 17 jobs of other triggers are
   skipped.
2. **The first commit held only failing tests.**
   - `bf2deae2` changes only `tests/issue-handling-backlog.test.mjs` and `tests/maintenance-pages-move-1250.test.mjs`.
   - Run 40797428300 is red on it, from the logs of its three failing jobs:
     - TST-1254101 (unit shard 9, job 123197248644): no token, the comment to copy;
     - TST-1254201 and 1254202 (component shard 4, job 123197248205): 1a and 4a.
   - The fourth failure, TST-1169002 (unit shard 1, job 123197248090), names "TST-1254101 lacks input, expect". That is
     the new test's own declaration, put on one line in the second commit.
   - No test that existed before failed.
3. **Only its modules change.** `src/issue-handling/backlog.mjs`, `src/maintenance-pages/issues.mjs`, and two tests
   that name MOD-issue-handling and MOD-maintenance-pages.
4. **Every new test names its requirement and module.** TST-1254101 (MOD-issue-handling; UC-033 4b), TST-1254201
   (MOD-maintenance-pages; UC-033 1a) and TST-1254202 (MOD-maintenance-pages, MOD-issue-handling, MOD-work-plans;
   UC-033 4a).
5. **The behaviour matches the accepted texts.**
   - 1a: an unclassified issue says why Move is not offered and leads to UC-012 through `context.go`.
   - 4a: the backlog's items are offered, and *Add to* calls `moveToBacklog` with `existing`.
   - 4b: `NotSupported`, which `commentOnIssue` gives only without a token, returns the comment to copy, as
     `PermissionMissing` does (MOD-issue-handling.md:82-84; UC-033 4b).
   - The reading is the one sprint 110's planning named, and the description names it.

## Noted

- **A third pattern of an item's file.** `issues.mjs:237` adds `BACKLOG_ITEM`, beside `ITEM_FILE` in the same file
  (`:236`) and the pattern of `src/work-plans/strategies.mjs`. That is against AGENTS.md §2 principle 2, but it is no
  condition of the Definition of Done. ITM-1255 now names it (its Outcome, on `main`), and removes it.
- **One expected result changed in the implementation commit.** `tests/maintenance-pages-move-1250.test.mjs:309-311`
  expects `["ITM-001", "ITM-0900"]`, because the harness's product also holds ITM-0900. The test now states what the
  fixture holds. The behaviour it checks, every item of the backlog offered, is the same.
- **Move to backlog reads every item file of the backlog on its click,** in batches through `readMany`, to list them.
  That is on a person's click, not on the page's load. It is a candidate for akmaier's direction of 2026-10-28, "what is
  read is what the page shows", in a later item.
