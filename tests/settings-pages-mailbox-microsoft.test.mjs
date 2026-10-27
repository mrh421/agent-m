// Connecting a Microsoft 365 mailbox (ITM-428) — MOD-settings-pages' route `mailbox`, the Microsoft route, as docs/architecture/MOD-settings-pages.md and UC-037 state it: the
// app registration's steps — the button to Microsoft's page (providerLinks), the name, the kind single-page application and the return address with a copy button —, the field of
// the client identifier and, where the institution refuses the registration, what to ask its administrators for, with the IMAP route offered meanwhile; Sign in with Microsoft,
// with the three permissions named before Microsoft's window opens (signIn); a declined permission named with what would not work, nothing stored; an expired sign-in asked
// again at the next use; Store and test on this route.
// Run: node --test tests/settings-pages-mailbox-microsoft.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-037
// Guards: AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING; THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged. The sign-in is the fake of tests/mail-routes-sign-in.test.mjs: a stand-in for the library's client at
// globalThis.msal, put there after MOD-mail-routes is loaded, whose loginPopup and acquireTokenSilent answer as each test says and record what they are asked; the mailbox is
// Microsoft Graph answered by a fake of fetch, which records every request. The store is a Map-backed localStorage. Where the texts leave a reading open, the test states the
// reading it takes, and the pull request names it with its source:
//   - The return address is MOD-identifiers' pagesAddress of the instance (UC-037 step 2: `https://<owner>.github.io/agent-m/`).
//   - Sign in does not store the connection: the library keeps its token cache in localStorage as it signs in, and the connection — the address, the route, the folders, the places and
//     the client identifier with the account, no password — is stored by Store and test, which is refused while no account is signed in. The permission named by a declined sign-in
//     is the one MOD-mail-routes names; what would not work without it is: Mail.ReadWrite — reading mail and creating drafts; Mail.Send — sending replies, reading and drafting
//     staying; offline_access — staying signed in, the person signing in at every use.
//   - A refused registration (UC-037 2a) names what to ask the administrators for — a single-page application named Agent M, the return address and the three permissions — and offers
//     the IMAP route meanwhile, "if the provider also offers IMAP".
//   - An expired sign-in (UC-037 3b) is shown at the use that finds it — Store and test —, with the sign-in offered again; the connection stays stored, shown as untested.
//   - The folders and the processing places are the IMAP route's, shared.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const { providerLinks } = await import("../src/mail-routes/index.mjs");
const { pagesAddress } = await import("../src/identifiers/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "mailbox");
const INSTANCE = "fixture/instance";
const RETURN_ADDRESS = pagesAddress(INSTANCE);
const CLIENT = "11111111-2222-3333-4444-555555555555";
const ADDRESS = "reports@example.test";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.SECRET-ACCESS-TOKEN";
const SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access"];

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
const folded = (root) => byClass(root, "explain");

const libraryError = (name, errorCode, errorMessage) => Object.assign(new Error(`${errorCode}: ${errorMessage}`), { name, errorCode, errorMessage, subError: "" });
const ACCOUNT = "signed.in@example.test";
const SIGNED_IN = { account: { username: ACCOUNT, homeAccountId: "x.y", tenantId: "t" }, accessToken: TOKEN, scopes: SCOPES };

// The stand-in for the library's client. login: what loginPopup answers — an Error to throw, or the result — or a function of the page asked just before the window opens; silent: what
// acquireTokenSilent answers, an Error to throw or the token's answer. Everything it is asked is recorded.
function standIn({ login = SIGNED_IN, silent = { accessToken: TOKEN, scopes: SCOPES }, page = null } = {}) {
  const seen = { configs: [], logins: [], silent: [], pageAtLogin: [] };
  const accounts = [];
  globalThis.msal = {
    createStandardPublicClientApplication: async (config) => {
      seen.configs.push(structuredClone(config));
      return {
        loginPopup: async (request) => {
          seen.logins.push(structuredClone(request));
          seen.pageAtLogin.push(page?.()?.textContent ?? "");
          const answer = typeof login === "function" ? login(seen.logins.length) : login;
          if (answer instanceof Error) throw answer;
          accounts.push(answer.account);
          return answer;
        },
        getAllAccounts: () => accounts,
        acquireTokenSilent: async (request) => {
          seen.silent.push(structuredClone({ scopes: request.scopes }));
          const answer = typeof silent === "function" ? silent(seen.silent.length) : silent;
          if (answer instanceof Error) throw answer;
          return answer;
        },
      };
    },
  };
  return seen;
}

const PARTICIPANTS = `# Participants of this instance

**REGISTER**

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| a-claude | CLI agent | example-model | 200000 | — | draft text | this machine | bridge lab-pc agent claude |
| b-claude | CLI agent | example-model | 200000 | — | draft text | Anthropic, a provider in the USA | bridge laptop agent claude |
`;
const FOLDERS = { inbox: 12, Receipts: 3 };

// A browser: the store, the instance host, a cookie and an address that record every write, and a fake of fetch for Microsoft Graph and Microsoft's sign-in service.
function browser(t, { graph = null, lookup = 400 } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  const store = openStore(INSTANCE);
  const writes = [], requests = [], clipboard = [];
  const priorFetch = globalThis.fetch, priorLocation = Object.getOwnPropertyDescriptor(globalThis, "location"), priorNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const text = String(url);
    if (text.startsWith("https://login.microsoftonline.com/")) return new Response("{}", { status: lookup });
    if (graph) return graph(text, init, requests);
    const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
    if (text.includes("/me/mailFolders/inbox?")) return json({ totalItemCount: FOLDERS.inbox });
    if (text.includes("/me/mailFolders?")) return json({ value: [{ totalItemCount: FOLDERS.Receipts }] });
    if (text.includes("/me/mailFolders/drafts?") || text.includes("/me/mailFolders/sentitems?")) return json({ id: "folder" });
    return json({}, 404);
  };
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (value) => writes.push(`cookie=${value}`) });
  Object.defineProperty(globalThis, "location", { configurable: true, value: new Proxy({ hostname: "fixture.github.io", pathname: "/instance/", origin: "https://fixture.github.io", href: RETURN_ADDRESS },
    { set(_target, name, value) { writes.push(`location.${String(name)}=${value}`); return true; } }) });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (text) => { clipboard.push(text); } } } });
  t.after(() => {
    globalThis.fetch = priorFetch;
    if (priorLocation) Object.defineProperty(globalThis, "location", priorLocation); else delete globalThis.location;
    if (priorNavigator) Object.defineProperty(globalThis, "navigator", priorNavigator); else delete globalThis.navigator;
  });
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async () => ({ paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? PARTICIPANTS : null) }),
    commitFiles: async () => { throw new Error("nothing is committed"); },
  };
  const context = { instance: { repository: INSTANCE, host }, product: null, store, go(name) { context.went.push(name); }, went: [] };
  const made = { store, writes, requests, clipboard, context,
    async page() { const target = document.createElement("div"); document.body.append(target); await route().render(target, context, {}); await settle(); made.target = target; return target; } };
  return made;
}
const graphRequests = (b) => b.requests.filter((request) => request.url.startsWith("https://graph.microsoft.com/"));

