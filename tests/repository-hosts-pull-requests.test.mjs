// Module: MOD-repository-hosts
// MOD-repository-hosts' listPullRequests and pullRequestFacts (ITM-296), as the accepted text of docs/architecture/MOD-repository-hosts.md states them: "listPullRequests(filter:
// { state?: "open" | "merged" | "closed" | "all", branch?: string }) -> Promise<PullRequest[]> — crosses the network; fails as `readSnapshot`"; "pullRequestFacts(number) ->
// Promise<PullRequestFacts> — the commits of a pull request in order, the files each changed, the CI result of each commit, and the texts of changed files on both sides", with
// PullRequest { number, title, branch, base, head, state, draft, url, opened, merged, closed, body } and PullRequestFacts { pullRequest, commits: { sha, message, files, ci }[], files:
// { path, change }[], reviews: { reviewer, verdict, commit, date }[], checks: { name, state, url }[], read(path, side) } (UC-002, UC-032). Deterministic, no network: the servers
// are fakes of `fetch` that answer as the real APIs document, from their own pages, read 2026-10-13:
//   GitHub — docs.github.com/en/rest/pulls/pulls: "List pull requests" (GET /repos/{owner}/{repo}/pulls; state open | closed | all, head `user:ref-name`, base, per_page up to 100, page;
//     number, title, body, state, draft, html_url, created_at, merged_at, closed_at, head.ref, head.sha, base.ref, base.sha; 200, 304, 422), "Get a pull request" (…/pulls/{n}; 200, 304, 404, 406,
//     422, 500, 503), "List pull requests files" (…/files; filename, status — added, removed, modified, renamed, copied, changed, unchanged —, previous_filename; at most 3000), "List commits
//     on a pull request" (…/commits; sha, commit.message, parents; at most 250; the page states no order); docs.github.com/en/rest/pulls/reviews: "List reviews for a pull request"
//     (…/reviews; user.login, state, commit_id, submitted_at — "Pending reviews don't include it"; the page gives no values of `state`); docs.github.com/en/graphql/reference/pulls: the enum
//     PullRequestReviewState — APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING ("A review that has not yet been submitted"); docs.github.com/en/rest/checks/runs: "List check
//     runs for a Git reference" (…/commits/{ref}/check-runs; check_runs[] name, status — queued, in_progress, completed, waiting, requested, pending —, conclusion — success, failure,
//     neutral, cancelled, skipped, timed_out, action_required, null —, html_url); docs.github.com/en/rest/commits/statuses: "List commit statuses for a reference" (…/commits/{ref}/statuses;
//     context, state, target_url; "reverse chronological order, so the first item is the latest status"; the states of the combined status are error, failure, pending, success).
//   GitLab — docs.gitlab.com/api/merge_requests/: "List project merge requests" (GET /projects/:id/merge_requests; state opened | closed | locked | merged | all, source_branch,
//     target_branch, order_by, sort; iid, title, description, state, draft, web_url, created_at, merged_at, closed_at, source_branch, target_branch, sha — "Diff head SHA"), the single merge request
//     (diff_refs.base_sha — "the merge base commit where the source and target branches diverged"), "Retrieve merge request commits" (…/commits; id, message, created_at identical to
//     committed_date, parent_ids; no order stated), "List merge request diffs" (…/diffs; new_path, old_path, new_file, renamed_file, deleted_file; page, per_page);
//     docs.gitlab.com/api/merge_request_approvals/: …/approvals (approved_by[] with approved_at and user — no commit per approval); docs.gitlab.com/api/pipelines/: "List project pipelines"
//     (sha, order_by, sort; statuses created, waiting_for_resource, preparing, waiting_for_callback, pending, running, success, failed, canceling, canceled, skipped, manual, scheduled);
//     docs.gitlab.com/api/jobs/: "List all jobs by pipeline" (name, status, web_url; the same statuses).
// Run: node --test tests/repository-hosts-pull-requests.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-002; UC-032; STATUS IS DERIVED FROM THE RECORDS; A REMOTE INTERFACE NAMES HOW IT FAILS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// Level: unit
//
// Where the accepted text leaves a reading open, the test states the one it takes, and the pull request names it:
//   - PullRequest: `body` is the description as written — GitHub's body, GitLab's description —, "" where the server gives none (null, empty or absent). `branch` is the source branch's name, `base` the target branch's name, `head` the head commit's SHA; `url` is html_url / web_url; `opened`, `merged`, `closed` are the
//     server's created_at, merged_at, closed_at as given, null where the server gives none. GitHub's `merged` state is a closed pull request with a merged_at; GitLab's `locked` is open.
//     The branch filter is the source branch: GitHub's `head=<owner>:<branch>` with the repository's own owner, GitLab's source_branch.
//   - The commits come oldest first, ordered by their parents (GitHub `parents`, GitLab `parent_ids`) and, where those leave the order open, by their dates, because neither page states
//     an order; each commit's `files` are the paths it changed, a renamed file by its new path.
//   - The review verdicts: APPROVED approved, CHANGES_REQUESTED changes requested, COMMENTED commented, DISMISSED dismissed; a review not submitted (PENDING) is no review. On GitLab,
//     an approval is a verdict `approved` given on the merge request's head commit, dated by approved_at: the page gives no commit per approval.
//   - A check's state: GitHub check run queued / waiting / requested / pending → queued, in_progress → running, completed → its conclusion (timed_out → "timed out", action_required →
//     failure, null → neutral); a commit status pending → running, success → success, error and failure → failure, only the latest of each context. GitLab job status created, pending,
//     preparing, waiting_for_resource, waiting_for_callback, scheduled, manual → queued; running; success; failed → failure; canceled, canceling → cancelled; skipped.
//   - A commit's ci: failure when any of its checks failed, was cancelled or timed out; else running when any is queued or running; else success when it has any check; else none. On GitLab
//     it is its newest pipeline's status: success → success; failed, canceled, canceling → failure; skipped and no pipeline → none; every other status → running.
//   - The head's checks are those of the head commit; on GitLab the jobs of its newest pipeline.
//   - read(path, "base") reads at the pull request's base commit (GitHub base.sha, GitLab diff_refs.base_sha), read(path, "head") at the head commit, always by commit, never by branch; a
//     path the commit does not hold is null; a text read once is not read again.
// Each test states its input and its expected result before it runs (given / input / expect); where a test asserts a refusal, the same call is first shown to succeed. A name the module does
// not provide yet fails each test by itself. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GH_TOKEN = "github_pat_CAROLsprintTOOL0123456789abcdef";
const GL_TOKEN = "glpat-SPACEsprintTOOLvalue0123456789";
const GITHUB = parseAddress("https://github.com/carol/sprint-tool");
const GITLAB = parseAddress("https://gitlab.example.org/space/sprint-tool");
const GH = "/repos/carol/sprint-tool";
const GL = "/api/v4/projects/space%2Fsprint-tool";
const BASE = "b".repeat(40), C1 = "1".repeat(40), C2 = "2".repeat(40), C0 = "0".repeat(40);

