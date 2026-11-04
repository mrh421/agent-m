// MOD-site-frame starts the prompt bar (ITM-506): on the main and the review pages, never in the Bridge's window, startPage
// draws a footer after the route's main and starts MOD-prompt-bar's startPromptBar in it, once per page, with the store, the
// instance as the frame connected it, the chosen product, the subject of the route shown at each moment, explain and its
// navigation. A route may give `subject`; whichever gives it, its `entry` is the route's `entry`, null for a route out of the
// menu; a route that gives none has the frame's default subject.
//
// Run: node --test tests/site-frame-prompt-bar.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use
// case or an architecture file. The page is the small fixture DOM of tests/site-frame-start.d/dom.mjs. The real MOD-prompt-bar,
// MOD-job-runner, MOD-runtimes and the real GitHub host run as they are, over a fetch that answers the two repositories (the
// instance acme/instance, the product acme/widget) and a model endpoint from memory; nothing reaches the network. The one
// strategy of another module that the kind `converse` names, `chapters-for-page`, is a fixture that keeps the parameters of
// every message, so a test reads what the bar asked the subject for. The counter-proofs (a planted fault in src/site-frame/ and
// the test's failing result) are recorded in the pull request.
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - The bar stands in a <footer class="site-frame-prompt-bar"> after the route's <main>, on the main and the review pages only.
//   - The default subject's `key` is the route's fragment — its name with its parameters as the fragment writes them, without the
//     leading `#` — with the chosen product's address as the fragment writes it (`/product=<address>`), none for the instance:
//     MOD-prompt-bar's Subject says a key names the subject "so that a draft is shown only for the subject it was drafted on", and
//     the default page holds the product, so the same route on another product is another subject.
//   - The default subject's `page` is its lines joined by a line feed: the route's title, the menu entry's label (no line for a
//     route out of the menu), the chosen product's web address or the instance's web address, the route's textContent.
//   - The bar is drawn as a <section class="prompt-bar" data-page="..."> into the footer once this browser's endpoints are read.

import assert from "node:assert/strict";
import test from "node:test";
import { all, changeFragment, fixtureStorage, installPage } from "./site-frame-start.d/dom.mjs";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { subjectOf } from "../src/site-frame/subject.mjs";
import { until } from "./prompt-bar.d/until.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

const REVIEW = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const WIDGET = "https://github.com/acme/widget";
const encoded = (address) => encodeURIComponent(address);
const settle = () => new Promise((resolve) => setImmediate(resolve));
const settleLong = async () => { for (let at = 0; at < 40; at += 1) await settle(); };

// ---------------------------------------------------------------- the elements of the page

