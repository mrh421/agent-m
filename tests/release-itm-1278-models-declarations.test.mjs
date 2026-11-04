// Release tests of ITM-1278 — UC-031 step 1 on the page Process models (`#models`): the page lists, for each model, the products of this browser whose declaration names it, and reads each of those products through
// its commit, one request narrowed to `docs/process.md` and that one file. The behaviour is docs/architecture/MOD-implementation-pages.md's (`models`: "Which products of this browser declare a model, it reads from
// each product's `docs/process.md` alone, through a snapshot of its default branch narrowed to that file (MOD-repository-hosts' `readSnapshot` with `folders`), never the product's whole tree.") and the
// requirement THE PROCESS MODEL IS DECLARED PER PRODUCT's.
// Run: node --test tests/release-itm-1278-models-declarations.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// Level: release
//
// Written for the release testing of sprint 114 by a participant who implemented none of ITM-1278 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/implementation-pages-models-declarations.test.mjs) take three products of a few files each; these cases take their own five: three that declare a model, one of them an instance's own model and one
// the shipped Kanban; one of three hundred files that declares none; and one that cannot be read. The real MOD-repository-hosts, MOD-model-catalogue, MOD-product-process, MOD-browser-store and MOD-site-frame run
// as they are; the only thing faked is the global `fetch`, a counting fake of GitHub that records every request with its repository and refuses any other address. No request leaves the process. Readings the texts
// leave open, taken here:
//   - "the product's whole tree" is read as a request of `git/trees` of the product (the REST route the host reads a whole commit by); a request for the commit and for the repository's information stands outside it.
//   - "narrowed to that file" is read as one POST of GitHub's GraphQL API about the product whose query names no path but `docs/process.md`.
//   - a product without `docs/process.md` has no file to read: it is read by its repository's information, its commit and the one narrowed request, and no file is requested for it.
//   - "what the page shows is unchanged" is read as the lists the page drew before the change: under each model the addresses of the products that declare it, in the order of the setting `products`, no address under
//     another model, and an address whose repository cannot be read named in the list of unreadable products with a reason, under no model.

import { treeRequest, treeAnswer } from "./github-trees-fake.mjs";
import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "models");

// ---------------------------------------------------------------- the world: an instance with one model of its own, and five products

const OWN = readFileSync(new URL("../docs/process-models/scrum-wip.md", import.meta.url), "utf8");
const declaring = (name, file) => `---\nmodel: ${name}\nmodel_file: ${file}\nmodel_version: ${"b".repeat(40)}\n---\n\n# How this product is developed\n`;
const sha = (text) => createHash("sha1").update(text).digest("hex");

const HUB = "https://github.com/northwind/hub";
const LEDGER = "https://github.com/northwind/ledger", ORDERS = "https://github.com/northwind/orders", BILLING = "https://github.com/northwind/billing";
const ARCHIVE = "https://github.com/northwind/archive", MISSING = "https://github.com/northwind/missing";
const PRODUCTS = [LEDGER, ARCHIVE, ORDERS, MISSING, BILLING];
const TOKENS = { "northwind/hub": "github_pat_HUBfixture0123456789abcdef", "northwind/ledger": "github_pat_LEDGERfixture0123456789ab", "northwind/orders": "github_pat_ORDERSfixture0123456789a",
  "northwind/billing": "github_pat_BILLINGfixture0123456789", "northwind/archive": "github_pat_ARCHIVEfixture012345678", "northwind/missing": "github_pat_MISSINGfixture01234567" };
