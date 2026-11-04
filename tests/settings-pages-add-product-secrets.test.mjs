// The route `add-product` connects the host that commits a product's review layout with the stored secrets (ITM-883): when the layout's
// text holds a stored secret, Add product refuses the commit as SecretRefused, writes nothing, and does not add the product to this
// browser's list. The route is drawn over a fake localStorage with MOD-browser-store's own openStore, and the hosts are GitHub's and
// GitLab's REST APIs answered by a fake of fetch that records every request's method, path and body; no request leaves the process.
// The layout's text is fixed by MOD-artifact-edits (a product's CHANGELOG.md reads `# Changelog of <path>`), so SECRET is a stored
// endpoint key that is a part of that text: the same case as TST-868001 to TST-868011, whose recording switch has a fixed text too.
// Run: node --test tests/settings-pages-add-product-secrets.test.mjs
//
// Module: MOD-settings-pages
// Guards: NO SECRET IN THE REPOSITORY
// Level: unit
//
// The expected results are written here from NO SECRET IN THE REPOSITORY ("No API key, access token or endpoint credential is written
// into a repository managed by Agent M") and from the sentence of MOD-repository-hosts' `commitFiles` that a file whose text holds a
// configured secret refuses the whole commit with `SecretRefused` and writes nothing; none is read from a document when a test runs.
// Reading, named in the pull request: the route shows a refused commit in its Step C line as `✗ <the error's message> — nothing was
// written.` (products.mjs, the catch of Add product), and the message of SecretRefused names the file, here CHANGELOG.md, the first
// file of the commit that holds the secret. The known positive (AGENTS.md 6a.2): with a stored secret that is no part of the layout's
// text, the same click writes the layout and adds the product. The callers read first (AGENTS.md 6a.1): tests/settings-pages-add-product.test.mjs
// (TST-478029 and the script of the requests a layout commit makes; the helpers are written again here: a test file imports no other
// test file) and src/site-frame/routing.mjs:66, the frame's own connection with `secrets: secretValues(store)`. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byTag, byClass, turn, type, click } from "./settings-pages-harness.mjs";

const document = installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "add-product");

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
}
function freshStore() {
  Object.defineProperty(globalThis, "localStorage", { value: new FakeStorage(), configurable: true, writable: true });
  return openStore("fixture/instance");
}
const contextOf = (store) => ({ page: "settings", instance: { repository: "akmaier/agent-m" }, product: null, store, go() {} });
const seed = (store, key, fields) => writeSetting(store, key, { name: "fixture", expires: "2027-06-01", stored: "2026-01-01", ...fields });

const GH_PATH = "alice/thesis-tool", GH_WEB = `https://github.com/${GH_PATH}`, GH_PREFIX = `/repos/${GH_PATH}`;
const GL_ORIGIN = "https://gitlab.example.org", GL_PATH = "grp/sub/thesis-tool", GL_WEB = `${GL_ORIGIN}/${GL_PATH}`;
const GL_PREFIX = `/api/v4/projects/${encodeURIComponent(GL_PATH)}`;
const HEAD = "a".repeat(40), TREE = "b".repeat(40), NEW_TREE = "c".repeat(40), NEW_COMMIT = "d".repeat(40);
const SECRET = `# Changelog of ${GH_PATH}`, GL_SECRET = `# Changelog of ${GL_PATH}`;
const OTHER = "sk-not-part-of-any-layout-text-0123456789";

const ghSteps = () => [
  // ITM-1170: with the record, the read-only GraphQL request of greenToMerge, sent first.
  { method: "POST", path: "/graphql", body: { data: { repository: { defaultBranchRef: null } } } },
  { method: "GET", path: GH_PREFIX, body: { default_branch: "main", visibility: "private", private: true, archived: false, description: "", permissions: { push: true } } },
  { method: "GET", path: `${GH_PREFIX}/commits/main`, body: { sha: HEAD, commit: { tree: { sha: TREE } } } },
  { method: "GET", path: `${GH_PREFIX}/git/trees/${HEAD}`, body: { sha: HEAD, truncated: false, tree: [] } },
  { method: "GET", path: `${GH_PREFIX}/git/ref/heads/main`, body: { object: { sha: HEAD } } },
  { method: "GET", path: `${GH_PREFIX}/git/commits/${HEAD}`, body: { tree: { sha: TREE } } },
  { method: "POST", path: `${GH_PREFIX}/git/trees`, body: { sha: NEW_TREE } },
  { method: "POST", path: `${GH_PREFIX}/git/commits`, body: { sha: NEW_COMMIT, html_url: `${GH_WEB}/commit/${NEW_COMMIT}` } },
  { method: "PATCH", path: `${GH_PREFIX}/git/refs/heads/main`, body: { object: { sha: NEW_COMMIT } } },
];
const LAYOUT = ["docs/use-cases/README.md", "docs/architecture/README.md", "docs/approvals/README.md", "docs/spec-freigaben/README.md", "SPEC.md", "CHANGELOG.md"];
const glSteps = () => [
  { method: "GET", path: GL_PREFIX, body: { default_branch: "main", visibility: "private", archived: false, description: "", permissions: { project_access: { access_level: 40 } } } },
  { method: "GET", path: `${GL_PREFIX}/repository/commits/main`, body: { id: HEAD } },
  { method: "GET", path: `${GL_PREFIX}/repository/tree`, body: [] },
  { method: "GET", path: `${GL_PREFIX}/repository/branches/main`, body: { commit: { id: HEAD } } },
  ...LAYOUT.map((path) => ({ method: "GET", path: `${GL_PREFIX}/repository/files/${encodeURIComponent(path)}`, status: 404, body: {} })),
  { method: "GET", path: `${GL_PREFIX}/repository/branches/main`, body: { commit: { id: HEAD } } },
  { method: "POST", path: `${GL_PREFIX}/repository/commits`, body: { id: NEW_COMMIT, web_url: `${GL_WEB}/-/commit/${NEW_COMMIT}` } },
];