// Chooses the Microsoft route for an address, enters the client identifier.
async function chooseMicrosoft(page, { clientId = CLIENT, folders = "INBOX, Receipts" } = {}) {
  await put(one(page, "mailbox-address"), ADDRESS);
  await put(one(page, "mailbox-route"), "graph");
  await put(one(page, "mailbox-client-id"), clientId);
  await put(one(page, "mailbox-folders"), folders);
}

// TST-472782 · level: unit · module: MOD-settings-pages
// guards: AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; EVERY STEP EXPLAINS ITSELF; UC-037
// given: the form with the Microsoft route chosen
// input: the route field
// expect: the Microsoft part shown and the IMAP part hidden; the button to Microsoft's page for a new app registration, whose address is providerLinks'; what to enter there — the name Agent M, the kind single-page application — and the return address of the dashboard, with a copy button that copies it and says so; the field of the client identifier; the folded explanation of the app registration; choosing IMAP again swaps them back
test("mailbox — the Microsoft route shows the app registration's steps with the return address and its copy button", async (t) => {
  const b = browser(t);
  standIn();
  const page = await b.page();
  assert.equal(one(page, "mailbox-graph").hidden, true, "known positive: the IMAP route is the first");
  assert.equal(one(page, "mailbox-imap").hidden, false);
  await put(one(page, "mailbox-route"), "graph");
  assert.equal(one(page, "mailbox-graph").hidden, false);
  assert.equal(one(page, "mailbox-imap").hidden, true);
  const link = one(page, "mailbox-app-registration-link");
  assert.equal(link.getAttribute("href"), providerLinks().appRegistration);
  const steps = one(page, "mailbox-app-registration-steps").textContent;
  assert.match(steps, /Agent M/);
  assert.match(steps, /single-page application/);
  assert.equal(one(page, "mailbox-return-address").textContent, RETURN_ADDRESS);
  await click(one(page, "mailbox-return-address-copy"));
  assert.deepEqual(b.clipboard, [RETURN_ADDRESS]);
  assert.match(one(page, "mailbox-return-address-copied").textContent, /copied/i);
  assert.ok(one(page, "mailbox-client-id"));
  assert.ok(folded(one(page, "mailbox-graph")).some((node) => /administrator/.test(node.textContent)), "the app registration is explained, folded");
  await put(one(page, "mailbox-route"), "imap");
  assert.equal(one(page, "mailbox-graph").hidden, true);
  assert.equal(one(page, "mailbox-imap").hidden, false);
});

