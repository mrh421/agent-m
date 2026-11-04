// The live dashboard reaches MOD-maintenance-pages' route `replies` (ITM-1103), as it reaches `mail` (ITM-1099, tests/site-frame-maintenance-menu.test.mjs) —
// MOD-site-frame.md:109-110: the page names the view modules it loads in `data-views`, `maintenance-pages` among them; and :94: `src/site/views.mjs` and
// `docs/assets/dashboard/built.json`, taken over by MOD-site-frame, list the views the live app builds. The view is a built-in one without a file of its own, the app
// hands its address to the module's route, and the menu entry Maintenance is the one marked on it.
// Run: node --test tests/site-frame-replies-menu.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-039; THE MENU FOLLOWS THE PROCESS
// Level: unit
//
// The readings the pull request names: the menu has one entry per stage, not one link per route, so "the menu offers #replies" is that the entry Maintenance is the entry of
// the address #replies (it is marked on it) while its link stays #mail, the first of its views that is built; the table's view `mail-replies`, whose file never existed, is
// the view `replies`, the name of the route. The table and the menu are read as they are; the live app runs in tests/app-harness.mjs against the GitHub API mock of
// tests/load-per-view.test.mjs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DASHBOARD, builtViews } from "../src/site/views.mjs";
import { MENU, entryOf, stageView } from "../src/site/menu.mjs";
import { repoServer, openDashboard } from "./app-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const builtFiles = JSON.parse(readFileSync(new URL("docs/assets/dashboard/built.json", ROOT), "utf8"));
const maintenance = MENU.find((entry) => entry.key === "maintenance");

// TST-1103001 · level: unit · module: MOD-site-frame
// guards: UC-039; THE MENU FOLLOWS THE PROCESS
// given: the table of the dashboard's views, the list built.json and the menu that follows the process
// input: the view `replies` in DASHBOARD, builtViews(built.json), entryOf and stageView for the entry Maintenance
// expect: the view is a built-in one without a file of its own, for UC-039, and counts as built; the table names no view mail-replies; the address #replies belongs to the entry Maintenance, whose link stays the first built view, mail; built.json names no file for either
// Planted fault: leaving the table as it is (mail-replies with a file) makes replies unbuilt and unknown to the menu.
test("TST-1103001 the view replies is built in, counted as built and belongs to the menu entry Maintenance", () => {
  const replies = DASHBOARD.find((entry) => entry.view === "replies");
  assert.ok(replies, "the table names the view replies");
  assert.equal(replies.builtIn, true);
  assert.equal(replies.file, undefined);
  assert.deepEqual(replies.useCases, ["UC-039"]);
  assert.equal(DASHBOARD.find((entry) => entry.view === "mail-replies"), undefined, "the view mail-replies, whose file never existed, is gone");
  const built = builtViews(builtFiles);
  assert.ok(built.has("replies"));
  assert.equal(entryOf("replies"), "maintenance");
  assert.equal(stageView(maintenance, built), "mail", "the entry's link stays the first of its views that is built");
  assert.ok(!builtFiles.some((file) => /replies/.test(file)));
});

// TST-1103002 · level: unit · module: MOD-site-frame
// guards: UC-039
// given: counter-proof of TST-1103001: the table without the entry of the view replies; and the menu without replies among Maintenance's views
// input: builtViews over the table, entryOf over the menu
// expect: without the table's entry `replies` is not built; without the menu's view the address #replies belongs to no entry; the known positives: `mail` is built, entryOf("mail") is maintenance
// Planted fault: a table or a menu that lists replies where the test removes it makes the known negative fail.
test("TST-1103002 counter-proof: without the table's entry replies is not built, and without the menu's view it belongs to no entry", () => {
  const without = DASHBOARD.filter((entry) => entry.view !== "replies");
  const builtWithout = new Set(without.filter((entry) => entry.view && (entry.builtIn || builtFiles.includes(entry.file))).map((entry) => entry.view));
  assert.ok(!builtWithout.has("replies"));
  assert.ok(builtWithout.has("mail"), "known positive: mail is built");
  const menuWithout = MENU.map((entry) => ({ ...entry, views: entry.views.filter((view) => view !== "replies") }));
  assert.equal(menuWithout.find((entry) => entry.views.includes("replies")), undefined, "known negative: no entry holds replies");
  assert.equal(menuWithout.find((entry) => entry.views.includes("mail"))?.key, "maintenance", "known positive: mail is in Maintenance");
});