function seen(input, init = {}) {
  const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
  const raw = init.headers ?? {};
  const headers = raw instanceof Headers ? Object.fromEntries(raw.entries()) : Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return { method: String(init.method ?? "GET").toUpperCase(), href: url.href, host: url.host, path: url.pathname, query: url.searchParams, headers };
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const text = (status, body) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });
async function serving(answer, run) {
  const requests = [], real = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const r = seen(input, init); requests.push(r); return answer(r); };
  try { return { result: await run(), requests }; } finally { globalThis.fetch = real; }
}
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
// A fake server from a table of [path, answer(query, request)]: GET only; a path the table does not hold is a fault of the caller.
const server = (table) => (r) => {
  const found = table.find(([path]) => (typeof path === "string" ? path === r.path : path.test(r.path)));
  if (!found) throw new Error(`unrouted request: ${r.method} ${r.href}`);
  return found[1](r.query, r);
};
const pages = (all) => (q) => { const per = Number(q.get("per_page") ?? 30), page = Number(q.get("page") ?? 1); return json(200, all.slice((page - 1) * per, page * per)); };

// ---------------------------------------------------------------- GitHub fixtures

const ghPull = (n, more = {}) => ({ number: n, title: `Pull ${n}`, state: "open", draft: false, html_url: `https://github.com/carol/sprint-tool/pull/${n}`, created_at: "2026-10-10T08:00:00Z",
  body: `Description of pull ${n}`, merged_at: null, closed_at: null, head: { ref: `feature-${n}`, sha: C2 }, base: { ref: "main", sha: BASE }, user: { login: "carol" }, ...more });
const ghCommit = (sha, message, parents, date) => ({ sha, commit: { message, committer: { date } }, parents: parents.map((p) => ({ sha: p })) });
const run = (name, status, conclusion = null) => ({ name, status, conclusion, html_url: `https://github.com/carol/sprint-tool/actions/runs/${name}` });
const GH_REVIEWS = [
  { user: { login: "dana" }, state: "CHANGES_REQUESTED", commit_id: C1, submitted_at: "2026-10-10T10:00:00Z" },
  { user: { login: "dana" }, state: "APPROVED", commit_id: C2, submitted_at: "2026-10-11T10:00:00Z" },
  { user: { login: "erin" }, state: "COMMENTED", commit_id: C2, submitted_at: "2026-10-11T11:00:00Z" },
  { user: { login: "frank" }, state: "PENDING", commit_id: C2 },
  { user: { login: "gina" }, state: "DISMISSED", commit_id: C1, submitted_at: "2026-10-10T12:00:00Z" },
];
// A GitHub whose pull request 7 has two commits, newest first as the server may give them; contents at a commit by `ref`.
function github({ pulls = [ghPull(7)], contents = { [`${BASE}:README.md`]: "base readme\n", [`${C2}:a.md`]: "head a\n", [`${C2}:README.md`]: "head readme\n" } } = {}) {
  return server([
    [`${GH}/pulls`, pages(pulls)],
    [`${GH}/pulls/7`, () => json(200, ghPull(7))],
    [`${GH}/pulls/7/commits`, pages([ghCommit(C2, "second\n", [C1], "2026-10-10T09:00:00Z"), ghCommit(C1, "first\n", [BASE], "2026-10-10T08:30:00Z")])],
    [`${GH}/pulls/7/files`, pages([{ filename: "a.md", status: "added" }, { filename: "docs/b.md", status: "renamed", previous_filename: "c.md" }, { filename: "gone.md", status: "removed" }])],
    [`${GH}/pulls/7/reviews`, pages(GH_REVIEWS)],
    [new RegExp(`^${GH}/commits/${C1}$`), () => json(200, { sha: C1, files: [{ filename: "a.md", status: "added" }] })],
    [new RegExp(`^${GH}/commits/${C2}$`), () => json(200, { sha: C2, files: [{ filename: "a.md", status: "modified" }, { filename: "docs/b.md", status: "renamed", previous_filename: "c.md" }] })],
    [`${GH}/commits/${C1}/check-runs`, () => json(200, { total_count: 1, check_runs: [run("unit", "completed", "success")] })],
    [`${GH}/commits/${C2}/check-runs`, () => json(200, { total_count: 3, check_runs: [run("unit", "completed", "failure"), run("lint", "in_progress"), run("slow", "completed", "timed_out")] })],
    [`${GH}/commits/${C1}/statuses`, () => json(200, [])],
    [`${GH}/commits/${C2}/statuses`, () => json(200, [{ context: "ci/legacy", state: "success", target_url: "https://ci.example.org/1" }, { context: "ci/legacy", state: "failure", target_url: "https://ci.example.org/0" }])],
    [new RegExp(`^${GH}/contents/`), (q, r) => { const key = `${q.get("ref")}:${decodeURIComponent(r.path.slice(`${GH}/contents/`.length))}`; return key in contents ? text(200, contents[key]) : json(404, { message: "Not Found" }); }],
  ]);
}

// ---------------------------------------------------------------- GitHub

