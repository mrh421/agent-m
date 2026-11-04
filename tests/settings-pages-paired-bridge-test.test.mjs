// The line of the paired Bridge (the setting `bridge`) on the Settings page is shown with a Test, as every setting kept in this browser is
// (A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN: "Each setting kept in the browser is shown with a test of whether it still works and a
// control that clears it"). The Test is MOD-bridge-client's testBridge on bridgeAt(settings), the call the Bridges kept by name already make.
//
// Module: MOD-settings-pages
// Guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; UC-042
// Level: unit
//
// Run: node --test tests/settings-pages-paired-bridge-test.test.mjs
//
// A stand-in for `fetch` answers as a Bridge does and records every request; the store is a Map-backed localStorage; the DOM is the small one the
// other tests of this module use. Names, addresses and tokens are constructed.

import test from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";

class Element extends EventTarget {
  constructor(name) { super(); this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.files = []; this.attributes = new Map(); }
  append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
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
const click = async (button) => { button.dispatchEvent(new Event("click")); await new Promise((resolve) => setTimeout(resolve, 5)); };
const ORIGIN = "https://published.example.test";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const PAIRED = { address: "http://127.0.0.1:4711", token: "paired-token" };

function freshStore() { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() }); return openStore("fixture/instance"); }
function stand(t, answer) {
  const calls = [];
  const prior = globalThis.fetch, priorLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return answer(String(url)); };
  Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: ORIGIN } });
  t.after(() => { globalThis.fetch = prior; if (priorLocation) Object.defineProperty(globalThis, "location", priorLocation); else delete globalThis.location; });
  return calls;
}
const working = (url) => (url.endsWith("/v1/pair") ? json({ bridge: { name: "Bridge", version: "1", platform: "linux" }, origin: ORIGIN })
  : json({ agents: [{ name: "claude", version: "2", ready: true, loggedIn: true }], missing: [] }));
async function settingsPage(store) {
  const target = document.createElement("div");
  await view.routes.find((route) => route.name === "settings").render(target, { instance: { repository: "fixture/instance" }, product: null, store, go() {} }, {});
  return target;
}
const lineOfPairedBridge = (page) => byClass(page, "settings-bridge")[0];

// TST-810001 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; UC-042
// given: the paired Bridge stored as the setting `bridge`, and a Bridge that answers
// input: the Settings page is drawn; Test on the line of the paired Bridge
// expect: the line has a Test and still its Change and Clear; drawing the page makes no request; Test requests exactly /v1/pair and /v1/agents at the stored address with the stored token in the protocol header; the line then says "Works. Last successful test:" and the test is kept as `last-test:bridge` with the outcome "working"
test("Settings — the paired Bridge is tested at its own address with its own token, and the line says it works", async (t) => {
  const store = freshStore();
  writeSetting(store, "bridge", PAIRED);
  const calls = stand(t, working);
  const page = await settingsPage(store);
  const line = lineOfPairedBridge(page);
  assert.equal(byClass(line, "settings-bridge-test").length, 1, "the line has a Test");
  assert.equal(byClass(line, "settings-bridge-change").length, 1);
  assert.equal(byClass(line, "settings-bridge-clear").length, 1);
  assert.equal(calls.length, 0, "drawing the page makes no request");
  await click(byClass(line, "settings-bridge-test")[0]);
  assert.deepEqual(calls.map((call) => call.url), ["http://127.0.0.1:4711/v1/pair", "http://127.0.0.1:4711/v1/agents"]);
  assert.ok(calls.every((call) => call.init.headers["x-agent-m-bridge-token"] === "paired-token"));
  assert.match(byClass(line, "settings-bridge-status")[0].textContent, /^Works\. Last successful test: /);
  assert.equal(readSetting(store, "last-test:bridge").outcome, "working");
});

// TST-810002 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; UC-042
// given: the paired Bridge, and a Bridge that refuses its token
// input: Test on the line of the paired Bridge
// expect: the line says "Refused." and names that the Bridge refused the token; the test is kept as `last-test:bridge` with the outcome "refused" (counter-proof of the case above: a test that cannot fail checks nothing)
test("Settings — a Bridge that refuses the token is shown as refused", async (t) => {
  const store = freshStore();
  writeSetting(store, "bridge", PAIRED);
  stand(t, () => json({ error: "token-refused" }, 401));
  const page = await settingsPage(store);
  const line = lineOfPairedBridge(page);
  await click(byClass(line, "settings-bridge-test")[0]);
  assert.match(byClass(line, "settings-bridge-status")[0].textContent, /^Refused\.$/);
  assert.match(byClass(line, "settings-bridge-result")[0].textContent, /refused/i);
  assert.equal(readSetting(store, "last-test:bridge").outcome, "refused");
});
