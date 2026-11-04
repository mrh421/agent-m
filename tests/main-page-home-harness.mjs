// The browser, the repositories and the network of the tests of MOD-main-page's route `home` — a helper, no test of its own. It installs the small browser fixture of
// tests/site-frame-start.d/dom.mjs (a document, a location, a local storage), opens the store of the instance alice/agent-m with the products and tokens a test gives, and puts a spy in
// place of `fetch` over the counting fake of GitHub of tests/progress-measures-load.mjs (a helper too): the spy keeps every request with the authorisation it carried, answers the Bridges
// lab-pc-4 (which lists the job it runs) and lab-pc-5 (which refuses the connection), answers GitHub's trees of named paths, and passes every other request to the fake. A test changes the files a repository holds with `change`, makes
// GitHub refuse its API with `refusing` ({ how: "limit" | "limit, no reset time" | "error", repository?: the one repository refused, every one where none is given }), and fires the timers a page sets itself (`timers`) at a clock it names. Nothing reaches the network; nothing sleeps.
//
// Module: MOD-main-page
// Level: unit

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { installPage, fixtureStorage } from "./site-frame-start.d/dom.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { INSTANCE, PRODUCT, githubServer, instanceFiles, productFiles } from "./progress-measures-load.mjs";

export { INSTANCE, PRODUCT, instanceFiles, productFiles };

/** The head commit the fake GitHub gives the branch main of `repository` (tests/progress-measures-load.mjs makes it the SHA-1 of the repository's name). */
export const headOf = (repository) => createHash("sha1").update(repository).digest("hex");
export const INSTANCE_TOKEN = "github_pat_HOME827INSTANCE0123456789abcdef";
export const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
export const OTHER_TOKEN = "github_pat_HOME847OTHER000123456789abcdefghijk";
export const INSTANCE_URL = `https://github.com/${INSTANCE}`;
export const PRODUCT_URL = `https://github.com/${PRODUCT}`;
export const OTHER = "bob/other";
export const OTHER_URL = `https://github.com/${OTHER}`;
export const MISSING_URL = "https://github.com/carol/missing";

// ---------------------------------------------------------------- the clock: one moment for every `new Date()` and Date.now() while a page is drawn

export const NOW = Date.parse("2026-10-16T12:00:00Z");
const RealDate = globalThis.Date;
let heldAt = NOW;
class FixedDate extends RealDate {
  constructor(...given) { if (given.length === 0) super(heldAt); else super(...given); }
  static now() { return heldAt; }
}
/** Runs `run` while every `new Date()` and Date.now() give `at` (milliseconds since 1970; NOW where none is given). */
export async function atNow(run, at = NOW) {
  globalThis.Date = FixedDate;
  heldAt = at;
  try { return await run(); } finally { globalThis.Date = RealDate; heldAt = NOW; }
}

// ---------------------------------------------------------------- the timers: nothing waits for the clock, a test fires a timer itself

const realTimers = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const fakeTimers = {
  setTimeout: (run, delay) => { const timer = { run, delay }; timers.waiting.push(timer); return timer; },
  clearTimeout: (timer) => { timers.waiting = timers.waiting.filter((held) => held !== timer); },
};
/**
 * The timers a page sets while a test runs. install() puts them in place of setTimeout and clearTimeout (draw() installs them); restore() puts the real ones back and forgets the waiting ones.
 * `waiting` are the timers set and neither fired nor cleared, { run, delay } in the order set; fire(at) runs the oldest one at the clock `at` and resolves once what it started has ended.
 */
export const timers = {
  waiting: [],
  install() { globalThis.setTimeout = fakeTimers.setTimeout; globalThis.clearTimeout = fakeTimers.clearTimeout; },
  restore() { globalThis.setTimeout = realTimers.setTimeout; globalThis.clearTimeout = realTimers.clearTimeout; timers.waiting = []; },
  async fire(at = NOW) {
    const [timer] = timers.waiting.splice(0, 1);
    assert.ok(timer, "the page has set no timer to fire");
    await atNow(() => timer.run(), at);
  },
};

