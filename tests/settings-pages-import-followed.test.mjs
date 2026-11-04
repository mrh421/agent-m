// The open Settings page uses the tokens that Import settings stores (ITM-870). The real app (src/site-frame/dashboard-app.mjs) runs in
// tests/app-harness.mjs on a product's pages (?repo=alice/thesis), against two GitHub fakes: the instance's, and a second repoServer for
// the product that the instance's server hands the product's requests to. A handler of the test records the headers of every request
// without answering it. The person opens Settings, empties the browser of the token under test (Clear on the line of the GitHub token;
// Clear on the line of the list of products, which takes the product's own token), picks a settings file that holds a new token in
// Import settings, and then makes the next page action without a reload: opens the Repositories tab of Settings (which reads the
// instance's switch of recording conversations through the instance host the page holds), or clears a model endpoint on its line (which
// draws Settings again and reads the product through the host the page holds).
// Run: node --test tests/settings-pages-import-followed.test.mjs
//
// Module: MOD-settings-pages
// Guards: A CLEAR IS A REAL CLEAR
// Guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN
// Level: component
//
// The expected results are written here from A GITHUB PRODUCT USES A TOKEN OF ITS OWN ("after *Store and check* the product is read with
// that token"), from A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT (a token leaves the browser only as the authorisation header of
// requests to its server) and from A CLEAR IS A REAL CLEAR (what the page holds follows what the browser stores); none is read from a
// document. A token that was imported is a stored credential: the next request to its server carries it, and a token that was cleared
// before is no longer sent. Reading, named in the pull request: a settings file that holds a token of the other kind of server under
// `github-token` is refused before anything is stored (ITM-893): `connect` refuses the token with a TypeError that names the cause, and the page
// shows that message, with the key and never the token, in the line of the import, as it shows every other failure of an import there.
// The callers read first (AGENTS.md 6a.1): tests/settings-pages-product-token-followed.test.mjs (TST-853001 to TST-853003) and
// tests/settings-pages-stored-token-followed.test.mjs (TST-860001) open the live Settings page on a product's pages in this harness and
// record the requests; this file copies their pattern, and tests/settings-pages-export-import.test.mjs for the import file's shape (the
// helpers are written again here: a test file imports no other test file).

import test from "node:test";
import assert from "node:assert/strict";
import { repoServer, fakeCaches, openDashboard, richDocument, press, settle, TOKEN } from "./app-harness.mjs";

const API = "https://api.github.com";
const PREFIX = "agent-m:akmaier/agent-m:";
const PRODUCT = "alice/thesis", PRODUCT_ADDRESS = `https://github.com/${PRODUCT}`;
const PRODUCT_TOKEN = "github_pat_PRODUCT0123456789abcdefghij";
const IMPORTED = "github_pat_IMPORTED0123456789abcdefghi";
const IMPORTED_PRODUCT = "github_pat_IMPORTEDPRODUCT0123456789ab";
const GITLAB_FORM = "glpat-IMPORTED0123456789";
const FILES = {
  "docs/use-cases/UC-001-read-a-file.md": "---\nid: UC-001\ntitle: Read a file\narea: 1\nactors:\n  - Reader\nrealises: []\n---\n# UC-001 Read a file\n",
  "docs/use-cases/README.md": "# Use cases\n",
  "docs/approvals/README.md": "# Approval records\n",
};
const controls = (root, name, out = []) => { for (const child of root?.children ?? []) { if (typeof child !== "object") continue; if (child.className?.split(" ").includes(name)) out.push(child); controls(child, name, out); } return out; };
const stored = (token, name) => JSON.stringify({ value: token, name, expires: null, stored: "2026-10-18" });
const carrying = (requests, secret) => requests.filter((request) => request.headers.includes(secret)).map((request) => request.what);
const lineOf = (root, title) => controls(root, "settings-repository").find((node) => node.children[0]?.textContent === title);
const exportFile = (settings) => JSON.stringify({ "agent-m-settings": 1, instance: "akmaier/agent-m", exported: "2026-10-18T00:00:00Z", locked: false, settings, foreign: {} });

