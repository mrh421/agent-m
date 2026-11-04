// MOD-settings-pages' route `setup` — finishing the setup of an instance in this browser (UC-014 steps 6 to 8 and 7a), as docs/architecture/MOD-settings-pages.md states it:
// "then *Finish setting up*: the prefilled token page, *Only select repositories* and the instance named, the shared-origin notice with its tick, the token and its expiry,
// *Store and check*, and *Import settings* beside it". The route is rendered into a fixture DOM (the document of tests/settings-pages-harness.mjs, with the part of a browser that the frame's explain needs, and the helpers of tests/settings-pages-setup.d/dom.mjs); the
// token page's address is MOD-repository-hosts' own prefilled link; the instance is read through MOD-repository-hosts' connect and repositoryInfo over a fake of fetch that
// records every request and answers the status a case names; this browser's store is MOD-browser-store's own over a fake localStorage. Nothing reaches the network.
// Run: node --test tests/settings-pages-setup.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-014; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; ONE GITHUB TOKEN SERVES EVERY FEATURE; A TOKEN IS SCOPED TO WHAT IT WRITES; EVERY STEP EXPLAINS ITSELF; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A FORM OPENS WITH ITS FIRST FIELD FOCUSED; CONFIGURATION LIVES IN THE BROWSER
// Level: unit
//
// This is the module's own statement of the behaviour that TST-474029 to TST-474032 (tests/dashboard-review-flows.test.mjs) state of the live app; those run the live app and are not
// this file's. Each test states its input and its expected result in its own text before it runs (given / input / expect); no expected value is read from a document. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byClass, byTag } from "./settings-pages-harness.mjs";
import { attachedTarget, buttonLabelled, press, tick, untick, freshStore, storedKeys, contextOf, withServer } from "./settings-pages-setup.d/dom.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { explain } = await import("../src/site-frame/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "setup");

const REPO = "akmaier/agent-m";
const API_REPO = "https://api.github.com/repos/akmaier/agent-m";
const KEY = "github_pat_MINE0123456789abcdefghijkl";
const TOKEN_NAME = "Agent M · akmaier/agent-m";
const ACK_KEY = "agent-m:akmaier/agent-m:acknowledged:shared-origin";
const TOKEN_KEY = "agent-m:akmaier/agent-m:github-token";
const NOTICE = "Everything Agent M stores in this browser is stored for the address https://akmaier.github.io — every GitHub Pages site under that same akmaier.github.io domain can read it.";
const NO_TOKEN = "Nothing was stored: the token under github-token is refused. That is no token of either server.";
const GITLAB_TOKEN_LINE = "Nothing was stored: the token under github-token is refused. That is a GitLab token; a GitHub repository is reached with the GitHub token.";
const NO_DATE = "Enter the date the token expires — GitHub showed it when you created the token.";
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function open({ acknowledged = false, extra = {} } = {}) {
  const store = freshStore();
  if (acknowledged) globalThis.localStorage.setItem(ACK_KEY, JSON.stringify("2026-10-01"));
  for (const [key, value] of Object.entries(extra)) globalThis.localStorage.setItem(`agent-m:${REPO}:${key}`, JSON.stringify(value));
  const context = contextOf(store);
  const target = attachedTarget();
  await route.render(target, context, {});
  return { target, context };
}
const stepTitled = (target, prefix) => byClass(target, "step").find((step) => byTag(step, "h3")[0]?.textContent.startsWith(prefix));
const field = (target, className) => byClass(target, className)[0];
const reachable = (priv) => () => ({ status: 200, body: { private: priv, default_branch: "main", permissions: { push: true } } });
async function storeAs(page, token, expires, answer) {
  const { target } = page;
  await tick(field(target, "ack"));
  field(target, "token").value = token;
  field(target, "expires").value = expires;
  return withServer(answer, () => press(buttonLabelled(target, "Store and check")));
}