// ---------------------------------------------------------------- the tab: whether it is shown, and the change of that

const tab = { listeners: [] };
/** Gives the fixture document the browser's `visibilityState` ("visible") and its `visibilitychange` listeners; browser() does it for every page. */
function installTab() {
  tab.listeners = [];
  Object.assign(globalThis.document, {
    visibilityState: "visible",
    addEventListener: (type, listener) => { if (type === "visibilitychange") tab.listeners.push(listener); },
    removeEventListener: (type, listener) => { if (type === "visibilitychange") tab.listeners = tab.listeners.filter((held) => held !== listener); },
  });
}
async function changeTab(state, at) {
  globalThis.document.visibilityState = state;
  await atNow(() => Promise.all(tab.listeners.map((listener) => listener())), at);
}
/**
 * The tab of the page, as the browser reports it: `hide()` and `show(at)` set `document.visibilityState` to "hidden" or "visible" and then fire `visibilitychange` at the clock `at` (NOW where none is given),
 * resolving once what the listeners started has ended; `listening` is the number of `visibilitychange` listeners the page holds.
 */
export const visibility = {
  get listening() { return tab.listeners.length; },
  hide: (at = NOW) => changeTab("hidden", at),
  show: (at = NOW) => changeTab("visible", at),
};

// ---------------------------------------------------------------- the files of a small product

const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const front = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value)
  ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: ${value}`])), "---"].join("\n");

const SPEC = ["# Product — Specification", "", "## 1. Section", "",
  "**FIRST RULE** *(Product Owner)*", "The first rule holds.", "*Check:* `tests/unit.test.mjs`", "",
  "**SECOND RULE** *(Product Owner)*", "The second rule holds.", "*Check:* no automatic check; at review.", ""].join("\n");

const useCase = (id, title) => [front({ id, title, area: "fixture", actors: ["Reader"], realises: ["FIRST RULE"] }), `# ${id} ${title}`, ""].join("\n");
const item = (id) => [front({ id, title: "The work", level: "module", realises: ["UC-001"], modules: ["MOD-store"] }), `# ${id} The work`, ""].join("\n");

const at = (text) => new RealDate(`${text}:00Z`);
/** A job record's text with its end appended, in `state` ("done", "failed" or "cancelled"), at 11:00 UTC. */
export const withEnd = (text, state) => appendToRecord(text, { part: "end", at: at("2026-10-16T11:00"), state, results: [], draft: null, rounds: [], usage: null,
  cost: { known: false, usage: null }, reason: state === "failed" ? "tests red" : null, log: null });

/** The same job as runningJob, ended in `state`. */
export function endedJob({ id, by, state, start = "2026-10-16T10:00" }) {
  const { path, text } = runningJob({ id, by, start });
  return { path, text: withEnd(text, state) };
}

/** The same job as runningJob, ended as failed. */
export const failedJob = ({ id, by, start }) => endedJob({ id, by, state: "failed", start });

