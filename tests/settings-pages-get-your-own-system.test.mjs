// System test of UC-014 steps 1 to 5 and 3a: a person gets their own Agent M through the route `get-your-own`, started the way the frame starts its routes — MOD-site-frame's
// startPage over the real view of MOD-settings-pages, the address read by the frame's routing, the route drawn into the page's main element. One walk: the original dashboard opens
// the page, the person enters a GitHub name, each step then opens its exact GitHub page, the Pages step says what to choose, Later moves on, the address the review pages link
// (`#get-your-own/step=actions`) opens the Actions step on a change of the address, and each step carries its folded explanation. The entry from the main page is not part of it.
// The page is the fixture DOM of tests/site-frame-dom.mjs with a fixture location, window and local storage; the fetch refuses every request and records it, so nothing reaches
// the network, and the walk requests nothing of GitHub.
// Run: node --test tests/settings-pages-get-your-own-system.test.mjs
//
// Module: MOD-settings-pages; MOD-site-frame
// Guards: UC-014; EVERY STEP EXPLAINS ITSELF; AN INSTANCE IS A FORK OF AGENT M; THE PAGES ROOT IS THE REPOSITORY ROOT
// Level: system
//
// Each test states its input and its expected result before it runs (given / input / expect); every address below is written out in this file's own text. The counter-proofs
// (faults planted in src/settings-pages/get-your-own.mjs and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument } from "./site-frame-dom.mjs";
import { byClass, byTag, elements, type, turn } from "./settings-pages-harness.mjs";

installDocument();
const { startPage, explain } = await import("../src/site-frame/index.mjs");
const { view } = await import("../src/settings-pages/index.mjs");

const asked = [];
const STEPS = ["Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional now", "Step 4 · Open your dashboard"];
const TOPICS = ["get-your-own-fork", "get-your-own-pages", "get-your-own-actions", "get-your-own-open"];
// The frame reads the instance itself; the route requests nothing, so nothing else may be asked.
const beyondInstance = () => asked.filter((url) => !url.startsWith("https://api.github.com/repos/akmaier/agent-m"));
const GITHUB = /^https:\/\/(github\.com|[a-z]+\.github\.io)\//;

class FixtureStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

// Starts the review page served from the original dashboard at `hash`; -> the page, with the main element.
async function start(hash) {
  asked.length = 0;
  const document = installDocument();
  const window = globalThis.window;
  const location = { hostname: "akmaier.github.io", pathname: "/agent-m/docs/index.html", hash, host: "akmaier.github.io", protocol: "https:" };
  Object.defineProperty(globalThis, "location", { configurable: true, value: location });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new FixtureStorage() });
  globalThis.fetch = async (url) => { asked.push(String(url)); throw new TypeError("offline"); };
  globalThis.setInterval = () => 1;
  window.location = location;
  // The fixture window has no event target: the listeners the frame adds are kept, so that a change of the address can be announced to them.
  const listeners = [];
  window.addEventListener = (name, listener) => listeners.push([name, listener]);
  await startPage({ page: "review", views: [view], menuViews: [] });
  const page = { document, window, location, listeners, main: () => elements(document.body, (element) => element.localName === "main")[0] };
  await drawn(page);
  return page;
}
async function drawn(page) {
  for (let at = 0; at < 200 && !byClass(page.main(), "step").length; at++) await new Promise((resolve) => setImmediate(resolve));
}
// The person (or a link) changes the address; the page draws the route it names.
async function go(page, hash) {
  page.location.hash = hash;
  for (const [name, listener] of page.listeners) if (name === "hashchange") listener(new Event("hashchange"));
  await turn();
  await drawn(page);
}
const stepTitled = (main, title) => byClass(main, "step").find((step) => byTag(step, "h3")[0].textContent === title);
const current = (main) => byClass(main, "step").filter((step) => step.getAttribute("aria-current") === "step").map((step) => byTag(step, "h3")[0].textContent);
const links = (main) => byTag(main, "a").map((anchor) => anchor.href).filter((href) => GITHUB.test(href ?? ""));

