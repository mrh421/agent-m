// Connecting a mailbox over IMAP through a Bridge (ITM-427) — MOD-settings-pages' route `mailbox`, for the IMAP route, as
// docs/architecture/MOD-settings-pages.md and UC-037 state it: the address and the route `routeFor` preselects, changeable; the IMAP and SMTP servers with
// their ports, the usual encryption preset for each port and the account preset to the address; the password's notice before the password field is
// enabled; the Bridge among those this browser keeps, this computer's preset, and for one reached through the jump host the notice, ticked before saving;
// the folders, INBOX preset; the processing places the participants declare, none preset, a place outside the EU stated as not compliant before saving;
// Store and test, one click: the connection stored and tested through the chosen Bridge, each part shown or its failure named; each step's explanation
// folded. Also the Settings page's statement before an export, which names the mailbox's secrets (SPEC AN EXPORT STATES THAT IT CONTAINS SECRETS).
// Run: node --test tests/settings-pages-mailbox-imap.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-037
// Guards: THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; THE SHARED PAGES ORIGIN IS DISCLOSED
// Guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Guards: CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; AN EXPORT STATES THAT IT CONTAINS SECRETS
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged, as tests/review-pages-whole-architecture.test.mjs does; the Bridges are
// fake: a stand-in for fetch answers as a Bridge does and records every request; the instance is a host of this file whose docs/participants.md names the
// processing places; the store is a Map-backed localStorage. Addresses, passwords and tokens are constructed. Where the texts leave a reading open, the
// test states the reading it takes, and the pull request names it with its source:
//   - "This computer's" Bridge is one reached on the loopback (MOD-bridge-client's handle route `loopback`, an address of 127.0.0.1): it is preset; with none, no
//     Bridge is preset.
//   - Encryption presets by port are those of UC-037 step 4.1: 993 implicit TLS for IMAP, 587 STARTTLS and 465 implicit TLS for SMTP; another port presets nothing.
//   - A place is inside the EU when it is `this machine` (MOD-mail-routes' example connection gives it outsideEu false) or its words name the EU, the European
//     Union or a member state; any other declared place is outside it and gets the notice, which the person may still accept (UC-037 step 6).
//   - A Bridge at a port of the jump host is "reached through the jump host", whether by its HTTPS address or by the forward: the forward ends on the jump host
//     too, where the traffic is plain.
//   - The Microsoft route is ITM-428's: choosing it here stores nothing and says so. Disconnect and the places changed later are ITM-429's.
//   - The test's result shows each folder with its count, Drafts, Sent, sending, the route and the encryption; a failure is named as UC-037 7a to 7d name it,
//     and the connection stays stored, shown as untested.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");

const ORIGIN = "https://fixture.github.io";
const route = () => view.routes.find((candidate) => candidate.name === "mailbox");

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
const put = async (node, value) => { node.value = value; await fire(node, "change"); };
const tick = async (node, checked = true) => { node.checked = checked; await fire(node, "change"); };
const folded = (root) => byClass(root, "explain");

const PARTICIPANTS = `# Participants of this instance

**REGISTER**

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| a-claude | CLI agent | example-model | 200000 | — | draft text | this machine | bridge lab-pc agent claude |
| b-claude | CLI agent | example-model | 200000 | — | draft text | Anthropic, a provider in the USA | bridge laptop agent claude |
| c-model | model endpoint | example-model | 200000 | — | draft text | FAU data centre (EU) | endpoint campus |
| d-model | model endpoint | example-model | 200000 | — | draft text | this machine | endpoint local |
| akmaier | person | — | — | — | draft text | — | account github.com/akmaier |
`;
const LOGIN = { user: "proxy-user", password: "web-login-constructed" };
const JUMP = { hostname: "jump.example.test", user: "agentm", sshPort: 22, portRange: [40100, 40102], httpsAddress: "https://jump.example.test", login: LOGIN };
const PASSWORD = "app-password-constructed-001";
const TESTED = { counts: { INBOX: 12, Receipts: 3 }, drafts: true, sent: true, sending: "works", route: "imap", encryption: "tls" };

