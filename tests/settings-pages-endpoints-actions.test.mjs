// The settings pages for an endpoint that runs through GitHub Actions — MOD-settings-pages' `endpoints` route and the Settings page's endpoint line and job
// workflow line, as UC-003 (step 2, 4a) and docs/architecture/MOD-settings-pages.md state them: the form asks the place, the context and the name of the CI
// secret of the key; a test the browser refuses says plainly that the host does not accept calls from a web page; for such an endpoint whose key this browser keeps,
// one click stores the key as a GitHub Actions secret of the repository, keeps the secret's name with the endpoint beside the key, which stays in this browser, and spawns a
// test job there; and the job workflow's Install names the CI secret each of this browser's endpoints names.
// Run: node --test tests/settings-pages-endpoints-actions.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-003; UC-010; AN UNSUPPORTED ENDPOINT SAYS SO; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// Level: unit
//
// The repository servers are fixtures in memory; the model endpoint is a fake `fetch` that refuses as a browser refuses a call without a cross-origin permission
// ("TypeError: Failed to fetch"), with `window` defined so that the call counts as the browser's. Nothing reaches the network; the key is a fixture.

import test from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";

class Element {
  constructor(name) { this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.disabled = false; this.hidden = false; this.attributes = new Map(); this.listeners = []; }
  append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.push([type, listener]); }
  fire(type, event = {}) { return Promise.all(this.listeners.filter(([kind]) => kind === type).map(([, listener]) => listener({ type, target: this, currentTarget: this, ...event }))); }
  focus() {}
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
globalThis.document = { createElement: (name) => new Element(name) };

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const click = (node, isTrusted = false) => node.fire("click", { isTrusted });
const route = (name) => view.routes.find((candidate) => candidate.name === name);
const until = async (condition, what) => { for (let at = 0; at < 400; at += 1) { if (condition()) return; await new Promise((resolve) => setImmediate(resolve)); } throw new Error(`timed out: ${what}`); };

