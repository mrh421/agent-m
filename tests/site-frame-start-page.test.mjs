// MOD-site-frame starts the main and the review pages (ITM-531): startPage draws the header, the menu in the order of the process
// and the product selector, shows the notices, connects the instance and the chosen product, renders the route the fragment
// names again on every change of the fragment, and starts MOD-notifications' watchForAcceptance once; menuOf and the address
// writer of routing.mjs, which startPage uses, are tested on their own.
//
// Run: node --test tests/site-frame-start-page.test.mjs
//
// Module: MOD-site-frame
// Guards: THE MENU FOLLOWS THE PROCESS; EVERY STEP EXPLAINS ITSELF; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// Guards: A PRODUCT IS NAMED BY ITS ADDRESS; A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Guards: THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK; UC-008; UC-020; UC-046
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use
// case or an architecture file. The page is a small fixture DOM (tests/site-frame-start.d/dom.mjs) with a fixture location and
// local storage; the page is given an offline fetch (tests/site-frame-start.d/dom.mjs), so nothing reaches the network, and the one timer the frame may start — MOD-notifications' minute check — is
// counted instead of started. The tests of a route's `reads` (TST-709001 to TST-709009) give the repository of the page a counting
// fake GitHub of tests/app-harness.mjs and state the requests of the route's load in its words (`repository`, `commit`, `tree`,
// `batch <n>`, `file <path>`). The counter-proofs (a planted fault in src/site-frame/ and the test's failing result) are recorded
// in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { all, changeFragment, installPage, offline, outside } from "./site-frame-start.d/dom.mjs";
import { repoServer } from "./app-harness.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { HostError } from "../src/repository-hosts/index.mjs";

const { startPage, menuOf } = await import("../src/site-frame/index.mjs");

const REVIEW = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const WIDGET = "https://github.com/acme/widget";
const APP = "https://gitlab.example.org/team/app";
const encoded = (address) => encodeURIComponent(address);
const settle = () => new Promise((resolve) => setImmediate(resolve));

// The routes a fixture view serves, each rendering a text that names it and its parameters.
const rendered = [];
const route = (name, entry) => ({ name, entry, title: name, async render(target, context, params) {
  rendered.push({ name, context, params });
  target.textContent = `${name} ${JSON.stringify(params)}`;
} });
const VIEW = { routes: [route("alpha", "requirements"), route("cases-list", "use-cases"), route("cases-new", "use-cases"),
  route("beta", "tests")], strategies: [] };

// Starts a page on a fresh fixture. `timers` collects the delays of the intervals the frame starts. `extra` is the rest of the
// setup besides the page and its views; the tests that do not concern it pass menuViews: [] as the callers in the repository do.
async function start({ page = "review", fragment = "", views = [VIEW], products = [], tokens = {}, extra = { menuViews: [] } } = {}) {
  rendered.length = 0;
  const fixture = installPage({ ...REVIEW, hash: fragment });
  offline();
  const timers = [];
  globalThis.setInterval = (callback, delay) => { timers.push(delay); return timers.length; };
  const store = openStore("acme/instance");
  if (products.length) writeSetting(store, "products", products);
  for (const [key, value] of Object.entries(tokens)) writeSetting(store, key, { value, name: "token", expires: "2030-01-01" });
  await startPage({ page, views, ...extra });
  const body = fixture.document.body;
  return { ...fixture, timers, body, target: all(body, "main")[0], menu: all(body, "nav")[0], select: all(body, "select")[0] };
}

