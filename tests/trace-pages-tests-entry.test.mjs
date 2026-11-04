// MOD-trace-pages' views `tests` and `audit` belong to the menu entry Tests (ITM-1224): under the heading of the tests browser and of the audit of a release tag,
// each shows the Tests entry's views — MOD-test-pages' route `tests-views` — through the frame's embedRoute, with `shown` naming the view (Browser, Audit); the
// audit of a release candidate (`commit` among its params), which the release panel shows inside itself, shows none; where the route is not on the page, the
// frame's link to it stands in their place (RouteNotLoaded) and the view is drawn on. The audit's descriptor names the entry `tests` ("Tests → Audit", UC-030 1);
// the audit's table is `table.list` with `data-label`, its summary and its filters panels (EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE).
//
// Run: node --test tests/trace-pages-tests-entry.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; UC-030; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The route is called through its public Route.render with the key "tests" and with the key "audit", with a Host/Snapshot-shaped fake
// (tests/trace-pages-harness.mjs). The frame is MOD-site-frame's own, started through its interface startPage on the fixture page of
// tests/site-frame-start.d/dom.mjs with a fixture view in place of MOD-test-pages: its route `tests-views`, as MOD-test-pages.md names it, records what it is
// rendered with and where, so that these tests read what the trace pages hand the frame and not MOD-test-pages' navigation; a second start with no such
// route is the page where MOD-test-pages is not loaded. The descriptors are read from views.mjs, the module's own file of them (MOD-trace-pages.md, Parts and
// Data). Every expected text is stated in the case; none is read from a document.
// Readings the cases take, each from the sentence quoted (MOD-trace-pages.md, Uses):
// - "shown under the heading of the tests browser and of the audit of a release tag, with `shown` naming the view": the route tests-views is rendered once, with
//   the params { shown: "Browser" } on the tests browser and { shown: "Audit" } on the audit, into the element that follows the `h2` in the page's `section.head`.
// - "the audit of a release candidate (`commit` among its params) ... shows none": the route is not rendered, and the head holds its h2 and the audit only.
// - "the frame's link to the route stands in their place (`RouteNotLoaded`), and the view is drawn on": the element after the h2 holds the frame's link to
//   #tests-views/shown=…, and the audit's rows stand.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";
import { installPage, offline } from "./site-frame-start.d/dom.mjs";
import { descriptorFor } from "../src/trace-pages/views.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");
const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/acme/product";
const TAG = "v2026.1.0";
const SPEC = ["# Fixture product — Specification", "", "## Rules", "", "**A FIRST RULE** *(PO A. Maier)*", "The first rule.",
  "*Check:* `tests/unit.test.mjs`", "", "**A SECOND RULE** *(PO A. Maier)*", "The second rule.", "*Check:* no automatic check; at review.", ""].join("\n");
const TESTS = ["// TST-900001 · level: unit · module: MOD-widget", "// guards: A FIRST RULE", "// given: a fixture", "// input: a call", "// expect: a result", ""].join("\n");
const PRODUCT = { "SPEC.md": SPEC, "tests/unit.test.mjs": TESTS };

// The fixture view in place of MOD-test-pages: its route tests-views records each rendering and draws a marker into the element it is given.
const rendered = [];
const testsViews = { strategies: [], routes: [{ name: "tests-views", entry: null, title: "Tests", async render(target, context, params) {
  rendered.push({ target, params });
  target.replaceChildren(`tests-views ${params.shown} (recorded)`);
} }] };

// Starts the frame on a fixture review page with the given views, then puts the trace harness's DOM back, in which the trace route draws.
const harness = { document: globalThis.document, window: globalThis.window };
async function frameWith(views) {
  installPage({ hostname: "acme.github.io", pathname: "/instance/docs/index.html", hash: "#nothing" });
  offline();
  globalThis.setInterval = () => 1;
  await startPage({ page: "review", views });
  globalThis.document = harness.document;
  Object.defineProperty(globalThis, "window", { configurable: true, value: harness.window });
  rendered.length = 0;
}

