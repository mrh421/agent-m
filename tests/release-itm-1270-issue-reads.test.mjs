// Release tests of ITM-1270, on GitHub and on a GitLab server — UC-012 step 2 on the pages of issues: the list of the open issues asks for no comment, a page of one issue reads that issue by its number with its comments and lists no issue, a number that is a pull
// request's or a merge request's is no issue, and `listIssues` without the new option reads the comments as before. The behaviour is docs/architecture/MOD-repository-hosts.md's (`listIssues`: "With `comments: false`, each issue's `comments` is empty and no comment is
// asked for; otherwise each issue that has comments is given them."; `readIssue`: "one issue with its comments, in one request and one per page of its comments. ... fails ... with `NotFound` for a number the repository has no issue of.") and
// docs/architecture/MOD-maintenance-pages.md's ("The list reads the open issues without their comments (`listIssues` with `comments: false`); `issue/<number>` and `replies/<issue>` read their one issue with `readIssue`.").
// Run: node --test tests/release-itm-1270-issue-reads.test.mjs
//
// Module: MOD-repository-hosts; MOD-maintenance-pages
// Guards: UC-012; A REMOTE INTERFACE NAMES HOW IT FAILS
// Level: release
//
// Written for the release testing of sprint 114 by a participant who implemented none of ITM-1270 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases (tests/repository-hosts-read-issue.test.mjs, tests/maintenance-pages-issues-reads.test.mjs) take two
// issues of a server, or forty on GitHub in one page; these cases take their own tracker of a hundred and twenty open issues, of which thirty-one have comments (one of them a hundred and one), a closed issue, and a number that is a pull request on GitHub and a merge request on GitLab, and
// meet the real routes `issues` and `issue` and the real host over a fake of `fetch` that records every request, on a GitHub repository and on a GitLab project in turn. No request leaves the process. The replies page is in tests/release-itm-1270-replies-read-issue.test.mjs.
// Readings the texts leave open, taken here:
//   - "asks for no comment" is read as no request for the comments of an issue (GitHub …/issues/<n>/comments, GitLab …/issues/<n>/notes); the pages of the issue list, and nothing else, are asked for by the list.
//   - "one per hundred open issues" (the item's measurable outcome) is read for the list as one request for each full or partly full page of a hundred issues, so two for a hundred and twenty issues.
//   - "a number the repository has no issue of" is read as the number of no issue at all (404), of an issue GitHub reports as deleted (410), and, on GitHub, of a pull request (GitHub's issue call answers it as an issue with a `pull_request` key) — as on GitLab the iid of a merge request,
//     which the server counts apart from the issues' and so answers 404 when no issue has it. The page of such a number says "Issue <n> is not in this product." and does not fail.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../src/browser-store/index.mjs";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const { view } = await import("../src/maintenance-pages/index.mjs");
const routeNamed = (name) => view.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the tracker: the same issues on both servers
//
// Open issues 1 to 120 (the title "Issue <n>", but 7 "The export fails" and 8 "Export is slow"); the comments of the issue n: 101 for 7, one for each multiple of 4 (4, 8, 12 … 120: thirty issues), none for the others. The issue 130 is closed and has two
// comments. The number 140 is an issue GitHub reports as deleted (410). The number 150 is a pull request on GitHub and a merge request on GitLab.

const commentCount = (n) => (n === 7 ? 101 : n === 130 ? 2 : n % 4 === 0 ? 1 : 0);
const titleOf = (n) => (n === 7 ? "The export fails" : n === 8 ? "Export is slow" : `Issue ${n}`);
const bodyOf = (n) => `Text of issue ${n}.`;
const NUMBERS = [...Array.from({ length: 120 }, (_, i) => i + 1), 130];
const closed = (n) => n === 130;

const GH = { kind: "github", web: "https://github.com/northwind/ledger", prefix: "/repos/northwind/ledger", token: "github_pat_NORTHWINDledger0123456789abc", comments: "comments", label: "GitHub" };
const GL = { kind: "gitlab", web: "https://git.example.net/team/ledger", prefix: "/api/v4/projects/team%2Fledger", token: "glpat-TEAMledger0123456789abcdef", comments: "notes", label: "GitLab" };

const pageOf = (items, query) => {
  const per = Number(query.per_page ?? 100), page = Number(query.page ?? 1);
  return items.slice((page - 1) * per, page * per);
};
const wanted = (state, n) => state === "all" || (state === "closed" ? closed(n) : !closed(n));