// A browser: the store with the Bridges, the instance host, a cookie and an address that record every write, and a stand-in for fetch that answers
// the Bridges' mail test with `bridgeAnswer`, and Microsoft's sign-in service for a domain with `lookup`.
function browser(t, { bridges = "all", participants = PARTICIPANTS, hostState = "ok", bridgeAnswer = () => Response.json(TESTED), lookup = () => 400 } = {}) {
  const storage = new Storage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  const store = openStore("fixture/instance");
  if (bridges === "all") writeSetting(store, "bridge:laptop", { address: "http://127.0.0.1:4711", token: "laptop-token" });
  if (bridges === "all" || bridges === "remote") {
    writeSetting(store, "bridge:lab-forward", { address: "http://localhost:9222", token: "forward-token" });
    writeSetting(store, "bridge:gpu-box", { port: 40100, token: "gpu-token" });
    writeSetting(store, "jump-host", JUMP);
  }
  const writes = [];
  const requests = [];
  const priorFetch = globalThis.fetch, priorLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const text = String(url);
    if (text.startsWith("https://login.microsoftonline.com/")) return new Response("{}", { status: lookup(text) });
    return bridgeAnswer(text, init, requests);
  };
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (value) => writes.push(`cookie=${value}`) });
  Object.defineProperty(globalThis, "location", { configurable: true, value: new Proxy({ href: `${ORIGIN}/agent-m/`, origin: ORIGIN },
    { set(_target, name, value) { writes.push(`location.${String(name)}=${value}`); return true; } }) });
  t.after(() => { globalThis.fetch = priorFetch; if (priorLocation) Object.defineProperty(globalThis, "location", priorLocation); else delete globalThis.location; });
  const host = {
    repositoryInfo: async () => { if (hostState === "unreadable") throw Object.assign(new Error("rate limited"), { name: "RateLimited" }); return { defaultBranch: "main", canWrite: true }; },
    readSnapshot: async () => ({ paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? participants : null) }),
    commitFiles: async () => { throw new Error("nothing is committed"); },
  };
  const context = { instance: { repository: "fixture/instance", host }, product: null, store, go(name) { context.went.push(name); }, went: [] };
  return { storage, store, writes, requests, context,
    async page() { const target = document.createElement("div"); document.body.append(target); await route().render(target, context, {}); await settle(); return target; } };
}

// The form of a correct IMAP connection through this computer's Bridge, as a person fills it.
async function fill(page, { address = "reports@example.test", bridge = "laptop", folders = "INBOX, Receipts" } = {}) {
  await put(one(page, "mailbox-address"), address);
  await put(one(page, "mailbox-imap-host"), "imap.example.test");
  await put(one(page, "mailbox-smtp-host"), "smtp.example.test");
  await tick(one(page, "mailbox-password-notice-read"));
  await put(one(page, "mailbox-password"), PASSWORD);
  await put(one(page, "mailbox-bridge"), bridge);
  await put(one(page, "mailbox-folders"), folders);
}

// TST-472770 · level: unit · module: MOD-settings-pages
// guards: UC-037; ONE CLICK PER DECISION
// given: Connect a mailbox for an address of Gmail, which providers.json knows; for an address of a domain Microsoft's sign-in service knows (200) and one it does not (400); a person who then changes the route
// input: the address field changed; the route field changed
// expect: for Gmail the IMAP route with Gmail's servers filled in, imap.gmail.com 993 TLS and smtp.gmail.com 587 STARTTLS, and the account the address; for the Microsoft domain the route graph with the reason; for the other the IMAP route; the route is the person's to change, and the reason is shown
test("mailbox — the address preselects the route with routeFor, and the person can change it", async (t) => {
  const b = browser(t, { lookup: (url) => (url.includes("/microsoft-org.example/") ? 200 : 400) });
  const page = await b.page();
  const requestsBefore = b.requests.length;
  await put(one(page, "mailbox-address"), "me@gmail.com");
  assert.equal(b.requests.length, requestsBefore, "a known provider is not looked up");
  assert.equal(one(page, "mailbox-route").value, "imap");
  assert.deepEqual([one(page, "mailbox-imap-host").value, String(one(page, "mailbox-imap-port").value), one(page, "mailbox-imap-security").value], ["imap.gmail.com", "993", "tls"]);
  assert.deepEqual([one(page, "mailbox-smtp-host").value, String(one(page, "mailbox-smtp-port").value), one(page, "mailbox-smtp-security").value], ["smtp.gmail.com", "587", "starttls"]);
  assert.equal(one(page, "mailbox-account").value, "me@gmail.com");
  assert.match(one(page, "mailbox-route-reason").textContent, /Gmail/);
  await put(one(page, "mailbox-address"), "me@microsoft-org.example");
  assert.equal(one(page, "mailbox-route").value, "graph");
  assert.match(one(page, "mailbox-route-reason").textContent, /Microsoft 365/);
  await put(one(page, "mailbox-address"), "me@other-org.example");
  assert.equal(one(page, "mailbox-route").value, "imap");
  assert.match(one(page, "mailbox-route-reason").textContent, /IMAP/);
  await put(one(page, "mailbox-route"), "graph");
  assert.equal(one(page, "mailbox-route").value, "graph", "the person's choice stands");
  await put(one(page, "mailbox-address"), "not an address");
  assert.match(one(page, "mailbox-route-reason").textContent, /mail address/i);
});