// TST-531001 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; A PRODUCT IS NAMED BY ITS ADDRESS
// given: the review page of the instance acme/instance, a browser that keeps the products https://github.com/acme/widget and https://gitlab.example.org/team/app, and one view that serves the entries requirements, use-cases and tests
// input: startPage({ page: "review", views, menuViews: [] })
// expect: one header; a menu of eight entries whose texts are, in this order, Requirements, Use cases, Architecture, Implementation, Tests, Releases, Maintenance, Settings; the three served entries are links to #requirements, #use-cases and #tests; the five others are spans of class soon titled "not built yet"; and a product selector whose options are, in this order, acme/instance, the widget address, the app address and "+ Add product"
test("TST-531001 startPage on the review page draws the header, the eight entries of the menu in the order of the process and the selector with the instance first", async () => {
  const page = await start({ products: [WIDGET, APP] });
  assert.equal(all(page.body, "header").length, 1, "one header");
  assert.deepEqual(page.menu.children.map((entry) => entry.textContent),
    ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Releases", "Maintenance", "Settings"]);
  assert.deepEqual(page.menu.children.map((entry) => [entry.localName, entry.getAttribute("href")]), [
    ["a", "#requirements"], ["a", "#use-cases"], ["span", null], ["span", null], ["a", "#tests"], ["span", null], ["span", null], ["span", null]]);
  for (const entry of page.menu.children.filter((child) => child.localName === "span")) {
    assert.equal(entry.className, "soon", `${entry.textContent} is marked soon`);
    assert.match(entry.getAttribute("title"), /not built yet/, `${entry.textContent} says it is not built yet`);
  }
  assert.deepEqual(page.select.children.map((option) => option.textContent), ["acme/instance", WIDGET, APP, "+ Add product"]);
});

// TST-684004 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the main entry on the existing Frame fixture, with the same two kept products as the review page
// input: startPage({ page: "main", views, products })
// expect: the product selector has the accessible name "Product" and every rendered menu entry retains the existing menuOf key as its data-entry value, in process order
test("TST-684004 the Frame names the product selector and exposes every main-menu entry key", async () => {
  const page = await start({ page: "main", products: [WIDGET, APP] });
  assert.equal(page.select.getAttribute("aria-label"), "Product");
  assert.deepEqual(page.menu.children.map((entry) => entry.getAttribute("data-entry")),
    ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"]);
});

// TST-531002 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS
// given: the review page with one view whose routes are alpha (requirements), cases-list and cases-new (use-cases) and beta (tests)
// input: startPage with the fragment #alpha/id=7, then the fragment changes to #beta, then to #use-cases/x=1
// expect: the route area reads `alpha {"id":"7"}`; after the first change `beta {}`; after the second — a fragment that names a menu entry, not a route — the first loaded route of that entry, `cases-list {}`; each route is rendered once per fragment
test("TST-531002 the route the fragment names is rendered, the next on every change of the fragment, and a menu entry's name shows its first loaded route", async () => {
  const page = await start({ fragment: "#alpha/id=7" });
  assert.equal(page.target.textContent, 'alpha {"id":"7"}');
  changeFragment(page, "#beta");
  await settle();
  assert.equal(page.target.textContent, "beta {}");
  changeFragment(page, "#use-cases/x=1");
  await settle();
  assert.equal(page.target.textContent, "cases-list {}");
  assert.deepEqual(rendered.map((entry) => entry.name), ["alpha", "beta", "cases-list"], "one render per fragment");
});

// TST-531003 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS
// given: the review page with the same view
// input: startPage with the empty fragment; then startPage with #architecture, an entry no loaded view serves; then with #nothing-like-this, which names neither a route nor an entry
// expect: the first loaded route, `alpha {}`; then a paragraph "The Architecture entry is not built yet." and no route rendered; then the first loaded route again, `alpha {}`
test("TST-531003 an empty fragment shows the first loaded route, an entry no loaded view serves says it is not built yet", async () => {
  let page = await start();
  assert.equal(page.target.textContent, "alpha {}");
  page = await start({ fragment: "#architecture" });
  assert.equal(page.target.textContent, "The Architecture entry is not built yet.");
  assert.equal(all(page.target, "p").length, 1, "the sentence is a paragraph");
  assert.equal(rendered.length, 0, "no route is rendered for an entry nothing serves");
  page = await start({ fragment: "#nothing-like-this" });
  assert.equal(page.target.textContent, "alpha {}");
});

// TST-531004 · level: unit · module: MOD-site-frame
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE
// given: a fixture whose setInterval counts the delays it is given, and the review page, the main page and the Bridge page
// input: startPage on the review page, then two changes of the fragment; startPage on the main page; startPage on the bridge page
// expect: MOD-notifications' check is started by one interval of 60000 ms on the review page, still one after two changes of the fragment, one on the main page and none on the Bridge page
test("TST-531004 watchForAcceptance is started once on the review and the main page, never again on a change of the fragment, and not in the Bridge's window", async () => {
  const review = await start({ fragment: "#alpha" });
  assert.deepEqual(review.timers, [60000], "one minute check on the review page");
  changeFragment(review, "#beta");
  changeFragment(review, "#alpha");
  await settle();
  assert.deepEqual(review.timers, [60000], "a change of the fragment starts none");
  const main = await start({ page: "main", views: [] });
  assert.deepEqual(main.timers, [60000], "one minute check on the main page");
  const bridge = await start({ page: "bridge", views: [VIEW] });
  assert.deepEqual(bridge.timers, [], "none in the Bridge's window");
});

// TST-531005 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a browser that keeps the instance token github_pat_INSTANCE, the product https://github.com/acme/widget with its own token github_pat_WIDGET and the GitLab product https://gitlab.example.org/team/app; a fetch that records each request's url and Authorization header and fails
// input: startPage with #alpha, then with #alpha/product=<the widget>, then with #alpha/product=<the app>
// expect: the first route gets repository acme/instance, a host with repositoryInfo and no product; the second gets the product { address: the widget address, kind: "github" } and a host whose request carries Bearer github_pat_WIDGET and not the instance's token, while the instance's request carries Bearer github_pat_INSTANCE; the third { address: the app address, kind: "gitlab" }; the widget's product has tokenStored true (its own token is kept) and the app's has tokenStored false (the browser keeps no token of it)
test("TST-531005 the instance and the product the fragment names are connected, each with its own token", async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url: String(url), authorization: init?.headers?.Authorization ?? null }); throw new TypeError("offline"); };
  const kept = { products: [WIDGET, APP], tokens: { "github-token": "github_pat_INSTANCE", "github-token:acme/widget": "github_pat_WIDGET" } };
  await start({ ...kept, fragment: "#alpha" });
  const [instanceOnly] = rendered;
  assert.equal(instanceOnly.context.page, "review");
  assert.equal(instanceOnly.context.instance.repository, "acme/instance");
  assert.equal(typeof instanceOnly.context.instance.host.repositoryInfo, "function");
  assert.equal(instanceOnly.context.product, null);
  await instanceOnly.context.instance.host.repositoryInfo().catch(() => {});
  await start({ ...kept, fragment: `#alpha/product=${encoded(WIDGET)}` });
  const [withWidget] = rendered;
  assert.equal(withWidget.context.product.address, WIDGET);
  assert.equal(withWidget.context.product.kind, "github");
  assert.equal(withWidget.context.product.tokenStored, true);
  await withWidget.context.product.host.repositoryInfo().catch(() => {});
  await start({ ...kept, fragment: `#alpha/product=${encoded(APP)}` });
  assert.equal(rendered[0].context.product.address, APP);
  assert.equal(rendered[0].context.product.kind, "gitlab");
  assert.equal(rendered[0].context.product.tokenStored, false);
  const toInstance = requests.find((request) => request.url.includes("/repos/acme/instance"));
  const toWidget = requests.find((request) => request.url.includes("/repos/acme/widget"));
  assert.equal(toInstance.authorization, "Bearer github_pat_INSTANCE");
  assert.equal(toWidget.authorization, "Bearer github_pat_WIDGET");
});

// TST-531006 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS
// given: a browser that keeps the product https://github.com/acme/widget and not https://github.com/other/none
// input: startPage with #alpha/product=<other/none>
// expect: the route is rendered for the instance (product null) and the notices say "does not keep the product https://github.com/other/none"
test("TST-531006 a fragment naming a product this browser does not keep shows the instance and says so", async () => {
  const page = await start({ products: [WIDGET], fragment: `#alpha/product=${encoded("https://github.com/other/none")}` });
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].context.product, null);
  assert.match(all(page.body, "section").find((section) => section.className === "site-frame-notices").textContent,
    /does not keep the product https:\/\/github\.com\/other\/none/);
});

