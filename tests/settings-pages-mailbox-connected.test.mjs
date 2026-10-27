// A connected mailbox, its Disconnect and its processing places (ITM-429) — MOD-settings-pages' route `mailbox` and the Settings page, as docs/architecture/MOD-settings-pages.md
// and UC-037 steps 8, 6a, 8a and 1a state them: the connected mailbox shown with its route, folders and allowed processing places, with Test and Disconnect; Disconnect asking
// once, then removing the connection — password or sign-in token included — from localStorage itself, saying that nothing is stored, and on the Microsoft route linking the
// provider's page where the app's access is withdrawn; the processing places changed later with the same list and the same notice as when connecting; a connection an import
// brought shown as connected and untested. Nothing in a repository host is written or touched by any of it.
// Run: node --test tests/settings-pages-mailbox-connected.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-037
// Guards: A CLEAR IS A REAL CLEAR; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged. The Bridge is a stand-in for fetch that answers as a Bridge does and records every request; the
// instance is a host of this file whose docs/participants.md names the processing places and which records every read and write; the store is a Map-backed localStorage, with
// the sign-in library's keys as tests/browser-store-mailbox.test.mjs builds them. Passwords and tokens are constructed. Where the texts leave a reading open, the test states the
// reading it takes, and the pull request names it with its source:
//   - The connected mailbox is one block that the page `mailbox` shows above its form and the Settings page shows in the tab Endpoints & Agents (UC-037 step 8: "shown as
//     connected, with its route, folders, allowed processing places and Disconnect"; the Outcome: "its line among this browser's settings"); both are the same code, so the tests
//     name the class and look in both pages.
//   - "Asks once" is one question of globalThis.confirm, asked before anything is removed, as the other Clear controls of the Settings page ask it; a no removes nothing.
//   - Disconnect removes the setting `mailbox` with the sign-in library's keys for it (MOD-browser-store's clearSetting) and the record of its last test; the test of what
//     remains looks at every key and every value of localStorage, not at the settings alone.
//   - "A connection an import brought" is a `mailbox` setting with no record of a test (`last-test:mailbox`): it is shown as connected and untested.
//   - The places in the change panel are those of docs/participants.md, as when connecting; those the connection holds are ticked; a place outside the EU needs its notice read
//     before the change is saved; an inside place needs none. A save changes the places and nothing else of the connection. "No request to a repository host" means no write and
//     no read but docs/participants.md, the one the list of places is made from.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const { providerLinks } = await import("../src/mail-routes/index.mjs");

const page = (name) => view.routes.find((candidate) => candidate.name === name);
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const fire = async (node, type) => { node.dispatchEvent(new Event(type)); await settle(); };
const click = (node) => fire(node, "click");
const tick = async (node, checked = true) => { node.checked = checked; await fire(node, "change"); };

const PARTICIPANTS = `# Participants of this instance

**REGISTER**

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| a-claude | CLI agent | example-model | 200000 | — | draft text | this machine | bridge laptop agent claude |
| b-claude | CLI agent | example-model | 200000 | — | draft text | Anthropic, a provider in the USA | bridge laptop agent claude |
| c-model | model endpoint | example-model | 200000 | — | draft text | FAU data centre (EU) | endpoint campus |
`;
const PASSWORD = "app-password-constructed-001";
const CLIENT = "11111111-2222-3333-4444-555555555555";
const TOKEN = "SECRET-ACCESS-TOKEN-constructed";
const TESTED = { counts: { INBOX: 12, Receipts: 3 }, drafts: true, sent: true, sending: "works", route: "imap", encryption: "tls" };
const IMAP = { address: "reports@example.test", route: "imap", folders: ["INBOX", "Receipts"],
  places: [{ place: "this machine", outsideEu: false }, { place: "Anthropic, a provider in the USA", outsideEu: true, notCompliantNoted: true }],
  imap: { bridge: "laptop", jumpHostNoted: false, imap: { host: "imap.example.test", port: 993, security: "tls" }, smtp: { host: "smtp.example.test", port: 587, security: "starttls" },
    account: "reports@example.test", password: PASSWORD } };
