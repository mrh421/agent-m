// Module: MOD-repository-hosts
// MOD-repository-hosts' readHistory (ITM-309), as the accepted text of docs/architecture/MOD-repository-hosts.md states it:
// "readHistory(path: string | null, options: { ref?: string, limit?: number, changes?: boolean }) -> Promise<HistoryEntry[]> — the commits that
// changed a path, or the repository, newest first. With `changes: false`, each entry's `changes` is empty and the history costs one request per
// page of commits; otherwise each entry lists its changes. Crosses the network; fails as readSnapshot", a HistoryEntry being { commit,
// parents, author: { account, name }, date, message, changes: { path, change, from? }[] }. Through GitHub's and GitLab's REST
// APIs. Deterministic, no network: the servers are fakes of `fetch` that answer as the real APIs document —
// GitHub: "List commits" (GET /repos/{owner}/{repo}/commits: sha, path, per_page up to 100, page; the author a user or an empty
// object where the commit's e-mail is linked to no account) and "Get a commit" (GET /repos/{owner}/{repo}/commits/{ref}: the
// files of the commit, up to 300 and the rest on further pages, per_page up to 100 and page accepted, each file with its status
// — added, removed, modified, renamed — and, for a rename, previous_filename) (docs.github.com/en/rest/commits/commits, read
// 2026-10-11);
// GitLab: "List repository commits" (GET /projects/:id/repository/commits: ref_name, path, follow, per_page — default 20, up to
// 100 —, page; id, message, author_name, author_email, committed_date, parent_ids — no account; and `follow`, which since
// GitLab 18.10 defaults to true: "follows file renames when filtering commits by path, and returns commits for the file even
// if it was renamed", `false` "returns only commits where the file existed at its current path"; docs.gitlab.com/api/commits
// and docs.gitlab.com/api/rest/#pagination, read 2026-10-11) and the diff of a commit (GET
// /projects/:id/repository/commits/:sha/diff: old_path, new_path, new_file, renamed_file, deleted_file, paged by per_page and
// page: gitlab.com/gitlab-org/gitlab/-/issues/423565, read 2026-10-11).
// Run: node --test tests/repository-hosts-history.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-007; UC-008; UC-018; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; A REQUIREMENT SHOWS ITS HISTORY; THE NAME IS THE ID AND IT SURVIVES; A REMOTE INTERFACE NAMES HOW IT FAILS; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// One history serves every test: five commits of a repository, oldest first, by Alice, Bob and Carol — Carol's e-mail linked to
// no account — , in which UC-001's file is renamed. readHistory gives the commits that changed the path it is asked for: GitHub
// lists "only commits containing this file path"; a GitLab server that follows a file across a rename unless it is told not to
// (`follow`, true by default) would also list the commits before the rename, which changed the earlier path — the fake GitLab
// follows by default, so that the adapter has to ask for the commits of the path itself. A GitLab server names no account for an
// author, and both servers give the date a commit was committed, which is not always the date its author gave it. Each test
// states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseAddress, connect, HostError } from "../src/repository-hosts/index.mjs";

// ---------------------------------------------------------------- the fake servers

// One request as a server sees it: method, address, headers with their names in lower case, the query, and the JSON body.
function seen(input, init = {}) {
  const isRequest = typeof input === "object" && !(input instanceof URL);
  const url = new URL(isRequest ? input.url : String(input));
  const raw = init.headers ?? (isRequest ? input.headers : {}) ?? {};
  const headers = raw instanceof Headers ? Object.fromEntries(raw.entries())
    : Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v)]));
  let body = null;
  if (typeof init.body === "string") { try { body = JSON.parse(init.body); } catch { body = init.body; } }
  return { method: String(init.method ?? (isRequest ? input.method : "GET")).toUpperCase(), url, href: url.href,
    origin: url.origin, path: url.pathname, query: Object.fromEntries(url.searchParams), headers, body };
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status,
  headers: { "Content-Type": "application/json", ...headers } });

// Runs `run` with `fetchFn` in place of the platform's fetch.
async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}
// The failure a promise ends in, or null when it does not fail.
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);

const GH_WEB = "https://github.com/carol/release-tool";
const GH_API = "https://api.github.com";
const GH_PREFIX = "/repos/carol/release-tool";
const GH_TOKEN = "github_pat_CAROLreleaseTOOL0123456789abcdef";
const GH_TOKENS = "https://github.com/settings/personal-access-tokens";

const GL_ORIGIN = "https://gitlab.example.org";
const GL_WEB = `${GL_ORIGIN}/space/release-tool`;
const GL_PREFIX = "/api/v4/projects/space%2Frelease-tool";
const GL_TOKEN = "glpat-SPACEreleaseTOOLvalue0123456789";
const GL_TOKENS = `${GL_WEB}/-/settings/access_tokens`;

const GITHUB = parseAddress(GH_WEB);
const GITLAB = parseAddress(GL_WEB);

// ---------------------------------------------------------------- the history the servers hold

const hash = (text) => createHash("sha1").update(text).digest("hex");
const ALICE = { login: "alice-dev", name: "Alice Example", email: "alice@example.org" };
const BOB = { login: "bob-b", name: "Bob Builder", email: "bob@example.org" };
const CAROL = { login: null, name: "Carol Nolog", email: "carol@example.net" };