/** A job record of the kind implement-item for ITM-0900, taken by `by` (a Bridge's name) at the start given, with no end. */
export function runningJob({ id, by, start = "2026-10-16T10:00" }) {
  const { path, text } = startRecord({ id, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-cli", model: "model-x", route: `bridge ${by}`, run: null, retries: null,
    startedBy: "alice", start: at(start), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
  return { path, text: appendToRecord(text, { part: "taken", at: at(start), by }) };
}

/**
 * The files of a product of two requirements, a test file, two use cases of which `accepted` ones carry an approval record, one backlog item ITM-0900 that builds on UC-001 (accepted in every
 * test that uses it), and the job records given.
 */
export function smallProduct({ accepted = ["UC-001"], jobs = [], queue = false } = {}) {
  const files = { "SPEC.md": SPEC, "tests/unit.test.mjs": "// TST-001 · level: unit · module: MOD-store\n// guards: FIRST RULE\ntest(\"a store reads\", () => {});\n",
    "docs/use-cases/UC-001-first.md": useCase("UC-001", "First"), "docs/use-cases/UC-002-second.md": useCase("UC-002", "Second"), "docs/backlog/ITM-0900-work.md": item("ITM-0900") };
  for (const id of accepted) {
    const path = Object.keys(files).find((candidate) => candidate.startsWith(`docs/use-cases/${id}-`));
    files[`docs/approvals/${id}-${blobOf(files[path]).slice(0, 12)}.md`] = `kind: use-case\nfile: ${path}\nblob: ${blobOf(files[path])}\n`;
  }
  for (const { path, text } of jobs) files[path] = text;
  if (queue) {
    const folder = "docs/spec-freigaben/2026-10-01a_fixture";
    files[`${folder}/index.md`] = "# SPEC approvals — queue 2026-10-01a · fixture\n\n| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n| 1 | `SPEC.md` | ## 1. Section | — | |\n";
    files[`${folder}/entscheidungen.md`] = "# Decisions\n\nAppend-only.\n";
    files[`${folder}/01-rules.md`] = "## 1. Section\n\n**FIRST RULE** *(PO)*\nThe first rule holds.\n*Check:* `tests/unit.test.mjs`\n";
    files[`${folder}/01-rules.begruendung.md`] = "# Reason\n\nWhy.\n";
  }
  return files;
}

// ---------------------------------------------------------------- the spy

const text = (body) => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function headerOf(init, name) {
  const given = init?.headers ?? {};
  const found = Object.entries(given instanceof Headers ? Object.fromEntries(given.entries()) : given).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found ? String(found[1]) : null;
}

/**
 * A fake GitHub serving `repos` ({ "owner/name": { path: text } }), with a spy over it. `bridgeLists` is the job identifier the Bridge lab-pc-4 lists as running (none lists no job); a test may set
 * `net.bridgeLists` later; `net.bridgeUsage` is the usage the Bridge lists for it, and `net.bridgeLog` (async (id, from) -> { lines, next, ended }) answers its log — the Bridge keeps none at first. `net.ciRuns` are the workflow runs (GitHub's answer, one page) that the job workflow's run list gives, none at first.
 * GitHub's trees of named folders and the entries of the folders of named files (with a token) are answered, each request kept in `net.folderReads` ({ repository, paths }).
 * `requests` keeps every request { url, host, authorization }; `server.log` is the fake's own record of what each request read (tests/progress-measures-load.mjs). install() puts the spy in
 * place of `fetch`; restore() puts the earlier one back.
 */
export function network(repos, { bridgeLists = null } = {}) {
  const servers = [githubServer(repos)];
  const requests = [];
  const real = globalThis.fetch;
  let held = repos, fake = null, spy = null;
  // GitHub's trees of named folders and the entries of the folders of named files ("Get a tree" of "<commit>:<path>", with recursive or without), which a
  // snapshot narrowed to named paths sends together: a folder of the repository of that head commit gives its files or its entries, a file 422, any other
  // path 404. Each request is kept in `net.folderReads` as { repository, paths } — a folder read whole as its path, a folder's entries as `<folder>/`.
  const treeNamed = (url) => {
    const m = /^\/repos\/[^/]+\/[^/]+\/git\/trees\/([^/:]+)(?::(.*))?$/.exec(url.pathname);
    if (!m || (m[2] === undefined && url.searchParams.has("recursive"))) return null;
    const named = Object.keys(held).find((each) => headOf(each) === m[1]) ?? null;
    if (!named) return null;
    const files = held[named], folder = (m[2] ?? "").split("/").map(decodeURIComponent).join("/"), recursive = url.searchParams.has("recursive");
    net.folderReads.push({ repository: named, paths: [recursive ? folder : `${folder}/`] });
    if (folder in files) return json(422, { message: "Invalid object requested. SHA must identify a commit or a tree." });
    const below = Object.keys(files).filter((path) => folder === "" || path.startsWith(`${folder}/`)).sort();
    if (!below.length) return json(404, { message: "Not Found" });
    const rest = (path) => (folder === "" ? path : path.slice(folder.length + 1));
    if (recursive) return json(200, { sha: "t".repeat(40), truncated: false, tree: below.map((path) => ({ path: rest(path), mode: "100644", type: "blob", sha: blobOf(files[path]) })) });
    const entries = new Map();
    for (const path of below) {
      const [name, ...deeper] = rest(path).split("/");
      if (!entries.has(name)) entries.set(name, deeper.length ? { path: name, mode: "040000", type: "tree", sha: "t".repeat(40) } : { path: name, mode: "100644", type: "blob", sha: blobOf(files[path]) });
    }
    return json(200, { sha: "t".repeat(40), truncated: false, tree: [...entries.values()] });
  };
  // `overviews` ({ "owner/name": { "<commit>": text } }): the files `<commit>.json` of the branch `overview-cache` each repository holds, and under the key "latest" its file latest.json; none is held at first.
  const net = { requests, bridgeLists, bridgeUsage: null, bridgeLog: null, refusing: null, ciRuns: [], overviews: {}, folderReads: [],
    // the fake's own record of what each request read: those of every state the repositories have been in
    server: { get log() { return servers.flatMap((server) => server.log); } },
    bridgeAsked: () => requests.filter((request) => request.host === "127.0.0.1:4711").length,
    install() {
      servers[0].install();
      fake = globalThis.fetch;
      spy = async (input, init) => {
        const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
        requests.push({ url: url.href, host: url.host, authorization: headerOf(init, "authorization") });
        if (url.host === "127.0.0.1:4711" && url.pathname === "/v1/jobs") return json(200, { jobs: net.bridgeLists ? [{ id: net.bridgeLists, state: "running", usage: net.bridgeUsage }] : [] });
        const logOf = url.host === "127.0.0.1:4711" ? /^\/v1\/jobs\/([^/]+)\/log$/.exec(url.pathname) : null;
        if (logOf) return net.bridgeLog ? json(200, await net.bridgeLog(decodeURIComponent(logOf[1]), Number(url.searchParams.get("from")))) : json(404, { error: "not-found", message: "The Bridge keeps no log." });
        if (url.host === "127.0.0.1:4712") throw new TypeError("connect ECONNREFUSED 127.0.0.1:4712");
        const overview = url.host === "api.github.com" && url.searchParams.get("ref") === "overview-cache"
          ? /^\/repos\/([^/]+\/[^/]+)\/contents\/([0-9a-f]+(?:\.facts)?|latest)\.json$/.exec(url.pathname) : null;
        if (overview) {
          const held = net.overviews[overview[1]]?.[overview[2]];
          return held === undefined ? new Response('{"message":"Not Found"}', { status: 404 }) : new Response(held, { status: 200 });
        }
        if (net.refusing && url.host === "api.github.com" && (!net.refusing.repository || url.pathname.startsWith(`/repos/${net.refusing.repository}/`))) {
          if (net.refusing.how === "error") return new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
          const reset = net.refusing.how === "limit" ? { "x-ratelimit-reset": String(RATE_RESET / 1000) } : {};
          return new Response("{}", { status: 403, headers: { "content-type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", ...reset } });
        }
        if (url.host === "api.github.com" && /\/actions\/workflows\/[^/]+\/runs$/.test(url.pathname)) return json(200, { workflow_runs: net.ciRuns });
        const tree = url.host === "api.github.com" ? treeNamed(url) : null;
        if (tree) return tree;
        return fake(input, init);
      };
      globalThis.fetch = spy;
    },
    /** The files `repository` holds from now on: its blobs are new where its files are, its commit is the commit it was. */
    change(repository, files) {
      held = { ...held, [repository]: files };
      const next = githubServer(held);
      servers.push(next);
      next.install();
      fake = globalThis.fetch;
      globalThis.fetch = spy;
    },
    restore() { for (const server of servers.toReversed()) server.restore(); globalThis.fetch = real; } };
  return net;
}

/** When GitHub's limit of the account is given back, in the answers the spy gives while `refusing`. */
export const RATE_RESET = Date.parse("2026-10-16T13:00:00Z");

// ---------------------------------------------------------------- the page

/**
 * The browser of the instance alice/agent-m: its store with the `products` given and a token for the instance and for each product named in `tokens`, and the Bridges lab-pc-4 and
 * lab-pc-5. Returns the ViewContext a route is given on the main page: the instance connected with `instanceToken` (none with null).
 */
export function browser({ products = [PRODUCT_URL], tokens = { [PRODUCT]: PRODUCT_TOKEN }, instanceToken = INSTANCE_TOKEN } = {}) {
  installPage({ hostname: "alice.github.io", pathname: "/agent-m/" });
  installTab();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: fixtureStorage() });
  const store = openStore(INSTANCE);
  writeSetting(store, "products", products);
  if (instanceToken) writeSetting(store, "github-token", { value: instanceToken, name: "instance token", expires: "2027-01-01" });
  for (const [repository, value] of Object.entries(tokens)) if (value) writeSetting(store, `github-token:${repository}`, { value, name: `${repository} token`, expires: "2027-01-01" });
  writeSetting(store, "bridge:lab-pc-4", { address: "http://127.0.0.1:4711", token: "pairing-token-four" });
  writeSetting(store, "bridge:lab-pc-5", { address: "http://127.0.0.1:4712", token: "pairing-token-five" });
  const went = [];
  return { page: "main", instance: { repository: INSTANCE, host: connect(parseAddress(INSTANCE_URL), instanceToken ? { token: instanceToken } : {}) }, product: null, store,
    go: (route, params = {}) => { went.push([route, params]); }, went };
}

