// The library reads the register in batches (ITM-704) — MOD-settings-pages' routes `library`, `library/<source>` and `sources` read the instance's register `docs/sources/SRC-*.md` through
// `readRegisterOf`. The SPEC requirement A PAGE LOAD READS THE REPOSITORY IN BATCHES asks that, with a token on GitHub, a page load read "the texts of the files it shows in requests of at most
// 100 files each"; MOD-repository-hosts' Snapshot.readMany is the interface that does so. Each test counts the requests that MOD-repository-hosts' real GitHub host makes over a fake of fetch
// that holds a register of many entries (250 entries, the size at which three batches are told apart), with a token and without one; nothing reaches the network.
// Run: node --test tests/settings-pages-library-batches.test.mjs
//
// Module: MOD-settings-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-004; UC-015
// Level: unit
//
// Each test names its given, its input and its expected result in its own text before it runs; no expected value is read from a document, and none from the code. Readings the test takes:
//   - "at most 100 files each" is read as one request for every hundred entries of the register, the last request holding the rest: 250 entries are 3 requests of 100, 100 and 50.
//   - The files a batch names are the register's entries (`docs/sources/SRC-<name>.md` directly in that folder), and no other file of the snapshot.
//   - Without a token the host reads nothing ahead (MOD-repository-hosts' Snapshot), so each entry is read by its own request, as before.
// The counter-proofs (a planted fault in src/settings-pages/library.mjs and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byClass } from "./settings-pages-harness.mjs";
import { attachedTarget, freshStore } from "./settings-pages-setup.d/dom.mjs";
import { githubWorld, installWorld, registerEntry, settled } from "./settings-pages-sources.d/github.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { readRegisterOf } = await import("../src/settings-pages/library.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");

const INSTANCE = "alice/agent-m", PRODUCT = "bob/product", TOKEN = "github_pat_ALICEbatchesREGISTER0123456789";
const routeNamed = (name) => view.routes.find((candidate) => candidate.name === name);

// The id of the n-th entry: SRC-s000, SRC-s001, … so that the order of the files is the order of the numbers.
const idOf = (n) => `SRC-s${String(n).padStart(3, "0")}`;
const entryFile = (n) => registerEntry({ id: idOf(n), title: `Source ${n}`, kind: "document", authority: "advisory", licence: "may be republished — constructed",
  versions: [{ version: `v${n}`, date: "2026-10-01", hash: String(n % 10).repeat(64) }] });
// `count` entries, and files that are no entry: the version folder of one, the links file and a SPEC.
function registerOf(count) {
  const files = { "SPEC.md": "# Spec\n", "docs/sources.md": "# Requirement sources\n", "docs/sources/SRC-s000/v0/file-v0.md": "stored content\n" };
  for (let n = 0; n < count; n++) files[`docs/sources/${idOf(n)}.md`] = entryFile(n);
  return files;
}

// A world of the test `t`: the instance with `count` entries and a product over tests/settings-pages-sources.d/github.mjs' fake of GitHub (whose GraphQL API answers a query for many files),
// fetch replaced by it; what the test counts is read from the requests it recorded, for a repository.
function world(t, count) {
  const github = githubWorld({ [INSTANCE]: { files: registerOf(count) }, [PRODUCT]: { files: { "SPEC.md": "# Spec\n" } } });
  installWorld(t, github);
  const of = (repository) => github.requests.filter((request) => request.repository === repository);
  return {
    ...github,
    batches: (repository = INSTANCE) => of(repository).filter((request) => request.url.pathname === "/graphql").map((request) => request.named.length),
    count: (kind, repository = INSTANCE) => of(repository).filter((request) => ({
      contents: request.url.pathname.includes("/contents/") || request.url.origin === "https://raw.githubusercontent.com",
      commit: request.url.pathname.endsWith("/commits/main"), tree: request.url.pathname.includes("/git/trees/") })[kind]).length,
  };
}
const hostOf = (repository, token) => connect(parseAddress(`https://github.com/${repository}`), token ? { token } : {});
const ids = (entries) => entries.map((entry) => entry.id);

