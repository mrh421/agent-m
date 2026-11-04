// The live dashboard reaches MOD-test-pages' routes `runs`, `schedule` and `generate`, and MOD-trace-pages' route `trace` for its own fragment (ITM-1206), as it reaches
// `release` (ITM-682) and `mail` (ITM-1099, tests/site-frame-maintenance-menu.test.mjs) — MOD-site-frame.md, Data: the page names the view modules it loads in
// `data-views`, `test-pages` and `trace-pages` among them; and Parts, taken over: `src/site/views.mjs` and `docs/assets/dashboard/built.json` list the views the live
// app builds. Each view is a built-in one without a file of its own, the app hands its address to the module's route, and the menu entry Tests opens `schedule`,
// the setup of the batteries first (ITM-1224).
// Run: node --test tests/site-frame-tests-menu.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-026; UC-027; UC-028; UC-029; UC-030; THE MENU FOLLOWS THE PROCESS
// Level: unit
//
// The readings the pull request names: the frame writes and reads a route's parameters as `key=value` (routing.mjs routeOf and fragmentOf), as the route's own
// `go("runs", { commit })` does, so the module text's `runs/<commit>` is the route `runs` with the parameter commit; the context the routes are given is the frame's
// ViewContext with the product shown — the instance itself included, since the test pages work on a product's files and say so where none is given; `#trace/…` is
// given the parameters its fragment holds, and, where the fragment names no `ref`, the ref the page shows, as the app hands it to the route under `#spec` and `#arc`.
// The menu has one entry per stage: the entry Tests opens `schedule`, the first of its views, and is the entry marked on `#runs` and `#generate`. The table and the
// menu are read as they are; the live app runs in tests/app-harness.mjs against the GitHub API mock of tests/load-per-view.test.mjs; each route's `render` is
// replaced by one that records what it is given, so that these tests read the frame's dispatch and not the routes' pages. The counter-proofs are recorded in the
// pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DASHBOARD, builtViews } from "../src/site/views.mjs";
import { MENU, entryOf, menuHtml, stageView } from "../src/site/menu.mjs";
import { repoServer, openDashboard, REPO } from "./app-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const builtFiles = JSON.parse(readFileSync(new URL("docs/assets/dashboard/built.json", ROOT), "utf8"));
const tests = MENU.find((entry) => entry.key === "tests");
const ROUTES = { runs: ["UC-028"], schedule: ["UC-027"], generate: ["UC-026"], trace: ["UC-029", "UC-030"] };
const GONE = ["tests", "tests-schedule", "tests-generate", "tests-browser", "audit"];

function fixtureFiles() {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
  return files;
}

// Each named route of a view module renders a marker and records what it is given; restore() puts the routes' own render back.
async function recording(module, names) {
  const { view } = await import(module);
  const seen = [];
  const originals = names.map((name) => {
    const route = view.routes.find((candidate) => candidate.name === name);
    assert.ok(route, `${module} has the route ${name}`);
    const original = route.render;
    route.render = async (target, context, params) => { seen.push({ name, context, params }); target.innerHTML = `<p>route ${name} (recorded)</p>`; };
    return [route, original];
  });
  return { seen, restore: () => { for (const [route, original] of originals) route.render = original; } };
}

// The context every route is given: the frame's ViewContext of the review pages, with the product shown.
function assertViewContext(context) {
  assert.equal(context.page, "review");
  assert.equal(context.instance.repository, REPO);
  assert.equal(typeof context.instance.host?.readSnapshot, "function", "the instance's host");
  assert.equal(typeof context.product?.host?.readSnapshot, "function", "the product shown, with its host");
  assert.ok(context.store, "the browser's store");
  assert.equal(typeof context.go, "function");
}