const GRAPH = { address: "reports@example.test", route: "graph", folders: ["INBOX"], places: [], graph: { clientId: CLIENT, account: "signed.in@example.test" } };

// The library's cache for the client, as the vendored msal-browser 5.24.0 writes it.
function signInKeys(storage) {
  const home = "home-1.tenant-1", id = `${home}-login.windows.net-idtoken-${CLIENT}-tenant-1---`, access = `${home}-login.windows.net-accesstoken-${CLIENT}-tenant-1-mail.readwrite---`;
  const refresh = `${home}-login.windows.net-refreshtoken-${CLIENT}----`, account = `${home}-login.windows.net-tenant-1`;
  const set = (key, value) => storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  set(id, { homeAccountId: home, credentialType: "IdToken", secret: "id-secret" });
  set(access, { homeAccountId: home, credentialType: "AccessToken", secret: TOKEN });
  set(refresh, { homeAccountId: home, credentialType: "RefreshToken", secret: "refresh-secret" });
  set(account, { homeAccountId: home, username: "signed.in@example.test" });
  set(`msal.3.token.keys.${CLIENT}`, { idToken: [id], accessToken: [access], refreshToken: [refresh] });
  set("msal.3.account.keys", [account]);
  set(`msal.${CLIENT}.active-account-filters`, { homeAccountId: home });
  set("msal.version", "5.24.0");
}

function browser(t, { mailbox = IMAP, tested = "recorded" } = {}) {
  const storage = new Storage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  const store = openStore("fixture/instance");
  writeSetting(store, "bridge:laptop", { address: "http://127.0.0.1:4711", token: "laptop-token" });
  if (mailbox) writeSetting(store, "mailbox", mailbox);
  if (mailbox?.route === "graph") signInKeys(storage);
  if (mailbox && tested === "recorded") writeSetting(store, "last-test:mailbox", { at: "2026-10-11T08:00:00.000Z", outcome: "working" });
  const requests = [], reads = [], commits = [], questions = [];
  const priorFetch = globalThis.fetch, priorConfirm = globalThis.confirm;
  let answer = Response.json(TESTED);
  globalThis.fetch = async (url, init = {}) => { requests.push({ url: String(url), init }); return typeof answer === "function" ? answer() : answer.clone(); };
  const control = { confirm: true };
  globalThis.confirm = (message) => { questions.push({ message, stored: readSetting(store, "mailbox") !== null }); return control.confirm; };
  t.after(() => { globalThis.fetch = priorFetch; globalThis.confirm = priorConfirm; });
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async () => ({ paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => { reads.push(path); return path === "docs/participants.md" ? PARTICIPANTS : null; } }),
    commitFiles: async (...args) => { commits.push(args); return { commit: "c".repeat(40) }; },
  };
  const context = { instance: { repository: "fixture/instance", host }, product: null, store, go() {} };
  return { storage, store, requests, reads, commits, questions, control, respond(next) { answer = next; },
    async open(name = "mailbox") { const target = document.createElement("div"); document.body.append(target); await page(name).render(target, context, {}); await settle(); return target; } };
}
const everything = (storage) => [...storage.values.entries()].map(([key, value]) => `${key}=${value}`).join("\n");

