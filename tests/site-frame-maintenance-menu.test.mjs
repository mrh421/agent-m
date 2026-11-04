// The live dashboard reaches MOD-maintenance-pages' route `mail` from its menu (ITM-1099) — MOD-site-frame.md:109-110: the page names the view modules it loads in `data-views`, `maintenance-pages` among them; and
// :94: `src/site/views.mjs` and `docs/assets/dashboard/built.json`, taken over by MOD-site-frame, list the views the live app builds. As ITM-682 took this step for the release panel (TST-682002): the view is a built-in one
// without a file of its own, the app hands its address to the module's route, and the menu entry Maintenance opens it.
// Run: node --test tests/site-frame-maintenance-menu.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-038; THE MENU FOLLOWS THE PROCESS
// Level: unit
//
// The table and the menu are read as they are; the live app (src/site-frame/dashboard-app.mjs) runs in tests/app-harness.mjs against the GitHub API mock of tests/load-per-view.test.mjs. Readings the texts leave open, which the tests state
// (the pull request names them): the menu entry Maintenance opens the first of its views that is built, as every entry does (src/site/menu.mjs stageView), so with `issues` not built it opens `mail`; the view `mail-replies` and the route
// `replies` are ITM-966's. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DASHBOARD, builtViews } from "../src/site/views.mjs";
import { MENU, stageView } from "../src/site/menu.mjs";
import { repoServer, openDashboard } from "./app-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const builtFiles = JSON.parse(readFileSync(new URL("docs/assets/dashboard/built.json", ROOT), "utf8"));
const maintenance = MENU.find((entry) => entry.key === "maintenance");

// TST-1099001 · level: unit · module: MOD-site-frame
// guards: UC-038; THE MENU FOLLOWS THE PROCESS
// given: the table of the dashboard's views, the list built.json and the menu that follows the process
// input: the view `mail` in DASHBOARD, builtViews(built.json), the menu's entry Maintenance
// expect: the view is a built-in one without a file of its own, it counts as built, and the menu opens it for the entry Maintenance; built.json names no file for it
test("TST-1099001 the view mail is built in, counted as built and opened by the menu entry Maintenance", () => {
  const mail = DASHBOARD.find((entry) => entry.view === "mail");
  assert.ok(mail, "the table names the view mail");
  assert.equal(mail.builtIn, true);
  assert.equal(mail.file, undefined);
  const built = builtViews(builtFiles);
  assert.ok(built.has("mail"));
  assert.equal(stageView(maintenance, built), "mail");
  assert.ok(!builtFiles.some((file) => /^mail/.test(file)));
});

// TST-1099002 · level: unit · module: MOD-site-frame
// guards: UC-038
// given: counter-proof of TST-1099001: the table without the entry of the view mail; and the list of built files empty
// input: builtViews over each, the menu's entry Maintenance
// expect: without the entry `mail` is not built and the entry Maintenance opens nothing (the address #mail is not found); with the table and no file named a view with a file (jobs) is not built, and mail still is (by being built in)
test("TST-1099002 counter-proof: without the table's entry the menu does not open the view mail", () => {
  const without = DASHBOARD.filter((entry) => entry.view !== "mail" && entry.view !== "replies"); // replies (ITM-1103) is the entry's next view
  const builtWithout = new Set(without.filter((entry) => entry.view && (entry.builtIn || builtFiles.includes(entry.file))).map((entry) => entry.view));
  assert.ok(!builtWithout.has("mail"));
  assert.equal(stageView(maintenance, builtWithout), null, "known negative: nothing opens the entry");
  const none = builtViews([]);
  assert.ok(!none.has("jobs"), "known positive: jobs has a file that is not named");
  assert.ok(none.has("mail"));
});

// TST-1099003 · level: unit · module: MOD-site-frame
// guards: UC-038; THE MENU FOLLOWS THE PROCESS
// given: the live app on a product, a token stored
// input: the dashboard opened at #mail
// expect: the menu has a tab linking #mail; the main area shows the route's page: its heading Mail and its button Read mailbox, not the use-case list
test("TST-1099003 the live app opens #mail on MOD-maintenance-pages' route and its menu links it", async () => {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
  const srv = await repoServer({ files, history: [], handlers: [] });
  const page = await openDashboard({ server: srv, hash: "#mail" });
  const tabs = [...page.el("tabs").matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(tabs.includes("mail"), `the menu links #mail: ${tabs.join(", ")}`);
  assert.match(page.main(), /Read mailbox/);
  assert.doesNotMatch(page.main(), /#use-case\/id=UC-001"/, "not the use-case list");
});
