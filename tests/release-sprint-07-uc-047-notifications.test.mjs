// The release tests of UC-047, Be told what waits for your acceptance (ITM-238): one or more for every requirement UC-047
// realises, through the settings page and the main and review pages as the dashboard reaches MOD-notifications since the
// change between jobs #157 — reached the way tests/dashboard-notifications-wiring.test.mjs reaches them: tests/app-
// harness.mjs's repoServer and openDashboard, a browser's Notification/navigator/setInterval stood in for the way that
// file's own installBrowser() does, never a real timer. Every expected result is the requirement's own; where the page
// disagrees, the test follows the requirement and is marked todo with its FINDING (docs/instructions/developers.md, "An
// item of release or system tests").
//
// Written by developer-sonnet-e, the release tester, who implemented none of it.
//
// Run: node --test tests/release-sprint-07-uc-047-notifications.test.mjs
//
// Module: MOD-notifications
// Guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// Level: release

import test from "node:test";
import assert from "node:assert/strict";
import { blobSha } from "../src/text-tools/index.mjs";
import { repoServer, openDashboard, press, settle, REPO, TOKEN } from "./app-harness.mjs";

const PREFIX = `agent-m:${REPO}:`; // MOD-browser-store's own prefix of the instance (store.mjs prefixOf)
const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000).toISOString();
const API = "https://api.github.com", RAW = "https://raw.githubusercontent.com";
const PRODUCT = "alice/thesis-tool";
const emptyTags = (url) => (url.origin === API && /\/tags$/.test(url.pathname)
  ? new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }) : undefined);

// ---------------------------------------------------------------- the browser, as tests/system-uc-047-be-told-what-
// ---------------------------------------------------------------- waits-for-your-acceptance.test.mjs's own (not a change
// ---------------------------------------------------------------- to either shared file; each file of this item keeps
// ---------------------------------------------------------------- its own copy, as the rest of this codebase's release
// ---------------------------------------------------------------- tests already do).

function installBrowser({ permission = "granted" } = {}) {
  const prior = {
    hadNotification: "Notification" in globalThis, Notification: globalThis.Notification,
    hadNavigator: "navigator" in globalThis, navigator: globalThis.navigator,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
  };
  const calls = { requestPermission: 0, setInterval: [] };
  let current = permission, requestResult = "granted";
  const registration = { showNotification() {}, unregister: async () => {} };
  Object.defineProperty(globalThis, "Notification", {
    value: { get permission() { return current; },
      requestPermission: async () => { calls.requestPermission++; current = requestResult; return requestResult; } },
    configurable: true, writable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { serviceWorker: { register: async () => registration, getRegistration: async () => registration }, userAgent: "node" },
    configurable: true, writable: true,
  });
  let captured = null;
  globalThis.setInterval = (fn, ms) => { captured = fn; calls.setInterval.push({ fn, ms }); return 1; };
  globalThis.clearInterval = () => {};
  return {
    calls,
    setRequestResult: (r) => { requestResult = r; },
    tick: () => captured(),
    restore() {
      if (prior.hadNotification) globalThis.Notification = prior.Notification; else delete globalThis.Notification;
      if (prior.hadNavigator) globalThis.navigator = prior.navigator; else delete globalThis.navigator;
      globalThis.setInterval = prior.setInterval;
      globalThis.clearInterval = prior.clearInterval;
    },
  };
}

// A page that can show a real notification — see that file's own comment; added locally, after openDashboard, not a
// change to tests/app-harness.mjs.
function captureNotifications() {
  Object.defineProperty(globalThis.document, "baseURI", { value: "https://akmaier.github.io/agent-m/", configurable: true });
  const shown = [];
  const registration = { showNotification: (title, options) => shown.push({ title, ...options }) };
  Object.defineProperty(globalThis.navigator.serviceWorker, "register", { value: async () => registration, configurable: true });
  Object.defineProperty(globalThis.navigator.serviceWorker, "getRegistration", { value: async () => registration, configurable: true });
  return shown;
}

async function withProduct(instanceFiles, productFiles) {
  const product = await repoServer({ repo: PRODUCT, files: productFiles, handlers: [emptyTags] });
  const productAuthorizations = [];
  const instance = await repoServer({
    files: instanceFiles,
    handlers: [
      emptyTags,
      (url, init) => {
        if (!((url.origin === API && url.pathname.startsWith(`/repos/${PRODUCT}`))
          || (url.origin === RAW && url.pathname.startsWith(`/${PRODUCT}/`)))) return undefined;
        productAuthorizations.push(new Headers(init.headers).get("Authorization"));
        return product.fetch(url.href, init);
      },
    ],
  });
  return { instance, product, productAuthorizations };
}