const KEY = "nvapi-FIXTURE-0123456789";
const NVIDIA = { url: "https://integrate.api.nvidia.com/v1", kind: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b" };
const INSTANCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PARTICIPANTS = ["# Participants of this instance", "", "**REGISTER**", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|", "| alice | person | — | — | — | read the repository | — | account github.com/alice |", ""].join("\n");

// The instance's repository on GitHub, in memory: `secrets` keeps every setCiSecret, `commits` every commit; it holds no job workflow.
function instanceRepository() {
  const secrets = [], commits = [];
  const repository = { server: "github", origin: "https://github.com", path: "fixture/instance", web: "https://github.com/fixture/instance" };
  const files = new Map([["docs/participants.md", PARTICIPANTS], ["SPEC.md", "# Spec\n"]]);
  return { secrets, commits, host: {
    async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private", archived: false, description: "" }; },
    async readSnapshot(ref) { return { repository, ref, commit: INSTANCE_COMMIT, paths: [...files.keys()], blob: (path) => (files.has(path) ? "b".repeat(40) : null), async read(path) { return files.get(path) ?? null; } }; },
    async listPullRequests() { return []; },
    async containsCommit() { return false; },
    async setCiSecret(name, value) { secrets.push({ name, value }); },
    async commitFiles(change) { commits.push(change); throw new Error("no commit is expected"); },
    async startWorkflow() { throw new Error("no workflow is expected"); },
  } };
}

function freshStore() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  return openStore("fixture/instance");
}

// The browser refuses the call, as Chrome does for an endpoint that sends no Access-Control-Allow-Origin; `window` makes the call the browser's.
async function asTheBrowser(run) {
  const real = globalThis.fetch, hadWindow = "window" in globalThis, requests = [];
  globalThis.window = globalThis.window ?? {};
  globalThis.fetch = async (url) => { requests.push(String(url)); throw new TypeError("Failed to fetch"); };
  try { return await run(requests); } finally { globalThis.fetch = real; if (!hadWindow) delete globalThis.window; }
}

// TST-1200201 · level: unit · module: MOD-settings-pages
// guards: UC-003; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: an empty store; the endpoint form filled with nvidia's address, kind and model, no key, the place "NVIDIA, USA", the context 128000 and the CI secret NVIDIA_API_KEY
// input: Save and test
// expect: endpoint:nvidia holds the place, the context as a number and the secret's name, and no key; no request is made to the endpoint — it runs through GitHub Actions — and the page says so, naming the secret; and Save and test spawns its test job there, which this repository, holding no job workflow, refuses, saying why and committing nothing
test("the endpoint form keeps the place, the context and the CI secret's name; an endpoint with a secret and no key runs through GitHub Actions and is not called", async () => {
  const store = freshStore(), repo = instanceRepository();
  const target = document.createElement("div");
  await route("endpoints").render(target, { instance: { repository: "fixture/instance", host: repo.host }, product: null, store, go() {} }, {});
  one(target, "endpoint-name").value = "nvidia";
  one(target, "endpoint-url").value = NVIDIA.url;
  one(target, "endpoint-model").value = NVIDIA.model;
  one(target, "endpoint-place").value = "NVIDIA, USA";
  one(target, "endpoint-context").value = "128000";
  one(target, "endpoint-secret").value = "NVIDIA_API_KEY";
  await asTheBrowser(async (requests) => {
    await click(one(target, "endpoint-test"), true);
    assert.deepEqual(requests, []);
  });
  assert.deepEqual(readSetting(store, "endpoint:nvidia"), { ...NVIDIA, place: "NVIDIA, USA", context: 128000, secret: "NVIDIA_API_KEY" });
  assert.match(one(target, "endpoint-result").textContent, /runs through GitHub Actions/);
  assert.match(one(target, "endpoint-result").textContent, /NVIDIA_API_KEY/);
  await until(() => /No test job was spawned|could not be spawned/.test(one(target, "endpoint-result").textContent), "the test job's outcome is shown");
  assert.match(one(target, "endpoint-result").textContent, /No test job was spawned: the product has no Agent M job workflow yet/);
  assert.deepEqual(repo.commits, []);
});

// TST-1200202 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: endpoint nvidia with a key, place and context, which the browser refuses ("Failed to fetch"); and, as the counter-proof, the same endpoint answering 401 with "Invalid API key"
// input: Save and test on the form; then the Settings page's endpoint line
// expect: the result says "✗ integrate.api.nvidia.com does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge.", the browser's "Failed to fetch" only after it in parentheses; the line's status says "Refused: integrate.api.nvidia.com does not accept calls from a web page…"; for the 401 the endpoint's own message is shown
test("a test the browser refuses says plainly that the host does not accept calls from a web page, on the form and on the Settings line", async () => {
  const store = freshStore(), repo = instanceRepository();
  const context = { instance: { repository: "fixture/instance", host: repo.host }, product: null, store, go() {} };
  const target = document.createElement("div");
  await route("endpoints").render(target, context, {});
  for (const [field, value] of [["endpoint-name", "nvidia"], ["endpoint-url", NVIDIA.url], ["endpoint-model", NVIDIA.model], ["endpoint-key", KEY], ["endpoint-place", "NVIDIA, USA"], ["endpoint-context", "128000"]]) one(target, field).value = value;
  await asTheBrowser(() => click(one(target, "endpoint-test"), true));
  const said = one(target, "endpoint-result").textContent;
  assert.equal(said, "✗ integrate.api.nvidia.com does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge. (The browser said: Failed to fetch)");
  const page = document.createElement("div");
  await route("settings").render(page, context, {});
  assert.match(one(page, "settings-endpoint-status").textContent, /^Refused: integrate\.api\.nvidia\.com does not accept calls from a web page; run it through GitHub Actions \(CI secret\) or a Bridge\.$/);
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401, headers: { "content-type": "application/json" } });
  try { await click(one(target, "endpoint-test"), true); } finally { globalThis.fetch = real; }
  assert.match(one(target, "endpoint-result").textContent, /Invalid API key/);
  assert.equal(byClass(target, "endpoint-actions").length, 0, "a refused key offers no move to GitHub Actions");
});

