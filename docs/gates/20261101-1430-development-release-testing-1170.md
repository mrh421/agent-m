---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - e03b60feab5e69bff78a1d27102dc91285824a30
  - https://github.com/akmaier/agent-m/pull/1619
date: 2026-11-01 14:30 UTC
---
# Development → Release testing: ITM-1170, #1619

**REGISTER**

## Reason

ITM-1170 (the implement page names a repository without branch protection, with the server's page for it) may go on. The
pull request is #1619 into `sprint/team1/141`, at `e03b60fea`. developer-opus-e wrote the code and the unit tests.
developer-sonnet-l wrote the release changes and the two UC-037 cases (`Agent-M-Participant` on each commit). I wrote none
of it.
1. **The tests came first, and each tests-only commit was red before its code:**
   - `ce65e05cc` (run 41284464946), whose design was superseded;
   - `cafcf1771` (run 41285303437);
   - `36b66b5c6` (run 41286868703);
   - `06b9eec33` (run 41287265570).

   `9b0e8ac28` moves the three files shared with ITM-1291 after that item's merge. CI ran it on a head that already held
   the code, and opus-e showed them red against the base locally. The binding rule is met by the first commit, as ruled at
   ITM-1349's gate.
2. **CI is green on the head:** run 41290626967 (pull_request, `e03b60fea`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's modules change.**
   - The code is in `src/repository-hosts/` (`github.mjs`, `gitlab.mjs`, `web-links.mjs`) and
     `src/implementation-pages/implement.mjs`.
   - The 39 changed test files each name, in their `Module:` header, one of the item's modules (`5e94d10a8`). I checked
     this with MOD-test-document's `testHeader` over every changed file. The control: the same check with MOD-repository-hosts
     alone flags MOD-approvals', MOD-settings-pages' and MOD-implementation-pages' files.
4. **The Acceptance holds:**
   - `repositoryInfo` reads the repository's record as before.
   - On GitHub it also asks GraphQL for `greenToMerge` alone, from `refUpdateRule.requiredStatusCheckContexts` and the
     branch's `REQUIRED_STATUS_CHECKS` rules. The request is sent before the record's and answered together with it.
   - A refused, failed or missing answer gives `null` (TST-1170009). GitLab takes the project's own setting.
   - The route `implement` says that an unprotected default branch is not held to "merge only on green", with the server's
     page for it, and says nothing for a protected one or for `null`.
   - The moved expectations are the request lists and counts the probe named, plus the two UC-037 cases that CI named.
     Each gains exactly greenToMerge's read-only `POST /graphql`. The pull request lists every line, file:line old → new.

## Rulings

- **sonnet-l's release commit `229c705b8`.** It is written from the pushed code by a participant who implemented none of
  the item.
  - The six release files gain the one request each.
  - TST-1278301/302, TST-1281301, the UC-042 step 2 case, TST-286 and TST-479201/202 fail on the base.
  - `release-uc-006` keeps its files-asked bound (≤ 3) apart from the one greenToMerge request.

  Allowed.
- **The UC-037 cases `e03b60fea`** (`system-uc-037-connect-mailbox:463`, TST-433818 at
  `release-uc-037-connect-mailbox:504`).
  - Their header names MOD-settings-pages, so they are in scope.
  - The helper `greenToMergeQuery` accepts only a POST to `https://api.github.com/graphql` whose body asks for
    `refUpdateRule`. Every other non-GET still fails the case: the counter-proof leaves exactly the PUT, the commits POST
    and the GraphQL mutation.

  Allowed.
- **The readings of the pull request:**
  - one further request per `repositoryInfo` call with a token;
  - a harness log shows it as a batch of no file;
  - fakes that count writes set the read-only GraphQL POST apart;
  - the settings page's *Test* is one test of the token, sent to its own server only.

  All are those of the item's *The reading taken*. Taken.

## Noted for akmaier

Every page that calls `repositoryInfo` with a token now sends one read-only request that only the route `implement` uses.
Reading `greenToMerge` only where it is shown would spare the other pages that request. It needs another interface of
MOD-repository-hosts, so it is a question of the architecture. Nothing waits on it (ITM-1170, *The reading taken*).
