// The repository hosts (src/repository-hosts/) — what UC-001 needs of GitHub and of a GitLab server: parseAddress, connect, and
// the host's repositoryInfo, readSnapshot, commitFiles and webLinks, with the failures the module file names for them (ITM-205).
// Deterministic, no network: the servers are fakes of `fetch` that answer as GitHub's REST API and GitLab's REST API v4 answer —
// the recorded responses below —; no request leaves the process.
//
// Module: MOD-repository-hosts
// Guards: A PRODUCT IS NAMED BY ITS ADDRESS; GITLAB PRODUCTS ARE SUPPORTED; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; THE TOKEN LINK IS PREFILLED; ONE GITHUB TOKEN SERVES EVERY FEATURE; THE REPOSITORY CHOICE IS SPELLED OUT; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; NO SECRET IN THE REPOSITORY; UC-001
// Level: unit
//
// Each test states its expected result in the comment above it, before it runs. The answers are the ones GitHub's REST API
// documents ("Get a repository", "Get a commit", "Get a tree", "Get repository content", "Get a reference", "Create a blob",
// "Create a tree", "Create a commit", "Update a reference" — 422 "Update is not a fast forward" —, "Rate limits for the REST API")
// and GitLab's REST API v4 ("Get a single project", "Get a single commit", "List repository tree", "Get raw file from
// repository", "Get file from repository", "Get single repository branch", "Create a commit with multiple files and actions" —
// 400 "The file has changed since you started editing it" —, "Rate limits").

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseAddress, connect, HostError } from "../src/repository-hosts/index.mjs";

// ---------------------------------------------------------------- the fake servers

const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const blobSha = (buf) => createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
const utf8 = (t) => Buffer.from(t, "utf8");

// One request as a server sees it: method, address, headers with their names in lower case, and the JSON body.
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
const text = (status, body, headers = {}) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });

// Runs `run` with `fetchFn` in place of the platform's fetch.
async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}
// The failure a promise ends in, or null when it does not fail.
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
// Every place a request could carry a credential: its address, each header, its body.
const carries = (r, secret) => r.href.includes(secret) || Object.values(r.headers).some((v) => v.includes(secret))
  || JSON.stringify(r.body ?? "").includes(secret);

const FILES = {
  "README.md": "# thesis-tool\n",
  "SPEC.md": "# Thesis tool — Specification\n\nUmlaute äöü ✓\n",
  "docs/use-cases/UC-001-write-a-thesis.md": "---\nid: UC-001\n---\n# UC-001 Write a thesis\n",
  "docs/old.md": "to be removed\n",
};

const GH_WEB = "https://github.com/alice/thesis-tool";
const GH_API = "https://api.github.com", GH_RAW = "https://raw.githubusercontent.com";
const GH_TOKEN = "github_pat_ALICEthesisTOOL0123456789abcdef";
const GH_TOKENS = "https://github.com/settings/personal-access-tokens";

// GitHub with one repository, alice/thesis-tool, and its branch main. visibility: "public" or "private". reaches: whether the
// token reaches the repository — a fine-grained token reads every public repository, and writes only to those selected for it.
// before(request, server): called as each request arrives, before it is answered. answer(request): an answer of its own, or
// nothing for the usual one.
// empty: the repository has no commit yet — GitHub's Git database answers 409 "Git Repository is empty." until a file is created
// through the contents API, which makes the first commit (measured 2026-10-06; "Using the REST API to interact with your Git
// database").
function fakeGitHub({ visibility = "private", files = FILES, reaches = true, before = null, answer = null, empty = false } = {}) {
  const requests = [], blobs = new Map(), trees = new Map(), commits = new Map();
  let made = 0;
  const store = (buf) => { const s = blobSha(buf); blobs.set(s, buf); return s; };
  const addTree = (map) => { const t = sha1(`tree ${JSON.stringify(Object.entries(map).sort())}`); trees.set(t, map); return t; };
  const addCommit = (parent, map, message) => {
    const tree = addTree(map), sha = sha1(`commit ${parent} ${tree} ${message} ${commits.size}`);
    commits.set(sha, { parent, tree, message });
    return sha;
  };
  let head = empty ? null : addCommit(null, Object.fromEntries(Object.entries(files).map(([p, t]) => [p, store(utf8(t))])), "initial");
  const filesAt = (sha) => Object.fromEntries(Object.entries(trees.get(commits.get(sha).tree)).map(([p, b]) => [p, blobs.get(b)]));
  const server = {
    requests, head: () => head, filesAt, parentOf: (sha) => commits.get(sha)?.parent ?? null,
    messageOf: (sha) => commits.get(sha)?.message ?? null, made: () => made,
    // Someone else's commit on main: { path: text } changes a file, { path: null } removes it -> the new head.
    push(changes) {
      const map = { ...trees.get(commits.get(head).tree) };
      for (const [p, t] of Object.entries(changes)) { if (t === null) delete map[p]; else map[p] = store(utf8(t)); }
      head = addCommit(head, map, "someone else's change");
      return head;
    },
  };
  const isPublic = visibility === "public";
  const resolve = (ref) => (ref === "main" ? head : commits.has(ref) ? ref : null);
  const notFound = () => json(404, { message: "Not Found", documentation_url: "https://docs.github.com/rest", status: "404" });
  server.fetch = async (input, init = {}) => {
    const r = seen(input, init);
    requests.push(r);
    if (before) await before(r, server);
    const own = answer?.(r);
    if (own) return own;
    const auth = r.headers.authorization ?? null;
    if (auth !== null && auth !== `Bearer ${GH_TOKEN}`) return json(401, { message: "Bad credentials", status: "401" });
    const authed = auth !== null, sees = isPublic || (authed && reaches), writes = authed && reaches;
    if (r.origin === GH_RAW) {
      const [, owner, name, ref, ...file] = r.path.split("/").map(decodeURIComponent);
      const at = owner === "alice" && name === "thesis-tool" && isPublic ? resolve(ref) : null;
      const blob = at && trees.get(commits.get(at).tree)[file.join("/")];
      return blob ? text(200, blobs.get(blob)) : text(404, "404: Not Found");
    }
    const prefix = "/repos/alice/thesis-tool";
    if (r.origin !== GH_API || !(r.path === prefix || r.path.startsWith(`${prefix}/`)) || !sees) return notFound();
    const rest = r.path.slice(prefix.length);
    if (r.method !== "GET" && !writes) {
      return isPublic ? json(403, { message: "Resource not accessible by personal access token", status: "403" }) : notFound();
    }
    let m;
    if (head === null && (rest === "/commits" || rest.startsWith("/commits/") || rest.startsWith("/git/"))) {
      return json(409, { message: "Git Repository is empty.", documentation_url: "https://docs.github.com/rest", status: "409" });
    }
    if (r.method === "PUT" && (m = /^\/contents\/(.+)$/.exec(rest))) {
      const path = m[1].split("/").map(decodeURIComponent).join("/");
      if (head !== null) return json(422, { message: "Invalid request. \"sha\" wasn't supplied.", status: "422" });
      head = addCommit(null, { [path]: store(Buffer.from(r.body.content, "base64")) }, r.body.message);
      made += 1;
      return json(201, { content: { path, sha: trees.get(commits.get(head).tree)[path] },
        commit: { sha: head, html_url: `${GH_WEB}/commit/${head}`, message: r.body.message } });
    }
    if (r.method === "GET" && rest === "") {
      return json(200, { id: 1296269, name: "thesis-tool", full_name: "alice/thesis-tool", private: !isPublic, visibility,
        html_url: GH_WEB, description: "A tool for theses", archived: false, default_branch: "main",
        ...(authed ? { permissions: { admin: reaches, maintain: reaches, push: reaches, triage: reaches, pull: true } } : {}) });
    }
    if (r.method === "GET" && (m = /^\/commits\/(.+)$/.exec(rest))) {
      const at = resolve(decodeURIComponent(m[1]));
      return at ? json(200, { sha: at, commit: { tree: { sha: commits.get(at).tree }, message: commits.get(at).message } })
        : json(422, { message: `No commit found for SHA: ${decodeURIComponent(m[1])}`, status: "422" });
    }
    if (r.method === "GET" && (m = /^\/git\/trees\/(.+)$/.exec(rest))) {
      const key = decodeURIComponent(m[1]), at = resolve(key), tree = at ? commits.get(at).tree : trees.has(key) ? key : null;
      if (!tree) return notFound();
      const map = trees.get(tree), dirs = new Set();
      for (const p of Object.keys(map)) p.split("/").slice(0, -1).forEach((_, i, a) => dirs.add(a.slice(0, i + 1).join("/")));
      const entries = [...[...dirs].map((p) => ({ path: p, mode: "040000", type: "tree", sha: sha1(`dir ${p}`) })),
        ...Object.entries(map).map(([p, b]) => ({ path: p, mode: "100644", type: "blob", sha: b, size: blobs.get(b).length }))]
        .sort((a, b) => (a.path < b.path ? -1 : 1));
      return json(200, { sha: tree, tree: entries, truncated: false });
    }
    if (r.method === "GET" && (m = /^\/contents\/(.+)$/.exec(rest))) {
      const at = resolve(r.query.ref ?? "main"), path = m[1].split("/").map(decodeURIComponent).join("/");
      const blob = at && trees.get(commits.get(at).tree)[path];
      if (!blob) return notFound();
      return /raw/.test(r.headers.accept ?? "") ? text(200, blobs.get(blob))
        : json(200, { type: "file", path, sha: blob, encoding: "base64", content: blobs.get(blob).toString("base64") });
    }
    if (r.method === "GET" && (m = /^\/git\/blobs\/([0-9a-f]{40})$/.exec(rest))) {
      return blobs.has(m[1]) ? json(200, { sha: m[1], size: blobs.get(m[1]).length, encoding: "base64",
        content: blobs.get(m[1]).toString("base64") }) : notFound();
    }
    if (r.method === "GET" && (m = /^\/git\/ref\/heads\/(.+)$/.exec(rest))) {
      return decodeURIComponent(m[1]) === "main"
        ? json(200, { ref: "refs/heads/main", object: { sha: head, type: "commit" } }) : notFound();
    }
    if (r.method === "GET" && (m = /^\/git\/commits\/([0-9a-f]{40})$/.exec(rest))) {
      const c = commits.get(m[1]);
      return c ? json(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parent ? [{ sha: c.parent }] : [], message: c.message })
        : notFound();
    }
    if (r.method === "POST" && rest === "/git/blobs") {
      const buf = r.body.encoding === "base64" ? Buffer.from(r.body.content, "base64") : utf8(r.body.content);
      return json(201, { sha: store(buf) });
    }
    if (r.method === "POST" && rest === "/git/trees") {
      if (r.body.base_tree && !trees.has(r.body.base_tree)) return json(422, { message: "Invalid tree info", status: "422" });
      const map = { ...(r.body.base_tree ? trees.get(r.body.base_tree) : {}) };
      for (const e of r.body.tree) {
        if (e.content !== undefined) map[e.path] = store(utf8(e.content));
        else if (e.sha === null) delete map[e.path];
        else if (blobs.has(e.sha)) map[e.path] = e.sha;
        else return json(422, { message: "Invalid tree info", status: "422" });
      }
      return json(201, { sha: addTree(map) });
    }
    if (r.method === "POST" && rest === "/git/commits") {
      const parents = r.body.parents ?? [];
      if (!trees.has(r.body.tree) || parents.length !== 1 || !commits.has(parents[0])) return json(422, { message: "Invalid", status: "422" });
      const sha = sha1(`commit ${parents[0]} ${r.body.tree} ${r.body.message} ${commits.size}`);
      commits.set(sha, { parent: parents[0], tree: r.body.tree, message: r.body.message });
      made += 1;
      return json(201, { sha, html_url: `${GH_WEB}/commit/${sha}`, message: r.body.message, parents: [{ sha: parents[0] }] });
    }
    if (r.method === "PATCH" && (m = /^\/git\/refs\/heads\/(.+)$/.exec(rest))) {
      if (decodeURIComponent(m[1]) !== "main" || !commits.has(r.body.sha)) return json(422, { message: "Reference does not exist", status: "422" });
      let c = r.body.sha;
      while (c && c !== head) c = commits.get(c).parent;
      if (!c && r.body.force !== true) return json(422, { message: "Update is not a fast forward", status: "422" });
      head = r.body.sha;
      return json(200, { ref: "refs/heads/main", object: { sha: head, type: "commit" } });
    }
    return notFound();
  };
  return server;
}

