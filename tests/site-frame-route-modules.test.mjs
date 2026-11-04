// The review page imports a route's own modules only when the route is first shown (MOD-site-frame.md, Interfaces: Route — "A route that names `module` is
// drawn from the route that `module` gives: its `name`, `entry`, `entryShown` and `title` stand in the view module, and the frame imports the rest when the
// route is first shown, embedded or asked for its subject, after it has asked for every module of it at once").
//
// Run: node --test tests/site-frame-route-modules.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: component
//
// The live app runs in tests/app-harness.mjs on the fixture architecture, as tests/site-frame-live-entry-shown.test.mjs runs it. Which modules the process
// loads is recorded by a load hook of node:module, registered before the app is imported: a module is loaded once per process, when it is first imported.
// The view modules (`routes.mjs` of each view folder) hold the routes' heads and are loaded at start; every other file of a view folder is a route's own, or (`index.mjs`) the view's strategies, imported for a job.
// The expected values are written from MOD-site-frame's Route and from the item's Acceptance, not read from the code.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard } from "./app-harness.mjs";

const ROOT = new URL("../", import.meta.url).href;
const loads = new Map();
registerHooks({ load(url, context, next) {
  if (url.startsWith(ROOT)) loads.set(url.slice(ROOT.length), (loads.get(url.slice(ROOT.length)) ?? 0) + 1);
  return next(url, context);
} });
const loadedUnder = (folders) => [...loads.keys()].filter((path) => folders.some((folder) => path.startsWith(folder)) && !path.endsWith("/routes.mjs")).sort();

function fixtureFiles() {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
  return files;
}

// The modules docs/index.html names, as data, for the route mail: paths relative to docs/, as the block writes them.
const mailData = () => JSON.parse(/<script type="application\/json" id="route-preloads">([\s\S]*?)<\/script>/.exec(readFileSync(new URL("../docs/index.html", import.meta.url), "utf8"))?.[1] ?? "{}").mail;

// TST-1267101 · level: component · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the live app on the instance with the fixture architecture, a token stored, no route shown before in this process
// input: the dashboard opened at #uc, then the fragment changed to #mail
// expect: after #uc no module under src/maintenance-pages/, src/settings-pages/ or src/mail-routes/ is loaded beyond the two view modules, while src/review-pages/flow.mjs is (known positive); after #mail every module docs/index.html names for the route mail is loaded, src/maintenance-pages/mail.mjs and src/mail-routes/index.mjs among them, each once
test("TST-1267101 #uc imports none of the mail and settings routes' modules, and #mail imports them, each once", async () => {
  const srv = await repoServer({ files: fixtureFiles(), history: [], handlers: [] });
  const page = await openDashboard({ server: srv, hash: "#uc" });
  assert.equal(loads.get("src/review-pages/flow.mjs"), 1, "known positive: #uc's own route file is recorded as loaded");
  assert.deepEqual(loadedUnder(["src/maintenance-pages/", "src/settings-pages/", "src/mail-routes/"]), []);
  await page.go("#mail");
  const named = (mailData()?.modules ?? []).map((path) => path.replace(/^\.\.\//, ""));
  assert.ok(named.includes("src/maintenance-pages/mail.mjs") && named.includes("src/mail-routes/index.mjs"), "docs/index.html names the route mail's modules");
  assert.deepEqual(named.filter((path) => loads.get(path) !== 1), [], "each module of the route mail is loaded once");
});