/** A count of the reads of the setting `key` from the store's local storage, from now on: `reads.count`. The reading itself is passed on unchanged. */
export function countReads(store, key) {
  const reads = { count: 0 };
  const getItem = store.storage.getItem.bind(store.storage);
  store.storage.getItem = (name) => { if (name === store.prefix + key) reads.count += 1; return getItem(name); };
  return reads;
}

/** Draws a route into a new element at the fixed clock, with the timers of `timers` in place of the real ones, and returns the element. `params` are the route's parameters. */
export async function draw(route, context, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  timers.install();
  await atNow(() => route.render(target, context, params));
  return target;
}

// ---------------------------------------------------------------- reading the drawn page

export const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const child of node.children) { if (typeof child !== "string") { if (match(child)) found.push(child); walk(child); } } })(root);
  return found;
};
export const byClass = (root, name) => find(root, (node) => node.className.split(/\s+/).includes(name));
export const cardsOf = (target) => byClass(target, "card");
export const stagesOf = (card) => byClass(card, "stage").map((stage) => [stage.getAttribute("data-stage"), byClass(stage, "stage-share")[0].textContent, byClass(stage, "stage-detail")[0].textContent]);
export const currentOf = (card) => byClass(card, "is-current").map((stage) => stage.getAttribute("data-stage"));
export const buildOf = (card) => byClass(card, "build-row").map((row) => ["build-item", "build-job", "build-participant", "build-state", "build-elapsed"].map((name) => byClass(row, name)[0].textContent));
export const click = (node) => node.dispatchEvent(new Event("click"));
export const waitsOf = (target) => byClass(target, "wait").map((line) => line.textContent.replace(/ Open$/, ""));
