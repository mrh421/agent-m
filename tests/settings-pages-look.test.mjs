// Every Settings page wears the site's one look (ITM-1444): each route of MOD-settings-pages draws its heading as the frame's head (<section class="head"> with the h2), each of its
// buttons with the frame's class btn, and each of its section headings (h3, h4) inside a section the frame styles as a panel or a step (look.css: .panel, .step).
// Run: node --test tests/settings-pages-look.test.mjs
//
// Module: MOD-settings-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("every button, menu and structuring element of the Settings pages carries the class or element the site's style
// sheets give it, as the other settings pages do") and from the classes look.css styles, and none is read from the code. Readings taken where the texts leave one open:
//   - "As the other settings pages do" is the convention of the routes `setup` and `get-your-own`, which are in the look today: the first element is section.head holding the h2;
//     a section of the page is section.panel or section.step. They are the known positive of every check below.
//   - A button is an element <button>. The frame's class for it is btn (look.css: ".btn, ..."). A link is not checked: no route draws a link as a button.
//   - A "structuring element" is the section heading h3 and h4. Its nearest enclosing <section> is a panel or a step; the one other kind of section a heading may stand in is the Settings
//     page's own tab pane (.settings-tab-panel), which holds panels itself.
//   - A "menu" of the page (<select>) and its text fields (<input>) have no rule in look.css outside the frame's own scopes (.product, .filter, .spec-narrow, .arrange, .reject, .prompt-bar);
//     the shared look has nothing to give them, so they are reported for MOD-site-frame and not checked here.
// The checks are shown on the known positive and on every route; the counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

const ROUTES = ["settings", "setup", "add-product", "endpoints", "participants", "bridge", "mailbox", "library", "sources", "resources", "get-your-own"];
const KNOWN_POSITIVE = ["setup", "get-your-own"];
const PARTICIPANTS = `# Participants of this instance

**REGISTER**

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| a-claude | CLI agent | example-model | 200000 | — | draft text | this machine | bridge laptop agent claude |
| akmaier | person | — | — | — | draft text | — | account github.com/akmaier |
`;

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
const text = (node) => node.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// A browser with a stored Bridge and a stored mailbox, so that the pages draw their connected states as well as their forms.
function browser(t) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  const store = openStore("fixture/instance");
  writeSetting(store, "bridge:laptop", { address: "http://127.0.0.1:4711", token: "laptop-token" });
  writeSetting(store, "mailbox", { address: "reports@example.test", route: "imap", folders: ["INBOX"], places: [],
    imap: { bridge: "laptop", imap: { host: "imap.example.test", port: 993, security: "tls" }, smtp: { host: "smtp.example.test", port: 587, security: "starttls" }, account: "reports@example.test", password: "constructed" } });
  const prior = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 404 });
  t.after(() => { globalThis.fetch = prior; });
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async () => ({ paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? PARTICIPANTS : null), readMany: async () => [] }),
    commitFiles: async () => { throw new Error("nothing is committed"); },
  };
  return { store, context: { instance: { repository: "fixture/instance", host }, product: null, store, go() {} } };
}
async function draw(t, name) {
  const { context } = browser(t);
  const target = document.createElement("div");
  document.body.append(target);
  await view.routes.find((route) => route.name === name).render(target, context, {});
  await settle();
  return target;
}

// The findings of one drawn route: what is not the frame's look, each named by its element.
function headFindings(target) {
  const first = [...target.childNodes].find((node) => node.nodeType === 1);
  if (first?.localName !== "section" || !classes(first).includes("head")) return [`the first element is <${first?.localName} class="${first?.className ?? ""}">, not section.head`];
  return descendants(first, (node) => node.localName === "h2").length === 1 ? [] : ["section.head holds not exactly one h2"];
}
function buttonFindings(target) {
  return descendants(target, (node) => node.localName === "button" && !classes(node).includes("btn")).map((node) => `button "${text(node)}" has no class btn`);
}
const SECTIONS = ["panel", "step", "settings-tab-panel"];
function headingFindings(target) {
  return descendants(target, (node) => node.localName === "h3" || node.localName === "h4").filter((heading) => {
    let up = heading.parentNode;
    while (up && up !== target && up.localName !== "section") up = up.parentNode;
    return !(up && up !== target && classes(up).some((name) => SECTIONS.includes(name)));
  }).map((node) => `${node.localName} "${text(node)}" stands in no panel or step`);
}

// TST-1444001 · level: unit · module: MOD-settings-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the routes setup and get-your-own, which draw their head, sections and buttons in the frame's look today
// input: each route drawn; the three checks (head, buttons, headings) applied to it
// expect: known positive — each check finds nothing on each of the two routes, and the check of the head finds a planted bare <h2> as a finding
test("TST-1444001: a settings page already in the look passes the checks, and a bare heading is a finding", async (t) => {
  for (const name of KNOWN_POSITIVE) {
    const target = await draw(t, name);
    assert.deepEqual([headFindings(target), buttonFindings(target), headingFindings(target)], [[], [], []], `${name} is in the look`);
  }
  const bare = document.createElement("div");
  const heading = document.createElement("h2");
  bare.append(heading);
  assert.equal(headFindings(bare).length, 1, "known negative: a bare h2 is a finding");
});

// TST-1444002 · level: unit · module: MOD-settings-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: every route of MOD-settings-pages, with a stored Bridge and a stored mailbox
// input: each route drawn
// expect: the first element of each route is section.head holding its one h2, as on setup and get-your-own; no route is a finding
test("TST-1444002: every Settings page draws its heading as the frame's head", async (t) => {
  const findings = [];
  for (const name of ROUTES) for (const finding of headFindings(await draw(t, name))) findings.push(`${name}: ${finding}`);
  assert.deepEqual(findings, []);
});

// TST-1444003 · level: unit · module: MOD-settings-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: every route of MOD-settings-pages, with a stored Bridge and a stored mailbox
// input: each route drawn
// expect: every h3 and h4 of each route stands in a section that is a panel or a step (or the Settings page's tab pane); the mailbox page's Folders, Servers, Password, Bridge, Register the app and Sign in among them
test("TST-1444003: every section heading of a Settings page stands in a panel or a step", async (t) => {
  const findings = [];
  for (const name of ROUTES) for (const finding of headingFindings(await draw(t, name))) findings.push(`${name}: ${finding}`);
  assert.deepEqual(findings, []);
});

// TST-1444004 · level: unit · module: MOD-settings-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: every route of MOD-settings-pages, with a stored Bridge and a stored mailbox
// input: each route drawn
// expect: every button of each route carries the class btn
test("TST-1444004: every button of a Settings page carries the frame's class btn", async (t) => {
  const findings = [];
  for (const name of ROUTES) for (const finding of buttonFindings(await draw(t, name))) findings.push(`${name}: ${finding}`);
  assert.deepEqual(findings, []);
});