// The live page on the product's pages, then Settings drawn, with the model endpoint ep1, the instance's token and the product's own token
// stored. -> the instance's server, the record of every request (what it was, and its headers as text), and the Settings page's nodes.
async function settingsOpen() {
  const sent = [];
  const spy = (url, init) => { sent.push({ what: `${init.method} ${url.origin}${url.pathname}`, headers: JSON.stringify(init.headers ?? {}) }); return undefined; };
  let product = null;
  const tree = (url, init) => (init.method === "GET" && url.pathname === `/repos/${PRODUCT}/git/trees/main`
    ? product.fetch(`${API}/repos/${PRODUCT}/git/trees/${product.head}?recursive=1`, init) : undefined);
  product = await repoServer({ repo: PRODUCT, files: FILES, handlers: [tree] });
  const forward = (url, init) => (url.origin === API && url.pathname.startsWith(`/repos/${PRODUCT}`) ? product.fetch(url.href, init) : undefined);
  const srv = await repoServer({ files: FILES, handlers: [spy, forward] });
  const entries = {
    [`${PREFIX}products`]: JSON.stringify([PRODUCT_ADDRESS]),
    [`${PREFIX}endpoint:ep1`]: JSON.stringify({ kind: "openai-compatible", url: "https://models.example/v1", model: "model-a", key: null }),
    [`${PREFIX}github-token`]: stored(TOKEN, "GitHub token"),
    [`${PREFIX}github-token:${PRODUCT}`]: stored(PRODUCT_TOKEN, "Agent M"),
  };
  const page = await openDashboard({ server: srv, search: `?repo=${encodeURIComponent(PRODUCT)}`, hash: "#uc", token: TOKEN, entries, caches: fakeCaches() });
  const dom = richDocument(), createElement = globalThis.document.createElement.bind(globalThis.document), main = dom.byId("main"), replace = main.replaceChildren.bind(main);
  let mounted = [];
  globalThis.document.createElement = (name) => {
    const node = createElement(name);
    if (!("childNodes" in node)) Object.defineProperty(node, "childNodes", { get: () => node.children ?? [] });
    return node;
  };
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  globalThis.confirm = () => true;
  await page.go("#settings");
  return { srv, sent, nodes: () => ({ children: mounted }) };
}

// The page actions after the person's press: the requests it sent, as records.
async function afterPress(srv, sent, control) {
  const from = sent.length;
  const requests = (await press(srv, control)).length;
  await settle(srv);
  return { requests, sent: sent.slice(from) };
}

// Pick the settings file `settings` in Import settings. -> the line of the import's result.
async function importFile(srv, nodes, settings) {
  const file = controls(nodes(), "settings-import-file")[0];
  assert.equal(Boolean(file), true, "the page offers Import settings");
  const text = exportFile(settings);
  file.files = [{ text: async () => text }];
  await file.fire("change", {});
  await settle(srv);
  return controls(nodes(), "settings-import-result")[0].textContent;
}

