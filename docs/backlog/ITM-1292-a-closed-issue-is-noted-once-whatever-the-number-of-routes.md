---
id: ITM-1292
title: A closed issue is noted once, whatever the number of routes
level: module
realises:
  - UC-012
modules:
  - MOD-issue-handling
  - MOD-workflow-entries
builds_on:
  - ITM-583
  - ITM-1259
tests:
  - unit
origin:
  - developer-sonnet-l's release tests of ITM-1259 (PR #1394), open question 1, ruled by po-opus-c in docs/backlog/sprints/team1/111.md
---
# ITM-1292 A closed issue is noted once, whatever the number of routes

**REGISTER**

## Outcome

The generated job workflow has one writer job per route, on GitHub (`hosted`, `runner-gpu`) and on GitLab
(`agent-m-hosted`, `agent-m-runner-gpu`), and each runs `onPullRequestClosed` on a merge. `closeWithLinks`
(`src/issue-handling/classes.mjs`) does not read the issue's state, so an issue the merged pull request names gets one
"Closed with" note per route. An issue already closed with links to that pull request is left as it is: it is closed and
noted once.

## The reading of the accepted text

Leaving an issue "already closed with links to that pull request" as it is needs the issue's state and comments read
before the note. `closeWithLinks` is given the host, and writes with `commentOnIssue` and `setIssueState`, functions of
that host.
- `readIssue` is a function of the same object: "`Host` — the object `connect` returns; the functions below, from
  `readSnapshot` on, are its functions" (MOD-repository-hosts.md:111). MOD-issue-handling's Uses name the Host's
  `commentOnIssue` and `setIssueState` (MOD-issue-handling.md:9-11), so `closeWithLinks` reads the issue with
  `host.readIssue` before it notes.
- Noting once is stricter than the text, which asks for the note and the close, and allowed.

## Acceptance

- A unit case runs the entry twice for one merged pull request, as two routes do, and finds one close and one note; it
  fails on the code as it stands.
- Only `src/issue-handling/`, `src/workflow-entries/` and their tests change.

**The planning run (sprint team1/124).** A stand-in on `main` at `fb0322f08` reads the issue with `host.readIssue` and
returns where it is closed and a comment equals the note it would write.
- Run twice for one pull request: 2 comments and 2 closes before; 1 read, 1 comment, 1 close, then 1 read, after. Known
  positive: another pull request still notes.
- 121 files that name MOD-issue-handling, MOD-workflow-entries, MOD-maintenance-pages, their folders, `closeWithLinks`,
  `onPullRequestClosed` or the note: 19 cases fail only with it, each with `host.readIssue is not a function`. Their
  fakes gain `readIssue`:
  - `tests/issue-handling-close-with-links.test.mjs` (6 cases);
  - `tests/workflow-entries-pull-request-closed.test.mjs` and `tests/workflow-entries-merge-request-closed.test.mjs`
    (7), through `tests/workflow-entries-pull-request-world.mjs`; MOD-workflow-entries is named;
  - the release tests `tests/release-itm-1259-merge-request-closes-issues.test.mjs` (2) and
    `tests/release-itm-1289-merged-merge-request-runs-entry.test.mjs` (3), and the system test
    `tests/system-uc-012-fix-a-bug.test.mjs` (1), changed by a participant who implemented none of the item.
- A request more per close: the read of the issue.
