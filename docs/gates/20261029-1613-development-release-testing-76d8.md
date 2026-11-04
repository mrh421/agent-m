---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8d077b542981d71dff5c1db310c55778edd710cb
  - https://github.com/akmaier/agent-m/pull/1463
date: 2026-10-29 16:13 UTC
---
# Development → Release testing: ITM-1283, the issue-to-SPEC check saves a change on a GitLab server too

**REGISTER**

## Reason

ITM-1283, pull request #1463 into `sprint/team1/120`, passes on `8d077b54`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item adds a release-level test and changes no code, so its one
commit is green, and no failing first commit is asked of it.

1. **CI is green.** Run 40908415353 (`pull_request`, head `8d077b54`) succeeds: 58 jobs, none failed.
2. **Only the item's files change.** The diff against `sprint/team1/120` is `tests/test_issue_to_spec.py` and
   `tests/test_issue_to_spec.md`, as the item's Acceptance names. The case's data stands in the `.md` file. The `.py` file
   holds the loader, the adapter and the fake GitLab server (AGENTS.md §7). No test is removed, and no expected result of
   TST-1152001 to 003 changes.
3. **The new case names what it guards and the module it exercises.** TST-1283001 is at level `release`, guards
   EVOLUTION ENTERS THROUGH THE SPECIFICATION and UC-012, and names MOD-issue-handling, MOD-maintenance-pages and
   MOD-spec-changes.
   - MOD-test-document's reader over `tests/test_issue_to_spec.py` gives 4 declarations and 0 findings. Its control,
     `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
   - `test-document-one-line` passes, 2 of 2. The Python checks `test_test_battery` and `test_test_levels` are OK, and so is
     `test_identifier_stability`. TST-1283001 is held by this one declaration only.
4. **It fails on a planted fault, checked by me on `8d077b54`.**
   - `test_issue_to_spec` passes: 4 tests, OK.
   - I made GitLab's `commitFiles` (`src/repository-hosts/gitlab.mjs:303`) leave out every file under
     `docs/spec-freigaben/`. With that, TST-1283001 alone fails, on `queueNames: []` against the issue's address, and the
     other three pass. With the fault removed, the tree is clean.
5. **The writer implemented none of what it checks** (SPEC.md:1537-1541). The commit's trailer names developer-sonnet-j.
   The GitLab path of the queue write came from developer-sonnet-a, developer-sonnet-b and the coordinator's session.

## The reading ruled

The item's Outcome points at `src/spec-changes/propose.mjs:400`, `:411` and `:468`, the GitLab branches of
`proposeSection` and `saveEntry`, which save a section edited on the dashboard. A change drafted from an issue goes
another way. It runs through `queueEntries` (`propose.mjs:212`), which commits through `host.commitFiles`
(`gitlab.mjs:303`).
- **The test follows the Acceptance, and that is right.** The Acceptance asks for "a fault planted in the GitLab branch of
  the queue write", in a case that "saves a change from an issue on a GitLab product". The issue's queue is written by
  `queueEntries`, so that is the branch the case must reach. The line numbers of the Outcome are pointers, and the case
  does not bind them (AGENTS.md §1: "A pointer is a signpost").
- **The GitLab branches of `proposeSection` and `saveEntry` stay uncovered by this test.** They belong to a section saved
  on the dashboard (UC-005, UC-018), not to the issue route. That is noted for the review. It is not a condition of this
  item.

## Noted

- Release testing of ITM-1283 needs no further test from developer-sonnet-l. The item is itself a release test, written
  by a participant other than the implementer.
