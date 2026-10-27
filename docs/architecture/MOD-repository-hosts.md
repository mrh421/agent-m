---
id: MOD-repository-hosts
title: One interface to every repository — GitHub, GitLab, a local clone
folder: src/repository-hosts/
realises:
follows:
  - ARC-047
uses:
provides:
  - RepositoryAddress
  - Credentials
  - Host
  - Snapshot
  - HistoryEntry
  - FileWrite
  - PullRequest
  - PullRequestFacts
  - CiRun
  - Issue
  - RepositoryInfo
  - Release
  - PipelineSchedule
  - WebLinks
  - HostError
  - parseAddress
  - connect
  - readSnapshot
  - readHistory
  - readFileAt
  - listTags
  - repositoryInfo
  - createBranch
  - commitFiles
  - openPullRequest
  - listPullRequests
  - pullRequestFacts
  - mergePullRequest
  - listCiRuns
  - startWorkflow
  - setCiSecret
  - cancelCiRun
  - ciRunLog
  - ciRunLabels
  - listIssues
  - createIssue
  - commentOnIssue
  - setIssueLabels
  - setIssueState
  - createTag
  - listReleaseAssets
  - publishRelease
  - setPipelineSchedule
  - ciVariableScopes
  - containsCommit
  - issueCounts
  - webLinks
---
# MOD-repository-hosts One interface to every repository — GitHub, GitLab, a local clone

## Responsibility

It belongs to Access (ARC-047). It gives every subsystem and every program one interface to a repository — reading it at
a commit, its history, its tags; writing commits on an expected head; branches, pull or merge requests, CI runs, issues
and tags; and the addresses of the server's own pages — behind which three adapters are plug-ins: GitHub's REST API,
GitLab's REST API, and a local clone through the `git` command. In a browser the REST adapters run with the person's
token; in Node the local adapter runs in a CI checkout, with the person's token from a CI secret, or on a Bridge's
computer, with its own git login. Every function that reaches a server or a clone says so and names how it fails
(`A REMOTE INTERFACE NAMES HOW IT FAILS`). It refuses to write a configured secret (`NO SECRET IN THE REPOSITORY`).

## Parts

- `index.mjs` — the interface: `parseAddress`, `connect`, and the host it returns; it loads the local adapter only in
  Node.
- `github.mjs` — the adapter for GitHub's REST API.
- `gitlab.mjs` — the adapter for GitLab's REST API.
- `local-git.mjs` — the adapter for a local clone, through the `git` command; Node only.
- `failures.mjs` — the failures, told apart from the server's answers.
- `web-links.mjs` — the addresses of the server's own pages.
- `sealed-box.mjs` — a value sealed to a public key as libsodium's `crypto_box_seal` seals it, for GitHub's Actions secrets.
- `vendor/` — tweetnacl and blakejs, bundled once into one module, each with its licence, named with their versions in
  `vendor/README.md`.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_no_backend.py`: its header names this module: every request leaves through it (`NO SERVER`).

## Data

It keeps, for as long as a host it returned is used, the texts of the blobs it has read, by their blob SHA, so that a
page reads each blob once. It keeps nothing beyond that, and nothing in any store.

The **token page** it links for GitHub is the page for a new fine-grained token, prefilled with name, description and
expiry, with the repository's owner as the token's owner — GitHub limits a token to the repositories of one owner —, and
with exactly the permissions of `ONE GITHUB TOKEN SERVES EVERY FEATURE` — *Contents*, *Issues* and *Pull
requests* read and write, *Actions*, *Workflows* and *Secrets* read and write, *Metadata* read (`THE TOKEN LINK IS PREFILLED`); the
repositories to select are named beside the link, not in it (`THE REPOSITORY CHOICE IS SPELLED OUT`). For a product on a
GitLab server it links the project's *Access tokens* page, where the person creates a project access token with role
*Maintainer* and scope `api` (`A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN`).

A **new-file page** prepared for the fallback without a token carries at most a file's path and an approval record —
never a reviewed text (`NO TEXT TRAVELS IN A URL`), and never a credential (`A CREDENTIAL IS NEVER PLACED IN A URL`).

## Interfaces

- `RepositoryAddress` — `{ server: "github" | "gitlab", origin: string, path: string, web: string }`: the server, its
  origin such as `https://gitlab.rrze.fau.de`, the repository's path such as `alice/thesis-tool` or a GitLab group path,
  and the address a person opens (`A PRODUCT IS NAMED BY ITS ADDRESS`).
