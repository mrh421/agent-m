// MOD-repository-hosts' listPullRequests asks the pages of a listing at once (ITM-1252), as the accepted text of docs/architecture/MOD-repository-hosts.md states it:
// "listPullRequests(filter: { state?: "open" | "merged" | "closed" | "all", branch?: string }) -> Promise<PullRequest[]> — the pages of a listing are asked for at once, once the
// server has said how many there are, never one after the other." The filter has no `updatedSince` (ITM-1260), and its cases went with it.
// Deterministic, no network: the servers are fakes of `fetch` that answer as the real APIs document, and that count how many requests are in flight at once —
//   GitHub — docs.github.com/en/rest/pulls/pulls "List pull requests" (state open | closed | all, sort created | updated, direction asc | desc, per_page up to 100, page; the
//     `Link` response header names the next and the last page, rel="next" and rel="last", docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api).
//   GitLab — docs.gitlab.com/api/merge_requests/ "List project merge requests" (state, per_page, page) and docs.gitlab.com/api/rest/#pagination-link-header (X-Total-Pages,
//     X-Next-Page).
// Run: node --test tests/repository-hosts-pull-request-pages.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-035; UC-032; A PAGE LOAD READS THE REPOSITORY IN BATCHES; A REMOTE INTERFACE NAMES HOW IT FAILS
// Level: unit
//
// Where the texts leave a reading open, the test states the one it takes: the pull requests come in the order the server lists them, page after page. Each test states its input and its expected result before it runs (given / input / expect). Counter-proof, recorded in the commit: the `everyPage`
// of today, which asks page 2 only once page 1 has come, keeps one request in flight and fails the first case of each server.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GH_TOKEN = "github_pat_CAROLsprintTOOL0123456789abcdef";
const GL_TOKEN = "glpat-SPACEsprintTOOLvalue0123456789";
const GITHUB = parseAddress("https://github.com/carol/sprint-tool");
const GITLAB = parseAddress("https://gitlab.example.org/space/sprint-tool");
const GH = "/repos/carol/sprint-tool";
const GL = "/api/v4/projects/space%2Fsprint-tool";

const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...headers } });

// A fake server: `answer(url)` gives the Response; every request is recorded with the number of requests in flight when it was sent, and the most in flight at once is kept.
async function serving(answer, run) {
  const requests = [], real = globalThis.fetch;
  let inFlight = 0, most = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    inFlight += 1;
    most = Math.max(most, inFlight);
    requests.push({ url, inFlight });
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return answer(url);
    } finally { inFlight -= 1; }
  };
  try { return { result: await run(), requests, most: () => most }; } finally { globalThis.fetch = real; }
}

// ---------------------------------------------------------------- GitHub

// 1,370 pull requests, numbered 1 to 1370 in the order they were created: the newest three are open, the others closed — every fourth merged. Pull request n was last
// updated on 2026-08-01 plus a day for every ten.
const ghPull = (n, total) => {
  const open = n > total - 3, merged = !open && n % 4 === 0;
  const updated = new Date(Date.parse("2026-08-01T00:00:00Z") + Math.floor(n / 10) * 86_400_000 % (70 * 86_400_000)).toISOString();
  return { number: n, title: `Pull ${n}`, state: open ? "open" : "closed", draft: false, html_url: `https://github.com/carol/sprint-tool/pull/${n}`, created_at: "2026-08-01T00:00:00Z",
    updated_at: updated, body: "", merged_at: merged ? "2026-08-02T00:00:00Z" : null, merge_commit_sha: merged ? "f".repeat(40) : null, closed_at: open ? null : "2026-08-02T00:00:00Z",
    head: { ref: `feature-${n}`, sha: "2".repeat(40) }, base: { ref: "main", sha: "b".repeat(40) } };
};
function github(total) {
  const all = Array.from({ length: total }, (_, i) => ghPull(total - i, total)); // newest first, as GitHub lists them by default
  return (url) => {
    const q = url.searchParams;
    assert.equal(url.pathname, `${GH}/pulls`, `a request this fake does not serve: ${url.href}`);
    const state = q.get("state") ?? "open", per = Number(q.get("per_page") ?? 30), page = Number(q.get("page") ?? 1);
    let list = all.filter((p) => state === "all" || p.state === state);
    if (q.get("sort") === "updated") list = [...list].sort((a, b) => (q.get("direction") === "asc" ? 1 : -1) * a.updated_at.localeCompare(b.updated_at));
    const last = Math.max(1, Math.ceil(list.length / per));
    const at = (n) => { const next = new URL(url); next.searchParams.set("page", String(n)); return next.href; };
    const link = last > 1 ? [...(page < last ? [`<${at(page + 1)}>; rel="next"`, `<${at(last)}>; rel="last"`] : []), ...(page > 1 ? [`<${at(1)}>; rel="first"`, `<${at(page - 1)}>; rel="prev"`] : [])].join(", ") : "";
    return json(list.slice((page - 1) * per, page * per), link ? { Link: link } : {});
  };
}