// TST-472552 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-032
// given: a GitHub repository with 130 pull requests, 100 on the first page and 30 on the second, of which 3 are merged and 4 closed unmerged, one a draft
// input: listPullRequests({}) and listPullRequests({ state: "all" })
// expect: every pull request, across both pages — two requests of 100 to /pulls with state=all and the page named —, each as the PullRequest: number, title, branch, base, head, state, draft, url, the dates and body ("Description of pull 1" for pull request 1, the description the fixture gives it); the token only as a Bearer header to api.github.com, in no address
test("listPullRequests on GitHub — every page, each record in the one shape", async () => {
  const all = Array.from({ length: 130 }, (_, i) => ghPull(i + 1, i < 3 ? { state: "closed", merged_at: "2026-10-12T08:00:00Z", closed_at: "2026-10-12T08:00:00Z" }
    : i < 7 ? { state: "closed", closed_at: "2026-10-11T08:00:00Z" } : i === 7 ? { draft: true } : {}));
  const host = connect(GITHUB, { token: GH_TOKEN });
  for (const filter of [{}, { state: "all" }]) {
    const { result, requests } = await serving(server([[`${GH}/pulls`, pages(all)]]), () => host.listPullRequests(filter));
    assert.equal(result.length, 130);
    assert.deepEqual(requests.map((r) => [r.method, r.path, r.query.get("state"), r.query.get("per_page"), r.query.get("page")]), [["GET", `${GH}/pulls`, "all", "100", "1"], ["GET", `${GH}/pulls`, "all", "100", "2"]]);
    assert.ok(requests.every((r) => r.host === "api.github.com" && r.headers.authorization === `Bearer ${GH_TOKEN}` && !r.href.includes(GH_TOKEN)));
    assert.deepEqual(result[0], { number: 1, title: "Pull 1", branch: "feature-1", base: "main", head: C2, mergeCommit: null, state: "merged", draft: false, url: "https://github.com/carol/sprint-tool/pull/1",
      opened: "2026-10-10T08:00:00Z", merged: "2026-10-12T08:00:00Z", closed: "2026-10-12T08:00:00Z", body: "Description of pull 1" });
    assert.deepEqual(result.slice(0, 10).map((p) => [p.state, p.draft]), [["merged", false], ["merged", false], ["merged", false], ["closed", false], ["closed", false], ["closed", false], ["closed", false], ["open", true], ["open", false], ["open", false]]);
    assert.deepEqual([result[3].merged, result[3].closed, result[8].closed], [null, "2026-10-11T08:00:00Z", null]);
  }
});

// TST-472553 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-032
// given: the same repository
// input: listPullRequests with state "open", "merged", "closed", and with branch "feature-9"
// expect: open asks for state=open; merged and closed ask for state=closed and keep, the first only those with a merged_at and the second only those without; the branch filter asks for head=carol:feature-9 and returns that pull request alone; a filter of an unknown state is a TypeError with no request
test("listPullRequests on GitHub — the state and branch filters", async () => {
  const all = Array.from({ length: 12 }, (_, i) => ghPull(i + 1, i < 3 ? { state: "closed", merged_at: "2026-10-12T08:00:00Z", closed_at: "2026-10-12T08:00:00Z" } : i < 5 ? { state: "closed", closed_at: "2026-10-11T08:00:00Z" } : {}));
  const answer = server([[`${GH}/pulls`, (q) => {
    const wanted = q.get("state"), head = q.get("head");
    return json(200, all.filter((p) => (wanted === "all" || p.state === wanted) && (!head || head === `carol:${p.head.ref}`)));
  }]]);
  const host = connect(GITHUB, { token: GH_TOKEN });
  const ask = async (filter) => serving(answer, () => host.listPullRequests(filter));
  const open = await ask({ state: "open" });
  assert.deepEqual([open.requests[0].query.get("state"), open.result.map((p) => p.number)], ["open", [6, 7, 8, 9, 10, 11, 12]]);
  const merged = await ask({ state: "merged" });
  assert.equal(merged.requests[0].query.get("state"), "closed");
  assert.deepEqual(merged.result.map((p) => [p.number, p.state]), [[1, "merged"], [2, "merged"], [3, "merged"]]);
  const closed = await ask({ state: "closed" });
  assert.equal(closed.requests[0].query.get("state"), "closed");
  assert.deepEqual(closed.result.map((p) => [p.number, p.state]), [[4, "closed"], [5, "closed"]]);
  const branch = await ask({ branch: "feature-9" });
  assert.equal(branch.requests[0].query.get("head"), "carol:feature-9");
  assert.deepEqual(branch.result.map((p) => p.number), [9]);
  const refused = await serving(answer, () => failure(host.listPullRequests({ state: "everything" })));
  assert.ok(refused.result instanceof TypeError);
  assert.equal(refused.requests.length, 0);
});

// TST-472554 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-002; UC-032
// given: pull request 7, whose commits the server lists newest first, with check runs and statuses, reviews on both commits, three changed files, and contents at the base and head commits
// input: pullRequestFacts(7)
// expect: the pull request, with body "Description of pull 7"; its commits oldest first — first, second — each with its message, the paths it changed (a rename by its new path) and its ci (the first success; the second failure, since a check failed); the files of the request with their change (added, renamed, deleted); the reviews in the order given — pending left out — with reviewer, verdict, commit, date; the head's checks: the check runs in order, then the latest status of each context, with state and url; all requests to api.github.com with the token as a Bearer header only
test("pullRequestFacts on GitHub — commits in order with their files and ci, files, reviews and head checks", async () => {
  const host = connect(GITHUB, { token: GH_TOKEN });
  const { result: facts, requests } = await serving(github(), () => host.pullRequestFacts(7));
  assert.deepEqual(facts.pullRequest, { number: 7, title: "Pull 7", branch: "feature-7", base: "main", head: C2, mergeCommit: null, state: "open", draft: false, url: "https://github.com/carol/sprint-tool/pull/7",
    opened: "2026-10-10T08:00:00Z", merged: null, closed: null, body: "Description of pull 7" });
  assert.deepEqual(facts.commits, [
    { sha: C1, message: "first\n", files: ["a.md"], ci: "success" },
    { sha: C2, message: "second\n", files: ["a.md", "docs/b.md"], ci: "failure" }]);
  assert.deepEqual(facts.files, [{ path: "a.md", change: "added" }, { path: "docs/b.md", change: "renamed" }, { path: "gone.md", change: "deleted" }]);
  assert.deepEqual(facts.reviews, [
    { reviewer: "dana", verdict: "changes requested", commit: C1, date: "2026-10-10T10:00:00Z" },
    { reviewer: "dana", verdict: "approved", commit: C2, date: "2026-10-11T10:00:00Z" },
    { reviewer: "erin", verdict: "commented", commit: C2, date: "2026-10-11T11:00:00Z" },
    { reviewer: "gina", verdict: "dismissed", commit: C1, date: "2026-10-10T12:00:00Z" }]);
  assert.deepEqual(facts.checks, [
    { name: "unit", state: "failure", url: "https://github.com/carol/sprint-tool/actions/runs/unit" },
    { name: "lint", state: "running", url: "https://github.com/carol/sprint-tool/actions/runs/lint" },
    { name: "slow", state: "timed out", url: "https://github.com/carol/sprint-tool/actions/runs/slow" },
    { name: "ci/legacy", state: "success", url: "https://ci.example.org/1" }]);
  assert.ok(requests.every((r) => r.method === "GET" && r.host === "api.github.com" && r.headers.authorization === `Bearer ${GH_TOKEN}` && !r.href.includes(GH_TOKEN)));
});

