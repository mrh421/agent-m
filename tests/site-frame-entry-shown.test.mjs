// The menu marks, and the prompt bar's subject carries, the entry of the page shown (ITM-1228): MOD-site-frame's `Route` gives `entryShown(params)`,
// "the menu entry of the page the route shows for these `params`"; "its `null` means the route's `entry`"; "where a route gives none, the page shown is under
// the route's `entry`"; "The entry of the page shown is the one the menu marks and the one the subject carries"; "`menuOf` counts only `entry` as served".
//
// Run: node --test tests/site-frame-entry-shown.test.mjs
//
// Module: MOD-site-frame
// Guards: THE MENU FOLLOWS THE PROCESS; UC-030; UC-049
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture
// file. The subject is read from `subjectOf` (subject.mjs), the function the frame hands the prompt bar the subject of the route shown with; the menu from
// startPage on the small fixture DOM of tests/site-frame-start.d/dom.mjs, offline, its routes the test's own. The readings the pull request names: "the
// menu marks" an entry is the class `active` on its link, as startPage marks the entry of the route shown today; an entry the menu shows as not built yet
// is a span and carries no mark. The counter-proofs are recorded in the pull request: before the change each of these marks Requirements, or nothing.

import assert from "node:assert/strict";
import test from "node:test";
import { all, changeFragment, installPage, offline } from "./site-frame-start.d/dom.mjs";
import { subjectOf } from "../src/site-frame/subject.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

const REVIEW = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const settle = () => new Promise((resolve) => setImmediate(resolve));
const CONTEXT = { page: "review", instance: { repository: "acme/instance" }, product: null };

// A route listed under Requirements whose pages lie under the entry its `key` names: tests and audit under Tests, modules under Architecture, `none`
// under none of its own (null).
const ENTRIES = { tests: "tests", audit: "tests", modules: "architecture", specification: "requirements", none: null };
const rendered = [];
const route = (name, entry, over = {}) => ({ name, entry, title: `Title of ${name}`, async render(target, context, params) {
  rendered.push({ name, params });
  target.textContent = `${name} ${JSON.stringify(params)}`;
}, ...over });
const trace = (over = {}) => route("trace", "requirements", { entryShown: (params) => ENTRIES[params.key] ?? null, ...over });

async function start({ fragment = "", views }) {
  rendered.length = 0;
  const fixture = installPage({ ...REVIEW, hash: fragment });
  offline();
  globalThis.setInterval = () => 1;
  await startPage({ page: "review", views: [{ routes: views, strategies: [] }] });
  const body = fixture.document.body;
  return { ...fixture, body, target: all(body, "main")[0], menu: all(body, "nav")[0] };
}
// The entries the menu marks, by their key.
const marked = (page) => page.menu.children.filter((item) => item.className === "active").map((item) => item.getAttribute("data-entry"));
const itemOf = (page, key) => page.menu.children.find((item) => item.getAttribute("data-entry") === key);

// TST-1228001 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; UC-049
// given: a route `trace` under Requirements whose entryShown gives tests for the key tests and architecture for the key modules; once giving no subject of its own, once giving its own with the entry "settings"
// input: subjectOf with the params { key: "tests" }, then { key: "modules" }, the instance acme/instance, nothing drawn
// expect: the default subject's entry is "tests" and its page names the label Tests, not Requirements; with { key: "modules" } its entry is "architecture"; the route's own subject has the entry "tests", not its own "settings" nor the route's "requirements"
// Planted fault: a subjectOf that sets the route's `entry` gives "requirements" and the label Requirements.
test("TST-1228001 the subject carries the entry the route's entryShown gives", () => {
  const drawn = () => "";
  const plain = subjectOf({ route: trace(), params: { key: "tests" }, context: CONTEXT, drawn });
  assert.equal(plain.entry, "tests");
  assert.equal(plain.paramsFor().page, "Title of trace\nTests\nhttps://github.com/acme/instance\n");
  assert.equal(subjectOf({ route: trace(), params: { key: "modules" }, context: CONTEXT, drawn }).entry, "architecture");
  const own = trace({ subject: () => ({ key: "own", title: "Own", kind: "converse", entry: "settings", paramsFor: () => ({}), draftRoute: null, withhold: null, refuses: [] }) });
  assert.equal(subjectOf({ route: own, params: { key: "tests" }, context: CONTEXT, drawn }).entry, "tests");
});