// One commit of a history: its changes as readHistory reports them; `authored` is the date its author gave it, `committed` the
// date it was committed. chain() sets the parents of a history that is written oldest first.
const commit = (n, author, committed, message, changes, authored = committed) =>
  ({ sha: hash(`commit ${n}`), author, authored, committed, message, changes });
const chain = (commits) => commits.map((c, i) => ({ ...c, parents: i ? [commits[i - 1].sha] : [] }));

const FIRST = "docs/use-cases/UC-001-first.md", RENAMED = "docs/use-cases/UC-001-the-first.md";
const SECOND = "docs/use-cases/UC-002-second.md";
const HISTORY = chain([
  commit(1, ALICE, "2026-09-01T09:00:00Z", "Add the first use case", [
    { path: "README.md", change: "added" }, { path: "SPEC.md", change: "added" }, { path: FIRST, change: "added" }]),
  commit(2, BOB, "2026-09-02T10:30:00Z", "Reword UC-001\n\nThe goal is one sentence now.", [{ path: FIRST, change: "modified" }]),
  commit(3, ALICE, "2026-09-03T08:15:00Z", "Add UC-002", [{ path: "SPEC.md", change: "modified" }, { path: SECOND, change: "added" }]),
  commit(4, ALICE, "2026-09-04T16:45:00Z", "Rename UC-001's file", [{ path: RENAMED, change: "renamed", from: FIRST }],
    "2026-09-04T09:00:00Z"),
  commit(5, CAROL, "2026-09-05T12:00:00Z", "Reword UC-001 again", [
    { path: "README.md", change: "deleted" }, { path: "SPEC.md", change: "modified" }, { path: RENAMED, change: "modified" }]),
]);
const [C1, C2, C3, C4, C5] = HISTORY;

// What readHistory gives for commits of a history, newest first: on GitHub the author's account is the login the server names;
// a GitLab server names none.
const entry = (c, account) => ({ commit: c.sha, parents: c.parents, author: { account, name: c.author.name }, date: c.committed,
  message: c.message, changes: c.changes });
const onGitHub = (...commits) => commits.map((c) => entry(c, c.author.login));
const onGitLab = (...commits) => commits.map((c) => entry(c, null));

// The commits of `history` that a server lists, newest first: those reachable from `ref` — a commit's id, or the default
// branch's name where none is given — that touched `path` itself or, for a folder, anything below it, a rename touching the path
// it went to and the path it left; null for a ref it does not know. Where `follow` is set, a file is followed across a rename:
// the commits before it, which changed the path it came from, are listed too.
function listed(history, ref, path, follow = false) {
  const start = ref === undefined || ref === "main" ? history.length - 1 : history.findIndex((c) => c.sha === ref);
  if (start < 0) return null;
  const newestFirst = history.slice(0, start + 1).reverse();
  if (path === undefined) return newestFirst;
  const names = new Set([path]);
  const within = (p) => p !== undefined && [...names].some((n) => p === n || p.startsWith(`${n}/`));
  return newestFirst.filter((c) => {
    const touched = c.changes.filter((ch) => within(ch.path) || within(ch.from));
    if (follow) for (const ch of touched) if (ch.change === "renamed" && names.has(ch.path)) names.add(ch.from);
    return touched.length > 0;
  });
}
const page = (items, query, byDefault, most) => {
  const per = Math.min(most, Number(query.per_page ?? byDefault)), n = Number(query.page ?? 1);
  return { per, n, items: items.slice((n - 1) * per, n * per), more: n * per < items.length };
};

