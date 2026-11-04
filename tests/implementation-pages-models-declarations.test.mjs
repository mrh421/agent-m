// MOD-implementation-pages' route `models` reads each product's declaration alone (ITM-1278), as docs/architecture/MOD-implementation-pages.md states it:
// "Which products of this browser declare a model, it reads from each product's `docs/process.md` alone, through a snapshot of its default branch narrowed to that
// file (MOD-repository-hosts' `readSnapshot` with `folders`), never the product's whole tree." The shown result stays what TST-778002 states: each model lists the
// products of this browser whose declaration names it. MOD-repository-hosts' readSnapshot with `folders` (ITM-1266) is the one way of reading part of a commit.
// Run: node --test tests/implementation-pages-models-declarations.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// Level: component
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged, as tests/implementation-pages-models.test.mjs does. The real MOD-model-catalogue,
// MOD-product-process, MOD-browser-store, MOD-repository-hosts and MOD-site-frame run as they are; the only thing that is faked is the global `fetch`, a counting fake of
// GitHub that answers the fixtures' repositories, records every request with its repository, and refuses any other address with a TypeError (kept as `unrouted`).
// No request leaves the fixtures.
//
// Readings the texts leave open, which the pull request names:
//   - "per product sends its commit, one folders request and one read of docs/process.md" is read for a product that declares a model; the request for the repository's
//     information (its default branch) is the one request besides them, as the route sends it today. A product without a docs/process.md has no blob to read: the
//     folders request names none, and no read of the file is sent for it.
//   - The folders request is the one POST of GitHub's GraphQL API whose query names `docs/process.md`.

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

// ---------------------------------------------------------------- the fixtures: an instance with one model of its own, and three products

const OWN = readFileSync(new URL("../docs/process-models/scrum-wip.md", import.meta.url), "utf8");
const declaring = (name, file) => `---\nmodel: ${name}\nmodel_file: ${file}\nmodel_version: ${"a".repeat(40)}\n---\n\n# How this product is developed\n`;

const INSTANCE = "https://github.com/acme/agent-m", LIBRARY = "https://github.com/acme/library", ATLAS = "https://github.com/acme/atlas", BARE = "https://github.com/acme/bare";
const TOKENS = { "acme/agent-m": "github_pat_INSTANCEfixture0123456789", "acme/library": "github_pat_LIBRARYfixture0123456789",
  "acme/atlas": "github_pat_ATLASfixture0123456789", "acme/bare": "github_pat_BAREfixture0123456789" };
// Each product holds, beside its declaration, files a read of its whole tree would list.
const REPOSITORIES = {
  "acme/agent-m": { "docs/process-models/scrum-wip.md": OWN, "README.md": "# Agent M\n" },
  "acme/library": { "docs/process.md": declaring("scrum", "src/model-catalogue/models/scrum.md"), "README.md": "# Library\n", "src/a.mjs": "export {};\n", "docs/use-cases/UC-001-read.md": "# UC-001\n" },
  "acme/atlas": { "docs/process.md": declaring("scrum-wip", "docs/process-models/scrum-wip.md"), "README.md": "# Atlas\n", "src/b.mjs": "export {};\n" },
  "acme/bare": { "README.md": "# A product that declares no model yet\n", "src/c.mjs": "export {};\n" },
};
const sha = (text) => createHash("sha1").update(text).digest("hex");

// ---------------------------------------------------------------- the counting fake: the global fetch

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
const text = (body) => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function headerOf(init, name) {
  const given = init?.headers ?? {};
  const found = Object.entries(given instanceof Headers ? Object.fromEntries(given.entries()) : given).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found ? String(found[1]) : null;
}
// GitHub's API as the host reads it: the repository, its default branch's commit, the commit's whole tree, the trees of named folders and the entries of the folders of
// named files (recorded as `folders`, its query the folder asked for, `<folder>/` for its entries), a file, and the GraphQL answer of the batch query of the host —
// `f<i>:object(expression:"<commit>:<path>")` the text of a blob. Every repository is private, so a request without its own token is answered 404. Each answered request is
// recorded as { repository, kind, query }.
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
  if (!files || authorization !== `Bearer ${TOKENS[name]}`) return json(404, { message: "Not Found" });
  if (rest === "") { record(name, "repository"); return json(200, { default_branch: "main", visibility: "private", private: true }); }
  if (rest === "/commits/main") { record(name, "commit"); return json(200, { sha: sha(`${name}@main`) }); }
  const tree = treeRequest(url);
  if (tree && (tree.path || !tree.recursive)) { record(name, "folders", tree.recursive ? tree.path : `${tree.path}/`); return treeAnswer(files, tree, (each) => sha(files[each])); }
  if (rest.startsWith("/git/trees/")) { record(name, "tree"); return json(200, { tree: Object.entries(files).map(([file, content]) => ({ type: "blob", path: file, sha: sha(content) })) }); }
  const file = /^\/contents\/(.+)$/.exec(rest);
  if (file) { record(name, `file ${file[1]}`); if (files[file[1]] !== undefined) return text(files[file[1]]); }
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
  const store = openStore("acme/agent-m");
  writeSetting(store, "products", [LIBRARY, ATLAS, BARE]);
  writeSetting(store, "github-token", { value: TOKENS["acme/agent-m"], name: "instance token", expires: "2027-01-01" });
  for (const name of ["library", "atlas", "bare"]) writeSetting(store, `github-token:acme/${name}`, { value: TOKENS[`acme/${name}`], name: `${name} token`, expires: "2027-01-01" });
  return { page: "review", instance: { repository: "acme/agent-m", host: connect(parseAddress(INSTANCE), { token: TOKENS["acme/agent-m"] }) }, product: null, store, go() {} };
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