// TST-1228002 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; UC-049
// given: the route `trace` under Requirements, whose entryShown gives null for the key none; and a route `beta` under Tests that gives no entryShown
// input: subjectOf for `trace` with { key: "none" }, and with no params; for `beta` with no params
// expect: the entry is the route's own: "requirements", "requirements", "tests"; the first page names the label Requirements
// Planted fault: a subjectOf that takes entryShown's null for the entry gives null and a page without a label.
test("TST-1228002 where entryShown gives null, or the route gives none, the subject carries the route's entry", () => {
  const drawn = () => "";
  const none = subjectOf({ route: trace(), params: { key: "none" }, context: CONTEXT, drawn });
  assert.equal(none.entry, "requirements");
  assert.equal(none.paramsFor().page, "Title of trace\nRequirements\nhttps://github.com/acme/instance\n");
  assert.equal(subjectOf({ route: trace(), params: {}, context: CONTEXT, drawn }).entry, "requirements");
  assert.equal(subjectOf({ route: route("beta", "tests"), params: {}, context: CONTEXT, drawn }).entry, "tests");
});

// TST-1228003 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; UC-030
// given: the review page with the routes `trace` (Requirements, entryShown by key), `schedule` (Tests) and `module` (Architecture)
// input: startPage at #trace/key=tests; the fragment changes to #trace/key=audit/ref=v1, to #trace/key=modules, to #trace/key=specification, to #trace/key=none, then to #trace
// expect: the menu marks tests, tests, architecture, requirements, requirements, requirements — one entry each time; the route rendered is `trace` each time
// Planted fault: a menu marked by the route's `entry` marks requirements at #trace/key=tests, #trace/key=audit and #trace/key=modules.
test("TST-1228003 the menu marks the entry the route's entryShown gives, else the route's entry", async () => {
  const page = await start({ fragment: "#trace/key=tests", views: [trace(), route("schedule", "tests"), route("module", "architecture")] });
  assert.deepEqual(marked(page), ["tests"], "#trace/key=tests");
  const steps = [["#trace/key=audit/ref=v1", ["tests"]], ["#trace/key=modules", ["architecture"]], ["#trace/key=specification", ["requirements"]],
    ["#trace/key=none", ["requirements"]], ["#trace", ["requirements"]]];
  for (const [fragment, expected] of steps) {
    changeFragment(page, fragment);
    await settle();
    assert.deepEqual(marked(page), expected, fragment);
  }
  assert.deepEqual(rendered.map((entry) => entry.name), ["trace", "trace", "trace", "trace", "trace", "trace"]);
});

// TST-1228004 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS
// given: the review page with the routes `trace` (Requirements, entryShown by key) and `schedule` (Tests); then with `trace` alone
// input: startPage at #tests; then at #trace/key=tests with `trace` alone
// expect: #tests renders `schedule`, the first route listed under Tests, not `trace`, and the menu marks tests; with `trace` alone the menu's Tests is a span of class soon titled not built yet (menuOf counts only `entry`), Requirements is a link to #requirements, and no entry is marked — not Requirements
// Planted fault: a menu marked by the route's `entry` marks requirements with `trace` alone; a menuOf counting entryShown makes Tests a link.
test("TST-1228004 menuOf counts only entry, and a fragment naming an entry opens its first route", async () => {
  const both = await start({ fragment: "#tests", views: [trace(), route("schedule", "tests")] });
  assert.deepEqual(rendered.map((entry) => entry.name), ["schedule"]);
  assert.deepEqual(marked(both), ["tests"]);
  const alone = await start({ fragment: "#trace/key=tests", views: [trace()] });
  const tests = itemOf(alone, "tests");
  assert.equal(tests.localName, "span");
  assert.equal(tests.className, "soon");
  assert.match(tests.getAttribute("title"), /not built yet/);
  assert.equal(itemOf(alone, "requirements").getAttribute("href"), "#requirements");
  assert.deepEqual(marked(alone), []);
});