// TST-1302003 · level: unit · module: MOD-site-frame
// guards: UC-026; UC-027; UC-028; UC-029; UC-030; THE MENU FOLLOWS THE PROCESS
// given: the table of the dashboard's views, the list built.json and the menu that follows the process
// input: the views runs, schedule, generate and trace in DASHBOARD, the views whose files were never built, builtViews(built.json), stageView and entryOf for the entry Tests
// expect: runs, schedule, generate and trace are built-in views without a file, for their use cases, and count as built; tests, tests-schedule, tests-generate, tests-browser and audit are no view of the table; the entry Tests opens schedule, and #runs and #generate belong to it; built.json names no file for any of them
// Planted fault: leaving the table as it is (tests with the file tests-runs-view.mjs) makes the entry Tests open nothing; the entry's views in the order runs,
//   schedule, generate make it open runs.
test("TST-1302003 the test pages' routes and the trace route are built in, and the menu entry Tests opens schedule", () => {
  const built = builtViews(builtFiles);
  for (const [view, useCases] of Object.entries(ROUTES)) {
    const entry = DASHBOARD.find((candidate) => candidate.view === view);
    assert.ok(entry, `the table names the view ${view}`);
    assert.equal(entry.builtIn, true, view);
    assert.equal(entry.file, undefined, view);
    assert.deepEqual(entry.useCases, useCases, view);
    assert.ok(built.has(view), `${view} counts as built`);
  }
  for (const view of GONE) assert.equal(DASHBOARD.find((candidate) => candidate.view === view), undefined, `the view ${view}, whose file was never built, is gone`);
  assert.equal(stageView(tests, built), "schedule");
  assert.equal(entryOf("runs"), "tests");
  assert.equal(entryOf("schedule"), "tests");
  assert.equal(entryOf("generate"), "tests");
  assert.ok(!builtFiles.some((file) => /^(tests|audit|runs|schedule|generate|trace)/.test(file)));
});

// TST-1206002 · level: unit · module: MOD-site-frame
// guards: UC-028; THE MENU FOLLOWS THE PROCESS
// given: counter-proof of TST-1302003: the table without the built-in views of the test pages
// input: builtViews over the table and over that table, stageView for the entry Tests over each
// expect: with the table the entry Tests opens schedule; without its built-in views none of runs, schedule, generate is built and the entry Tests opens nothing (the known negative); the known positive: release is still built, and the entry Releases opens it
// Planted fault: a table that keeps one of the views where the test removes it makes the known negative fail.
test("TST-1206002 counter-proof: without the table's built-in views the menu entry Tests opens nothing", () => {
  assert.equal(stageView(tests, builtViews(builtFiles)), "schedule", "with the table, the entry Tests opens schedule");
  const without = DASHBOARD.filter((entry) => !["runs", "schedule", "generate"].includes(entry.view));
  const builtWithout = new Set(without.filter((entry) => entry.view && (entry.builtIn || builtFiles.includes(entry.file))).map((entry) => entry.view));
  assert.equal(stageView(tests, builtWithout), null, "known negative: nothing opens the entry Tests");
  assert.ok(builtWithout.has("release"), "known positive: release is built");
  assert.equal(stageView(MENU.find((entry) => entry.key === "releases"), builtWithout), "release");
});

// TST-1224001 · level: unit · module: MOD-site-frame
// guards: UC-027; THE MENU FOLLOWS THE PROCESS
// given: the menu that follows the process, the views built as builtViews(built.json) gives them
// input: menuHtml over those views, the link of the entry Tests and of the entry Releases
// expect: the entry Tests names its views in the order schedule, runs, generate and links #schedule, the setup of the batteries first (UC-027 1: "Tests → Schedule"); the known positive: the entry Releases still links #release
// Planted fault: the entry's views in the order runs, schedule, generate make its link #runs.
test("TST-1224001 the menu's entry Tests links #schedule", () => {
  assert.deepEqual(tests.views, ["schedule", "runs", "generate"]);
  const html = menuHtml({ built: builtViews(builtFiles) });
  const linkOf = (key) => new RegExp(`<a href="#([^"]+)"[^>]*data-entry="${key}"`).exec(html)?.[1] ?? null;
  assert.equal(linkOf("tests"), "schedule");
  assert.equal(linkOf("releases"), "release", "known positive: the entry Releases links #release");
});