// TST-472764 · level: unit · module: MOD-settings-pages
// guards: UC-037; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a stored IMAP connection with two places and two folders, tested successfully; and the same with no record of a test (what an import brings)
// input: the page mailbox, and the Settings page
// expect: on both pages one block: the address, IMAP through laptop, the folders, both places, the outside one named as outside the EU; the state connected with the date of the test; the Test and Disconnect controls; without a record of a test: connected and untested; no password anywhere in the text
test("a connected mailbox is shown with its route, folders and places, Test and Disconnect", async (t) => {
  const b = browser(t);
  for (const name of ["mailbox", "settings"]) {
    const shown = await b.open(name);
    const text = one(shown, "mailbox-connected").textContent;
    for (const part of [/reports@example\.test/, /IMAP.*laptop/, /INBOX, Receipts/, /this machine/, /Anthropic, a provider in the USA.*outside the EU/]) assert.match(text, part, name);
    assert.match(one(shown, "mailbox-state").textContent, /connected.*2026-10-11/i, name);
    assert.ok(one(shown, "mailbox-test") && one(shown, "mailbox-disconnect"), name);
    assert.doesNotMatch(shown.textContent, new RegExp(PASSWORD), name);
  }
  const imported = browser(t, { tested: "none" });
  for (const name of ["mailbox", "settings"]) {
    const state = one(await imported.open(name), "mailbox-state").textContent;
    assert.match(state, /connected/i, name);
    assert.match(state, /untested/i, name);
    assert.doesNotMatch(state, /2026/, name);
  }
});

// TST-472765 · level: unit · module: MOD-settings-pages
// guards: UC-037
// given: no mailbox stored
// input: the page mailbox, and the Settings page
// expect: no connected block, no Disconnect
test("with no mailbox stored there is nothing to disconnect", async (t) => {
  const b = browser(t, { mailbox: null });
  for (const name of ["mailbox", "settings"]) assert.deepEqual(byClass(await b.open(name), "mailbox-disconnect"), [], name);
});

// TST-472766 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; UC-037
// given: a stored IMAP connection whose last test is old; a Bridge that answers the test; then one that is not reachable
// input: Test
// expect: the request goes to the connection's Bridge with its token; the parts shown with a check mark; the record of the test is now, working; the connection unchanged; for the unreachable Bridge a refusal named, the record refused, the state untested, and the connection still stored
test("Test on the connected mailbox tests it through its Bridge and records the result", async (t) => {
  const b = browser(t);
  const shown = await b.open();
  await click(one(shown, "mailbox-test"));
  assert.ok(b.requests.length >= 1 && b.requests.every((r) => r.url.startsWith("http://127.0.0.1:4711")), "only the Bridge is asked");
  assert.ok(b.requests.some((r) => JSON.stringify(r.init).includes("laptop-token")), "with the Bridge's token");
  assert.match(one(shown, "mailbox-line-result").textContent, /✓.*INBOX.*12/s);
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "working");
  assert.notEqual(readSetting(b.store, "last-test:mailbox").at, "2026-10-11T08:00:00.000Z");
  assert.deepEqual(readSetting(b.store, "mailbox"), IMAP);
  const down = browser(t);
  down.respond(() => { throw new TypeError("fetch failed"); });
  const offline = await down.open();
  await click(one(offline, "mailbox-test"));
  assert.match(one(offline, "mailbox-line-result").textContent, /✗/);
  assert.equal(readSetting(down.store, "last-test:mailbox").outcome, "refused");
  assert.match(one(offline, "mailbox-state").textContent, /untested/);
  assert.deepEqual(readSetting(down.store, "mailbox"), IMAP);
});

