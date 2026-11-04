// The repository settings on the Settings page (ITM-1042) — MOD-settings-pages: "A repository setting has a summary and *Edit*, opening its form here or the page
// where it is kept — the product's process on the implementation pages, its schedule on the test pages", and UC-042 step 3: "**Instance** and **product** sections show each
// setting as a short summary with **Edit**". The ten settings are those of UC-042's table: for the instance participants, the source library, process models and its resources;
// for a product its process model, role assignments, Definition of Done, test schedule, linked sources and resources.
// Run: node --test tests/settings-pages-repository-settings.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-042; EVERY SETTING IS REACHED FROM ONE PAGE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY
// Level: unit
//
// The page is the fixture DOM of tests/settings-pages-recording.test.mjs; the instance and the product are fixture hosts keeping to MOD-repository-hosts' interface
// (repositoryInfo, readSnapshot with paths, blob and read). Nothing reaches the network. Each test states its input and its expected result in its own text. Where the
// module file leaves a reading open, the test states the one it takes (the pull request names them):
//   - The page draws the lines in the tab Repositories: the instance's in a section of class settings-instance-settings, the product's in settings-product-settings; a
//     line has the class settings-repository-setting, its title (settings-repository-setting-title), its summary (settings-repository-setting-summary) and a button *Edit*.
//   - The summary: participants, resources and linked sources as a count of the rows of their registers; the source library, the process models and the role assignments as a count
//     (and, for the roles, the teams' names) of their files; the process model as its declared model; the Definition of Done as the first sentence of its section; the test
//     schedule as "set" when its file exists; a missing file, or a register without a row, is "not set".
//   - *Edit* goes to the route of the setting: participants, library, models, resources with the empty product (the instance's own list; tests/settings-pages-instance-resources-edit.test.mjs shows the frame then opens it); process (the product's process and its Definition
//     of Done), roles, schedule, sources, resources.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { view } from "../src/settings-pages/index.mjs";
import { openStore } from "../src/browser-store/index.mjs";

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
const settingsRoute = () => view.routes.find((candidate) => candidate.name === "settings");
const settled = async () => { for (let turn = 0; turn < 8; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };
const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");

// A repository: `files` is the default branch.
function fixtureHost(files) {
  return {
    async repositoryInfo() { return { defaultBranch: "main", canWrite: false, visibility: "private" }; },
    async readSnapshot() {
      const opened = new Map(Object.entries(files));
      return { commit: "1".repeat(40), paths: [...opened.keys()], blob: (path) => (opened.has(path) ? blobOf(opened.get(path)) : null), async read(path) { return opened.get(path) ?? null; } };
    },
  };
}

const RESOURCES_HEAD = `# Resources

**REGISTER**

The resources.

| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |
|---|---|---|---|---|---|---|---|---|---|
`;
const CLUSTER = "| cluster | compute | cluster.example.org | — | — | — | runner:gpu | NHR@FAU, Erlangen | — | — |\n";
const LLM = "| llm | endpoint | http://ws:8000/v1 | example-model | — | — | bridge lab-pc | the group's workstation | no | — |\n";
const OTHER = "| other | compute | other.example.org | — | — | — | runner:cpu | the lab | — | — |\n";
const PARTICIPANTS = `# Participants of this instance

**REGISTER**

The participants.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| alice | person | — | — | — | draft text | — | the GitHub account \`alice\` |
| bob | person | — | — | — | draft text | — | the GitHub account \`bob\` |
`;
const PROCESS = `---
model: scrum-wip
model_file: docs/process-models/scrum-wip.md
model_version: 36818d739a20b7bd0dbfec7f13a86f46ebd29e05
---

# How this product is developed

**REGISTER**

## Practices

- none

## Branches

| Phase or time box | Branch |
|---|---|
| Sprint | \`sprint/<team>/<nn>\` |

## Definition of Done

The job rules hold for every pull request; no condition is added.
`;
const LINKS = `# Requirement sources of this product

**REGISTER**

The sources.

| Source | Version | Hash | Part |
|---|---|---|---|
| SRC-a | 1 | ${"a".repeat(64)} | |
| SRC-b | 2 | ${"b".repeat(64)} | |
`;
const INSTANCE_FILES = {
  "docs/participants.md": PARTICIPANTS, "docs/resources.md": RESOURCES_HEAD + CLUSTER + LLM + OTHER,
  "docs/sources/SRC-a.md": "# a\n", "docs/sources/SRC-b.md": "# b\n", "docs/sources/SRC-c.md": "# c\n",
  "docs/process-models/scrum-wip.md": "# m\n", "docs/process-models/kanban.md": "# k\n",
};
const PRODUCT_FILES = {
  "docs/process.md": PROCESS, "docs/role-assignments/team1.md": "# t1\n", "docs/role-assignments/team2.md": "# t2\n",
  "docs/tests/schedule.md": "---\nnightly: 02:00\n---\n# Schedule\n", "docs/sources.md": LINKS, "docs/resources.md": RESOURCES_HEAD + CLUSTER,
};

// The Settings page of the instance fixture/instance and the product https://github.com/acme/product, on its tab Repositories;
// -> { target, instance, product, went } with `went` the routes the page was asked to open.
async function open({ instanceFiles = INSTANCE_FILES, productFiles = PRODUCT_FILES } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("fixture/instance");
  const target = document.createElement("div");
  const went = [];
  const context = { instance: { repository: "fixture/instance", host: fixtureHost(instanceFiles) }, product: { address: "https://github.com/acme/product", host: fixtureHost(productFiles) },
    store, go: (name, params = {}) => went.push([name, params]) };
  await settingsRoute().render(target, context, {});
  await byClass(target, "settings-tab")[1].fire("click");
  await settled();
  return { target, instance: one(target, "settings-instance-settings"), product: one(target, "settings-product-settings"), went };
}
const linesOf = (section) => byClass(section, "settings-repository-setting").map((line) => ({
  title: one(line, "settings-repository-setting-title").textContent, summary: one(line, "settings-repository-setting-summary").textContent,
  edit: descendants(line, (node) => node.localName === "button" && node.textContent === "Edit")[0] }));

// TST-104201 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY SETTING IS REACHED FROM ONE PAGE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY
// given: an instance repository holding two participants, three sources, two process models and three resources, and a product repository holding a declared process, two role assignments, a test schedule, two linked sources and one resource
// input: the Settings page is rendered and its tab Repositories shown
// expect: the instance section has exactly four lines — Participants "2 participants", Source library "3 sources", Process models "2 models", Resources "3 resources" —; the product section exactly six — Process model "scrum-wip", Role assignments "team1, team2", Definition of Done "The job rules hold for every pull request; no condition is added.", Test schedule "set", Linked sources "2 linked sources", Resources "1 resource" —; each has an Edit
test("the instance's four and the product's six repository settings are one line each, with a summary read from the file and Edit", async () => {
  const page = await open();
  assert.ok(page.instance && page.product, "both sections stand on the tab");
  assert.deepEqual(linesOf(page.instance).map(({ title, summary }) => [title, summary]), [
    ["Participants", "2 participants"], ["Source library", "3 sources"], ["Process models", "2 models"], ["Resources", "3 resources"]]);
  assert.deepEqual(linesOf(page.product).map(({ title, summary }) => [title, summary]), [
    ["Process model", "scrum-wip"], ["Role assignments", "team1, team2"],
    ["Definition of Done", "The job rules hold for every pull request; no condition is added."],
    ["Test schedule", "set"], ["Linked sources", "2 linked sources"], ["Resources", "1 resource"]]);
  for (const line of [...linesOf(page.instance), ...linesOf(page.product)]) assert.ok(line.edit, `${line.title} has Edit`);
});

// TST-104202 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY SETTING IS REACHED FROM ONE PAGE
// given: the page of TST-104201
// input: the person presses Edit on each of the ten lines
// expect: the page is asked to open, in order, participants, library, models, resources with the product "" for the instance; process for the product's process model, roles, process for the Definition of Done, schedule, sources, resources for the product's lines
test("Edit opens the route of its setting: the product's process on process, its schedule on schedule", async () => {
  const page = await open();
  const lines = [...linesOf(page.instance), ...linesOf(page.product)];
  assert.equal(lines.length, 10, "known positive: ten lines are found");
  for (const line of lines) await line.edit.fire("click", { isTrusted: true });
  assert.deepEqual(page.went.map(([name]) => name), ["participants", "library", "models", "resources", "process", "roles", "process", "schedule", "sources", "resources"]);
  assert.deepEqual(page.went.map(([, params]) => params.product), [undefined, undefined, undefined, "", undefined, undefined, undefined, undefined, undefined, undefined],
    "only the instance's resources name a product, the empty one, which is the instance itself");
});

// TST-104203 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY SETTING IS REACHED FROM ONE PAGE
// given: repositories that hold none of the files, and an instance whose resources register has a header and no row
// input: the Settings page is rendered
// expect: all ten lines are still there, each with the summary "not set" — a line is not left out for a missing file
test("a setting whose file is missing is still a line, with the summary not set", async () => {
  const page = await open({ instanceFiles: { "README.md": "# Instance\n", "docs/resources.md": RESOURCES_HEAD }, productFiles: { "README.md": "# Product\n" } });
  const lines = [...linesOf(page.instance), ...linesOf(page.product)];
  assert.equal(lines.length, 10);
  assert.deepEqual(lines.map(({ summary }) => summary), Array(10).fill("not set"));
});
