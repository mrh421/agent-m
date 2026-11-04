// MOD-implementation-pages' route `models` — the instance's process models are listed (ITM-778), as UC-031 step 1 and 2b and
// docs/architecture/MOD-implementation-pages.md (Interfaces: `models`, `models/<name>`) state them: "the instance's process models: the catalogue, *Adapt* and
// *+ New model*"; UC-031: "Agent M lists the shipped catalogue (waterfall, V-model, reuse-oriented, Scrum, Kanban) and the instance's own definitions. For each model it shows
// the kind of work and the products that use it", "Shipped models cannot be edited in an instance. Agent M offers **Adapt** instead and explains that the shipped catalogue
// follows the book", and "Every part carries a folded **What is this?**". The item settles which products: each address of `readSetting(store, "products")` is connected with
// MOD-site-frame's `chosenProduct` and its declaration `docs/process.md` read with that product's host; an address that cannot be connected is shown with its reason.
// Run: node --test tests/implementation-pages-models.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE CATALOGUE IS DATA; EVERY STEP EXPLAINS ITSELF; UC-031; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; A PLAN COVERS THE WHOLE SPECIFICATION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; DIAGRAMS ARE MERMAID IN MARKDOWN; ONE CLICK PER DECISION
// Level: unit
//
// ITM-779 adds the route `models/<name>`, the editor, as MOD-implementation-pages.md (Interfaces: `models`, `models/<name>`) states it: "*Adapt* and *+ New model* with a form from the model's
// schema, the live diagram, the errors beside their fields, the preview of every accepted requirement in every phase, *Save* only without errors, with `saveFile`". Its cases (TST-779001 on) give
// the route the instance's host as a recorder over the instance's files — the shipped models read from this repository, as a fork of Agent M holds them — whose commitFiles records each commit and
// moves the head; the products are read as above, through the fetch spy. Readings the item leaves open, which the pull request names:
//   - The editor is an <article class="model-editor">. The form is MOD-site-frame's schemaForm: a <div class="field" data-key="<key>"> with an <input> for each key of the front matter, and a
//     <div class="field" data-section="<heading>"> with a <textarea> for each section, each with a <ul class="findings">; its one button is Save.
//   - *Adapt* names the copy `<name>-adapted`, or `<name>-adapted-<n>` from 2 on where that name is taken.
//   - The diagram is the <div class="model-diagram">, drawn with renderMermaid; the preview is the <section class="plan-preview">, hidden for a pulled model, with one button
//     data-preview-product="<address>" for each product of this browser, and its <p class="plan-count"> and one <li class="plan-phase" data-phase="<phase>"> for each phase.
//   - *+ New model* first shows two buttons data-kind="planned" and data-kind="pulled", and no form.
//   - The outcome of Save is shown in the <div class="save-notice">; on a refusal it holds a <p class="save-refused"> and MOD-markdown-render's difference.
//   - *Discard* is a link to "#models"; the draft is kept on the screen only (UC-031 4a).
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged, as the other tests of the views do. The real MOD-model-catalogue, MOD-product-process,
// MOD-browser-store, MOD-repository-hosts and MOD-site-frame run as they are; the only thing that is faked is the global `fetch`, a spy that answers the fixtures' GitHub
// repositories and refuses any other address with a TypeError (the request is then kept as `unrouted`). No request leaves the fixtures.
//
// Readings the module file leaves open, which the pull request names:
//   - The page is an <article class="models-page">. Its parts are <section class="shipped-models"> and <section class="own-models">; each model is an <li class="model"> with
//     data-model="<name>" inside one of them, holding a <span class="kind"> with the kind of work as the catalogue names it ("planned" or "pulled"), a <ul class="products"> with one
//     <li> for each address of this browser's products that declares it (none when no product does), a <ul class="findings"> with one <li> for each finding of the catalogue, "<kind>: <what>"
//     (present only when the model has one), and <a> elements for its buttons.
//   - *Adapt*, *Edit* and *+ New model* are links (<a>) with that text. Adapt and Edit lead to "#models/name=<name>" (the name percent-encoded; the frame reads only key=value parts after the route's name); *+ New model*
//     leads to "#models/name=" and is the one link with the class new-model, in the section of the instance's own models.
//   - A product that cannot be connected or read is an <li class="source"> of a <ul class="unreadable">, "<address>: <the reason its host gives>".
//   - A product declares a model when its docs/process.md names the model's file in model_file, as the route `process` reads the declaration.
//   - The folded What is this? is the <details class="explain"> that explain(topic) returns.

import { treeRequest, treeAnswer } from "./github-trees-fake.mjs";
import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { routeOf } from "../src/site-frame/routing.mjs";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "models");

// ---------------------------------------------------------------- the fixtures: an instance with two models of its own, and four products

const OWN = readFileSync(new URL("../docs/process-models/scrum-wip.md", import.meta.url), "utf8");
// A model of the instance that breaks a rule: its last transition leads to a phase the model does not define.
const BROKEN = OWN.replace("name: scrum-wip", "name: broken-wip").replace("| Retrospective | Sprint planning | sequence |", "| Retrospective | Nowhere | sequence |");
assert.notEqual(BROKEN, OWN, "known positive: the fault was planted in the copy");

const declaring = (name, file) => `---\nmodel: ${name}\nmodel_file: ${file}\nmodel_version: ${"a".repeat(40)}\n---\n\n# How this product is developed\n`;

// The SPEC of acme/library: two requirements, the accepted requirements of the plan's preview.
const LIBRARY_SPEC = "# Library — Specification\n\n## 1. Loans\n\n**A LOAN HAS A DUE DATE** *(PO A. Maier)*\nEvery loan names the day it is due.\n*Check:* `tests/loans.test.mjs`\n\n"
  + "**A LATE LOAN IS NAMED** *(PO A. Maier)*\nA loan past its due date is shown as late.\n*Check:* `tests/loans.test.mjs`\n";

const INSTANCE = "https://github.com/acme/agent-m", LIBRARY = "https://github.com/acme/library", ATLAS = "https://github.com/acme/atlas",
  BARE = "https://github.com/acme/bare", MISSING = "https://github.com/acme/missing";