const GL_ORIGIN = "https://gitlab.example.org";
const GL_WEB = `${GL_ORIGIN}/grp/sub/thesis-tool`;
const GL_API = `${GL_ORIGIN}/api/v4/projects/grp%2Fsub%2Fthesis-tool`;
const GL_TOKEN = "glpat-TEAMthesisTOOLvalue0123456789";
const GL_TOKENS = `${GL_WEB}/-/settings/access_tokens`;

// A GitLab server with one project, grp/sub/thesis-tool, and its protected branch main. visibility: "public", "internal" or
// "private". level: the access level the project token acts with (30 Developer, 40 Maintainer). description: the project's.
// Each file of each commit knows the commit that last changed it. The history: a first commit holds every file but README.md,
// the head adds README.md — so that the head is not the last commit of the other files. A commit with update, move, delete or
// chmod actions is refused when an action's file changed on the branch since its `last_commit_id`: GitLab compares the last
// commit of the file as of `last_commit_id` with its last commit on the branch now, and checks nothing without one
// (app/services/files/multi_service.rb validate_file_status!, base_service.rb file_has_changed?). before and answer as above.
function fakeGitLab({ visibility = "private", files = FILES, level = 40, description = "A tool for theses", before = null,
  answer = null } = {}) {
  const requests = [], commits = new Map();
  let made = 0;
  const first = sha1("gitlab first commit");
  commits.set(first, { parent: null, message: "first", files: Object.fromEntries(Object.entries(files)
    .filter(([p]) => p !== "README.md").map(([p, t]) => [p, { buf: utf8(t), last: first }])) });
  const second = sha1("gitlab second commit");
  commits.set(second, { parent: first, message: "add the README", files: { ...commits.get(first).files,
    ...("README.md" in files ? { "README.md": { buf: utf8(files["README.md"]), last: second } } : {}) } });
  let head = second;
  const server = {
    requests, head: () => head, made: () => made, parentOf: (sha) => commits.get(sha)?.parent ?? null,
    messageOf: (sha) => commits.get(sha)?.message ?? null,
    filesAt: (sha) => Object.fromEntries(Object.entries(commits.get(sha).files).map(([p, f]) => [p, f.buf])),
    push(changes) {
      const map = { ...commits.get(head).files }, sha = sha1(`gitlab push ${head} ${commits.size}`);
      for (const [p, t] of Object.entries(changes)) { if (t === null) delete map[p]; else map[p] = { buf: utf8(t), last: sha }; }
      commits.set(sha, { parent: head, files: map, message: "someone else's change" });
      head = sha;
      return head;
    },
  };
  const resolve = (ref) => (ref === "main" ? head : commits.has(ref) ? ref : null);
  const prefix = "/api/v4/projects/grp%2Fsub%2Fthesis-tool";
  server.fetch = async (input, init = {}) => {
    const r = seen(input, init);
    requests.push(r);
    if (before) await before(r, server);
    const own = answer?.(r);
    if (own) return own;
    const token = r.headers["private-token"] ?? null;
    if (token !== null && token !== GL_TOKEN) return json(401, { message: "401 Unauthorized" });
    const authed = token !== null;
    if (r.origin !== GL_ORIGIN || !(r.path === prefix || r.path.startsWith(`${prefix}/`))) return json(404, { error: "404 Not Found" });
    if (!(visibility === "public" || authed)) return json(404, { message: "404 Project Not Found" });
    const rest = r.path.slice(prefix.length);
    let m;
    if (r.method === "GET" && rest === "") {
      return json(200, { id: 4711, name: "thesis-tool", path_with_namespace: "grp/sub/thesis-tool", default_branch: "main",
        visibility, archived: false, description, web_url: GL_WEB,
        ...(authed ? { permissions: { project_access: { access_level: level, notification_level: 3 }, group_access: null } } : {}) });
    }
    if (r.method === "GET" && (m = /^\/repository\/commits\/([^/]+)$/.exec(rest))) {
      const at = resolve(decodeURIComponent(m[1]));
      return at ? json(200, { id: at, short_id: at.slice(0, 8), parent_ids: commits.get(at).parent ? [commits.get(at).parent] : [],
        message: commits.get(at).message }) : json(404, { message: "404 Commit Not Found" });
    }
    if (r.method === "GET" && rest === "/repository/tree") {
      const at = resolve(r.query.ref ?? "main");
      if (!at) return json(404, { message: "404 Tree Not Found" });
      const map = commits.get(at).files, dirs = new Set();
      for (const p of Object.keys(map)) p.split("/").slice(0, -1).forEach((_, i, a) => dirs.add(a.slice(0, i + 1).join("/")));
      const all = [...[...dirs].map((p) => ({ id: sha1(`dir ${p}`), name: p.split("/").pop(), type: "tree", path: p, mode: "040000" })),
        ...Object.entries(map).map(([p, f]) => ({ id: blobSha(f.buf), name: p.split("/").pop(), type: "blob", path: p, mode: "100644" }))]
        .sort((a, b) => (a.path < b.path ? -1 : 1));
      const per = Number(r.query.per_page ?? 20), page = Number(r.query.page ?? 1), pages = Math.max(1, Math.ceil(all.length / per));
      return json(200, all.slice((page - 1) * per, page * per), { "X-Page": String(page), "X-Per-Page": String(per),
        "X-Total": String(all.length), "X-Total-Pages": String(pages), "X-Next-Page": page < pages ? String(page + 1) : "" });
    }
    if ((r.method === "GET" || r.method === "HEAD") && (m = /^\/repository\/files\/([^/]+)(\/raw)?$/.exec(rest))) {
      const at = resolve(r.query.ref ?? "main"), path = decodeURIComponent(m[1]), f = at && commits.get(at).files[path];
      if (!f) return json(404, { message: "404 File Not Found" });
      if (m[2]) return text(200, f.buf);
      const meta = { file_name: path.split("/").pop(), file_path: path, size: f.buf.length, encoding: "base64", ref: r.query.ref,
        blob_id: blobSha(f.buf), commit_id: at, last_commit_id: f.last, content: f.buf.toString("base64") };
      return r.method === "HEAD"
        ? new Response(null, { status: 200, headers: { "X-Gitlab-Blob-Id": meta.blob_id, "X-Gitlab-Commit-Id": at,
          "X-Gitlab-Last-Commit-Id": f.last, "X-Gitlab-File-Path": path } })
        : json(200, meta);
    }
    if (r.method === "GET" && (m = /^\/repository\/branches\/([^/]+)$/.exec(rest))) {
      return decodeURIComponent(m[1]) === "main" ? json(200, { name: "main", commit: { id: head }, protected: true, default: true })
        : json(404, { message: "404 Branch Not Found" });
    }
    if (r.method === "POST" && rest === "/repository/commits") {
      // A protected default branch: only a Maintainer may push (GitLab's default protection).
      if (!authed || level < 40) return json(403, { message: "403 Forbidden" });
      if (r.body.branch !== "main" || r.body.start_sha || r.body.force) return json(400, { message: "unexpected" });
      const map = { ...commits.get(head).files }, sha = sha1(`gitlab commit ${head} ${commits.size}`);
      for (const a of r.body.actions ?? []) {
        const content = () => (a.encoding === "base64" ? Buffer.from(a.content, "base64") : utf8(a.content ?? ""));
        // file_has_changed?: the file's last commit as of last_commit_id against its last commit on the branch now.
        const then = a.last_commit_id ? commits.get(a.last_commit_id)?.files[a.file_path]?.last : undefined;
        const changed = Boolean(then && map[a.file_path] && map[a.file_path].last !== then);
        if (a.action === "create") {
          if (map[a.file_path]) return json(400, { message: "A file with this name already exists" });
          map[a.file_path] = { buf: content(), last: sha };
        } else if (a.action === "update" || a.action === "delete") {
          if (!map[a.file_path]) return json(400, { message: "A file with this name doesn't exist" });
          if (changed) return json(400, { message: `The file has changed since you started editing it: ${a.file_path}` });
          if (a.action === "update") map[a.file_path] = { buf: content(), last: sha };
          else delete map[a.file_path];
        } else return json(400, { message: `unexpected action ${a.action}` });
      }
      commits.set(sha, { parent: head, files: map, message: r.body.commit_message });
      const parent = head;
      head = sha;
      made += 1;
      return json(201, { id: sha, short_id: sha.slice(0, 8), message: r.body.commit_message, parent_ids: [parent],
        web_url: `${GL_WEB}/-/commit/${sha}` });
    }
    return json(404, { error: "404 Not Found" });
  };
  return server;
}