// TST-587020 · level: system · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014; AN INSTANCE IS A FORK OF AGENT M; THE PAGES ROOT IS THE REPOSITORY ROOT
// given: the original dashboard akmaier/agent-m, served from https://akmaier.github.io/agent-m/docs/index.html; known positive — the same page started on the address #settings draws the route settings, not the steps
// input: start the page on #get-your-own; the person types the GitHub name acme; then types a name GitHub does not allow, acme corp/evil, then acme again
// expect: before a name, the page shows the four steps with Step 1 current and one link, the fork page https://github.com/akmaier/agent-m/fork; after acme the links are, in order, that fork page, https://github.com/acme/agent-m/settings/pages, https://github.com/acme/agent-m/actions and https://acme.github.io/agent-m/; after the refused name only the fork page is linked and the page says a GitHub name has letters, digits and single hyphens; after acme again the four links are back; the walk requested nothing beyond the frame's own read of the instance
test("system — the name entered gives each step its exact GitHub page, and a name GitHub does not allow gives none", async () => {
  const settings = await start("#settings");
  assert.deepEqual(byClass(settings.main(), "step"), [], "known positive: the route settings has no steps");
  const page = await start("#get-your-own");
  assert.deepEqual(byClass(page.main(), "step").map((step) => byTag(step, "h3")[0].textContent), STEPS);
  assert.deepEqual(current(page.main()), [STEPS[0]]);
  assert.deepEqual(links(page.main()), ["https://github.com/akmaier/agent-m/fork"]);
  const owner = byClass(page.main(), "owner")[0];
  const acme = ["https://github.com/akmaier/agent-m/fork", "https://github.com/acme/agent-m/settings/pages", "https://github.com/acme/agent-m/actions", "https://acme.github.io/agent-m/"];
  type(owner, "acme");
  assert.deepEqual(links(page.main()), acme);
  type(owner, "acme corp/evil");
  assert.deepEqual(links(page.main()), ["https://github.com/akmaier/agent-m/fork"]);
  assert.match(page.main().textContent, /A GitHub name has letters, digits and single hyphens/);
  type(owner, "acme");
  assert.deepEqual(links(page.main()), acme);
  assert.deepEqual(beyondInstance(), []);
});

// TST-587021 · level: system · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014
// given: the page started on #get-your-own/owner=acme
// input: read Step 2 and Step 4; read Step 3 and press Later
// expect: Step 2 names "Deploy from a branch", the branch "main", the folder "/ (root)" and "Save"; Step 4 says GitHub needs about a minute before the address answers; Step 3 says the workflows are needed only for EU legal texts and for an accepted change of the instance's own SPEC without a token, and offers Later; pressing Later makes Step 4 the one current step, while the links of all four steps remain, nothing was requested and the address of the page is unchanged
test("system — the Pages choice is named, Step 3 offers Later, and Later moves on with the other steps unaffected", async () => {
  const page = await start("#get-your-own/owner=acme");
  const pages = stepTitled(page.main(), STEPS[1]).textContent;
  for (const phrase of ["Deploy from a branch", "main", "/ (root)", "Save"]) assert.ok(pages.includes(phrase), `Step 2 names ${phrase}`);
  assert.match(stepTitled(page.main(), STEPS[3]).textContent, /about a minute/);
  const actions = stepTitled(page.main(), STEPS[2]);
  assert.match(actions.textContent, /EU legal texts/);
  assert.match(actions.textContent, /accepted change of the instance's own SPEC without a token/);
  const later = byTag(actions, "button").find((button) => button.textContent === "Later");
  assert.ok(later, "Step 3 offers Later");
  later.dispatchEvent(new Event("click"));
  await turn();
  assert.deepEqual(current(page.main()), [STEPS[3]]);
  assert.equal(links(page.main()).length, 4);
  assert.equal(page.location.hash, "#get-your-own/owner=acme");
  assert.deepEqual(beyondInstance(), []);
});

// TST-587022 · level: system · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014; AN INSTANCE IS A FORK OF AGENT M
// given: the page started on #get-your-own, the person's name acme entered
// input: the address changes to #get-your-own/step=actions, as the review pages link it, with the owner named: #get-your-own/owner=acme/step=actions
// expect: the page draws the route again with Step 3 as the one current step and the owner field holding acme; Step 3's link is https://github.com/acme/agent-m/actions; the address changing to #get-your-own/step=pages makes Step 2 the one current step
test("system — the address #get-your-own/step=actions opens the Actions step on a change of the address", async () => {
  const page = await start("#get-your-own");
  type(byClass(page.main(), "owner")[0], "acme");
  await go(page, "#get-your-own/owner=acme/step=actions");
  assert.deepEqual(current(page.main()), [STEPS[2]]);
  assert.equal(byClass(page.main(), "owner")[0].value, "acme");
  assert.ok(links(page.main()).includes("https://github.com/acme/agent-m/actions"));
  await go(page, "#get-your-own/owner=acme/step=pages");
  assert.deepEqual(current(page.main()), [STEPS[1]]);
});

// TST-587023 · level: system · module: MOD-settings-pages, MOD-site-frame
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the page started on #get-your-own/owner=acme
// input: read the folded explanations of the four steps
// expect: each step holds exactly one folded <details class="explain">, which is the frame's explain of its topic: Step 1 get-your-own-fork, Step 2 get-your-own-pages, Step 3 get-your-own-actions, Step 4 get-your-own-open
test("system — every step carries the frame's folded explanation of its topic", async () => {
  const page = await start("#get-your-own/owner=acme");
  STEPS.forEach((title, at) => {
    const folded = byTag(stepTitled(page.main(), title), "details");
    assert.equal(folded.length, 1, `${title} holds one folded explanation`);
    assert.equal(folded[0].className, "explain");
    assert.equal(folded[0].hasAttribute("open"), false, "folded");
    assert.ok(explain(TOPICS[at]).textContent.length > "What is this?".length, `the frame holds ${TOPICS[at]}`);
    assert.equal(folded[0].innerHTML, explain(TOPICS[at]).innerHTML, `${title} shows the frame's explanation of ${TOPICS[at]}`);
  });
});
