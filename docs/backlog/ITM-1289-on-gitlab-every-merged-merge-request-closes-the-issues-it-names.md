---
id: ITM-1289
title: On GitLab every merged merge request closes the issues it names
level: module
realises:
  - UC-012
modules:
  - MOD-runtimes
  - MOD-workflow-entries
builds_on:
  - ITM-1259
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1259 (PR #1391), docs/gates/20261029-0247-development-release-testing-84f5.md, points 2 and 3
---
# ITM-1289 On GitLab every merged merge request closes the issues it names

**REGISTER**

## Outcome

MOD-runtimes.md:141 gives `onPullRequestClosed` for "a pull or merge request closed or merged". Since ITM-1259 GitLab's
job workflow runs it on the push pipeline of the default branch, as the rule after the records' rule
(`src/runtimes/workflow/gitlab.yml`). GitLab takes the first rule that matches, so a merge whose commit changes
`docs/jobs/` or `docs/gates/` runs `onRecordsChanged` and closes no issue; and a merge into a branch other than the
default branch starts no pipeline the entry reacts to, while on GitHub every target is. On GitLab, every merged merge
request runs `onPullRequestClosed`, also one that changes records and one into another branch.

## Acceptance

- A unit case of the generated GitLab workflow shows a merge commit that changes `docs/jobs/` running both entries, and
  a merge into a sprint branch running `onPullRequestClosed`; each fails on the workflow as it stands.
- Only `src/runtimes/`, `src/workflow-entries/` and their tests change.
- **Its planning run** (sprint team1/120, on `main` at `9db71783`). A stand-in of the template used only MOD-runtimes'
  table of events (MOD-runtimes.md:138-145). The write job ran `onPullRequestClosed` on a push of any branch, and after
  `writeResult` on a push of the default branch.
  - The run took every test that reads `gitlab.yml` by its path or calls `jobWorkflowFiles`, and every test of
    MOD-runtimes, MOD-workflow-entries and MOD-settings-pages, whose `settings.mjs:959` calls `jobWorkflowFiles`. That is
    227 files: 218 Node files and 9 Python files, without the four that hang on this machine.
  - Without the change, 6 cases fail, all of them Electron and endpoint-route cases this machine cannot run. With it, two
    more fail, both of this item's own module, in `tests/runtimes-workflow.test.mjs`:
    - TST-472724 (`:99-104`), "each event starts its entry";
    - TST-1259001 (`:140-145`), which asserts the default-branch push alone.
  - Their changed expectations stand in the tests-only commit. `release-itm-1259-merge-request-closes-issues` passed with
    the stand-in, so no release test changes.