const GITHUB = parseAddressOrNull("https://github.com/alice/thesis-tool");
const GITLAB = parseAddressOrNull(GL_WEB);
// The addresses the tests connect to, as parseAddress reads them; null while it fails, so that each test names what failed.
function parseAddressOrNull(url) { try { return parseAddress(url); } catch { return null; } }

// ---------------------------------------------------------------- A PRODUCT IS NAMED BY ITS ADDRESS

// A PRODUCT IS NAMED BY ITS ADDRESS — Expected: the address of a GitHub repository as the browser shows it — with or without a
// trailing slash or ".git", on one of its pages (a tree, a file), with a query or a fragment, with spaces around it — is read as
// { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" },
// and no request is made. Counter-proof: a bare owner/name, plain http, an owner without a repository, a path that climbs, a
// user name and token in the address, an empty text and a script address are each refused with a TypeError.
// TST-476065 · level: unit · module: MOD-repository-hosts
// guards: A PRODUCT IS NAMED BY ITS ADDRESS
// given: fake fetch recording every request; the address of a GitHub repository in the forms a browser shows it (plain, trailing slash, .git, tree and blob pages, query, fragment, spaces around), and the bad forms (bare owner/name, plain http, owner only, climbing path, user name and token in the address, empty text, script address)
// input: parseAddress of each address
// expect: each good form is read as { server: github, origin: https://github.com, path: alice/thesis-tool, web }; each bad form is refused with a TypeError; no request is made
test("A PRODUCT IS NAMED BY ITS ADDRESS — a GitHub repository's address, as the browser shows it", async () => {
  const sent = [];
  await using(async (u) => { sent.push(String(u)); return json(200, {}); }, async () => {
    const expected = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: GH_WEB };
    for (const v of [GH_WEB, `${GH_WEB}/`, `${GH_WEB}.git`, `${GH_WEB}/tree/main`, `${GH_WEB}/blob/main/SPEC.md`,
      `${GH_WEB}?tab=readme-ov-file`, `${GH_WEB}#readme`, `  ${GH_WEB}  `]) {
      assert.deepEqual(parseAddress(v), expected, v);
    }
    for (const v of ["alice/thesis-tool", "http://github.com/alice/thesis-tool", "https://github.com/alice",
      "https://github.com/../evil", `https://alice:${GH_TOKEN}@github.com/alice/thesis-tool`, "", "javascript:alert(1)"]) {
      assert.throws(() => parseAddress(v), TypeError, `refused: ${JSON.stringify(v)}`);
    }
  });
  assert.deepEqual(sent, [], "no request is made");
});

// A PRODUCT IS NAMED BY ITS ADDRESS · GITLAB PRODUCTS ARE SUPPORTED — Expected: the address of a project on a GitLab server, in
// nested groups, as the browser shows it — with or without a trailing slash or ".git", on one of its pages behind GitLab's "/-/",
// with spaces around it — is read as { server: "gitlab", origin: the server, path: the groups and the project, web: the project's
// address }; a server with a port keeps it. Counter-proof: a group without a project, a path that climbs, a path that starts
// behind "/-/", a user name and token in the address, plain http and an encoded slash in a name are each refused with a TypeError.
// TST-476066 · level: unit · module: MOD-repository-hosts
// guards: A PRODUCT IS NAMED BY ITS ADDRESS; GITLAB PRODUCTS ARE SUPPORTED
// given: the address of a project on a GitLab server in nested groups, in the forms a browser shows it (trailing slash, .git, pages behind /-/, spaces, a port), and the bad forms (group without project, climbing path, path starting behind /-/, user name and token, plain http, encoded slash)
// input: parseAddress of each address
// expect: each good form is read as { server: gitlab, origin, path: groups and project, web }, a port kept; each bad form is refused with a TypeError
test("A PRODUCT IS NAMED BY ITS ADDRESS · GITLAB PRODUCTS ARE SUPPORTED — a GitLab project's address, in nested groups", () => {
  const web = "https://gitlab.rrze.fau.de/fau-ai-taskforce/tools/thesis-tool";
  const expected = { server: "gitlab", origin: "https://gitlab.rrze.fau.de", path: "fau-ai-taskforce/tools/thesis-tool", web };
  for (const v of [web, `${web}/`, `${web}.git`, `${web}/-/tree/main`, `${web}/-/blob/main/SPEC.md`, ` ${web} `]) {
    assert.deepEqual(parseAddress(v), expected, v);
  }
  assert.deepEqual(parseAddress("https://git.example.org:8443/team/proj"),
    { server: "gitlab", origin: "https://git.example.org:8443", path: "team/proj", web: "https://git.example.org:8443/team/proj" });
  assert.deepEqual(parseAddress(GL_WEB), { server: "gitlab", origin: GL_ORIGIN, path: "grp/sub/thesis-tool", web: GL_WEB });
  for (const v of ["https://gitlab.com/alice", "https://gitlab.com/alice/../bob", "https://gitlab.com/-/alice",
    `https://oauth2:${GL_TOKEN}@gitlab.com/a/b`, "http://gitlab.com/a/b", "https://gitlab.com/a/b%2Fc"]) {
    assert.throws(() => parseAddress(v), TypeError, `refused: ${v}`);
  }
});

// ---------------------------------------------------------------- A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT

// What UC-001 does with a host: its information, the snapshot of its default branch, one file, one commit, the pages.
async function addProductCalls(host) {
  const info = await host.repositoryInfo();
  const snap = await host.readSnapshot(info.defaultBranch);
  await snap.read("SPEC.md");
  await host.commitFiles({ branch: info.defaultBranch, expectedHead: snap.commit, message: "Add the Agent M review layout",
    files: [{ path: "CHANGELOG.md", text: "# Changelog\n" }] });
  host.webLinks();
}

