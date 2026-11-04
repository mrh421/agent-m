// Release tests of ITM-1185 — UC-049 (a CLI session the prompt bar offers declares its place, context, model and capabilities in this browser) and UC-044 (the Bridge that offers it is paired there): the declaration of a CLI session is kept under
// `session:<bridge>:<agent>`, listed as a setting that is not secret, carried by the export and the import, and shown on the Settings page as a line of its own with Test, Change and Clear. The behaviour is docs/architecture/MOD-browser-store.md (the catalogue's row
// `session:<bridge>:<agent>`: "`{ place, context, model, capabilities }` ... | no", and "A key outside this catalogue is never written") and docs/architecture/MOD-settings-pages.md (`settings`: "A browser setting has *Test*, *Change* and *Clear*"; `bridge`: "for each CLI session a Bridge
// offers ..., kept under `session:<bridge>:<agent>`") as they state it; the store is the real MOD-browser-store over a Map-backed localStorage, the page is the real route `settings` of MOD-settings-pages, and the Bridge is a stand-in for `fetch` that answers as the Bridge's
// `/v1/pair` and `/v1/agents` do and records every request.
// Run: node --test tests/release-itm-1185-session-declaration.test.mjs
//
// Module: MOD-browser-store; MOD-settings-pages
// Guards: UC-049; UC-044; CONFIGURATION LIVES IN THE BROWSER; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; EVERY SETTING IS REACHED FROM ONE PAGE
// Level: release
//
// Written for the release testing of sprint 121 by a participant who implemented none of ITM-1185 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The expected values are written here from those texts, and none is read from a document. Readings taken where the texts leave one open:
//   - "Test against a Bridge says working" is read as the line's status "Works. Last successful test: <date>." and the recorded `last-test:session:<bridge>:<agent>` with the outcome "working"; "says so plainly" as a line of the result that names the Bridge and the agent (or the missing
//     Bridge) in words, the status "Refused." and the outcome "refused".
//   - "Clear clears the setting and its last test" is read as the raw entries `session:<bridge>:<agent>` and `last-test:session:<bridge>:<agent>` both gone, the page drawn again without the line, and every other setting kept.
//   - "malformed names are refused" is read, for the sure part, as a key that is no `session:` followed by a name (a different prefix, a different case, a space before it, or no name); a key `session:<name>` with no agent, which the catalogue's form `session:<bridge>:<agent>` does not
//     give, is read in a case of its own (TST-1185304).
//   - The page "shows no value" is read as: no field of the declaration (place, context, model, capabilities) appears anywhere in the page's text, and the line holds no field to type in.

import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { view } from "../src/settings-pages/index.mjs";
import { StoreError, clearSetting, exportSettings, importSettings, listSettings, openStore, readExport, readSetting, secretValues, writeSetting } from "../src/browser-store/index.mjs";

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
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const click = async (button) => { button.dispatchEvent(new Event("click")); await new Promise((resolve) => setTimeout(resolve, 5)); };

const INSTANCE = "fixture/instance";
const PREFIX = `agent-m:${INSTANCE}:`;
const ORIGIN = "https://published.example.test";
const SESSION = "session:lab:claude", OTHER = "session:lab:codex";
const DECLARATION = { place: "Lab server, Erlangen", context: 200000, model: "model-lab-9", capabilities: ["read the repository", "run code and tests"] };
const OTHER_DECLARATION = { place: "Lab server, Erlangen", context: 128000, model: "model-lab-7", capabilities: ["read the repository"] };
const BRIDGE = { address: "http://127.0.0.1:4711", token: "lab-bridge-token-constructed" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const offering = (...names) => (url) => (url.endsWith("/v1/pair") ? json({ bridge: { name: "lab", version: "1", platform: "linux" }, origin: ORIGIN })
  : json({ agents: names.map((name) => ({ name, version: "2", ready: true, loggedIn: true })), missing: [] }));

function freshStorage() { const storage = new Storage(); Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage }); return storage; }
const freshStore = () => openStore(INSTANCE);
function stand(t, answer) {
  const calls = [];
  const prior = globalThis.fetch, priorLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return answer(String(url), init); };
  Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: ORIGIN } });
  t.after(() => { globalThis.fetch = prior; if (priorLocation) Object.defineProperty(globalThis, "location", priorLocation); else delete globalThis.location; });
  return calls;
}
// The Settings page drawn into `target` (given again, it is drawn anew); `went` records every route the page is asked to go to.
const went = [];
async function settingsPage(store, target = document.createElement("div")) {
  went.length = 0;
  await view.routes.find((route) => route.name === "settings").render(target, { instance: { repository: INSTANCE }, product: null, store, go: (name, params) => went.push([name, params]) }, {});
  return target;
}
const lineOf = (page, label) => byClass(page, "settings-session").find((line) => descendants(line, (node) => node.localName === "h3")[0]?.textContent === label);
const buttonOf = (line, name) => byClass(line, `settings-session-${name}`)[0];
const store = () => { freshStorage(); const opened = freshStore(); writeSetting(opened, SESSION, DECLARATION); writeSetting(opened, OTHER, OTHER_DECLARATION); writeSetting(opened, "bridge:lab", BRIDGE); return opened; };