// A GitHub repository holding `history`, answering "List commits" and "Get a commit" as GitHub does. answer(request): a canned
// answer in place of the usual one, for any request — used to inject a refused token, a missing repository or a used-up limit.
function fakeGitHub({ history = HISTORY, answer = null } = {}) {
  const requests = [];
  const server = { requests, listRequests: () => requests.filter((r) => r.path === `${GH_PREFIX}/commits`),
    detailRequests: () => requests.filter((r) => /\/commits\/[0-9a-f]{40}$/.test(r.path)) };
  const notFound = () => json(404, { message: "Not Found", documentation_url: "https://docs.github.com/rest", status: "404" });
  const status = { added: "added", modified: "modified", deleted: "removed", renamed: "renamed" };
  const listing = (c) => ({ sha: c.sha, node_id: `C_${c.sha.slice(0, 12)}`, url: `${GH_API}${GH_PREFIX}/commits/${c.sha}`,
    html_url: `${GH_WEB}/commit/${c.sha}`,
    commit: { author: { name: c.author.name, email: c.author.email, date: c.authored },
      committer: { name: "GitHub", email: "noreply@github.com", date: c.committed }, message: c.message,
      tree: { sha: hash(`tree ${c.sha}`), url: `${GH_API}${GH_PREFIX}/git/trees/${hash(`tree ${c.sha}`)}` }, comment_count: 0 },
    author: c.author.login ? { login: c.author.login, type: "User" } : {}, committer: { login: "web-flow", type: "User" },
    parents: c.parents.map((p) => ({ sha: p, url: `${GH_API}${GH_PREFIX}/commits/${p}`, html_url: `${GH_WEB}/commit/${p}` })) });
  const file = (ch) => ({ sha: hash(ch.path), filename: ch.path, status: status[ch.change], additions: 1, deletions: 0, changes: 1,
    blob_url: `${GH_WEB}/blob/main/${ch.path}`, raw_url: `${GH_WEB}/raw/main/${ch.path}`, contents_url: `${GH_API}${GH_PREFIX}/contents/${ch.path}`,
    patch: "@@ -0,0 +1 @@\n+x", ...(ch.from ? { previous_filename: ch.from } : {}) });
  server.fetch = async (input, init = {}) => {
    const r = seen(input, init);
    requests.push(r);
    const own = answer?.(r);
    if (own) return own;
    const auth = r.headers.authorization ?? null;
    if (auth !== null && auth !== `Bearer ${GH_TOKEN}`) return json(401, { message: "Bad credentials", status: "401" });
    if (r.origin !== GH_API || !r.path.startsWith(GH_PREFIX)) return notFound();
    const rest = r.path.slice(GH_PREFIX.length);
    let m;
    // "List commits": newest first, 30 to a page unless per_page says otherwise, at most 100; the author an empty object where
    // the commit's e-mail is linked to no account.
    if (r.method === "GET" && rest === "/commits") {
      const all = listed(history, r.query.sha, r.query.path);
      if (all === null) return json(404, { message: `No commit found for SHA: ${r.query.sha}`, status: "404" });
      return json(200, page(all, r.query, 30, 100).items.map(listing));
    }
    // "Get a commit": the commit again, with the files it changed, 300 to a page unless per_page says less, at most 100.
    if (r.method === "GET" && (m = /^\/commits\/([0-9a-f]{40})$/.exec(rest))) {
      const c = history.find((x) => x.sha === m[1]);
      if (!c) return notFound();
      return json(200, { ...listing(c), stats: { additions: c.changes.length, deletions: 0, total: c.changes.length },
        files: page(c.changes, r.query, 300, 300).items.map(file) });
    }
    return notFound();
  };
  return server;
}

// A GitLab project holding `history`, answering "List repository commits" and the diff of a commit as a GitLab server does.
function fakeGitLab({ history = HISTORY, answer = null } = {}) {
  const requests = [];
  const server = { requests, listRequests: () => requests.filter((r) => r.path === `${GL_PREFIX}/repository/commits`),
    detailRequests: () => requests.filter((r) => /\/repository\/commits\/[0-9a-f]{40}\/diff$/.test(r.path)) };
  const listing = (c) => ({ id: c.sha, short_id: c.sha.slice(0, 8), title: c.message.split("\n")[0], message: c.message,
    author_name: c.author.name, author_email: c.author.email, authored_date: c.authored, committer_name: c.author.name,
    committer_email: c.author.email, committed_date: c.committed, created_at: c.committed, parent_ids: c.parents,
    web_url: `${GL_WEB}/-/commit/${c.sha}` });
  const diff = (ch) => ({ old_path: ch.from ?? ch.path, new_path: ch.path, a_mode: "100644", b_mode: "100644", diff: "@@ -0,0 +1 @@\n+x",
    new_file: ch.change === "added", renamed_file: ch.change === "renamed", deleted_file: ch.change === "deleted" });
  const headers = (p) => ({ "X-Page": String(p.n), "X-Per-Page": String(p.per), "X-Next-Page": p.more ? String(p.n + 1) : "" });
  server.fetch = async (input, init = {}) => {
    const r = seen(input, init);
    requests.push(r);
    const own = answer?.(r);
    if (own) return own;
    const token = r.headers["private-token"] ?? null;
    if (token !== null && token !== GL_TOKEN) return json(401, { message: "401 Unauthorized" });
    if (r.origin !== GL_ORIGIN || !r.path.startsWith(GL_PREFIX)) return json(404, { message: "404 Not Found" });
    const rest = r.path.slice(GL_PREFIX.length);
    let m;
    // "List repository commits": newest first (reverse chronological), 20 to a page unless per_page says otherwise, at most 100;
    // a single file followed across renames unless `follow` is false.
    if (r.method === "GET" && rest === "/repository/commits") {
      const all = listed(history, r.query.ref_name, r.query.path, r.query.follow !== "false");
      if (all === null) return json(404, { message: "404 Commit Not Found" });
      const p = page(all, r.query, 20, 100);
      return json(200, p.items.map(listing), headers(p));
    }
    // The diff of a commit: one entry for each file, 20 to a page unless per_page says otherwise, at most 100.
    if (r.method === "GET" && (m = /^\/repository\/commits\/([0-9a-f]{40})\/diff$/.exec(rest))) {
      const c = history.find((x) => x.sha === m[1]);
      if (!c) return json(404, { message: "404 Commit Not Found" });
      const p = page(c.changes, r.query, 20, 100);
      return json(200, p.items.map(diff), headers(p));
    }
    return json(404, { message: "404 Not Found" });
  };
  return server;
}

// Runs `read` once against a fake GitHub holding `history` and once against a fake GitLab holding it: [what GitHub gave, what
// GitLab gave, the two fakes]. read(host).
async function onBoth(read, history = HISTORY) {
  const gh = fakeGitHub({ history }), gl = fakeGitLab({ history });
  const fromGitHub = await using(gh.fetch, () => read(connect(GITHUB, { token: GH_TOKEN })));
  const fromGitLab = await using(gl.fetch, () => read(connect(GITLAB, { token: GL_TOKEN })));
  return [fromGitHub, fromGitLab, { gh, gl }];
}