// TST-472771 · level: unit · module: MOD-settings-pages
// guards: UC-037
// given: the form, and an SMTP port changed from 587 to 465, an IMAP port to 993, a port that has no usual encryption, and an address entered after the account
// input: the port fields and the address field changed
// expect: SMTP 465 presets TLS, 587 STARTTLS, IMAP 993 TLS; another port keeps what stood; the account follows the address while the person has not changed it
test("mailbox — the usual encryption is preset for each port and the account is preset to the address", async (t) => {
  const b = browser(t);
  const page = await b.page();
  assert.deepEqual([String(one(page, "mailbox-imap-port").value), one(page, "mailbox-imap-security").value, String(one(page, "mailbox-smtp-port").value), one(page, "mailbox-smtp-security").value], ["993", "tls", "587", "starttls"]);
  await put(one(page, "mailbox-smtp-port"), "465");
  assert.equal(one(page, "mailbox-smtp-security").value, "tls");
  await put(one(page, "mailbox-smtp-port"), "587");
  assert.equal(one(page, "mailbox-smtp-security").value, "starttls");
  await put(one(page, "mailbox-smtp-port"), "2525");
  assert.equal(one(page, "mailbox-smtp-security").value, "starttls", "no usual encryption for this port: what stood stays");
  await put(one(page, "mailbox-imap-security"), "none");
  await put(one(page, "mailbox-imap-port"), "993");
  assert.equal(one(page, "mailbox-imap-security").value, "tls");
  await put(one(page, "mailbox-address"), "first@other-org.example");
  assert.equal(one(page, "mailbox-account").value, "first@other-org.example");
  await put(one(page, "mailbox-account"), "login-name");
  await put(one(page, "mailbox-address"), "second@other-org.example");
  assert.equal(one(page, "mailbox-account").value, "login-name", "the person's account stays");
});

// TST-472772 · level: unit · module: MOD-settings-pages
// guards: THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; THE SHARED PAGES ORIGIN IS DISCLOSED; UC-037
// given: the form, the notice not ticked; a form filled in but for the tick; then the tick, and the tick taken back
// input: the notice's tick; Store and test
// expect: the password field disabled until the notice is ticked, the notice naming the owner's Pages sites, what the password grants, that it goes only to the Bridge the connection names and the recommended owner; enabled once ticked and disabled again when the tick is taken back; Store and test without the tick stores nothing and makes no request
test("mailbox — the password field is disabled until its notice is ticked, and nothing is stored before", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const password = one(page, "mailbox-password");
  assert.equal(password.disabled, true);
  assert.equal(password.type, "password");
  const notice = one(page, "mailbox-password-notice").textContent;
  assert.match(notice, /stored in this browser/);
  assert.match(notice, /fixture\.github\.io/);
  assert.match(notice, /read all mail/);
  assert.match(notice, /send mail in its name/);
  assert.match(notice, /no server except the Bridge/);
  assert.match(notice, /owner you use for nothing else/);
  await put(one(page, "mailbox-address"), "reports@example.test");
  await put(one(page, "mailbox-imap-host"), "imap.example.test");
  await put(one(page, "mailbox-smtp-host"), "smtp.example.test");
  await put(one(page, "mailbox-bridge"), "laptop");
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox"), null);
  assert.match(one(page, "mailbox-result").textContent, /read this|notice/i);
  assert.equal(b.requests.filter((request) => request.url.includes("/v1/mail/")).length, 0);
  await tick(one(page, "mailbox-password-notice-read"));
  assert.equal(password.disabled, false);
  await tick(one(page, "mailbox-password-notice-read"), false);
  assert.equal(password.disabled, true);
});