// The product's host: a tag's commit is the commit of its snapshot, whose trace graph the fake stores.
function productHost(tags = [TAG]) {
  const base = treeHost({ trees: { main: PRODUCT, [TAG]: PRODUCT, "test-results": {} }, tags });
  return { ...base, async listTags() { return tags.map((name) => ({ name, commit: base.commitOf(name) })); } };
}
const instanceHost = () => treeHost({ trees: { main: { "SPEC.md": "# Fixture instance — Specification\n" } } });
async function render(params, host = productHost()) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host }, instance: { host: instanceHost() } }, params);
  return target;
}
const classes = (node) => String(node.className).split(" ");
const withClass = (root, name) => find(root, (node) => classes(node).includes(name));
// The page's section.head and its element children.
function headOf(root) {
  const section = find(root, (node) => node.localName === "section" && classes(node).includes("head"))[0];
  assert.ok(section, "the page draws a section.head");
  return section.childNodes.filter((node) => node.nodeType === 1);
}

// TST-1224002 · level: unit · module: MOD-trace-pages
// guards: UC-029; UC-030
// given: the descriptors of the trace views
// input: descriptorFor("tests") and descriptorFor("audit")
// expect: both name the entry tests
// Planted fault: the audit's descriptor naming the entry releases fails.
test("TST-1224002 the descriptors of the tests browser and of the audit name the entry tests", () => {
  for (const key of ["tests", "audit"]) assert.equal(descriptorFor(key).entry, "tests", key);
});

// TST-1224003 · level: unit · module: MOD-trace-pages
// guards: UC-029; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the frame started with a fixture route tests-views; a product whose default branch main holds a SPEC and one test file
// input: Route.render with the key "tests" at the ref main
// expect: tests-views is rendered once, with { shown: "Browser" }, into the element that follows the h2 Tests in the page's section.head
// Planted fault: a tests browser that embeds nothing, or names Audit, fails.
test("TST-1224003 the tests browser shows the Tests entry's views under its heading through the frame, Browser shown", async () => {
  await frameWith([testsViews]);
  const target = await render({ key: "tests", ref: "main" });
  assert.deepEqual(rendered.map((each) => each.params), [{ shown: "Browser" }]);
  const [heading, place] = headOf(target);
  assert.deepEqual([heading.localName, heading.textContent], ["h2", "Tests"]);
  assert.equal(rendered[0].target, place, "the views stand right under the heading");
  assert.equal(place.textContent, "tests-views Browser (recorded)");
});

// TST-1224004 · level: unit · module: MOD-trace-pages
// guards: UC-030; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the frame started with a fixture route tests-views; the product at the release tag v2026.1.0, and the same product with no release tag
// input: Route.render with the key "audit" at the ref v2026.1.0; then at the ref main of the product with no tag
// expect: each time tests-views is rendered once, with { shown: "Audit" }, into the element that follows the h2 Audit in the page's section.head; with no tag the page says that no release is tagged
// Planted fault: an audit that embeds nothing, or embeds it only where a tag exists, fails.
test("TST-1224004 the audit of a release tag shows the Tests entry's views under its heading through the frame, Audit shown", async () => {
  await frameWith([testsViews]);
  const target = await render({ key: "audit", ref: TAG });
  assert.deepEqual(rendered.map((each) => each.params), [{ shown: "Audit" }]);
  const [heading, place] = headOf(target);
  assert.deepEqual([heading.localName, heading.textContent], ["h2", "Audit"]);
  assert.equal(rendered[0].target, place);
  rendered.length = 0;
  const untagged = await render({ key: "audit", ref: "main" }, productHost([]));
  assert.match(untagged.textContent, /No release is tagged yet/);
  assert.deepEqual(rendered.map((each) => each.params), [{ shown: "Audit" }]);
  assert.equal(rendered[0].target, headOf(untagged)[1]);
});