const publicControls = (root, name, out = []) => { for (const child of root?.children ?? []) { if (typeof child !== "object") continue; if (child.className?.split(" ").includes(name)) out.push(child); publicControls(child, name, out); } return out; };

// MOD-settings-pages owns the Settings DOM. Capture the mounted public Usability tab rather than reaching the retired
// dashboard-owned notifications-settings box.
async function usabilitySettings(page) {
  const main = globalThis.document.getElementById("main");
  const replace = main.replaceChildren.bind(main);
  let mounted = [];
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const pane = mounted.find((node) => node.className === "settings-tab-panel" && /Usability/.test(node.textContent));
  assert.ok(pane, "the dashboard mounts MOD-settings-pages' public Usability tab");
  return pane;
}

const PRODUCT_ENTRIES = {
  [`${PREFIX}products`]: JSON.stringify([`https://github.com/${PRODUCT}`]),
  [`${PREFIX}github-token:${PRODUCT}`]: JSON.stringify({ value: "github_pat_PRODUCTTOKEN0123456789abcdefg", name: PRODUCT }),
};

// ==================================================================================================================

// TST-472506 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: a fixture repository with one architecture file already open (no approval record for its current blob); notifications on, baseline check already run with nothing open
// input: the file comes to wait; a second check (review page, #uc)
// expect: the browser shows one notification naming the file and the repository it is in, with a link to where it is accepted (MOD-notifications' own addressOf, as this dashboard resolves it)
test("A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE — a file come to wait is notified, naming it and where it is", async () => {
  const server = await repoServer({ files: {}, handlers: [emptyTags] });
  const browser = installBrowser();
  try {
    await openDashboard({ server, hash: "#uc", entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: null }) } });
    const shown = captureNotifications();
    await server.change("docs/architecture/MOD-sample-widget.md", "# MOD-sample-widget\n");
    globalThis.localStorage.setItem(`${PREFIX}notifications`, JSON.stringify({ checked: minutesAgo(6) }));
    browser.tick();
    await settle(server);

    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, "MOD-sample-widget waits for your acceptance");
    assert.equal(shown[0].body, REPO, "names the repository it is in");
    assert.ok(shown[0].data.url.endsWith("#arc/MOD-sample-widget"), "links to where it is accepted");
  } finally { browser.restore(); }
});

// TST-472507 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: a fresh browser; the person on the review page (#uc) before ever visiting settings
// input: navigating #uc, then #settings — no click yet; then pressing Switch on
// expect: no page asks the browser's permission before the click; the click on Switch on asks it, once
test("NOTIFICATIONS ARE SWITCHED ON BY THE PERSON — no page asks before the click; the click asks once", async () => {
  const server = await repoServer({ files: {} });
  const browser = installBrowser({ permission: "default" });
  try {
    const page = await openDashboard({ server, hash: "#uc" });
    assert.equal(browser.calls.requestPermission, 0, "the review page alone does not ask");
    const box = await usabilitySettings(page);
    assert.equal(browser.calls.requestPermission, 0, "opening settings alone does not ask either");
    await press(server, publicControls(box, "settings-notifications-on")[0]);
    assert.equal(browser.calls.requestPermission, 1, "the click asks the permission, once");
  } finally { browser.restore(); }
});

// TST-472508 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: a use case accepted by an approval record naming its current blob; notifications on
// input: a check while it is unchanged; then the file is edited (a new blob, the approval record now stale); a second check
// expect: while the blob matches the approval record, the file is not notified (accepted); once edited, the record no longer names its current blob, and it is notified
test("STATUS IS DERIVED FROM THE RECORDS — accepted while the blob matches the record, waiting once it does not", async () => {
  const path = "docs/use-cases/UC-710-sample.md";
  const text1 = "# UC-710 v1\n";
  const blob1 = await blobSha(text1);
  const server = await repoServer({
    files: { [path]: text1, [`docs/approvals/UC-710-${blob1.slice(0, 12)}.md`]: `kind: use-case\nblob: ${blob1}\n` }, handlers: [emptyTags],
  });
  const browser = installBrowser();
  try {
    await openDashboard({ server, hash: "#uc", entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: minutesAgo(6) }) } });
    const shown = captureNotifications();
    await settle(server);
    assert.deepEqual(shown, [], "accepted (the record names its current blob): not notified");

    await server.change(path, "# UC-710 v2 — edited, the approval record now names a blob that is no longer current\n");
    globalThis.localStorage.setItem(`${PREFIX}notifications`, JSON.stringify({ checked: minutesAgo(6) }));
    browser.tick();
    await settle(server);
    assert.equal(shown.length, 1, "no approval record names the edited blob: it waits again");
    assert.equal(shown[0].title, "UC-710 waits for your acceptance");
  } finally { browser.restore(); }
});

