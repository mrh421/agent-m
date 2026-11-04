---
id: ITM-1283
title: The issue-to-SPEC check saves a change on a GitLab server too
level: module
realises:
  - EVOLUTION ENTERS THROUGH THE SPECIFICATION
modules:
  - MOD-issue-handling
  - MOD-spec-changes
builds_on:
  - ITM-1152
tests:
  - release
origin:
  - po-opus-c's gate of ITM-1152 (PR #1387), docs/gates/20261029-0118-development-release-testing-102c.md
---
# ITM-1283 The issue-to-SPEC check saves a change on a GitLab server too

**REGISTER**

## Outcome

The SPEC's sentence of EVOLUTION ENTERS THROUGH THE SPECIFICATION names "GitHub or the product's GitLab server", and
`tests/test_issue_to_spec.py` checks on GitLab only the issue's class (TST-1152003). The change's queue, written by
`src/spec-changes/propose.mjs`, branches on GitLab (`:400`, `:411`, `:468`), and no case writes it there: the tests hold
no fake of GitLab's commit API. A case saves a change from an issue on a GitLab product and finds the queue under
`docs/spec-freigaben/` naming the issue, with nothing committed outside `docs/`.

## Acceptance

- The case runs on a fake GitLab server, through the GitLab adapter as the page uses it, and is shown to fail on a fault
  planted in the GitLab branch of the queue write.
- It is not written by the implementer of the behaviour it checks. The GitLab branch of the queue write came with ITM-341,
  394, 593 and 1247 (`git log -- src/spec-changes/propose.mjs`): developer-sonnet-a, developer-sonnet-b and the
  coordinator's session. None of team 1's developers of sprint team1/120 implemented it.
- Only `tests/test_issue_to_spec.py` and its data file `tests/test_issue_to_spec.md` change; no test reads either by its
  path. A fake of GitLab's commit API stands in the test file. CI is green on every commit, and the planted fault is
  recorded in the pull request.