// TST-1200203 · level: unit · module: MOD-settings-pages
// guards: UC-003; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the refused endpoint of TST-1200202, whose key this browser keeps; the instance's repository on GitHub, which holds no job workflow
// input: the offer read; a script's click on its button; then a person's click
// expect: before the click the page says what the click does — the secret NVIDIA_API_KEY, the repository fixture/instance, that the key stays in this browser and a test job is spawned —; the script's click stores nothing; the person's click stores exactly one secret, NVIDIA_API_KEY with the key, keeps endpoint:nvidia with the secret's name and with the key, and, since the repository has no job workflow, says that no test job was spawned and why, committing nothing
test("one click stores the key as the GitHub secret, keeps it in this browser and spawns the test job, saying first what it does", async () => {
  const store = freshStore(), repo = instanceRepository();
  const target = document.createElement("div");
  await route("endpoints").render(target, { instance: { repository: "fixture/instance", host: repo.host }, product: null, store, go() {} }, {});
  for (const [field, value] of [["endpoint-name", "nvidia"], ["endpoint-url", NVIDIA.url], ["endpoint-model", NVIDIA.model], ["endpoint-key", KEY], ["endpoint-place", "NVIDIA, USA"], ["endpoint-context", "128000"]]) one(target, field).value = value;
  await asTheBrowser(() => click(one(target, "endpoint-test"), true));
  const consent = one(target, "endpoint-actions-consent").textContent;
  for (const part of ["NVIDIA_API_KEY", "fixture/instance", "the key stays in this browser", "test job"]) assert.ok(consent.includes(part), `${part} in ${consent}`);
  await click(one(target, "endpoint-actions"), false);
  assert.deepEqual(repo.secrets, [], "a script's click stores nothing");
  await click(one(target, "endpoint-actions"), true);
  await until(() => /No test job was spawned|could not be spawned/.test(one(target, "endpoint-result").textContent), "the test job's outcome is shown");
  assert.deepEqual(repo.secrets, [{ name: "NVIDIA_API_KEY", value: KEY }]);
  assert.deepEqual(readSetting(store, "endpoint:nvidia"), { ...NVIDIA, place: "NVIDIA, USA", context: 128000, key: KEY, secret: "NVIDIA_API_KEY" });
  assert.match(one(target, "endpoint-result").textContent, /No test job was spawned: the product has no Agent M job workflow yet/);
  assert.deepEqual(repo.commits, []);
});

// TST-1200204 · level: unit · module: MOD-settings-pages
// guards: UC-010; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: a GitHub product without the job workflow and a token that writes to it; this browser keeps endpoint:nvidia naming the CI secret NVIDIA_API_KEY, and endpoint:plain naming none
// input: the Settings page's product tab, its job workflow line
// expect: the secrets it names are AGENT_M_TOKEN and NVIDIA_API_KEY, and nothing for plain; Install commits .github/workflows/agent-m-jobs.yml, whose job reads `NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}` and lists it in AGENT_M_KEY_NAMES
test("the job workflow's Install names the CI secret each of this browser's endpoints names", async () => {
  const store = freshStore(), repo = instanceRepository(), writes = [];
  writeSetting(store, "endpoint:nvidia", { ...NVIDIA, place: "NVIDIA, USA", context: 128000, secret: "NVIDIA_API_KEY" });
  writeSetting(store, "endpoint:plain", { ...NVIDIA, key: KEY });
  writeSetting(store, "github-token:fixture/product", { value: "github_pat_FIXTURE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  const product = { address: "https://github.com/fixture/product", host: {
    async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private" }; },
    async readSnapshot() { return { commit: "1".repeat(40), paths: [], blob: () => null, async read() { return null; } }; },
    async commitFiles(change) { writes.push(change); return { commit: "2".repeat(40) }; },
  } };
  const page = document.createElement("div");
  await route("settings").render(page, { instance: { repository: "fixture/instance", host: repo.host }, product, store, go() {} }, {});
  await click(byClass(page, "settings-tab")[1]);
  const line = one(page, "settings-job-workflow");
  assert.equal(one(line, "settings-job-workflow-secrets").textContent.trim(), "Secrets named: AGENT_M_TOKEN, NVIDIA_API_KEY.");
  await click(one(line, "settings-job-workflow-install"), true);
  assert.equal(writes.length, 1);
  const workflow = writes[0].files.find((file) => file.path === ".github/workflows/agent-m-jobs.yml").text;
  assert.match(workflow, /^ {6}NVIDIA_API_KEY: \$\{\{ secrets\.NVIDIA_API_KEY \}\}$/m);
  assert.match(workflow, /AGENT_M_KEY_NAMES: "NVIDIA_API_KEY"/);
});