// TST-1185301 · level: release · module: MOD-browser-store
// guards: UC-049; UC-044; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE
// given: an instance's store holding the Bridge lab with its token and the declaration { place, context, model, capabilities } of the session lab:claude
// input: writeSetting of session:lab:claude; readSetting on a store opened again over the same localStorage; listSettings; secretValues
// expect: the declaration is read back whole and stands in localStorage under the instance's prefix; the setting is listed as "CLI session: lab:claude", secret false, set up in bridge, with a nonempty grants; secretValues holds the Bridge's token and no field of the declaration
// Planted fault: listSettings describing the session as secret (src/browser-store/index.mjs, settingDescription) fails the listed-as-not-secret assertion.
test("TST-1185301 a CLI session's declaration is kept and read back whole, and listed as a setting that is not secret", () => {
  const storage = freshStorage();
  const first = freshStore();
  writeSetting(first, "bridge:lab", BRIDGE);
  writeSetting(first, SESSION, DECLARATION);
  const reopened = freshStore();
  assert.deepEqual(readSetting(reopened, SESSION), DECLARATION);
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + SESSION)), DECLARATION, "the declaration stands under the instance's prefix");
  const info = listSettings(reopened).find((setting) => setting.key === SESSION);
  assert.ok(info, "the session is listed");
  assert.equal(info.label, "CLI session: lab:claude");
  assert.equal(info.secret, false);
  assert.equal(info.setUpIn, "bridge");
  assert.ok(typeof info.grants === "string" && info.grants.length > 0, "it says what it grants");
  assert.deepEqual(secretValues(reopened), [BRIDGE.token], "only the Bridge's token is a secret value");
});

// TST-1185302 · level: release · module: MOD-browser-store
// guards: UC-049; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE
// given: a browser holding the sessions lab:claude and lab:codex and the Bridge lab; an empty browser; a browser that holds lab:claude with another declaration
// input: exportSettings plain and locked; readExport of each; importSettings of the plain file into the empty browser and into the browser with its own lab:claude
// expect: both exports carry both declarations whole, and the locked file shows no field of them in clear; the empty browser adds both sessions and reads them back whole; the other browser keeps its own lab:claude, lists it under kept, and adds lab:codex
// Planted fault: export.mjs leaving the keys that begin session: out of the file fails the carried-whole assertion.
test("TST-1185302 the export and the import carry a session declaration like every other non-secret setting", async () => {
  const source = store();
  const plain = await exportSettings(source), locked = await exportSettings(source, "constructed passphrase");
  assert.deepEqual([JSON.parse(plain).settings[SESSION], JSON.parse(plain).settings[OTHER]], [DECLARATION, OTHER_DECLARATION]);
  assert.equal(locked.includes("model-lab-9"), false, "the locked file shows no field of the declaration");
  assert.deepEqual([(await readExport(locked, "constructed passphrase")).settings[SESSION], (await readExport(plain)).settings[OTHER]], [DECLARATION, OTHER_DECLARATION]);

  const empty = (freshStorage(), freshStore());
  const result = await importSettings(empty, plain);
  assert.ok(result.added.includes(SESSION) && result.added.includes(OTHER), `added: ${result.added}`);
  assert.deepEqual([readSetting(empty, SESSION), readSetting(empty, OTHER)], [DECLARATION, OTHER_DECLARATION]);

  const own = (freshStorage(), freshStore());
  writeSetting(own, SESSION, { ...DECLARATION, model: "model-own" });
  const merged = await importSettings(own, plain);
  assert.ok(merged.kept.includes(SESSION) && merged.added.includes(OTHER), `kept: ${merged.kept}, added: ${merged.added}`);
  assert.equal(readSetting(own, SESSION).model, "model-own", "what this browser has is kept");
  assert.deepEqual(readSetting(own, OTHER), OTHER_DECLARATION);
});