// A fake of fetch answering the script in order and recording what it was asked. An unscripted request throws.
function recording(steps) {
  const remaining = [...steps], seen = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    seen.push({ method, path: url.pathname, body: typeof init.body === "string" ? init.body : "" });
    const step = remaining.shift();
    if (!step) throw new Error(`unscripted request: ${method} ${url.pathname}`);
    assert.equal(`${method} ${url.pathname}`, `${step.method} ${step.path}`, "the request does not match the script");
    return new Response(JSON.stringify(step.body ?? {}), { status: step.status ?? 200, headers: { "content-type": "application/json" } });
  };
  return { fetch, seen };
}

// The route drawn for `web`, Add product pressed with `steps`. -> the Step C line, the products list, and what was sent.
async function addProduct({ web, store, steps }) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, contextOf(store), {});
  type(byClass(target, "address")[0], web);
  await turn();
  const stepC = byClass(target, "step").find((step) => (byTag(step, "h3")[0]?.textContent ?? "").startsWith("Step C"));
  const fake = recording(steps);
  const real = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try { await click(byTag(stepC, "button")[0]); } finally { globalThis.fetch = real; }
  await turn();
  return { line: byClass(stepC, "result").at(-1)?.textContent ?? "", products: readSetting(store, "products"), seen: fake.seen };
}
// The requests that write: every one but a GET, and but the read-only GraphQL query of greenToMerge (ITM-1170).
const writesOf = (seen) => seen.filter((request) => request.method !== "GET" && request.path !== "/graphql");

// TST-883001
// level: unit
// module: MOD-settings-pages
// guards: NO SECRET IN THE REPOSITORY
// given: a GitHub product whose default branch holds no file, the product's own token stored, and a stored endpoint key that is a part of the layout's CHANGELOG.md
// input: type the product's address, press Add product
// expect: the line of Step C says CHANGELOG.md holds a configured secret and nothing was written, no request writes (POST, PATCH), and the product is not in the list
test("TST-883001 · Add product on GitHub refuses a layout commit that holds a stored secret", async () => {
  const store = freshStore();
  seed(store, `github-token:${GH_PATH}`, { value: "github_pat_ALICE0123456789abcdefghij" });
  seed(store, "endpoint:ep1", { url: "https://models.example/v1", kind: "openai-compatible", model: "model-a", key: SECRET });
  const { line, products, seen } = await addProduct({ web: GH_WEB, store, steps: ghSteps() });
  assert.equal(/CHANGELOG\.md holds a configured secret — nothing was written/.test(line), true, `the line names the refusal (it says: ${line})`);
  assert.deepEqual(writesOf(seen).map((request) => `${request.method} ${request.path}`), [], "no request writes");
  assert.equal(products, null, "the product is not added to the list");
});

// TST-883002
// level: unit
// module: MOD-settings-pages
// guards: NO SECRET IN THE REPOSITORY
// given: a GitLab product whose default branch holds no file, the project's token stored, and a stored endpoint key that is a part of the layout's CHANGELOG.md
// input: type the project's address, press Add product
// expect: the line of Step C says CHANGELOG.md holds a configured secret and nothing was written, no request writes (POST), and the product is not in the list
test("TST-883002 · Add product on GitLab refuses a layout commit that holds a stored secret", async () => {
  const store = freshStore();
  seed(store, `gitlab-token:gitlab.example.org/${GL_PATH}`, { value: "glpat-TEAM0123456789" });
  seed(store, "endpoint:ep1", { url: "https://models.example/v1", kind: "openai-compatible", model: "model-a", key: GL_SECRET });
  const { line, products, seen } = await addProduct({ web: GL_WEB, store, steps: glSteps() });
  assert.equal(/CHANGELOG\.md holds a configured secret — nothing was written/.test(line), true, `the line names the refusal (it says: ${line})`);
  assert.deepEqual(writesOf(seen).map((request) => `${request.method} ${request.path}`), [], "no request writes");
  assert.equal(products, null, "the product is not added to the list");
});

// TST-883003
// level: unit
// module: MOD-settings-pages
// guards: NO SECRET IN THE REPOSITORY
// given: the same GitHub product, with a stored endpoint key that is no part of the layout's text
// input: type the product's address, press Add product
// expect: the line of Step C says the layout was written, three writes reach the server (the tree, the commit, the branch), no body holds the key, and the product is in the list (the known positive of TST-883001)
test("TST-883003 · Add product on GitHub writes the layout when no stored secret is part of it", async () => {
  const store = freshStore();
  seed(store, `github-token:${GH_PATH}`, { value: "github_pat_ALICE0123456789abcdefghij" });
  seed(store, "endpoint:ep1", { url: "https://models.example/v1", kind: "openai-compatible", model: "model-a", key: OTHER });
  const { line, products, seen } = await addProduct({ web: GH_WEB, store, steps: ghSteps() });
  assert.equal(/Done — wrote the missing review layout/.test(line), true, `the line says the layout was written (it says: ${line})`);
  assert.deepEqual(writesOf(seen).map((request) => `${request.method} ${request.path}`), [`POST ${GH_PREFIX}/git/trees`, `POST ${GH_PREFIX}/git/commits`, `PATCH ${GH_PREFIX}/git/refs/heads/main`]);
  assert.equal(writesOf(seen).some((request) => request.body.includes(OTHER)), false, "no body holds the key");
  assert.deepEqual(products, [GH_WEB], "the product is in the list");
});