// TST-588001 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; ONE GITHUB TOKEN SERVES EVERY FEATURE
// given: a fresh store; the instance akmaier/agent-m; no token
// input: render the route `setup`
// expect: the page is headed "Finish setting up your instance" and holds the steps "Step A · Create your key on GitHub" and "Step B · Give the key to Agent M"; Step A's link opens GitHub's page for a new fine-grained token with exactly the name "Agent M · akmaier/agent-m", the description "Agent M dashboard of akmaier/agent-m: commits, issues, pull requests and runs of the work you start.", the owner akmaier, 90 days and the permissions contents, issues, pull_requests, actions and workflows write and metadata read; beneath it the three instructions: choose Only select repositories, pick akmaier/agent-m — nothing else, press Generate token and copy it
test("setup — Step A links GitHub's prefilled token page and spells out Only select repositories and the instance", async () => {
  const { target } = await open();
  assert.equal(byTag(target, "h2")[0].textContent, "Finish setting up your instance");
  const a = stepTitled(target, "Step A · Create your key on GitHub");
  assert.ok(a, "Step A stands on the page");
  assert.ok(stepTitled(target, "Step B · Give the key to Agent M"), "Step B stands on the page");
  const link = byTag(a, "a").find((anchor) => anchor.textContent === "Open GitHub's token page (prefilled) ↗");
  assert.ok(link, "Step A holds the link");
  const url = new URL(link.href);
  assert.equal(url.origin + url.pathname, "https://github.com/settings/personal-access-tokens/new");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    name: "Agent M · akmaier/agent-m",
    description: "Agent M dashboard of akmaier/agent-m: commits, issues, pull requests and runs of the work you start.",
    target_name: "akmaier", expires_in: "90",
    contents: "write", issues: "write", pull_requests: "write", actions: "write", workflows: "write", secrets: "write", metadata: "read",
  });
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener");
  assert.deepEqual(byTag(byClass(a, "choices")[0], "li").map((item) => item.textContent), [
    "Under \"Repository access\" choose \"Only select repositories\" — GitHub preselects \"All repositories\", which would give Agent M write access to everything you own.",
    "Open \"Select repositories\" and pick \"akmaier/agent-m\" — nothing else.",
    "Press \"Generate token\" and copy the token GitHub now shows — it starts with github_pat_ and is shown only once.",
  ]);
});

// TST-588002 · level: unit · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: a fresh store; the instance akmaier/agent-m; known positive — explain("repository") is a folded details of class explain
// input: render the route `setup`; read the folded explanations
// expect: exactly three <details class="explain">, all folded, none built by the route. Step A holds two, in this order: first the frame's explain("setup-key") under the summary "What is this?", then the frame's explain("setup-key-permissions", "Why these?") under the summary "Why these?". Step B holds one: the frame's explain("setup-store") under the summary "What is this?". Each of the three topics is a non-empty folded details of the frame
test("setup — Step A carries the frame's What is this? for setup-key and its Why these? for setup-key-permissions, Step B the What is this? for setup-store", async () => {
  assert.equal(explain("repository").localName, "details", "known positive: the frame gives a folded explanation for a topic it holds");
  for (const topic of ["setup-key", "setup-key-permissions", "setup-store"]) {
    const given = explain(topic);
    assert.equal(given.localName, "details", `the frame holds the topic ${topic}`);
    assert.ok(given.textContent.length > "What is this?".length, `the topic ${topic} has a body`);
  }
  const { target } = await open();
  const folded = byTag(target, "details");
  assert.equal(folded.length, 3, "two in Step A, one in Step B");
  const [a, b] = ["Step A", "Step B"].map((prefix) => byTag(stepTitled(target, prefix), "details"));
  assert.deepEqual([a.length, b.length], [2, 1]);
  const expected = [[a[0], "setup-key", "What is this?"], [a[1], "setup-key-permissions", "Why these?"], [b[0], "setup-store", "What is this?"]];
  for (const [found, topic, label] of expected) {
    const given = explain(topic, label);
    assert.equal(found.className, "explain");
    assert.equal(found.hasAttribute("open"), false, "folded");
    assert.equal(byTag(found, "summary")[0].textContent, label, `the fold of ${topic} reads ${label}`);
    assert.equal(found.innerHTML, given.innerHTML, `it is the frame's explanation of ${topic}`);
  }
});

