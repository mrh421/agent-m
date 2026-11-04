---
id: ITM-1170
title: The implement page names a repository without branch protection, with the server's page for it
level: module
realises:
  - UC-024
modules:
  - MOD-repository-hosts
  - MOD-implementation-pages
  - MOD-settings-pages
  - MOD-main-page
  - MOD-site-frame
  - MOD-review-pages
  - MOD-trace-pages
  - MOD-prompt-bar
  - MOD-approvals
  - MOD-progress-measures
builds_on:
  - ITM-734
tests:
  - unit
origin:
  - the gate of #1267 (ITM-734, team 2's sprint 102), developer-sonnet-f's stop at UC-024 12a
---
# ITM-1170 The implement page names a repository without branch protection, with the server's page for it

**REGISTER**

## Outcome

UC-024 12a: "The repository has no branch protection. Agent M says that the server does not enforce 'merge only on
green' …, with the server's page for it" (`docs/use-cases/UC-024-*.md:225`).
- ITM-734 left 12a unbuilt rather than guess.
- The accepted texts now give it (approvals of MOD-repository-hosts blob `97901d8e` and MOD-implementation-pages blob
  `656ce73f`, `b6c70419`):
  - `RepositoryInfo.greenToMerge` (MOD-repository-hosts.md:148-153): whether the server refuses a merge into the default
    branch until its required checks have passed — on GitHub a branch protection or a ruleset, on GitLab "pipelines must
    succeed" —, `null` where the token may not read it;
  - `WebLinks.branchProtection` (:163-169), the page on which that rule is set;
  - the route `implement` (MOD-implementation-pages.md:191-192): where `greenToMerge` is false, it says that the server
    does not enforce "merge only on green", with the page `branchProtection`.
- The code has none of it: `src/repository-hosts/` and `src/implementation-pages/` name neither `greenToMerge` nor
  `branchProtection`.

## The reading taken

`repositoryInfo` keeps reading the repository's record as it does today. On GitHub, it also sends one read-only GraphQL
request for `greenToMerge` alone, and it sends that request together with the record's, not after it. The probe of
`46648e533` showed that one GraphQL request for every field moves the GitHub fakes of 196 test files in about 40 modules.
With this reading, no existing fake moves.
- **The GraphQL fields.** GitHub gives `branchProtectionRule` as null to a person without admin rights. So
  `greenToMerge` is read from the default branch's `refUpdateRule.requiredStatusCheckContexts` and from its `rules` of
  type `REQUIRED_STATUS_CHECKS`. Live checks: cli/cli true, vercel/next.js true, nodejs/node false, agent-m false.
- **A missing or failed answer gives `greenToMerge: null`.** The type gives `null` "where the stored token may not read
  it" (MOD-repository-hosts.md:149-154), and an answer that did not come was not read. The route `implement` says
  nothing for `null`.
- **The request count.** MOD-repository-hosts states no number of requests for `repositoryInfo` (:217-219). UC-042 step 2
  says *Test* "sends one harmless request — to the token's own server …" (UC-042:71). The step is read as one harmless
  test of the token, sent to its own server only and changing nothing. Two read-only requests to that server, sent
  together, are that one test. The alternatives were 196 changed fakes, or a REST call for each part. Under akmaier's
  directions of 2026-11-01, the general reading is taken, not the over-specified one.
- **On GitLab,** the project's own record holds the setting "pipelines must succeed". So no further request is sent
  there.
- **The pages' request counts.** The GraphQL request is sent wherever `repositoryInfo` is called with a token on GitHub.
  So 34 test files that pin a page's exact requests gain that one request. They are tests of MOD-settings-pages,
  MOD-main-page, MOD-site-frame, MOD-review-pages, MOD-implementation-pages, MOD-trace-pages, MOD-prompt-bar,
  MOD-approvals, MOD-progress-measures and MOD-repository-hosts.
  - The item names those modules for their tests only (`A BACKLOG ITEM NAMES THE MODULES IT CHANGES`). No code of their
    folders changes, apart from the item's two modules.
  - `A PAGE LOAD READS THE REPOSITORY IN BATCHES` binds a page's commit, tree and files, not `repositoryInfo`. The request
    goes out in parallel with the record's, so `EVERY PAGE LOADS IN UNDER THREE SECONDS` keeps its margin.
  - AGENTS.md §6a.6: the item can be built without a change of the architecture, so it is built. Asking for
    `greenToMerge` only on the route that shows it would spare every other page the request. That needs another interface
    of MOD-repository-hosts, and it is noted for akmaier, not waited for.

## Acceptance

- `repositoryInfo` gives `greenToMerge` on GitHub:
  - `true` for a default branch whose `refUpdateRule` requires status checks, or which a `REQUIRED_STATUS_CHECKS` rule
    covers;
  - `false` where neither holds;
  - `null` where the GraphQL request is refused, fails or gets no answer.
- On GitLab, `greenToMerge` comes from the project's setting that pipelines must succeed.
- The repository's record is read as before.
- The existing expected results that change are the request lists and counts of the 34 files the probe of the rework
  names, each in the pull request with file:line, old → new.
  - Each gains exactly the GraphQL request of `greenToMerge` (one more `POST /graphql`) and nothing else.
  - All of them change in the tests-only commit.
  - A file whose module an item in progress also changes is rebased on that item's merge before the commit.
- No other existing fake or expected result changes, unless a probe names it and this text allows it.

- With a fixture host whose default branch is unprotected, the route `implement` says that the server does not enforce the
  merge rule, and links the server's page for branch protection. With a protected one, it says nothing.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
