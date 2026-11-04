---
id: ITM-1259
title: On GitLab, a merged merge request closes the issues it names
level: module
realises:
  - UC-012
  - GITLAB PRODUCTS ARE SUPPORTED
modules:
  - MOD-runtimes
  - MOD-workflow-entries
builds_on:
  - ITM-583
tests:
  - unit
origin:
  - the review of ITM-583 (PR #1382) by reviewer-sonnet: on GitLab, onPullRequestClosed ends "nothing to do"
---
# ITM-1259 On GitLab, a merged merge request closes the issues it names

**REGISTER**

## Outcome

MOD-runtimes' table: the job workflow runs `onPullRequestClosed` on "a pull or merge request closed or merged".
MOD-workflow-entries: `onPullRequestClosed` is "run by the job workflow when a pull request of a product is merged or closed:
on a merge, the issues it names closed with links". SPEC: GITLAB PRODUCTS ARE SUPPORTED.

On GitLab, `src/runtimes/workflow/gitlab.yml:81-83` runs the entry on `merge_request_event`, a pipeline of an open merge
request, not of its merge. `onPullRequestClosed` reads only GitHub's `payload.pull_request.number`
(`src/workflow-entries/product.mjs`, ITM-583), so a merged merge request closes no issue; only the issue route's *Close with
links* does. The workflow runs the entry when a merge request is merged, and the entry finds that merge request on GitLab
as on GitHub.

## Acceptance

- Unit tests naming MOD-runtimes and MOD-workflow-entries: GitLab's job workflow runs `onPullRequestClosed` for the merge of a
  merge request; the entry, given GitLab's environment of that merge, closes the issues the merge request names with links.
  Counter-proof: before the change the entry ends "nothing to do" on GitLab.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/runtimes/`, `src/workflow-entries/` and the tests that name these modules change.