// TST-1252001 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032
// given: a GitHub repository with 1,370 pull requests — 14 pages of 100, the last of 70 —, whose Link header names the last page
// input: listPullRequests()
// expect: 14 requests of /pulls with state=all: page 1 first and alone, then pages 2 to 14 together — at least 13 in flight at once —; all 1,370 returned, in the order the server lists them (1370 first, 1 last), none twice
test("listPullRequests on GitHub — page 1, then every other page at once", async () => {
  const host = connect(GITHUB, { token: GH_TOKEN });
  const { result, requests, most } = await serving(github(1370), () => host.listPullRequests());
  assert.equal(requests.length, 14, requests.map((r) => r.url.search).join(" "));
  assert.deepEqual([requests[0].url.searchParams.get("page"), requests[0].inFlight], ["1", 1], "page 1 is asked first, alone");
  assert.deepEqual(requests.slice(1).map((r) => Number(r.url.searchParams.get("page"))).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 2));
  assert.ok(requests.every((r) => r.url.searchParams.get("state") === "all" && r.url.searchParams.get("per_page") === "100"));
  assert.ok(most() >= 13, `pages 2 to 14 are in flight together: at most ${most()} were`);
  assert.equal(result.length, 1370);
  assert.deepEqual([result[0].number, result[99].number, result[100].number, result.at(-1).number], [1370, 1271, 1270, 1]);
  assert.equal(new Set(result.map((p) => p.number)).size, 1370);
});

// ---------------------------------------------------------------- GitLab

const glMr = (iid, total) => {
  const open = iid > total - 3, merged = !open && iid % 4 === 0;
  return { iid, title: `Merge ${iid}`, state: open ? "opened" : merged ? "merged" : "closed", draft: false, web_url: `https://gitlab.example.org/space/sprint-tool/-/merge_requests/${iid}`,
    created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-15T00:00:00.000Z", description: "", merged_at: merged ? "2026-08-02T00:00:00.000Z" : null,
    closed_at: open || merged ? null : "2026-08-02T00:00:00.000Z", source_branch: `feature-${iid}`, target_branch: "main", sha: "2".repeat(40), merge_commit_sha: merged ? "f".repeat(40) : null };
};
function gitlab(total) {
  const all = Array.from({ length: total }, (_, i) => glMr(total - i, total));
  return (url) => {
    assert.equal(url.pathname, `${GL}/merge_requests`, `a request this fake does not serve: ${url.href}`);
    const q = url.searchParams, state = q.get("state") ?? "all", per = Number(q.get("per_page") ?? 20), page = Number(q.get("page") ?? 1);
    const list = all.filter((m) => state === "all" || m.state === state);
    const pages = Math.max(1, Math.ceil(list.length / per));
    return json(list.slice((page - 1) * per, page * per), { "X-Total": String(list.length), "X-Total-Pages": String(pages), "X-Per-Page": String(per), "X-Page": String(page),
      "X-Next-Page": page < pages ? String(page + 1) : "" });
  };
}

// TST-1252003 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032
// given: a GitLab project with 1,370 merge requests, 14 pages of 100, whose X-Total-Pages says so
// input: listPullRequests()
// expect: 14 requests of /merge_requests with state=all: page 1 first and alone, then pages 2 to 14 together — at least 13 in flight at once —; all 1,370 returned, in the order the server lists them, none twice
test("listPullRequests on GitLab — page 1, then every other page at once", async () => {
  const host = connect(GITLAB, { token: GL_TOKEN });
  const { result, requests, most } = await serving(gitlab(1370), () => host.listPullRequests());
  assert.equal(requests.length, 14, requests.map((r) => r.url.search).join(" "));
  assert.deepEqual([requests[0].url.searchParams.get("page"), requests[0].inFlight], ["1", 1], "page 1 is asked first, alone");
  assert.deepEqual(requests.slice(1).map((r) => Number(r.url.searchParams.get("page"))).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 2));
  assert.ok(requests.every((r) => r.url.searchParams.get("state") === "all" && r.url.searchParams.get("per_page") === "100"));
  assert.ok(most() >= 13, `pages 2 to 14 are in flight together: at most ${most()} were`);
  assert.equal(result.length, 1370);
  assert.deepEqual([result[0].number, result.at(-1).number], [1370, 1]);
  assert.equal(new Set(result.map((p) => p.number)).size, 1370);
});