// ---------------------------------------------------------------- a file's commits

// TST-472541 · level: unit · module: MOD-repository-hosts
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; A REQUIREMENT SHOWS ITS HISTORY
// given: the history of five commits above; SPEC.md was added in the first, changed in the third and the fifth; the fourth commit was authored a day before it was committed; Carol, the fifth's author, has no account
// input: readHistory("SPEC.md", {}) on a GitHub repository and on a GitLab project; then readHistory("SPEC.md", { ref }) with the third commit's id as ref
// expect: the fifth, third and first commit, in that order, each { commit, parents, author: { account, name }, date, message, changes }: the parents the server names (none for the first); the author's name, and on GitHub the account — null for Carol —, on GitLab null; the date it was committed; the whole message; and every file the commit changed, added, modified or deleted, in the order the server lists them. With the third commit as ref: the third and the first only
test("MOD-repository-hosts readHistory — the commits of a file, newest first, each with its parents, author, date, message and changes (GitHub, GitLab)", async () => {
  const [gh, gl] = await onBoth((host) => host.readHistory("SPEC.md", {}));
  assert.deepEqual(gh, onGitHub(C5, C3, C1), "GitHub");
  assert.deepEqual(gl, onGitLab(C5, C3, C1), "GitLab");
  assert.deepEqual(gh[2].parents, [], "known positive: the first commit has no parent");

  const [ghFrom, glFrom] = await onBoth((host) => host.readHistory("SPEC.md", { ref: C3.sha }));
  assert.deepEqual(ghFrom, onGitHub(C3, C1), "GitHub, from the third commit");
  assert.deepEqual(glFrom, onGitLab(C3, C1), "GitLab, from the third commit");
});

// ---------------------------------------------------------------- a rename

// TST-472542 · level: unit · module: MOD-repository-hosts
// guards: THE NAME IS THE ID AND IT SURVIVES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above, in which the fourth commit renames docs/use-cases/UC-001-first.md to UC-001-the-first.md; the commits before it changed the earlier path, and a GitLab server follows a file across a rename unless it is told not to
// input: readHistory of the new path on GitHub and on GitLab
// expect: the fifth and the fourth commit, not the second and the first, which changed the earlier path; the fourth's one change { path: the new path, change: "renamed", from: the earlier path }, and the fifth's change of the file plain "modified", with no `from`
test("MOD-repository-hosts readHistory — a rename carries the path it came from (GitHub, GitLab)", async () => {
  const [gh, gl] = await onBoth((host) => host.readHistory(RENAMED, {}));
  assert.deepEqual(gh, onGitHub(C5, C4), "GitHub");
  assert.deepEqual(gl, onGitLab(C5, C4), "GitLab");
  for (const [label, entries] of [["GitHub", gh], ["GitLab", gl]]) {
    assert.deepEqual(entries[1].changes, [{ path: RENAMED, change: "renamed", from: FIRST }], `${label}: the rename and its earlier path`);
    assert.ok(!("from" in entries[0].changes.find((c) => c.path === RENAMED)), `${label}: a change that is no rename has no earlier path`);
  }
});

// ---------------------------------------------------------------- limit

// TST-472543 · level: unit · module: MOD-repository-hosts
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above; and a history of 130 commits, each adding a file of its own
// input: readHistory(null, { limit: 2 }) and readHistory("SPEC.md", { limit: 1 }) on the first; readHistory(null, { limit: 120 }) on the second, on GitHub and on GitLab
// expect: the two newest commits of the repository and the newest of SPEC.md's, each as above, and the changes of those only read — two commits' worth of requests for the first, one for the second; for the 130 commits, the 120 newest, in order, whichever number of commits a server lists to a page
test("MOD-repository-hosts readHistory — limit is honoured, across pages too (GitHub, GitLab)", async () => {
  const [gh, gl, { gh: ghServer, gl: glServer }] = await onBoth((host) => host.readHistory(null, { limit: 2 }));
  assert.deepEqual(gh, onGitHub(C5, C4), "GitHub: the two newest");
  assert.deepEqual(gl, onGitLab(C5, C4), "GitLab: the two newest");
  assert.equal(ghServer.detailRequests().length, 2, "GitHub: the changes of the two commits only");
  assert.equal(glServer.detailRequests().length, 2, "GitLab: the changes of the two commits only");

  const [ghOne, glOne] = await onBoth((host) => host.readHistory("SPEC.md", { limit: 1 }));
  assert.deepEqual(ghOne, onGitHub(C5), "GitHub: the newest commit of a file");
  assert.deepEqual(glOne, onGitLab(C5), "GitLab: the newest commit of a file");

  const long = chain(Array.from({ length: 130 }, (_, i) => commit(1000 + i, ALICE, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()
    .replace(".000Z", "Z"), `Change ${i + 1}`, [{ path: `notes/n${String(i + 1).padStart(3, "0")}.md`, change: "added" }])));
  const newest = [...long].reverse().slice(0, 120);
  const [ghLong, glLong] = await onBoth((host) => host.readHistory(null, { limit: 120 }), long);
  assert.deepEqual(ghLong, onGitHub(...newest), "GitHub: the 120 newest of 130, across two pages of the list");
  assert.deepEqual(glLong, onGitLab(...newest), "GitLab: the 120 newest of 130, across two pages of the list");
});