// TST-588003 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE SHARED PAGES ORIGIN IS DISCLOSED; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: a fresh store without an acknowledgement
// input: render the route `setup`; press Import settings
// expect: Step B states "Everything Agent M stores in this browser is stored for the address https://akmaier.github.io — every GitHub Pages site under that same akmaier.github.io domain can read it."; the box "I have read this." is not ticked and has the focus; the token field, the expiry field and Store and check are disabled; the expiry is preset to 90 days from today; Store and check names where it sends; Import settings stands in the same paragraph as Store and check, and pressing it goes to the route settings and stores nothing
test("setup — Step B shows the shared-origin notice with its box unticked and focused, the fields shut, the expiry at 90 days, and Import settings beside Store and check", async () => {
  const { target, context } = await open();
  const b = stepTitled(target, "Step B · Give the key to Agent M");
  assert.ok(byClass(b, "notice").some((notice) => notice.textContent === NOTICE), "the notice stands in Step B");
  const ack = field(target, "ack");
  assert.equal(ack.checked, false);
  assert.equal(document.activeElement, ack, "the focus is on the first open field: the box to tick");
  assert.equal(field(target, "token").disabled, true);
  assert.equal(field(target, "expires").disabled, true);
  assert.equal(buttonLabelled(target, "Store and check").disabled, true);
  assert.equal(field(target, "expires").value, inDays(90));
  assert.equal(field(target, "token").type, "password");
  assert.match(b.textContent, /Store and check sends the token to GitHub's API, to read akmaier\/agent-m, and nowhere else\./);
  const imp = buttonLabelled(target, "Import settings");
  assert.ok(imp, "Import settings is there");
  assert.equal(imp.parentNode, buttonLabelled(target, "Store and check").parentNode, "beside Store and check");
  await press(imp);
  assert.deepEqual(context.went, [["settings", {}]]);
  assert.deepEqual(storedKeys(), []);
});

// TST-588004 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE SHARED PAGES ORIGIN IS DISCLOSED; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: a fresh store without an acknowledgement
// input: tick I have read this; then untick it
// expect: on the tick the acknowledgement is stored under acknowledged:shared-origin as a date YYYY-MM-DD, the token field, the expiry field and Store and check open, and the focus moves to the token field; on the untick the entry is removed from localStorage and the three are shut again
test("setup — ticking the notice stores its acknowledgement and opens the fields; unticking removes it and shuts them", async () => {
  const { target } = await open();
  const ack = field(target, "ack");
  await tick(ack);
  assert.deepEqual(storedKeys(), [ACK_KEY]);
  assert.match(JSON.parse(globalThis.localStorage.getItem(ACK_KEY)), /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual([field(target, "token").disabled, field(target, "expires").disabled, buttonLabelled(target, "Store and check").disabled], [false, false, false]);
  assert.equal(document.activeElement, field(target, "token"));
  await untick(ack);
  assert.deepEqual(storedKeys(), []);
  assert.deepEqual([field(target, "token").disabled, field(target, "expires").disabled, buttonLabelled(target, "Store and check").disabled], [true, true, true]);
});

// TST-588005 · level: unit · module: MOD-settings-pages
// guards: UC-014; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: a store that holds the acknowledgement of the shared-origin notice
// input: render the route `setup`
// expect: the box is ticked, the token field, the expiry field and Store and check are open, and the focus is on the token field
test("setup — with the notice already acknowledged the page opens with its box ticked, the fields open and the focus on the token field", async () => {
  const { target } = await open({ acknowledged: true });
  assert.equal(field(target, "ack").checked, true);
  assert.deepEqual([field(target, "token").disabled, field(target, "expires").disabled, buttonLabelled(target, "Store and check").disabled], [false, false, false]);
  assert.equal(document.activeElement, field(target, "token"));
});

// TST-588006 · level: unit · module: MOD-settings-pages
// guards: UC-014; CONFIGURATION LIVES IN THE BROWSER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A TOKEN IS SCOPED TO WHAT IT WRITES
// given: a fresh store, the notice ticked, a public repository akmaier/agent-m that the server answers with its default branch main
// input: paste the token github_pat_MINE0123456789abcdefghijkl, set the expiry 2027-01-15, press Store and check
// expect: localStorage holds exactly the acknowledgement and github-token, the latter { value: the pasted token, name: "Agent M · akmaier/agent-m", expires: "2027-01-15", stored: today }; the token field is emptied; exactly two requests are sent, the read-only POST of https://api.github.com/graphql for greenToMerge (ITM-1170) and, with it, a GET of https://api.github.com/repos/akmaier/agent-m, each carrying "Bearer " and the token; the check line reads "✓ akmaier/agent-m reachable — public, so write access is confirmed only by the first write"; the page offers "Your instance is ready →" and "+ Add a product"; nothing is written to the server
test("setup — Store and check keeps the token and its expiry in this browser, reads the instance with it, and shows the instance ready", async () => {
  const page = await open();
  const requests = await storeAs(page, KEY, "2027-01-15", reachable(false));
  assert.deepEqual(storedKeys(), [ACK_KEY, TOKEN_KEY]);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)), { value: KEY, name: TOKEN_NAME, expires: "2027-01-15", stored: today() });
  assert.equal(field(page.target, "token").value, "");
  // ITM-1170: beside the repository's record, the read-only GraphQL request of greenToMerge, to the same server with the same token.
  assert.deepEqual(requests, [{ url: "https://api.github.com/graphql", method: "POST", authorization: `Bearer ${KEY}` }, { url: API_REPO, method: "GET", authorization: `Bearer ${KEY}` }]);
  assert.equal(field(page.target, "check").textContent, "✓ akmaier/agent-m reachable — public, so write access is confirmed only by the first write");
  assert.deepEqual(byTag(field(page.target, "done"), "button").map((button) => button.textContent), ["Your instance is ready →", "+ Add a product"]);
});