// TST-870001
// level: component
// module: MOD-settings-pages
// guards: A CLEAR IS A REAL CLEAR
// given: the live page on a GitHub product's pages that has drawn Settings, the instance's token and the product's own token stored
// input: press Clear on the line of the GitHub token, import a file that holds a new GitHub token, then open the Repositories tab of Settings
// expect: the new token is stored, and every request of the Repositories tab to the instance carries it (and there is at least one), and none carries the cleared one; the one POST /graphql without it is the product's request of greenToMerge, with the product's own token (ITM-1170)
test("TST-870001 · a GitHub token imported after a clear is carried by the next request of the open page", async (t) => {
  const { srv, sent, nodes } = await settingsOpen();
  await press(srv, controls(lineOf(nodes(), "GitHub token"), "settings-repository-clear")[0]);
  assert.equal(globalThis.localStorage.getItem(`${PREFIX}github-token`), null, "the cleared token is gone from localStorage");
  const result = await importFile(srv, nodes, { "github-token": { value: IMPORTED, name: "GitHub token", expires: null, stored: "2026-10-18" } });
  assert.equal(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}github-token`))?.value, IMPORTED, `the import stored the new token (the page says: ${result})`);
  const tab = controls(nodes(), "settings-tab").find((node) => node.textContent === "Repositories");
  assert.equal(Boolean(tab), true, "the page offers the Repositories tab");
  const after = await afterPress(srv, sent, tab);
  const instance = after.sent.filter((request) => !request.what.includes(`/repos/${PRODUCT}`));
  t.diagnostic(`requests on the Repositories tab ${after.requests}, of them to the instance ${instance.length}; carrying the imported token: ${carrying(instance, IMPORTED).length}; carrying the cleared one: ${carrying(after.sent, TOKEN).length}`);
  assert.equal(instance.length > 0, true, "the Repositories tab sent requests to the instance");
  // ITM-1170: the one request without the imported token is the product's GraphQL request of greenToMerge, which carries the product's own token; its path names no repository.
  assert.deepEqual(instance.filter((request) => !request.headers.includes(IMPORTED)).map((request) => request.what), ["POST https://api.github.com/graphql"], "every request to the instance carries the imported token");
  assert.ok(instance.filter((request) => !request.headers.includes(IMPORTED)).every((request) => request.headers.includes(PRODUCT_TOKEN)), "that GraphQL request carries the product's own token");
  assert.deepEqual(carrying(after.sent, TOKEN), [], "no request carries the cleared token");
});

// TST-870002
// level: component
// module: MOD-settings-pages
// guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN
// given: the live page on a GitHub product's pages that has drawn Settings, the instance's token, the product's own token and the endpoint ep1 stored
// input: press Clear on the line of the list of products, import a file that holds the list and a token of the product's own, then press Clear on the line of the endpoint ep1
// expect: the product's token and the list are stored, and every request to the product after the press on the endpoint carries the imported token (and there is at least one), and none carries the cleared one
test("TST-870002 · a product token imported after a clear is carried by the next request of the open page", async (t) => {
  const { srv, sent, nodes } = await settingsOpen();
  const products = controls(nodes(), "settings-repository").find((node) => node.textContent.includes("Product addresses are stored"));
  await press(srv, controls(products, "settings-repository-clear")[0]);
  assert.equal(globalThis.localStorage.getItem(`${PREFIX}github-token:${PRODUCT}`), null, "the product's own token is gone from localStorage");
  const result = await importFile(srv, nodes, { products: [PRODUCT_ADDRESS], [`github-token:${PRODUCT}`]: { value: IMPORTED_PRODUCT, name: "Agent M", expires: null, stored: "2026-10-18" } });
  assert.equal(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}github-token:${PRODUCT}`))?.value, IMPORTED_PRODUCT, `the import stored the product's token (the page says: ${result})`);
  const clear = controls(controls(nodes(), "settings-endpoint")[0], "settings-endpoint-clear")[0];
  assert.equal(Boolean(clear), true, "the page offers Clear on the line of the endpoint ep1");
  const after = await afterPress(srv, sent, clear);
  const product = after.sent.filter((request) => request.what.includes(`/repos/${PRODUCT}`));
  t.diagnostic(`requests on the press ${after.requests}, of them to the product ${product.length}; carrying the imported product token: ${carrying(product, IMPORTED_PRODUCT).length}; carrying the cleared one: ${carrying(after.sent, PRODUCT_TOKEN).length}`);
  assert.equal(product.length > 0, true, "the page read the product again after the press on the endpoint");
  assert.deepEqual(product.filter((request) => !request.headers.includes(IMPORTED_PRODUCT)).map((request) => request.what), [], "every request to the product carries the imported token");
  assert.deepEqual(carrying(after.sent, PRODUCT_TOKEN), [], "no request carries the cleared product token");
});

// TST-870003
// level: component
// module: MOD-settings-pages
// guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN
// given: the live page on a GitHub product's pages that has drawn Settings, the instance's token stored and cleared on its line
// input: import a file that holds, under `github-token`, a token of the form of a GitLab project access token
// expect: the line of the import names the key `github-token` and the cause ("That is a GitLab token") instead of reporting what was added, holds no token, nothing is stored under `github-token`, and the page stays usable: the Repositories tab can be opened
test("TST-870003 · a GitLab-form token imported under the GitHub token is named in the line of the import", async () => {
  const { srv, nodes } = await settingsOpen();
  await press(srv, controls(lineOf(nodes(), "GitHub token"), "settings-repository-clear")[0]);
  const result = await importFile(srv, nodes, { "github-token": { value: GITLAB_FORM, name: "GitHub token", expires: null, stored: "2026-10-18" } });
  assert.equal(/That is a GitLab token/.test(result), true, `the line of the import names the cause (it says: ${result})`);
  assert.equal(/github-token/.test(result), true, `the line of the import names the key (it says: ${result})`);
  assert.equal(/Added:/.test(result), false, `the line of the import reports nothing added (it says: ${result})`);
  assert.equal(result.includes(GITLAB_FORM), false, "the line of the import never holds the token");
  assert.equal(globalThis.localStorage.getItem(`${PREFIX}github-token`), null, "nothing is stored under github-token");
  const tab = controls(nodes(), "settings-tab").find((node) => node.textContent === "Repositories");
  await assert.doesNotReject(async () => { await press(srv, tab); }, "the Repositories tab opens");
});