// TST-472783 · level: unit · module: MOD-settings-pages
// guards: THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING; ONE CLICK PER DECISION; UC-037
// given: the Microsoft route; the library's client that records the page's text at the moment its window opens
// input: Sign in with Microsoft without a client identifier; then with one
// expect: without it no window and a message; with it, the three permissions — Mail.ReadWrite with what it allows, Mail.Send, offline_access — already named in the page when the window opens, and nothing else asked; the window opened once with exactly those scopes and the address as the hint; the account shown as signed in; no connection stored by it
test("mailbox — Sign in with Microsoft names the three permissions before the window opens", async (t) => {
  const b = browser(t);
  let page;
  const seen = standIn({ page: () => page });
  page = await b.page();
  await put(one(page, "mailbox-address"), ADDRESS);
  await put(one(page, "mailbox-route"), "graph");
  await click(one(page, "mailbox-sign-in"));
  assert.equal(seen.logins.length, 0, "no window without a client identifier");
  assert.match(one(page, "mailbox-sign-in-result").textContent, /client identifier.*app registration above/i);
  await put(one(page, "mailbox-client-id"), CLIENT);
  const permissions = one(page, "mailbox-permissions").textContent;
  for (const scope of SCOPES) assert.ok(permissions.includes(scope), `${scope} is named`);
  assert.match(permissions, /narrower/);
  assert.match(permissions, /never/);
  await click(one(page, "mailbox-sign-in"));
  assert.equal(seen.logins.length, 1);
  assert.deepEqual([...seen.logins[0].scopes].sort(), [...SCOPES].sort());
  assert.equal(seen.logins[0].loginHint, ADDRESS);
  for (const scope of SCOPES) assert.ok(seen.pageAtLogin[0].includes(scope), `${scope} was in the page when the window opened`);
  assert.match(one(page, "mailbox-sign-in-result").textContent, new RegExp(`Signed in as ${ACCOUNT}`));
  assert.equal(readSetting(b.store, "mailbox"), null, "signing in stores no connection");
  assert.deepEqual(b.writes, []);
});