// TST-472767 · level: unit · module: MOD-settings-pages
// guards: A CLEAR IS A REAL CLEAR; UC-037
// given: a stored IMAP connection with its password and a record of its test
// input: Disconnect, answered no; Disconnect again, answered yes — on the page mailbox, and on the Settings page
// expect: one question each time, asked while the connection is still stored; a no removes nothing; a yes leaves no key `mailbox` or `last-test:mailbox` and no key or value of localStorage that holds the password; the page says that nothing is stored and shows no connected block; no withdrawal link on the IMAP route
test("Disconnect asks once and removes the IMAP connection, its password included, from localStorage", async (t) => {
  for (const name of ["mailbox", "settings"]) {
    const b = browser(t);
    const shown = await b.open(name);
    b.control.confirm = false;
    await click(one(shown, "mailbox-disconnect"));
    assert.equal(b.questions.length, 1, name);
    assert.ok(b.questions[0].stored, "asked before anything is removed");
    assert.deepEqual(readSetting(b.store, "mailbox"), IMAP, "a no removes nothing");
    assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "working");
    b.control.confirm = true;
    await click(one(shown, "mailbox-disconnect"));
    assert.equal(b.questions.length, 2, "one question for each press");
    assert.equal(readSetting(b.store, "mailbox"), null, name);
    assert.equal(readSetting(b.store, "last-test:mailbox"), null, name);
    assert.doesNotMatch(everything(b.storage), new RegExp(PASSWORD), "no key or value holds the password");
    assert.match(one(shown, "mailbox-disconnected").textContent, /nothing is stored/i, name);
    assert.deepEqual(byClass(shown, "mailbox-disconnect"), [], "no connection, no Disconnect");
    assert.deepEqual(byClass(shown, "mailbox-withdrawal-link"), [], "no provider page on the IMAP route");
    assert.deepEqual(b.commits, [], "nothing is written to a repository");
    assert.ok(b.reads.every((path) => path === "docs/participants.md"));
  }
});

// TST-472768 · level: unit · module: MOD-settings-pages
// guards: A CLEAR IS A REAL CLEAR; UC-037
// given: a stored Microsoft 365 connection with the sign-in library's cache for its client identifier, and the cache of another client identifier beside it
// input: Disconnect, answered yes
// expect: the connection and every key of the library for this client, its tokens included, gone from localStorage; the other client's keys kept; the page links Microsoft's page for withdrawing the app's access (providerLinks), opening in a new tab with no opener, and says nothing is stored; no request is made
test("Disconnect on the Microsoft route removes the sign-in token and links the page that withdraws the app's access", async (t) => {
  const b = browser(t, { mailbox: GRAPH });
  b.storage.setItem("msal.other-client.active-account-filters", "{}");
  const shown = await b.open();
  assert.match(one(shown, "mailbox-connected").textContent, /Microsoft 365/);
  await click(one(shown, "mailbox-disconnect"));
  assert.equal(b.questions.length, 1);
  assert.equal(readSetting(b.store, "mailbox"), null);
  const left = everything(b.storage);
  assert.doesNotMatch(left, new RegExp(TOKEN));
  assert.doesNotMatch(left, new RegExp(`msal\\.[^\\n]*${CLIENT}`));
  assert.doesNotMatch(left, /refresh-secret|id-secret/);
  assert.match(left, /msal\.other-client\.active-account-filters/, "another client's cache stays");
  const link = one(shown, "mailbox-withdrawal-link");
  assert.equal(link.getAttribute("href"), providerLinks().accessWithdrawal);
  assert.equal(link.getAttribute("target"), "_blank");
  assert.match(link.getAttribute("rel"), /noopener/);
  assert.match(one(shown, "mailbox-disconnected").textContent, /nothing is stored/i);
  assert.deepEqual(b.requests, [], "no request is made");
});