// With a token, 250 entries are read in three batches of 100, 100 and 50 files, and by no request of their own: the page's commit and tree are each read once.
// TST-704001 · level: unit · module: MOD-settings-pages
// given: the instance holds 250 register entries and 3 other files; a GitHub host with a token
// input: readRegisterOf(host)
// expect: the 250 entries in the order of their files (SRC-s000 … SRC-s249, "Source 0" … "Source 249"); 3 GraphQL requests naming 100, 100 and 50 files, after greenToMerge's, which names none (ITM-1170); 0 requests to /contents; 1 request for the commit and 1 for the tree
test("readRegisterOf with a token: 250 entries in three batches of 100, 100 and 50, and no request of their own", async (t) => {
  const github = world(t, 250);
  const { entries, branch } = await readRegisterOf(hostOf(INSTANCE, TOKEN));
  assert.equal(branch, "main");
  assert.deepEqual(ids(entries), Array.from({ length: 250 }, (_, n) => idOf(n)));
  assert.equal(entries[7].fields.title, "Source 7");
  // ITM-1170: the first POST /graphql, naming no file, is greenToMerge's beside repositoryInfo.
  assert.deepEqual(github.batches(), [0, 100, 100, 50]);
  assert.equal(github.count("contents"), 0);
  assert.equal(github.count("commit"), 1);
  assert.equal(github.count("tree"), 1);
});

// The batch size is a hundred files: 100 entries are one batch, 101 are two, and no entry is no batch; the files that are no entry are not named.
// TST-704002 · level: unit · module: MOD-settings-pages
// given: the instance holds 100, then 101, then 0 register entries, besides 3 other files; a GitHub host with a token
// input: readRegisterOf(host) for each
// expect: each after greenToMerge's GraphQL request, which names no file (ITM-1170) — 100 entries: batches [100]; 101 entries: batches [100, 1]; 0 entries: no other GraphQL request and no /contents request; every entry in the result and none other
test("readRegisterOf with a token: one batch per hundred entries, the last holding the rest, and none for an empty register", async (t) => {
  for (const [count, expected] of [[100, [0, 100]], [101, [0, 100, 1]], [0, [0]]]) {
    const github = world(t, count);
    const { entries } = await readRegisterOf(hostOf(INSTANCE, TOKEN));
    assert.equal(entries.length, count, `${count} entries`);
    assert.deepEqual(github.batches(), expected, `${count} entries`);
    assert.equal(github.count("contents"), 0, `${count} entries: no request of an entry's own`);
  }
});

// Without a token the host reads nothing ahead: the entries are shown as before, each read by its own request.
// TST-704003 · level: unit · module: MOD-settings-pages
// given: the instance holds 5 register entries and 3 other files; a GitHub host without a token
// input: readRegisterOf(host)
// expect: the 5 entries SRC-s000 … SRC-s004 with their titles; 0 GraphQL requests; 5 requests to /contents, one for each entry
test("readRegisterOf without a token: the entries are shown as before, each read by its own request", async (t) => {
  const github = world(t, 5);
  const { entries } = await readRegisterOf(hostOf(INSTANCE, null));
  assert.deepEqual(ids(entries), ["SRC-s000", "SRC-s001", "SRC-s002", "SRC-s003", "SRC-s004"]);
  assert.equal(entries[4].fields.title, "Source 4");
  assert.deepEqual(github.batches(), []);
  assert.equal(github.count("contents"), 5);
});