// TST-472784 · level: unit · module: MOD-settings-pages
// guards: THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING; UC-037
// given: Microsoft's window in which the person declines Mail.Send; one in which they decline Mail.ReadWrite; one in which they decline offline_access
// input: Sign in with Microsoft, then Store and test
// expect: the permission named with what would not work without it — sending replies for Mail.Send, reading and drafting for Mail.ReadWrite, staying signed in for offline_access —; nothing stored, and Store and test refused while no account is signed in
test("mailbox — a declined permission is named with what would not work, and nothing is stored", async (t) => {
  for (const [scope, consequence] of [["Mail.Send", /send/i], ["Mail.ReadWrite", /read.*draft|draft.*read/i], ["offline_access", /signed in|sign in/i]]) {
    const b = browser(t);
    standIn({ login: libraryError("ServerError", "access_denied", `AADSTS65004: the user declined ${scope}`) });
    const page = await b.page();
    await chooseMicrosoft(page);
    await click(one(page, "mailbox-sign-in"));
    const text = one(page, "mailbox-sign-in-result").textContent;
    assert.ok(text.includes(scope), `${scope} named`);
    assert.match(text, consequence);
    assert.equal(readSetting(b.store, "mailbox"), null);
    await click(one(page, "mailbox-store-test"));
    assert.equal(readSetting(b.store, "mailbox"), null, "refused while no account is signed in");
    assert.match(one(page, "mailbox-result").textContent, /Sign in with Microsoft/);
    assert.equal(graphRequests(b).length, 0);
  }
});

// TST-472785 · level: unit · module: MOD-settings-pages
// guards: AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; UC-037
// given: Microsoft that refuses the registration (an unknown application); a window the person closed; a blocked window
// input: Sign in with Microsoft
// expect: the refusal's own message, what to ask the administrators for — a single-page application named Agent M, the return address, the three permissions — and the IMAP route offered meanwhile, which switches the route; the closed and the blocked window each said in their own words; nothing stored
test("mailbox — a refused registration says what to ask the administrators for and offers the IMAP route", async (t) => {
  const b = browser(t);
  standIn({ login: libraryError("ServerError", "invalid_client", "AADSTS700016: Application with identifier was not found in the directory") });
  const page = await b.page();
  await chooseMicrosoft(page);
  await click(one(page, "mailbox-sign-in"));
  const text = one(page, "mailbox-sign-in-result").textContent;
  assert.match(text, /AADSTS700016/);
  assert.match(text, /administrator/i);
  assert.match(text, /single-page application/);
  assert.ok(text.includes(RETURN_ADDRESS));
  for (const scope of SCOPES) assert.ok(text.includes(scope));
  assert.equal(readSetting(b.store, "mailbox"), null);
  assert.equal(one(page, "mailbox-use-imap").hidden, false, "IMAP offered meanwhile");
  await click(one(page, "mailbox-use-imap"));
  assert.equal(one(page, "mailbox-route").value, "imap");
  assert.equal(one(page, "mailbox-imap").hidden, false);

  for (const [error, words] of [[libraryError("BrowserAuthError", "user_cancelled", "closed"), /closed/i], [libraryError("BrowserAuthError", "popup_window_error", "blocked"), /pop-up|blocked/i]]) {
    const c = browser(t);
    standIn({ login: error });
    const second = await c.page();
    await chooseMicrosoft(second);
    await click(one(second, "mailbox-sign-in"));
    assert.match(one(second, "mailbox-sign-in-result").textContent, words);
    assert.equal(readSetting(c.store, "mailbox"), null);
    assert.equal(one(second, "mailbox-use-imap").hidden, true, "only a refused registration offers IMAP");
  }
});