const TOKENS = { "acme/agent-m": "github_pat_INSTANCEfixture0123456789", "acme/library": "github_pat_LIBRARYfixture0123456789",
  "acme/atlas": "github_pat_ATLASfixture0123456789", "acme/bare": "github_pat_BAREfixture0123456789" };
const REPOSITORIES = {
  "acme/agent-m": { "docs/process-models/scrum-wip.md": OWN, "docs/process-models/broken-wip.md": BROKEN, "README.md": "# Agent M\n" },
  "acme/library": { "docs/process.md": declaring("scrum", "src/model-catalogue/models/scrum.md"), "SPEC.md": LIBRARY_SPEC },
  "acme/atlas": { "docs/process.md": declaring("scrum-wip", "docs/process-models/scrum-wip.md") },
  "acme/bare": { "README.md": "# A product that declares no model yet\n" },
};
const sha = (text) => createHash("sha1").update(text).digest("hex");

// ---------------------------------------------------------------- the spy: the global fetch

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

const realFetch = globalThis.fetch;
const spy = { unrouted: [] };
const text = (body) => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function headerOf(init, name) {
  const given = init?.headers ?? {};
  const found = Object.entries(given instanceof Headers ? Object.fromEntries(given.entries()) : given).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found ? String(found[1]) : null;
}
// GitHub's API as the host reads it: the repository, its default branch's commit, the commit's tree, and a file; every repository is private, so a request without its own token
// is answered 404.
function github(url, authorization, body) {
  if (url.host === "api.github.com" && url.pathname === "/graphql") return graphql(authorization, JSON.parse(body));
  const api = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(decodeURIComponent(url.pathname));
  if (url.host !== "api.github.com" || !api) return null;
  const [, name, rest = ""] = api;
  const files = REPOSITORIES[name];
  if (!files || authorization !== `Bearer ${TOKENS[name]}`) return json(404, { message: "Not Found" });
  if (rest === "") return json(200, { default_branch: "main", visibility: "private", private: true });
  if (rest === "/commits/main") return json(200, { sha: sha(`${name}@main`) });
  // What a product's facts read beside its files (MOD-progress-measures' productFacts): it has no pull request, tag, CI run or history.
  if (rest === "/pulls" || rest === "/tags" || rest === "/commits") return json(200, []);
  if (rest === "/actions/runs") return json(200, { total_count: 0, workflow_runs: [] });
  const tree = treeRequest(url);
  if (tree && (tree.path || !tree.recursive)) return treeAnswer(files, tree, (file) => sha(files[file]));
  if (rest.startsWith("/git/trees/")) return json(200, { tree: Object.entries(files).map(([file, body]) => ({ type: "blob", path: file, sha: sha(body) })) });
  const file = /^\/contents\/(.+)$/.exec(rest);
  if (file && files[file[1]] !== undefined) return text(files[file[1]]);
  return json(404, { message: "Not Found" });
}
// The batch reads of MOD-repository-hosts: one aliased field `f<i>:object(expression:"<commit>:<path>")` for each path, answered with the text of the file in the repository the variables name;
function graphql(authorization, { query, variables }) {
  const name = `${variables.owner}/${variables.name}`;
  if (!REPOSITORIES[name] || authorization !== `Bearer ${TOKENS[name]}`) return json(200, { data: { repository: null } });
  const repository = {};
  for (const [, alias, expression] of query.matchAll(/(f\d+):object\(expression:("[^"]*")\)/g)) {
    const body = REPOSITORIES[name][JSON.parse(expression).split(":").slice(1).join(":")];
    repository[alias] = body === undefined ? null : { text: body, isTruncated: false };
  }
  return json(200, { data: { repository } });
}
function install() {
  spy.unrouted = [];
  spy.requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    spy.requests.push(url.href);
    const served = github(url, headerOf(init, "authorization"), init?.body);
    if (served) return served;
    spy.unrouted.push(url.href);
    throw new TypeError(`no request leaves the fixtures: ${url.href}`);
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the page

// The browser: the store of acme/agent-m, with the instance's token and a token for each product but the missing one, and the products it manages.
function browser({ products = [LIBRARY, ATLAS, BARE, MISSING] } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("acme/agent-m");
  writeSetting(store, "products", products);
  writeSetting(store, "github-token", { value: TOKENS["acme/agent-m"], name: "instance token", expires: "2027-01-01" });
  for (const name of ["library", "atlas", "bare"]) writeSetting(store, `github-token:acme/${name}`, { value: TOKENS[`acme/${name}`], name: `${name} token`, expires: "2027-01-01" });
  return { page: "review", instance: { repository: "acme/agent-m", host: connect(parseAddress(INSTANCE), { token: TOKENS["acme/agent-m"] }) }, product: null, store, go() {} };
}
async function draw(context = browser()) {
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
const modelsIn = (section) => byClass(section, "model");
const modelOf = (target, name) => find(target, (node) => node.getAttribute("data-model") === name)[0];
const linesOf = (list) => find(list, (node) => node.localName === "li").map((item) => item.textContent);
const productsOf = (model) => linesOf(byClass(model, "products")[0]);
const linksOf = (root) => find(root, (node) => node.localName === "a");
// The requests the spy recorded for a repository, in order of address.
const readsOf = (name) => spy.requests.filter((href) => href.includes(name)).sort();

const SHIPPED = ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"];
const NO_TOKEN = "was not found — a private repository is found only with a token that reaches it.";

// TST-778001 · level: unit · module: MOD-implementation-pages
// guards: THE CATALOGUE IS DATA; UC-031
// given: the instance acme/agent-m, which holds the models scrum-wip (pulled) and broken-wip (pulled) under docs/process-models/, and the catalogue's five shipped models
// input: the route `models` drawn
// expect: the section of the shipped models holds waterfall (planned), v-model (planned), reuse-oriented (planned), scrum (pulled) and kanban (pulled), in the catalogue's order; the section of the instance's own models holds broken-wip (pulled) and scrum-wip (pulled), in the order of their paths; each model's kind is the text of its kind element
test("TST-778001 the shipped catalogue and the instance's own models are listed, each with its kind of work", async () => {
  const target = await draw();
  const kindOf = (model) => [model.getAttribute("data-model"), byClass(model, "kind")[0].textContent];
  assert.equal(byClass(target, "shipped-models").length, 1, "known positive: the section of the shipped models is found");
  assert.deepEqual(modelsIn(byClass(target, "shipped-models")[0]).map(kindOf),
    [["waterfall", "planned"], ["v-model", "planned"], ["reuse-oriented", "planned"], ["scrum", "pulled"], ["kanban", "pulled"]]);
  assert.deepEqual(modelsIn(byClass(target, "own-models")[0]).map(kindOf), [["broken-wip", "pulled"], ["scrum-wip", "pulled"]]);
});

// TST-778002 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: this browser manages acme/library, whose docs/process.md names the shipped scrum, acme/atlas, whose names the instance's scrum-wip, and acme/bare, which has no docs/process.md
// input: the route `models` drawn
// expect: scrum lists https://github.com/acme/library; scrum-wip lists https://github.com/acme/atlas; every other model lists no product; acme/bare is listed under no model
test("TST-778002 each model lists the products of this browser whose declaration names it", async () => {
  const target = await draw();
  assert.deepEqual(productsOf(modelOf(target, "scrum")), [LIBRARY]);
  assert.deepEqual(productsOf(modelOf(target, "scrum-wip")), [ATLAS]);
  for (const name of ["waterfall", "v-model", "reuse-oriented", "kanban", "broken-wip"]) assert.deepEqual(productsOf(modelOf(target, name)), [], name);
  assert.equal(find(target, (node) => node.textContent === BARE && node.localName === "li").length, 0, "acme/bare declares no model");
});

// TST-778003 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the same page
// input: the route `models` drawn
// expect: every shipped model's links are exactly ["Adapt"], leading to "#models/name=<name>"; every model of the instance's own has exactly ["Edit"], leading to "#models/name=<name>"; the page has one link "+ New model"
test("TST-778003 a shipped model offers Adapt only, an instance's model Edit, and the page + New model", async () => {
  const target = await draw();
  for (const name of SHIPPED) {
    assert.deepEqual(linksOf(modelOf(target, name)).map((link) => [link.textContent, link.getAttribute("href")]), [["Adapt", `#models/name=${name}`]], name);
  }
  for (const name of ["scrum-wip", "broken-wip"]) {
    assert.deepEqual(linksOf(modelOf(target, name)).map((link) => [link.textContent, link.getAttribute("href")]), [["Edit", `#models/name=${name}`]], name);
  }
  assert.deepEqual(byClass(target, "new-model").map((link) => link.textContent), ["+ New model"]);
});

// TST-778004 · level: unit · module: MOD-implementation-pages
// guards: UC-031; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: this browser manages acme/missing, which no token reaches (a private repository answers 404), beside the products acme/library and acme/atlas it can read
// input: the route `models` drawn
// expect: the unreadable list holds exactly "https://github.com/acme/missing: <the host's reason>" — the product's address, a colon, and the not-found text of its host —; scrum still lists acme/library and scrum-wip still lists acme/atlas
test("TST-778004 a product that cannot be connected is shown with its reason and the others are still listed", async () => {
  const target = await draw();
  assert.deepEqual(byClass(target, "source").map((item) => item.textContent), [`${MISSING}: ${MISSING} ${NO_TOKEN}`]);
  assert.deepEqual(productsOf(modelOf(target, "scrum")), [LIBRARY]);
  assert.deepEqual(productsOf(modelOf(target, "scrum-wip")), [ATLAS]);
});

// TST-778005 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the instance's broken-wip, whose last transition leads to a phase "Nowhere" that it does not define, and its valid scrum-wip
// input: the route `models` drawn
// expect: broken-wip has a findings list with at least one entry, and each entry names "Nowhere"; scrum-wip and every shipped model have no findings list
test("TST-778005 the findings of a model of the instance are listed with it", async () => {
  const target = await draw();
  const broken = byClass(modelOf(target, "broken-wip"), "findings");
  assert.equal(broken.length, 1, "known positive: broken-wip has a findings list");
  const lines = linesOf(broken[0]);
  assert.ok(lines.length >= 1);
  for (const line of lines) assert.match(line, /Nowhere/);
  for (const name of [...SHIPPED, "scrum-wip"]) assert.deepEqual(byClass(modelOf(target, name), "findings"), [], name);
});

// TST-778006 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-031
// given: the page drawn, and src/site-frame/explanations.md
// input: the folded explanations of the page: one in each of the two sections, and in each model one beside its kind and one beside its products, and one beside the findings of broken-wip
// expect: each is a <details class="explain"> without the open attribute, holding <summary>What is this?</summary> and a body of text; the page holds exactly 2 + 2 × 7 + 1 of them
test("TST-778006 every part of the page carries a folded What is this?", async () => {
  const target = await draw();
  const explains = (root) => byClass(root, "explain");
  assert.equal(explains(target).length, 2 + 2 * 7 + 1);
  assert.equal(explains(byClass(target, "shipped-models")[0]).length, 1 + 2 * 5);
  assert.equal(explains(byClass(target, "own-models")[0]).length, 1 + 2 * 2 + 1);
  for (const folded of explains(target)) {
    assert.equal(folded.localName, "details");
    assert.equal(folded.hasAttribute("open"), false);
    const [summary, body] = folded.children;
    assert.equal(summary.textContent, "What is this?");
    assert.ok(body.textContent.trim().length > 40, "the body is a text, not an empty fold");
  }
});

// TST-778007 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the page drawn, and the frame's routing (MOD-site-frame routeOf), which reads a fragment as a route name and its parameters
// input: the href of every button of the page, read by routeOf
// expect: Adapt of v-model gives route "models" with name "v-model"; Edit of scrum-wip gives "models" with name "scrum-wip"; every shipped and own model's button gives its own name; + New model gives "models" with the empty name ""; known positive: routeOf("#models/name=v-model") gives { name: "models", params: { name: "v-model" } }
test("TST-778007 each button's address, read by the frame's routing, carries its model's name", async () => {
  assert.deepEqual(routeOf("#models/name=v-model"), { name: "models", params: { name: "v-model" } });
  const target = await draw();
  for (const name of [...SHIPPED, "scrum-wip", "broken-wip"]) {
    assert.deepEqual(routeOf(linksOf(modelOf(target, name))[0].getAttribute("href")), { name: "models", params: { name } }, name);
  }
  assert.deepEqual(routeOf(byClass(target, "new-model")[0].getAttribute("href")), { name: "models", params: { name: "" } });
});

// ---------------------------------------------------------------- ITM-779: the editor, the route `models/<name>`

const { catalogue } = await import("../src/model-catalogue/index.mjs");

// The instance's files: the shipped models as this repository holds them, which a fork of Agent M holds too, and the instance's own scrum-wip.
const SHIPPED_FILES = Object.fromEntries(SHIPPED.map((name) => [`src/model-catalogue/models/${name}.md`,
  readFileSync(new URL(`../src/model-catalogue/models/${name}.md`, import.meta.url), "utf8")]));
const INSTANCE_FILES = { ...SHIPPED_FILES, "docs/process-models/scrum-wip.md": OWN, "README.md": "# Agent M\n" };
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");

// The instance's host as a recorder: a snapshot of its files as they stand at each read, and commitFiles, which records the commit and writes its files.
function instanceHost(files = INSTANCE_FILES) {
  const state = { files: { ...files }, commits: [] };
  const snapshotOf = (held) => ({ repository: parseAddress(INSTANCE), ref: "main", commit: sha(JSON.stringify(Object.entries(held).sort())), paths: Object.keys(held),
    read: async (path) => held[path] ?? null, readMany: async () => {}, blob: (path) => (held[path] === undefined ? null : gitBlob(held[path])) });
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshotOf({ ...state.files }); },
    async commitFiles(commit) { state.commits.push(commit); for (const file of commit.files) state.files[file.path] = file.text; return { commit: "c".repeat(40) }; },
  };
  return { state, host, snapshotOf };
}

// Mermaid as a recorder: the text of every diagram the page hands it.
function mermaidRecorder() {
  const drawn = [];
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { drawn.push(...nodes.map((node) => node.textContent)); } };
  return drawn;
}
test.afterEach(() => { delete globalThis.mermaid; });

const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

// The route `models` drawn with the parameter name=`name`, over the recorded instance; each click listener of the page is kept, so that a case can give the person's click (isTrusted).
async function edit(name, files) {
  install();
  const drawn = mermaidRecorder();
  const { state, host, snapshotOf } = instanceHost(files);
  const context = { ...browser(), instance: { repository: "acme/agent-m", host } };
  const listeners = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") listeners.push([this, listener]); return add.call(this, type, listener, ...rest); };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, context, { name });
    await settle();
  } finally { Element.prototype.addEventListener = add; }
  const click = async (button, isTrusted = true) => { for (const [element, listener] of listeners) if (element === button) await listener({ isTrusted }); await settle(); };
  return { target, state, drawn, snapshotOf, click };
}

