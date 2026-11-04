// MOD-repository-hosts' `readIssue` and `listIssues` with `comments: false` (ITM-1270), as the accepted text of docs/architecture/MOD-repository-hosts.md states them (:271-276):
// "`listIssues(filter: { state?, labels?, search?, comments?: boolean }) -> Promise<Issue[]>` — crosses the network; fails as `readSnapshot`, and with `NotSupported` through a clone. With `comments: false`, each issue's `comments` is
// empty and no comment is asked for; otherwise each issue that has comments is given them." "`readIssue(number: number) -> Promise<Issue>` — one issue with its comments, in one request and one per page of its comments. Crosses the
// network; fails as `listIssues`, and with `NotFound` for a number the repository has no issue of."
// Run: node --test tests/repository-hosts-read-issue.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-012; A REMOTE INTERFACE NAMES HOW IT FAILS
// Level: unit
//
// The servers are fakes of `fetch`, deterministic, no network, answering as the APIs document: GitHub's "Get an issue" (GET /repos/{owner}/{repo}/issues/{n}, which answers a pull request's number with the pull request as an issue,
// carrying a `pull_request` key), "List repository issues" and "List issue comments" (per_page up to 100, page); GitLab's "Get a single project issue" (GET /projects/:id/issues/:iid, 404 for an iid that no issue has — a merge request's
// iid is not an issue's), "List project issues" and "List project issue notes" (the system notes are no comments).
// Readings the texts leave open, which the tests state (the pull request names them):
//   - A pull request's number on GitHub, which GitHub's issue call answers, is no issue of the repository: NotFound, as for a number nothing has. On GitLab a merge request's iid the server holds no issue under is answered 404: NotFound.
//   - The comments of an issue are read page by page while a page is full, as listIssues reads them, and only for an issue whose count of comments is not zero.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
function fake(answer) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const request = { method: init.method ?? "GET", path: url.pathname, query: Object.fromEntries(url.searchParams) };
    requests.push(request);
    return answer(request);
  };
  return { requests, fetch };
}
// One page of a list the fake serves: the items of page `query.page` at `query.per_page` to a page.
const pageOf = (items, query) => {
  const per = Number(query.per_page ?? 100), page = Number(query.page ?? 1);
  return items.slice((page - 1) * per, page * per);
};

const GH_WEB = "https://github.com/carol/release-tool", GH_PREFIX = "/repos/carol/release-tool";
const GL_WEB = "https://gitlab.example.org/space/release-tool", GL_PREFIX = "/api/v4/projects/space%2Frelease-tool";
const hub = () => connect(parseAddress(GH_WEB), { token: "github_pat_CAROLreleaseTOOL0123456789abcdef" });
const lab = () => connect(parseAddress(GL_WEB), { token: "glpat-SPACEreleaseTOOL0123456789" });

// ---------------------------------------------------------------- GitHub: the open issue 7 with 101 comments, the open issue 8 without one, the pull request 9

const GH_COMMENTS = Array.from({ length: 101 }, (_, i) => ({ user: { login: "alice" }, body: `Comment ${i + 1}.`, created_at: "2026-10-12T09:00:00Z" }));
const GH_ISSUES = [
  { number: 7, title: "The export fails", body: "Empty file.", labels: [{ name: "defect" }], state: "open", html_url: `${GH_WEB}/issues/7`, comments: 101, created_at: "2026-10-01T08:00:00Z", closed_at: null },
  { number: 8, title: "Dark mode", body: "Please.", labels: [], state: "open", html_url: `${GH_WEB}/issues/8`, comments: 0, created_at: "2026-10-02T08:00:00Z", closed_at: null },
  { number: 9, title: "A pull request", body: "", labels: [], state: "open", html_url: `${GH_WEB}/pull/9`, comments: 0, pull_request: {}, created_at: "2026-10-03T08:00:00Z", closed_at: null },
];
function githubServer() {
  return fake((r) => {
    if (r.path === `${GH_PREFIX}/issues`) return json(200, pageOf(GH_ISSUES, r.query));
    if (r.path === `${GH_PREFIX}/issues/7/comments`) return json(200, pageOf(GH_COMMENTS, r.query));
    if (/\/issues\/\d+\/comments$/.test(r.path)) return json(200, []);
    const one = /^\/repos\/carol\/release-tool\/issues\/(\d+)$/.exec(r.path);
    const found = one && GH_ISSUES.find((each) => each.number === Number(one[1]));
    return found ? json(200, found) : json(404, { message: "Not Found" });
  });
}

// ---------------------------------------------------------------- GitLab: the opened issue 7 with 101 notes (one of them a system note), the opened issue 8 without one; the merge request !9 is no issue