// A host whose snapshot has no readMany (a clone, another host of a test) is read as before.
// TST-704004 · level: unit · module: MOD-settings-pages
// given: a host whose snapshot holds 2 register entries and a file that is no entry, and offers `read` and `paths` only
// input: readRegisterOf(host)
// expect: the 2 entries in the order of their paths, SRC-s001 then SRC-s002; no error
test("readRegisterOf: a snapshot without readMany is read by read alone", async () => {
  const files = { "docs/sources/SRC-b.md": entryFile(2), "docs/sources/SRC-a.md": entryFile(1), "docs/sources.md": "# Requirement sources\n" };
  const host = { repositoryInfo: async () => ({ defaultBranch: "main" }), readSnapshot: async () => ({ paths: Object.keys(files), read: async (path) => files[path] ?? null }) };
  const { entries } = await readRegisterOf(host);
  assert.deepEqual(ids(entries), ["SRC-s001", "SRC-s002"]);
});

// A second reading by the same host asks for no text again: the texts the host holds are not read ahead.
// TST-704005 · level: unit · module: MOD-settings-pages
// given: the instance holds 250 register entries; one GitHub host with a token
// input: readRegisterOf(host) twice
// expect: after both, still 3 GraphQL requests of files (100, 100, 50), beside greenToMerge's of each reading (ITM-1170), and 0 to /contents; the commit and the tree were read twice (2 each); the second result has the ids of the first
test("readRegisterOf: a second reading by the same host reads no text again", async (t) => {
  const github = world(t, 250);
  const host = hostOf(INSTANCE, TOKEN);
  const first = await readRegisterOf(host);
  const second = await readRegisterOf(host);
  assert.deepEqual(ids(second.entries), ids(first.entries));
  assert.deepEqual(github.batches(), [0, 100, 100, 50, 0]);
  assert.equal(github.count("contents"), 0);
  assert.equal(github.count("commit"), 2);
  assert.equal(github.count("tree"), 2);
});

const contextOf = (host, product = null) => ({ page: "review", instance: { repository: INSTANCE, host }, product, store: freshStore(), went: [], go() {} });

// Opening `library` with a token reads the register in batches and shows every entry.
// TST-704006 · level: unit · module: MOD-settings-pages
// given: the instance holds 250 register entries and 3 other files; a GitHub host with a token as the instance's host
// input: render of the route `library`
// expect: 250 sections "library-source" on the page, the first one's title "Source 0" and the last one's "Source 249"; 3 GraphQL requests (100, 100, 50), after greenToMerge's (ITM-1170); 0 requests to /contents; 1 request for the commit and 1 for the tree of the instance
test("the library page with a token: 250 entries shown, read in three batches", async (t) => {
  const github = world(t, 250);
  const target = attachedTarget();
  await routeNamed("library").render(target, contextOf(hostOf(INSTANCE, TOKEN)), {});
  await settled(github);
  const sections = byClass(target, "library-source");
  assert.equal(sections.length, 250);
  assert.equal(byClass(sections[0], "library-source-name")[0].textContent, "Source 0");
  assert.equal(byClass(sections[249], "library-source-name")[0].textContent, "Source 249");
  assert.deepEqual(github.batches(), [0, 100, 100, 50]);
  assert.equal(github.count("contents"), 0);
  assert.equal(github.count("commit"), 1);
  assert.equal(github.count("tree"), 1);
});

// Without a token, the library page makes one request for each entry, as before.
// TST-704007 · level: unit · module: MOD-settings-pages
// given: the instance holds 5 register entries; a GitHub host without a token
// input: render of the route `library`
// expect: 5 sections "library-source"; 0 GraphQL requests; 5 requests to /contents
test("the library page without a token: 5 entries shown, each read by its own request", async (t) => {
  const github = world(t, 5);
  const target = attachedTarget();
  await routeNamed("library").render(target, contextOf(hostOf(INSTANCE, null)), {});
  await settled(github);
  assert.equal(byClass(target, "library-source").length, 5);
  assert.deepEqual(github.batches(), []);
  assert.equal(github.count("contents"), 5);
});