// TST-1224006 · level: unit · module: MOD-trace-pages
// guards: UC-030; UC-013
// given: the frame started with a fixture route tests-views; the product at the release tag v2026.1.0
// input: Route.render with the key "audit" at the ref v2026.1.0 with a commit among its params, as the release panel embeds the audit of its candidate
// expect: tests-views is not rendered; the head holds the h2 Audit and the audit's body, and the audit's rows stand
// Planted fault: an audit that embeds the views whatever its params fails.
test("TST-1224006 the audit of a release candidate, shown inside the release panel, shows no Tests entry's views", async () => {
  await frameWith([testsViews]);
  const target = await render({ key: "audit", ref: TAG, commit: "c".repeat(40) });
  assert.deepEqual(rendered, []);
  const kids = headOf(target);
  assert.equal(kids[0].localName, "h2");
  assert.ok(classes(kids[1]).includes("audit-body"), `the audit follows the heading: ${kids[1].className}`);
  assert.equal(withClass(target, "audit-row").length, 2, "known positive: the audit is drawn");
});

// TST-1224007 · level: unit · module: MOD-trace-pages
// guards: UC-029; UC-030
// given: the frame started without a route tests-views, as a page that does not load MOD-test-pages
// input: Route.render with the key "tests" at the ref main, and with the key "audit" at the ref v2026.1.0
// expect: under each heading the frame's link to #tests-views/shown=Browser and #tests-views/shown=Audit stands in place of the views; the tests browser and the audit are drawn on (the audit's two rows stand)
// Planted fault: a page that fails, or draws nothing more, when the route is not loaded fails.
test("TST-1224007 where MOD-test-pages is not loaded, the frame's link stands in place of the views and the view is drawn on", async () => {
  await frameWith([]);
  const browser = await render({ key: "tests", ref: "main" });
  const link = find(headOf(browser)[1], (node) => node.localName === "a")[0];
  assert.ok(link, "the frame's link stands under the heading");
  assert.match(link.getAttribute("href"), /^#tests-views\/shown=Browser/);
  assert.ok(withClass(browser, "tests-page").length, "the tests browser is drawn on");
  const audit = await render({ key: "audit", ref: TAG });
  assert.match(find(headOf(audit)[1], (node) => node.localName === "a")[0]?.getAttribute("href") ?? "", /^#tests-views\/shown=Audit/);
  assert.equal(withClass(audit, "audit-row").length, 2);
});

// TST-1224005 · level: unit · module: MOD-trace-pages
// guards: UC-030; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the product at the release tag v2026.1.0 with two requirements
// input: Route.render with the key "audit" at the ref v2026.1.0
// expect: the table audit-table carries list; it has a row for each requirement, and every cell of its body names its column in data-label — Requirement, Sources, Tests, Gates, Acceptance, Detail; the summary audit-summary and the filters audit-filters carry panel
// Planted fault: a table without list, a cell without data-label, or a summary drawn outside a panel fails.
test("TST-1224005 the audit's table is table.list with data-label, its summary and filters panels", async () => {
  await frameWith([testsViews]);
  const target = await render({ key: "audit", ref: TAG });
  const table = withClass(target, "audit-table")[0];
  assert.ok(table, "the audit draws its table");
  assert.ok(classes(table).includes("list"), `table.list: ${table.className}`);
  const rows = withClass(table, "audit-row");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const cells = row.childNodes.filter((node) => node.localName === "td");
    assert.deepEqual(cells.map((cell) => cell.getAttribute("data-label")), ["Requirement", "Sources", "Tests", "Gates", "Acceptance", "Detail"], row.getAttribute("data-requirement"));
  }
  for (const name of ["audit-summary", "audit-filters"]) assert.ok(classes(withClass(target, name)[0]).includes("panel"), `${name} is a panel`);
});