// A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT · A CREDENTIAL IS NEVER PLACED IN A URL — Expected: connect itself sends nothing.
// Through UC-001's calls, every request for the GitHub repository goes to GitHub's API and carries the GitHub token as its
// Authorization header; every request for the GitLab project goes to that project's API on its own server and carries the
// project token as PRIVATE-TOKEN; no request carries the other server's token, and no address carries any token. A public
// GitHub repository read without a token is read with no authorisation at all. Counter-proof: a token of the other server's
// kind — a GitHub token for the GitLab project, a GitLab token for the GitHub repository — is refused by connect with a
// TypeError, and nothing is sent.
// TST-476067 · level: unit · module: MOD-repository-hosts
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a fake GitHub with a GitHub token and a fake GitLab server with a project token; a token of the other server's kind
// input: connect, then UC-001's calls (repositoryInfo, readSnapshot, a file read, commitFiles, webLinks) on each; connect with the other server's kind of token
// expect: connect sends nothing; every GitHub request goes to GitHub's API with the token as Authorization; every GitLab request goes to the project's API with the token as PRIVATE-TOKEN; no request carries the other server's token and no address a token; a public GitHub repository read without a token has no authorisation; a token of the other kind is refused by connect with a TypeError and nothing is sent
test("A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT — the GitHub token only to GitHub's API, the project token only to its project's API", async () => {
  const gh = fakeGitHub();
  await using(gh.fetch, async () => {
    const host = connect(GITHUB, { token: GH_TOKEN });
    assert.equal(gh.requests.length, 0, "connect sends nothing");
    await addProductCalls(host);
  });
  assert.equal(gh.made(), 1, "known positive: the calls ran, the commit included");
  for (const r of gh.requests) {
    assert.equal(r.origin, GH_API, r.href);
    assert.equal(r.headers.authorization, `Bearer ${GH_TOKEN}`, `${r.method} ${r.href}`);
    assert.ok(!carries(r, GL_TOKEN) && !("private-token" in r.headers), `no GitLab token at ${r.href}`);
    assert.ok(!r.href.includes(GH_TOKEN), `no token in ${r.href}`);
  }
  const gl = fakeGitLab();
  await using(gl.fetch, async () => {
    const host = connect(GITLAB, { token: GL_TOKEN });
    assert.equal(gl.requests.length, 0, "connect sends nothing");
    await addProductCalls(host);
  });
  assert.equal(gl.made(), 1, "known positive: the calls ran, the commit included");
  for (const r of gl.requests) {
    assert.ok(r.href.startsWith(`${GL_API}/`) || r.href === GL_API, `the project's own API: ${r.href}`);
    assert.equal(r.headers["private-token"], GL_TOKEN, `${r.method} ${r.href}`);
    assert.ok(!carries(r, GH_TOKEN) && !("authorization" in r.headers), `no GitHub token at ${r.href}`);
    assert.ok(!r.href.includes(GL_TOKEN), `no token in ${r.href}`);
  }
  const open = fakeGitHub({ visibility: "public" });
  await using(open.fetch, async () => {
    const host = connect(GITHUB, {});
    const snap = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
    assert.equal(await snap.read("SPEC.md"), FILES["SPEC.md"]);
  });
  assert.ok(open.requests.length >= 3, "known positive: the public repository was read");
  for (const r of open.requests) {
    assert.ok([GH_API, GH_RAW].includes(r.origin), r.href);
    assert.ok(!("authorization" in r.headers) && !("private-token" in r.headers), `no authorisation at ${r.href}`);
  }
  for (const [address, foreign, fake] of [[GITLAB, GH_TOKEN, fakeGitLab()], [GITHUB, GL_TOKEN, fakeGitHub()]]) {
    await using(fake.fetch, async () => {
      assert.throws(() => connect(address, { token: foreign }), TypeError, `${address.web}: the other server's token`);
    });
    assert.deepEqual(fake.requests, [], `${address.web}: nothing is sent`);
  }
});

// ---------------------------------------------------------------- A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN

const RESET = 1790000000; // seconds since 1970, UTC, as X-RateLimit-Reset and RateLimit-Reset give it
const githubLimit = (status, limit, remaining = 0) => () => json(status, { message: "API rate limit exceeded for user ID 1." }, {
  "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Used": String(limit - remaining),
  "X-RateLimit-Reset": String(RESET), "X-RateLimit-Resource": "core" });

// TST-475207 · level: unit · module: MOD-repository-hosts
// guards: AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: the public GitHub host succeeds on the controlled 200 repository endpoint.
// input: that endpoint then answers 401, including exhausted-limit headers.
// expect: unchanged HostError TokenRefused/tokenName/renewal fields; neutral rejected-authentication wording naming the token and renewal, without any guessed expiry/regeneration/deletion cause.
test("TST-475207: GitHub 401 names rejected authentication without guessing its cause", async () => {
  const named = "My instance token";
  const host = connect(GITHUB, { token: GH_TOKEN, tokenName: named });
  assert.equal((await using(fakeGitHub().fetch, () => host.repositoryInfo())).defaultBranch, "main", "known positive: the same public host succeeds on 200");
  const error = await using(fakeGitHub({ answer: githubLimit(401, 5000) }).fetch, () => failure(host.repositoryInfo()));
  assert.ok(error instanceof HostError);
  assert.deepEqual([error.name, error.tokenName, error.renewal], ["TokenRefused", named, GH_TOKENS], "401 remains authentication rejection even with rate-limit headers");
  assert.equal(error.message, `GitHub rejected authentication with your ${named}. Renew it on ${GH_TOKENS}.`, "failure node: the host message reports rejection, identity and recovery, not an inferred cause");
  assert.doesNotMatch(error.message, /expired|expiry|regenerat|delet|rotat|revok/i);
});

// TST-475208 · level: unit · module: MOD-repository-hosts
// guards: AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; GITLAB PRODUCTS ARE SUPPORTED
// given: the public GitLab host succeeds on its controlled 200 project endpoint.
// input: the same endpoint answers 401.
// expect: unchanged TokenRefused identity/renewal fields, with rejected authentication named and no inferred expiry/rotation/revocation cause.
test("TST-475208: GitLab 401 preserves its identity and renewal without guessing expiry", async () => {
  const named = "My project token";
  const host = connect(GITLAB, { token: GL_TOKEN, tokenName: named });
  assert.equal((await using(fakeGitLab().fetch, () => host.repositoryInfo())).defaultBranch, "main", "known positive: GitLab repositoryInfo succeeds on 200");
  const error = await using(fakeGitLab({ answer: () => json(401, { message: "401 Unauthorized" }) }).fetch, () => failure(host.repositoryInfo()));
  assert.ok(error instanceof HostError);
  assert.deepEqual([error.name, error.tokenName, error.renewal], ["TokenRefused", named, GL_TOKENS]);
  assert.equal(error.message, `${GITLAB.origin.replace("https://", "")} rejected authentication with your ${named}. Renew it on ${GL_TOKENS}.`, "failure node: the GitLab host does not infer a reason for rejection");
  assert.doesNotMatch(error.message, /expired|expiry|regenerat|delet|rotat|revok/i);
});

// A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN — Expected: GitHub's 403 or 429 with X-RateLimit-Remaining: 0 and
// X-RateLimit-Limit: 5000 fails a read — the repository's information, a snapshot — and a write as RateLimited { limit:
// "account" } with the reset time the server sent, never as TokenRefused or PermissionMissing, and the write writes nothing;
// without a token, X-RateLimit-Limit: 60 is the network's limit. On a GitLab server a 429 is the account's limit with a token,
// the network's without one, with the time of RateLimit-Reset where the server lets the page read it, and none where it does not.
// Counter-proofs: a 403 without those headers, or with a limit not used up, is PermissionMissing; GitLab's 403 is
// PermissionMissing; a 401 is TokenRefused — naming the token by the name it was stored under, with the page where it is
// renewed — even when the answer carries a used-up limit's headers (AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED).
// TST-476068 · level: unit · module: MOD-repository-hosts
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: a fake GitHub answering 403 or 429 with X-RateLimit-Remaining 0 and Limit 5000 (60 without a token), and a fake GitLab answering 429 with and without RateLimit-Reset; counter-cases: a 403 without those headers or with a limit not used up, GitLab's 403, a 401 even with a used-up limit's headers
// input: repositoryInfo, readSnapshot and commitFiles on each
// expect: RateLimited { limit: account or network } with the reset time the server sent, never TokenRefused or PermissionMissing, and the write writes nothing; the counter-cases are PermissionMissing, and a 401 is TokenRefused naming the stored token and the page where it is renewed
test("A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN — GitHub's 403 with a used-up limit is that limit, never the token", async () => {
  const named = "Agent M · alice/agent-m";
  const calls = (host) => [() => host.repositoryInfo(), () => host.readSnapshot("main"),
    () => host.commitFiles({ branch: "main", expectedHead: "a".repeat(40), message: "m", files: [{ path: "a.md", text: "a\n" }] })];
  for (const status of [403, 429]) {
    const gh = fakeGitHub({ answer: githubLimit(status, 5000) });
    for (const call of calls(connect(GITHUB, { token: GH_TOKEN, tokenName: named }))) {
      const e = await using(gh.fetch, () => failure(call()));
      assert.ok(e instanceof HostError, `${status}: a HostError, not ${e}`);
      assert.equal(e.name, "RateLimited", `${status}: named as the limit`);
      assert.equal(e.limit, "account");
      assert.equal(e.resetsAt?.getTime(), RESET * 1000, "the reset time the server sent");
    }
    assert.equal(gh.made(), 0, "nothing was written");
  }
  const network = fakeGitHub({ visibility: "public", answer: githubLimit(403, 60) });
  const n = await using(network.fetch, () => failure(connect(GITHUB, {}).repositoryInfo()));
  assert.deepEqual([n?.name, n?.limit, n?.resetsAt?.getTime()], ["RateLimited", "network", RESET * 1000], "without a token: the network's");
  // Counter-proofs on GitHub.
  for (const [label, answer] of [
    ["a 403 without the headers", () => json(403, { message: "Resource not accessible by personal access token" })],
    ["a 403 with a limit not used up", githubLimit(403, 5000, 4711)]]) {
    const e = await using(fakeGitHub({ answer }).fetch, () => failure(connect(GITHUB, { token: GH_TOKEN }).repositoryInfo()));
    assert.equal(e?.name, "PermissionMissing", label);
  }
  const refused = await using(fakeGitHub({ answer: githubLimit(401, 60) }).fetch,
    () => failure(connect(GITHUB, { token: GH_TOKEN, tokenName: named }).repositoryInfo()));
  assert.deepEqual([refused?.name, refused?.tokenName, refused?.renewal], ["TokenRefused", named, GH_TOKENS], "a 401 is the token");
  // A GitLab server.
  const gitlabLimit = (headers = {}) => () => json(429, { message: "Retry later" }, { "Retry-After": "60", ...headers });
  const withToken = await using(fakeGitLab({ answer: gitlabLimit() }).fetch,
    () => failure(connect(GITLAB, { token: GL_TOKEN }).readSnapshot("main")));
  assert.deepEqual([withToken?.name, withToken?.limit, withToken?.resetsAt], ["RateLimited", "account", null], "GitLab, with a token");
  const timed = await using(fakeGitLab({ answer: gitlabLimit({ "RateLimit-Remaining": "0", "RateLimit-Reset": String(RESET) }) }).fetch,
    () => failure(connect(GITLAB, { token: GL_TOKEN }).repositoryInfo()));
  assert.deepEqual([timed?.name, timed?.resetsAt?.getTime()], ["RateLimited", RESET * 1000], "GitLab, with the reset time");
  const without = await using(fakeGitLab({ visibility: "public", answer: gitlabLimit() }).fetch,
    () => failure(connect(GITLAB, {}).repositoryInfo()));
  assert.deepEqual([without?.name, without?.limit], ["RateLimited", "network"], "GitLab, without a token");
  const forbidden = await using(fakeGitLab({ answer: () => json(403, { message: "403 Forbidden" }) }).fetch,
    () => failure(connect(GITLAB, { token: GL_TOKEN }).repositoryInfo()));
  assert.equal(forbidden?.name, "PermissionMissing", "GitLab's 403 is no limit");
  const expired = await using(fakeGitLab({ answer: () => json(401, { message: "401 Unauthorized" }) }).fetch,
    () => failure(connect(GITLAB, { token: GL_TOKEN, tokenName: "GitLab project token" }).repositoryInfo()));
  assert.deepEqual([expired?.name, expired?.tokenName, expired?.renewal], ["TokenRefused", "GitLab project token", GL_TOKENS]);
});