// ---------------------------------------------------------------- the repository, and many files

// TST-472544 · level: unit · module: MOD-repository-hosts
// guards: A REQUIREMENT SHOWS ITS HISTORY; THE NAME IS THE ID AND IT SURVIVES
// given: the history above; and a repository whose only commit adds 250 files
// input: readHistory(null, {}) on the first; readHistory(null, {}) on the second, on GitHub and on GitLab
// expect: all five commits, newest first, each as above — the first's three files, the fourth's rename, the fifth's deletion; for the 250 files, the commit's 250 changes, whichever number of files a server gives to a page
test("MOD-repository-hosts readHistory — a null path gives the history of the repository, a commit of many files all its changes (GitHub, GitLab)", async () => {
  const [gh, gl] = await onBoth((host) => host.readHistory(null, {}));
  assert.deepEqual(gh, onGitHub(C5, C4, C3, C2, C1), "GitHub: the repository's history");
  assert.deepEqual(gl, onGitLab(C5, C4, C3, C2, C1), "GitLab: the repository's history");

  const bulk = chain([commit(2000, BOB, "2026-09-10T08:00:00Z", "Add the generated files",
    Array.from({ length: 250 }, (_, i) => ({ path: `generated/g${String(i + 1).padStart(3, "0")}.md`, change: "added" })))]);
  const [ghBulk, glBulk] = await onBoth((host) => host.readHistory(null, {}), bulk);
  assert.deepEqual(ghBulk, onGitHub(bulk[0]), "GitHub: all 250 changes");
  assert.deepEqual(glBulk, onGitLab(bulk[0]), "GitLab: all 250 changes");
  assert.equal(ghBulk[0].changes.length, 250, "known positive: the fixture commit changed 250 files");
});

// ---------------------------------------------------------------- changes: false

// The request counts below are of GitHub's fake; the expected numbers are stated in each test's own text (ITM-916).
const emptied = (entries) => entries.map((e) => ({ ...e, changes: [] }));

// TST-916001 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the history of five commits above on a GitHub repository, read with a token; SPEC.md was changed by the first, third and fifth commit
// input: readHistory("SPEC.md", { changes: false }) and readHistory(null, { changes: false }); for contrast readHistory("SPEC.md", {}) and readHistory("SPEC.md", { changes: true }), each on a fake of its own
// expect: with changes false, the entries of the commits as without it but every `changes` an empty list; the requests: 1 "List commits" and no "Get a commit" for the file's 3 commits, 1 and none for the repository's 5. Known positive: without the option, and with `changes: true`, the same fake counts 1 "List commits" and 3 "Get a commit", and the entries carry their changes
test("MOD-repository-hosts readHistory — changes: false sends one request for the commits and none for their changes (GitHub)", async () => {
  const run = async (path, options) => {
    const gh = fakeGitHub();
    const entries = await using(gh.fetch, () => connect(GITHUB, { token: GH_TOKEN }).readHistory(path, options));
    return { entries, list: gh.listRequests().length, detail: gh.detailRequests().length, all: gh.requests.length };
  };
  const file = await run("SPEC.md", { changes: false });
  assert.deepEqual(file.entries, emptied(onGitHub(C5, C3, C1)), "the file's commits, changes empty");
  assert.deepEqual([file.list, file.detail, file.all], [1, 0, 1], "the file: 1 list, no detail, 1 request");
  const repository = await run(null, { changes: false });
  assert.deepEqual(repository.entries, emptied(onGitHub(C5, C4, C3, C2, C1)), "the repository's commits, changes empty");
  assert.deepEqual([repository.list, repository.detail, repository.all], [1, 0, 1], "the repository: 1 list, no detail, 1 request");

  for (const [label, options] of [["no option", {}], ["changes true", { changes: true }]]) {
    const read = await run("SPEC.md", options);
    assert.deepEqual(read.entries, onGitHub(C5, C3, C1), `known positive, ${label}: the changes are listed`);
    assert.deepEqual([read.list, read.detail, read.all], [1, 3, 4], `known positive, ${label}: 1 list and 3 details`);
  }
});