// TST-1103003 · level: unit · module: MOD-site-frame
// guards: UC-039; THE MENU FOLLOWS THE PROCESS
// given: the live app on a product, a token stored
// input: the dashboard opened at #replies, and at #replies/issue=7
// expect: the main area shows the route's page: its button Read replies, not the use-case list; at #replies/issue=7 too (the route is given the parameter issue); the menu still links #mail for Maintenance
// Planted fault: an app that does not dispatch the address shows the use cases instead.
test("TST-1103003 the live app opens #replies on MOD-maintenance-pages' route", async () => {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
  const srv = await repoServer({ files, history: [], handlers: [] });
  const page = await openDashboard({ server: srv, hash: "#replies" });
  assert.match(page.main(), /Read replies/);
  assert.doesNotMatch(page.main(), /#use-case\/id=UC-001"/, "not the use-case list");
  const tabs = [...page.el("tabs").matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(tabs.includes("mail"), `Maintenance links #mail: ${tabs.join(", ")}`);
  const issue = await openDashboard({ server: srv, hash: "#replies/issue=7" });
  assert.match(issue.main(), /Read replies/);
});

// TST-1105001 · level: unit · module: MOD-site-frame
// guards: UC-039
// given: the live app on a product, a token stored; the route `replies` of MOD-maintenance-pages recording what it is rendered with
// input: the dashboard opened at #replies/issue=12/product=https://github.com/acme/product-alpha, then at #replies
// expect: the route is rendered once with the parameters { issue: "12", product: "https://github.com/acme/product-alpha" }, and for #replies with none; the page shown is the route's
// Planted fault: the dispatch without the address's parameters (`{}` in place of `routeOf(location.hash).params`) renders the route with none for the first address, and the first assertion fails.
// The reading the pull request names: the live app writes and reads a route's parameters as `key=value` (routing.mjs routeOf and fragmentOf), as the route's own `go("replies", { issue, product })` does; the module text's `replies/<issue>` is its notation for the route with the parameter issue.
test("TST-1105001 the live app hands the issue of #replies/issue=<n> to the route", async () => {
  const { view } = await import("../src/maintenance-pages/index.mjs");
  const route = view.routes.find((candidate) => candidate.name === "replies");
  const original = route.render;
  const seen = [];
  route.render = async (target, context, params) => { seen.push(params); target.innerHTML = "<p>Read replies (recorded)</p>"; };
  try {
    const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
    const files = {};
    // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
    (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
    const product = await repoServer({ repo: "acme/product-alpha", files, history: [], handlers: [] });
    const srv = await repoServer({ files, history: [], handlers: [(url, init) =>
      url.origin === "https://api.github.com" && url.pathname.startsWith("/repos/acme/product-alpha/") ? product.fetch(url.href, init) : undefined] });
    const withIssue = await openDashboard({ server: srv, hash: "#replies/issue=12/product=https%3A%2F%2Fgithub.com%2Facme%2Fproduct-alpha" });
    assert.match(withIssue.main(), /recorded/);
    assert.deepEqual(seen, [{ issue: "12", product: "https://github.com/acme/product-alpha" }]);
    await openDashboard({ server: srv, hash: "#replies" });
    assert.deepEqual(seen.at(-1), {});
    assert.equal(seen.length, 2);
  } finally { route.render = original; }
});