// TST-1278001 · level: component · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: this browser manages acme/library and acme/atlas, each of which holds docs/process.md beside a README, a source file and, for acme/library, a use case, and acme/bare, which holds none; a counting fake of GitHub that answers the commit, the whole tree, a file and both batch queries and records every request
// input: the route `models` drawn
// expect: to each of acme/library and acme/atlas the route sends exactly the repository's information with, beside it, the GraphQL request of greenToMerge (ITM-1170), its commit, one read of the entries of docs/, the folder of docs/process.md, and one read of docs/process.md — no other request, so no whole tree; known positive: the same fake records a git/trees request when the whole tree is read
test("TST-1278001 a product that declares a model is read by its commit, one folders request and its docs/process.md alone", async () => {
  const probe = connect(parseAddress(LIBRARY), { token: TOKENS["acme/library"] });
  install();
  await probe.readSnapshot("main");
  assert.deepEqual(spy.requests.map((request) => request.kind), ["commit", "tree"], "known positive: a read of the whole tree is recorded as a git/trees request");

  await draw();
  for (const name of ["acme/library", "acme/atlas"]) {
    assert.deepEqual(requestsTo(name).map((request) => request.kind).sort(), ["commit", "file docs/process.md", "folders", "graphql", "repository"].sort(), name);
    const folders = requestsTo(name).filter((request) => request.kind === "folders");
    assert.equal(folders.length, 1, `${name}: one folders request`);
    assert.equal(folders[0].query, "docs/", `${name}: the folders request lists the folder of docs/process.md`);
    assert.equal(requestsTo(name).filter((request) => request.kind === "tree").length, 0, `${name}: no git/trees`);
  }
});

// TST-1278002 · level: component · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: the same page and fake
// input: the route `models` drawn
// expect: scrum lists https://github.com/acme/library; scrum-wip lists https://github.com/acme/atlas; every other model lists no product — which product declares which model, as TST-778002 states it
test("TST-1278002 each model lists the products whose declaration names it, as before", async () => {
  const target = await draw();
  assert.deepEqual(productsOf(modelOf(target, "scrum")), [LIBRARY]);
  assert.deepEqual(productsOf(modelOf(target, "scrum-wip")), [ATLAS]);
  for (const name of ["waterfall", "v-model", "reuse-oriented", "kanban"]) assert.deepEqual(productsOf(modelOf(target, name)), [], name);
});

// TST-1278003 · level: component · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; UC-031
// given: the same page and fake, in which acme/bare holds no docs/process.md
// input: the route `models` drawn
// expect: counter-proof of TST-1278002: acme/bare is listed under no model and is not an unreadable product; to acme/bare the route sends the repository's information with the GraphQL request of greenToMerge beside it (ITM-1170), its commit and one folders request, and no read of docs/process.md and no git/trees
test("TST-1278003 a product without a declaration is shown without a model and no file is read for it", async () => {
  const target = await draw();
  for (const name of ["scrum", "scrum-wip", "waterfall", "v-model", "reuse-oriented", "kanban"]) assert.ok(!productsOf(modelOf(target, name)).includes(BARE), name);
  assert.deepEqual(byClass(target, "source"), [], "acme/bare is no unreadable product");
  assert.deepEqual(requestsTo("acme/bare").map((request) => request.kind).sort(), ["commit", "folders", "graphql", "repository"].sort());
});