const fieldOf = (target, key) => find(target, (node) => node.getAttribute("data-key") === key)[0];
const valueOf = (target, key) => fieldOf(target, key).getElementsByTagName("input")[0].value;
const sectionOf = (target, heading) => find(target, (node) => node.getAttribute("data-section") === heading)[0];
const marksOf = (target, heading) => byClass(sectionOf(target, heading), "marks")[0].textContent;
// The form's own Save: the last button "Save" of the form, after the sections, each of whose editors has a Save of its own (MOD-site-frame's schemaForm).
const saveOf = (target) => find(byClass(target, "schema-form")[0], (node) => node.localName === "button" && node.textContent === "Save").at(-1);
async function typeSection(target, heading, text) {
  const area = sectionOf(target, heading).getElementsByTagName("textarea")[0];
  area.value = text;
  area.dispatchEvent(new Event("input"));
  await settle();
}
const areaOf = (target, heading) => sectionOf(target, heading).getElementsByTagName("textarea")[0].value;
const ADAPTED = "docs/process-models/v-model-adapted.md";

// TST-779001 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the instance's catalogue, whose shipped v-model is a planned model of 7 phases, and no model named v-model-adapted
// input: the route `models` drawn with name=v-model, as Adapt of v-model leads to it
// expect: an <article class="model-editor"> headed "Adapt v-model" holds the form, no list of models; the form's name is "v-model-adapted", adapted_from "v-model", kind "planned", measure "plan entries per phase"; its Phases section holds the v-model's 7 phase rows; a link "Discard" leads to "#models"
test("TST-779001 Adapt opens a copy of the model under a new name that names the model it was adapted from", async () => {
  const { target } = await edit("v-model");
  const page = byClass(target, "model-editor");
  assert.equal(page.length, 1, "the editor is drawn");
  assert.equal(byClass(target, "models-page").length, 0, "not the list");
  assert.equal(find(page[0], (node) => node.localName === "h2")[0].textContent, "Adapt v-model");
  assert.deepEqual(["name", "adapted_from", "kind", "measure"].map((key) => valueOf(target, key)), ["v-model-adapted", "v-model", "planned", "plan entries per phase"]);
  for (const phase of ["Concept", "Requirements", "Design", "Implementation", "Testing", "Validation & Verification", "Operation & Maintenance"]) {
    assert.match(areaOf(target, "## Phases"), new RegExp(`^\\| ${phase.replace("&", "\\&")} \\|`, "m"), phase);
  }
  assert.deepEqual(byClass(target, "discard").map((link) => [link.textContent, link.getAttribute("href")]), [["Discard", "#models"]]);
});