// TST-1185303 · level: release · module: MOD-browser-store
// guards: UC-049; CONFIGURATION LIVES IN THE BROWSER; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: a store holding the products setting; session:lab:claude is the known positive
// input: writeSetting of the keys session, session:, sessions:lab:claude, Session:lab:claude, " session:lab:claude", session-lab:claude and agent-session:lab:claude
// expect: the known positive is accepted; each of the others throws UnknownSetting naming the key, and localStorage is byte for byte what it was before
// Planted fault: a family /^session.*$/ in catalogue.mjs accepts sessions:lab:claude and session-lab:claude and fails the refusal assertion.
test("TST-1185303 a key that is no session:<name> is refused, and a refused key writes nothing", () => {
  const storage = freshStorage();
  const opened = freshStore();
  writeSetting(opened, "products", []);
  writeSetting(opened, SESSION, DECLARATION);
  const before = JSON.stringify([...storage.values]);
  for (const key of ["session", "session:", "sessions:lab:claude", "Session:lab:claude", " session:lab:claude", "session-lab:claude", "agent-session:lab:claude"]) {
    assert.throws(() => writeSetting(opened, key, DECLARATION), (error) => error instanceof StoreError && error.name === "UnknownSetting" && error.key === key, `${JSON.stringify(key)}`);
  }
  assert.equal(JSON.stringify([...storage.values]), before);
});

// TST-1185304 · level: release · module: MOD-browser-store
// guards: UC-049; CONFIGURATION LIVES IN THE BROWSER
// given: a store, and the catalogue's form session:<bridge>:<agent>
// input: writeSetting of session:lab (no agent), session:lab: (an empty agent) and session::claude (an empty Bridge)
// expect: each throws UnknownSetting naming the key, since none gives both names of the form
test("TST-1185304 a session key that lacks its Bridge or its agent is refused", () => {
  freshStorage();
  const opened = freshStore();
  for (const key of ["session:lab", "session:lab:", "session::claude"]) {
    assert.throws(() => writeSetting(opened, key, DECLARATION), (error) => error instanceof StoreError && error.name === "UnknownSetting" && error.key === key, `${JSON.stringify(key)}`);
  }
});

// TST-1185305 · level: release · module: MOD-settings-pages
// guards: UC-049; EVERY SETTING IS REACHED FROM ONE PAGE; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: the sessions lab:claude and lab:codex stored with a Bridge lab, and a store with no session at all
// input: the Settings page is drawn for each store
// expect: the first page holds a line titled "CLI session: lab:claude" and one titled "CLI session: lab:codex", each with Test, Change and Clear, no field to type in, and no field of any declaration anywhere in the page's text; drawing it made no request; the second page holds no such line
// Planted fault: sessionLine adding the stored declaration as JSON to its line (src/settings-pages/settings.mjs) puts the place and model into the page and fails the no-value assertion.
test("TST-1185305 the Settings page shows a line 'CLI session: <bridge>:<agent>' with Test, Change and Clear and no value", async (t) => {
  const opened = store();
  const calls = stand(t, offering("claude", "codex"));
  const page = await settingsPage(opened);
  assert.deepEqual(byClass(page, "settings-session").map((line) => descendants(line, (node) => node.localName === "h3")[0].textContent).sort(), ["CLI session: lab:claude", "CLI session: lab:codex"]);
  for (const label of ["CLI session: lab:claude", "CLI session: lab:codex"]) {
    const line = lineOf(page, label);
    assert.deepEqual(["test", "change", "clear"].map((name) => buttonOf(line, name)?.textContent), ["Test", "Change", "Clear"], label);
    assert.deepEqual(descendants(line, (node) => node.localName === "input" || node.localName === "textarea"), [], `${label} holds no field`);
  }
  for (const field of ["Lab server, Erlangen", "200000", "128000", "model-lab-9", "model-lab-7", "run code and tests", BRIDGE.token]) assert.equal(page.textContent.includes(field), false, `the page shows ${field}`);
  assert.deepEqual(calls, [], "drawing the page requests nothing");
  const bare = (freshStorage(), freshStore());
  assert.deepEqual(byClass(await settingsPage(bare), "settings-session"), []);
});

