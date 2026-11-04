// MOD-site-frame's chosenProduct tells whether the browser keeps the chosen product's own token (ITM-856), as docs/architecture/MOD-site-frame.md states it:
// "`chosenProduct(context: { store: Store, fragment: string }) -> Promise<ProductContext | null>` — the product the address's fragment or the selector names, among the products
// this browser keeps, connected with its own token to its own server only, with `tokenStored` true when that token is kept", and "`ProductContext` is `{ address: string, kind:
// "github" | "gitlab", host: Host, tokenStored: boolean }`, `tokenStored` telling whether this browser keeps the product's own token, so that a view hands `readProblem` the fact
// without reading the store's keys itself".
// Run: node --test tests/site-frame-chosen-product.test.mjs
//
// Module: MOD-site-frame
// Guards: A PRODUCT IS NAMED BY ITS ADDRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-008; UC-020
// Level: unit
//
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file. The page is the small fixture
// of tests/site-frame-start.d/dom.mjs (a location and a local storage); the real MOD-browser-store and MOD-repository-hosts run as they are. Nothing is read from a repository: a spy
// on `fetch` that refuses records that none is called. Readings the module file leaves open, which the pull request names:
//   - "kept" is: the store holds a value under the key of that product's own token (`github-token:<owner>/<repository>`, or `gitlab-token:<server>/<project>` for a GitLab product).
//     The instance's token (`github-token`), another product's token and a token of the other kind under the same path are not that key.
//   - `tokenStored` is the boolean true or false, never undefined, and the other fields of the result stay as they were: address, kind and host.
// The counter-proofs (a planted fault in src/site-frame/ and the test's failing result) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { changeFragment, installPage, offline, outside } from "./site-frame-start.d/dom.mjs";
import { clearSetting, openStore, writeSetting } from "../src/browser-store/index.mjs";

installPage({ hostname: "acme.github.io", pathname: "/instance/docs/index.html" });
offline();
const { chosenProduct, startPage } = await import("../src/site-frame/index.mjs");

const WIDGET = "https://github.com/acme/widget";
const OTHER = "https://github.com/acme/other";
const APP = "https://gitlab.example.org/team/app";
const fragmentOf = (address) => `#alpha/product=${encodeURIComponent(address)}`;

// The store of the instance acme/instance on a fresh local storage, keeping `products` and a token under each key of `tokens`.
function browserKeeping(products, tokens = []) {
  installPage({ hostname: "acme.github.io", pathname: "/instance/docs/index.html" });
  const store = openStore("acme/instance");
  writeSetting(store, "products", products);
  for (const key of tokens) writeSetting(store, key, { value: `${key.startsWith("gitlab-token") ? "glpat-" : "github_pat_"}${key}`, name: "token", expires: "2030-01-01" });
  return store;
}

test.afterEach(() => { assert.deepEqual([outside.reached, outside.seen], [[], []], "no request left the fixture"); });

// TST-856001 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-008
// given: a browser that keeps the GitHub product https://github.com/acme/widget and, once, the token github-token:acme/widget; and, for the counter-proof, the same browser without that token
// input: chosenProduct({ store, fragment: "#alpha/product=<the widget>" })
// expect: the result has exactly the fields address, host, kind and tokenStored; address is the widget's address, kind is "github", host has a repositoryInfo function, and tokenStored is the boolean true; counter-proof: without the token the same four fields are given and tokenStored is the boolean false
test("TST-856001 the chosen GitHub product says its own token is stored, and says it is not where none is", async () => {
  const withToken = await chosenProduct({ store: browserKeeping([WIDGET], ["github-token:acme/widget"]), fragment: fragmentOf(WIDGET) });
  assert.deepEqual(Object.keys(withToken).sort(), ["address", "host", "kind", "tokenStored"]);
  assert.equal(withToken.address, WIDGET);
  assert.equal(withToken.kind, "github");
  assert.equal(typeof withToken.host.repositoryInfo, "function");
  assert.equal(withToken.tokenStored, true);

  const without = await chosenProduct({ store: browserKeeping([WIDGET]), fragment: fragmentOf(WIDGET) });
  assert.deepEqual(Object.keys(without).sort(), ["address", "host", "kind", "tokenStored"]);
  assert.equal(without.tokenStored, false);
});