const GL_NOTES = Array.from({ length: 101 }, (_, i) => ({ author: { username: "alice" }, body: `Note ${i + 1}.`, created_at: "2026-10-12T09:00:00Z", system: i === 0 }));
const GL_ISSUES = [
  { iid: 7, title: "The export fails", description: "Empty file.", labels: ["defect"], state: "opened", user_notes_count: 101, web_url: `${GL_WEB}/-/issues/7`, created_at: "2026-10-01T08:00:00Z", closed_at: null },
  { iid: 8, title: "Dark mode", description: "Please.", labels: [], state: "opened", user_notes_count: 0, web_url: `${GL_WEB}/-/issues/8`, created_at: "2026-10-02T08:00:00Z", closed_at: null },
];
function gitlabServer() {
  return fake((r) => {
    if (r.path === `${GL_PREFIX}/issues`) return json(200, pageOf(GL_ISSUES, r.query));
    if (r.path === `${GL_PREFIX}/issues/7/notes`) return json(200, pageOf(GL_NOTES, r.query));
    if (/\/issues\/\d+\/notes$/.test(r.path)) return json(200, []);
    const one = /^\/api\/v4\/projects\/space%2Frelease-tool\/issues\/(\d+)$/.exec(r.path);
    const found = one && GL_ISSUES.find((each) => each.iid === Number(one[1]));
    return found ? json(200, found) : json(404, { message: "404 Not found" });
  });
}

const commentRequests = (server) => server.requests.filter((r) => /\/issues\/\d+\/(comments|notes)$/.test(r.path));

// TST-1270001 · level: unit · module: MOD-repository-hosts
// guards: UC-012
// given: a GitHub repository whose open issue 7 has 101 comments, which the server gives 100 to a page; the same on a GitLab server, the issue 7 with 101 notes of which one is a system note
// input: readIssue(7) on each; and, on a fresh server of each, listIssues({ state: "all" })
// expect: GitHub: exactly three requests — GET …/issues/7, then GET …/issues/7/comments page 1 and page 2 —; GitLab: GET …/issues/7, then GET …/issues/7/notes page 1 and page 2; on each the Issue equals the one listIssues gives for number 7, with 101 comments on GitHub and 100 on GitLab (the system note is none)
test("readIssue — reads one issue in one request and its comments in one request per page, and gives the Issue listIssues gives for it", async () => {
  for (const [name, host, server] of [["GitHub", hub, githubServer], ["GitLab", lab, gitlabServer]]) {
    const reading = server();
    const issue = await using(reading.fetch, () => host().readIssue(7));
    const comments = name === "GitHub" ? "comments" : "notes";
    const prefix = name === "GitHub" ? GH_PREFIX : GL_PREFIX;
    assert.deepEqual(reading.requests.map((r) => [r.method, r.path, r.query.page ?? null]),
      [["GET", `${prefix}/issues/7`, null], ["GET", `${prefix}/issues/7/${comments}`, "1"], ["GET", `${prefix}/issues/7/${comments}`, "2"]], name);
    const listed = (await using(server().fetch, () => host().listIssues({ state: "all" }))).find((each) => each.number === 7);
    assert.deepEqual(issue, listed, name);
    assert.equal(issue.comments.length, name === "GitHub" ? 101 : 100, name);
  }
});

// TST-1270002 · level: unit · module: MOD-repository-hosts
// guards: UC-012
// given: the same servers: the open issue 7 has 101 comments, the open issue 8 none
// input: listIssues({ state: "open", comments: false }) on each; then, as the counter-proof, listIssues({ state: "open" }) without `comments` on a fresh server of each
// expect: with comments: false the issues 7 and 8, each with empty comments, and no request for the comments or notes of any issue — only the pages of the issue list; without `comments` the comments are read as before: two requests for those of issue 7 (page 1 and 2) and none for issue 8, which has none, and issue 7 carries 101 comments on GitHub and 100 on GitLab
test("listIssues — with comments: false asks for no comment and each issue's comments are empty; without it the comments are read as before", async () => {
  for (const [name, host, server] of [["GitHub", hub, githubServer], ["GitLab", lab, gitlabServer]]) {
    const listing = server();
    const issues = await using(listing.fetch, () => host().listIssues({ state: "open", comments: false }));
    assert.deepEqual(issues.map((each) => [each.number, each.comments]), [[7, []], [8, []]], name);
    assert.deepEqual(commentRequests(listing), [], name);
    assert.ok(listing.requests.every((r) => r.path.endsWith("/issues")), `${name}: only the issue list is asked for`);

    const before = server();
    const withComments = await using(before.fetch, () => host().listIssues({ state: "open" }));
    assert.deepEqual(commentRequests(before).map((r) => [r.path.split("/").slice(-2)[0], r.query.page]), [["7", "1"], ["7", "2"]], `${name}, counter-proof`);
    assert.equal(withComments.find((each) => each.number === 7).comments.length, name === "GitHub" ? 101 : 100, `${name}, counter-proof`);
  }
});

// TST-1270003 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-012
// given: on GitHub the number 9 is a pull request, which GitHub's issue call answers with a pull_request key; on GitLab !9 is a merge request, and the server holds no issue 9
// input: readIssue(9) on each
// expect: each fails with NotFound; no request for comments or notes is sent
test("readIssue — a pull request's number is NotFound", async () => {
  for (const [name, host, server] of [["GitHub", hub, githubServer], ["GitLab", lab, gitlabServer]]) {
    const reading = server();
    const problem = await using(reading.fetch, () => failure(host().readIssue(9)));
    assert.equal(problem?.name, "NotFound", `${name}: ${problem?.message}`);
    assert.deepEqual(commentRequests(reading), [], name);
  }
});