// TST-1185306 · level: release · module: MOD-settings-pages
// guards: UC-049; UC-044; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: the sessions lab:claude and lab:codex, the Bridge lab stored with its address and token, and a fake Bridge whose /v1/agents offers claude and codex
// input: Test on the line of lab:claude
// expect: exactly /v1/pair and /v1/agents are requested at the stored address with the stored token in the protocol header; the line's result says lab still offers claude and its status says "Works. Last successful test:"; last-test:session:lab:claude is recorded with the outcome working, and nothing is recorded for lab:codex
// Planted fault: sessionLine taking every agent as offered (offered = true) is caught by TST-1185307 and not by this case; taking none as offered (offered = false) fails this case on its status and its record.
test("TST-1185306 Test against a Bridge that offers the agent says working and records it", async (t) => {
  const opened = store();
  const calls = stand(t, offering("claude", "codex"));
  const page = await settingsPage(opened);
  const line = lineOf(page, "CLI session: lab:claude");
  await click(buttonOf(line, "test"));
  assert.deepEqual(calls.map((call) => call.url), [`${BRIDGE.address}/v1/pair`, `${BRIDGE.address}/v1/agents`]);
  assert.ok(calls.every((call) => call.init.headers["x-agent-m-bridge-token"] === BRIDGE.token));
  assert.match(byClass(line, "settings-session-result")[0].textContent, /lab still offers claude/);
  assert.match(byClass(line, "settings-session-status")[0].textContent, /^Works\. Last successful test: /);
  assert.equal(readSetting(opened, `last-test:${SESSION}`).outcome, "working");
  assert.equal(readSetting(opened, `last-test:${OTHER}`), null);
});

// TST-1185307 · level: release · module: MOD-settings-pages
// guards: UC-049; UC-044; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: the session lab:claude, the Bridge lab stored, and a fake Bridge that answers but offers codex only
// input: Test on the line of lab:claude
// expect: the result says plainly that lab answers but does not offer claude, the status says "Refused." and not "Works", and last-test:session:lab:claude is recorded with the outcome refused
// Planted fault: sessionLine taking every agent as offered (offered = true) makes the line say working, and the case fails on its result.
test("TST-1185307 Test against a Bridge that does not offer the agent says so plainly", async (t) => {
  const opened = store();
  stand(t, offering("codex"));
  const line = lineOf(await settingsPage(opened), "CLI session: lab:claude");
  await click(buttonOf(line, "test"));
  assert.match(byClass(line, "settings-session-result")[0].textContent, /lab answers, but does not offer claude/);
  assert.equal(byClass(line, "settings-session-status")[0].textContent, "Refused.");
  assert.equal(readSetting(opened, `last-test:${SESSION}`).outcome, "refused");
});