// TST-472769 · level: unit · module: MOD-settings-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; UC-037
// given: a stored connection that allows this machine only, and the participants' three places
// input: Processing places; the outside place ticked and saved without the notice read; the notice read and saved; then the outside place unticked and the inside one ticked
// expect: the list is the participants' three places with this machine ticked; ticking the outside place shows the notice of step 6 and saving without reading it changes nothing; after reading it the place is stored with outsideEu and the record that the notice was noted; an inside place needs no notice; every other field of the connection, its password and its test record unchanged; the page says a mail already handed to a participant is not recalled; no write to a repository
test("Processing places changed later: the same list and the same notice, stored only after it", async (t) => {
  const only = { ...IMAP, places: [{ place: "this machine", outsideEu: false }] };
  const b = browser(t, { mailbox: only });
  const shown = await b.open();
  await click(one(shown, "mailbox-places-change"));
  const boxes = byClass(shown, "mailbox-line-place");
  assert.deepEqual(boxes.map((box) => box.getAttribute("data-place")), ["this machine", "Anthropic, a provider in the USA", "FAU data centre (EU)"]);
  assert.deepEqual(boxes.map((box) => box.checked), [true, false, false]);
  const notice = one(shown, "mailbox-line-place-notice");
  assert.equal(notice.hidden, true);
  await tick(boxes[1]);
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /does not comply with the EU's rules — the GDPR for transferring personal data, and the EU AI Act/);
  await click(one(shown, "mailbox-places-save"));
  assert.deepEqual(readSetting(b.store, "mailbox"), only, "not stored before the notice is read");
  await tick(one(shown, "mailbox-line-place-notice-read"));
  await click(one(shown, "mailbox-places-save"));
  assert.deepEqual(readSetting(b.store, "mailbox"), { ...only, places: [{ place: "this machine", outsideEu: false }, { place: "Anthropic, a provider in the USA", outsideEu: true, notCompliantNoted: true }] });
  assert.match(one(shown, "mailbox-line-result").textContent, /already handed to a participant is not recalled/i);
  assert.match(one(shown, "mailbox-connected").textContent, /Anthropic.*outside the EU/);
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "working");
  const again = await b.open();
  await click(one(again, "mailbox-places-change"));
  const next = byClass(again, "mailbox-line-place");
  assert.deepEqual(next.map((box) => box.checked), [true, true, false], "the stored places are ticked");
  await tick(next[1], false); await tick(next[2]);
  await click(one(again, "mailbox-places-save"));
  assert.deepEqual(readSetting(b.store, "mailbox").places, [{ place: "this machine", outsideEu: false }, { place: "FAU data centre (EU)", outsideEu: false }]);
  assert.equal(readSetting(b.store, "mailbox").imap.password, PASSWORD);
  assert.deepEqual(b.commits, []);
  assert.ok(b.reads.every((path) => path === "docs/participants.md"));
});

// TST-1249101 · level: unit · module: MOD-settings-pages
// guards: UC-037; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a stored IMAP connection whose last test is old and holds no `sending`; a Bridge whose test says sending does not work ("the SMTP login was refused"); then one whose test says sending works; then one that is not reachable
// input: Test on the connected mailbox (docs/architecture/MOD-settings-pages.md, route `mailbox`: "Each test of the mailbox — Store and test here, Test on its line of settings — is stored as its last test, last-test:mailbox, with the sending its test() gives (UC-037 7d)")
// expect: the record `last-test:mailbox` holds `sending` "the SMTP login was refused", then "works"; after the unreachable Bridge (a test that threw) the record holds no `sending` at all
test("Test on the connected mailbox stores the sending its test gave, and a test that threw stores none", async (t) => {
  const b = browser(t);
  assert.equal(readSetting(b.store, "last-test:mailbox").sending, undefined, "known positive: the old record holds no sending");
  b.respond(Response.json({ ...TESTED, sending: "the SMTP login was refused" }));
  const shown = await b.open();
  await click(one(shown, "mailbox-test"));
  assert.notEqual(readSetting(b.store, "last-test:mailbox").at, "2026-10-11T08:00:00.000Z", "known positive: the test was recorded");
  assert.equal(readSetting(b.store, "last-test:mailbox").sending, "the SMTP login was refused");
  b.respond(Response.json(TESTED));
  await click(one(shown, "mailbox-test"));
  assert.equal(readSetting(b.store, "last-test:mailbox").sending, "works");
  b.respond(() => { throw new TypeError("fetch failed"); });
  await click(one(shown, "mailbox-test"));
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "refused", "known positive: the test threw");
  assert.ok(!("sending" in readSetting(b.store, "last-test:mailbox")), "a test that threw stores no sending");
});