// TST-472786 · level: unit · module: MOD-settings-pages
// guards: THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; ONE CLICK PER DECISION; UC-037
// given: a signed-in account, two folders, a place that is this machine
// input: Store and test, once
// expect: the connection stored — the address, the route graph, the folders, the ticked place, and the client identifier with the account, no password, no IMAP part —; the test through the mailbox: both folders with their counts, Drafts, Sent, sending, the route and the encryption shown; the token only in the authorisation header of requests to Microsoft Graph and in no address; the mailbox shown as connected with its route; the test recorded as working; no cookie written and the address untouched
test("mailbox — Store and test on the Microsoft route stores the client identifier and no password, and shows the counts", async (t) => {
  const b = browser(t);
  const seen = standIn();
  const page = await b.page();
  await chooseMicrosoft(page);
  const place = byClass(page, "mailbox-place").find((box) => box.getAttribute("data-place") === "this machine");
  place.checked = true; await fire(place, "change");
  await click(one(page, "mailbox-sign-in"));
  assert.equal(readSetting(b.store, "mailbox"), null);
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox"), { address: ADDRESS, route: "graph", folders: ["INBOX", "Receipts"], places: [{ place: "this machine", outsideEu: false }],
    graph: { clientId: CLIENT, account: ACCOUNT } });
  assert.ok(!JSON.stringify(readSetting(b.store, "mailbox")).includes("password"));
  const shown = one(page, "mailbox-parts").textContent;
  for (const part of [/INBOX.*12/, /Receipts.*3/, /Drafts/, /Sent/, /sending works/i, /graph/i]) assert.match(shown, part);
  assert.match(one(page, "mailbox-connected").textContent, /Connected.*reports@example\.test.*Microsoft/);
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "working");
  assert.ok(graphRequests(b).length >= 4, "Microsoft Graph was asked");
  assert.ok(graphRequests(b).every((request) => request.init.headers.Authorization === `Bearer ${TOKEN}`), "the token in the authorisation header");
  assert.ok(b.requests.filter((request) => !request.url.startsWith("https://graph.microsoft.com/")).every((request) => !JSON.stringify(request).includes(TOKEN)), "and nowhere else");
  assert.ok(b.requests.every((request) => !request.url.includes(TOKEN)), "in no address");
  assert.deepEqual(seen.silent.map((asked) => asked.scopes.slice().sort()), seen.silent.map(() => [...SCOPES].sort()), "silently, for the three scopes");
  assert.deepEqual(b.writes, []);
});

// TST-472787 · level: unit · module: MOD-settings-pages
// guards: THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING; UC-037
// given: a signed-in account whose sign-in has expired when the test asks for the token silently, then signed in again
// input: Store and test; Sign in with Microsoft again; Store and test
// expect: the first says the sign-in has expired and to sign in with Microsoft again, the connection stored and shown as untested, the test recorded as refused, the sign-in button the way forward; after signing in again the window opens a second time and the test shows its counts
test("mailbox — an expired sign-in is asked again at the next use", async (t) => {
  const b = browser(t);
  const seen = standIn({ silent: (n) => (n === 1 ? libraryError("InteractionRequiredAuthError", "interaction_required", "the refresh token has expired") : { accessToken: TOKEN, scopes: SCOPES }) });
  const page = await b.page();
  await chooseMicrosoft(page);
  await click(one(page, "mailbox-sign-in"));
  await click(one(page, "mailbox-store-test"));
  assert.match(one(page, "mailbox-result").textContent, /expired.*sign in with Microsoft again/i);
  assert.match(one(page, "mailbox-connected").textContent, /untested/);
  assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "refused");
  assert.equal(readSetting(b.store, "mailbox").graph.clientId, CLIENT, "the connection stays stored");
  assert.equal(graphRequests(b).length, 0, "no request to Microsoft Graph without a token");
  await click(one(page, "mailbox-sign-in"));
  assert.equal(seen.logins.length, 2, "the window opens again");
  await click(one(page, "mailbox-store-test"));
  assert.match(one(page, "mailbox-parts").textContent, /INBOX.*12/);
  assert.match(one(page, "mailbox-connected").textContent, /Connected/);
});

// TST-472788 · level: unit · module: MOD-settings-pages
// guards: THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER; UC-037
// given: Microsoft Graph that refuses a permission (403), asks to wait (429 with Retry-After), cannot be reached, and lacks the folder Receipts
// input: Store and test for each
// expect: each failure said as the mailbox names it — Mail.ReadWrite refused, the seconds to wait, Microsoft Graph unreachable, the folder Receipts missing —; the connection stored and shown as untested; the test recorded as refused
test("mailbox — each failure of Microsoft Graph is shown as the mailbox names it", async (t) => {
  const answers = [
    [(url) => new Response("{}", { status: 403 }), /Mail\.ReadWrite/],
    [() => new Response("{}", { status: 429, headers: { "Retry-After": "30" } }), /30 seconds/],
    [() => { throw new TypeError("Failed to fetch"); }, /could not be reached/i],
    [(url) => (url.includes("/me/mailFolders?") ? new Response(JSON.stringify({ value: [] }), { status: 200 }) : new Response(JSON.stringify({ totalItemCount: 1, id: "x" }), { status: 200 })), /folder Receipts/i],
  ];
  for (const [graph, words] of answers) {
    const b = browser(t, { graph });
    standIn();
    const page = await b.page();
    await chooseMicrosoft(page);
    await click(one(page, "mailbox-sign-in"));
    await click(one(page, "mailbox-store-test"));
    assert.match(one(page, "mailbox-result").textContent, words);
    assert.match(one(page, "mailbox-connected").textContent, /untested/);
    assert.equal(readSetting(b.store, "last-test:mailbox").outcome, "refused");
  }
});