// TST-1185308 · level: release · module: MOD-settings-pages
// guards: UC-049; UC-044; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a session ghost:claude whose Bridge ghost this browser does not keep; the session lab:claude whose Bridge lab is kept but whose address gives no answer
// input: Test on the line of ghost:claude; Test on the line of lab:claude
// expect: ghost: no request is made and the result says this browser does not keep a Bridge named ghost; lab: the result begins with a cross and says the Bridge gave no answer; both statuses say "Refused." and both tests are recorded as refused
// Planted fault: sessionLine without the check of the kept Bridge (settingsOf called with the missing entry) ends in a message that does not name the Bridge, and the case fails on its text.
test("TST-1185308 Test says so plainly when no Bridge of that name is kept, and when the Bridge gives no answer", async (t) => {
  freshStorage();
  const opened = freshStore();
  writeSetting(opened, "session:ghost:claude", DECLARATION);
  writeSetting(opened, SESSION, DECLARATION);
  writeSetting(opened, "bridge:lab", BRIDGE);
  const calls = stand(t, () => { throw new TypeError("Failed to fetch"); });
  const page = await settingsPage(opened);
  const ghost = lineOf(page, "CLI session: ghost:claude"), lab = lineOf(page, "CLI session: lab:claude");
  await click(buttonOf(ghost, "test"));
  assert.deepEqual(calls, [], "no Bridge is asked for a Bridge this browser does not keep");
  assert.match(byClass(ghost, "settings-session-result")[0].textContent, /does not keep a Bridge named ghost/);
  await click(buttonOf(lab, "test"));
  assert.match(byClass(lab, "settings-session-result")[0].textContent, /^✗ The Bridge gave no answer/);
  for (const [line, key] of [[ghost, "session:ghost:claude"], [lab, SESSION]]) {
    assert.equal(byClass(line, "settings-session-status")[0].textContent, "Refused.", key);
    assert.equal(readSetting(opened, `last-test:${key}`).outcome, "refused", key);
  }
});

// TST-1185309 · level: release · module: MOD-settings-pages
// guards: UC-049; UC-044; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: the sessions lab:claude and lab:codex and the Bridge lab, the Settings page drawn, whose Bridge form holds no address yet
// input: Change on the line of lab:claude
// expect: the route bridge opens on the same page for the Bridge lab, its address field holding lab's stored address and its token field lab's stored token, and the page asks the frame to go nowhere; nothing is written or cleared
// Planted fault: sessionLine opening the route bridge without the Bridge's name (context.go("bridge", {})) shows no Bridge lab in the form and fails the address assertion.
test("TST-1185309 Change opens the route bridge for the Bridge the session belongs to", async (t) => {
  const opened = store();
  stand(t, offering("claude"));
  const page = await settingsPage(opened);
  assert.deepEqual(byClass(page, "bridge-address"), [], "the Bridge form is not open before Change");
  const before = JSON.stringify([...localStorage.values]);
  await click(buttonOf(lineOf(page, "CLI session: lab:claude"), "change"));
  assert.equal(byClass(page, "bridge-address")[0]?.value, BRIDGE.address);
  assert.equal(byClass(page, "bridge-token")[0]?.value, BRIDGE.token);
  assert.deepEqual(went, []);
  assert.equal(JSON.stringify([...localStorage.values]), before);
});

// TST-1185310 · level: release · module: MOD-settings-pages
// guards: UC-049; A CLEAR IS A REAL CLEAR; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: the sessions lab:claude and lab:codex and the Bridge lab, and a test of lab:claude recorded as working
// input: Clear on the line of lab:claude, on the same page
// expect: the entries session:lab:claude and last-test:session:lab:claude are gone from localStorage; the page is drawn again without that line and with the line of lab:codex; session:lab:codex and bridge:lab are as they were
// Planted fault: sessionLine clearing the setting and not its last test (the second clearSetting removed) leaves last-test:session:lab:claude and fails the last-test assertion.
test("TST-1185310 Clear removes the session's declaration and its last test, and nothing else", async (t) => {
  const opened = store();
  stand(t, offering("claude"));
  const page = await settingsPage(opened);
  await click(buttonOf(lineOf(page, "CLI session: lab:claude"), "test"));
  assert.equal(readSetting(opened, `last-test:${SESSION}`).outcome, "working");
  await click(buttonOf(lineOf(page, "CLI session: lab:claude"), "clear"));
  assert.equal(localStorage.getItem(PREFIX + SESSION), null, "the declaration is gone from localStorage");
  assert.equal(localStorage.getItem(`${PREFIX}last-test:${SESSION}`), null, "its last test is gone from localStorage");
  assert.equal(lineOf(page, "CLI session: lab:claude"), undefined, "the page is drawn again without the line");
  assert.ok(lineOf(page, "CLI session: lab:codex"));
  assert.deepEqual([readSetting(opened, OTHER), readSetting(opened, "bridge:lab")], [OTHER_DECLARATION, BRIDGE]);
});