// ---------------------------------------------------------------- UC-001 5a: a write the repository refuses

const LAYOUT = [{ path: "docs/use-cases/README.md", text: "# Use cases\n" }, { path: "CHANGELOG.md", text: "# Changelog\n" }];

// UC-001 5a · A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT — Expected: a public repository that the token does not reach yet is
// read with it — its information and its snapshot —, but the commit is refused: commitFiles fails with PermissionMissing,
// naming the permission Contents and the page of the person's tokens, where the repository is added to the token, in a message
// that names the repository; the branch stays where it was, and no reference is moved. GitHub answers such a write with 403, or
// with 404 where it hides the repository, and both are named so. Counter-proof: once the token reaches the repository, the same
// commit is written.
// TST-476069 · level: unit · module: MOD-repository-hosts
// guards: UC-001; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a public GitHub repository that the token does not reach yet, whose write is answered 403 or 404; once with a token that reaches it
// input: repositoryInfo, readSnapshot and commitFiles of the layout
// expect: the read succeeds; commitFiles fails with PermissionMissing naming the permission Contents, the page of the person's tokens and the repository; the branch stays where it was and no reference is moved; once the token reaches the repository the same commit is written
test("UC-001 5a — a write that a public repository refuses because the token does not reach it is named so, and nothing is written", async () => {
  for (const answer of [null, (r) => (r.method === "POST" ? json(404, { message: "Not Found" }) : null)]) {
    const gh = fakeGitHub({ visibility: "public", reaches: false, answer });
    const head = gh.head();
    const e = await using(gh.fetch, async () => {
      const host = connect(GITHUB, { token: GH_TOKEN });
      const info = await host.repositoryInfo();
      assert.equal(info.visibility, "public", "the read succeeds");
      const snap = await host.readSnapshot(info.defaultBranch);
      return failure(host.commitFiles({ branch: "main", expectedHead: snap.commit, files: LAYOUT, message: "Add the Agent M review layout" }));
    });
    assert.ok(e instanceof HostError, `a HostError, not ${e}`);
    assert.equal(e.name, "PermissionMissing");
    assert.equal(e.permission, "Contents");
    assert.equal(e.renewal, GH_TOKENS);
    assert.match(e.message, /alice\/thesis-tool/, "the message names the repository");
    assert.equal(gh.head(), head, "the branch stays where it was");
    assert.deepEqual(gh.requests.filter((r) => r.method === "PATCH"), [], "no reference is moved");
  }
  const ok = fakeGitHub({ visibility: "public", reaches: true });
  await using(ok.fetch, async () => {
    const host = connect(GITHUB, { token: GH_TOKEN });
    await host.commitFiles({ branch: "main", expectedHead: ok.head(), files: LAYOUT, message: "Add the Agent M review layout" });
  });
  assert.equal(ok.made(), 1, "known positive: written once the token reaches it");
});

// ---------------------------------------------------------------- one commit on the head that was read

const MESSAGE = "Add the Agent M review layout\n\nItem: ITM-205 · Agent M at a2b24d3 · developer-opus-c (claude-opus-5-5)\n";
const LOGO = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff];
const CHANGE = [
  { path: "docs/use-cases/README.md", text: "# Use cases\n" },
  { path: "SPEC.md", text: "# Thesis tool — Specification\n\n**VERBINDLICH (SPEC)**\n" },
  { path: "docs/old.md", delete: true },
  { path: "docs/logo.png", bytes: Uint8Array.from(LOGO) },
];
// The files of the repository after CHANGE, from the files before it.
function changed(before) {
  const after = { ...before };
  delete after["docs/old.md"];
  return { ...after, "docs/use-cases/README.md": utf8("# Use cases\n"), "SPEC.md": utf8(CHANGE[1].text), "docs/logo.png": Buffer.from(LOGO) };
}
const sameFiles = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([p, buf]) => b[p]?.equals(buf));

// UC-001 5 · ADDING A PRODUCT CREATES ITS LAYOUT, on GitHub — Expected: all files of a change — a new file, a changed one, a
// removed one, and one given as bytes — are written in one commit whose parent is the commit the snapshot read, with the message
// exactly as given; the branch then stands at that commit, which commitFiles returns with its address on GitHub, and every file
// the change does not name is kept. Counter-proofs: when the branch moved after the snapshot was read, commitFiles fails with
// Moved, naming the head the branch stands at, and sends no write at all; when it moves while the commit is made, GitHub
// refuses to move the branch, commitFiles fails with Moved naming the newer head, and the branch keeps that head.
// TST-476070 · level: unit · module: MOD-repository-hosts
// guards: UC-001; ADDING A PRODUCT CREATES ITS LAYOUT
// given: a fake GitHub holding the repository; a change of a new file, a changed one, a removed one and one given as bytes; a snapshot read at the branch head; once the branch moved after the snapshot, once it moves while the commit is made
// input: commitFiles of the change on the head that was read
// expect: one commit whose parent is the snapshot's commit, with the message as given; the branch stands at it; commitFiles returns it with its GitHub address; every file the change does not name is kept; when the head moved, Moved naming the newer head, with no write sent in the first case and the branch keeping the newer head in the second
test("UC-001 5 — all files of a change in one commit on the head that was read, and Moved when the head moved meanwhile (GitHub)", async () => {
  const gh = fakeGitHub();
  const host = connect(GITHUB, { token: GH_TOKEN });
  const snap = await using(gh.fetch, () => host.readSnapshot("main"));
  const before = gh.filesAt(snap.commit);
  const r = await using(gh.fetch, () => host.commitFiles({ branch: "main", expectedHead: snap.commit, files: CHANGE, message: MESSAGE }));
  assert.equal(gh.made(), 1, "one commit");
  assert.equal(r.commit, gh.head(), "the branch stands at the commit returned");
  assert.equal(gh.parentOf(r.commit), snap.commit, "on the head that was read");
  assert.equal(gh.messageOf(r.commit), MESSAGE, "the message as given");
  assert.equal(r.url, `${GH_WEB}/commit/${r.commit}`);
  assert.ok(sameFiles(gh.filesAt(r.commit), changed(before)), "every file of the change, and nothing else changed");
  // Moved before anything is written.
  const moved = fakeGitHub();
  const read = await using(moved.fetch, () => host.readSnapshot("main"));
  const newer = moved.push({ "SPEC.md": "changed by someone else\n" });
  const e = await using(moved.fetch, () => failure(host.commitFiles({ branch: "main", expectedHead: read.commit, files: CHANGE, message: MESSAGE })));
  assert.deepEqual([e instanceof HostError, e?.name, e?.head], [true, "Moved", newer]);
  assert.deepEqual(moved.requests.filter((q) => q.method !== "GET").map((q) => `${q.method} ${q.path}`), [], "no write is sent");
  assert.equal(moved.head(), newer);
  // Moved while the commit is made: the branch moves just before it would be moved to the new commit.
  let late = null;
  const racing = fakeGitHub({ before: (q, s) => { if (q.method === "PATCH" && !late) late = s.push({ "README.md": "# raced\n" }); } });
  const at = await using(racing.fetch, () => host.readSnapshot("main"));
  const f = await using(racing.fetch, () => failure(host.commitFiles({ branch: "main", expectedHead: at.commit, files: CHANGE, message: MESSAGE })));
  assert.ok(late, "known positive: the branch moved while the commit was made");
  assert.deepEqual([f instanceof HostError, f?.name, f?.head], [true, "Moved", late]);
  assert.equal(racing.head(), late, "the branch keeps the newer head");
});