// TST-472773 · level: unit · module: MOD-settings-pages
// guards: A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; UC-037
// given: the Bridges this browser keeps — laptop on this computer, lab-forward at a forward, gpu-box through the jump host; and a browser with no Bridge on the loopback
// input: the Bridge field
// expect: the three offered by their names, laptop preset; with none on the loopback none is preset and Store and test names the Bridge as missing
test("mailbox — the Bridges this browser keeps are offered, this computer's is preset", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const select = one(page, "mailbox-bridge");
  const names = descendants(select, (node) => node.localName === "option").map((option) => option.value).filter(Boolean).sort();
  assert.deepEqual(names, ["gpu-box", "lab-forward", "laptop"]);
  assert.equal(select.value, "laptop");
  const remote = browser(t, { bridges: "remote" });
  const remotePage = await remote.page();
  assert.equal(one(remotePage, "mailbox-bridge").value, "");
  await fill(remotePage, { bridge: "" });
  await click(one(remotePage, "mailbox-store-test"));
  assert.equal(readSetting(remote.store, "mailbox"), null);
  assert.match(one(remotePage, "mailbox-result").textContent, /Bridge/);
});

// TST-472774 · level: unit · module: MOD-settings-pages
// guards: A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; UC-037
// given: the form filled in for the Bridge gpu-box, which is reached through the jump host
// input: the Bridge chosen; Store and test without the tick; the tick; Store and test; then laptop chosen
// expect: the jump host's notice shown, naming that the password and the mails pass it and that whoever administers it can read them; without the tick nothing is stored and no request made; with it stored with jumpHostNoted true; for laptop the notice is hidden and jumpHostNoted false
test("mailbox — a Bridge through the jump host is stored only after its notice is ticked", async (t) => {
  const b = browser(t);
  const page = await b.page();
  assert.equal(one(page, "mailbox-jump-notice").hidden, true, "known positive input: this computer's Bridge shows no jump host notice");
  await fill(page, { bridge: "gpu-box" });
  assert.equal(one(page, "mailbox-jump-notice").hidden, false);
  assert.match(one(page, "mailbox-jump-notice").textContent, /jump host/);
  assert.match(one(page, "mailbox-jump-notice").textContent, /password and the mails/);
  assert.match(one(page, "mailbox-jump-notice").textContent, /administers the jump host can read them/);
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox"), null);
  assert.match(one(page, "mailbox-result").textContent, /jump host/);
  assert.equal(b.requests.filter((request) => request.url.includes("/v1/mail/")).length, 0);
  await tick(one(page, "mailbox-jump-notice-read"));
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox").imap.bridge, "gpu-box");
  assert.equal(readSetting(b.store, "mailbox").imap.jumpHostNoted, true);
  await put(one(page, "mailbox-bridge"), "laptop");
  assert.equal(one(page, "mailbox-jump-notice").hidden, true);
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox").imap.jumpHostNoted, false);
});

// TST-472775 · level: unit · module: MOD-settings-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; UC-037
// given: an instance whose participants declare three places — this machine, a provider in the USA, a data centre naming the EU —, and a person
// input: the places shown; the US provider ticked; Store and test without the notice's tick; with it; the other places ticked in another run
// expect: the three places listed once each, none ticked; ticking the US provider shows the notice that processing personal data there does not comply with the GDPR and the EU AI Act, and the others show none; without the tick nothing is stored; with it the connection holds only the ticked place, outsideEu true and notCompliantNoted true; a connection with only this machine and the EU data centre needs no notice and records outsideEu false
test("mailbox — a place outside the EU is stored only after its notice, and none is preset", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const places = byClass(page, "mailbox-place");
  assert.deepEqual(places.map((place) => place.getAttribute("data-place")).sort(), ["Anthropic, a provider in the USA", "FAU data centre (EU)", "this machine"]);
  assert.ok(places.every((place) => !place.checked), "none is preset");
  const place = (name) => places.find((candidate) => candidate.getAttribute("data-place") === name);
  assert.equal(one(page, "mailbox-place-notice").hidden, true);
  await fill(page);
  await tick(place("this machine"));
  await tick(place("FAU data centre (EU)"));
  assert.equal(one(page, "mailbox-place-notice").hidden, true, "no notice for a place inside the EU");
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox").places, [{ place: "this machine", outsideEu: false }, { place: "FAU data centre (EU)", outsideEu: false }]);
  await tick(place("Anthropic, a provider in the USA"));
  assert.equal(one(page, "mailbox-place-notice").hidden, false);
  assert.match(one(page, "mailbox-place-notice").textContent, /does not comply with the EU's rules/);
  assert.match(one(page, "mailbox-place-notice").textContent, /GDPR/);
  assert.match(one(page, "mailbox-place-notice").textContent, /EU AI Act/);
  await tick(place("this machine"), false);
  await tick(place("FAU data centre (EU)"), false);
  const stored = JSON.stringify(readSetting(b.store, "mailbox"));
  await click(one(page, "mailbox-store-test"));
  assert.equal(JSON.stringify(readSetting(b.store, "mailbox")), stored, "without the tick nothing is stored");
  await tick(one(page, "mailbox-place-notice-read"));
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox").places, [{ place: "Anthropic, a provider in the USA", outsideEu: true, notCompliantNoted: true }]);
});