// TST-588007 · level: unit · module: MOD-settings-pages
// guards: UC-014; A TOKEN IS SCOPED TO WHAT IT WRITES
// given: a fresh store, the notice ticked, a private repository akmaier/agent-m
// input: paste a token and press Store and check
// expect: the check line reads "✓ akmaier/agent-m reachable" and nothing more, and the instance is shown ready
test("setup — a private instance is reported reachable without the note on public repositories", async () => {
  const page = await open();
  await storeAs(page, KEY, "2027-01-15", reachable(true));
  assert.equal(field(page.target, "check").textContent, "✓ akmaier/agent-m reachable");
  assert.equal(byTag(field(page.target, "done"), "button").length, 2);
});

// TST-588008 · level: unit · module: MOD-settings-pages
// guards: UC-014; ONE CLICK PER DECISION
// given: the instance shown ready after Store and check
// input: press "Your instance is ready →"; then press "+ Add a product"
// expect: the first goes to the page main, the second to the route add-product, each once and with no parameters
test("setup — the ready buttons lead to the main page and to Add a product", async () => {
  const page = await open();
  await storeAs(page, KEY, "2027-01-15", reachable(false));
  const [ready, add] = byTag(field(page.target, "done"), "button");
  await press(ready);
  await press(add);
  assert.deepEqual(page.context.went, [["main", {}], ["add-product", {}]]);
});