// TST-472789 · level: unit · module: MOD-settings-pages
// guards: A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; UC-037
// given: the Microsoft route, signed in, a place outside the EU ticked without its notice's tick
// input: Store and test
// expect: nothing stored and the notice named; with the tick the connection records the place with notCompliantNoted
test("mailbox — a place outside the EU is stored on the Microsoft route only after its notice", async (t) => {
  const b = browser(t);
  standIn();
  const page = await b.page();
  await chooseMicrosoft(page);
  const place = byClass(page, "mailbox-place").find((box) => box.getAttribute("data-place") === "Anthropic, a provider in the USA");
  place.checked = true; await fire(place, "change");
  await click(one(page, "mailbox-sign-in"));
  await click(one(page, "mailbox-store-test"));
  assert.equal(readSetting(b.store, "mailbox"), null);
  assert.match(one(page, "mailbox-result").textContent, /outside the EU/);
  const tick = one(page, "mailbox-place-notice-read");
  tick.checked = true; await fire(tick, "change");
  await click(one(page, "mailbox-store-test"));
  assert.deepEqual(readSetting(b.store, "mailbox").places, [{ place: "Anthropic, a provider in the USA", outsideEu: true, notCompliantNoted: true }]);
});

// TST-472790 · level: unit · module: MOD-settings-pages
// guards: AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; UC-037
// given: an address whose domain Microsoft's sign-in service knows
// input: the address field
// expect: the route preselected as the Microsoft one, and its part shown with the IMAP part hidden, without the person choosing it
test("mailbox — an address of a Microsoft 365 domain shows the Microsoft part", async (t) => {
  const b = browser(t, { lookup: 200 });
  standIn();
  const page = await b.page();
  await put(one(page, "mailbox-address"), "me@org.example");
  assert.equal(one(page, "mailbox-route").value, "graph");
  assert.equal(one(page, "mailbox-graph").hidden, false);
  assert.equal(one(page, "mailbox-imap").hidden, true);
});

// TST-1249103 · level: unit · module: MOD-settings-pages
// guards: UC-037
// given: a signed-in account whose sign-in did not grant Mail.Send (the test's sending is "the sign-in did not grant Mail.Send"); then one that granted all three; then one whose sign-in has expired
// input: Store and test for each (docs/architecture/MOD-settings-pages.md, route `mailbox`: each test is stored as `last-test:mailbox` "with the `sending` its `test()` gives")
// expect: the record holds `sending` "the sign-in did not grant Mail.Send", then "works"; for the expired sign-in (a test that threw) outcome refused and no `sending`
test("mailbox — Store and test on the Microsoft route stores the sending its test gave, and a test that threw stores none", async (t) => {
  const run = async (silent) => {
    const b = browser(t);
    standIn({ silent });
    const page = await b.page();
    await chooseMicrosoft(page);
    await click(one(page, "mailbox-sign-in"));
    await click(one(page, "mailbox-store-test"));
    return readSetting(b.store, "last-test:mailbox");
  };
  const missing = await run({ accessToken: TOKEN, scopes: ["Mail.ReadWrite", "offline_access"] });
  assert.equal(missing.outcome, "working", "known positive: the test was recorded");
  assert.equal(missing.sending, "the sign-in did not grant Mail.Send");
  assert.equal((await run({ accessToken: TOKEN, scopes: SCOPES })).sending, "works");
  const threw = await run(libraryError("InteractionRequiredAuthError", "interaction_required", "the refresh token has expired"));
  assert.equal(threw.outcome, "refused", "known positive: the test threw");
  assert.ok(!("sending" in threw), "a test that threw stores no sending");
});
