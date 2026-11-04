// MOD-settings-pages' route `get-your-own` as MOD-site-frame's startPage serves it: the address the review pages link (`#get-your-own/step=actions`, UC-014 step 4, 4a) is
// read by the frame's routing, the settings-pages view is loaded as an entry page loads it, and the page the person sees is the Actions step of the person's own instance.
// The page is the rich fixture DOM of tests/site-frame-dom.mjs with a fixture location, window and local storage; the fetch refuses every request at once and records it, so
// nothing reaches the network (the route itself requests nothing, which the last test of this file checks on the page).
// Run: node --test tests/settings-pages-get-your-own-route.test.mjs
//
// Module: MOD-settings-pages; MOD-site-frame
// Guards: UC-014; EVERY STEP EXPLAINS ITSELF; AN INSTANCE IS A FORK OF AGENT M
// Level: component
//
// Each test states its input and its expected result before it runs (given / input / expect); no expected value is read from a document. The counter-proofs (a planted fault in
// src/settings-pages/ or src/site-frame/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument } from "./site-frame-dom.mjs";
import { byClass, byTag, elements } from "./settings-pages-harness.mjs";

installDocument();
const { startPage } = await import("../src/site-frame/index.mjs");
const { view } = await import("../src/settings-pages/index.mjs");

const asked = [];
const STEPS = ["Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional now", "Step 4 · Open your dashboard"];

class FixtureStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

// Starts the review page of the instance served from `hostname`/`pathname` at `hash`, with the real view of MOD-settings-pages; -> the page's main element once the
// route has drawn its steps.
async function start({ hostname, pathname, hash }) {
  asked.length = 0;
  const document = installDocument();
  const window = globalThis.window;
  Object.defineProperty(globalThis, "location", { configurable: true, value: { hostname, pathname, hash, host: hostname, protocol: "https:" } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new FixtureStorage() });
  globalThis.fetch = async (url) => { asked.push(String(url)); throw new TypeError("offline"); };
  globalThis.setInterval = () => 1;
  window.location = globalThis.location;
  await startPage({ page: "review", views: [view], menuViews: [] });
  for (let turn = 0; turn < 200 && !byClass(document.body, "step").length; turn++) await new Promise((resolve) => setImmediate(resolve));
  return { document, main: elements(document.body, (element) => element.localName === "main")[0] };
}
const stepTitles = (root) => byClass(root, "step").map((step) => byTag(step, "h3")[0].textContent);
const current = (root) => byClass(root, "step").filter((step) => step.getAttribute("aria-current") === "step").map((step) => byTag(step, "h3")[0].textContent);
const hrefs = (root) => byTag(root, "a").map((anchor) => anchor.href).filter((href) => /^https:\/\/(github\.com|[a-z]+\.github\.io)\//.test(href ?? ""));

// TST-587018 · level: component · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014; AN INSTANCE IS A FORK OF AGENT M
// given: the review page of the person's own instance acme/agent-m, served from https://acme.github.io/agent-m/docs/index.html; the settings-pages view as an entry page loads it; the address #get-your-own/step=actions, as the review pages link it
// input: startPage with the fragment #get-your-own/step=actions
// expect: the page shows the four steps; the Actions step "Step 3 · Turn on the workflows — optional now" is the one current step; the links the page holds are the fork page of akmaier/agent-m and, for acme, https://github.com/acme/agent-m/settings/pages, https://github.com/acme/agent-m/actions and https://acme.github.io/agent-m/
test("startPage serves #get-your-own/step=actions as the Actions step of the person's own instance", async () => {
  const { main } = await start({ hostname: "acme.github.io", pathname: "/agent-m/docs/index.html", hash: "#get-your-own/step=actions" });
  assert.deepEqual(stepTitles(main), STEPS);
  assert.deepEqual(current(main), [STEPS[2]]);
  assert.deepEqual(hrefs(main), [
    "https://github.com/akmaier/agent-m/fork",
    "https://github.com/acme/agent-m/settings/pages",
    "https://github.com/acme/agent-m/actions",
    "https://acme.github.io/agent-m/",
  ]);
});

// TST-587019 · level: component · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the original dashboard akmaier/agent-m, served from https://akmaier.github.io/agent-m/docs/index.html; the address #get-your-own/owner=acme, which names a GitHub name and no step
// input: startPage with the fragment #get-your-own/owner=acme
// expect: Step 1 is the one current step; every step holds one folded explanation; the field holds acme; the links are those of acme as above; the frame requested nothing for the route that was not a read of the instance (no request went to a GitHub page of acme, whose pages are only linked)
test("startPage serves #get-your-own/owner=acme as the first step with the links of acme, every step explained", async () => {
  const { main } = await start({ hostname: "akmaier.github.io", pathname: "/agent-m/docs/index.html", hash: "#get-your-own/owner=acme" });
  assert.deepEqual(current(main), [STEPS[0]]);
  assert.equal(byClass(main, "owner")[0].value, "acme");
  assert.deepEqual(byClass(main, "step").map((step) => byTag(step, "details").length), [1, 1, 1, 1]);
  assert.deepEqual(hrefs(main), [
    "https://github.com/akmaier/agent-m/fork",
    "https://github.com/acme/agent-m/settings/pages",
    "https://github.com/acme/agent-m/actions",
    "https://acme.github.io/agent-m/",
  ]);
  assert.deepEqual(asked.filter((url) => url.includes("/acme/") || url.includes("acme.github.io")), []);
});