// UC-001 5 · GITLAB PRODUCTS ARE SUPPORTED — Expected: on a GitLab server, the same change is written in one commit whose parent is
// the commit the snapshot read, with the message as given; the branch then stands at it, commitFiles returns it with its address
// on the server, and every file the change does not name is kept. Counter-proofs: when the branch moved after the snapshot was
// read, commitFiles fails with Moved, naming the newer head, and sends no write; when a commit that changes a file of the change
// lands while the commit is made, GitLab refuses the commit, commitFiles fails with Moved naming the newer head, and the branch
// keeps that head — what makes GitLab refuse it is the last commit of each changed file as it stood at the head that was read.
// TST-476071 · level: unit · module: MOD-repository-hosts
// guards: UC-001; GITLAB PRODUCTS ARE SUPPORTED
// given: a fake GitLab server holding the project; the same change of four files; a snapshot read at the branch head; once the branch moved after the snapshot, once a commit changing a file of the change lands while the commit is made
// input: commitFiles of the change on the head that was read
// expect: one commit whose parent is the snapshot's commit, with the message as given; the branch stands at it; commitFiles returns it with its address on the server; every file the change does not name is kept; when the head moved, Moved naming the newer head and no write sent, the branch keeping that head
test("UC-001 5 — all files of a change in one commit on the head that was read, and Moved when the head moved meanwhile (GitLab)", async () => {
  const gl = fakeGitLab();
  const host = connect(GITLAB, { token: GL_TOKEN });
  const snap = await using(gl.fetch, () => host.readSnapshot("main"));
  const before = gl.filesAt(snap.commit);
  const r = await using(gl.fetch, () => host.commitFiles({ branch: "main", expectedHead: snap.commit, files: CHANGE, message: MESSAGE }));
  assert.equal(gl.made(), 1, "one commit");
  assert.equal(r.commit, gl.head(), "the branch stands at the commit returned");
  assert.equal(gl.parentOf(r.commit), snap.commit, "on the head that was read");
  assert.equal(gl.messageOf(r.commit), MESSAGE, "the message as given");
  assert.equal(r.url, `${GL_WEB}/-/commit/${r.commit}`);
  assert.ok(sameFiles(gl.filesAt(r.commit), changed(before)), "every file of the change, and nothing else changed");
  // Moved before anything is written.
  const moved = fakeGitLab();
  const read = await using(moved.fetch, () => host.readSnapshot("main"));
  const newer = moved.push({ "README.md": "changed by someone else\n" });
  const e = await using(moved.fetch, () => failure(host.commitFiles({ branch: "main", expectedHead: read.commit, files: CHANGE, message: MESSAGE })));
  assert.deepEqual([e instanceof HostError, e?.name, e?.head], [true, "Moved", newer]);
  assert.deepEqual(moved.requests.filter((q) => q.method !== "GET" && q.method !== "HEAD").map((q) => `${q.method} ${q.path}`), [],
    "no write is sent");
  // Moved while the commit is made: a commit changing SPEC.md lands just before GitLab writes this one.
  let late = null;
  const racing = fakeGitLab({ before: (q, s) => { if (q.method === "POST" && !late) late = s.push({ "SPEC.md": "raced\n" }); } });
  const at = await using(racing.fetch, () => host.readSnapshot("main"));
  const f = await using(racing.fetch, () => failure(host.commitFiles({ branch: "main", expectedHead: at.commit, files: CHANGE, message: MESSAGE })));
  assert.ok(late, "known positive: a commit landed while the commit was made");
  assert.deepEqual([f instanceof HostError, f?.name, f?.head], [true, "Moved", late]);
  assert.equal(racing.head(), late, "the branch keeps the newer head");
  assert.equal(racing.made(), 0, "nothing was written");
});

// UC-001 5 · GITLAB PRODUCTS ARE SUPPORTED — Expected: when a commit that touches none of the change's files lands on the branch
// while commitFiles reads those files — after it checked the head, before it writes —, commitFiles fails with Moved, naming the
// newer head; no write is sent, and the branch keeps that head. GitLab itself would write the change on top of that commit, for
// none of the change's files changed: only reading the head again just before the write finds it.
// TST-476072 · level: unit · module: MOD-repository-hosts
// guards: UC-001; GITLAB PRODUCTS ARE SUPPORTED
// given: a fake GitLab server; a commit touching none of the change's files lands on the branch after commitFiles checked the head and before it writes
// input: commitFiles of the change, the snapshot read before
// expect: commitFiles fails with Moved naming the newer head; no write is sent and the branch keeps that head
test("UC-001 5 — GitLab: a commit that lands while the change's files are read, touching none of them, is Moved, and nothing is written", async () => {
  let armed = false, checked = false, late = null;
  const gl = fakeGitLab({ before: (q, s) => {
    if (!armed || late) return;
    if (q.method === "GET" && q.path.endsWith("/repository/branches/main")) checked = true;
    else if (checked && q.path.includes("/repository/files/")) late = s.push({ "README.md": "changed while the files were read\n" });
  } });
  const host = connect(GITLAB, { token: GL_TOKEN });
  const snap = await using(gl.fetch, () => host.readSnapshot("main"));
  armed = true;
  const e = await using(gl.fetch, () => failure(host.commitFiles({ branch: "main", expectedHead: snap.commit, files: CHANGE, message: MESSAGE })));
  assert.ok(late, "known positive: a commit landed after the head was checked, while the change's files were read");
  assert.ok(!CHANGE.some((f) => f.path === "README.md"), "the commit that landed touches none of the change's files");
  assert.deepEqual([e instanceof HostError, e?.name, e?.head], [true, "Moved", late]);
  assert.deepEqual(gl.requests.filter((q) => q.method === "POST").map((q) => q.path), [], "no write is sent");
  assert.equal(gl.made(), 0, "nothing was written");
  assert.equal(gl.head(), late, "the branch keeps the newer head");
});

// ---------------------------------------------------------------- the token pages UC-001 opens

// THE TOKEN LINK IS PREFILLED · ONE GITHUB TOKEN SERVES EVERY FEATURE · THE REPOSITORY CHOICE IS SPELLED OUT · A GITLAB PRODUCT
// USES A PROJECT ACCESS TOKEN · UC-001 2a, 3, 3b, 3c — Expected, with no request made: on GitHub, `tokens` is the list of the
// person's fine-grained tokens, https://github.com/settings/personal-access-tokens (Step A opens it); newToken(name, description,
// days) is GitHub's page for a new fine-grained token with name, description and expiry filled in, the repository's owner as
// the token's owner — GitHub limits a token to the repositories of one owner (target_name) —, and exactly the permissions
// Contents, Issues, Pull requests, Actions and Workflows write and Metadata read — no repository and no other field, for the
// repositories are named beside the link, not in it; `projectTokens` is null; `newRepository` is https://github.com/new. On a
// GitLab server, `projectTokens`, `tokens` and newToken(…) are the project's Access tokens page, where the project access token
// is created and renewed, and `newRepository` is the server's page for a new project. No page carries a token.
// TST-476073 · level: unit · module: MOD-repository-hosts
// guards: THE TOKEN LINK IS PREFILLED; ONE GITHUB TOKEN SERVES EVERY FEATURE; THE REPOSITORY CHOICE IS SPELLED OUT; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; UC-001
// given: a fetch that records every request; a host connected to the GitHub repository and one to the GitLab project
// input: webLinks of each, newToken(name, description, days) of each
// expect: GitHub: tokens is the list of fine-grained tokens, newToken is the prefilled new-token page (name, description, expiry, the repository's owner, permissions Contents, Issues, Pull requests, Actions and Workflows write and Metadata read, no repository), projectTokens is null, newRepository is https://github.com/new; GitLab: projectTokens, tokens and newToken are the project's Access tokens page and newRepository the server's new-project page; no page carries a token; no request is made
test("UC-001 — the token pages: GitHub's prefilled token page and the list of tokens, a GitLab project's Access tokens page", async () => {
  const sent = [];
  await using(async (u) => { sent.push(String(u)); return json(200, {}); }, () => {
    const gh = connect(GITHUB, { token: GH_TOKEN }).webLinks();
    assert.equal(gh.tokens, GH_TOKENS);
    assert.equal(gh.projectTokens, null);
    assert.equal(gh.newRepository, "https://github.com/new");
    const u = new URL(gh.newToken("Agent M · alice/agent-m", "Agent M dashboard of alice/agent-m", 90));
    assert.equal(u.origin + u.pathname, "https://github.com/settings/personal-access-tokens/new");
    assert.deepEqual(Object.fromEntries(u.searchParams), { name: "Agent M · alice/agent-m",
      description: "Agent M dashboard of alice/agent-m", target_name: "alice", expires_in: "90",
      contents: "write", issues: "write", pull_requests: "write", actions: "write", workflows: "write", secrets: "write", metadata: "read" },
      "exactly these fields and permissions, no repository");
    const gl = connect(GITLAB, { token: GL_TOKEN }).webLinks();
    assert.equal(gl.projectTokens, GL_TOKENS);
    assert.equal(gl.tokens, GL_TOKENS);
    assert.equal(gl.newToken("Agent M", "Agent M dashboard", 90), GL_TOKENS);
    assert.equal(gl.newRepository, `${GL_ORIGIN}/projects/new`);
    for (const page of [gh.tokens, gh.newToken("n", "d", 30), gh.newRepository, gl.tokens, gl.projectTokens, gl.newRepository]) {
      assert.ok(!page.includes(GH_TOKEN) && !page.includes(GL_TOKEN), page);
    }
  });
  assert.deepEqual(sent, [], "no request is made");
});