const walk = (root) => root.children.flatMap((child) => typeof child === "string" ? [] : [child, ...walk(child)]);
const byClass = (root, name) => walk(root).filter((node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];

// ---------------------------------------------------------------- the two repositories, the endpoint, the strategy

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const REGISTER = `# Participants of this instance\n\n${COLUMNS}\n| drafter-a | model endpoint | model-drafter-a | 200000 | — | draft text | Anthropic, USA | endpoint ep1 |\n`;
const FILES = {
  "acme/instance": { "docs/participants.md": REGISTER },
  "acme/widget": { "README.md": "# Widget\n" },
  "acme/gadget": { "README.md": "# Gadget\n" },
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Answers the API of github.com for the two repositories (one commit each, "c-<name>", on the branch main) and the model endpoint drafter-a
// with the draft `{ answer: "ok", edits: [docs/notes.md] }` — an edit, so that the answer is a draft to review. Every request is kept with its Authorization header.
let requests = [];
const seen = [];
registerStrategies("tests/site-frame-prompt-bar.test.mjs", { recipes: { "chapters-for-page": async (context, params) => { seen.push(params); return []; } } });
const realFetch = globalThis.fetch;
function installNetwork() {
  requests = [];
  seen.length = 0;
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    requests.push({ url: address, authorization: init?.headers?.Authorization ?? null, body: String(init?.body ?? "") });
    if (address === "https://models.example/v1/chat/completions") {
      return reply({ choices: [{ message: { content: JSON.stringify({ draft: { answer: "ok", edits: [{ path: "docs/notes.md", text: "# Notes\n" }] }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    const api = /^https:\/\/api\.github\.com\/repos\/(acme\/[a-z]+)(\/.*)?$/.exec(address);
    const files = api ? FILES[api[1]] : null;
    if (!files) return reply({ message: "Not Found" }, 404);
    const rest = api[2] ?? "";
    if (rest === "") return reply({ default_branch: "main", visibility: "public", private: false, permissions: { push: true }, archived: false, description: "" });
    if (rest.startsWith("/commits/")) return reply({ sha: `c-${api[1].split("/")[1]}` });
    if (rest.startsWith("/git/trees/")) return reply({ tree: Object.keys(files).map((path) => ({ type: "blob", path, sha: `b-${path}` })) });
    const file = /^\/contents\/([^?]+)/.exec(rest)?.[1];
    if (file && files[decodeURIComponent(file)] !== undefined) return new Response(files[decodeURIComponent(file)], { status: 200 });
    return reply({ message: "Not Found" }, 404);
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the routes, and a page

const rendered = [];
const route = (name, entry, over = {}) => ({ name, entry, title: `Title of ${name}`, async render(target, context, params) {
  rendered.push({ name, context, params });
  target.textContent = `${name} ${JSON.stringify(params)}`;
}, ...over });

// Starts a page on a fresh fixture, a browser that declares the endpoint drafter-a — its place, context and model, as the bar offers it (UC-049 1) —, the instance token github_pat_INSTANCE, the product
// https://github.com/acme/widget and its token github_pat_WIDGET.
async function start({ page = "review", fragment = "", views } = {}) {
  rendered.length = 0;
  installNetwork();
  const fixture = installPage({ ...REVIEW, hash: fragment });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: fixtureStorage() });
  globalThis.setInterval = () => 1;
  const store = openStore("acme/instance");
  writeSetting(store, "endpoint:drafter-a", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-drafter-a", key: "sk-fixture", place: "Anthropic, USA", context: 200000 });
  writeSetting(store, "github-token", { value: "github_pat_INSTANCE", name: "alice", expires: "2030-01-01" });
  writeSetting(store, "products", [WIDGET, "https://github.com/acme/gadget"]);
  writeSetting(store, "github-token:acme/gadget", { value: "github_pat_GADGET", name: "alice", expires: "2030-01-01" });
  writeSetting(store, "github-token:acme/widget", { value: "github_pat_WIDGET", name: "alice", expires: "2030-01-01" });
  await startPage({ page, views: [{ routes: views, strategies: [] }], menuViews: [] });
  const body = fixture.document.body;
  const footer = all(body, "footer").find((node) => node.className === "site-frame-prompt-bar") ?? null;
  return { ...fixture, body, store, footer, target: all(body, "main")[0] };
}
const drawn = async (page) => {
  assert.ok(page.footer, "the page has a footer of the prompt bar");
  await until(() => byClass(page.footer, "prompt-bar").length > 0, "the bar is drawn");
};
const participantReads = () => requests.filter((request) => request.url.includes("/contents/docs/participants.md"));

// The person writes `text` in the bar and presses Send; resolves once the message has run (the endpoint was asked and the bar is free).
async function sends(page, text) {
  const asked = requests.filter((request) => request.url === "https://models.example/v1/chat/completions").length;
  one(page.footer, "instruction").value = text;
  one(page.footer, "send").dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
  await until(() => requests.filter((request) => request.url === "https://models.example/v1/chat/completions").length === asked + 1
    && one(page.footer, "send").disabled === false, "the message has run");
}
const conversationOf = () => readTabValue(openStore("acme/instance"), "prompt-bar:conversation");

// TST-506001 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: a browser that declares the one endpoint drafter-a, and an instance whose participant list lists drafter-a; one view with the routes alpha (requirements) and beta (tests)
// input: startPage on the main page, then on the review page, each followed by two changes of the fragment; then on the bridge page
// expect: on the main and on the review page the children of the body are, in this order, header, section, main, the site footer (class site-footer) and the footer of the bar; the last has the class site-frame-prompt-bar and holds one section of class prompt-bar whose data-page is "main", then "review"; the participant list of the instance (docs/participants.md) was not read for the bar's offer (UC-049 1), and after the two changes of the fragment the footer holds that same section (the bar was not started again) and the list was still not read; on the bridge page the children of the body are header, section, main, there is no footer and the register was not read
test("TST-506001 the bar is started once in a footer after the route's main on the main and the review pages, and not in the Bridge's window", async () => {
  const views = [route("alpha", "requirements"), route("beta", "tests")];
  for (const name of ["main", "review"]) {
    const page = await start({ page: name, fragment: "#alpha", views });
    assert.deepEqual(page.body.children.map((child) => child.localName), ["header", "section", "main", "footer", "footer"], name);
    assert.equal(page.body.children[3].className, "site-footer", `${name}: the site footer stands after the route and before the bar's footer`);
    assert.equal(page.footer.className, "site-frame-prompt-bar", name);
    await drawn(page);
    assert.equal(participantReads().length, 0, `${name}: no participant list is read for the offer`);
    const bar = one(page.footer, "prompt-bar");
    assert.equal(bar.getAttribute("data-page"), name);
    changeFragment(page, "#beta");
    await settleLong();
    changeFragment(page, "#alpha");
    await settleLong();
    assert.deepEqual(byClass(page.footer, "prompt-bar"), [bar], `${name}: still the one bar, not a new one, after two changes of the fragment`);
    assert.equal(participantReads().length, 0, `${name}: the participant list is still not read`);
  }
  const bridge = await start({ page: "bridge", fragment: "#alpha", views });
  await settleLong();
  assert.deepEqual(bridge.body.children.map((child) => child.localName), ["header", "section", "main"]);
  assert.equal(bridge.footer, null);
  assert.equal(participantReads().length, 0, "the Bridge's window reads no register");
});

// TST-506002 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the review page with the route alpha (entry requirements) that gives a subject — key "requirement:<id>", the page text "alpha <id> for <participant> on <page>", refuses ["propose-edit"] and its own entry "settings" — and the route beta (entry tests) that gives none
// input: Send "first" on #alpha/id=7; the fragment changes to #alpha/id=8 and Send "second"; it changes to #beta and Send "third"
// expect: the kind's strategy is given, for the first message, page "alpha 7 for drafter-a on review", entry "requirements" (the route's, not the subject's "settings"), refuses ["propose-edit"] and instruction "first"; for the second, page "alpha 8 for drafter-a on review"; for the third entry "tests", refuses [], and a page that does not begin with "alpha"; the subjects kept with the tab's messages are "requirement:7" twice (the person's and the participant's), "requirement:8" twice, then "beta" twice
test("TST-506002 the subject is the shown route's own, read at each Send, and its entry is the route's", async () => {
  const alpha = route("alpha", "requirements", { subject: (params, context) => ({
    key: `requirement:${params.id}`, title: `Requirement ${params.id}`, kind: "converse", entry: "settings",
    paramsFor: (participant) => ({ page: `alpha ${params.id} for ${participant.name} on ${context.page}` }),
    draftRoute: null, withhold: null, refuses: ["propose-edit"] }) });
  const page = await start({ fragment: "#alpha/id=7", views: [alpha, route("beta", "tests")] });
  await drawn(page);
  await sends(page, "first");
  changeFragment(page, "#alpha/id=8");
  await settle();
  await sends(page, "second");
  changeFragment(page, "#beta");
  await settle();
  await sends(page, "third");
  assert.deepEqual({ page: seen[0].page, entry: seen[0].entry, refuses: seen[0].refuses, instruction: seen[0].instruction },
    { page: "alpha 7 for drafter-a on review", entry: "requirements", refuses: ["propose-edit"], instruction: "first" });
  assert.equal(seen[1].page, "alpha 8 for drafter-a on review");
  assert.deepEqual({ entry: seen[2].entry, refuses: seen[2].refuses }, { entry: "tests", refuses: [] });
  assert.ok(!seen[2].page.startsWith("alpha"), `the third message is about beta: ${seen[2].page}`);
  assert.deepEqual(conversationOf().map((message) => message.subject),
    ["requirement:7", "requirement:7", "requirement:8", "requirement:8", "beta", "beta"]);
});

// TST-506003 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the review page with the route alpha (entry requirements, title "Title of alpha") and the route beta (entry tests, title "Title of beta"), neither giving a subject, in a browser that keeps the product https://github.com/acme/widget
// input: Send "hello" on #alpha/id=7; Send on #beta/q=a%20b/z=1; Send on #alpha/id=7/product=<the widget>
// expect: the first message is given the page "Title of alpha\nRequirements\nhttps://github.com/acme/instance\nalpha {"id":"7"}", entry "requirements" and refuses []; the second the page "Title of beta\nTests\nhttps://github.com/acme/instance\nbeta {"q":"a b","z":"1"}" and entry "tests"; the third the page "Title of alpha\nRequirements\nhttps://github.com/acme/widget\nalpha {"id":"7"}"; the subjects kept with the tab's messages are "alpha/id=7" twice, "beta/q=a%20b/z=1" twice and "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget" twice
test("TST-506003 a route that gives no subject has the default: its key, its title, the menu entry, the product or the instance, and the text the route drew", async () => {
  const views = [route("alpha", "requirements"), route("beta", "tests")];
  const page = await start({ fragment: "#alpha/id=7", views });
  await drawn(page);
  await sends(page, "hello");
  changeFragment(page, "#beta/q=a%20b/z=1");
  await settle();
  await sends(page, "second");
  changeFragment(page, `#alpha/id=7/product=${encoded(WIDGET)}`);
  await settle();
  await sends(page, "third");
  assert.deepEqual({ page: seen[0].page, entry: seen[0].entry, refuses: seen[0].refuses },
    { page: 'Title of alpha\nRequirements\nhttps://github.com/acme/instance\nalpha {"id":"7"}', entry: "requirements", refuses: [] });
  assert.deepEqual({ page: seen[1].page, entry: seen[1].entry },
    { page: 'Title of beta\nTests\nhttps://github.com/acme/instance\nbeta {"q":"a b","z":"1"}', entry: "tests" });
  assert.equal(seen[2].page, 'Title of alpha\nRequirements\nhttps://github.com/acme/widget\nalpha {"id":"7"}');
  assert.deepEqual(conversationOf().map((message) => message.subject),
    ["alpha/id=7", "alpha/id=7", "beta/q=a%20b/z=1", "beta/q=a%20b/z=1", ...Array(2).fill("alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget")]);
});

// TST-555002 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the route alpha (entry requirements, title "Title of alpha") whose subject gives null for the parameters {} and its own subject (key "own", title "Own", kind change-use-case, entry "tests") for {"id":"7"}; the route beta (entry null) whose subject gives null; the context of the instance acme/instance, and one of the product https://github.com/acme/widget
// input: subjectOf of the frame for alpha with {} and the text "drawn text" on the instance; for alpha with {} on the widget; for beta with {"q":"1"}; for alpha with {"id":"7"}
// expect: alpha with {} on the instance is the default — key "alpha", title "Title of alpha", no kind, entry "requirements", draftRoute null, withhold null, refuses [], its page "Title of alpha\nRequirements\nhttps://github.com/acme/instance\ndrawn text"; on the widget the key "alpha/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget" and the address https://github.com/acme/widget in the page; beta is the default with entry null and a page of its title, the address and the drawn text (no line for a menu entry); alpha with {"id":"7"} is the route's own subject, key "own", without the kind change-use-case it names — a subject is context only —, with its entry set to "requirements" and the default page beside its parameters, which give none
test("TST-555002 a route whose subject gives null for these parameters has the frame's default, menu label included", () => {
  const context = (product) => ({ instance: { repository: "acme/instance" }, product: product ? { address: WIDGET } : null });
  const alpha = { name: "alpha", entry: "requirements", title: "Title of alpha",
    subject: (params) => params.id === undefined ? null : { key: "own", title: "Own", kind: "change-use-case", entry: "tests", paramsFor: () => ({}), draftRoute: null, withhold: null, refuses: [] } };
  const beta = { name: "beta", entry: null, title: "Title of beta", subject: () => null };
  const instance = subjectOf({ route: alpha, params: {}, context: context(false), drawn: () => "drawn text" });
  assert.deepEqual({ key: instance.key, title: instance.title, kind: instance.kind, entry: instance.entry, draftRoute: instance.draftRoute, withhold: instance.withhold, refuses: instance.refuses },
    { key: "alpha", title: "Title of alpha", kind: undefined, entry: "requirements", draftRoute: null, withhold: null, refuses: [] });
  assert.equal(instance.paramsFor({}).page, "Title of alpha\nRequirements\nhttps://github.com/acme/instance\ndrawn text");
  const widget = subjectOf({ route: alpha, params: {}, context: context(true), drawn: () => "drawn text" });
  assert.equal(widget.key, `alpha/product=${encoded(WIDGET)}`);
  assert.equal(widget.paramsFor({}).page, "Title of alpha\nRequirements\nhttps://github.com/acme/widget\ndrawn text");
  const out = subjectOf({ route: beta, params: { q: "1" }, context: context(false), drawn: () => "drawn text" });
  assert.equal(out.entry, null);
  assert.equal(out.paramsFor({}).page, "Title of beta\nhttps://github.com/acme/instance\ndrawn text");
  const own = subjectOf({ route: alpha, params: { id: "7" }, context: context(false), drawn: () => "drawn text" });
  assert.deepEqual({ key: own.key, kind: own.kind, entry: own.entry }, { key: "own", kind: undefined, entry: "requirements" });
  assert.equal(own.paramsFor({}).page, "Title of alpha\nRequirements\nhttps://github.com/acme/instance\ndrawn text", "a route's own subject without a page has the default page beside it");
});

// TST-506007 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: a browser that keeps the products https://github.com/acme/widget and https://github.com/acme/gadget; the route alpha (entry requirements) that gives no subject
// input: Send on #alpha/id=7 (the instance); Send on #alpha/id=7/product=<the widget>; Send on #alpha/id=7/product=<the gadget>
// expect: the subjects kept with the tab's messages are "alpha/id=7" twice (the instance), "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget" twice and "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fgadget" twice: the same route on two products gives two keys, and on the instance a third
test("TST-506007 the same route on two products and on the instance is three subjects, so a draft is shown only on the page it was drafted on", async () => {
  const page = await start({ fragment: "#alpha/id=7", views: [route("alpha", "requirements")] });
  await drawn(page);
  await sends(page, "on the instance");
  changeFragment(page, `#alpha/id=7/product=${encoded(WIDGET)}`);
  await settle();
  await sends(page, "on the widget");
  changeFragment(page, `#alpha/id=7/product=${encoded("https://github.com/acme/gadget")}`);
  await settle();
  await sends(page, "on the gadget");
  assert.deepEqual(conversationOf().map((message) => message.subject), [
    "alpha/id=7", "alpha/id=7",
    "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget", "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget",
    "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fgadget", "alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fgadget"]);
});

// TST-506004 · level: unit · module: MOD-site-frame
// guards: A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: the review page with the route tokens (entry settings), which draws the paragraph "Token for the instance" and a password field holding the stored secret github_pat_SECRET_VALUE; the route gives no subject
// input: Send "what is stored?"
// expect: the field does hold github_pat_SECRET_VALUE (so the check below can find it); the page the message is given is "Title of tokens\nSettings\nhttps://github.com/acme/instance\nToken for the instance", which does not contain github_pat_SECRET_VALUE
test("TST-506004 the default page holds the text the route drew and no value of an input, so no stored secret", async () => {
  const SECRET = "github_pat_SECRET_VALUE";
  let field = null;
  const tokens = route("tokens", "settings", { async render(target) {
    const text = document.createElement("p");
    text.textContent = "Token for the instance";
    field = document.createElement("input");
    field.setAttribute("type", "password");
    field.value = SECRET;
    target.replaceChildren(text, field);
  } });
  const page = await start({ fragment: "#tokens", views: [tokens] });
  await drawn(page);
  await sends(page, "what is stored?");
  assert.equal(field.value, SECRET, "the field holds the secret");
  assert.equal(seen[0].page, "Title of tokens\nSettings\nhttps://github.com/acme/instance\nToken for the instance");
  assert.ok(!seen[0].page.includes(SECRET));
});

// TST-506005 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the review page with the route orphan (entry null) that gives no subject, and the route own (entry null) that gives a subject with its entry "tests"
// input: Send "a" on #orphan; Send "b" on #own
// expect: the first message is given entry null and the page "Title of orphan\nhttps://github.com/acme/instance\norphan {}" (no line for a menu entry); the second entry null
test("TST-506005 a route out of the menu gives the bar the entry null, whichever gives its subject", async () => {
  const own = route("own", null, { subject: () => ({ key: "own", title: "Own", kind: "converse", entry: "tests",
    paramsFor: () => ({ page: "own page" }), draftRoute: null, withhold: null, refuses: [] }) });
  const page = await start({ fragment: "#orphan", views: [route("orphan", null), own] });
  await drawn(page);
  await sends(page, "a");
  changeFragment(page, "#own");
  await settle();
  await sends(page, "b");
  assert.equal(seen[0].entry, null);
  assert.equal(seen[0].page, "Title of orphan\nhttps://github.com/acme/instance\norphan {}");
  assert.equal(seen[1].entry, null);
});

// TST-506006 · level: unit · module: MOD-site-frame
// guards: UC-049; EVERY STEP EXPLAINS ITSELF
// given: a browser that keeps the product https://github.com/acme/widget; the route alpha (entry requirements) whose subject names the draft route beta; an endpoint that answers {"answer":"ok"} with an edit
// input: the review page at #alpha/product=<the widget>: Send "draft it", press "Review the draft"; then the review page at #alpha (the instance): Send "again", press "Review the draft"
// expect: the bar holds a folded explanation (a details of class explain with the summary "What is this?"); the instance was read with the instance's token (Authorization "Bearer github_pat_INSTANCE") and, on the product's page, the product acme/widget was read with its own token ("Bearer github_pat_WIDGET") after Send; the draft kept in the tab is for the subject "alpha"; the fragment becomes #beta/product=<the widget>; on the instance's page no request goes to acme/widget and the fragment becomes #beta
test("TST-506006 the bar is handed the instance as connected, the chosen product, explain and the navigation that keeps the product", async () => {
  const alpha = route("alpha", "requirements", { subject: () => ({ key: "alpha", title: "Alpha", kind: "converse", entry: null,
    paramsFor: () => ({ page: "alpha page" }), draftRoute: "beta", withhold: null, refuses: [] }) });
  const views = [alpha, route("beta", "tests")];
  const onProduct = await start({ fragment: `#alpha/product=${encoded(WIDGET)}`, views });
  await drawn(onProduct);
  const explanation = one(onProduct.footer, "explain");
  assert.equal(explanation.localName, "details");
  assert.equal(all(explanation, "summary")[0].textContent, "What is this?");
  assert.equal(requests.find((request) => request.url.startsWith("https://api.github.com/repos/acme/instance")).authorization, "Bearer github_pat_INSTANCE");
  await sends(onProduct, "draft it");
  assert.ok(requests.some((request) => request.url.startsWith("https://api.github.com/repos/acme/widget") && request.authorization === "Bearer github_pat_WIDGET"),
    "the product was read with its own token");
  one(onProduct.footer, "review").dispatchEvent(new Event("click"));
  assert.equal(readTabValue(openStore("acme/instance"), "prompt-bar:draft").subject, "alpha");
  assert.equal(onProduct.location.hash, `#beta/product=${encoded(WIDGET)}`);
  const onInstance = await start({ fragment: "#alpha", views });
  await drawn(onInstance);
  await sends(onInstance, "again");
  assert.equal(requests.filter((request) => request.url.startsWith("https://api.github.com/repos/acme/widget")).length, 0);
  one(onInstance.footer, "review").dispatchEvent(new Event("click"));
  assert.equal(onInstance.location.hash, "#beta");
});