- `Credentials` — `{ token?: string, tokenName?: string, clone?: string, secrets?: string[], defaultBranch?: string }`: the
  token and the name under which the person stored it; in Node, the folder of a local clone to work in; the values of every
  configured secret, which no commit may contain; the repository's default branch as `repositoryInfo` reports it, on which
  `WebLinks`' `newFile` and `editFile` build their pages — `main` where none is given.
- `Host` — the object `connect` returns; the functions below, from `readSnapshot` on, are its functions.
- `Snapshot` — `{ repository: RepositoryAddress, ref: string, commit: string | null, paths: string[], read(path: string) ->
  Promise<string | null>, readMany(paths: string[]) -> Promise<void>, readOn(branch: string, path: string, options?: { bytes?: boolean }) -> Promise<string | Uint8Array | null>, blob(path:
  string) -> string | null }`: one
  repository at one commit; `read` fetches a file's text once and returns `null` for a path the commit does not hold;
  `readMany` fetches the texts of many files ahead of their `read`s, in as few requests as the server allows — on GitHub
  with a token, many files in one request of the same server's GraphQL API, which the token alone reaches (`A TOKEN GOES
  ONLY TO THE SERVER THAT ISSUED IT`), every limit of that API read from GitHub's documentation; on any other server, in a
  clone or without a token, it reads nothing ahead and each `read` fetches its file as before —, so that a caller that
  reads hundreds of files makes a handful of requests; a file the batch could not give is fetched by its own
  `read`, and `readMany` fails only as `readSnapshot` fails; `readOn` gives the text of a file on another branch of the same repository — its bytes with `{ bytes: true }` —, in one request, and `null` when the branch or
  the file does not exist; `blob` gives its blob SHA from the tree, without a
  request. On GitHub, a repository without any commit yet — an empty one — is a snapshot whose `commit` is `null` and
  which holds no path.
- `HistoryEntry` — `{ commit: string, parents: string[], author: { account: string | null, name: string }, date: string,
  message: string, changes: { path: string, change: "added" | "modified" | "deleted" | "renamed", from?: string }[] }`.
- `FileWrite` — `{ path: string, text?: string, bytes?: Uint8Array, delete?: true }`: one file of a commit.
- `PullRequest` — `{ number: number, title: string, branch: string, base: string, head: string, mergeCommit: string |
  null, state: "open" | "merged" | "closed", draft: boolean, url: string, opened: string, merged: string | null, closed:
  string | null, body: string }`: a pull request on GitHub, a merge request on GitLab, with the dates it was opened,
  merged and closed — what a burn-down, a flow or a timeline is computed from —, and its description, `""` where it has
  none. `mergeCommit` is the commit its merge put on `base`, as the server names it — the merge commit, or the last
  commit of a squash or a rebase (GitHub's `merge_commit_sha` of a merged pull request; GitLab's `merge_commit_sha`,
  else its `squash_commit_sha`, else, for a fast-forward, `head`) —, and `null` while it is not merged, whatever the
  server names then.
- `PullRequestFacts` — `{ pullRequest: PullRequest, commits: { sha: string, message: string, files: string[], ci: "success"
  | "failure" | "running" | "none" }[], files: { path: string, change: string }[], reviews: { reviewer: string, verdict:
  "approved" | "changes requested" | "commented" | "dismissed", commit: string, date: string }[], checks: { name: string,
  state: "queued" | "running" | "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed out", url: string }[],
  read(path: string, side: "base" | "head") -> Promise<string | null> }`: what a Definition-of-Done check needs to see —
  the commits in their order; the reviews, each with the reviewer's account, the verdict and the commit it was given on
  (on GitLab, the approvals of the merge request); and the result of each named check on the head commit — GitHub's check
  runs and commit statuses, GitLab's pipeline jobs, each by its name.
- `CiRun` — `{ id: string, workflow: string, commit: string, event: string, state: "queued" | "running" | "waiting" |
  "success" | "failure" | "cancelled" | "skipped", url: string, started: string | null, ended: string | null }`.
- `Issue` — `{ number: number, title: string, body: string, labels: string[], state: "open" | "closed", url: string,
  opened: string, closed: string | null, comments: { author: string, body: string, date: string }[] }`: `opened` the
  date and time the issue was opened, `closed` the date and time the server reports it closed, `null` while it is open.
- `RepositoryInfo` — `{ defaultBranch: string, visibility: "public" | "private" | "internal", canWrite: boolean,
  archived: boolean, description: string, greenToMerge: boolean | null }`: `description` is the repository's one-line
  description on its server, empty where it has none; `greenToMerge` whether the server refuses a merge into the default
  branch until its required checks have passed — on GitHub a protection of that branch, or an active rule of a ruleset
  that applies to it, that requires status checks; on GitLab the project's setting that pipelines must succeed —, `null`
  where the stored token may not read it.
- `Release` — `{ tag: string, name: string, published: string, notes: string, assets: { name: string, size: number | null,
  url: string, sha256: string | null }[] }`: a release with its files — each with its size, the address a person downloads
  it from, and the SHA-256 the server reports for it, or `null` where the server reports none.
- `PipelineSchedule` — `{ description: string, cron: string, timezone: string, ref: string, active: boolean, variables?:
  Record<string, string> }`: a GitLab project's pipeline schedule, named by its description.
- `WebLinks` — `{ newToken(name: string, description: string, days: number) -> string, tokens: string,
  projectTokens: string | null, secrets: string, newFile(path: string, record: string) -> string | null, editFile(path:
  string) -> string, deleteFile(path: string) -> string | null, actions: string, run(id: string) -> string, commitRuns(commit: string) -> string, branch(name:
  string) -> string, file(path: string, ref: string) -> string, runners: string, pipelineSchedules: string | null,
  pagesSettings: string, fork: string | null, newRepository: string, branchProtection: string }`: the server's own
  pages; a page the server does not offer is `null`. `deleteFile` is the page that deletes one file from the default
  branch, where the person commits the deletion — GitHub's `/delete/<branch>/<path>`; GitLab has none. `commitRuns` is the page
  of the runs or pipelines of one commit, `branch` the page of a branch's files, `file` the page that shows one file as it
  stands at a branch, a tag or a commit, to read and not to edit, `runners` the page on which a self-hosted
  runner is registered to the repository, which shows the command to run on its machine, `branchProtection` the page on
  which the rule behind `greenToMerge` is set.
- `HostError` — the failures every function below names, each an error with its fields:
  `TokenRefused { tokenName, renewal }` — the server refused the token, which is named with the page where it is renewed
  with the same permissions and repositories (`AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED`);
  `PermissionMissing { permission, renewal }` — the token lacks a permission;
  `RateLimited { limit: "account" | "network" | "search", resetsAt }` — a rate limit is used up, the account's with a
  token or the network's without one, or the server's own, smaller limit on searches, with the time it resets where the
  server tells it; never reported as a refused token (`A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN`);
  `NotFound { what }`; `Moved { head }` — the branch is no longer at the head the commit was made on;
  `SecretRefused { path }` — the commit would write a configured secret, named by file, never by value;
  `NotSupported { what }` — the adapter cannot do this, for example a merge request without a token on GitLab, or an
  issue through a local clone; `NotMergeable { reason }` — the server refuses a merge, for example while a required check
  is not green; `TagExists { commit }` — the tag stands already, on that commit; `ReleaseExists { tag }` — the tag has a
  release already; `UploadFailed { file }` — a release's file could not be uploaded; `Unreachable { reason }` — the server
  or the clone could not be reached, with the reason the browser or `git` gives.
- `parseAddress(url: string) -> RepositoryAddress` — reads the address a person pastes, as it appears in the browser, on
  `github.com` or a GitLab server. Throws `TypeError` naming what is not a repository's address. No request is made.
- `connect(address: RepositoryAddress, credentials: Credentials) -> Host` — a host for one repository. The token goes
  only into the authorisation header of requests to the server that issued it (`A TOKEN GOES ONLY TO THE SERVER THAT
  ISSUED IT`). With `clone`, files are read and committed in that clone and pushed with the clone's own credentials, and
  every other function uses the REST adapter where a token is given, or throws `NotSupported`. A token of the other kind
  of server — a GitLab token for a GitHub repository, a GitHub token for a GitLab project, each told by the prefix its
  own server gives it — is refused with a `TypeError`, whose message never holds the token. A text that begins with the
  prefix of neither kind of token is refused the same way, and the message says that it is no token of either server;
  no token given (`token` absent or `null`) is no such text. `connect` alone holds the forms of a token: a caller that
  has a pasted text connected stores it only if `connect` accepts it. No request is made yet.
- `readSnapshot(ref: string) -> Promise<Snapshot>` — the repository at a branch, tag or commit: the commit and its whole
  tree in a fixed number of requests, however many folders it has — two on GitHub, the commit and then its tree —, then
  one per file read, or one per batch of files `readMany` reads. Through a clone, a commit the clone does not hold is first fetched from the clone's origin by its
  identifier, with the clone's own credentials: the access the clone was made with. `NotFound` then means that the origin
  does not hold it either. Crosses the network; fails with `NotFound`, `TokenRefused`, `PermissionMissing`,
  `RateLimited`, `Unreachable`.
- `readHistory(path: string | null, options: { ref?: string, limit?: number, changes?: boolean }) ->
  Promise<HistoryEntry[]>` — the commits that changed a path, or the repository, newest first. With `changes: false`,
  each entry's `changes` is empty and the history costs one request per page of commits; otherwise each entry lists its
  changes. Crosses the network; fails as `readSnapshot`.
- `readFileAt(path: string, commits: string[]) -> Promise<Map<string, string | null>>` — the text of one file at each
  of several commits, keyed by commit, `null` where the file does not exist there. It reads in batches, not one snapshot
  per commit: with a token, one request per batch of commits through the server's batch query, as `readMany` reads;
  without a token, one read of the file's raw text per commit, outside the server's API. Crosses the network; fails as
  `readSnapshot`.
- `listTags(pattern?: string) -> Promise<{ name: string, commit: string }[]>` — the tags, optionally only those matching
  a pattern such as `v*`. Crosses the network; fails as `readSnapshot`.
- `repositoryInfo() -> Promise<RepositoryInfo>` — the default branch, the visibility the server reports, whether the
  stored token may write, and whether the server enforces green CI before a merge into the default
  branch. Crosses the network; fails as `readSnapshot`.
- `createBranch(name: string, from: string) -> Promise<void>` — a branch at a commit. Crosses the network; fails with
  `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`, or `NotSupported` without a token.
- `commitFiles(change: { branch: string, expectedHead: string | null, files: FileWrite[], message: string }) -> Promise<{ commit:
  string, url: string }>` — one commit of all the files together, made only if the branch still stands at `expectedHead`;
  `expectedHead` `null` makes the repository's first commit, only while it has none. GitHub's Git database answers 409 until
  a repository holds a commit, so there the first file is written through its contents API and the others in one commit on
  it, on the same condition — two commits, of which the second is returned; a GitLab project without a commit is refused
  with the advice to push a first commit to it;
  through a clone, a commit pushed only if the push fast-forwards. GitLab's API makes no commit on such a condition: there
  the head is read again just before the write and the commit refused with `Moved` if it moved; a commit that lands
  between that read and the write is not refused. The message is written as given; it carries what its
  caller puts there, such as the provenance of a generated artifact. Before anything is sent, a file whose text holds a
  configured secret refuses the whole commit with `SecretRefused`. Crosses the network; fails with `Moved`,
  `SecretRefused`, `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`. Nothing is written on any failure.
- `openPullRequest(request: { branch: string, base: string, title: string, body: string, draft?: boolean }) ->
  Promise<PullRequest>` — crosses the network; fails with `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`,
  `NotSupported`.
- `listPullRequests(filter: { state?: "open" | "merged" | "closed" | "all", branch?: string }) -> Promise<PullRequest[]>` —
  crosses the network; fails as `readSnapshot`.
- `containsCommit(ref: string, commit: string) -> Promise<boolean>` — whether the history of a branch or a tag holds the
  commit: on GitHub and GitLab through the server's comparison of the two, in a clone with `git merge-base
  --is-ancestor`. A commit the server does not know is not contained. Crosses the network; fails as `readSnapshot`.
- `pullRequestFacts(number: number) -> Promise<PullRequestFacts>` — the commits of a pull request in order, the files each
  changed, the CI result of each commit, and the texts of changed files on both sides. Crosses the network; fails as
  `readSnapshot`.
- `mergePullRequest(number: number, expectedHead: string) -> Promise<{ commit: string }>` — merges only if the pull
  request's head is still `expectedHead` and the server allows it; branch protection on the server stays in force.
  Crosses the network; fails with `Moved`, `PermissionMissing`, `TokenRefused`, `RateLimited`, `Unreachable`, and with
  `NotMergeable { reason }` when the server refuses the merge.
- `listCiRuns(filter: { commit?: string, branch?: string, workflow?: string }) -> Promise<CiRun[]>` — the GitHub Actions
  runs or GitLab pipelines. Crosses the network; fails as `readSnapshot`.
- `startWorkflow(workflow: string, ref: string, inputs: Record<string, string>) -> Promise<CiRun | null>` — starts a
  workflow or a pipeline with its inputs; the inputs must hold no credential. Returns the run where the server names it at
  once, otherwise `null`, and the caller finds it with `listCiRuns`. Crosses the network; fails with `PermissionMissing`,
  `TokenRefused`, `RateLimited`, `Unreachable`, `NotSupported`.
- `setCiSecret(name: string, value: string) -> Promise<void>` — on GitHub, stores `value` as the Actions secret `name` of
  the repository, on a person's click: it reads the repository's public key and sends the value only sealed to that key
  (`sealed-box.mjs`), in the body of the one request that stores it, to the API of the server that issued the token,
  never in an address (`A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT`, `A CREDENTIAL IS NEVER PLACED IN A URL`). A name
  that is no plain name, or begins with `GITHUB_`, is a `TypeError`. Crosses the network; fails with `PermissionMissing`
  naming the permission *Secrets*, `TokenRefused`, `RateLimited`, `Unreachable`, and `NotSupported` on a GitLab server
  and without a token, before any request.
- `cancelCiRun(id: string) -> Promise<void>` — asks the server to cancel a run; the run's state shows when it has.
  Crosses the network; fails as `startWorkflow`.
- `ciRunLog(id: string) -> Promise<string | null>` — the run's log, or `null` when the server no longer keeps it. Crosses
  the network; fails as `readSnapshot`.
- `ciRunLabels(id: string) -> Promise<string[]>` — the runner labels the run's jobs ask for: on GitHub the `labels` of
  each job of the workflow run, on GitLab the tags of each job of the pipeline; each once, empty for a run whose jobs
  ask for none. Crosses the network; fails as `readSnapshot`.
- `listIssues(filter: { state?: "open" | "closed" | "all", labels?: string[], search?: string }) -> Promise<Issue[]>` —
  crosses the network; fails as `readSnapshot`, and with `NotSupported` through a clone.
- `createIssue(issue: { title: string, body: string, labels: string[] }) -> Promise<Issue>` — crosses the network; fails
  with `TokenRefused`, `PermissionMissing`, `RateLimited`, `Unreachable`, `NotSupported`.
- `commentOnIssue(number: number, body: string) -> Promise<void>` — fails as `createIssue`.
- `setIssueLabels(number: number, labels: { add?: string[], remove?: string[] }) -> Promise<void>` — fails as
  `createIssue`.
- `setIssueState(number: number, state: "open" | "closed") -> Promise<void>` — fails as `createIssue`.
- `createTag(name: string, commit: string) -> Promise<void>` — sets a tag on a commit; an existing tag is never moved and
  fails with `TagExists { commit }` (`A VERSION IS NOT REWRITTEN`). Crosses the network; fails also with
  `PermissionMissing`, `TokenRefused`, `RateLimited`, `Unreachable`.
- `listReleaseAssets(tag: string | "latest") -> Promise<Release>` — a release and its files, as the Bridge's download page
  offers them (UC-044): name, size, the download address, and the SHA-256 the server reports for each file. A page cannot
  read a release file's bytes itself: the server sends its downloads without a cross-origin permission, so the SHA-256
  shown beside a file is the one this function returns, and where the server reports none the caller links the release's
  checksum file for the person to open. Crosses the network; fails with `NotFound` when the release does not exist,
  `TokenRefused`, `RateLimited`, `Unreachable`, and `NotSupported` through a clone.
- `publishRelease(tag: string, release: { name: string, notes: string, files: { name: string, bytes: Uint8Array,
  contentType: string }[] }) -> Promise<Release>` — on GitHub, creates the release of a tag that stands: first as a
  draft, then each file uploaded to it, then published, so that no release is seen with only part of its files. Returns
  the `Release` with each file's download address and the SHA-256 the server reports for it. An existing release of the
  tag is never replaced (`A VERSION IS NOT REWRITTEN`). On a GitLab server and through a clone without a token it throws
  `NotSupported`. Crosses the network; fails with `NotFound` when the tag does not exist, `ReleaseExists { tag }` when the
  tag has a release, `UploadFailed { file }` when a file could not be uploaded — the draft is then left unpublished and
  named, and nothing is published —, `PermissionMissing`, `TokenRefused`, `RateLimited`, `Unreachable`.
- `setPipelineSchedule(schedule: PipelineSchedule) -> Promise<{ id: string, url: string }>` — on a GitLab server, creates
  the project's pipeline schedule with this description, or updates the one that has it, so that saving again never adds
  a second schedule (UC-027). Its variables hold no credential: a secret stays a CI variable of the project, which the
  person sets on the server's page. On GitHub it throws `NotSupported`: a workflow's schedule is part of the workflow's
  file, which the test configuration generates. Crosses the network; fails with `PermissionMissing` — a project access
  token without the role *Maintainer* —, `TokenRefused`, `RateLimited`, `Unreachable`.
- `ciVariableScopes() -> Promise<{ name: string, scope: string }[]>` — on a GitLab server, each CI/CD variable of the
  project by its name and environment scope, a name standing once for each of its scopes; never its value: it asks the
  server's GraphQL API (`/api/graphql`, the token as `Authorization: Bearer`) for the key and the environment scope of
  each variable alone, page after page, so that no value leaves the server. On GitHub, whose secrets have no environment
  scope, and without a token it throws `NotSupported`, before any request. Crosses the network; fails with
  `PermissionMissing` — a token that may not read the variables, which the server answers as `null`; listing them needs the
  role *Maintainer* —, `TokenRefused`, `RateLimited`, `Unreachable`.
- `issueCounts() -> Promise<{ open: number, closed: number }>` — the numbers of open and closed issues of the repository,
  pull requests not counted, without listing the issues — on GitHub through its search, which has a limit of its own, on
  a GitLab server through the project's issue statistics. Crosses the network; fails with `RateLimited` — on GitHub with
  the limit `search` —, `NotFound`, `TokenRefused`, `Unreachable`, and `NotSupported` through a clone.
- `webLinks() -> WebLinks` — the addresses of the server's own pages for this repository, as defined under Data; no
  request is made.

## Files

It reads and writes the repositories it is connected to: through the servers' REST APIs, or, in Node, in the local clone
whose folder it is given, by the `git` command. It writes no other file.

## Uses

It uses no other module. It uses the platform's `fetch` and `crypto.getRandomValues`, its vendored tweetnacl and blakejs,
and in Node the `git` command.