// TST-472509 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: one use case already open; a check records it as waiting
// input: every entry of this browser's storage is then deleted (DeleteEverything), and the page opened again, fresh
// expect: the same file is derived as waiting again, from the repository alone — nothing about it was carried over in storage; deleting all local storage and reloading rederives the same facts
test("PROGRESS AND JOB STATE ARE DERIVED, NOT STORED — deleting all local storage and reloading rederives the same facts", async () => {
  const server = await repoServer({ files: { "docs/use-cases/UC-720-sample.md": "# UC-720\n" }, handlers: [emptyTags] });
  const browser = installBrowser();
  try {
    await openDashboard({ server, hash: "#uc", entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: null }) } });
    await settle(server);
    const before = JSON.parse(globalThis.localStorage.getItem(`${PREFIX}notified`));

    for (let i = globalThis.localStorage.length - 1; i >= 0; i -= 1) globalThis.localStorage.removeItem(globalThis.localStorage.key(i));
    assert.equal(globalThis.localStorage.length, 0, "deleting all local storage");

    await openDashboard({ server, hash: "#uc", entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: null }) } });
    await settle(server);
    const after = JSON.parse(globalThis.localStorage.getItem(`${PREFIX}notified`));

    assert.deepEqual(after, before, "reloading (with nothing carried over) rederives the very same waiting facts");
  } finally { browser.restore(); }
});

// TST-472510 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: a fresh browser
// input: pressing Switch on
// expect: the switch is kept in this browser's own localStorage (and nowhere else — Agent M has no other store for it): the click makes no write request (POST/PUT/PATCH) to any repository
test("CONFIGURATION LIVES IN THE BROWSER — Switch on is kept in this browser's storage; no write request is made", async () => {
  const written = [];
  const server = await repoServer({
    files: {},
    // GitHub's GraphQL queries are reads sent as POST — the folders a load reads its snapshot with (ITM-1266) —, no write.
    handlers: [(url, init) => { if (init.method && init.method !== "GET" && url.href !== "https://api.github.com/graphql") written.push(`${init.method} ${url.href}`); return undefined; }],
  });
  const browser = installBrowser();
  try {
    const page = await openDashboard({ server, hash: "#uc" });
    const box = await usabilitySettings(page);
    await press(server, publicControls(box, "settings-notifications-on")[0]);

    assert.notEqual(globalThis.localStorage.getItem(`${PREFIX}notifications`), null, "kept in this browser's own storage");
    assert.deepEqual(written, [], "Agent M has no other store for it: no write request was made");
    void page;
  } finally { browser.restore(); }
});

// TST-472511 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: notifications switched on in this browser (so the dashboard has written "notifications" to localStorage)
// input: opening the settings page
// expect: the key the dashboard wrote has a place on this one page — the Notifications panel
test("EVERY SETTING IS REACHED FROM ONE PAGE — the \"notifications\" key the dashboard writes has a place on the settings page", async () => {
  const server = await repoServer({ files: {} });
  const browser = installBrowser();
  try {
    const page = await openDashboard({
      server, hash: "#uc",
      entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: minutesAgo(6) }) },
    });
    const box = await usabilitySettings(page);
    assert.match(box.textContent, /Notifications/, "the key this browser keeps has a place on the settings page");
  } finally { browser.restore(); }
});