// TST-856002 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a browser that keeps the products https://github.com/acme/widget and https://github.com/acme/other, the instance's token github-token and the token github-token:acme/other, and no token of the widget
// input: chosenProduct for the widget; and, for the counter-proof, for the widget after github-token:acme/widget is stored too
// expect: tokenStored is false for the widget — neither the instance's token nor another product's token is its own —; counter-proof: with its own token stored it is true, and for the other product, whose token was stored all along, it is true
test("TST-856002 the instance's token and another product's token are not the chosen product's own", async () => {
  const store = browserKeeping([WIDGET, OTHER], ["github-token", "github-token:acme/other"]);
  assert.equal((await chosenProduct({ store, fragment: fragmentOf(WIDGET) })).tokenStored, false);
  assert.equal((await chosenProduct({ store, fragment: fragmentOf(OTHER) })).tokenStored, true);

  writeSetting(store, "github-token:acme/widget", { value: "github_pat_widget", name: "token", expires: "2030-01-01" });
  assert.equal((await chosenProduct({ store, fragment: fragmentOf(WIDGET) })).tokenStored, true);
});

// TST-856003 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a browser that keeps the GitLab product https://gitlab.example.org/team/app and the token gitlab-token:gitlab.example.org/team/app; and, for the counter-proof, a browser that keeps the same product and only the token github-token:team/app, which is a token of the other kind under the same path
// input: chosenProduct({ store, fragment: "#alpha/product=<the app>" })
// expect: kind is "gitlab" and tokenStored is true; counter-proof: with only the GitHub-kind token of the same path, kind is "gitlab" and tokenStored is false
test("TST-856003 the chosen GitLab product says its own project token is stored; a GitHub token of the same path is not it", async () => {
  const stored = await chosenProduct({ store: browserKeeping([APP], ["gitlab-token:gitlab.example.org/team/app"]), fragment: fragmentOf(APP) });
  assert.equal(stored.kind, "gitlab");
  assert.equal(stored.tokenStored, true);

  const other = await chosenProduct({ store: browserKeeping([APP], ["github-token:team/app"]), fragment: fragmentOf(APP) });
  assert.equal(other.kind, "gitlab");
  assert.equal(other.tokenStored, false);
});

// ---- ITM-669: a navigation that keeps the product keeps its Host ----
// The Host keeps the texts of the blobs it has read (MOD-repository-hosts), so a page that is given a new Host at every change of the fragment reads a file again. The fixture below is
// a counting GitHub: it answers the commit, the tree and the file requests of the product https://github.com/acme/widget and records every request. The readings these tests take:
//   - "a blob read" is one request for a file's text: raw.githubusercontent.com/acme/widget/c1/<path> without a token, api.github.com/repos/acme/widget/contents/<path>?ref=c1 with one.
//   - "a navigation that keeps the product" is a change of the fragment whose `product` names the same address; the store's token and secrets for it are unchanged.
//   - The commit and the tree are read at every snapshot, so a navigation still reads them: keeping the Host does not change that.
const PATHS = { "SPEC.md": ["s1", "spec text"], "gaps.md": ["s2", "gaps text"] };