// TST-779002 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the instance already holds docs/process-models/v-model-adapted.md, whose model is named v-model-adapted
// input: the route `models` drawn with name=v-model
// expect: the copy's name is "v-model-adapted-2", the first name of the form <name>-adapted-<n> that is not taken; known positive: without that file it is "v-model-adapted" (TST-779001)
test("TST-779002 Adapt takes the next free name when the first is taken", async () => {
  const taken = OWN.replace("name: scrum-wip", "name: v-model-adapted");
  const { target } = await edit("v-model", { ...INSTANCE_FILES, [ADAPTED]: taken });
  assert.equal(valueOf(target, "name"), "v-model-adapted-2");
});

// TST-779003 · level: unit · module: MOD-implementation-pages
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN; UC-031
// given: the editor on the adapted v-model, with Mermaid recording each diagram handed to it
// input: the author adds the gate "Implementation → Testing | the threat model ARC | a person accepted the threat model | Security reviewer" to Gates and the role "Security reviewer | either | one | read the repository" to Roles
// expect: the diagram drawn when the editor opens holds a node "Concept" and a gate decided by "Reviewer", and none by "Security reviewer"; after the typing, the diagram drawn last holds a gate decided by "Security reviewer"; the <div class="model-diagram"> holds the drawn diagram
test("TST-779003 the diagram follows the definition while the author types", async () => {
  const { target, drawn } = await edit("v-model");
  assert.ok(drawn.length >= 1, "known positive: a diagram is drawn when the editor opens");
  assert.match(drawn.at(-1), /\["Concept"\]/);
  assert.match(drawn.at(-1), /Decider: Reviewer/);
  assert.doesNotMatch(drawn.at(-1), /Security reviewer/);
  await typeSection(target, "## Gates", `${areaOf(target, "## Gates").trimEnd()}\n| Implementation → Testing | the threat model ARC | a person accepted the threat model | Security reviewer |\n`);
  await typeSection(target, "## Roles", `${areaOf(target, "## Roles").trimEnd()}\n| Security reviewer | either | one | read the repository |\n`);
  assert.match(drawn.at(-1), /Decider: Security reviewer/);
  assert.equal(byClass(target, "model-diagram")[0].getElementsByTagName("pre").length + byClass(target, "model-diagram")[0].childNodes.length > 0, true, "the diagram stands in its place");
});