// TST-472555 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-002
// given: the same pull request; contents at BASE (README.md only) and at the head commit (README.md and a.md)
// input: facts.read("README.md", "base"), read("a.md", "base"), read("a.md", "head"), read("README.md", "head"), and read("a.md", "head") again
// expect: the base text of README.md, null for a.md at the base (the commit does not hold it), the head texts; every read is a request for a commit's contents by that commit, never by a branch; the repeated read makes no request; no request is made by pullRequestFacts itself for a text
test("pullRequestFacts on GitHub — read(path, side) reads the exact commit of each side, once", async () => {
  const host = connect(GITHUB, { token: GH_TOKEN });
  const { result: facts } = await serving(github(), () => host.pullRequestFacts(7));
  const { result, requests } = await serving(github(), async () => [await facts.read("README.md", "base"), await facts.read("a.md", "base"), await facts.read("a.md", "head"),
    await facts.read("README.md", "head"), await facts.read("a.md", "head")]);
  assert.deepEqual(result, ["base readme\n", null, "head a\n", "head readme\n", "head a\n"]);
  assert.deepEqual(requests.map((r) => [r.path.slice(GH.length), r.query.get("ref")]), [["/contents/README.md", BASE], ["/contents/a.md", BASE], ["/contents/a.md", C2], ["/contents/README.md", C2]]);
  assert.ok(requests.every((r) => /^[0-9a-f]{40}$/.test(r.query.get("ref"))));
  const unknown = await failure(facts.read("a.md", "middle"));
  assert.ok(unknown instanceof TypeError);
});

// ---------------------------------------------------------------- GitLab fixtures

const glMr = (iid, more = {}) => ({ iid, title: `Merge ${iid}`, state: "opened", draft: false, web_url: `https://gitlab.example.org/space/sprint-tool/-/merge_requests/${iid}`,
  created_at: "2026-10-10T08:00:00.000Z", description: `Description of merge ${iid}`, merged_at: null, closed_at: null, source_branch: `feature-${iid}`, target_branch: "main", sha: C2,
  diff_refs: { base_sha: BASE, head_sha: C2, start_sha: C0 }, ...more });
const glCommit = (id, message, parents, date) => ({ id, message, parent_ids: parents, created_at: date, committed_date: date });
const job = (name, status) => ({ name, status, web_url: `https://gitlab.example.org/space/sprint-tool/-/jobs/${name}` });
const glRaw = { [`${BASE}:README.md`]: "base readme\n", [`${C2}:a.md`]: "head a\n" };
function gitlab({ mrs = [glMr(7)], pipelinesOf = { [C1]: [{ id: 60, status: "success" }], [C2]: [{ id: 61, status: "failed" }], [BASE]: [] } } = {}) {
  return server([
    [`${GL}/merge_requests`, pages(mrs)],
    [`${GL}/merge_requests/7`, () => json(200, glMr(7))],
    [`${GL}/merge_requests/7/commits`, pages([glCommit(C2, "second\n", [C1], "2026-10-10T09:00:00Z"), glCommit(C1, "first\n", [BASE], "2026-10-10T08:30:00Z")])],
    [`${GL}/merge_requests/7/diffs`, pages([{ new_path: "a.md", old_path: "a.md", new_file: true }, { new_path: "docs/b.md", old_path: "c.md", renamed_file: true }, { new_path: "gone.md", old_path: "gone.md", deleted_file: true }])],
    [`${GL}/merge_requests/7/approvals`, () => json(200, { approved_by: [{ approved_at: "2026-10-11T09:00:00.000Z", user: { username: "dana" } }] })],
    [new RegExp(`^${GL}/repository/commits/${C1}/diff$`), pages([{ new_path: "a.md", old_path: "a.md", new_file: true }])],
    [new RegExp(`^${GL}/repository/commits/${C2}/diff$`), pages([{ new_path: "a.md", old_path: "a.md" }, { new_path: "docs/b.md", old_path: "c.md", renamed_file: true }])],
    [`${GL}/pipelines`, (q) => json(200, pipelinesOf[q.get("sha")] ?? [])],
    [`${GL}/pipelines/61/jobs`, pages([job("unit", "failed"), job("lint", "running"), job("later", "manual"), job("old", "canceled"), job("skip", "skipped")])],
    [new RegExp(`^${GL}/repository/files/`), (q, r) => { const key = `${q.get("ref")}:${decodeURIComponent(r.path.slice(`${GL}/repository/files/`.length, -"/raw".length))}`; return key in glRaw ? text(200, glRaw[key]) : json(404, { message: "404 File Not Found" }); }],
  ]);
}

// ---------------------------------------------------------------- GitLab