function ghIssue(n) {
  return { number: n, title: titleOf(n), body: bodyOf(n), labels: [], state: closed(n) ? "closed" : "open", html_url: `${GH.web}/issues/${n}`, comments: commentCount(n),
    created_at: "2026-10-01T08:00:00Z", closed_at: closed(n) ? "2026-10-05T08:00:00Z" : null };
}
const GH_PULL = { number: 150, title: "A pull request", body: "", labels: [], state: "open", html_url: `${GH.web}/pull/150`, comments: 0, pull_request: {}, created_at: "2026-10-03T08:00:00Z", closed_at: null };
function glIssue(n) {
  return { iid: n, title: titleOf(n), description: bodyOf(n), labels: [], state: closed(n) ? "closed" : "opened", web_url: `${GL.web}/-/issues/${n}`, user_notes_count: commentCount(n),
    created_at: "2026-10-01T08:00:00Z", closed_at: closed(n) ? "2026-10-05T08:00:00Z" : null };
}
const commentsOf = (n, forge) => Array.from({ length: commentCount(n) }, (_, i) => (forge === GH
  ? { user: { login: "dana" }, body: `Comment ${i + 1} on ${n}.`, created_at: "2026-10-06T09:00:00Z" }
  : { author: { username: "dana" }, body: `Comment ${i + 1} on ${n}.`, created_at: "2026-10-06T09:00:00Z", system: false }));

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The fake of one server: the requests it received, noted as { method, path, query }, and its answers.
function serverOf(forge) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const request = { method: String(init.method ?? "GET").toUpperCase(), path: url.pathname, query: Object.fromEntries(url.searchParams) };
    requests.push(request);
    const { path, query } = request;
    const one = new RegExp(`^${forge.prefix}/issues/(\\d+)$`).exec(path), many = new RegExp(`^${forge.prefix}/issues/(\\d+)/${forge.comments}$`).exec(path);
    if (forge === GH) {
      if (path === `${forge.prefix}/issues`) {
        const state = query.state ?? "open";
        return json(200, pageOf([...NUMBERS.filter((n) => wanted(state, n)).map(ghIssue), ...(state === "closed" ? [] : [GH_PULL])].sort((a, b) => a.number - b.number), query));
      }
      if (path === "/search/issues") {
        const q = String(query.q ?? "");
        const state = /state:(\w+)/.exec(q)?.[1] ?? "all", term = q.split(" ").at(-1).toLowerCase();
        return json(200, { total_count: 0, items: pageOf(NUMBERS.filter((n) => wanted(state, n) && titleOf(n).toLowerCase().includes(term)).map(ghIssue), query) });
      }
      if (many) return json(200, pageOf(commentsOf(Number(many[1]), GH), query));
      if (one) {
        const n = Number(one[1]);
        if (n === 150) return json(200, GH_PULL);
        if (n === 140) return json(410, { message: "This issue was deleted" });
        return NUMBERS.includes(n) ? json(200, ghIssue(n)) : json(404, { message: "Not Found" });
      }
      return json(404, { message: `unrouted: ${path}` });
    }
    if (path === `${forge.prefix}/issues`) {
      const state = query.state === "opened" ? "open" : query.state ?? "all";
      const term = (query.search ?? "").toLowerCase();
      return json(200, pageOf(NUMBERS.filter((n) => wanted(state, n) && titleOf(n).toLowerCase().includes(term)).map(glIssue), query));
    }
    if (many) return json(200, pageOf(commentsOf(Number(many[1]), GL), query));
    if (one) return NUMBERS.includes(Number(one[1])) ? json(200, glIssue(Number(one[1]))) : json(404, { message: "404 Not found" });
    return json(404, { message: `unrouted: ${path}` });
  };
  return { requests, fetch };
}
async function using(server, run) {
  const real = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try { return await run(); } finally { globalThis.fetch = real; }
}
const hostOf = (forge) => connect(parseAddress(forge.web), { token: forge.token });
const failure = (promise) => Promise.resolve(promise).then(() => null, (problem) => problem);
const isComment = (forge) => (request) => new RegExp(`/issues/\\d+/${forge.comments}$`).test(request.path);
const isListing = (forge) => (request) => request.path === `${forge.prefix}/issues` || request.path === "/search/issues";
const lineOf = (request) => `${request.method} ${request.path}${request.query.page ? ` p${request.query.page}` : ""}`;

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// The page: a route drawn over the product's real host. The instance's host is a stand-in that holds no participant, so that no run panel is offered.
function contextOf(forge, host) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const instance = { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return { commit: "1".repeat(40), paths: [], read: async () => null, readMany: async () => {}, blob: () => null }; } };
  return { page: "review", instance: { repository: "northwind/hub", host: instance }, product: { address: forge.web, kind: forge.kind, host, tokenStored: true }, store: openStore("northwind/hub"), go() {} };
}
const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
};
const byClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
async function draw(forge, server, name, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await using(server, async () => {
    await routeNamed(name).render(target, contextOf(forge, hostOf(forge)), params);
    for (let n = 0; n < 200 && !byClass(target, name === "issues" ? "issue-list" : "issue-meta").length && !byClass(target, name === "issues" ? "issues-problem" : "issue-problem").length; n += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return target;
}

// TST-1270301 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: a tracker of 120 open issues, 31 of them with comments (the issue 7 with 101), one closed issue, and a number that is a pull request or a merge request; on GitHub, where the issue list holds that pull request too, and on a GitLab server in turn; a fake of fetch that records every request; for the known positive, the same host asked for the open issues without the option
// input: the route issues drawn
// expect: all 120 open issues are listed, each with its number, and no pull request among them; the server received exactly two requests, the pages 1 and 2 of the issue list, and none for the comments or notes of any issue; known positive: listIssues({ state: "open" }) of the same host sends 32 requests for comments — one for each of the 30 issues with one comment, and two for the issue 7
// Planted fault: a list that reads the open issues with their comments (`comments: false` left out of the call in renderList of src/maintenance-pages/issues.mjs) sends 32 comment requests; one that reads the pages of the list one after the other with a request per issue, or lists the closed issue, fails the listing.
test("TST-1270301 the list of open issues asks for the pages of the list and for no comment, on GitHub and on GitLab", async () => {
  for (const forge of [GH, GL]) {
    const probe = serverOf(forge);
    await using(probe, () => hostOf(forge).listIssues({ state: "open" }));
    assert.equal(probe.requests.filter(isComment(forge)).length, 32, `${forge.label}, known positive: the default reads the comments`);

    const server = serverOf(forge);
    const target = await draw(forge, server, "issues");
    const listed = byClass(target, "issue").map((node) => node.getAttribute("data-issue"));
    assert.deepEqual(listed, Array.from({ length: 120 }, (_, i) => String(i + 1)), forge.label);
    assert.deepEqual(server.requests.filter(isComment(forge)), [], `${forge.label}: no comment is asked for`);
    assert.deepEqual(server.requests.map(lineOf), [`GET ${forge.prefix}/issues p1`, `GET ${forge.prefix}/issues p2`], forge.label);
  }
});

// TST-1270302 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: the tracker of TST-1270301, in which the issue 7 has 101 comments, the issue 130 is closed with 2 comments and the issue 5 has none
// input: the route issue drawn for the number 7, then for 130, then for 5, each over a fresh fake
// expect: the page shows the issue's text, "Text of issue <n>."; the server received no request for the issue list and none for any other issue: for 7 the issue and then its comments (GitHub) or notes (GitLab) in pages 1 and 2; for 130 the issue and its comments, page 1; for 5 the issue alone, with no request for comments; the closed issue 130 is shown, as "Closed"
// Planted fault: a page that finds its issue in a listing (`listIssues({ state: "all" })` and a filter in renderIssue of src/maintenance-pages/issues.mjs) sends the issue list and the comments of every commented issue; a read of the comments that asks for page 1 only fails the 101 comments of the issue 7; one that asks for comments of an issue with none fails the issue 5.
test("TST-1270302 a page of one issue reads that issue by its number and its comments by page, and asks for no listing", async () => {
  for (const forge of [GH, GL]) {
    for (const [number, expected] of [[7, [`GET ${forge.prefix}/issues/7`, `GET ${forge.prefix}/issues/7/${forge.comments} p1`, `GET ${forge.prefix}/issues/7/${forge.comments} p2`]],
      [130, [`GET ${forge.prefix}/issues/130`, `GET ${forge.prefix}/issues/130/${forge.comments} p1`]], [5, [`GET ${forge.prefix}/issues/5`]]]) {
      const server = serverOf(forge);
      const target = await draw(forge, server, "issue", { number: String(number) });
      assert.equal(byClass(target, "issue-text")[0]?.textContent, bodyOf(number), `${forge.label} #${number}`);
      assert.match(byClass(target, "issue-meta")[0]?.textContent ?? "", number === 130 ? /^Closed/ : /^Open/, `${forge.label} #${number}`);
      assert.deepEqual(server.requests.map(lineOf), expected, `${forge.label} #${number}`);
      assert.deepEqual(server.requests.filter(isListing(forge)), [], `${forge.label} #${number}: no listing`);
    }
  }
});

// TST-1270303 · level: release · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-012
// given: the tracker of TST-1270301; the number 150, which is a pull request on GitHub and a merge request on GitLab, the number 999, which nothing has, and, on GitHub, the number 140, which the server reports as deleted (410); the issue 8 for the known positive
// input: readIssue of 150, of 999 and, on GitHub, of 140; the route issue drawn for each of them; readIssue of 8
// expect: each readIssue fails with a failure named NotFound, and no request for comments or notes goes out; the page of each says "Issue <n> is not in this product." and no issue text; known positive: readIssue(8) gives the issue 8, titled "Export is slow", with its one comment, in the issue's request and one request for its comments
// Planted fault: a readIssue that gives the pull request as an issue (the `if (i.pull_request) notFound()` of github.mjs left out) returns the pull request on GitHub; one that lets the 410 pass as a failure of another name (the `on: { 410: notFound }` left out) fails the number 140; a page that shows the failure of a number as a problem (the `failure?.name !== "NotFound"` test of renderIssue left out) shows "The issue could not be read".
test("TST-1270303 a pull request's number, a merge request's and a number nothing has are NotFound, and the page says the issue is not in the product", async () => {
  for (const forge of [GH, GL]) {
    const numbers = forge === GH ? [150, 999, 140] : [150, 999];
    for (const number of numbers) {
      const server = serverOf(forge);
      const problem = await using(server, () => failure(hostOf(forge).readIssue(number)));
      assert.equal(problem?.name, "NotFound", `${forge.label} #${number}: ${problem?.message}`);
      assert.deepEqual(server.requests.filter(isComment(forge)), [], `${forge.label} #${number}`);
      const page = await draw(forge, serverOf(forge), "issue", { number: String(number) });
      assert.equal(byClass(page, "issue-problem")[0]?.textContent, `Issue ${number} is not in this product.`, `${forge.label} #${number}`);
      assert.deepEqual(byClass(page, "issue-text"), [], `${forge.label} #${number}`);
    }
    const known = serverOf(forge);
    const issue = await using(known, () => hostOf(forge).readIssue(8));
    assert.equal(issue.title, "Export is slow", `${forge.label}, known positive`);
    assert.deepEqual(issue.comments.map((comment) => comment.body), ["Comment 1 on 8."], forge.label);
    assert.deepEqual(known.requests.map(lineOf), [`GET ${forge.prefix}/issues/8`, `GET ${forge.prefix}/issues/8/${forge.comments} p1`], forge.label);
  }
});

// TST-1270304 · level: release · module: MOD-repository-hosts
// guards: UC-012
// given: the tracker of TST-1270301, read through the real host of GitHub and of GitLab
// input: listIssues({ state: "open" }), listIssues({ state: "open", comments: true }) and listIssues({ state: "open", comments: false }); the same three with state "all"; and with the search text "export", which finds the issues 7 and 8
// expect: the first two give the same 120 issues, the issue 7 with 101 comments, the issue 8 with 1 and the issue 5 with none, and send 32 requests for comments — the issues 4, 8, 12 … 120 once each and the issue 7 twice —; the third gives the same issues, all with empty comments, and sends none; with state "all" the closed issue 130 is added, with its 2 comments by default and none with comments false; with the search text, the issues 7 and 8 with 101 and 1 comments by default (3 requests) and with none on false; but for their comments each issue listed with comments false equals the one listed without the option
// Planted fault: a default that reads no comment (`comments = false` for `comments = true` in listIssues of src/repository-hosts/index.mjs) gives the issue 7 no comments and sends none; a `comments: false` that is read only when the search is not used, or only for state open, sends comment requests in the other cases; one that leaves some other field out of the issue (the labels, the dates) fails the equality.
test("TST-1270304 listIssues without the option reads the comments as before, and with comments false asks for none and gives the same issues", async () => {
  const stripped = (issues) => issues.map(({ comments, ...rest }) => rest);
  for (const forge of [GH, GL]) {
    for (const filter of [{ state: "open" }, { state: "all" }, { state: "open", search: "export" }]) {
      const results = {};
      for (const [what, option] of [["default", {}], ["true", { comments: true }], ["false", { comments: false }]]) {
        const server = serverOf(forge);
        results[what] = { issues: await using(server, () => hostOf(forge).listIssues({ ...filter, ...option })), asked: server.requests.filter(isComment(forge)) };
      }
      const name = `${forge.label} ${JSON.stringify(filter)}`;
      const counts = Object.fromEntries(results.default.issues.map((issue) => [issue.number, issue.comments.length]));
      if (filter.search) assert.deepEqual(counts, { 7: 101, 8: 1 }, name);
      else {
        assert.equal(results.default.issues.length, filter.state === "all" ? 121 : 120, name);
        assert.deepEqual([counts[5], counts[7], counts[8], counts[130]], [0, 101, 1, filter.state === "all" ? 2 : undefined], name);
      }
      assert.deepEqual(results.true.issues, results.default.issues, name);
      assert.equal(results.default.asked.length, filter.search ? 3 : filter.state === "all" ? 33 : 32, name);
      assert.equal(results.true.asked.length, results.default.asked.length, name);
      assert.deepEqual(results.false.asked, [], `${name}: comments false asks for none`);
      assert.ok(results.false.issues.every((issue) => issue.comments.length === 0), name);
      assert.deepEqual(stripped(results.false.issues), stripped(results.default.issues), `${name}: the same issues but for their comments`);
    }
  }
});