// ---------------------------------------------------------------- an empty repository (MOD-repository-hosts as drafted in 617d061)

// UC-001 5 · Expected: a repository without a commit — GitHub answers its Git database with 409 "Git Repository is empty." —
// is read as a snapshot without a commit and without a path; commitFiles with expectedHead null writes the first file through
// the contents API on the branch, with the message — the repository's first commit —, and the other files in one commit on it,
// and returns that second commit. Counter-proofs: a 409 with another message (a repository GitHub is still creating) is a
// failure, Unreachable; expectedHead null on a repository that has a commit is Moved, and nothing is written.
// TST-476074 · level: unit · module: MOD-repository-hosts
// guards: UC-001
// given: a fake GitHub repository without a commit, whose Git database answers 409 Git Repository is empty.; counter-cases: a 409 with another message, and a repository that has a commit
// input: readSnapshot; commitFiles with expectedHead null
// expect: the snapshot is read without a commit and without a path; the first file is written through the contents API on the branch with the message and the other files in one commit on it, which is returned; another 409 fails as Unreachable; expectedHead null on a repository that has a commit is Moved and nothing is written
test("UC-001 5 — an empty repository: no commit and no path; its first commit through the contents API, the others in one commit on it", async () => {
  const gh = fakeGitHub({ empty: true });
  await using(gh.fetch, async () => {
    const host = connect(GITHUB, { token: GH_TOKEN });
    const snap = await host.readSnapshot("main");
    assert.equal(snap.commit, null, "no commit");
    assert.deepEqual(snap.paths, [], "no path");
    const done = await host.commitFiles({ branch: "main", expectedHead: null, message: "Add the Agent M review layout",
      files: [{ path: "SPEC.md", text: "# s\n" }, { path: "docs/use-cases/README.md", text: "u\n" }, { path: "CHANGELOG.md", text: "c\n" }] });
    assert.equal(done.commit, gh.head(), "the second commit is returned, and main stands at it");
    assert.deepEqual(Object.fromEntries(Object.entries(gh.filesAt(gh.head())).map(([p, b]) => [p, b.toString()])),
      { "SPEC.md": "# s\n", "docs/use-cases/README.md": "u\n", "CHANGELOG.md": "c\n" }, "every file");
    const first = gh.parentOf(gh.head());
    assert.ok(first && gh.parentOf(first) === null, "two commits, the first without a parent");
    assert.deepEqual(Object.keys(gh.filesAt(first)), ["SPEC.md"], "the first commit holds the first file");
    const puts = gh.requests.filter((r) => r.method === "PUT");
    assert.equal(puts.length, 1, "one file through the contents API");
    assert.equal(puts[0].path, "/repos/alice/thesis-tool/contents/SPEC.md");
    assert.deepEqual({ branch: puts[0].body.branch, message: puts[0].body.message, text: Buffer.from(puts[0].body.content, "base64").toString() },
      { branch: "main", message: "Add the Agent M review layout", text: "# s\n" });
  });
  const creating = fakeGitHub({ empty: true,
    answer: (r) => (r.path.endsWith("/commits/main") ? json(409, { message: "Repository is being created", status: "409" }) : null) });
  await using(creating.fetch, async () => {
    await assert.rejects(connect(GITHUB, { token: GH_TOKEN }).readSnapshot("main"), (e) => e.name === "Unreachable",
      "counter-proof: another 409 is a failure");
  });
  const full = fakeGitHub();
  await using(full.fetch, async () => {
    await assert.rejects(connect(GITHUB, { token: GH_TOKEN }).commitFiles({ branch: "main", expectedHead: null, message: "m",
      files: [{ path: "SPEC.md", text: "x\n" }] }), (e) => e.name === "Moved", "counter-proof: a repository with a commit is not empty");
    assert.equal(full.made(), 0, "nothing written");
    assert.ok(!full.requests.some((r) => r.method === "PUT"), "no file through the contents API");
  });
});

// Expected: a GitLab project is not given a first commit — commitFiles with expectedHead null is refused NotFound with the advice
// to push a first commit to it, and no request is made (MOD-repository-hosts as drafted in 617d061).
// TST-476075 · level: unit · module: MOD-repository-hosts
// guards: UC-001
// given: a fake GitLab project without a commit
// input: commitFiles with expectedHead null
// expect: commitFiles is refused with NotFound advising to push a first commit to the project, and no request is made
test("UC-001 5 — on a GitLab server, a first commit is refused with the advice to push one, and nothing is requested", async () => {
  const gl = fakeGitLab();
  await using(gl.fetch, async () => {
    await assert.rejects(connect(GITLAB, { token: GL_TOKEN }).commitFiles({ branch: "main", expectedHead: null, message: "m",
      files: [{ path: "SPEC.md", text: "x\n" }] }), (e) => e.name === "NotFound" && /has no commit yet — push a first commit to it/.test(e.message));
  });
  assert.deepEqual(gl.requests, [], "no request");
});

// ---------------------------------------------------------------- what UC-001 reads

// UC-001 4 · A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN — Expected, in one request each: the repository's default branch, the
// visibility its server reports, whether the stored token may write, whether it is archived, and its description, empty where it
// has none. On GitHub a token that reaches a private repository may write; a public one read without a token may not. On a GitLab
// server a project token with role Maintainer may write; one with role Developer may not, for a protected default branch takes a
// Maintainer; a project read without a token may not; an internal project is reported as internal.
// TST-476076 · level: unit · module: MOD-repository-hosts
// guards: UC-001; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN
// given: fake GitHub and GitLab servers: a private and a public repository, GitLab projects with a token of role Maintainer and of role Developer, an internal project, a project read without a token
// input: repositoryInfo of each
// expect: in one request each — on GitHub with a token two, the record's and beside it the GraphQL request of greenToMerge (ITM-1170), which these fakes do not answer, so greenToMerge is null throughout —: the default branch, the visibility the server reports, whether the stored token may write, whether it is archived and the description (empty where none); a token reaching a private GitHub repository may write, a public one read without a token may not; Maintainer may write, Developer may not, without a token may not; an internal project is reported as internal
test("UC-001 4 — repositoryInfo: default branch, visibility, whether the token may write, in one request", async () => {
  // ITM-1170: on GitHub with a token, the GraphQL request of greenToMerge goes out beside the record's — two requests there; the fakes answer no GraphQL field, so greenToMerge is null.
  const info = async (fake, credentials, address, requests = 1) => {
    const v = await using(fake.fetch, () => connect(address, credentials).repositoryInfo());
    assert.equal(fake.requests.length, requests, `${requests} request(s)`);
    return v;
  };
  assert.deepEqual(await info(fakeGitHub(), { token: GH_TOKEN }, GITHUB, 2),
    { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "A tool for theses", greenToMerge: null });
  assert.deepEqual(await info(fakeGitHub({ visibility: "public" }), {}, GITHUB),
    { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "A tool for theses", greenToMerge: null });
  assert.deepEqual(await info(fakeGitLab(), { token: GL_TOKEN }, GITLAB),
    { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "A tool for theses", greenToMerge: null });
  assert.equal((await info(fakeGitLab({ level: 30 }), { token: GL_TOKEN }, GITLAB)).canWrite, false, "role Developer");
  assert.deepEqual(await info(fakeGitLab({ visibility: "internal", description: null }), { token: GL_TOKEN }, GITLAB),
    { defaultBranch: "main", visibility: "internal", canWrite: true, archived: false, description: "", greenToMerge: null });
  assert.equal((await info(fakeGitLab({ visibility: "public" }), {}, GITLAB)).canWrite, false, "without a token");
});

// UC-001 4 · A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN — level: unit · module: MOD-repository-hosts
// given: a GitLab address whose server answers "Get a single project" with 200 and a body that reports neither a visibility nor a
//   default branch — an empty object, an object of other keys, null —; known positive: a project that reports its visibility and
//   no branch yet (an empty project)
// input: repositoryInfo of each, with the project token
// expect: each of the three fails as HostError Unreachable whose reason is "gitlab.example.org did not answer as a GitLab server";
//   the empty project is reachable, with defaultBranch null and its visibility
test("UC-001 4 — repositoryInfo: a server whose answer reports neither a visibility nor a default branch did not answer as a GitLab server", async () => {
  const answer = (body) => async () => json(200, body);
  const empty = await using(answer({ path_with_namespace: "grp/sub/thesis-tool", visibility: "private", default_branch: null }),
    () => connect(GITLAB, { token: GL_TOKEN }).repositoryInfo());
  assert.deepEqual([empty.defaultBranch, empty.visibility], [null, "private"], "known positive: an empty project is reachable");
  for (const body of [{}, { hello: "world" }, null]) {
    const e = await using(answer(body), () => failure(connect(GITLAB, { token: GL_TOKEN }).repositoryInfo()));
    assert.ok(e instanceof HostError, JSON.stringify(body));
    assert.deepEqual([e.name, e.reason], ["Unreachable", "gitlab.example.org did not answer as a GitLab server"], JSON.stringify(body));
  }
});

