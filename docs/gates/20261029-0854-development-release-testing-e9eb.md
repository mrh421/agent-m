---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f979c4a2014dec3679526ebfce568b69d2dc62f7
  - https://github.com/akmaier/agent-m/pull/1421
date: 2026-10-29 08:54 UTC
---
# Development → Release testing: ITM-1270, the issues are listed without their comments, and one issue is read by its number

**REGISTER**

## Reason

ITM-1270, pull request #1421 into `sprint/team1/114`, passes on `f979c4a2`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40844815859, `pull_request`, on `f979c4a2` passes 38 of 38 pull-request jobs.
2. **Red first.** The two commits before the implementation hold only tests.
   - **`f20abd81`, run 40841617036.** In attempt 2, two jobs fail, unit shard 8 and component shard 6. In them, only the
     six new cases fail, each for the item's reason:
     - TST-1270001 and 003 fail with "`readIssue` is not a function".
     - TST-1270002 fails because, with `comments: false`, the comments are still read.
     - TST-1270004 to 006 fail because the routes send the request for the issue list.
   - Attempt 1 also failed component shard 3, system shards 1 and 2, and release shards 1 and 2. That is the
     Electron-staging fault registered as ITM-1306.
   - **`92652380`** changes only the fake GitHub of `tests/maintenance-pages-mail.test.mjs`, which now also answers "Get an
     issue". No `assert` and no `expect:` line changes.
   - The implementation commit `f979c4a2` changes only code, and no test.
3. **Only its modules change.**
   - Code: `src/repository-hosts/github.mjs`, `gitlab.mjs` and `index.mjs`, and `src/maintenance-pages/issues.mjs`,
     `replies.mjs` and `index.mjs`.
   - The comment of `index.mjs` loses its stray ")." (sprint 113's review).
   - Tests:
     - `repository-hosts-read-issue`, which names MOD-repository-hosts;
     - `maintenance-pages-issues-reads`, `maintenance-pages-mail` and the helper `maintenance-pages-world`, which name
       MOD-maintenance-pages.
   - As its Acceptance says, no test of another module changes.
   - `listIssues` keeps its default, `comments: true`. So its callers in other modules do not change.
4. **The interface is the accepted text, and the callers use it within their Uses.**
   - MOD-repository-hosts.md:271-276 gives `listIssues(filter: { …, comments?: boolean })` ("With `comments: false`, each
     issue's `comments` is empty and no comment is asked for"). It gives `readIssue(number: number) -> Promise<Issue>`:
     one request, and one per page of the comments, failing "with `NotFound` for a number the repository has no issue
     of".
   - MOD-maintenance-pages' Uses name `MOD-repository-hosts.listIssues` and `readIssue` (MOD-maintenance-pages.md:24-25).
   - Its text gives the routes this behaviour (:129-130): the list reads the issues "without their comments (`listIssues`
     with `comments: false`)", and "`issue/<number>` and `replies/<issue>` read their one issue with `readIssue`".
   - The clone without a token answers `readIssue` with `NotSupported`, as it answers `listIssues`.
5. **No counter-proof is weakened, and no expectation changed.**
   - The six new cases are unchanged since `f20abd81`.
   - The Acceptance's counter-proofs stand in the cases:
     - in TST-1270002, without `comments` the comments are read as today;
     - in TST-1270003, a pull request's number on GitHub, and a merge request's on GitLab, is `NotFound`.
   - The two fakes only gain an answer to "Get an issue".
6. **The readings in the pull request hold.**
   - **What counts as `NotFound`.**
     - On GitLab, an iid that no issue has is answered 404. A merge request's iid is counted apart from the issues'.
     - On GitHub, the answer for a pull request carries `pull_request`; and 404 or 410 means no issue.
     - All of these are "a number the repository has no issue of".
   - **TST-1270006, for `replies/<issue>`.** It counts the requests only after *Read replies*. Before that click the
     route reads no issue (`arrivalsOf`, `replies.mjs:219`), and `repliesDue` still lists the issues, which no text
     withdraws.
     - A `readIssue` that fails there leaves the issue with no fresh or arrived mails (`replies.mjs:324`). That is what a
       missing issue gave before.
7. **The reader.** On `f979c4a2`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `repository-hosts-read-issue`: 3, TST-1270001 to 003. `maintenance-pages-issues-reads`: 3, TST-1270004 to 006.
     `maintenance-pages-mail`: 13.
   - All with 0 findings.
   - `maintenance-pages-world` is a helper, with no declaration of its own.