// TST-1206003 · level: unit · module: MOD-site-frame
// guards: UC-028; THE MENU FOLLOWS THE PROCESS
// given: the live app on the instance, a token stored; MOD-test-pages' routes schedule and runs recording what they are rendered with
// input: the dashboard opened at #tests, at #runs and at #runs/commit=<sha>; the route's go("runs", { commit })
// expect: the menu's entry Tests links #schedule, and #tests renders the route schedule with no parameter (ITM-1224); #runs renders the route runs with no parameter, #runs/commit=<sha> with { commit } — each with the frame's ViewContext, the product shown included; go writes #runs/commit=<sha>; the page shows the route, not the use cases or "not built yet"
// Planted fault: an app without the dispatch says "The Tests entry is not built yet." at #tests and shows the use cases at #runs; the entry's views in the order
//   runs, schedule, generate make the entry link #runs and #tests render runs.
test("TST-1206003 the menu entry Tests opens MOD-test-pages' route schedule, and #runs/commit=<sha> hands the commit to the route runs", async () => {
  const { seen, restore } = await recording("../src/test-pages/index.mjs", ["runs", "schedule"]);
  try {
    const srv = await repoServer({ files: fixtureFiles(), history: [], handlers: [] });
    const page = await openDashboard({ server: srv, hash: "#tests" });
    const entry = /<a href="#([^"]+)"[^>]*data-entry="tests"/.exec(page.el("tabs"));
    assert.equal(entry?.[1], "schedule", `the entry Tests links #schedule: ${page.el("tabs")}`);
    assert.match(page.main(), /route schedule \(recorded\)/);
    assert.doesNotMatch(page.main(), /not built yet/);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].name, "schedule");
    assert.deepEqual(seen[0].params, {});
    assertViewContext(seen[0].context);
    const sha = "a".repeat(40);
    const runs = await openDashboard({ server: srv, hash: "#runs" });
    assert.match(runs.main(), /route runs \(recorded\)/);
    assert.equal(seen.at(-1).name, "runs");
    assert.deepEqual(seen.at(-1).params, {});
    const withCommit = await openDashboard({ server: srv, hash: `#runs/commit=${sha}` });
    assert.match(withCommit.main(), /route runs \(recorded\)/);
    assert.deepEqual(seen.at(-1).params, { commit: sha });
    seen.at(-1).context.go("runs", { commit: sha });
    assert.equal(globalThis.location.hash, `#runs/commit=${sha}`);
  } finally { restore(); }
});

// TST-1206004 · level: unit · module: MOD-site-frame
// guards: UC-026; UC-027; THE MENU FOLLOWS THE PROCESS
// given: the live app on the instance, a token stored; MOD-test-pages' routes schedule and generate recording what they are rendered with
// input: the dashboard opened at #schedule, then at #generate
// expect: each renders its route of that name, with no parameter and the frame's ViewContext; the page shows the route, not the use-case list
// Planted fault: an app without the dispatch shows the use cases at both addresses.
test("TST-1206004 #schedule and #generate render MOD-test-pages' routes of those names", async () => {
  const { seen, restore } = await recording("../src/test-pages/index.mjs", ["schedule", "generate"]);
  try {
    const srv = await repoServer({ files: fixtureFiles(), history: [], handlers: [] });
    for (const name of ["schedule", "generate"]) {
      const page = await openDashboard({ server: srv, hash: `#${name}` });
      assert.match(page.main(), new RegExp(`route ${name} \\(recorded\\)`));
      assert.doesNotMatch(page.main(), /#use-case\/id=UC-001"/, "not the use-case list");
      assert.equal(seen.at(-1).name, name);
      assert.deepEqual(seen.at(-1).params, {});
      assertViewContext(seen.at(-1).context);
    }
    assert.equal(seen.length, 2);
  } finally { restore(); }
});

// TST-1206005 · level: unit · module: MOD-site-frame
// guards: UC-029; UC-030
// given: the live app on the instance, a token stored, its default branch main; MOD-trace-pages' route trace recording what it is rendered with
// input: the dashboard opened at #trace/key=tests, and at #trace/key=audit/ref=v2026.1.0/commit=<sha>, the link embedRoute puts into the release panel
// expect: each renders the route trace with the parameters its fragment holds, the ref the page shows where it names none: { key: "tests", ref: "main" }, and { key: "audit", ref: "v2026.1.0", commit: <sha> }; with the frame's ViewContext, not the use-case list
// Planted fault: an app without the dispatch shows the use cases at both addresses.
test("TST-1206005 #trace with key=tests and with key=audit renders MOD-trace-pages' route trace", async () => {
  const { seen, restore } = await recording("../src/trace-pages/index.mjs", ["trace"]);
  try {
    const srv = await repoServer({ files: fixtureFiles(), history: [], handlers: [] });
    const browser = await openDashboard({ server: srv, hash: "#trace/key=tests" });
    assert.match(browser.main(), /route trace \(recorded\)/);
    assert.doesNotMatch(browser.main(), /#use-case\/id=UC-001"/, "not the use-case list");
    assert.deepEqual(seen.at(-1).params, { key: "tests", ref: "main" });
    assertViewContext(seen.at(-1).context);
    const sha = "b".repeat(40);
    const audit = await openDashboard({ server: srv, hash: `#trace/key=audit/ref=v2026.1.0/commit=${sha}` });
    assert.match(audit.main(), /route trace \(recorded\)/);
    assert.deepEqual(seen.at(-1).params, { key: "audit", ref: "v2026.1.0", commit: sha });
    assertViewContext(seen.at(-1).context);
    assert.equal(seen.length, 2);
  } finally { restore(); }
});