// TST-472556 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-032
// given: a GitLab project with 130 merge requests over two pages: merged, closed, one locked, one draft
// input: listPullRequests({}), then with state "open", "merged", "closed" and branch "feature-9"
// expect: both pages of the project's merge requests with state=all; each as the PullRequest — iid as number, source_branch as branch, target_branch as base, sha as head, web_url as url, the server's dates, description as body ("Description of merge 1" for merge request 1); locked is open; open asks for state=opened, merged for merged, closed for closed, the branch for source_branch=feature-9; the token as PRIVATE-TOKEN to the project's API only, in no address
test("listPullRequests on GitLab — every page, each record in the one shape, the filters sent to the server", async () => {
  const all = Array.from({ length: 130 }, (_, i) => glMr(i + 1, i < 2 ? { state: "merged", merged_at: "2026-10-12T08:00:00.000Z", closed_at: null } : i < 4 ? { state: "closed", closed_at: "2026-10-11T08:00:00.000Z" }
    : i === 4 ? { state: "locked" } : i === 5 ? { draft: true } : {}));
  const host = connect(GITLAB, { token: GL_TOKEN });
  const { result, requests } = await serving(server([[`${GL}/merge_requests`, pages(all)]]), () => host.listPullRequests({}));
  assert.equal(result.length, 130);
  assert.deepEqual(requests.map((r) => [r.path, r.query.get("state"), r.query.get("per_page"), r.query.get("page")]), [[`${GL}/merge_requests`, "all", "100", "1"], [`${GL}/merge_requests`, "all", "100", "2"]]);
  assert.ok(requests.every((r) => r.host === "gitlab.example.org" && r.headers["private-token"] === GL_TOKEN && !r.href.includes(GL_TOKEN) && r.headers.authorization === undefined));
  assert.deepEqual(result[0], { number: 1, title: "Merge 1", branch: "feature-1", base: "main", head: C2, mergeCommit: C2, state: "merged", draft: false, url: "https://gitlab.example.org/space/sprint-tool/-/merge_requests/1",
    opened: "2026-10-10T08:00:00.000Z", merged: "2026-10-12T08:00:00.000Z", closed: null, body: "Description of merge 1" });
  assert.deepEqual(result.slice(0, 7).map((p) => [p.state, p.draft]), [["merged", false], ["merged", false], ["closed", false], ["closed", false], ["open", false], ["open", true], ["open", false]]);
  for (const [filter, key, value] of [[{ state: "open" }, "state", "opened"], [{ state: "merged" }, "state", "merged"], [{ state: "closed" }, "state", "closed"], [{ branch: "feature-9" }, "source_branch", "feature-9"]]) {
    const asked = await serving(server([[`${GL}/merge_requests`, () => json(200, [])]]), () => host.listPullRequests(filter));
    assert.equal(asked.requests[0].query.get(key), value, JSON.stringify(filter));
    assert.deepEqual(asked.result, []);
  }
});

// TST-472557 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-002; UC-032
// given: merge request 7 with two commits the server lists newest first, pipelines for each commit, diffs, one approval, and the jobs of the head commit's newest pipeline
// input: pullRequestFacts(7), and read on both sides
// expect: the merge request with body "Description of merge 7"; the commits oldest first with their paths and ci from their newest pipeline (the first success, the second failure; a commit with no pipeline none); the files of the request; the approval as a verdict `approved` on the head commit, dated by approved_at; the head's checks as the jobs of its newest pipeline with their states; the texts read by the merge base commit and the head commit, null for a path the commit lacks, a repeated read made once; every request to the project's API with PRIVATE-TOKEN
test("pullRequestFacts on GitLab — commits, files, approvals, head jobs and the exact sides", async () => {
  const host = connect(GITLAB, { token: GL_TOKEN });
  const { result: facts, requests } = await serving(gitlab(), () => host.pullRequestFacts(7));
  assert.deepEqual(facts.pullRequest, { number: 7, title: "Merge 7", branch: "feature-7", base: "main", head: C2, mergeCommit: null, state: "open", draft: false,
    url: "https://gitlab.example.org/space/sprint-tool/-/merge_requests/7", opened: "2026-10-10T08:00:00.000Z", merged: null, closed: null, body: "Description of merge 7" });
  assert.deepEqual(facts.commits, [
    { sha: C1, message: "first\n", files: ["a.md"], ci: "success" },
    { sha: C2, message: "second\n", files: ["a.md", "docs/b.md"], ci: "failure" }]);
  assert.deepEqual(facts.files, [{ path: "a.md", change: "added" }, { path: "docs/b.md", change: "renamed" }, { path: "gone.md", change: "deleted" }]);
  assert.deepEqual(facts.reviews, [{ reviewer: "dana", verdict: "approved", commit: C2, date: "2026-10-11T09:00:00.000Z" }]);
  assert.deepEqual(facts.checks.map((c) => [c.name, c.state]), [["unit", "failure"], ["lint", "running"], ["later", "queued"], ["old", "cancelled"], ["skip", "skipped"]]);
  assert.equal(facts.checks[0].url, "https://gitlab.example.org/space/sprint-tool/-/jobs/unit");
  assert.ok(requests.every((r) => r.method === "GET" && r.host === "gitlab.example.org" && r.headers["private-token"] === GL_TOKEN && !r.href.includes(GL_TOKEN)));
  const { result, requests: reads } = await serving(gitlab(), async () => [await facts.read("README.md", "base"), await facts.read("a.md", "base"), await facts.read("a.md", "head"), await facts.read("a.md", "head")]);
  assert.deepEqual(result, ["base readme\n", null, "head a\n", "head a\n"]);
  assert.deepEqual(reads.map((r) => r.query.get("ref")), [BASE, BASE, C2]);
  const bare = await serving(gitlab({ pipelinesOf: {} }), () => host.pullRequestFacts(7));
  assert.deepEqual(bare.result.commits.map((c) => c.ci), ["none", "none"]);
  assert.deepEqual(bare.result.checks, []);
});

// TST-472558 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: pipelines in each status of docs.gitlab.com/api/pipelines/
// input: the ci of a commit whose newest pipeline has it
// expect: success → success; failed, canceled, canceling → failure; skipped → none; created, waiting_for_resource, preparing, waiting_for_callback, pending, running, scheduled, manual → running
test("pullRequestFacts on GitLab — a pipeline's status as a commit's ci", async () => {
  const expected = { success: "success", failed: "failure", canceled: "failure", canceling: "failure", skipped: "none", created: "running", waiting_for_resource: "running", preparing: "running",
    waiting_for_callback: "running", pending: "running", running: "running", scheduled: "running", manual: "running" };
  for (const [status, ci] of Object.entries(expected)) {
    const { result } = await serving(gitlab({ pipelinesOf: { [C1]: [{ id: 60, status }], [C2]: [{ id: 61, status }] } }), () => connect(GITLAB, { token: GL_TOKEN }).pullRequestFacts(7));
    assert.deepEqual(result.commits.map((c) => c.ci), [ci, ci], status);
  }
});