// UC-001 4–5 · GITLAB PRODUCTS ARE SUPPORTED — Expected, on GitHub and on a GitLab server: a snapshot is the repository at one
// commit — the branch is resolved once, and the tree and every file are read at that commit, never by the branch's name, so that
// a commit pushed after the snapshot changes nothing it reads; it lists every file of that commit — on GitLab across the pages of
// the tree —, gives each file's blob SHA without a request, and reads each file's text once, exactly; a path the commit does not
// hold is read as null, and its blob as null, without a request.
// TST-476077 · level: unit · module: MOD-repository-hosts
// guards: UC-001; GITLAB PRODUCTS ARE SUPPORTED
// given: fake GitHub and GitLab servers holding the repository's files, GitLab with a paged tree
// input: readSnapshot of the branch; reading files, blob() and a missing path
// expect: the snapshot is the repository at one commit: the branch is resolved once and the tree and every file are read at that commit, never by the branch name; it lists every file, gives each blob SHA without a request, reads each file's text once, exactly; a missing path is read as null and its blob as null without a request
test("UC-001 4–5 — readSnapshot: the repository at one commit, its files read at that commit, each once", async () => {
  const many = { ...FILES };
  for (let i = 0; i < 130; i++) many[`docs/approvals/r${String(i).padStart(3, "0")}.md`] = `kind: use-case\nn: ${i}\n`;
  for (const [fake, address, token] of [[fakeGitHub({ files: many }), GITHUB, GH_TOKEN], [fakeGitLab({ files: many }), GITLAB, GL_TOKEN]]) {
    const label = address.server;
    const host = connect(address, { token });
    const snap = await using(fake.fetch, () => host.readSnapshot("main"));
    const commit = fake.head();
    assert.equal(snap.commit, commit, label);
    assert.equal(snap.ref, "main", label);
    assert.deepEqual(snap.repository, address, label);
    assert.deepEqual([...snap.paths].sort(), Object.keys(many).sort(), `${label}: every file of the commit`);
    const resolved = fake.requests.length;
    assert.equal(snap.blob("SPEC.md"), blobSha(utf8(FILES["SPEC.md"])), label);
    assert.equal(snap.blob("no/such.md"), null, label);
    fake.push({ "SPEC.md": "pushed after the snapshot\n" });
    const texts = await using(fake.fetch, async () => [await snap.read("SPEC.md"), await snap.read("SPEC.md"), await snap.read("no/such.md")]);
    assert.deepEqual(texts, [FILES["SPEC.md"], FILES["SPEC.md"], null], `${label}: the text at the snapshot's commit, exactly`);
    assert.equal(fake.requests.length - resolved, 1, `${label}: one request for one file, read twice; none for blob() or a missing path`);
    assert.equal(fake.requests.filter((q) => /\bmain\b/.test(decodeURIComponent(q.href))).length, 1,
      `${label}: the branch is resolved once, and nothing else is read by its name`);
  }
});

// ---------------------------------------------------------------- how a read fails

// UC-001 2a, 4a · A REMOTE INTERFACE NAMES HOW IT FAILS — Expected: a repository the server does not have, or does not show
// without a token, fails repositoryInfo and readSnapshot with NotFound naming the repository; a branch it does not have fails
// readSnapshot with NotFound naming that branch; a server the page cannot reach — the browser's fetch fails with a TypeError, as
// it does for a server that refuses the page's origin — fails every call with Unreachable, giving the browser's reason, on GitHub
// and on a GitLab server alike.
// TST-476078 · level: unit · module: MOD-repository-hosts
// guards: UC-001; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: fake GitHub and GitLab servers lacking the repository (or not showing it without a token) and lacking the branch; a fetch that fails with a TypeError, as for a server refusing the page's origin
// input: repositoryInfo, readSnapshot and commitFiles of each
// expect: a missing repository fails repositoryInfo and readSnapshot with NotFound naming the repository; a missing branch fails readSnapshot with NotFound naming the branch; an unreachable server fails every call with Unreachable giving the browser's reason, on GitHub and GitLab alike
test("UC-001 2a, 4a — NotFound names the repository or the branch; a server the page cannot reach is Unreachable", async () => {
  for (const [fake, address, token] of [[fakeGitHub(), GITHUB, GH_TOKEN], [fakeGitLab(), GITLAB, GL_TOKEN]]) {
    const label = address.server;
    for (const call of [(h) => h.repositoryInfo(), (h) => h.readSnapshot("main")]) {
      const e = await using(fake.fetch, () => failure(call(connect(address, {}))));
      assert.deepEqual([e instanceof HostError, e?.name], [true, "NotFound"], `${label}: a private repository without a token`);
      assert.match(String(e.what), /thesis-tool/, `${label}: the repository is named`);
    }
    const b = await using(fake.fetch, () => failure(connect(address, { token }).readSnapshot("no-such-branch")));
    assert.deepEqual([b?.name, /no-such-branch/.test(String(b?.what))], ["NotFound", true], `${label}: the branch is named`);
    const away = async () => { throw new TypeError("Failed to fetch"); };
    for (const call of [(h) => h.repositoryInfo(), (h) => h.readSnapshot("main"),
      (h) => h.commitFiles({ branch: "main", expectedHead: "a".repeat(40), message: "m", files: LAYOUT })]) {
      const u = await using(away, () => failure(call(connect(address, { token }))));
      assert.deepEqual([u instanceof HostError, u?.name], [true, "Unreachable"], label);
      assert.match(String(u.reason), /Failed to fetch/, `${label}: the browser's reason`);
    }
  }
});

// ---------------------------------------------------------------- NO SECRET IN THE REPOSITORY

// NO SECRET IN THE REPOSITORY — Expected: a commit with a file whose text holds a configured secret, or the host's own token, is
// refused as a whole with SecretRefused naming that file — never the secret's value — before anything is sent, on GitHub and on
// a GitLab server. Counter-proof: the same commit without the secret is written.
// TST-476079 · level: unit · module: MOD-repository-hosts
// guards: NO SECRET IN THE REPOSITORY
// given: a commit with a file whose text holds a configured secret, or the host's own token; on GitHub and on a GitLab server; the same commit without the secret
// input: commitFiles of the commit
// expect: it is refused as a whole with SecretRefused naming the file, never the secret's value, before anything is sent; the same commit without the secret is written
test("NO SECRET IN THE REPOSITORY — a commit holding a configured secret or the token is refused before anything is sent", async () => {
  const secret = "endpoint-key-CONFIGURED-0123456789";
  for (const [make, address, token] of [[fakeGitHub, GITHUB, GH_TOKEN], [fakeGitLab, GITLAB, GL_TOKEN]]) {
    for (const value of [secret, token]) {
      const fake = make();
      const e = await using(fake.fetch, () => failure(connect(address, { token, secrets: [secret] }).commitFiles({ branch: "main",
        expectedHead: fake.head(), message: "m", files: [{ path: "docs/a.md", text: "fine\n" }, { path: "docs/b.md", text: `key: ${value}\n` }] })));
      assert.deepEqual([e instanceof HostError, e?.name, e?.path], [true, "SecretRefused", "docs/b.md"], `${address.server}`);
      assert.ok(!e.message.includes(value), "named by file, never by value");
      assert.deepEqual(fake.requests, [], "nothing is sent");
    }
    const fake = make();
    await using(fake.fetch, () => connect(address, { token, secrets: [secret] }).commitFiles({ branch: "main", expectedHead: fake.head(),
      message: "m", files: [{ path: "docs/a.md", text: "fine\n" }, { path: "docs/b.md", text: "key: kept in the browser\n" }] }));
    assert.equal(fake.made(), 1, `${address.server}: known positive, written without the secret`);
  }
});

// TST-1065001 · level: unit · module: MOD-repository-hosts
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; NO SECRET IN THE REPOSITORY
// given: a GitHub address and a GitLab address, and texts that are no token of either server: "my password", "tok", "secret" and "github-secret"
// input: connect(address, { token: text }) for each text on each address; and, as known positives, connect with github_pat_x, ghp_x and glpat-x on the server of their kind, with no token and with the empty text
// expect: each of the texts is refused with a TypeError whose message is exactly "That is no token of either server." — the same for every text, so it holds none of them — and no request is sent; the known positives are accepted (github_pat_x is accepted, whatever its length) and the token of the other kind is still refused with its own message
test("connect refuses a text that is no token of either server, with a message that never holds it", async () => {
  const fake = fakeGitHub();
  await using(fake.fetch, async () => {
    for (const address of [GITHUB, GITLAB]) {
      for (const text of ["my password", "tok", "secret", "github-secret"]) {
        assert.throws(() => connect(address, { token: text }), (error) => error instanceof TypeError && error.message === "That is no token of either server.", `${address.web}: ${text}`);
      }
    }
    for (const [address, token] of [[GITHUB, "github_pat_x"], [GITHUB, "ghp_x"], [GITLAB, "glpat-x"], [GITHUB, null], [GITHUB, ""], [GITLAB, undefined]]) {
      assert.doesNotThrow(() => connect(address, { token }), `${address.web}: ${JSON.stringify(token)} is accepted`);
    }
    assert.throws(() => connect(GITHUB, { token: "glpat-x" }), /That is a GitLab token/);
    assert.throws(() => connect(GITLAB, { token: "github_pat_x" }), /That is a GitHub token/);
  });
  assert.deepEqual(fake.requests, [], "nothing is sent");
});