// TST-779004 · level: unit · module: MOD-implementation-pages
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; UC-031
// given: the editor on the adapted v-model, which has no error finding
// input: the author changes the last transition to lead to "Nowhere", a phase the model does not define; then changes it back
// expect: before the change Save is enabled and the marks of Transitions name no "Nowhere"; after it the marks of Transitions name "Nowhere" and Save is disabled; changed back, Save is enabled again
test("TST-779004 a finding stands beside its field while the author types, and Save is unavailable while it is an error", async () => {
  const { target } = await edit("v-model");
  const opened = areaOf(target, "## Transitions");
  assert.equal(saveOf(target).disabled, false, "known positive: the copy as opened can be saved");
  assert.doesNotMatch(marksOf(target, "## Transitions"), /Nowhere/);
  await typeSection(target, "## Transitions", opened.replace("| Validation & Verification | Operation & Maintenance | sequence |", "| Validation & Verification | Nowhere | sequence |"));
  assert.match(marksOf(target, "## Transitions"), /Nowhere/);
  assert.equal(saveOf(target).disabled, true);
  await typeSection(target, "## Transitions", opened);
  assert.equal(saveOf(target).disabled, false);
});

// TST-779005 · level: unit · module: MOD-implementation-pages
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; UC-031
// given: the editor on the adapted v-model with the gate and role of TST-779003 added
// input: a click on Save that is not the person's (isTrusted false), then the person's click
// expect: the first click commits nothing; the person's click commits once, on the branch main, exactly the file docs/process-models/v-model-adapted.md; the catalogue reads the committed file back as the model v-model-adapted, adapted from v-model, with the gate decided by Security reviewer and no finding; the notice says "Saved as docs/process-models/v-model-adapted.md."
test("TST-779005 Save writes the model under docs/process-models/ in one commit, and the catalogue reads it back without findings", async () => {
  const { target, state, snapshotOf, click } = await edit("v-model");
  await typeSection(target, "## Gates", `${areaOf(target, "## Gates").trimEnd()}\n| Implementation → Testing | the threat model ARC | a person accepted the threat model | Security reviewer |\n`);
  await typeSection(target, "## Roles", `${areaOf(target, "## Roles").trimEnd()}\n| Security reviewer | either | one | read the repository |\n`);
  await click(saveOf(target), false);
  assert.equal(state.commits.length, 0, "a click that is not the person's writes nothing");
  await click(saveOf(target));
  assert.equal(state.commits.length, 1);
  assert.equal(state.commits[0].branch, "main");
  assert.deepEqual(state.commits[0].files.map((file) => file.path), [ADAPTED]);
  const read = await catalogue(snapshotOf(state.files));
  const saved = read.models.find((model) => model.path === ADAPTED);
  assert.equal(saved.name, "v-model-adapted");
  assert.equal(saved.adaptedFrom, "v-model");
  assert.ok(saved.gates.some((gate) => gate.from === "Implementation" && gate.to === "Testing" && gate.decider === "Security reviewer"));
  assert.deepEqual(read.findings[ADAPTED], []);
  assert.match(byClass(target, "save-notice")[0].textContent, /Saved as docs\/process-models\/v-model-adapted\.md\./);
});

// TST-779006 · level: unit · module: MOD-implementation-pages
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; UC-031
// given: the editor on the adapted v-model, with the last transition leading to "Nowhere"
// input: the person's click on Save
// expect: nothing is committed
test("TST-779006 an invalid definition is never saved", async () => {
  const { target, state, click } = await edit("v-model");
  await typeSection(target, "## Transitions", areaOf(target, "## Transitions").replace("| Validation & Verification | Operation & Maintenance | sequence |", "| Validation & Verification | Nowhere | sequence |"));
  await click(saveOf(target));
  assert.equal(state.commits.length, 0);
});