const MANY = Object.fromEntries(Array.from({ length: 300 }, (_, n) => [`src/part-${n}/index.mjs`, `export const part = ${n};\n`]));
const REPOSITORIES = {
  "northwind/hub": { "docs/process-models/scrum-wip.md": OWN, "README.md": "# Hub\n" },
  "northwind/ledger": { "docs/process.md": declaring("scrum", "src/model-catalogue/models/scrum.md"), "README.md": "# Ledger\n", "src/ledger.mjs": "export {};\n" },
  "northwind/orders": { "docs/process.md": declaring("kanban", "src/model-catalogue/models/kanban.md"), "README.md": "# Orders\n", "docs/use-cases/UC-001-order.md": "# UC-001\n" },
  "northwind/billing": { "docs/process.md": declaring("scrum-wip", "docs/process-models/scrum-wip.md"), "README.md": "# Billing\n", "src/billing.mjs": "export {};\n" },
  "northwind/archive": { "README.md": "# An archive that declares no model\n", ...MANY },
};

// ---------------------------------------------------------------- the counting fake of GitHub

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
const realFetch = globalThis.fetch;
const spy = { unrouted: [], requests: [] };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function headerOf(init, name) {
  const given = init?.headers ?? {};
  const found = Object.entries(given instanceof Headers ? Object.fromEntries(given.entries()) : given).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found ? String(found[1]) : null;
}
// GitHub's API as the host reads it: the repository, the commit of the default branch, the whole tree, the trees of named folders and the entries of the folders of named files (`folders`, its query the
// folder asked for, `<folder>/` for its entries), a file, and the GraphQL answer — `f<i>` the text of a file at a commit. Each answered request is recorded as { repository, kind, query }; kind is `repository`,
// `commit`, `tree`, `folders`, `file <path>` or `graphql`. A repository that is not in the world is answered 404.
function github(url, authorization, body) {
  const record = (repository, kind, query = null) => spy.requests.push({ repository, kind, query });
  if (url.host === "api.github.com" && url.pathname === "/graphql") {
    const { query, variables } = JSON.parse(body);
    const name = `${variables.owner}/${variables.name}`;
    record(name, "graphql", query);
    if (!REPOSITORIES[name] || authorization !== `Bearer ${TOKENS[name]}`) return json(200, { data: { repository: null } });
    const repository = {};
    for (const [, alias, expression] of query.matchAll(/(f\d+):object\(expression:("[^"]*")\)/g)) {
      const file = REPOSITORIES[name][JSON.parse(expression).split(":").slice(1).join(":")];
      repository[alias] = file === undefined ? null : { text: file, isTruncated: false };
    }
    return json(200, { data: { repository } });
  }
  const api = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(decodeURIComponent(url.pathname));
  if (url.host !== "api.github.com" || !api) return null;
  const [, name, rest = ""] = api;
  const files = REPOSITORIES[name];
  const tree = treeRequest(url);
  if (tree && (tree.path || !tree.recursive)) {
    record(name, "folders", tree.recursive ? tree.path : `${tree.path}/`);
    return !files || authorization !== `Bearer ${TOKENS[name]}` ? json(404, { message: "Not Found" }) : treeAnswer(files, tree, (each) => sha(files[each]));
  }
  record(name, rest === "" ? "repository" : rest === "/commits/main" ? "commit" : rest.startsWith("/git/trees/") ? "tree" : `file ${rest.replace(/^\/contents\//, "")}`);
  if (!files || authorization !== `Bearer ${TOKENS[name]}`) return json(404, { message: "Not Found" });
  if (rest === "") return json(200, { default_branch: "main", visibility: "private", private: true });
  if (rest === "/commits/main") return json(200, { sha: sha(`${name}@main`) });
  if (rest.startsWith("/git/trees/")) return json(200, { tree: Object.entries(files).map(([file, content]) => ({ type: "blob", path: file, sha: sha(content) })) });
  const file = /^\/contents\/(.+)$/.exec(rest);
  if (file && files[file[1]] !== undefined) return new Response(files[file[1]], { status: 200, headers: { "content-type": "text/plain" } });
  return json(404, { message: "Not Found" });
}
function install() {
  spy.unrouted = [];
  spy.requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const served = github(url, headerOf(init, "authorization"), init?.body);
    if (served) return served;
    spy.unrouted.push(url.href);
    throw new TypeError(`no request leaves the fixtures: ${url.href}`);
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the page

function browser() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("northwind/hub");
  writeSetting(store, "products", PRODUCTS);
  writeSetting(store, "github-token", { value: TOKENS["northwind/hub"], name: "instance token", expires: "2027-01-01" });
  for (const name of ["ledger", "orders", "billing", "archive", "missing"]) writeSetting(store, `github-token:northwind/${name}`, { value: TOKENS[`northwind/${name}`], name: `${name} token`, expires: "2027-01-01" });
  return { page: "review", instance: { repository: "northwind/hub", host: connect(parseAddress(HUB), { token: TOKENS["northwind/hub"] }) }, product: null, store, go() {} };
}
async function draw() {
  const context = browser();
  install();
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  assert.deepEqual(spy.unrouted, []);
  return target;
}
const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
};
const byClass = (root, name) => find(root, (node) => node.className.split(/\s+/).includes(name));
const modelOf = (target, name) => find(target, (node) => node.getAttribute("data-model") === name)[0];
const productsOf = (model) => find(byClass(model, "products")[0], (node) => node.localName === "li").map((item) => item.textContent);
const requestsTo = (name) => spy.requests.filter((request) => request.repository === name);
const kindsTo = (name) => requestsTo(name).map((request) => request.kind).sort();
// Every path the narrowed requests of a product name: the `<commit>:<path>` expressions of their queries.
const pathsAsked = (name) => requestsTo(name).filter((request) => request.kind === "folders").map((request) => request.query);

// TST-1278301 · level: release · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: a browser that manages northwind/ledger, orders, billing, archive and missing, of which ledger, orders and billing hold docs/process.md and archive, of three hundred files, holds none and missing is no repository the server knows; a counting fake of GitHub that records every request with its repository, and records a git/trees request when a product's whole tree is read
// input: the route models drawn
// expect: to each of ledger, orders and billing the route sends exactly five requests — the repository's information with, beside it, the GraphQL request of greenToMerge (ITM-1170), the commit, one read of the entries of docs/, the folder of docs/process.md, and one read of docs/process.md — and no whole tree; known positive: the same fake records a git/trees request when the whole tree of ledger is read
// Planted fault: a route that reads the product's whole snapshot (`readSnapshot(defaultBranch)` without the folders in declarationsOf of src/implementation-pages/process.mjs) sends git/trees for each of the three and no folders request, and fails the kinds; one that reads the file twice, or the folders twice, fails the counts.
test("TST-1278301 each product that declares a model is read by its commit, one narrowed request and its docs/process.md alone", async () => {
  const probe = connect(parseAddress(LEDGER), { token: TOKENS["northwind/ledger"] });
  install();
  await probe.readSnapshot("main");
  assert.deepEqual(spy.requests.map((request) => request.kind), ["commit", "tree"], "known positive: a read of the whole tree is recorded as a git/trees request");

  await draw();
  for (const name of ["northwind/ledger", "northwind/orders", "northwind/billing"]) {
    assert.deepEqual(kindsTo(name), ["commit", "file docs/process.md", "folders", "graphql", "repository"], name);
    assert.equal(requestsTo(name).filter((request) => request.kind === "tree").length, 0, `${name}: no git/trees`);
  }
});

// TST-1278302 · level: release · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: the browser and the fake of TST-1278301, in which northwind/archive holds three hundred files and no docs/process.md
// input: the route models drawn
// expect: archive is listed under no model and is no unreadable product; to archive the route sends the repository's information with the GraphQL request of greenToMerge beside it (ITM-1170), the commit and one read of the entries of docs/, and no read of docs/process.md, no read of any other file and no git/trees
// Planted fault: a route that reads the file whether or not the narrowed snapshot names it (a `read(DECLARATION_PATH)` after a null blob left in place of the guard of declarationsOf) sends a file request for archive; one that reads archive's whole tree for the 300 files fails the kinds; one that lists archive as unreadable fails the empty list.
test("TST-1278302 a product without a declaration is shown without a model, and no file and no tree is read for it", async () => {
  const target = await draw();
  for (const name of ["scrum", "scrum-wip", "waterfall", "v-model", "reuse-oriented", "kanban"]) assert.ok(!productsOf(modelOf(target, name)).includes(ARCHIVE), name);
  assert.deepEqual(byClass(target, "unreadable").flatMap((list) => find(list, (node) => node.localName === "li")).map((item) => item.textContent).filter((line) => line.startsWith(ARCHIVE)), [], "archive is no unreadable product");
  assert.deepEqual(kindsTo("northwind/archive"), ["commit", "folders", "graphql", "repository"]);
});

// TST-1278303 · level: release · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: the browser and the fake of TST-1278301
// input: the route models drawn
// expect: scrum lists northwind/ledger and no other product; kanban lists northwind/orders; scrum-wip, the instance's own model, lists northwind/billing; waterfall, v-model and reuse-oriented list none; northwind/archive and northwind/missing are under no model; northwind/missing is named in the list of unreadable products, with a reason after its address, and is the only product there
// Planted fault: a route that lists a product under the model its file names whatever the file read (the model_file taken from the first product for each) puts ledger under kanban and billing too; one that reports a product without declaration as unreadable lists archive; one that drops the reason of an unreadable product, or lists none, fails the last assertions.
test("TST-1278303 each model lists the products whose declaration names it, and a product that cannot be read is named with its reason", async () => {
  const target = await draw();
  assert.deepEqual(productsOf(modelOf(target, "scrum")), [LEDGER]);
  assert.deepEqual(productsOf(modelOf(target, "kanban")), [ORDERS]);
  assert.deepEqual(productsOf(modelOf(target, "scrum-wip")), [BILLING]);
  for (const name of ["waterfall", "v-model", "reuse-oriented"]) assert.deepEqual(productsOf(modelOf(target, name)), [], name);
  const unreadable = byClass(target, "unreadable").flatMap((list) => find(list, (node) => node.localName === "li")).map((item) => item.textContent);
  assert.equal(unreadable.length, 1, unreadable.join("\n"));
  assert.match(unreadable[0], new RegExp(`^${MISSING.replaceAll(".", "\\.")}: .+`));
});

// TST-1278304 · level: release · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: the browser and the fake of TST-1278301, in which archive holds three hundred files beside its README and ledger, orders and billing hold two or three
// input: the route models drawn
// expect: the narrowed requests of ledger, orders and billing name the entries of docs/, the folder of docs/process.md, and no other path, and so does the one request of archive; no request of any product but the instance's names a path under src/ or docs/use-cases/; the instance is read as before — its whole tree once, git/trees, for its catalogue — and its other requests name docs/process-models/ alone
// Planted fault: a route that narrows to a folder wider than the file (the folders [DECLARATION_PATH] of declarationsOf in src/implementation-pages/process.mjs replaced by ["docs"] or ["src"]) names docs/use-cases or src/part-… in the request of orders or archive, and fails the first assertions; one that narrows the instance too, so that its catalogue is not read, fails the last.
test("TST-1278304 the narrowed request of a product names docs/process.md and no other path, however many files the product holds", async () => {
  await draw();
  for (const name of ["northwind/ledger", "northwind/orders", "northwind/billing", "northwind/archive"]) assert.deepEqual(pathsAsked(name), ["docs/"], name);
  const wider = spy.requests.filter((request) => request.repository !== "northwind/hub" && request.query && /(src\/|docs\/use-cases)/.test(request.query));
  assert.deepEqual(wider, [], "no request of a product names a path of its sources or use cases");
  assert.equal(requestsTo("northwind/hub").filter((request) => request.kind === "tree").length, 1, "the instance's whole tree is read once, for its catalogue");
});