// TST-588009 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE GITHUB TOKEN IS PASTED, NOT OBTAINED BY LOGIN
// given: a fresh store, the notice ticked
// input: paste the text "my password" and press Store and check
// expect: nothing is stored but the acknowledgement; no request is sent; the check line reads "Nothing was stored: the token under github-token is refused. That is no token of either server." — connect's refusal, setup keeping no form of a token of its own; the instance is not shown ready
test("setup — a text that is no GitHub token is refused: nothing is stored, nothing is sent", async () => {
  const page = await open();
  const requests = await storeAs(page, "my password", "2027-01-15", reachable(false));
  assert.deepEqual(storedKeys(), [ACK_KEY]);
  assert.deepEqual(requests, []);
  assert.equal(field(page.target, "check").textContent, NO_TOKEN);
  assert.equal(byTag(field(page.target, "done"), "button").length, 0);
});

// TST-588010 · level: unit · module: MOD-settings-pages
// guards: UC-014; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE
// given: a fresh store, the notice ticked
// input: paste a GitHub token, empty the expiry date and press Store and check
// expect: nothing is stored but the acknowledgement; no request is sent; the check line reads "Enter the date the token expires — GitHub showed it when you created the token."
test("setup — a token without an expiry date is refused: nothing is stored, nothing is sent", async () => {
  const page = await open();
  const requests = await storeAs(page, KEY, "", reachable(false));
  assert.deepEqual(storedKeys(), [ACK_KEY]);
  assert.deepEqual(requests, []);
  assert.equal(field(page.target, "check").textContent, NO_DATE);
});

// TST-588011 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE SHARED PAGES ORIGIN IS DISCLOSED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a fresh store, the notice not ticked, a valid token typed into the (shut) field
// input: press Store and check
// expect: nothing is stored, no request is sent, and the check line stays empty
test("setup — without the notice ticked, pressing Store and check stores nothing and sends nothing", async () => {
  const { target } = await open();
  field(target, "token").value = KEY;
  field(target, "expires").value = "2027-01-15";
  const requests = await withServer(reachable(false), () => press(buttonLabelled(target, "Store and check")));
  assert.deepEqual(storedKeys(), []);
  assert.deepEqual(requests, []);
  assert.equal(field(target, "check").textContent, "");
});

// TST-588012 · level: unit · module: MOD-settings-pages
// guards: UC-014; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: a fresh store, the notice ticked, a server that answers 401 to the token
// input: paste a token and press Store and check
// expect: the token stays stored as pasted; the check line reads "✗ akmaier/agent-m: GitHub rejected authentication with your Agent M · akmaier/agent-m. Renew it on https://github.com/settings/personal-access-tokens."; the instance is not shown ready
test("setup — a token the server refuses is named with its renewal page, and the instance is not shown ready", async () => {
  const page = await open();
  await storeAs(page, KEY, "2027-01-15", () => ({ status: 401, body: { message: "Bad credentials" } }));
  assert.equal(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)).value, KEY);
  assert.equal(field(page.target, "check").textContent,
    "✗ akmaier/agent-m: GitHub rejected authentication with your Agent M · akmaier/agent-m. Renew it on https://github.com/settings/personal-access-tokens.");
  assert.equal(byTag(field(page.target, "done"), "button").length, 0);
});

// TST-588013 · level: unit · module: MOD-settings-pages
// guards: UC-014; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a store that holds a token with the record of a test of it, and the acknowledgement
// input: paste a new token and press Store and check
// expect: the record of the last test is gone, since the new token has not been tested before; the token is the new one
test("setup — storing a new token forgets the last test of the one before", async () => {
  const page = await open({ acknowledged: true, extra: {
    "github-token": { value: "github_pat_OLD0123456789abcdefghijkl", name: "old", expires: "2026-12-01", stored: "2026-09-01" },
    "last-test:github-token": { at: "2026-09-02T10:00:00.000Z", outcome: "working" },
  } });
  field(page.target, "token").value = KEY;
  field(page.target, "expires").value = "2027-01-15";
  await withServer(reachable(false), () => press(buttonLabelled(page.target, "Store and check")));
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"), null);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)).value, KEY);
});