// Puts a counting GitHub in place of the fixture's fetch; returns its record and a function that puts the fixture's fetch back.
function countingGitHub() {
  const seen = { blobs: [], snapshots: 0 };
  const before = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = String(url);
    const file = Object.keys(PATHS).find((path) => address.includes(`/${path}`));
    if (/\/commits\/main$/.test(address)) return new Response(JSON.stringify({ sha: "c1" }), { status: 200, headers: { "content-type": "application/json" } });
    if (address.includes("/git/trees/c1")) {
      seen.snapshots += 1;
      return new Response(JSON.stringify({ tree: Object.entries(PATHS).map(([path, [sha]]) => ({ type: "blob", path, sha })) }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (file) { seen.blobs.push(file); return new Response(PATHS[file][1], { status: 200 }); }
    return new Response("{}", { status: 404 });
  };
  return { seen, restore: () => { globalThis.fetch = before; } };
}

// What a route does with the product's Host: reads one file of the snapshot of main.
async function readFileOf(product, path) {
  return (await product.host.readSnapshot("main")).read(path);
}

// TST-669001 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a browser that keeps the product https://github.com/acme/widget and no token, and a counting GitHub that serves SPEC.md and gaps.md of commit c1
// input: chosenProduct for the widget's fragment three times in a row, as three navigations that keep the product do (spec, gaps, spec), and after each a read of SPEC.md, gaps.md, SPEC.md through the product's host
// expect: the three results hold the same host; the texts are "spec text", "gaps text", "spec text"; SPEC.md was requested once and gaps.md once (not SPEC.md twice); three trees were read
test("TST-669001 three navigations that keep the product give the same host, and SPEC.md read in the first is not requested in the third", async () => {
  const github = countingGitHub();
  try {
    const store = browserKeeping([WIDGET]);
    const first = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    const text1 = await readFileOf(first, "SPEC.md");
    const second = await chosenProduct({ store, fragment: `#gaps/product=${encodeURIComponent(WIDGET)}` });
    const text2 = await readFileOf(second, "gaps.md");
    const third = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    const text3 = await readFileOf(third, "SPEC.md");
    assert.equal(first.host === second.host && second.host === third.host, true, "the same host");
    assert.deepEqual([text1, text2, text3], ["spec text", "gaps text", "spec text"]);
    assert.deepEqual(github.seen.blobs, ["SPEC.md", "gaps.md"], "each file requested once");
    assert.equal(github.seen.snapshots, 3, "one tree read for each snapshot");
  } finally { github.restore(); }
});

// TST-669002 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a browser that keeps the widget and its token github-token:acme/widget, and the counting GitHub
// input: chosenProduct twice with the same store and fragment, a read of SPEC.md after each; then the token is replaced by another value under the same key, chosenProduct again and SPEC.md read; then the token is cleared, chosenProduct again
// expect: the first two results hold the same host and SPEC.md was requested once by them; after the token is replaced the host is a different one and SPEC.md is requested a second time; after the token is cleared the host is different from the one before and tokenStored is false
test("TST-669002 a host is kept only while the product's token is the one it was connected with: a replaced or cleared token gives a new host", async () => {
  const github = countingGitHub();
  try {
    const store = browserKeeping([WIDGET], ["github-token:acme/widget"]);
    const a = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    await readFileOf(a, "SPEC.md");
    const b = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    await readFileOf(b, "SPEC.md");
    assert.equal(a.host === b.host, true, "same token, same host");
    assert.equal(github.seen.blobs.length, 1, "one request for SPEC.md");

    writeSetting(store, "github-token:acme/widget", { value: "github_pat_replaced", name: "token", expires: "2030-01-01" });
    const c = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    await readFileOf(c, "SPEC.md");
    assert.equal(c.host === b.host, false, "a replaced token gives a new host");
    assert.equal(github.seen.blobs.length, 2, "the new host reads SPEC.md again");

    clearSetting(store, "github-token:acme/widget");
    const d = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    assert.equal(d.host === c.host, false, "a cleared token gives a new host");
    assert.equal(d.tokenStored, false);
  } finally { github.restore(); }
});

// TST-669003 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A PRODUCT IS NAMED BY ITS ADDRESS
// given: a browser that keeps the products https://github.com/acme/widget and https://github.com/acme/other
// input: chosenProduct for the widget, then for the other product, then for the widget again
// expect: the widget's two results hold the same host; the other product's host is a different one
test("TST-669003 each product has its own host, and going to another product and back gives the widget's first host", async () => {
  const store = browserKeeping([WIDGET, OTHER]);
  const first = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
  const other = await chosenProduct({ store, fragment: fragmentOf(OTHER) });
  const again = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
  assert.equal(first.host === again.host, true, "the widget's host is kept");
  assert.equal(other.host === first.host, false, "the other product has its own host");
});

// A commit that would write `text` on a host: refused with SecretRefused before any request when the text holds a stored secret.
const commitOf = (host, text) => host.commitFiles({ branch: "main", expectedHead: "a".repeat(40), files: [{ path: "docs/note.md", text }], message: "note" });

// TST-669005 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; NO SECRET IN THE REPOSITORY
// given: a browser that keeps the widget and the instance's token github-token with the value "github_pat_first-value"
// input: chosenProduct twice; then the instance's token is replaced by "github_pat_second-value" and chosenProduct is called again
// expect: the first two results hold the same host; the third holds a different host, which refuses a commit whose text holds "github_pat_second-value" with a SecretRefused naming docs/note.md, before any request
test("TST-669005 a stored secret that changes gives a new host, so a kept host never holds a stale list of secrets", async () => {
  const requests = [], before = globalThis.fetch;
  globalThis.fetch = async (url) => { requests.push(String(url)); throw new TypeError("offline"); };
  try {
    const store = browserKeeping([WIDGET]);
    writeSetting(store, "github-token", { value: "github_pat_first-value", name: "token", expires: "2030-01-01" });
    const a = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    const b = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    assert.equal(a.host === b.host, true, "the secrets did not change: the same host");
    writeSetting(store, "github-token", { value: "github_pat_second-value", name: "token", expires: "2030-01-01" });
    const c = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    assert.equal(c.host === b.host, false, "a changed secret gives a new host");
    await assert.rejects(commitOf(c.host, "text with github_pat_second-value inside"), (error) => error.name === "SecretRefused" && error.path === "docs/note.md");
    assert.deepEqual(requests, [], "refused before any request");
  } finally { globalThis.fetch = before; }
});

// TST-669006 · level: unit · module: MOD-site-frame
// guards: NO SECRET IN THE REPOSITORY
// given: a browser that keeps the widget and the instance's token github-token with the value "github_pat_instance-value"
// input: chosenProduct for the widget twice (the second as a navigation that keeps the product), then a commit through the second result's host whose text holds "github_pat_instance-value"
// expect: the kept host refuses it with a SecretRefused naming docs/note.md, and no request was made
test("TST-669006 the kept host still refuses a stored secret", async () => {
  const requests = [], before = globalThis.fetch;
  globalThis.fetch = async (url) => { requests.push(String(url)); throw new TypeError("offline"); };
  try {
    const store = browserKeeping([WIDGET]);
    writeSetting(store, "github-token", { value: "github_pat_instance-value", name: "token", expires: "2030-01-01" });
    await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    const kept = await chosenProduct({ store, fragment: fragmentOf(WIDGET) });
    await assert.rejects(commitOf(kept.host, "a note with github_pat_instance-value in it"), (error) => error.name === "SecretRefused" && error.path === "docs/note.md");
    assert.deepEqual(requests, []);
  } finally { globalThis.fetch = before; }
});

// TST-669004 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the review page started with two fixture routes, spec and gaps, each reading its own file through context.product.host, a browser that keeps the widget, and the counting GitHub
// input: the fragment #spec/product=<widget>, then #gaps/product=<widget>, then #spec/product=<widget> again, each announced as a change of the fragment
// expect: SPEC.md requested once and gaps.md requested once over the three navigations
test("TST-669004 over the page, spec then gaps then spec reads SPEC.md once", async () => {
  const github = countingGitHub();
  try {
    const fixture = installPage({ hostname: "acme.github.io", pathname: "/instance/docs/index.html", hash: `#spec/product=${encodeURIComponent(WIDGET)}` });
    globalThis.setInterval = () => 1;
    writeSetting(openStore("acme/instance"), "products", [WIDGET]);
    const read = (name, path) => ({ name, entry: "requirements", title: name, async render(target, context) { target.textContent = await readFileOf(context.product, path); } });
    await startPage({ page: "review", views: [{ routes: [read("spec", "SPEC.md"), read("gaps", "gaps.md")], strategies: [] }] });
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    for (const name of ["gaps", "spec"]) {
      changeFragment(fixture, `#${name}/product=${encodeURIComponent(WIDGET)}`);
      for (let turn = 0; turn < 20; turn += 1) await settle();
    }
    assert.deepEqual(github.seen.blobs, ["SPEC.md", "gaps.md"]);
  } finally { github.restore(); }
});