// Opening a source's entry `library/<source>` with a token reads the register in batches and shows that entry.
// TST-704008 · level: unit · module: MOD-settings-pages
// given: the instance holds 250 register entries; a GitHub host with a token as the instance's host; the browser keeps no product
// input: render of the route `library` with the parameter source = SRC-s042
// expect: the page's heading "Source 42 (SRC-s042)" and its version row naming "v42"; 3 GraphQL requests (100, 100, 50), after greenToMerge's (ITM-1170); 0 requests to /contents
test("the entry page with a token: the entry shown, the register read in three batches", async (t) => {
  const github = world(t, 250);
  const target = attachedTarget();
  await routeNamed("library").render(target, contextOf(hostOf(INSTANCE, TOKEN)), { source: "SRC-s042" });
  await settled(github);
  assert.equal(target.textContent.includes("Source 42 (SRC-s042)"), true);
  assert.equal(byClass(target, "library-version").some((row) => row.textContent.includes("v42")), true);
  assert.deepEqual(github.batches(), [0, 100, 100, 50]);
  assert.equal(github.count("contents"), 0);
});

// A product's Requirement sources reads the instance's register in batches and shows every source.
// TST-704009 · level: unit · module: MOD-settings-pages
// given: the instance holds 250 register entries; its host has a token; the chosen product is bob/product, which holds a SPEC and no links file, with a host of its own that has a token
// input: render of the route `sources` for the product
// expect: 250 sections of the page with a data-source attribute, the first SRC-s000 and the last SRC-s249; 3 GraphQL requests (100, 100, 50) to the instance, after greenToMerge's; 0 requests to the instance's /contents; to the product no GraphQL request but greenToMerge's, which names no file (ITM-1170)
test("the sources page with a token: 250 sources shown, the register read in three batches", async (t) => {
  const github = world(t, 250);
  const product = { address: `https://github.com/${PRODUCT}`, kind: "github", host: hostOf(PRODUCT, TOKEN) };
  const target = attachedTarget();
  await routeNamed("sources").render(target, contextOf(hostOf(INSTANCE, TOKEN), product), {});
  await settled(github);
  const shown = [];
  (function visit(node) { for (const child of node.childNodes ?? []) if (child.nodeType === 1) { if (child.getAttribute("data-source")) shown.push(child.getAttribute("data-source")); visit(child); } })(target);
  assert.equal(shown.length, 250);
  assert.deepEqual([shown[0], shown[249]], ["SRC-s000", "SRC-s249"]);
  assert.deepEqual(github.batches(), [0, 100, 100, 50]);
  assert.equal(github.count("contents"), 0);
  assert.deepEqual(github.batches(PRODUCT), [0], "to the product, only greenToMerge's GraphQL request, naming no file (ITM-1170)");
});

// The requests of one opening of `library` at the size of this repository's register today (2 entries), with a token and without one.
// TST-704010 · level: unit · module: MOD-settings-pages
// given: the instance holds 2 register entries and 3 other files; once a GitHub host with a token, once without
// input: render of the route `library`
// expect: with a token 6 requests in all: the repository's information 1 and greenToMerge's GraphQL request beside it 1 (ITM-1170), its commit 1, its tree 1, one query naming the 2 entries 1, the list of the fetch workflow's runs 1; without a token 6: the same, and the 2 entries one request each instead of the query
test("the library page at the size of the register today: 6 requests with a token, 6 without", async (t) => {
  for (const [token, total, batches, own] of [[TOKEN, 6, [0, 2], 0], [null, 6, [], 2]]) {
    const github = world(t, 2);
    await routeNamed("library").render(attachedTarget(), contextOf(hostOf(INSTANCE, token)), {});
    await settled(github);
    const label = token ? "with a token" : "without a token";
    assert.equal(github.requests.length, total, label);
    assert.deepEqual(github.batches(), batches, label);
    assert.equal(github.count("contents"), own, label);
  }
});
