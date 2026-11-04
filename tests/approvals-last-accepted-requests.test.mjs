// MOD-approvals' lastAcceptedText reads the commit that added each record without that commit's changes (ITM-929), as the accepted texts
// state it: MOD-approvals — "lastAcceptedText(id: string, host: Host) -> Promise<{ text: string, blob: string, path: string } | null> — the
// text named by the most recent approval record of an identifier … Considers: "most recent" is the order of the commits that added the
// records. Crosses the network: reads the history of the records and of the file through the host" — and MOD-repository-hosts — "readHistory(
// path: string | null, options: { ref?: string, limit?: number, changes?: boolean }) -> Promise<HistoryEntry[]> — … With `changes: false`,
// each entry's `changes` is empty and the history costs one request per page of commits; otherwise each entry lists its changes."
// The function uses only the commit and the date of each record's adding commit, so the request for that commit's changes is not made. It reads the
// file at the commit that added the record with readFileAt(file, [commit]) (ITM-1291): "readFileAt(path: string, commits: string[]) … It reads in
// batches, not one snapshot per commit: with a token, one request per batch of commits through the server's batch query, as `readMany` reads".
// Through the REAL GitHub and GitLab hosts of src/repository-hosts (connect with a token), over counting fakes of the two servers' REST
// APIs that answer as the real APIs document — GitHub: "Get a repository", "Get a commit" (a name resolves to a commit; with per_page the
// commit's files), "Get a tree", "List commits" (sha, path, per_page, page), "Get repository content" (raw), and the GraphQL batch query of readFileAt (`repository.object(expression: "<commit>:<path>")`, a Blob's `text`, served by tests/repository-hosts-batch-fake.mjs); GitLab: "Get a single
// project", "Get a single commit", "List repository tree", "List repository commits" (ref_name, path, follow, per_page, page), "Get the
// diff of a commit", "Get raw file from repository". Nothing reaches the network.
// Run: node --test tests/approvals-last-accepted-requests.test.mjs
//
// Module: MOD-approvals
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// Level: unit
//
// One history serves every test: eleven commits of a repository, oldest first. UC-010 is accepted four times (records at commits 2, 4,
// 6 and 8) and edited after the last one; UC-011 is accepted once (commit 10) and edited after it. The request counts in each test are
// the numbers written in its own text; they are not read from any document. Each test states its input and its expected result before
// it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import { treeRequest, treeAnswer } from "./github-trees-fake.mjs";
import { batchAnswer, askedBy } from "./repository-hosts-batch-fake.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";
import { lastAcceptedText } from "../src/approvals/index.mjs";

// ---------------------------------------------------------------- the history the servers hold

const text = (...lines) => `${lines.join("\n")}\n`;
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const blobOf = (body) => sha1(`blob ${Buffer.byteLength(body)}\0${body}`);

const useCase = (id, title, sentence) => text("---", `id: ${id}`, `title: ${title}`, "area: files", "actors:", "  - Reader",
  "realises:", "  - A SAMPLE RULE", "---", `# ${id} ${title}`, "", `**Goal.** ${sentence}`);