// TST-916002 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a repository of 130 commits that each add a file, and one whose only commit adds 250 files (a commit whose changes take three pages of "Get a commit")
// input: readHistory(null, { limit: 120, changes: false }) and readHistory(null, { limit: 1, changes: false }) on the first; readHistory(null, { changes: false }) on the second
// expect: the 120 newest commits, in order, each with empty changes, for 2 requests — one for each of the two pages of 100 commits the 120 span — and no "Get a commit"; the newest commit for 1 request; the 250-file commit with empty changes for 1 request, not the 3 that its changes take
test("MOD-repository-hosts readHistory — changes: false costs one request for each page of commits, however many commits or files there are (GitHub)", async () => {
  const long = chain(Array.from({ length: 130 }, (_, i) => commit(1000 + i, ALICE, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()
    .replace(".000Z", "Z"), `Change ${i + 1}`, [{ path: `notes/n${String(i + 1).padStart(3, "0")}.md`, change: "added" }])));
  const newest = [...long].reverse();
  const many = async (history, options) => {
    const gh = fakeGitHub({ history });
    const entries = await using(gh.fetch, () => connect(GITHUB, { token: GH_TOKEN }).readHistory(null, options));
    return { entries, list: gh.listRequests().length, detail: gh.detailRequests().length, all: gh.requests.length };
  };
  const spanning = await many(long, { limit: 120, changes: false });
  assert.deepEqual(spanning.entries, emptied(onGitHub(...newest.slice(0, 120))), "the 120 newest, changes empty");
  assert.deepEqual([spanning.list, spanning.detail, spanning.all], [2, 0, 2], "2 pages of commits, no detail");
  const one = await many(long, { limit: 1, changes: false });
  assert.deepEqual(one.entries, emptied(onGitHub(newest[0])), "the newest commit, changes empty");
  assert.deepEqual([one.list, one.detail, one.all], [1, 0, 1], "1 request");

  const bulk = chain([commit(2000, BOB, "2026-09-10T08:00:00Z", "Add the generated files",
    Array.from({ length: 250 }, (_, i) => ({ path: `generated/g${String(i + 1).padStart(3, "0")}.md`, change: "added" })))]);
  const wide = await many(bulk, { changes: false });
  assert.deepEqual(wide.entries, emptied(onGitHub(bulk[0])), "the commit of 250 files, changes empty");
  assert.deepEqual([wide.list, wide.detail, wide.all], [1, 0, 1], "1 request, not 3 more for the pages of its changes");
  const read = await many(bulk, {});
  assert.deepEqual([read.detail, read.entries[0].changes.length], [3, 250], "known positive: without the option the same commit takes 3 detail requests and lists 250 changes");
});