// TST-472776 · level: unit · module: MOD-settings-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; UC-037
// given: an instance whose participants cannot be read
// input: the page
// expect: no place is offered and the page says the participants could not be read, with the reason; the connection can still be stored with no place
test("mailbox — participants that cannot be read offer no place and say so", async (t) => {
  const b = browser(t, { hostState: "unreadable" });
  const page = await b.page();
  assert.deepEqual(byClass(page, "mailbox-place"), []);
  assert.match(one(page, "mailbox-places-result").textContent, /could not be read.*rate limited/i);
  await fill(page);
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox").places, []);
});

// TST-472777 · level: unit · module: MOD-settings-pages
// guards: ONE CLICK PER DECISION; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; UC-037
// given: a correct form for this computer's Bridge, a Bridge whose test answers with two folders, Drafts and Sent found, sending working, route and encryption
// input: Store and test, once
// expect: the connection stored as MOD-mail-routes' MailConnection — address, route imap, the folders, the ticked places, the Bridge's name, jumpHostNoted false, the servers, the account and the password — under the key `mailbox`; one request, POST to the Bridge's /v1/mail/test, with the Bridge's token in its header and the password in its body only; each part shown: both folders with their counts, Drafts, Sent, sending, the route and the encryption; the mailbox shown as connected with its route; the test recorded as working; no cookie written and the address untouched
test("mailbox — Store and test, one click, stores the connection and tests it through the chosen Bridge, each part shown", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await fill(page);
  await tick(byClass(page, "mailbox-place").find((place) => place.getAttribute("data-place") === "this machine"));
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox"), { address: "reports@example.test", route: "imap", folders: ["INBOX", "Receipts"],
    places: [{ place: "this machine", outsideEu: false }],
    imap: { bridge: "laptop", jumpHostNoted: false, imap: { host: "imap.example.test", port: 993, security: "tls" }, smtp: { host: "smtp.example.test", port: 587, security: "starttls" },
      account: "reports@example.test", password: PASSWORD } });
  const mail = b.requests.filter((request) => request.url.includes("/v1/mail/"));
  assert.equal(mail.length, 1);
  assert.equal(mail[0].url, "http://127.0.0.1:4711/v1/mail/test");
  assert.equal(mail[0].init.method, "POST");
  assert.equal(mail[0].init.headers["x-agent-m-bridge-token"], "laptop-token");
  assert.ok(JSON.parse(mail[0].init.body).connection.imap.password === PASSWORD);
  assert.ok(b.requests.every((request) => !request.url.includes(PASSWORD)), "the password is in no address");
  const shown = one(page, "mailbox-parts").textContent;
  for (const part of [/INBOX.*12/, /Receipts.*3/, /Drafts/, /Sent/, /sending works/i, /imap/, /\btls\b/i]) assert.match(shown, part);
  assert.match(one(page, "mailbox-connected").textContent, /reports@example\.test.*IMAP.*laptop/);
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "working");
  assert.deepEqual(b.writes, [], "no cookie and nothing in the address");
});