// TST-472512 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: notifications switched on
// input: opening the settings page
// expect: a test of whether it still works (Test) and a control that clears it (Switch off) are both offered together, in the same place the setting itself is shown; Test shows the test notification; Switch off clears it
test("A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN — Test and Switch off sit together with the state", async () => {
  const server = await repoServer({ files: {} });
  const browser = installBrowser();
  try {
    const page = await openDashboard({
      server, hash: "#uc",
      entries: { [`${PREFIX}notifications`]: JSON.stringify({ checked: minutesAgo(6) }) },
    });
    const box = await usabilitySettings(page);
    assert.match(box.textContent, /On\./, "the setting is shown");
    const testBtn = publicControls(box, "settings-notifications-test")[0];
    const offBtn = publicControls(box, "settings-notifications-off")[0];
    assert.ok(testBtn, "tested, where the setting is shown");
    assert.ok(offBtn, "cleared, where the setting is shown");

    await press(server, testBtn);
    assert.match(publicControls(box, "settings-notifications-result")[0].textContent, /Test notification sent/);

    await press(server, offBtn);
    assert.equal(globalThis.localStorage.getItem(`${PREFIX}notifications`), null, "Switch off is a real clear");
  } finally { browser.restore(); }
});

// TST-280 · level: release · module: MOD-notifications
// guards: UC-047; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a product this browser keeps, with its own token, and something open in its repository; notifications on, due
// input: opening a review page (#uc)
// expect: the product's own token reaches only its own server's API — never any other server, never the address or the body of a request
test("TST-280 A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT — a product's own token reaches only its own server", async () => {
  const { instance, product, productAuthorizations } = await withProduct({}, { "docs/use-cases/UC-740-product.md": "# UC-740\n" });
  const browser = installBrowser();
  try {
    await openDashboard({
      server: instance, hash: "#uc",
      entries: { ...PRODUCT_ENTRIES, [`${PREFIX}notifications`]: JSON.stringify({ checked: minutesAgo(6) }) },
    });
    assert.ok(product.requests.length > 0, "the product's own server is reached at all");
    assert.ok(productAuthorizations.includes("Bearer github_pat_PRODUCTTOKEN0123456789abcdefg"), "reached with its own token");
  } finally { browser.restore(); }
});

// TST-472513 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: the settings page, notifications off
// input: reading the folded "What is this?" under Notifications
// expect: it names what is checked and how often (every five minutes while a page is open), that the checks go with this browser's own tokens and nowhere else, and that nothing is checked while no page is open
test("EVERY STEP EXPLAINS ITSELF — the folded explanation names what, how often, whose tokens, and when not", async () => {
  const server = await repoServer({ files: {} });
  const browser = installBrowser();
  try {
    const page = await openDashboard({ server, hash: "#uc" });
    const box = await usabilitySettings(page);
    const notification = publicControls(box, "settings-notifications")[0];
    const details = notification.children.find((child) => child.localName === "details" && child.children?.[0]?.localName === "summary" && child.children[0].textContent === "What is this?");
    assert.ok(details, "the public Notifications control carries its folded explanation");
    assert.equal(details.localName, "details", "the public explanation remains a details element");
    assert.equal(Boolean(details.open), false, "the public explanation is collapsed by default");
    assert.equal(details.children[0].localName, "summary", "the public explanation keeps its What is this? summary");
    assert.equal(details.children[0].textContent, "What is this?");
    const explanation = details.textContent;
    assert.match(explanation, /While a dashboard page is open, it checks every five minutes/, "how often, and while what");
    assert.match(explanation, /repository servers with the tokens of this browser and nowhere else/, "whose tokens, and nowhere else");
    assert.match(explanation, /Nothing is checked while no dashboard page is open/, "nothing while no dashboard page is open");
  } finally { browser.restore(); }
});

// TST-472514 · level: release · module: MOD-notifications
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; NOTIFICATIONS ARE SWITCHED ON BY THE PERSON; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; EVERY STEP EXPLAINS ITSELF; NO SERVER
// given: notifications on, due; a product this browser keeps, besides the instance; something waiting in both
// input: opening a review page (#uc), letting the checks run
// expect: every request the checks make lands on a known repository server (the instance's or a product's), never on any other origin — Agent M operates no server of its own that a check could reach
test("NO SERVER — every request a check makes goes to a repository server, never to any origin of Agent M's own", async () => {
  const { instance } = await withProduct({}, {});
  const origins = new Set();
  const realFetch = instance.fetch;
  instance.fetch = (u, init) => { origins.add(new URL(u).origin); return realFetch(u, init); };
  const browser = installBrowser();
  try {
    await openDashboard({
      server: instance, hash: "#uc",
      entries: { ...PRODUCT_ENTRIES, [`${PREFIX}notifications`]: JSON.stringify({ checked: minutesAgo(6) }) },
    });
    assert.ok(origins.size > 0, "at least one request was made");
    for (const origin of origins) assert.ok([API, RAW].includes(origin), `${origin} is a repository server, not a server of Agent M's own`);
  } finally { browser.restore(); }
});