// TST-472559 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: GitHub check runs and statuses in each state of the pages above
// input: the head checks of a pull request whose head commit has them
// expect: queued, waiting, requested, pending → queued; in_progress → running; completed by conclusion — success, failure, neutral, cancelled, skipped, "timed out", action_required → failure, none → neutral; a status: pending → running, success, error → failure, failure; only the latest status of a context (the first listed) counts
test("pullRequestFacts on GitHub — the state of each kind of check", async () => {
  const runs = [run("q", "queued"), run("w", "waiting"), run("r", "requested"), run("p", "pending"), run("i", "in_progress"), run("s", "completed", "success"), run("f", "completed", "failure"),
    run("n", "completed", "neutral"), run("c", "completed", "cancelled"), run("k", "completed", "skipped"), run("t", "completed", "timed_out"), run("a", "completed", "action_required"), run("z", "completed", null)];
  const statuses = [{ context: "s1", state: "pending", target_url: "u1" }, { context: "s1", state: "success", target_url: "u0" }, { context: "s2", state: "error", target_url: "u2" }, { context: "s3", state: "failure", target_url: "u3" }, { context: "s4", state: "success", target_url: "u4" }];
  const base = github();
  const answer = (r) => (r.path === `${GH}/commits/${C2}/check-runs` ? json(200, { total_count: runs.length, check_runs: runs }) : r.path === `${GH}/commits/${C2}/statuses` ? json(200, statuses) : base(r));
  const { result } = await serving(answer, () => connect(GITHUB, { token: GH_TOKEN }).pullRequestFacts(7));
  assert.deepEqual(result.checks.map((c) => [c.name, c.state]), [["q", "queued"], ["w", "queued"], ["r", "queued"], ["p", "queued"], ["i", "running"], ["s", "success"], ["f", "failure"], ["n", "neutral"],
    ["c", "cancelled"], ["k", "skipped"], ["t", "timed out"], ["a", "failure"], ["z", "neutral"], ["s1", "running"], ["s2", "failure"], ["s3", "failure"], ["s4", "success"]]);
  assert.equal(result.commits[1].ci, "failure");
});

// ---------------------------------------------------------------- how they fail