// TST-472778 · level: unit · module: MOD-settings-pages
// guards: UC-037
// given: a Bridge that does not answer; one whose test says a server offers no encryption; one whose answer is a refused login; one whose test finds sending not working; one that says a folder does not exist
// input: Store and test for each
// expect: 7a the Bridge named as not answering, with the likely causes, the connection stored and shown as untested, and the way to set up a Bridge; 7b the server named, that no login was sent to it and that the password would travel in clear text; 7c the server's answer and the folded explanation of an app password; 7d reading and sending shown separately, with the words that reading is possible and sending is not; the folder named; each a failure of the last test
test("mailbox — each failure of the test is shown as UC-037 names it", async (t) => {
  const run = async (bridgeAnswer) => {
    const b = browser(t, { bridgeAnswer });
    const page = await b.page();
    await fill(page);
    await click(one(page, "mailbox-store-test"));
    return { b, page, text: one(page, "mailbox-result").textContent + one(page, "mailbox-parts").textContent };
  };
  const offline = await run(() => { throw new TypeError("Failed to fetch"); });
  assert.match(offline.text, /did not answer|no answer/i);
  assert.match(offline.text, /not running/);
  assert.match(offline.text, /untested/);
  assert.equal(readSetting(offline.b.store, "mailbox").imap.password, PASSWORD, "the connection is stored");
  assert.equal(readSetting(offline.b.store, "last-test:mailbox").outcome, "refused");
  assert.equal(one(offline.page, "mailbox-bridge-setup").hidden, false, "the way to set up a Bridge (UC-011)");
  assert.match(one(offline.page, "mailbox-connected").textContent, /untested/);
  assert.doesNotMatch(one(offline.page, "mailbox-connected").textContent, /^Connected/);
  await click(one(offline.page, "mailbox-bridge-setup"));
  assert.deepEqual(offline.b.context.went, ["bridge"]);

  const clear = await run(() => Response.json({ error: "no-encryption", message: "imap.example.test offers no encryption; no login was sent." }, { status: 502 }));
  assert.match(clear.text, /imap\.example\.test/);
  assert.match(clear.text, /sent no login|sends no login|no login was sent/i);
  assert.match(clear.text, /clear text/i);
  assert.equal(one(clear.page, "mailbox-bridge-setup").hidden, true, "no Bridge setup for a failure of the server");
  assert.equal(one(clear.page, "mailbox-result-explanation").textContent, "");

  const refused = await run(() => Response.json({ error: "login-refused", message: "AUTHENTICATIONFAILED Invalid credentials" }, { status: 502 }));
  assert.match(refused.text, /AUTHENTICATIONFAILED Invalid credentials/);
  assert.ok(folded(one(refused.page, "mailbox-result-explanation")).some((node) => /app password/i.test(node.textContent)), "the app password is explained, folded, beside the answer");

  const sending = await run(() => Response.json({ ...TESTED, sending: "the SMTP login was refused" }));
  assert.match(sending.text, /INBOX.*12/, "reading is shown");
  assert.match(sending.text, /sending does not work.*SMTP login was refused/i);
  assert.match(sending.text, /reading is possible, sending is not/i);
  assert.match(one(sending.page, "mailbox-connected").textContent, /^Connected/);

  const missing = await run(() => Response.json({ error: "upstream-failed", message: "Receipts: mailbox does not exist" }, { status: 502 }));
  assert.match(missing.text, /folder Receipts/i);
});

// TST-472779 · level: unit · module: MOD-settings-pages
// guards: UC-037; ONE CLICK PER DECISION
// given: the form
// input: the folders field read; Microsoft chosen as the route; Store and test
// expect: INBOX preset; with the Microsoft route nothing is stored and the page says that signing in with Microsoft is not on this page yet
test("mailbox — the folders are preset to INBOX, and the Microsoft route stores nothing here", async (t) => {
  const b = browser(t);
  const page = await b.page();
  assert.equal(one(page, "mailbox-folders").value, "INBOX");
  await fill(page);
  await put(one(page, "mailbox-route"), "graph");
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox"), null);
  assert.match(one(page, "mailbox-result").textContent, /Microsoft/);
  assert.equal(b.requests.filter((request) => request.url.includes("/v1/mail/")).length, 0);
});