const UC10 = "docs/use-cases/UC-010-send-a-file.md", UC11 = "docs/use-cases/UC-011-receive-a-file.md";
const V = [1, 2, 3, 4, 5].map((n) => useCase("UC-010", "Send a file", `The sender picks a file and sends it, in version ${n}.`));
const W = [1, 2].map((n) => useCase("UC-011", "Receive a file", `The receiver opens a file that was sent, in version ${n}.`));
const record = (id, file, body) => ({ [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`]: text("kind: use-case", `file: ${file}`, `blob: ${blobOf(body)}`) });

// Each step writes files (a path to its text) on top of the commit before it.
const STEPS = [
  { [UC10]: V[0], [UC11]: W[0] },
  record("UC-010", UC10, V[0]),
  { [UC10]: V[1] },
  record("UC-010", UC10, V[1]),
  { [UC10]: V[2] },
  record("UC-010", UC10, V[2]),
  { [UC10]: V[3] },
  record("UC-010", UC10, V[3]),
  { [UC10]: V[4] },
  record("UC-011", UC11, W[0]),
  { [UC11]: W[1] },
];
const COMMITS = [];
STEPS.forEach((files, n) => {
  const tree = new Map(n ? COMMITS[n - 1].tree : []);
  for (const [path, body] of Object.entries(files)) tree.set(path, body);
  COMMITS.push({ sha: sha1(`commit ${n + 1}`), tree, changed: Object.keys(files), date: `2026-10-${String(n + 1).padStart(2, "0")}T09:00:00Z`,
    parents: n ? [COMMITS[n - 1].sha] : [], message: `step ${n + 1}` });
});
const HEAD = COMMITS.at(-1);

// The commits reachable from `ref` (a name — the default branch is `main` — or a commit), newest first, that changed `path` (all where none).
function listed(ref, path) {
  const start = ref === "main" ? COMMITS.length - 1 : COMMITS.findIndex((c) => c.sha === ref);
  if (start < 0) return null;
  return COMMITS.slice(0, start + 1).reverse().filter((c) => !path || c.changed.includes(path));
}
const page = (items, query, byDefault) => {
  const per = Number(query.per_page ?? byDefault), n = Number(query.page ?? 1);
  return items.slice((n - 1) * per, n * per);
};

// ---------------------------------------------------------------- the fake servers

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
function seen(input, init = {}) {
  const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
  return { method: String(init.method ?? "GET").toUpperCase(), origin: url.origin, path: url.pathname, query: Object.fromEntries(url.searchParams) };
}
async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);

const KINDS = ["repository", "commit", "tree", "list", "detail", "file", "folders", "batch", "other"];
// How many requests of each kind a fake has been sent.
const tally = (requests) => Object.fromEntries(KINDS.map((kind) => [kind, requests.filter((r) => r.kind === kind).length]));

// GitHub: answer(request) is a canned answer in place of the usual one, for any request.
const GH_TOKEN = "github_pat_ALICEproductTOKEN0123456789abcdef";
const GH_ADDRESS = parseAddress("https://github.com/alice/product");
const GH_PREFIX = "/repos/alice/product";
function fakeGitHub({ answer = null } = {}) {
  const requests = [];
  const notFound = () => json(404, { message: "Not Found" });
  const commitOf = (c) => ({ sha: c.sha, parents: c.parents.map((sha) => ({ sha })), author: { login: "alice" },
    commit: { author: { name: "Alice" }, committer: { date: c.date }, message: c.message } });
  const fetch = async (input, init = {}) => {
    const r = seen(input, init);
    const rest = r.origin === "https://api.github.com" && r.path.startsWith(GH_PREFIX) ? r.path.slice(GH_PREFIX.length) : null;
    let m, kind = "other";
    const tree = treeRequest(new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input)));
    if (tree && (tree.path || !tree.recursive)) kind = "folders";
    else if (r.method === "POST" && r.origin === "https://api.github.com" && r.path === "/graphql") kind = "batch";
    else if (rest === "") kind = "repository";
    else if (rest === "/commits") kind = "list";
    else if ((m = /^\/commits\/([^/]+)$/.exec(rest ?? "")) && r.query.per_page) kind = "detail";
    else if (m) kind = "commit";
    else if (/^\/git\/trees\/[0-9a-f]{40}$/.test(rest ?? "")) kind = "tree";
    else if ((rest ?? "").startsWith("/contents/")) kind = "file";
    requests.push({ ...r, kind, body: typeof init.body === "string" ? init.body : "" });
    const own = answer?.({ ...r, kind });
    if (own) return own;
    if (kind === "folders") {
      // The trees of named folders and the entries of the folders of named files, at the commit asked, as GitHub's "Get a tree" gives them.
      const c = COMMITS.find((x) => x.sha === tree.commit);
      if (!c) return notFound();
      const files = Object.fromEntries(c.tree);
      return treeAnswer(files, tree, (path) => blobOf(files[path]));
    }
    if (kind === "batch") {
      // The batch request of readFileAt: one aliased field for each "<commit>:<path>", the file's text where that commit holds it, null where not.
      const held = (sha, path) => COMMITS.find((x) => x.sha === sha)?.tree.get(path);
      return json(200, batchAnswer(JSON.parse(init.body).query, { held }));
    }
    if (rest === null) return notFound();
    if (kind === "repository") return json(200, { default_branch: "main", visibility: "public", private: false, permissions: { push: true }, archived: false, description: "" });
    if (kind === "list") {
      const all = listed(r.query.sha ?? "main", r.query.path);
      return all === null ? json(404, { message: "No commit found" }) : json(200, page(all, r.query, 30).map(commitOf));
    }
    if (kind === "detail" || kind === "commit") {
      const c = listed(decodeURIComponent(m[1]), null)?.[0];
      if (!c) return json(422, { message: "No commit found for SHA" });
      if (kind === "commit") return json(200, { sha: c.sha });
      return json(200, { ...commitOf(c), files: page(c.changed.map((path) => ({ filename: path, status: "modified" })), r.query, 300) });
    }
    if (kind === "tree") {
      const c = COMMITS.find((x) => x.sha === rest.split("/").pop());
      return c ? json(200, { sha: c.sha, tree: [...c.tree].map(([path, body]) => ({ path, type: "blob", sha: blobOf(body) })), truncated: false }) : notFound();
    }
    if (kind === "file") {
      const c = COMMITS.find((x) => x.sha === r.query.ref);
      const path = decodeURIComponent(rest.slice("/contents/".length));
      return c?.tree.has(path) ? new Response(c.tree.get(path), { status: 200 }) : notFound();
    }
    return notFound();
  };
  return { requests, fetch, tally: () => tally(requests) };
}

// GitLab: the project alice/product on gitlab.example.org.
const GL_TOKEN = "glpat-ALICEproductTOKENvalue0123456789";
const GL_ADDRESS = parseAddress("https://gitlab.example.org/alice/product");
const GL_PREFIX = "/api/v4/projects/alice%2Fproduct";
function fakeGitLab({ answer = null } = {}) {
  const requests = [];
  const notFound = () => json(404, { message: "404 Not Found" });
  const commitOf = (c) => ({ id: c.sha, parent_ids: c.parents, author_name: "Alice", committed_date: c.date, message: c.message });
  const fetch = async (input, init = {}) => {
    const r = seen(input, init);
    const rest = r.origin === "https://gitlab.example.org" && r.path.startsWith(GL_PREFIX) ? r.path.slice(GL_PREFIX.length) : null;
    let m, kind = "other";
    if (rest === "") kind = "repository";
    else if (rest === "/repository/commits") kind = "list";
    else if (/^\/repository\/commits\/[0-9a-f]{40}\/diff$/.test(rest ?? "")) kind = "detail";
    else if (/^\/repository\/commits\/[^/]+$/.test(rest ?? "")) kind = "commit";
    else if (rest === "/repository/tree") kind = "tree";
    else if (/^\/repository\/files\/.+\/raw$/.test(rest ?? "")) kind = "file";
    requests.push({ ...r, kind });
    const own = answer?.({ ...r, kind });
    if (own) return own;
    if (rest === null) return notFound();
    if (kind === "repository") return json(200, { default_branch: "main", visibility: "public", archived: false, description: "", permissions: { project_access: { access_level: 40 } } });
    if (kind === "list") {
      const all = listed(r.query.ref_name ?? "main", r.query.path);
      return all === null ? json(404, { message: "404 Commit Not Found" }) : json(200, page(all, r.query, 20).map(commitOf));
    }
    if (kind === "commit") {
      const c = listed(decodeURIComponent(rest.split("/").pop()), null)?.[0];
      return c ? json(200, commitOf(c)) : notFound();
    }
    if (kind === "detail") {
      const c = COMMITS.find((x) => x.sha === rest.split("/").at(-2));
      return json(200, page(c.changed.map((path) => ({ old_path: path, new_path: path, new_file: false, renamed_file: false, deleted_file: false })), r.query, 20));
    }
    if (kind === "tree") {
      const c = COMMITS.find((x) => x.sha === r.query.ref);
      return json(200, page([...c.tree].map(([path, body]) => ({ path, type: "blob", id: blobOf(body) })), r.query, 20));
    }
    if (kind === "file") {
      const c = COMMITS.find((x) => x.sha === r.query.ref);
      const path = decodeURIComponent(rest.slice("/repository/files/".length, -"/raw".length));
      return c?.tree.has(path) ? new Response(c.tree.get(path), { status: 200 }) : notFound();
    }
    return notFound();
  };
  return { requests, fetch, tally: () => tally(requests) };
}

const onGitHub = (fake, run) => using(fake.fetch, () => run(connect(GH_ADDRESS, { token: GH_TOKEN })));
const onGitLab = (fake, run) => using(fake.fetch, () => run(connect(GL_ADDRESS, { token: GL_TOKEN })));

// ---------------------------------------------------------------- the requests of one answer

// TST-929001 · level: unit · module: MOD-approvals
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above on a GitHub repository, read with a token through the real host; UC-010 has four records and UC-011 one; and, as the known positive of the counting fake, readHistory(UC-010's file, { limit: 1 }) on a fake of its own
// input: lastAcceptedText("UC-010", host) and lastAcceptedText("UC-011", host), each on a fake of its own
// expect: UC-010 gives the text of its fourth record (version 4, not the version 5 the file holds now) with that record's blob and the path of the file; UC-011 gives version 1. The requests of UC-010: 1 of the repository, 1 resolving a commit (the branch; the commit that added the record is not resolved), 1 of a tree (the head's; the older commit's is not read), 0 of the entries of a folder, 4 "List commits" (one for each of its four records), 0 "Get a commit" for the files of a commit, 1 of a file (the record), 1 batch request (the use case at the commit that added the record), and the GraphQL request of greenToMerge beside the repository (ITM-1170; the fake counts it as a batch) — 10 in all; of UC-011: 1, 1, 1, 0 entries, 1 list, 0 commit files, 1 file, 1 batch and greenToMerge's — 7 in all. Known positive: readHistory(UC-010's file, { limit: 1 }) without the option sends 1 "List commits" and 1 "Get a commit" for files, and with `changes: false` 1 and none
test("MOD-approvals lastAcceptedText — one answer sends no request for the changes of a commit, one list for each record (GitHub)", async () => {
  const positive = fakeGitHub();
  await onGitHub(positive, (host) => host.readHistory(UC10, { limit: 1 }));
  assert.deepEqual([positive.tally().list, positive.tally().detail], [1, 1], "known positive: the fake counts the request for a commit's files");
  const without = fakeGitHub();
  await onGitHub(without, (host) => host.readHistory(UC10, { limit: 1, changes: false }));
  assert.deepEqual([without.tally().list, without.tally().detail], [1, 0], "known positive: with changes false, none");

  const four = fakeGitHub();
  const sent = await onGitHub(four, (host) => lastAcceptedText("UC-010", host));
  assert.deepEqual(sent, { text: V[3], blob: blobOf(V[3]), path: UC10 });
  // ITM-1170: the fake counts every POST /graphql as a batch; the second is greenToMerge's, beside the repository's information.
  assert.deepEqual(four.tally(), { repository: 1, commit: 1, tree: 1, list: 4, detail: 0, file: 1, folders: 0, batch: 2, other: 0 });
  assert.equal(four.requests.length, 10);

  const one = fakeGitHub();
  const received = await onGitHub(one, (host) => lastAcceptedText("UC-011", host));
  assert.deepEqual(received, { text: W[0], blob: blobOf(W[0]), path: UC11 });
  assert.deepEqual(one.tally(), { repository: 1, commit: 1, tree: 1, list: 1, detail: 0, file: 1, folders: 0, batch: 2, other: 0 });
  assert.equal(one.requests.length, 7);
});

// TST-929002 · level: unit · module: MOD-approvals
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above on a GitLab project, read with a token through the real host; UC-010 has four records and UC-011 one; and, as the known positive of the counting fake, readHistory(UC-010's file, { limit: 1 }) on a fake of its own
// input: lastAcceptedText("UC-010", host) and lastAcceptedText("UC-011", host), each on a fake of its own
// expect: the same texts as on GitHub. The requests of UC-010: 1 of the project, 1 resolving a commit (the branch), 1 of a tree (the head's), 4 "List repository commits", 0 diffs of a commit, 2 of a raw file (the record, and the use case at the commit that added it, GitLab's readFileAt) — 9 in all; of UC-011: 1, 1, 1, 1, 0, 2 — 6 in all. Known positive: readHistory(UC-010's file, { limit: 1 }) without the option sends 1 list and 1 diff, and with `changes: false` 1 and none
test("MOD-approvals lastAcceptedText — one answer sends no request for the diff of a commit, one list for each record (GitLab)", async () => {
  const positive = fakeGitLab();
  await onGitLab(positive, (host) => host.readHistory(UC10, { limit: 1 }));
  assert.deepEqual([positive.tally().list, positive.tally().detail], [1, 1], "known positive: the fake counts the request for a commit's diff");
  const without = fakeGitLab();
  await onGitLab(without, (host) => host.readHistory(UC10, { limit: 1, changes: false }));
  assert.deepEqual([without.tally().list, without.tally().detail], [1, 0], "known positive: with changes false, none");

  const four = fakeGitLab();
  const sent = await onGitLab(four, (host) => lastAcceptedText("UC-010", host));
  assert.deepEqual(sent, { text: V[3], blob: blobOf(V[3]), path: UC10 });
  assert.deepEqual(four.tally(), { repository: 1, commit: 1, tree: 1, list: 4, detail: 0, file: 2, folders: 0, batch: 0, other: 0 });
  assert.equal(four.requests.length, 9);

  const one = fakeGitLab();
  const received = await onGitLab(one, (host) => lastAcceptedText("UC-011", host));
  assert.deepEqual(received, { text: W[0], blob: blobOf(W[0]), path: UC11 });
  assert.deepEqual(one.tally(), { repository: 1, commit: 1, tree: 1, list: 1, detail: 0, file: 2, folders: 0, batch: 0, other: 0 });
  assert.equal(one.requests.length, 6);
});

// ---------------------------------------------------------------- a server that refuses the changes

// TST-929003 · level: unit · module: MOD-approvals
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: the history above on a GitHub repository and on a GitLab project that list commits and serve files well and answer every request for the files or the diff of a commit with a used-up rate limit (GitHub: 403 with X-RateLimit-Remaining 0; GitLab: 429)
// input: lastAcceptedText("UC-010", host) on each; and, as the known positive, readHistory(UC-010's file, { limit: 1 }) on the same refusing server
// expect: lastAcceptedText gives the text of UC-010's fourth record, version 4, as without the refusal, since no commit's changes are asked for; the known positive fails with RateLimited, so the refusal is in force
test("MOD-approvals lastAcceptedText — a server that refuses the changes of a commit does not fail it (GitHub, GitLab)", async () => {
  const limited = { "X-RateLimit-Limit": "5000", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1790000000" };
  const refusingGitHub = () => fakeGitHub({ answer: (r) => (r.kind === "detail" ? json(403, { message: "API rate limit exceeded" }, limited) : null) });
  const refusingGitLab = () => fakeGitLab({ answer: (r) => (r.kind === "detail" ? json(429, { message: "Retry later" }) : null) });

  const hubKnown = await onGitHub(refusingGitHub(), (host) => failure(host.readHistory(UC10, { limit: 1 })));
  assert.equal(hubKnown?.name, "RateLimited", "known positive, GitHub: reading the changes meets the refusal");
  const labKnown = await onGitLab(refusingGitLab(), (host) => failure(host.readHistory(UC10, { limit: 1 })));
  assert.equal(labKnown?.name, "RateLimited", "known positive, GitLab: reading the diff meets the refusal");

  const hub = await onGitHub(refusingGitHub(), (host) => lastAcceptedText("UC-010", host));
  assert.deepEqual(hub, { text: V[3], blob: blobOf(V[3]), path: UC10 }, "GitHub");
  const lab = await onGitLab(refusingGitLab(), (host) => lastAcceptedText("UC-010", host));
  assert.deepEqual(lab, { text: V[3], blob: blobOf(V[3]), path: UC10 }, "GitLab");
});

// ---------------------------------------------------------------- the older text in one request (ITM-1291)

// The commit that added UC-010's newest record (the eighth), and the requests a fake was sent that name it — in their address or in their body.
const ADDING_UC10 = COMMITS[7].sha;
const naming = (fake, sha) => fake.requests.filter((r) => r.path.includes(sha) || Object.values(r.query).includes(sha) || r.body.includes(sha));

// TST-1291101 · level: unit · module: MOD-approvals
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the history above on a GitHub repository, read with a token through the real host; UC-010's newest record was added by the eighth commit
// input: lastAcceptedText("UC-010", host)
// expect: the text of its fourth record (version 4) with that record's blob and the path of the file; of the requests sent, exactly one names the commit that added the record — one batch request (MOD-repository-hosts' readFileAt) asking for UC-010's file at that commit —, and none of them resolves that commit or asks for a tree or the entries of a folder at it
test("MOD-approvals lastAcceptedText — the older text is one request, and the older commit and its tree are not read (GitHub)", async () => {
  const fake = fakeGitHub();
  const sent = await onGitHub(fake, (host) => lastAcceptedText("UC-010", host));
  assert.deepEqual(sent, { text: V[3], blob: blobOf(V[3]), path: UC10 });
  const older = naming(fake, ADDING_UC10);
  assert.deepEqual(older.map((r) => r.kind), ["batch"], "one request names the older commit, the batch request");
  assert.deepEqual(askedBy(JSON.parse(older[0].body).query).map(({ commit, path }) => [commit, path]), [[ADDING_UC10, UC10]], "it asks for UC-010's file at that commit");
});

// TST-1291102 · level: unit · module: MOD-approvals
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same history and fake; known positive of TST-1291101's count
// input: readSnapshot(the commit that added UC-010's newest record, { folders: [UC-010's file] }) and a read of UC-010 from it, called directly on the host
// expect: that reading gives version 4, and the requests naming the older commit are counted: one that resolves the commit, one for the entries of the folder at it and one for the file at it — so that a lastAcceptedText reading the older text so would fail TST-1291101
test("MOD-approvals lastAcceptedText — known positive: the fake counts the requests of a snapshot of the older commit (GitHub)", async () => {
  const fake = fakeGitHub();
  const text4 = await onGitHub(fake, async (host) => (await host.readSnapshot(ADDING_UC10, { folders: [UC10] })).read(UC10));
  assert.equal(text4, V[3]);
  assert.deepEqual(naming(fake, ADDING_UC10).map((r) => r.kind).sort(), ["commit", "file", "folders"]);
});