// TST-916003 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: a GitHub repository that lists the commits well and answers every "Get a commit" with a used-up rate limit (403, X-RateLimit-Remaining 0)
// input: readHistory("SPEC.md", { changes: false }); and readHistory("SPEC.md", {})
// expect: the first gives the 3 commits with empty changes, since no commit's changes are asked for; the second fails with RateLimited (known positive: the fake refuses what it is asked)
test("MOD-repository-hosts readHistory — changes: false asks for no commit's changes, so a server that refuses them does not fail it (GitHub)", async () => {
  const limited = { "X-RateLimit-Limit": "5000", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1790000000" };
  const refusing = () => fakeGitHub({ answer: (r) => (/\/commits\/[0-9a-f]{40}$/.test(r.path) ? json(403, { message: "API rate limit exceeded" }, limited) : null) });
  const without = refusing();
  const entries = await using(without.fetch, () => connect(GITHUB, { token: GH_TOKEN }).readHistory("SPEC.md", { changes: false }));
  assert.deepEqual(entries, emptied(onGitHub(C5, C3, C1)));
  assert.equal(without.listRequests().length, 1, "the list was read");
  const reading = await using(refusing().fetch, () => failure(connect(GITHUB, { token: GH_TOKEN }).readHistory("SPEC.md", {})));
  assert.equal(reading?.name, "RateLimited", "known positive: reading the changes meets the refusal");
});

// TST-928001 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the history of five commits above on a GitLab project, read with a token; SPEC.md was changed by the first, third and fifth commit
// input: readHistory("SPEC.md", { changes: false }) and readHistory(null, { changes: false }); for contrast readHistory("SPEC.md", {}) and readHistory("SPEC.md", { changes: true }), each on a fake of its own
// expect: with changes false, the entries of the commits as without it but every `changes` an empty list; the requests: 1 "List repository commits" and no diff for the file's 3 commits, 1 and none for the repository's 5. Known positive: without the option, and with `changes: true`, the same fake counts 1 list and 3 diff requests, and the entries carry their changes
test("MOD-repository-hosts readHistory — changes: false sends one request for the commits and none for their changes (GitLab)", async () => {
  const run = async (path, options) => {
    const gl = fakeGitLab();
    const entries = await using(gl.fetch, () => connect(GITLAB, { token: GL_TOKEN }).readHistory(path, options));
    return { entries, list: gl.listRequests().length, detail: gl.detailRequests().length, all: gl.requests.length };
  };
  const file = await run("SPEC.md", { changes: false });
  assert.deepEqual(file.entries, emptied(onGitLab(C5, C3, C1)), "the file's commits, changes empty");
  assert.deepEqual([file.list, file.detail, file.all], [1, 0, 1], "the file: 1 list, no diff, 1 request");
  const repository = await run(null, { changes: false });
  assert.deepEqual(repository.entries, emptied(onGitLab(C5, C4, C3, C2, C1)), "the repository's commits, changes empty");
  assert.deepEqual([repository.list, repository.detail, repository.all], [1, 0, 1], "the repository: 1 list, no diff, 1 request");

  for (const [label, options] of [["no option", {}], ["changes true", { changes: true }]]) {
    const read = await run("SPEC.md", options);
    assert.deepEqual(read.entries, onGitLab(C5, C3, C1), `known positive, ${label}: the changes are listed`);
    assert.deepEqual([read.list, read.detail, read.all], [1, 3, 4], `known positive, ${label}: 1 list and 3 diffs`);
  }
});

// TST-928002 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a GitLab project of 130 commits that each add a file, and one whose only commit adds 250 files (a commit whose diff takes three pages)
// input: readHistory(null, { limit: 120, changes: false }) and readHistory(null, { limit: 1, changes: false }) on the first; readHistory(null, { changes: false }) on the second
// expect: the 120 newest commits, in order, each with empty changes, for 2 requests — one for each of the two pages of 100 commits the 120 span — and no diff; the newest commit for 1 request; the 250-file commit with empty changes for 1 request, not the 3 more that reading its diff takes. Known positive: without the option that commit takes 3 diff requests and lists 250 changes
test("MOD-repository-hosts readHistory — changes: false costs one request for each page of commits, however many commits or files there are (GitLab)", async () => {
  const long = chain(Array.from({ length: 130 }, (_, i) => commit(1000 + i, ALICE, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()
    .replace(".000Z", "Z"), `Change ${i + 1}`, [{ path: `notes/n${String(i + 1).padStart(3, "0")}.md`, change: "added" }])));
  const newest = [...long].reverse();
  const many = async (history, options) => {
    const gl = fakeGitLab({ history });
    const entries = await using(gl.fetch, () => connect(GITLAB, { token: GL_TOKEN }).readHistory(null, options));
    return { entries, list: gl.listRequests().length, detail: gl.detailRequests().length, all: gl.requests.length };
  };
  const spanning = await many(long, { limit: 120, changes: false });
  assert.deepEqual(spanning.entries, emptied(onGitLab(...newest.slice(0, 120))), "the 120 newest, changes empty");
  assert.deepEqual([spanning.list, spanning.detail, spanning.all], [2, 0, 2], "2 pages of commits, no diff");
  const one = await many(long, { limit: 1, changes: false });
  assert.deepEqual(one.entries, emptied(onGitLab(newest[0])), "the newest commit, changes empty");
  assert.deepEqual([one.list, one.detail, one.all], [1, 0, 1], "1 request");

  const bulk = chain([commit(2000, BOB, "2026-09-10T08:00:00Z", "Add the generated files",
    Array.from({ length: 250 }, (_, i) => ({ path: `generated/g${String(i + 1).padStart(3, "0")}.md`, change: "added" })))]);
  const wide = await many(bulk, { changes: false });
  assert.deepEqual(wide.entries, emptied(onGitLab(bulk[0])), "the commit of 250 files, changes empty");
  assert.deepEqual([wide.list, wide.detail, wide.all], [1, 0, 1], "1 request, not more for the pages of its diff");
  const read = await many(bulk, {});
  assert.deepEqual([read.detail, read.entries[0].changes.length], [3, 250], "known positive: without the option the same commit takes 3 diff requests and lists 250 changes");
});

// TST-928003 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: a GitLab project that lists the commits well and answers every diff of a commit with a used-up rate limit (429)
// input: readHistory("SPEC.md", { changes: false }); and readHistory("SPEC.md", {})
// expect: the first gives the 3 commits with empty changes, since no commit's diff is asked for; the second fails with RateLimited (known positive: the fake refuses what it is asked)
test("MOD-repository-hosts readHistory — changes: false asks for no commit's diff, so a server that refuses it does not fail it (GitLab)", async () => {
  const refusing = () => fakeGitLab({ answer: (r) => (/\/repository\/commits\/[0-9a-f]{40}\/diff$/.test(r.path) ? json(429, { message: "Retry later" }) : null) });
  const without = refusing();
  const entries = await using(without.fetch, () => connect(GITLAB, { token: GL_TOKEN }).readHistory("SPEC.md", { changes: false }));
  assert.deepEqual(entries, emptied(onGitLab(C5, C3, C1)));
  assert.equal(without.listRequests().length, 1, "the list was read");
  const reading = await using(refusing().fetch, () => failure(connect(GITLAB, { token: GL_TOKEN }).readHistory("SPEC.md", {})));
  assert.equal(reading?.name, "RateLimited", "known positive: reading the diff meets the refusal");
});

// ---------------------------------------------------------------- a path no commit touched

// TST-472545 · level: unit · module: MOD-repository-hosts
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above; docs/use-cases/UC-002-second.md was added in the third commit, docs/missing.md was never in it
// input: readHistory of each path, on GitHub and on GitLab
// expect: the third commit alone for UC-002's file — the known positive —; an empty list for the path no commit touched, not an error
test("MOD-repository-hosts readHistory — a path no commit touched gives an empty list (GitHub, GitLab)", async () => {
  const [ghKnown, glKnown] = await onBoth((host) => host.readHistory(SECOND, {}));
  assert.deepEqual(ghKnown, onGitHub(C3), "GitHub, known positive");
  assert.deepEqual(glKnown, onGitLab(C3), "GitLab, known positive");
  const [gh, gl] = await onBoth((host) => host.readHistory("docs/missing.md", {}));
  assert.deepEqual(gh, [], "GitHub");
  assert.deepEqual(gl, [], "GitLab");
});

// ---------------------------------------------------------------- the module's named failures

// TST-472546 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: servers that answer every request with a refused token (401), with no such repository (404), with a used-up rate limit (GitHub: 403 with X-RateLimit-Remaining 0; GitLab: 429), with a 502 or with no answer at all — a fetch that fails as a browser's does —; and servers that list the commits well and then use up the limit on the first commit's changes
// input: readHistory("SPEC.md", {}) on each; readHistory(null, { ref: "no-such-branch" }) on the missing repository
// expect: HostError TokenRefused naming the token and the page where it is renewed; NotFound naming the repository and the branch; RateLimited naming the account's limit and, on GitHub, when it resets; Unreachable with the server's status or the browser's reason; and RateLimited, not a list of the commits read so far, for the limit used up on the changes
test("MOD-repository-hosts readHistory — a refused token, a missing repository, a used-up rate limit and an unreachable server are the module's named failures (GitHub, GitLab)", async () => {
  const RESET = 1790000000;
  const ghHost = () => connect(GITHUB, { token: GH_TOKEN, tokenName: "GitHub token" });
  const glHost = () => connect(GITLAB, { token: GL_TOKEN, tokenName: "GitLab project token" });
  const limited = { "X-RateLimit-Limit": "5000", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(RESET) };
  const detail = /\/commits\/[0-9a-f]{40}(\/diff)?$/;

  const ghRefused = await using(fakeGitHub({ answer: () => json(401, { message: "Bad credentials" }) }).fetch,
    () => failure(ghHost().readHistory("SPEC.md", {})));
  assert.ok(ghRefused instanceof HostError, `a HostError, not ${ghRefused}`);
  assert.deepEqual([ghRefused.name, ghRefused.tokenName, ghRefused.renewal], ["TokenRefused", "GitHub token", GH_TOKENS], "GitHub");
  const glRefused = await using(fakeGitLab({ answer: () => json(401, { message: "401 Unauthorized" }) }).fetch,
    () => failure(glHost().readHistory("SPEC.md", {})));
  assert.deepEqual([glRefused?.name, glRefused?.tokenName, glRefused?.renewal], ["TokenRefused", "GitLab project token", GL_TOKENS], "GitLab");

  const ghMissing = await using(fakeGitHub({ answer: () => json(404, { message: "Not Found" }) }).fetch,
    () => failure(ghHost().readHistory(null, { ref: "no-such-branch" })));
  assert.equal(ghMissing?.name, "NotFound", "GitHub");
  assert.ok(/release-tool/.test(String(ghMissing?.what)) && /no-such-branch/.test(String(ghMissing?.what)), `GitHub: the repository and the branch are named: ${ghMissing?.what}`);
  const glMissing = await using(fakeGitLab({ answer: () => json(404, { message: "404 Project Not Found" }) }).fetch,
    () => failure(glHost().readHistory(null, { ref: "no-such-branch" })));
  assert.equal(glMissing?.name, "NotFound", "GitLab");
  assert.ok(/release-tool/.test(String(glMissing?.what)) && /no-such-branch/.test(String(glMissing?.what)), `GitLab: the repository and the branch are named: ${glMissing?.what}`);

  const ghLimited = await using(fakeGitHub({ answer: () => json(403, { message: "API rate limit exceeded for user ID 1." }, limited) }).fetch,
    () => failure(ghHost().readHistory("SPEC.md", {})));
  assert.deepEqual([ghLimited?.name, ghLimited?.limit, ghLimited?.resetsAt?.getTime()], ["RateLimited", "account", RESET * 1000], "GitHub");
  const glLimited = await using(fakeGitLab({ answer: () => json(429, { message: "Retry later" }, { "Retry-After": "60" }) }).fetch,
    () => failure(glHost().readHistory("SPEC.md", {})));
  assert.deepEqual([glLimited?.name, glLimited?.limit], ["RateLimited", "account"], "GitLab");

  const ghBad = await using(fakeGitHub({ answer: () => json(502, { message: "Bad Gateway" }) }).fetch, () => failure(ghHost().readHistory("SPEC.md", {})));
  assert.ok(ghBad?.name === "Unreachable" && /502/.test(ghBad.reason), `GitHub: Unreachable with the status: ${ghBad?.name} ${ghBad?.reason}`);
  const glBad = await using(fakeGitLab({ answer: () => json(502, { message: "Bad Gateway" }) }).fetch, () => failure(glHost().readHistory("SPEC.md", {})));
  assert.ok(glBad?.name === "Unreachable" && /502/.test(glBad.reason), `GitLab: Unreachable with the status: ${glBad?.name} ${glBad?.reason}`);
  const offline = async () => { throw new TypeError("Failed to fetch"); };
  for (const [label, host] of [["GitHub", ghHost()], ["GitLab", glHost()]]) {
    const e = await using(offline, () => failure(host.readHistory("SPEC.md", {})));
    assert.deepEqual([e instanceof HostError, e?.name, e?.reason], [true, "Unreachable", "Failed to fetch"], `${label}: the browser's reason is given`);
  }

  // The limit used up on the changes of the first commit, after the list was read: no list of the commits read so far.
  const ghLate = fakeGitHub({ answer: (r) => (detail.test(r.path) ? json(403, { message: "API rate limit exceeded" }, limited) : null) });
  const ghLateFailure = await using(ghLate.fetch, () => failure(ghHost().readHistory("SPEC.md", {})));
  assert.equal(ghLate.listRequests().length, 1, "known positive: GitHub, the list was read first");
  assert.equal(ghLateFailure?.name, "RateLimited", "GitHub: the limit used up on the changes");
  const glLate = fakeGitLab({ answer: (r) => (detail.test(r.path) ? json(429, { message: "Retry later" }) : null) });
  const glLateFailure = await using(glLate.fetch, () => failure(glHost().readHistory("SPEC.md", {})));
  assert.equal(glLate.listRequests().length, 1, "known positive: GitLab, the list was read first");
  assert.equal(glLateFailure?.name, "RateLimited", "GitLab: the limit used up on the changes");
});
