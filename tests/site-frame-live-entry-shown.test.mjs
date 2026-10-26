// The live page's app marks the entry of the page shown (ITM-1228), by the same rule as the frame's pages: MOD-site-frame.md, Parts, taken over,
// `src/site-frame/dashboard-app.mjs`: "for a route of a loaded view it shows, `#trace` among them, the entry it marks in the menu and gives the bar's
// subject is the entry of the page shown, by the same rule as on the frame's pages — the route's `entryShown`, else its `entry` —, in place of the lookup by
// view name of `src/site/menu.mjs`".
//
// Run: node --test tests/site-frame-live-entry-shown.test.mjs
//
// Module: MOD-site-frame
// Guards: THE MENU FOLLOWS THE PROCESS; UC-029; UC-030
// Level: unit
//
// The live app runs in tests/app-harness.mjs against the GitHub API mock of tests/load-per-view.test.mjs, on the fixture architecture; MOD-trace-pages' route
// `trace` has its `render` replaced by one that records what it is given, so that the test reads the app's menu and not the route's page. The readings the
// pull request names: the app marks an entry by toggling the class `active` on each element `.tabs [data-entry]` of the document, and the harness's
// document answers that selector with nothing; the test answers it with one element per entry of the menu, which records the toggles, and reads the entries
// whose last toggle set `active`. The counter-proof is recorded in the pull request: before the change #trace/key=tests marks nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard } from "./app-harness.mjs";

const KEYS = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"];

function fixtureFiles() {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/")] = readFileSync(path, "utf8"); } })(FIX);
  return files;
}

// The elements of the menu's entries, each recording whether the app last marked it; marked() the keys marked now.
function menuElements() {
  const active = new Map();
  const items = KEYS.map((entry) => ({ dataset: { entry }, classList: { toggle(name, on) { if (name === "active") active.set(entry, Boolean(on)); } } }));
  return { items, marked: () => KEYS.filter((key) => active.get(key) === true) };
}

// TST-1228007 · level: unit · module: MOD-site-frame
// guards: THE MENU FOLLOWS THE PROCESS; UC-029; UC-030
// given: the live app on the instance, a token stored; MOD-trace-pages' route trace recording what it is rendered with; the menu's eight entries
// input: the dashboard opened at #trace/key=specification; the fragment changes to #trace/key=tests, to #trace/key=audit/ref=v2026.1.0, to #trace/key=modules and to #trace/key=nothing-like-this
// expect: the menu marks tests, tests, architecture, then requirements — one entry each time; each address renders the route trace
// Planted fault: an app that looks the entry up by view name in src/site/menu.mjs marks nothing at #trace/key=tests, #trace/key=audit and #trace/key=modules.
test("TST-1228007 the live app marks Tests on #trace with the key tests", async () => {
  const { view } = await import("../src/trace-pages/index.mjs");
  const trace = view.routes.find((candidate) => candidate.name === "trace");
  const original = trace.render;
  const seen = [];
  trace.render = async (target, context, params) => { seen.push(params); target.innerHTML = "<p>route trace (recorded)</p>"; };
  try {
    const srv = await repoServer({ files: fixtureFiles(), history: [], handlers: [] });
    const page = await openDashboard({ server: srv, hash: "#trace/key=specification" });
    const menu = menuElements();
    const answer = globalThis.document.querySelectorAll;
    globalThis.document.querySelectorAll = (selector) => (selector === ".tabs [data-entry]" ? menu.items : answer(selector));
    const steps = [["#trace/key=tests", ["tests"]], ["#trace/key=audit/ref=v2026.1.0", ["tests"]], ["#trace/key=modules", ["architecture"]],
      ["#trace/key=nothing-like-this", ["requirements"]]];
    for (const [fragment, expected] of steps) {
      await page.go(fragment);
      assert.match(page.main(), /route trace \(recorded\)/, fragment);
      assert.deepEqual(menu.marked(), expected, fragment);
    }
    assert.deepEqual(seen.slice(-4).map((params) => params.key), ["tests", "audit", "modules", "nothing-like-this"]);
  } finally { trace.render = original; }
});