// TST-588014 · level: unit · module: MOD-settings-pages
// guards: UC-014
// given: the view of MOD-settings-pages
// input: read its routes
// expect: exactly one route is named setup; it stands under the menu entry settings and is titled "Finish setting up your instance"
test("setup — the module's view holds one route setup, under the entry settings", () => {
  const found = view.routes.filter((candidate) => candidate.name === "setup");
  assert.equal(found.length, 1);
  assert.equal(found[0].entry, "settings");
  assert.equal(found[0].title, "Finish setting up your instance");
  assert.equal(typeof found[0].render, "function");
});

// TST-1021001 · level: unit · module: MOD-settings-pages
// guards: UC-014; NO SECRET IN THE REPOSITORY; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a store that holds a token with the record of a test of it, and the acknowledgement; the instance is a GitHub repository
// input: paste a GitLab token (glpat-…) as the instance's token and press Store and check
// expect: nothing is stored or forgotten — the token and the record of its last test stand as they were — no request leaves the page, and the page shows connect's refusal of the other kind of server, "Nothing was stored: the token under github-token is refused. That is a GitLab token; a GitHub repository is reached with the GitHub token.", which does not hold the pasted token. Known positive: a GitHub token pasted the same way is stored
test("setup — a token of the other kind of server is refused before it is stored, and the last test is kept", async () => {
  const WRONG = "glpat-WRONG0123456789abcdef";
  const OLD = { value: "github_pat_OLD0123456789abcdefghijkl", name: "old", expires: "2026-12-01", stored: "2026-09-01" };
  const TESTED = { at: "2026-09-02T10:00:00.000Z", outcome: "working" };
  const page = await open({ acknowledged: true, extra: { "github-token": OLD, "last-test:github-token": TESTED } });
  field(page.target, "token").value = WRONG;
  field(page.target, "expires").value = "2027-01-15";
  const requests = await withServer(reachable(false), () => press(buttonLabelled(page.target, "Store and check")));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)), OLD, "failure node: setup.mjs stores the pasted token before connect");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token")), TESTED);
  assert.deepEqual(requests, [], "nothing is sent for a token the page refuses");
  const shown = field(page.target, "check").textContent;
  assert.equal(shown, GITLAB_TOKEN_LINE);
  assert.equal(shown.includes(WRONG), false, "the line never holds the token");
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token").includes(WRONG), false);
  field(page.target, "token").value = KEY;
  await withServer(reachable(false), () => press(buttonLabelled(page.target, "Store and check")));
  assert.equal(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)).value, KEY, "known positive: a GitHub token is stored");
});

// TST-1065002 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE GITHUB TOKEN IS PASTED, NOT OBTAINED BY LOGIN
// given: a fresh store, the notice ticked; the instance is a GitHub repository
// input: paste the text github_pat_x, which begins as a GitHub token does and holds nothing more (setup keeps no length rule of its own), and press Store and check; then paste nothing and press it again
// expect: github_pat_x is stored as the instance's token and the instance is read with it; with nothing pasted nothing more is stored and no request is sent, and the check line reads "Paste the token first."
test("setup — a text that begins as a GitHub token does is stored whatever its length, and an empty paste is not a token", async () => {
  const page = await open({ acknowledged: true });
  await storeAs(page, "github_pat_x", "2027-01-15", reachable(false));
  assert.equal(JSON.parse(globalThis.localStorage.getItem(TOKEN_KEY)).value, "github_pat_x");
  const again = await open({ acknowledged: true });
  const requests = await storeAs(again, "", "2027-01-15", reachable(false));
  assert.equal(globalThis.localStorage.getItem(TOKEN_KEY), null);
  assert.deepEqual(requests, []);
  assert.equal(field(again.target, "check").textContent, "Paste the token first.");
});
