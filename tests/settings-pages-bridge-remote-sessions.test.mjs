// Module: MOD-settings-pages
// MOD-settings-pages — canonical remote-session setup in the public Bridge route.
// Level: unit
// Guards: UC-003; UC-011; UC-042; UC-044; EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE
// Guards: THE DASHBOARD WRITES THE TUNNEL COMMANDS; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// Guards: A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK; A STORED SECRET IS HIDDEN UNTIL SHOWN

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { traceGraph, tracesTo } from "../src/trace-graph/index.mjs";

class Element extends EventTarget {
  constructor(name) { super(); this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.parentNode = null; }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
  focus() {}
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
globalThis.document = { createElement: (name) => new Element(name) };

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const click = async (button) => { button.dispatchEvent(new Event("click")); await new Promise((resolve) => setImmediate(resolve)); };

class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } get length() { return this.values.size; } key(index) { return [...this.values.keys()][index] ?? null; } }
function freshStore() { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() }); return openStore("fixture/instance"); }
function bridgeRoute() { const route = view.routes.find((candidate) => candidate.name === "bridge"); assert.ok(route, "view exposes the public Bridge route"); return route; }
async function renderBridge(store) { const target = document.createElement("div"); await bridgeRoute().render(target, { instance: { repository: "fixture/instance" }, store }); return target; }

// TST-287001
// level: unit
// module: MOD-settings-pages
// guards: UC-011; UC-042; UC-044; EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE; THE DASHBOARD WRITES THE TUNNEL COMMANDS; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS; A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: canonical jump-host storage has 40100–40102 and its first remote session occupies 40100.
// input: the public Bridge route saves the named second session with its copied token, copies its written commands, and is reopened.
// expect: it stores remote-session:lab-pc at lowest free port 40101, reloads its hidden token, copies the public reverse, forward and service commands only on the person's click, and renders Apache and nginx setup text without a request or process start.
test("TST-287001: the public Bridge route persists a distinct remote session and renders canonical setup text", async () => {
  const store = freshStore();
  const priorNavigator = globalThis.navigator;
  const copied = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (text) => { copied.push(text); } } } });
  Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: "https://published.example.test" } });
  writeSetting(store, "jump-host", { hostname: "jump.example.test", user: "agentm", sshPort: 22, portRange: [40100, 40102] });
  writeSetting(store, "remote-session:alpha", { port: 40100, token: "alpha-token" });
  globalThis.fetch = async () => { throw new Error("a setup screen must not request a network service"); };
  const route = await renderBridge(store);
  byClass(route, "remote-session-name")[0].value = "lab-pc";
  byClass(route, "remote-session-token")[0].value = "lab-token";
  await click(byClass(route, "remote-session-save")[0]);
  assert.deepEqual(readSetting(store, "remote-session:lab-pc"), { port: 40101, token: "lab-token" }, "the next session receives the lowest free inclusive port in its canonical record");
  assert.match(byClass(route, "remote-session-commands")[0].textContent, /-R 127\.0\.0\.1:40101:127\.0\.0\.1:4711/, "the reverse command uses the public loopback builder");
  assert.match(byClass(route, "remote-session-commands")[0].textContent, /-L 127\.0\.0\.1:40101:127\.0\.0\.1:40101/, "the forward command uses the public loopback builder");
  assert.match(byClass(route, "remote-session-proxy-apache")[0].textContent, /<Location "\/bridge\/lab-pc\/">/, "Apache configuration uses the session route");
  assert.match(byClass(route, "remote-session-proxy-apache")[0].textContent, /Access-Control-Allow-Origin "https:\/\/published\.example\.test"/, "the proxy uses the actual served Pages origin");
  assert.match(byClass(route, "remote-session-proxy-nginx")[0].textContent, /location \/bridge\/lab-pc\//, "nginx configuration uses the session route");
  await click(byClass(route, "remote-session-copy-commands")[0]);
  assert.match(copied[0], /-R 127\.0\.0\.1:40101:127\.0\.0\.1:4711/, "Copy uses the command text already written by the public builder");
  const reopened = await renderBridge(store);
  assert.equal(byClass(reopened, "remote-session-name")[0].value, "lab-pc", "the stored session is selected after reopen");
  assert.equal(byClass(reopened, "remote-session-token")[0].type, "password", "a stored remote-session token remains hidden");
  await click(byClass(reopened, "remote-session-show")[0]);
  assert.equal(byClass(reopened, "remote-session-token")[0].type, "text", "Show alone reveals the selected session token");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: priorNavigator });
  const path = "tests/settings-pages-bridge-remote-sessions.test.mjs";
  // A SPEC.md of its own, holding the one requirement both cases guard: no test opens Agent M's own SPEC.
  const spec = ["# Fixture product — Specification", "", "## Settings", "",
    "**EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE** *(Product Owner)*",
    "A sample rule both remote-session cases guard.", `*Check:* \`${path}\``, ""].join("\n");
  const source = { paths: ["SPEC.md", path], read: (file) => (file === "SPEC.md" ? spec : readFile(file, "utf8")) };
  const declarations = testDeclarations(path, await readFile(new URL(import.meta.url), "utf8"));
  assert.ok(declarations.every((declaration) => declaration.level && declaration.module && declaration.guards?.length && declaration.given && declaration.input && declaration.expect), "the final cases have readable canonical declarations");
  assert.deepEqual(tracesTo(await traceGraph(source), "EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE").tests.sort(), ["TST-287001", "TST-287002"], "the graph traces both final remote-session guards");
});

// TST-287002
// level: unit
// module: MOD-settings-pages
// guards: UC-011; UC-042; UC-044; EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE; THE DASHBOARD WRITES THE TUNNEL COMMANDS; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a canonical one-port jump-host range already belongs to an existing session, then no jump host at all.
// input: the public Bridge route is asked to save another named remote session in each state.
// expect: exhaustion and missing setup are named, no remote-session record is written, and neither state claims a tunnel or tested HTTPS connection.
test("TST-287002: the public Bridge route names exhausted and setup-required remote-session states without a tunnel claim", async () => {
  const store = freshStore();
  writeSetting(store, "jump-host", { hostname: "jump.example.test", user: "agentm", sshPort: 22, portRange: [40100, 40100] });
  writeSetting(store, "remote-session:alpha", { name: "alpha", port: 40100, bridgePort: 4711, token: "alpha-token" });
  const exhausted = await renderBridge(store);
  byClass(exhausted, "remote-session-name")[0].value = "beta";
  byClass(exhausted, "remote-session-token")[0].value = "beta-token";
  await click(byClass(exhausted, "remote-session-save")[0]);
  assert.match(byClass(exhausted, "remote-session-result")[0].textContent, /no free port/i, "the actual allocator exhaustion reaches the route");
  assert.equal(readSetting(store, "remote-session:beta"), null, "an exhausted range creates no session");
  const noSetup = freshStore();
  const setup = await renderBridge(noSetup);
  byClass(setup, "remote-session-name")[0].value = "beta";
  byClass(setup, "remote-session-token")[0].value = "beta-token";
  await click(byClass(setup, "remote-session-save")[0]);
  assert.match(byClass(setup, "remote-session-result")[0].textContent, /jump host.*set up|required/i, "missing canonical jump-host setup is named");
  assert.equal(readSetting(noSetup, "remote-session:beta"), null, "missing setup creates no session");
  assert.doesNotMatch(setup.textContent, /tunnel (is )?(running|connected)|HTTPS connection works/i, "configuration never claims an unstarted tunnel or tested HTTPS connection");
});
