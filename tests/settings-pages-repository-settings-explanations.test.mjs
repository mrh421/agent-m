// The folded explanations of the repository settings on the Settings page (ITM-1075) — UC-042: "Every section and every line carries a folded **What is this?**: what the setting is for,
// where it is kept, who can read it there", and EVERY STEP EXPLAINS ITSELF. The sections are those of ITM-1042 (the instance's four settings and the product's six); the topics behind
// the explanations are MOD-site-frame's, in src/site-frame/explanations.md, which explain() returns an empty element for where it holds none.
// Run: node --test tests/settings-pages-repository-settings-explanations.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-042; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The page is the real Settings route in the small DOM of tests/site-frame-dom.mjs, with fixture hosts for the instance and the product (nothing reaches the network). The reading the test takes
// (the pull request names it): each of the two sections is a `section` (classes settings-instance-settings and settings-product-settings) and each line a `div` (class settings-repository-setting)
// that holds, as its own child, one folded `details` of class explain, with the summary "What is this?" and a body of text. Each test states its input and its expected result before it runs
// (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import "./site-frame-dom.mjs";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore } = await import("../src/browser-store/index.mjs");

const turn = () => new Promise((resolve) => setImmediate(resolve));
const settled = async () => { for (let count = 0; count < 8; count += 1) await turn(); };
const descendants = (root, match) => {
  const found = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) found.push(child); walk(child); } })(root);
  return found;
};
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
    get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null };
};
const fixtureHost = () => ({
  async repositoryInfo() { return { defaultBranch: "main", canWrite: false, visibility: "private" }; },
  async readSnapshot() { return { commit: "1".repeat(40), paths: [], blob: () => null, async read() { return null; } }; },
});

// The Settings page with an instance and a product, on its tab Repositories.
async function open() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() });
  const target = document.createElement("div");
  const context = { instance: { repository: "fixture/instance", host: fixtureHost() }, product: { address: "https://github.com/acme/product", host: fixtureHost() },
    store: openStore("fixture/instance"), go() {} };
  await view.routes.find((candidate) => candidate.name === "settings").render(target, context, {});
  byClass(target, "settings-tab")[1].dispatchEvent(new Event("click"));
  await settled();
  return target;
}
// The folded explanations that are the node's own children: `details` of class explain.
const foldsOf = (node) => node.childNodes.filter((child) => child.nodeType === 1 && child.localName === "details" && child.className.split(" ").includes("explain"));
const bodyOf = (fold) => fold.childNodes.filter((child) => child !== fold.childNodes[0]).map((child) => child.textContent).join("").replace(/\s+/g, " ").trim();

// TST-107501 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY STEP EXPLAINS ITSELF
// given: the Settings page with an instance and a product, on its tab Repositories
// input: the two sections of repository settings are looked at
// expect: each is a section with exactly one folded What is this? of its own, whose body says something; the two bodies differ
test("the instance's and the product's section of repository settings each carry one folded explanation", async () => {
  const page = await open();
  const bodies = [];
  for (const name of ["settings-instance-settings", "settings-product-settings"]) {
    const [section] = byClass(page, name);
    assert.ok(section, `${name} stands on the tab`);
    assert.equal(section.localName, "section", `${name} is a section`);
    const folds = foldsOf(section);
    assert.equal(folds.length, 1, `${name} has exactly one folded explanation of its own`);
    assert.equal(folds[0].childNodes[0].textContent, "What is this?");
    assert.ok(bodyOf(folds[0]).length > 40, `${name}'s explanation has a body`);
    bodies.push(bodyOf(folds[0]));
  }
  assert.notEqual(bodies[0], bodies[1], "the two sections explain what each keeps, not one text");
});

// TST-107502 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY STEP EXPLAINS ITSELF
// given: the same page
// input: the ten lines of the two sections are looked at
// expect: counter-proof — a line whose topic the explanations file does not hold has an empty explanation and fails: each of the ten lines has exactly one folded What is this? with a body of text, and no two of the ten bodies are the same
test("each of the ten repository settings' lines carries its own folded explanation", async () => {
  const page = await open();
  const lines = byClass(page, "settings-repository-setting");
  assert.equal(lines.length, 10, "known positive: the ten lines are found");
  const bodies = [];
  for (const line of lines) {
    const title = byClass(line, "settings-repository-setting-title")[0].textContent;
    const folds = foldsOf(line);
    assert.equal(folds.length, 1, `${title} has exactly one folded explanation of its own`);
    assert.equal(folds[0].childNodes[0].textContent, "What is this?", title);
    assert.ok(bodyOf(folds[0]).length > 40, `${title}'s explanation has a body`);
    bodies.push(bodyOf(folds[0]));
  }
  assert.equal(new Set(bodies).size, 10, "each line explains its own setting");
});