// TST-779007 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the editor on the adapted v-model; after it opened, someone else commits docs/process-models/v-model-adapted.md with the text "# Someone else's model"
// input: the person's click on Save
// expect: nothing is committed; the notice holds a <p class="save-refused"> naming docs/process-models/v-model-adapted.md and a difference (class diff) that holds "# Someone else's model" and the author's "name: v-model-adapted"; the form still holds the author's name v-model-adapted
test("TST-779007 a file changed since the editor opened it is not written, and both versions are shown", async () => {
  const { target, state, click } = await edit("v-model");
  state.files[ADAPTED] = "# Someone else's model\n";
  await click(saveOf(target));
  assert.equal(state.commits.length, 0);
  const notice = byClass(target, "save-notice")[0];
  assert.match(byClass(notice, "save-refused")[0].textContent, /docs\/process-models\/v-model-adapted\.md/);
  const difference = byClass(notice, "diff")[0].textContent;
  assert.match(difference, /# Someone else's model/);
  assert.match(difference, /name: v-model-adapted/);
  assert.equal(valueOf(target, "name"), "v-model-adapted");
});

// TST-779008 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the instance's own model scrum-wip
// input: the route `models` drawn with name=scrum-wip, as Edit leads to it; then the person's click on Save without a change
// expect: the editor is headed "Edit scrum-wip", its name is "scrum-wip"; Save commits docs/process-models/scrum-wip.md, the file it was opened on, once
test("TST-779008 Edit opens an instance's own model, and Save writes it in place", async () => {
  const { target, state, click } = await edit("scrum-wip");
  assert.equal(find(byClass(target, "model-editor")[0], (node) => node.localName === "h2")[0].textContent, "Edit scrum-wip");
  assert.equal(valueOf(target, "name"), "scrum-wip");
  await click(saveOf(target));
  assert.deepEqual(state.commits.map((commit) => commit.files.map((file) => file.path)), [["docs/process-models/scrum-wip.md"]]);
});

// TST-779009 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the route `models` with the empty name, as + New model leads to it
// input: the page drawn; then a click on the kind planned, and, drawn again, a click on the kind pulled
// expect: first two buttons, data-kind "planned" and "pulled", and no form; after planned, a form whose kind is "planned" and measure "plan entries per phase", its name empty and Save disabled; after pulled, a form whose kind is "pulled" and whose Flow control holds the rows WIP limit, Time box and Sprints
test("TST-779009 + New model first asks for the kind of work, and the form follows it", async () => {
  const planned = await edit("");
  assert.deepEqual(find(planned.target, (node) => node.hasAttribute?.("data-kind")).map((button) => button.getAttribute("data-kind")), ["planned", "pulled"]);
  assert.equal(byClass(planned.target, "schema-form").length, 0, "no form before the kind is picked");
  await planned.click(find(planned.target, (node) => node.getAttribute("data-kind") === "planned")[0], false);
  assert.deepEqual([valueOf(planned.target, "kind"), valueOf(planned.target, "measure"), valueOf(planned.target, "name")], ["planned", "plan entries per phase", ""]);
  assert.equal(saveOf(planned.target).disabled, true);
  const pulled = await edit("");
  await pulled.click(find(pulled.target, (node) => node.getAttribute("data-kind") === "pulled")[0], false);
  assert.equal(valueOf(pulled.target, "kind"), "pulled");
  for (const row of ["WIP limit", "Time box", "Sprints"]) assert.match(areaOf(pulled.target, "## Flow control"), new RegExp(`^\\| ${row} \\|`, "m"), row);
});

// TST-779010 · level: unit · module: MOD-implementation-pages
// guards: A PLAN COVERS THE WHOLE SPECIFICATION; UC-031
// given: the editor on the adapted v-model (planned, 7 phases); this browser manages acme/library, whose SPEC holds the requirements A LOAN HAS A DUE DATE and A LATE LOAN IS NAMED
// input: before any pick, the requests sent; then a click on the preview's button for https://github.com/acme/library
// expect: before the pick, the requests that reach acme/library are those the list of the models sends, which reads its declaration alone (TST-1371006), and none more; after it, more requests reach it, and the count reads "2 requirements × 7 phases = 14 plan entries", and each of the 7 phases lists exactly the two requirements
test("TST-779010 the preview shows every accepted requirement of the product picked once in every phase, with the count", async () => {
  await draw();
  const ofList = readsOf("acme/library");
  const { target, click } = await edit("v-model");
  assert.deepEqual(readsOf("acme/library"), ofList, "nothing of a product is read before it is picked beyond what the list reads");
  const preview = byClass(target, "plan-preview")[0];
  assert.equal(preview.hidden, false, "a planned model shows the preview");
  await click(find(preview, (node) => node.getAttribute("data-preview-product") === LIBRARY)[0], false);
  await settle(100);
  assert.ok(readsOf("acme/library").length > ofList.length, "known positive: the pick reads the product");
  assert.equal(byClass(preview, "plan-count")[0].textContent, "2 requirements × 7 phases = 14 plan entries");
  const phases = byClass(preview, "plan-phase");
  assert.equal(phases.length, 7);
  for (const phase of phases) assert.deepEqual(linesOf(find(phase, (node) => node.localName === "ul")[0]), ["A LOAN HAS A DUE DATE", "A LATE LOAN IS NAMED"], phase.getAttribute("data-phase"));
});

// TST-779011 · level: unit · module: MOD-implementation-pages
// guards: A PLAN COVERS THE WHOLE SPECIFICATION; UC-031
// given: the editor on the adapted v-model; this browser manages acme/bare, which has no SPEC and so no accepted requirement
// input: a click on the preview's button for https://github.com/acme/bare
// expect: the count reads "0 requirements × 7 phases = 0 plan entries", the preview says that acme/bare has no accepted requirements yet, and the 7 phases stand empty
test("TST-779011 a product without accepted requirements shows the plan's phases empty", async () => {
  const { target, click } = await edit("v-model");
  const preview = byClass(target, "plan-preview")[0];
  await click(find(preview, (node) => node.getAttribute("data-preview-product") === BARE)[0], false);
  await settle(100);
  assert.equal(byClass(preview, "plan-count")[0].textContent, "0 requirements × 7 phases = 0 plan entries");
  assert.match(byClass(preview, "preview-none")[0].textContent, /acme\/bare has no accepted requirements yet/);
  const phases = byClass(preview, "plan-phase");
  assert.equal(phases.length, 7);
  for (const phase of phases) assert.equal(find(phase, (node) => node.localName === "li").length, 0, phase.getAttribute("data-phase"));
});

// TST-779012 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the editor on the adapted scrum, a pulled model
// input: the page drawn
// expect: the preview of the plan is hidden; known positive: for the adapted v-model it is not (TST-779010)
test("TST-779012 a pulled model shows no plan preview", async () => {
  const { target } = await edit("scrum");
  assert.equal(valueOf(target, "kind"), "pulled");
  assert.equal(byClass(target, "plan-preview")[0].hidden, true);
});

// TST-779013 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-031
// given: the editor on the adapted v-model, and the page of + New model before the kind is picked
// input: the folded explanations of each part: the form, the diagram, the preview, and the choice of the kind
// expect: each of <section class="model-form">, <section class="model-picture">, <section class="plan-preview"> and <section class="kind-choice"> holds a <details class="explain"> without the open attribute, whose summary is "What is this?"
test("TST-779013 every part of the editor carries a folded What is this?", async () => {
  const adapted = (await edit("v-model")).target, fresh = (await edit("")).target;
  for (const [root, part] of [[adapted, "model-form"], [adapted, "model-picture"], [adapted, "plan-preview"], [fresh, "kind-choice"]]) {
    const folded = byClass(byClass(root, part)[0], "explain");
    assert.ok(folded.length >= 1, part);
    assert.equal(folded[0].localName, "details");
    assert.equal(folded[0].hasAttribute("open"), false, part);
    assert.equal(folded[0].children[0].textContent, "What is this?", part);
  }
});

// The number of times `needle` stands in `text`.
const timesIn = (text, needle) => text.split(needle).length - 1;

// TST-779014 · level: unit · module: MOD-implementation-pages
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; UC-031
// given: + New model with the kind planned picked, its name left out; and the adapted v-model, whose last gate the author types without a Condition and whose last transition leads to "Nowhere"
// input: the findings the form shows: the lists beside its fields and the marks of its sections
// expect: "the key name is required" stands exactly once among the lists of the new model's form; the marks of Gates hold "the column Condition is required" exactly once; the marks of Transitions hold "which is no phase of the model" exactly once — a finding of the schema and one beyond it, each shown once
test("TST-779014 each finding is shown once", async () => {
  const planned = await edit("");
  await planned.click(find(planned.target, (node) => node.getAttribute("data-kind") === "planned")[0], false);
  const lists = byClass(byClass(planned.target, "schema-form")[0], "findings").map((list) => list.textContent).join("\n");
  assert.equal(timesIn(lists, "the key name is required"), 1);
  const { target } = await edit("v-model");
  await typeSection(target, "## Gates", areaOf(target, "## Gates").replace("| the verification is documented before the release | Reviewer |", "|  | Reviewer |"));
  assert.equal(timesIn(marksOf(target, "## Gates"), "the column Condition is required"), 1);
  await typeSection(target, "## Transitions", areaOf(target, "## Transitions").replace("| Validation & Verification | Operation & Maintenance | sequence |", "| Validation & Verification | Nowhere | sequence |"));
  assert.equal(timesIn(marksOf(target, "## Transitions"), "which is no phase of the model"), 1);
});

// TST-779015 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE LOADS IN UNDER THREE SECONDS; UC-031
// given: docs/index.html, whose preloads the generator of MOD-site-frame writes from what each route loads
// input: the modules the entries "models" and "process" preload
// expect: neither names a module of MOD-progress-measures (src/progress-measures/), which only the preview of the plan needs, once a product is picked; known positive: the entry "progress" names src/progress-measures/index.mjs
test("TST-779015 the routes models and process load MOD-progress-measures only when the preview needs it", () => {
  const page = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
  const preloaded = (name) => JSON.parse(new RegExp(`^  "${name}": (\\{.*\\}),?$`, "m").exec(page)[1]).modules;
  assert.ok(preloaded("progress").includes("../src/progress-measures/index.mjs"), "known positive");
  for (const name of ["models", "process"]) assert.deepEqual(preloaded(name).filter((path) => path.includes("/progress-measures/")), [], name);
});

// ---------------------------------------------------------------- ITM-1354: the form of a planned model has no flow control
// UC-031 marks Flow control "(pulled only)", and 2a: "The author first picks the kind of work (*planned* or *pulled*), and Agent M adapts the form to it"; MOD-model-catalogue gives
// `## Flow control` "for `pulled` only". The reading the item takes, which the pull request names: the form follows the kind the definition is opened with — the kind picked in
// + New model, or the kind of the model adapted or edited.

// TST-1354001 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the route `models` with the empty name, as + New model leads to it
// input: a click on the kind pulled; then, drawn again, a click on the kind planned
// expect: after pulled, the form has the part <div data-section="## Flow control">, holding the rows WIP limit, Time box and Sprints (known positive); after planned, the form has its part "## Phases" and no part "## Flow control"
test("TST-1354001 + New model of the kind planned shows no Flow control, of the kind pulled shows it", async () => {
  const pulled = await edit("");
  await pulled.click(find(pulled.target, (node) => node.getAttribute("data-kind") === "pulled")[0], false);
  assert.equal(sectionOf(pulled.target, "## Flow control") !== undefined, true, "known positive: the pulled form holds Flow control");
  for (const row of ["WIP limit", "Time box", "Sprints"]) assert.match(areaOf(pulled.target, "## Flow control"), new RegExp(`^\\| ${row} \\|`, "m"), row);
  const planned = await edit("");
  await planned.click(find(planned.target, (node) => node.getAttribute("data-kind") === "planned")[0], false);
  assert.equal(sectionOf(planned.target, "## Phases") !== undefined, true, "known positive: the planned form holds its parts");
  assert.equal(sectionOf(planned.target, "## Flow control") === undefined, true, "a planned model's form has no Flow control");
});

// TST-1354002 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the instance's catalogue, whose shipped v-model is planned and whose shipped scrum is pulled with the Flow control row "| Time box | 1 week |"
// input: the route `models` drawn with name=scrum, as Adapt leads to it; then with name=v-model
// expect: the form of the adapted scrum (kind pulled) has the part "## Flow control", holding "| Time box | 1 week |" (known positive); the form of the adapted v-model (kind planned) has no part "## Flow control"
test("TST-1354002 Adapt of a planned model shows no Flow control, of a pulled model shows it", async () => {
  const scrum = await edit("scrum");
  assert.equal(valueOf(scrum.target, "kind"), "pulled");
  assert.match(areaOf(scrum.target, "## Flow control"), /^\| Time box \| 1 week \|/m, "known positive: the pulled form holds its flow control");
  const vModel = await edit("v-model");
  assert.equal(valueOf(vModel.target, "kind"), "planned");
  assert.equal(sectionOf(vModel.target, "## Flow control") === undefined, true, "a planned model's form has no Flow control");
});

// ---------------------------------------------------------------- ITM-1371: the editor names the products that declare the model
// UC-031 6a: "The adapted model is already used by products. Agent M lists them." MOD-implementation-pages (Interfaces: `models`, `models/<name>`): "Which products of this browser declare a
// model, it reads from each product's `docs/process.md` alone". Readings the item leaves open, which the pull request names:
//   - "The adapted model" is the model whose file the editor saves: the products listed are those whose declaration names the file the definition would be written to, which
//     is the file the editor opened for Edit and, for Adapt and + New model, the file of the name typed.
//   - The editor draws them in a <section class="model-products"> with a <ul class="products"> of one <li> for each address, and an address that cannot be read as the list shows it, in a
//     <ul class="unreadable"> of <li class="source"> "<address>: <reason>"; the notice after Save holds a <ul class="products"> with the products that declare the file saved.
const usersIn = (root) => { const list = byClass(root, "products")[0]; return list ? linesOf(list) : []; };
const usersOfEditor = (target) => usersIn(byClass(target, "model-products")[0]);

// TST-1371001 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: this browser manages acme/library, whose declaration names the shipped scrum, acme/atlas, whose declaration names the instance's scrum-wip, and acme/bare, which declares none
// input: the route `models` drawn with name=scrum-wip, as Edit leads to it
// expect: the editor's <section class="model-products"> lists exactly https://github.com/acme/atlas; known positive: the list of the models names acme/atlas under scrum-wip (TST-778002)
test("TST-1371001 the editor of a model names the products of this browser that declare it", async () => {
  const listed = await draw();
  assert.deepEqual(productsOf(modelOf(listed, "scrum-wip")), [ATLAS], "known positive: the list names acme/atlas under scrum-wip");
  const { target } = await edit("scrum-wip");
  assert.equal(byClass(target, "model-products").length, 1, "the section stands");
  assert.deepEqual(usersOfEditor(target), [ATLAS]);
});

// TST-1371002 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the same browser; the instance's broken-wip, which no product declares
// input: the route `models` drawn with name=broken-wip
// expect: the editor's <section class="model-products"> stands and lists no product — neither acme/library, which declares scrum, nor acme/atlas, which declares scrum-wip, nor acme/bare; counter-proof of TST-1371001
test("TST-1371002 the editor of a model that no product declares names none", async () => {
  const { target } = await edit("broken-wip", { ...INSTANCE_FILES, "docs/process-models/broken-wip.md": BROKEN });
  assert.equal(byClass(target, "model-products").length, 1, "known positive: the section stands");
  assert.deepEqual(usersOfEditor(target), []);
});

// TST-1371003 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the editor on scrum-wip, which acme/atlas declares; and the editor on the adapted v-model, which no product declares
// input: before any save the notice; then the person's click on Save in each
// expect: before it the notice of scrum-wip holds no <ul class="products">; after it the notice says "Saved as docs/process-models/scrum-wip.md." and its <ul class="products"> lists exactly https://github.com/acme/atlas; the notice after the save of the adapted v-model says "Saved as docs/process-models/v-model-adapted.md." and lists no product
test("TST-1371003 the notice after Save names the products that declare the model saved", async () => {
  const { target, state, click } = await edit("scrum-wip");
  const notice = byClass(target, "save-notice")[0];
  assert.deepEqual(byClass(notice, "products"), [], "before the save the notice names no product");
  await click(saveOf(target));
  assert.equal(state.commits.length, 1, "known positive: the model is saved");
  assert.match(notice.textContent, /Saved as docs\/process-models\/scrum-wip\.md\./);
  assert.deepEqual(usersIn(notice), [ATLAS]);
  const adapted = await edit("v-model");
  await adapted.click(saveOf(adapted.target));
  assert.equal(adapted.state.commits.length, 1, "known positive: the adapted model is saved");
  const adaptedNotice = byClass(adapted.target, "save-notice")[0];
  assert.match(adaptedNotice.textContent, /Saved as docs\/process-models\/v-model-adapted\.md\./);
  assert.deepEqual(usersIn(adaptedNotice), []);
});

// TST-1371004 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: the browser of TST-1371001, in which acme/library declares the shipped scrum
// input: the route `models` drawn with name=scrum, as Adapt leads to it; then the author types the name scrum-wip
// expect: the copy is saved as scrum-adapted, which no product declares, so the section lists none although acme/library declares scrum; after the name scrum-wip is typed, the file to be written is scrum-wip's and the section lists exactly https://github.com/acme/atlas
test("TST-1371004 the products listed are those that declare the file the definition would be written to", async () => {
  const { target } = await edit("scrum");
  assert.equal(valueOf(target, "name"), "scrum-adapted", "known positive: the copy has a name of its own");
  assert.deepEqual(usersOfEditor(target), []);
  const field = fieldOf(target, "name").getElementsByTagName("input")[0];
  field.value = "scrum-wip";
  field.dispatchEvent(new Event("input"));
  await settle();
  assert.deepEqual(usersOfEditor(target), [ATLAS]);
});

// TST-1371005 · level: unit · module: MOD-implementation-pages
// guards: UC-031
// given: this browser also manages acme/missing, which no token reaches
// input: the route `models` drawn with name=scrum-wip
// expect: the editor's section holds the unreadable list with exactly "https://github.com/acme/missing: <the host's reason>", as the list of the models shows it (TST-778004), and still lists acme/atlas
test("TST-1371005 a product that cannot be read is shown in the editor with its reason, as the list shows it", async () => {
  const { target } = await edit("scrum-wip");
  const section = byClass(target, "model-products")[0];
  assert.deepEqual(byClass(section, "source").map((item) => item.textContent), [`${MISSING}: ${MISSING} ${NO_TOKEN}`]);
  assert.deepEqual(usersOfEditor(target), [ATLAS]);
});

// TST-1371006 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE LOADS IN UNDER THREE SECONDS; UC-031
// given: this browser manages acme/library, acme/atlas and acme/bare; the list of the models drawn first, with the requests it sends to each recorded
// input: the route `models` drawn with name=scrum-wip, with the requests it sends to each recorded
// expect: the editor sends to each of acme/library, acme/atlas and acme/bare exactly the requests the list sends, so each product's declaration alone is read once; known positive: the list sends at least one request to each of the three
test("TST-1371006 the editor reads each product as the list reads it, and no more", async () => {
  await draw();
  const ofList = Object.fromEntries(["acme/library", "acme/atlas", "acme/bare"].map((name) => [name, readsOf(name)]));
  for (const [name, reads] of Object.entries(ofList)) assert.ok(reads.length > 0, `known positive: the list reads ${name}`);
  await edit("scrum-wip");
  for (const [name, reads] of Object.entries(ofList)) assert.deepEqual(readsOf(name), reads, name);
});