// TST-472780 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-037
// given: the form
// input: the page
// expect: the folded explanations of the routes, the mail servers, the app password and the processing places, each a closed details with the summary "What is this?"
test("mailbox — each step's explanation is folded", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const explanations = folded(page);
  for (const [part, snippet] of [["the routes", /web API/], ["the servers", /993/], ["the app password", /app password/i], ["the places", /Processing places/]]) {
    const found = explanations.find((node) => snippet.test(node.textContent));
    assert.ok(found, `the explanation of ${part}`);
    assert.equal(found.hasAttribute("open"), false, "folded");
    assert.match(found.textContent, /What is this\?/);
  }
});

// TST-472781 · level: unit · module: MOD-settings-pages
// guards: AN EXPORT STATES THAT IT CONTAINS SECRETS; UC-037; UC-042
// given: the Settings page of a browser with an IMAP mailbox; with a Microsoft mailbox whose sign-in keys the library wrote; with a Microsoft mailbox and no sign-in keys
// input: the statement before the export
// expect: the IMAP mailbox named as a secret with what it grants; the sign-in named with what it grants where its keys are there, and not where they are not
test("settings — the statement before an export names the mailbox's password and the sign-in tokens it carries", async (t) => {
  const settings = view.routes.find((candidate) => candidate.name === "settings");
  const statement = async (b) => { const target = document.createElement("div"); document.body.append(target); await settings.render(target, b.context, {}); return one(target, "settings-export-notice").textContent; };
  const imap = browser(t);
  writeSetting(imap.store, "mailbox", { address: "me@example.test", route: "imap", folders: ["INBOX"], places: [], imap: { bridge: "laptop", jumpHostNoted: false, account: "me", password: PASSWORD } });
  const imapText = await statement(imap);
  assert.match(imapText, /Mailbox \(access to the mailbox\)/);
  assert.doesNotMatch(imapText, /Mailbox sign-in/);

  const graph = { address: "me@example.test", route: "graph", folders: ["INBOX"], places: [], graph: { clientId: "client-1", account: "me@example.test" } };
  const signedIn = browser(t);
  writeSetting(signedIn.store, "mailbox", graph);
  const entries = { "msal.3.token.keys.client-1": JSON.stringify({ idToken: [], accessToken: ["home-1-login.windows.net-accesstoken-client-1-t--"], refreshToken: [] }),
    "home-1-login.windows.net-accesstoken-client-1-t--": JSON.stringify({ homeAccountId: "home-1", credentialType: "AccessToken", secret: "token-secret-constructed" }) };
  for (const [key, value] of Object.entries(entries)) signedIn.storage.setItem(key, value);
  const signedInText = await statement(signedIn);
  assert.match(signedInText, /Mailbox sign-in \(access to the Microsoft 365 mailbox\)/);
  assert.ok(!signedInText.includes("token-secret-constructed"), "no secret in the statement");

  const bare = browser(t);
  writeSetting(bare.store, "mailbox", graph);
  assert.doesNotMatch(await statement(bare), /Mailbox sign-in/);
});

// TST-1249102 · level: unit · module: MOD-settings-pages
// guards: UC-037
// given: a Bridge whose test finds sending not working ("the SMTP login was refused"); one whose test finds sending working; one that does not answer
// input: Store and test for each (docs/architecture/MOD-settings-pages.md, route `mailbox`: each test is stored as `last-test:mailbox` "with the `sending` its `test()` gives")
// expect: the record holds `sending` "the SMTP login was refused", then "works"; for the Bridge that did not answer (a test that threw) the record holds outcome refused and no `sending`
test("mailbox — Store and test on the IMAP route stores the sending its test gave, and a test that threw stores none", async (t) => {
  const run = async (bridgeAnswer) => {
    const b = browser(t, { bridgeAnswer });
    const page = await b.page();
    await fill(page);
    await click(one(page, "mailbox-store-test"));
    return readSetting(b.store, "last-test:mailbox");
  };
  const refused = await run(() => Response.json({ ...TESTED, sending: "the SMTP login was refused" }));
  assert.equal(refused.outcome, "working", "known positive: the test was recorded");
  assert.equal(refused.sending, "the SMTP login was refused");
  assert.equal((await run(() => Response.json(TESTED))).sending, "works");
  const threw = await run(() => { throw new TypeError("Failed to fetch"); });
  assert.equal(threw.outcome, "refused", "known positive: the test threw");
  assert.ok(!("sending" in threw), "a test that threw stores no sending");
});
