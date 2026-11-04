// The name and description of the token page that add-product opens for a product on GitHub stay within GitHub's limits
// (A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT, UC-001 step 3): the name within 40 characters, a longer one dropping the owner and
// then the end of the repository's name; the description within 1024. They keep what the removed cases of the old settings view
// asserted (ITM-818); the name is cut without an ellipsis, as UC-001 step 3 says. Reached the way tests/settings-pages-add-product.test.mjs
// reaches it: the route add-product of the public view, the address typed, Step A's link read. No request is made.
// Run: node --test tests/settings-pages-product-token-name.test.mjs
//
// Module: MOD-settings-pages
// Guards: A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT; UC-001
// Level: unit

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byTag, byClass, turn, type } from "./settings-pages-harness.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore } = await import("../src/browser-store/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "add-product");
assert.ok(route, "known positive: the public view exposes the add-product route");

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

// The link of Step A for a product at github.com/<path>.
async function tokenPageOf(path) {
  Object.defineProperty(globalThis, "localStorage", { value: new FakeStorage(), configurable: true, writable: true });
  const context = { page: "settings", instance: { repository: "akmaier/agent-m" }, product: null, store: openStore("fixture/instance"), go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  type(byClass(target, "address")[0], `https://github.com/${path}`);
  await turn();
  const step = byClass(target, "step").find((s) => (byTag(s, "h3")[0]?.textContent ?? "").startsWith("Step A"));
  return new URL(byTag(step, "a")[0].href);
}

// TST-818001 · level: unit · module: MOD-settings-pages
// guards: A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT; UC-001
// given: the route add-product; known positive: a short product alice/thesis-tool; products whose names are too long: a 35-character path, a long repository name, a 39-character owner with a 100-character repository name
// input: type each address and read the name in Step A's link
// expect: alice/thesis-tool is named "Agent M · alice/thesis-tool"; where that is over 40 characters the owner is dropped ("Agent M · a-repository-name"); where that is too, the repository's name is cut at the end, 40 characters in all, without an ellipsis ("Agent M · an-exceptionally-long-reposito"); every name is at most 40 characters; the instance's name "Agent M · akmaier/agent-m" is none of them
test("add-product — the token's name is at most 40 characters: a longer one drops the owner, then the end of the repository's name", async () => {
  assert.equal((await tokenPageOf("alice/thesis-tool")).searchParams.get("name"), "Agent M · alice/thesis-tool", "known positive: the short name is whole");
  const owner = (await tokenPageOf("a-long-owner-name/a-repository-name")).searchParams.get("name");
  assert.equal(owner, "Agent M · a-repository-name", "45 characters with the owner: the owner goes");
  const cut = (await tokenPageOf("alice/an-exceptionally-long-repository-name-for-a-thesis")).searchParams.get("name");
  assert.equal(cut, "Agent M · an-exceptionally-long-reposito", "the end of the repository's name goes");
  assert.equal(cut.length, 40);
  for (const path of ["akmaier/agent-m-test", `${"o".repeat(39)}/${"r".repeat(100)}`]) {
    const name = (await tokenPageOf(path)).searchParams.get("name");
    assert.ok(name.length <= 40, `${path}: ${name.length} characters`);
    assert.notEqual(name, "Agent M · akmaier/agent-m", "counter-proof: not the instance's name");
  }
});

// TST-818002 · level: unit · module: MOD-settings-pages
// guards: A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT; UC-001
// given: the route add-product; known positive: alice/thesis-tool; a 39-character owner with a 100-character repository name
// input: type each address and read the description in Step A's link
// expect: alice/thesis-tool is described as "Agent M for the product alice/thesis-tool: reviews, commits, issues, pull requests and runs of the work you start in it."; the long product's description names the product in full and is at most 1024 characters; neither is the instance's description
test("add-product — the token's description names the product repository and is at most 1024 characters", async () => {
  assert.equal((await tokenPageOf("alice/thesis-tool")).searchParams.get("description"),
    "Agent M for the product alice/thesis-tool: reviews, commits, issues, pull requests and runs of the work you start in it.");
  const path = `${"o".repeat(39)}/${"r".repeat(100)}`;
  const description = (await tokenPageOf(path)).searchParams.get("description");
  assert.ok(description.includes(path), "the product repository is named in full");
  assert.ok(description.length <= 1024);
  assert.doesNotMatch(description, /dashboard of/, "counter-proof: not the instance's description");
});