// TST-531007 · level: unit · module: MOD-site-frame
// guards: A PRODUCT IS NAMED BY ITS ADDRESS
// given: the review page showing #alpha/id=7 in a browser that keeps the widget product
// input: the person chooses the widget in the selector; then calls go("beta", { x: "1" }) from the route; then chooses the instance; then chooses "+ Add product"
// expect: the fragment becomes #alpha/id=7/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget and, once the page has shown it, the selector stands on the widget; go keeps the product: #beta/x=1/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget; the instance removes it: #alpha/id=7; "+ Add product" goes to #add-product
test("TST-531007 choosing in the selector sets the fragment's product, go keeps it, the instance removes it, + Add product goes to the add-product route", async () => {
  const page = await start({ products: [WIDGET], fragment: "#alpha/id=7" });
  page.select.value = WIDGET;
  page.select.dispatchEvent(new Event("change"));
  assert.equal(page.location.hash, `#alpha/id=7/product=${encoded(WIDGET)}`);
  changeFragment(page, page.location.hash);
  await settle();
  assert.equal(page.select.value, WIDGET, "the selector stands on the product the fragment names");
  rendered.at(-1).context.go("beta", { x: "1" });
  assert.equal(page.location.hash, `#beta/x=1/product=${encoded(WIDGET)}`);
  changeFragment(page, `#alpha/id=7/product=${encoded(WIDGET)}`);
  await settle();
  page.select.value = "";
  page.select.dispatchEvent(new Event("change"));
  assert.equal(page.location.hash, "#alpha/id=7");
  page.select.value = "+add";
  page.select.dispatchEvent(new Event("change"));
  assert.equal(page.location.hash, "#add-product");
});

// TST-531008 · level: unit · module: MOD-site-frame
// guards: EVERY STEP EXPLAINS ITSELF
// given: a browser with no token stored; then one with the instance token stored
// input: startPage on the review page
// expect: the notices read "Finish setting up" with a link to #settings while no token is stored, and hold nothing once the instance token is stored
test("TST-531008 the notices say Finish setting up while no token is stored and say nothing once one is", async () => {
  const noticesOf = (page) => all(page.body, "section").find((section) => section.className === "site-frame-notices");
  const without = await start();
  assert.match(noticesOf(without).textContent, /Finish setting up/);
  assert.equal(all(noticesOf(without), "a")[0].getAttribute("href"), "#settings");
  const withToken = await start({ tokens: { "github-token": "github_pat_INSTANCE" } });
  assert.equal(noticesOf(withToken).textContent, "");
});

// TST-531009 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS
// given: the main page and no view loaded; once with a setup that also carries menuViews naming a view module that does not exist
// input: startPage({ page: "main", views: [] }); then startPage({ page: "main", views: [], menuViews: ["../tests/site-frame-start.d/not-a-view"] })
// expect: a header, a menu of eight entries that are all links (none a span of class soon) whose hrefs are, in the order Requirements, Use cases, Architecture, Implementation, Tests, Releases, Maintenance, Settings, docs/index.html#requirements, docs/index.html#use-cases, docs/index.html#architecture, docs/index.html#implementation, docs/index.html#tests, docs/index.html#releases, docs/index.html#maintenance, docs/index.html#settings; the selector with the instance first, and the paragraph "This page is not built yet."; the second call is not refused and draws the same eight hrefs, since menuViews is ignored and the missing module is never imported
test("TST-531009 startPage on the main page links every entry into the review pages, loads no view, and ignores menuViews", async () => {
  const hrefs = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"].map((key) => `docs/index.html#${key}`);
  const page = await start({ page: "main", views: [], extra: {} });
  assert.equal(all(page.body, "header").length, 1);
  assert.equal(page.menu.children.length, 8);
  assert.ok(page.menu.children.every((entry) => entry.localName === "a" && entry.className !== "soon"));
  assert.deepEqual(page.menu.children.map((entry) => entry.getAttribute("href")), hrefs);
  assert.equal(page.select.children[0].textContent, "acme/instance");
  assert.equal(page.target.textContent, "This page is not built yet.");
  const ignored = await start({ page: "main", views: [], extra: { menuViews: ["../tests/site-frame-start.d/not-a-view"] } });
  assert.deepEqual(ignored.menu.children.map((entry) => entry.getAttribute("href")), hrefs);
});