// TST-472560 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: a host of each server whose server serves the list and the facts first, then answers every request with 401, 403, 404, a used-up limit, 500, and a failing network
// input: listPullRequests({}) and pullRequestFacts(7)
// expect: the records for the first; then TokenRefused, PermissionMissing, NotFound, RateLimited, Unreachable (500) and Unreachable (network) for both calls — never an empty list or facts
test("listPullRequests and pullRequestFacts name how they fail, on each server", async () => {
  const servers = [
    { host: () => connect(GITHUB, { token: GH_TOKEN }), ok: github(), limited: () => json(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1790000000" }) },
    { host: () => connect(GITLAB, { token: GL_TOKEN }), ok: gitlab(), limited: () => json(429, { message: "Retry later" }) },
  ];
  for (const { host, ok, limited } of servers) {
    assert.equal((await serving(ok, () => host().listPullRequests({}))).result.length, 1, "known positive: the list");
    assert.equal((await serving(ok, () => host().pullRequestFacts(7))).result.pullRequest.number, 7, "known positive: the facts");
    for (const call of [(h) => h.listPullRequests({}), (h) => h.pullRequestFacts(7)]) {
      const named = async (answer) => (await failure(serving(answer, () => call(host()))))?.name;
      assert.equal(await named(() => json(401, { message: "Bad credentials" })), "TokenRefused");
      assert.equal(await named(() => json(403, { message: "Forbidden" })), "PermissionMissing");
      assert.equal(await named(() => json(404, { message: "Not Found" })), "NotFound");
      assert.equal(await named(limited), "RateLimited");
      assert.equal(await named(() => json(500, { message: "Server error" })), "Unreachable");
      assert.equal(await named(() => { throw new TypeError("fetch failed"); }), "Unreachable");
    }
  }
});

// TST-472561 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a server that serves everything for pull request 7 but refuses the check runs of the second commit (403), or the reviews (401), or a commit's files (429 with a used-up limit)
// input: pullRequestFacts(7)
// expect: the refusal's own failure — PermissionMissing, TokenRefused, RateLimited —, not facts with that part missing or empty; and the 404 of pullRequestFacts names the pull request
test("pullRequestFacts fails whole when one of its parts is refused, and a missing pull request is NotFound", async () => {
  const base = github();
  const host = connect(GITHUB, { token: GH_TOKEN });
  assert.ok((await serving(base, () => host.pullRequestFacts(7))).result, "known positive");
  const refused = async (path, answer) => (await failure(serving((r) => (r.path === path ? answer() : base(r)), () => host.pullRequestFacts(7))))?.name;
  assert.equal(await refused(`${GH}/commits/${C2}/check-runs`, () => json(403, { message: "Resource not accessible by integration" })), "PermissionMissing");
  assert.equal(await refused(`${GH}/pulls/7/reviews`, () => json(401, { message: "Bad credentials" })), "TokenRefused");
  assert.equal(await refused(`${GH}/commits/${C1}`, () => json(429, { message: "slow down" }, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000" })), "RateLimited");
  const missing = await failure(serving((r) => (r.path === `${GH}/pulls/7` ? json(404, { message: "Not Found" }) : base(r)), () => host.pullRequestFacts(7)));
  assert.equal(missing.name, "NotFound");
  assert.match(missing.what, /7/);
});

// TST-472562 · level: unit · module: MOD-repository-hosts
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a host with no token for a public GitHub repository; a host through a clone with no token; a host through a clone with a token; bad numbers and a read of a side that is none
// input: listPullRequests and pullRequestFacts
// expect: with no token the requests go with no authorisation header; through a clone without a token NotSupported with no request; through a clone with a token the server's answer; a number that is no positive integer is a TypeError with no request
test("pull requests without a token, through a clone, and with arguments that are none", async () => {
  const open = await serving(github(), () => connect(GITHUB).listPullRequests({}));
  assert.equal(open.result.length, 1);
  assert.ok(open.requests.every((r) => r.headers.authorization === undefined));
  for (const call of [(h) => h.listPullRequests({}), (h) => h.pullRequestFacts(7)]) {
    const refused = await serving(github(), () => failure(call(connect(GITHUB, { clone: "/tmp/a-clone" }))));
    assert.equal(refused.result.name, "NotSupported");
    assert.equal(refused.requests.length, 0);
  }
  const through = await serving(github(), () => connect(GITHUB, { clone: "/tmp/a-clone", token: GH_TOKEN }).listPullRequests({}));
  assert.equal(through.result.length, 1);
  for (const number of [0, -1, 1.5, "7", NaN, undefined]) {
    const refused = await serving(github(), () => failure(connect(GITHUB, { token: GH_TOKEN }).pullRequestFacts(number)));
    assert.ok(refused.result instanceof TypeError, String(number));
    assert.equal(refused.requests.length, 0);
  }
});

// ---------------------------------------------------------------- a commit's ci and the order of the commits

// TST-472563 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: a GitHub pull request whose first commit has only the checks named, nothing else, and its second commit none
// input: pullRequestFacts(7), for each set of checks of the first commit
// expect: failure for a timed out run alone, a cancelled run alone and a failed status alone; running for a run in progress beside a success; success for a success beside a skipped and a neutral run; none for no check at all
test("pullRequestFacts on GitHub — a commit's ci from its checks alone", async () => {
  const base = github();
  const sets = [[[run("t", "completed", "timed_out")], [], "failure"], [[run("c", "completed", "cancelled")], [], "failure"], [[], [{ context: "legacy", state: "failure", target_url: "u" }], "failure"],
    [[run("ok", "completed", "success"), run("busy", "in_progress")], [], "running"], [[run("ok", "completed", "success"), run("s", "completed", "skipped"), run("n", "completed", "neutral")], [], "success"],
    [[], [], "none"]];
  for (const [runs, statuses, ci] of sets) {
    const answer = (r) => (r.path === `${GH}/commits/${C1}/check-runs` ? json(200, { total_count: runs.length, check_runs: runs }) : r.path === `${GH}/commits/${C1}/statuses` ? json(200, statuses) : base(r));
    const { result } = await serving(answer, () => connect(GITHUB, { token: GH_TOKEN }).pullRequestFacts(7));
    assert.equal(result.commits[0].ci, ci, JSON.stringify([runs.map((x) => x.conclusion ?? x.status), statuses.map((x) => x.state)]));
  }
});

// TST-472564 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: a GitHub pull request whose server lists the second commit first, and whose first commit has the later date (a rebased commit: its committer date is newer than its child's)
// input: pullRequestFacts(7)
// expect: the first commit first: the parents decide, not the dates
test("pullRequestFacts — the parents decide the order of the commits before the dates do", async () => {
  const base = github();
  const answer = (r) => (r.path === `${GH}/pulls/7/commits` ? pages([ghCommit(C2, "second\n", [C1], "2026-10-10T08:00:00Z"), ghCommit(C1, "first\n", [BASE], "2026-10-10T09:00:00Z")])(r.query) : base(r));
  const { result } = await serving(answer, () => connect(GITHUB, { token: GH_TOKEN }).pullRequestFacts(7));
  assert.deepEqual(result.commits.map((c) => c.sha), [C1, C2]);
});

// TST-472565 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: a GitLab merge request whose commits come newest first and name no parent_ids (the page's example omits them), with the dates of the commits
// input: pullRequestFacts(7)
// expect: the commits oldest first by their dates
test("pullRequestFacts on GitLab — commits that name no parents are ordered by their dates, oldest first", async () => {
  const base = gitlab();
  const bare = (id, message, date) => ({ id, message, created_at: date, committed_date: date });
  const answer = (r) => (r.path === `${GL}/merge_requests/7/commits` ? pages([bare(C2, "second\n", "2026-10-10T09:00:00Z"), bare(C1, "first\n", "2026-10-10T08:30:00Z")])(r.query) : base(r));
  const { result } = await serving(answer, () => connect(GITLAB, { token: GL_TOKEN }).pullRequestFacts(7));
  assert.deepEqual(result.commits.map((c) => c.sha), [C1, C2]);
});

// ---------------------------------------------------------------- the description

// TST-537001 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-032
// given: a GitHub repository whose pull request 1 has the description "Closes the gap.\n\nSecond paragraph.", 2 has body null, 3 has body "" and 4 has no body field at all; pull request 7 (for the facts) has the description "Facts text" or null
// input: listPullRequests({}), and pullRequestFacts(7) once with the description and once with null
// expect: body "Closes the gap.\n\nSecond paragraph." for 1 exactly as written; "" for 2, 3 and 4; body "Facts text" in the facts' pullRequest, and "" in the facts when the server gives null; every body is a string
test("PullRequest.body on GitHub — the description as written, \"\" where there is none, in the list and in the facts", async () => {
  const host = connect(GITHUB, { token: GH_TOKEN });
  const pulls = [ghPull(1, { body: "Closes the gap.\n\nSecond paragraph." }), ghPull(2, { body: null }), ghPull(3, { body: "" }), ghPull(4, { body: undefined })];
  assert.equal("body" in JSON.parse(JSON.stringify(pulls[3])), false, "known positive: the fixture's pull request 4 carries no body field");
  const { result: listed } = await serving(github({ pulls }), () => host.listPullRequests({}));
  assert.deepEqual(listed.map((p) => p.body), ["Closes the gap.\n\nSecond paragraph.", "", "", ""]);
  assert.ok(listed.every((p) => typeof p.body === "string"));
  const base = github();
  const factsWith = (body) => serving((r) => (r.path === `${GH}/pulls/7` ? json(200, ghPull(7, { body })) : base(r)), () => host.pullRequestFacts(7));
  assert.equal((await factsWith("Facts text")).result.pullRequest.body, "Facts text");
  assert.equal((await factsWith(null)).result.pullRequest.body, "");
});

// TST-537002 · level: unit · module: MOD-repository-hosts
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-032
// given: a GitLab project whose merge request 1 has the description "Closes the gap.\n\nSecond paragraph.", 2 has description null, 3 has description "" and 4 has no description field at all; merge request 7 (for the facts) has the description "Facts text" or null
// input: listPullRequests({}), and pullRequestFacts(7) once with the description and once with null
// expect: body "Closes the gap.\n\nSecond paragraph." for 1 exactly as written; "" for 2, 3 and 4; body "Facts text" in the facts' pullRequest, and "" in the facts when the server gives null; every body is a string
test("PullRequest.body on GitLab — the description as written, \"\" where there is none, in the list and in the facts", async () => {
  const host = connect(GITLAB, { token: GL_TOKEN });
  const mrs = [glMr(1, { description: "Closes the gap.\n\nSecond paragraph." }), glMr(2, { description: null }), glMr(3, { description: "" }), glMr(4, { description: undefined })];
  assert.equal("description" in JSON.parse(JSON.stringify(mrs[3])), false, "known positive: the fixture's merge request 4 carries no description field");
  const { result: listed } = await serving(gitlab({ mrs }), () => host.listPullRequests({}));
  assert.deepEqual(listed.map((p) => p.body), ["Closes the gap.\n\nSecond paragraph.", "", "", ""]);
  assert.ok(listed.every((p) => typeof p.body === "string"));
  const base = gitlab();
  const factsWith = (description) => serving((r) => (r.path === `${GL}/merge_requests/7` ? json(200, glMr(7, { description })) : base(r)), () => host.pullRequestFacts(7));
  assert.equal((await factsWith("Facts text")).result.pullRequest.body, "Facts text");
  assert.equal((await factsWith(null)).result.pullRequest.body, "");
});

// ---------------------------------------------------------------- the commit a merge made (ITM-1110)
//
// MOD-repository-hosts (Interfaces: `PullRequest`): "`mergeCommit` is the commit its merge put on `base`, as the server names it — the merge commit, or the last commit of a squash or a rebase (GitHub's `merge_commit_sha` of a
// merged pull request; GitLab's `merge_commit_sha`, else its `squash_commit_sha`, else, for a fast-forward, `head`) —, and `null` while it is not merged, whatever the server names then." Readings the text leaves open:
//   - A GitHub pull request that is merged and for which the server names no `merge_commit_sha` has `mergeCommit` null (the server names none).
//   - GitLab's fast-forward is a merged merge request with neither `merge_commit_sha` nor `squash_commit_sha`: the fixture confirms what the draft reads, that `head` has then landed on the base.

const MERGED = "5".repeat(40), SQUASHED = "6".repeat(40), TEST_MERGE = "7".repeat(40);

// TST-1302008 · level: unit · module: MOD-repository-hosts
// guards: UC-039
// given: a GitHub repository whose pull requests are one merged with merge_commit_sha 5…5 (a squash: its head is C2), one closed unmerged and one open, each naming a merge_commit_sha (GitHub names a test merge commit for an open one), and one merged naming none
// input: listPullRequests({})
// expect: the merged one has mergeCommit 5…5, whatever its head; the closed and the open one null although the server names a commit; the merged one that names none null
test("listPullRequests on GitHub — a merged pull request names the commit its merge made, an unmerged one none", async () => {
  const merged = { state: "closed", merged_at: "2026-10-12T08:00:00Z", closed_at: "2026-10-12T08:00:00Z", merge_commit_sha: MERGED };
  const pulls = [ghPull(7, merged), ghPull(2, { state: "closed", closed_at: "2026-10-11T08:00:00Z", merge_commit_sha: TEST_MERGE }), ghPull(3, { merge_commit_sha: TEST_MERGE }),
    ghPull(4, { state: "closed", merged_at: "2026-10-12T09:00:00Z", closed_at: "2026-10-12T09:00:00Z" })];
  const host = connect(GITHUB, { token: GH_TOKEN });
  const { result } = await serving(server([[`${GH}/pulls`, pages(pulls)]]), () => host.listPullRequests({}));
  assert.deepEqual(result.map((pull) => [pull.number, pull.state, pull.mergeCommit]), [[7, "merged", MERGED], [2, "closed", null], [3, "open", null], [4, "merged", null]]);
  assert.equal(result[0].head, C2);
});

// TST-1302009 · level: unit · module: MOD-repository-hosts
// guards: UC-039
// given: a GitLab project whose merge requests are one merged with merge_commit_sha 5…5, one merged by a squash (merge_commit_sha null, squash_commit_sha 6…6), one merged by a fast-forward (both null; its sha C2 has landed on the target), one closed and one opened that name a merge_commit_sha
// input: listPullRequests({})
// expect: the mergeCommit of the first is 5…5; of the second 6…6; of the third its head C2; of the closed and of the opened one null
test("listPullRequests on GitLab — the merge commit, else the squash commit, else for a fast-forward the head, and null while not merged", async () => {
  const mrs = [glMr(1, { state: "merged", merged_at: "2026-10-12T08:00:00.000Z", merge_commit_sha: MERGED, squash_commit_sha: null }),
    glMr(2, { state: "merged", merged_at: "2026-10-12T08:00:00.000Z", merge_commit_sha: null, squash_commit_sha: SQUASHED }),
    glMr(3, { state: "merged", merged_at: "2026-10-12T08:00:00.000Z", merge_commit_sha: null, squash_commit_sha: null }),
    glMr(4, { state: "closed", closed_at: "2026-10-11T08:00:00.000Z", merge_commit_sha: TEST_MERGE }), glMr(5, { merge_commit_sha: TEST_MERGE })];
  const host = connect(GITLAB, { token: GL_TOKEN });
  const { result } = await serving(server([[`${GL}/merge_requests`, pages(mrs)]]), () => host.listPullRequests({}));
  assert.deepEqual(result.map((pull) => [pull.number, pull.state, pull.mergeCommit]), [[1, "merged", MERGED], [2, "merged", SQUASHED], [3, "merged", C2], [4, "closed", null], [5, "open", null]]);
});