// TST-531010 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS
// given: no page
// input: menuOf("review", ["tests", "requirements"]); menuOf("main", ["use-cases"])
// expect: the eight keys in the order requirements, use-cases, architecture, implementation, tests, releases, maintenance, settings with the labels Requirements, Use cases, Architecture, Implementation, Tests, Releases, Maintenance, Settings; on the review page hrefs #requirements and #tests and null for the other six, whose titles say "not built yet"; on the main page the use-cases entry links into the review pages as docs/index.html#use-cases, and so does every entry of menuOf("main", []): the eight hrefs docs/index.html#<key> for the eight keys, in that order
test("TST-531010 menuOf lists the eight entries in the order of the process and links only the entries a loaded view serves", () => {
  const review = menuOf("review", ["tests", "requirements"]);
  assert.deepEqual(review.map((entry) => entry.key), ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"]);
  assert.deepEqual(review.map((entry) => entry.label), ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Releases", "Maintenance", "Settings"]);
  assert.deepEqual(review.map((entry) => entry.href), ["#requirements", null, null, null, "#tests", null, null, null]);
  for (const entry of review.filter((candidate) => candidate.href === null)) assert.match(entry.title, /not built yet/);
  assert.equal(menuOf("main", ["use-cases"])[1].href, "docs/index.html#use-cases");
  assert.deepEqual(menuOf("main", []).map((entry) => entry.href), review.map((entry) => `docs/index.html#${entry.key}`));
});

// TST-531011 · level: unit · module: MOD-site-frame
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; A PRODUCT IS NAMED BY ITS ADDRESS
// given: the instance acme/instance, whose review pages stand at https://acme.github.io/instance/docs/index.html and whose main page at https://acme.github.io/instance/index.html, and the products the widget and the app
// input: the address writer for each page, called for the instance, for the widget (repository acme/widget) and for the app (repository team/app); routeOf and productOf read back what it wrote
// expect: for the instance https://acme.github.io/instance/docs/index.html#use-case/id=UC-001 from either page; for the widget …#module/id=MOD-x/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget; for the app …#release/product=https%3A%2F%2Fgitlab.example.org%2Fteam%2Fapp; read back: name use-case with params { id: "UC-001" }, and the product address of the widget and of the app; none for the instance
test("TST-531011 the address writer writes the address of a review route for the instance or a product in the form routing reads back", async () => {
  const { addressWriter, routeOf, productOf } = await import("../src/site-frame/routing.mjs");
  const docs = "https://acme.github.io/instance/docs/index.html";
  for (const [page, at] of [["review", docs], ["main", "https://acme.github.io/instance/index.html"]]) {
    const write = addressWriter(page, at, "acme/instance", [WIDGET, APP]);
    assert.equal(write("use-case", { id: "UC-001" }, "acme/instance"), `${docs}#use-case/id=UC-001`, page);
    assert.equal(write("module", { id: "MOD-x" }, "acme/widget"), `${docs}#module/id=MOD-x/product=${encoded(WIDGET)}`, page);
    assert.equal(write("release", {}, "team/app"), `${docs}#release/product=${encoded(APP)}`, page);
  }
  const fragment = (address) => address.slice(address.indexOf("#"));
  assert.deepEqual(routeOf(`#use-case/id=UC-001`), { name: "use-case", params: { id: "UC-001" } });
  assert.equal(productOf(fragment(`${docs}#module/id=MOD-x/product=${encoded(WIDGET)}`)), WIDGET);
  assert.equal(productOf(fragment(`${docs}#release/product=${encoded(APP)}`)), APP);
  assert.equal(productOf("#use-case/id=UC-001"), null);
});

// ---------------------------------------------------------------- a route's `reads`: the files it names are read before it is rendered
//
// The named fixture "widget-3": the repository acme/widget, whose default branch main holds SPEC.md, docs/other.md and the three use
// cases docs/use-cases/UC-001-n.md to UC-003-n.md, with the texts "use case 1" to "use case 3". "widget-205" holds SPEC.md, docs/other.md
// and 205 use cases in place of the three. The counting fake GitHub answers as the repository's API does, and names each request it served:
// `repository`, `commit`, `tree`, `batch <n>` (GitHub's batch request for n files) and `file <path>`.
const USE_CASES = "docs/use-cases/";
const useCases = (count) => Object.fromEntries(Array.from({ length: count }, (_, at) =>
  [`${USE_CASES}UC-${String(at + 1).padStart(3, "0")}-n.md`, `use case ${at + 1}\n`]));
const widget3 = { "SPEC.md": "# Spec\n", "docs/other.md": "other\n", ...useCases(3) };
const widget205 = { "SPEC.md": "# Spec\n", "docs/other.md": "other\n", ...useCases(205) };
const THREE = Object.keys(useCases(3));
const fragmentOf = (name, product = WIDGET) => `#${name}/under=${encoded(USE_CASES)}${product ? `/product=${encoded(product)}` : ""}`;
const until = async (condition, what, ms = 3000) => {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

// A route that shows the use cases under its parameter `under`, as a view reads a repository: its render asks the host for the default
// branch, reads the snapshot and each use case through `read`. Its `reads` names the same use cases (without `reads: false`). `log`
// records the order of the frame's calls and `calls` what `reads` was given.
function reading(name, { reads = true, log = [] } = {}) {
  const calls = [];
  return { calls, log, name, entry: "use-cases", title: name,
    ...(reads ? { async reads(params, snapshot) {
      log.push("reads");
      calls.push({ params, repository: snapshot.repository.path, paths: [...snapshot.paths].sort() });
      return snapshot.paths.filter((path) => path.startsWith(params.under));
    } } : {}),
    async render(target, context, params) {
      log.push("render");
      const host = (context.product ?? context.instance).host;
      try {
        const { defaultBranch } = await host.repositoryInfo();
        const snapshot = await host.readSnapshot(defaultBranch);
        const texts = await Promise.all(snapshot.paths.filter((path) => path.startsWith(params.under)).map((path) => snapshot.read(path)));
        target.textContent = `${name}: ${texts.map((text) => text.trim()).join("|")}`;
      } catch (failure) {
        target.textContent = `${name} problem: ${failure.name}`;
      }
    } };
}

// Starts a page on the routes with the counting fake GitHub of `repository` in place of the network, and gives back the page, the fake,
// the requests it had counted when startPage returned — those of the first route's load; the prompt bar's and the checks' come after —
// and `restore`, which puts the fetch back.
async function loadWith({ files, repository = "acme/widget", routes, fragment, page = "review", handlers = [], products = [WIDGET], tokens = {} }) {
  const srv = await repoServer({ repo: repository, files, handlers });
  offline();
  const before = globalThis.fetch;
  globalThis.fetch = (url, init) => (String(url).includes(`/${repository}`) || String(url).includes("/graphql") ? srv.fetch(url, init) : before(url, init));
  const restore = () => { globalThis.fetch = before; };
  try {
    const started = await start({ page, views: [{ routes, strategies: [] }], fragment, products, tokens });
    return { ...started, srv, requests: [...srv.requests], restore };
  } catch (failure) {
    restore();
    throw failure;
  }
}

const TOKEN_OF_WIDGET = { "github-token:acme/widget": "github_pat_WIDGET" };
// ITM-1170: with a token, each repositoryInfo sends beside the repository's record the GraphQL request of greenToMerge, which the fake logs as a batch of no file ("batch 0").
const LOADED = ["batch 0", "repository", "commit", "tree", "batch 3", "batch 0", "repository", "commit", "tree"];

// TST-709001 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-3, a product this browser keeps with its own token, and a route that names the three use cases in `reads` and reads them in its render
// input: startPage on the review page at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: the frame asks the route for its reads before it renders it, once, with the parameters of the address without `product` — { under: "docs/use-cases/" } — and a snapshot of acme/widget that holds the five files; the requests of the load are, in this order, greenToMerge's GraphQL request (ITM-1170; a batch of no file) and beside it repository, commit, tree and one batch of the 3 use cases (the frame's), then greenToMerge's, repository, commit and tree (the route's own); no file by itself; and the route shows the three texts
test("TST-709001 a route's reads are read in one batch before it is rendered, and its own reads send no request for a file", async () => {
  const route = reading("reading");
  const page = await loadWith({ files: widget3, routes: [route], fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET });
  try {
    assert.deepEqual(route.log, ["reads", "render"]);
    assert.deepEqual(route.calls, [{ params: { under: USE_CASES }, repository: "acme/widget", paths: Object.keys(widget3).sort() }]);
    assert.deepEqual(page.requests, LOADED);
    assert.deepEqual(page.srv.batches.map((batch) => [...batch].sort()), [[], THREE, []], "the empty batches are greenToMerge's (ITM-1170)");
    assert.equal(page.target.textContent, "reading: use case 1|use case 2|use case 3");
  } finally { page.restore(); }
});

// TST-709002 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-3, a product this browser keeps and stores no token for, and the route of TST-709001
// input: startPage at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: no batch is sent (GitHub's batch request needs the token); the requests are repository, commit and tree (the frame's), then repository, commit and tree (the route's), then the three use cases, each by its own request; the route shows the three texts
test("TST-709002 without a token no batch is sent, and each file is read by its own request", async () => {
  const route = reading("reading");
  const page = await loadWith({ files: widget3, routes: [route], fragment: fragmentOf("reading") });
  try {
    assert.deepEqual(page.requests, ["repository", "commit", "tree", "repository", "commit", "tree", ...THREE.map((path) => `file ${path}`)]);
    assert.deepEqual(page.srv.batches, []);
    assert.equal(page.target.textContent, "reading: use case 1|use case 2|use case 3");
  } finally { page.restore(); }
});

// TST-709003 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-205, whose 205 use cases the route names in `reads`, and the product's token
// input: startPage at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: the requests are greenToMerge's GraphQL request (ITM-1170; a batch of no file), repository, commit, tree, then batch 100, batch 100 and batch 5, then greenToMerge's, repository, commit and tree (the route's); the three batches of files hold 100, 100 and 5 files, the 205 use cases each once; no file by itself
test("TST-709003 a route that names more than a hundred files is read in batches of at most a hundred", async () => {
  const route = reading("reading");
  const page = await loadWith({ files: widget205, routes: [route], fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET });
  try {
    assert.deepEqual(page.requests, ["batch 0", "repository", "commit", "tree", "batch 100", "batch 100", "batch 5", "batch 0", "repository", "commit", "tree"]);
    assert.deepEqual(page.srv.batches.map((batch) => batch.length), [0, 100, 100, 5, 0]);
    assert.equal(new Set(page.srv.batches.flat()).size, 205, "each of the 205 use cases once");
  } finally { page.restore(); }
});

// TST-709004 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-3, the product's token, and a route that has no `reads` and reads the three use cases in its render
// input: startPage at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: the frame sends no request of its own: greenToMerge's GraphQL request (ITM-1170), repository, commit and tree (the route's), then the three use cases, each by its own request; no batch of files
test("TST-709004 a route without reads costs the frame no request", async () => {
  const route = reading("reading", { reads: false });
  const page = await loadWith({ files: widget3, routes: [route], fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET });
  try {
    assert.deepEqual(page.requests, ["batch 0", "repository", "commit", "tree", ...THREE.map((path) => `file ${path}`)]);
    assert.deepEqual(route.log, ["render"]);
    assert.equal(page.target.textContent, "reading: use case 1|use case 2|use case 3");
  } finally { page.restore(); }
});

// TST-709005 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the page of TST-709001 shown, and a second route of the same view with the same reads
// input: the fragment changes to #reading-again/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: the requests of the second route are commit and tree (the frame's: it holds the default branch it asked for already, and the product's host is the one the first route used (ITM-669), which holds the three texts, so no batch), then greenToMerge's GraphQL request (ITM-1170), repository, commit and tree (the route's own)
test("TST-709005 the frame asks for a repository's default branch once for as long as the page is open", async () => {
  const routes = [reading("reading"), reading("reading-again")];
  const page = await loadWith({ files: widget3, routes, fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET });
  try {
    assert.deepEqual(page.requests, LOADED);
    changeFragment(page, fragmentOf("reading-again"));
    await until(() => page.target.textContent.startsWith("reading-again:"), "the second route");
    assert.deepEqual(page.srv.requests.slice(LOADED.length), ["commit", "tree", "batch 0", "repository", "commit", "tree"]);
  } finally { page.restore(); }
});

// TST-709006 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-3 as the instance acme/instance, whose token the browser keeps, and the route of TST-709001; no product chosen
// input: startPage at #reading/under=docs%2Fuse-cases%2F
// expect: the route is given a snapshot of acme/instance; the requests of the load are those of TST-709001; the batch holds the 3 use cases
test("TST-709006 on the instance the frame reads the instance's snapshot, through the instance's token", async () => {
  const route = reading("reading");
  const page = await loadWith({ files: widget3, repository: "acme/instance", routes: [route], fragment: fragmentOf("reading", null), products: [],
    tokens: { "github-token": "github_pat_INSTANCE" } });
  try {
    assert.deepEqual(route.calls.map((call) => call.repository), ["acme/instance"]);
    assert.deepEqual(page.requests, LOADED);
    assert.deepEqual(page.srv.batches.map((batch) => [...batch].sort()), [[], THREE, []], "the empty batches are greenToMerge's (ITM-1170)");
  } finally { page.restore(); }
});

// TST-709007 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a repository whose commit the server refuses with 422 — GitHub's answer for a ref it does not hold, which the host tells as NotFound — and the route of TST-709001, which shows the failure it meets as `reading problem: <the failure's name>`
// input: startPage at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: the frame's read fails and is left to the route: `reads` is not called, the route is rendered, meets the same failure in its own read and shows `reading problem: NotFound`; the requests are greenToMerge's GraphQL request (ITM-1170), repository and the refused commit (the frame's), the same three again (the route's)
test("TST-709007 a failure of the host in the frame's read is left to the route, which meets it again and shows it", async () => {
  const route = reading("reading");
  const refused = (url) => (url.pathname.endsWith("/commits/main")
    ? new Response('{"message":"No commit found for the ref main"}', { status: 422, headers: { "Content-Type": "application/json" } }) : undefined);
  const commit = "handler GET https://api.github.com/repos/acme/widget/commits/main";
  const page = await loadWith({ files: widget3, routes: [route], fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET, handlers: [refused] });
  try {
    assert.deepEqual(page.requests, ["batch 0", "repository", commit, "batch 0", "repository", commit]);
    assert.deepEqual(route.log, ["render"]);
    assert.equal(page.target.textContent, "reading problem: NotFound");
  } finally { page.restore(); }
});

// TST-709008 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: widget-3 and a route whose `reads` throws a TypeError "reads is broken" — a fault of the page, no failure of a host
// input: startPage at #reading/under=docs%2Fuse-cases%2F/product=<the widget>
// expect: startPage rejects with that TypeError; the fault is not swallowed
test("TST-709008 a fault of the page in a route's reads is not hidden", async () => {
  const route = { ...reading("reading"), async reads() { throw new TypeError("reads is broken"); } };
  let page;
  try {
    await assert.rejects(async () => { page = await loadWith({ files: widget3, routes: [route], fragment: fragmentOf("reading"), tokens: TOKEN_OF_WIDGET }); },
      { name: "TypeError", message: "reads is broken" });
  } finally { page?.restore(); }
});

// TST-709009 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the Bridge's window on the instance acme/instance (widget-3 as its repository), where no token is kept, and the route of TST-709001
// input: startPage({ page: "bridge" }) at #reading/under=docs%2Fuse-cases%2F
// expect: the route is given a snapshot of acme/instance; the requests are repository, commit and tree (the frame's), repository, commit and tree (the route's), then the three use cases by their own requests; the route shows the three texts
test("TST-709009 the Bridge's window reads a route's reads as the other pages do", async () => {
  const route = reading("reading");
  const page = await loadWith({ files: widget3, repository: "acme/instance", routes: [route], fragment: fragmentOf("reading", null), page: "bridge", products: [] });
  try {
    assert.deepEqual(route.calls.map((call) => call.repository), ["acme/instance"]);
    assert.deepEqual(page.requests, ["repository", "commit", "tree", "repository", "commit", "tree", ...THREE.map((path) => `file ${path}`)]);
    assert.equal(page.target.textContent, "reading: use case 1|use case 2|use case 3");
  } finally { page.restore(); }
});

// TST-506008 · level: unit · module: MOD-site-frame
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: the pages started by the tests above, each now with the prompt bar, which reads the instance acme/instance when it is drawn; every page of this file was given an offline fetch, and the fetch that stands for the network records what reaches it
// input: the requests the pages made, as the offline fetch and as the network recorded them
// expect: the pages did ask the instance's API (at least one request, every one of them to https://api.github.com/repos/acme/instance, so the check can find what it looks for), and no request reached the network: none left the fixture
test("TST-506008 the pages of this file ask only the offline fetch, and no request leaves the fixture", () => {
  assert.ok(outside.seen.length > 0, "the bar did read the instance, so the offline fetch saw it");
  assert.deepEqual([...new Set(outside.seen)], ["https://api.github.com/repos/acme/instance"]);
  assert.deepEqual(outside.reached, []);
});

// The view whose route alpha draws part of its page and then fails with `error`, and a route beta that draws.
const failing = (error) => ({ routes: [{ name: "alpha", entry: "requirements", title: "alpha", async render(target) { target.textContent = "half drawn"; throw error; } }, route("beta", "tests")], strategies: [] });
const problems = (page) => all(page.target, "p").filter((paragraph) => paragraph.className === "problem");

// TST-865003 · level: unit · module: MOD-site-frame
// guards: UC-008; UC-020
// given: the review page with a route alpha that writes "half drawn" into its area and then throws a ReferenceError "draw is not defined"; no token stored
// input: startPage with the fragment #alpha
// expect: the start resolves; the main area holds exactly one <p class="problem"> and nothing else, its text exactly "This page could not be drawn: draw is not defined"; "half drawn" is gone; no link anywhere in the area
test("TST-865003 a route that fails with an error of its own is replaced by a fault of the page, with no link to a token", async () => {
  const page = await start({ fragment: "#alpha", views: [failing(new ReferenceError("draw is not defined"))] });
  await settle();
  assert.equal(page.target.children.length, 1, "the area holds one element");
  assert.deepEqual(problems(page).map((paragraph) => paragraph.textContent), ["This page could not be drawn: draw is not defined"]);
  assert.equal(page.target.textContent.includes("half drawn"), false);
  assert.equal(all(page.target, "a").length, 0, "no link");
});

// TST-865004 · level: unit · module: MOD-site-frame
// guards: UC-008; UC-020
// given: the same route alpha, now failing with a host's failure, a RateLimited HostError with the message "the request limit is used up", at the instance
// input: startPage with #alpha, once with no token stored and once with the instance's token stored
// expect: with none, the area holds one <p class="problem"> whose text is exactly "the request limit is used up Store a token" and one link, href "#add-product"; with the token, the text is exactly "the request limit is used up" and no link
test("TST-865004 a host's failure in a route is shown by readProblem: its message, and the link to store a token only where none is stored", async () => {
  const limit = new HostError("RateLimited", {}, "the request limit is used up");
  const without = await start({ fragment: "#alpha", views: [failing(limit)] });
  await settle();
  assert.deepEqual(problems(without).map((paragraph) => paragraph.textContent), ["the request limit is used up Store a token"]);
  assert.deepEqual(all(without.target, "a").map((link) => link.getAttribute("href")), ["#add-product"]);
  const kept = await start({ fragment: "#alpha", views: [failing(limit)], tokens: { "github-token": "github_pat_X" } });
  await settle();
  assert.deepEqual(problems(kept).map((paragraph) => paragraph.textContent), ["the request limit is used up"]);
  assert.equal(all(kept.target, "a").length, 0);
});

// TST-865005 · level: unit · module: MOD-site-frame
// guards: UC-008; UC-020
// given: a browser that keeps the product https://github.com/acme/widget and stores the instance's token but not the product's; the route alpha fails with the same RateLimited HostError
// input: startPage with #alpha/product=<the widget>; then the same with the product's own token (github-token:acme/widget) stored too
// expect: without the product's token the text is exactly "the request limit is used up Store a token" with one link (the instance's token does not count for the product); with it, exactly "the request limit is used up" and no link
test("TST-865005 on a product's page the problem asks about the product's own token", async () => {
  const limit = new HostError("RateLimited", {}, "the request limit is used up");
  const fragment = `#alpha/product=${encoded(WIDGET)}`;
  const without = await start({ fragment, products: [WIDGET], views: [failing(limit)], tokens: { "github-token": "github_pat_X" } });
  await settle();
  assert.deepEqual(problems(without).map((paragraph) => paragraph.textContent), ["the request limit is used up Store a token"]);
  assert.equal(all(without.target, "a").length, 1);
  const kept = await start({ fragment, products: [WIDGET], views: [failing(limit)], tokens: { "github-token": "github_pat_X", "github-token:acme/widget": "github_pat_Y" } });
  await settle();
  assert.deepEqual(problems(kept).map((paragraph) => paragraph.textContent), ["the request limit is used up"]);
  assert.equal(all(kept.target, "a").length, 0);
});

// TST-865006 · level: unit · module: MOD-site-frame
// guards: UC-008; UC-020
// given: the route alpha failing with an Error("boom"), and a route beta that draws "beta {}"
// input: startPage with #alpha; then the fragment changes to #beta
// expect: first the area holds the fault "This page could not be drawn: boom"; after the change it reads exactly "beta {}" and holds no problem — the failed page does not stay in the way of the next route
test("TST-865006 after a failed route the next route is drawn in its place", async () => {
  const page = await start({ fragment: "#alpha", views: [failing(new Error("boom"))] });
  await settle();
  assert.deepEqual(problems(page).map((paragraph) => paragraph.textContent), ["This page could not be drawn: boom"]);
  changeFragment(page, "#beta");
  await settle();
  assert.equal(page.target.textContent, "beta {}");
  assert.equal(problems(page).length, 0);
});

// TST-865007 · level: unit · module: MOD-site-frame
// guards: UC-008; UC-020
// given: the Bridge's window (page "bridge") with a route alpha that writes "half drawn" and then fails; three runs, the failure being a ReferenceError "draw is not defined", a RateLimited HostError "the request limit is used up" (no token stored), and a TokenRefused HostError { tokenName: "Agent M", renewal: "https://example.test/renew" }
// input: startPage with each
// expect: each start resolves; for the ReferenceError the main area holds exactly one <p class="problem"> with the text "This page could not be drawn: draw is not defined", no link, and no "half drawn"; for the RateLimited one the text is exactly "the request limit is used up Store a token" with one link; for the refused token the area holds no problem and the page shows one notice of kind token-refused
test("TST-865007 the Bridge's window also shows a failing route as a problem, except a refused token, which is a notice", async () => {
  const fault = await start({ page: "bridge", views: [failing(new ReferenceError("draw is not defined"))] });
  await settle();
  assert.equal(fault.target.children.length, 1);
  assert.deepEqual(problems(fault).map((paragraph) => paragraph.textContent), ["This page could not be drawn: draw is not defined"]);
  assert.equal(all(fault.target, "a").length, 0);
  assert.equal(fault.target.textContent.includes("half drawn"), false);
  const limit = await start({ page: "bridge", views: [failing(new HostError("RateLimited", {}, "the request limit is used up"))] });
  await settle();
  assert.deepEqual(problems(limit).map((paragraph) => paragraph.textContent), ["the request limit is used up Store a token"]);
  assert.equal(all(limit.target, "a").length, 1);
  const refusal = new HostError("TokenRefused", { tokenName: "Agent M", renewal: "https://example.test/renew" }, "rejected");
  const refused = await start({ page: "bridge", views: [failing(refusal)] });
  await settle();
  assert.equal(problems(refused).length, 0);
  assert.deepEqual(all(refused.body, "p").filter((p) => p.className.startsWith("notice ")).map((p) => p.className), ["notice token-refused"]);
});

// What a fault of the page says first, in plain words: what happened and what the person can do.
const FAULT_WORDS = "Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. If it happens again, report it, together with the message below.";
const UNINITIALISED = "Cannot access 'SERVICES' before initialization.";
// The fault in the main area: each element's class and text, in order, and the classes and texts of the paragraphs inside it.
const faultOf = (page) => page.target.children.map((child) => ({ class: child.className, paragraphs: all(child, "p").map((paragraph) => [paragraph.className, paragraph.textContent]) }));

// TST-1401002 · level: unit · module: MOD-site-frame
// guards: UC-022; UC-023
// given: three pages whose route alpha cannot be drawn with the ReferenceError "Cannot access 'SERVICES' before initialization.": the review page whose route draws "half drawn" and then throws it; the review page whose route is given by its head and whose own file cannot be imported (its `module` rejects with it); and the Bridge's window with the first route; no token stored
// input: startPage with #alpha on each
// expect: each start resolves; the main area holds one <div class="page-fault"> and nothing else; in it first a <p class="page-fault-words"> reading exactly "Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. If it happens again, report it, together with the message below." and below it the <p class="problem"> "This page could not be drawn: Cannot access 'SERVICES' before initialization."; no link; no "half drawn". Counter-proof: the frame as it was shows the message alone, "This page could not be drawn: Cannot access 'SERVICES' before initialization.", and nothing says what to do
test("TST-1401002 a route that cannot be drawn says in plain words what happened and what to do, with the error's message below", async () => {
  const expected = [{ class: "page-fault", paragraphs: [["page-fault-words", FAULT_WORDS], ["problem", `This page could not be drawn: ${UNINITIALISED}`]] }];
  const thrown = await start({ fragment: "#alpha", views: [failing(new ReferenceError(UNINITIALISED))] });
  const headed = { routes: [{ name: "alpha", entry: "architecture", title: "alpha", module: async () => { throw new ReferenceError(UNINITIALISED); },
    async render() { throw new Error("a route whose file cannot be imported is not rendered"); } }], strategies: [] };
  const unimported = await start({ fragment: "#alpha", views: [headed] });
  const bridge = await start({ page: "bridge", views: [failing(new ReferenceError(UNINITIALISED))] });
  await settle();
  for (const [name, page] of [["thrown", thrown], ["not imported", unimported], ["bridge", bridge]]) {
    assert.deepEqual(faultOf(page), expected, name);
    assert.equal(all(page.target, "a").length, 0, `${name}: no link`);
    assert.equal(page.target.textContent.includes("half drawn"), false, `${name}: the half-drawn page is gone`);
  }
});

// TST-829003 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; A PRODUCT IS NAMED BY ITS ADDRESS
// given: the address of a product this browser keeps, https://github.com/acme/widget
// input: menuOf("main", [], WIDGET); menuOf("review", ["tests"], WIDGET); menuOf("review", ["tests"], null); menuOf("review", ["tests"])
// expect: with the product, each href that is not null is the entry's own address followed by "/product=" and the percent-encoded address — main: docs/index.html#requirements/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget and so on for the eight entries; review: #tests/product=… for the served entry and null for the seven others; with null, or without a product, the entry's alone (#tests)
test("TST-829003 menuOf writes the /product= part of each address once, for the product it is given", () => {
  const enc = "https%3A%2F%2Fgithub.com%2Facme%2Fwidget";
  const keys = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"];
  assert.deepEqual(menuOf("main", [], WIDGET).map((entry) => entry.href), keys.map((key) => `docs/index.html#${key}/product=${enc}`));
  assert.deepEqual(menuOf("review", ["tests"], WIDGET).map((entry) => entry.href), keys.map((key) => (key === "tests" ? `#tests/product=${enc}` : null)));
  assert.equal(menuOf("review", ["tests"], null)[4].href, "#tests");
  assert.equal(menuOf("review", ["tests"])[4].href, "#tests");
});

// TST-829004 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; A PRODUCT IS NAMED BY ITS ADDRESS
// given: the review page with the view of TST-531001, the widget kept, and the fragment #alpha/product=<the widget>
// input: startPage; then the fragment changes to #beta without a product
// expect: the links of the menu are those menuOf gives for the product — "#requirements/product=<the widget>", "#use-cases/product=<the widget>", "#tests/product=<the widget>" — and, after the change, "#requirements", "#use-cases", "#tests"
test("TST-829004 the links of the menu are those menuOf gives for the chosen product", async () => {
  const page = await start({ products: [WIDGET], fragment: `#alpha/product=${encoded(WIDGET)}` });
  const hrefs = () => page.menu.children.filter((entry) => entry.localName === "a").map((entry) => entry.getAttribute("href"));
  assert.deepEqual(hrefs(), ["requirements", "use-cases", "tests"].map((key) => `#${key}/product=${encoded(WIDGET)}`));
  changeFragment(page, "#beta");
  await settle();
  assert.deepEqual(hrefs(), ["#requirements", "#use-cases", "#tests"]);
});

// TST-829005 · level: unit · module: MOD-site-frame
// guards: UC-046; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// given: the main page, the review page and the Bridge's window, each started with one route
// input: startPage on each
// expect: on the main and on the review page the body holds, after the route's main and before the footer of the prompt bar, a footer of class site-footer with: a link to the book Vibe Coding (https://link.springer.com/book/9783032399069), a link to the Pattern Recognition Lab (https://lme.tf.fau.de/), the sentence that no server is operated and that a page writes only when the person clicks, and a link to Agent M's source repository (https://github.com/akmaier/agent-m); the Bridge's window has no site footer
test("TST-829005 the main and the review pages draw the site footer after the route and before the page's foot, the Bridge's window does not", async () => {
  for (const name of ["main", "review"]) {
    const page = await start({ page: name });
    const kids = page.body.children.map((child) => child.className);
    assert.deepEqual(page.body.children.map((child) => child.localName), ["header", "section", "main", "footer", "footer"], name);
    assert.equal(kids[3], "site-footer", `${name}: after the route, before the foot`);
    assert.equal(kids[4], "site-frame-prompt-bar", `${name}: the page's foot is last`);
    const footer = page.body.children[3];
    const links = all(footer, "a").map((anchor) => [anchor.textContent, anchor.getAttribute("href")]);
    assert.deepEqual(links, [["Vibe Coding", "https://link.springer.com/book/9783032399069"], ["Pattern Recognition Lab", "https://lme.tf.fau.de/"], ["github.com/akmaier/agent-m", "https://github.com/akmaier/agent-m"]], name);
    assert.match(footer.textContent, /No server: this page reads the repositories directly and writes only when you click — one commit under your own account\./, name);
  }
  const bridge = await start({ page: "bridge" });
  assert.equal(all(bridge.body, "footer").length, 0, "the Bridge's window has no footer");
});
