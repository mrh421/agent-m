// Release tests of ITM-1267 — a view's routes are stand-ins and a route's own file is imported when the route is first shown (MOD-site-frame, Route `module`). The behaviour is what a person sees of the pages
// once the routes are loaded that way: the use-case pages of UC-008 (docs/use-cases/UC-008-review-and-accept-a-use-case.md, steps 1 and 2, and 2a) and the look every page shares (SPEC.md, EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE).
// Run: node --test tests/release-itm-1267-routes-load-on-first-show.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-008
// Level: release
//
// Written for the release testing of sprint 137 by a participant who implemented none of ITM-1267 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the page tests' (tests/app-harness.mjs: the real app
// src/site-frame/dashboard-app.mjs over a counting fake GitHub) with the fixture product tests/fixtures/architecture. Each address below is moved to from the one before it, so that its route's own file is imported by that move
// (the harness opens each address once per process). Readings the texts leave open, which the cases state:
//   - "uses the site's style sheets only" (the requirement's check, tests/site-usability.test.mjs): the page shown holds no `<style>` element and the page links no style sheet beside the site's own, which the harness lists as `stylesheets()`.
//     The width of a phone, the target size and the reflow are measured in a browser by tests/site-usability.test.mjs on every route; the harness has no layout, so these cases do not measure them.
//   - UC-008's statuses are the badges of the fixture's records: UC-001 accepted, UC-002 accepted in an earlier text and edited since (changed since acceptance), with the difference to that earlier text above its text (2a).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blobSha } from "../src/text-tools/index.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";
import { repoServer, openDashboard } from "./app-harness.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";

/** The product: UC-001 accepted, UC-002 accepted in an earlier text (the server's history) and edited since. */
async function world() {
  const files = { ...base, "docs/use-cases/README.md": "# Use cases\n", "docs/approvals/README.md": "# Approval records\n" };
  const history = [];
  const record = async (id, path, text) => {
    const blob = await blobSha(text);
    if (text !== files[path]) history.push(text);
    files[approvalPath(id, blob)] = recordText(reviewedRecord(path, blob));
  };
  await record("UC-001", UC1, files[UC1]);
  await record("UC-002", UC2, files[UC2].replace("Show the status", "Show a status"));
  return openDashboard({ server: await repoServer({ files, history, handlers: [] }), hash: "#uc" });
}

// The page's text without its folded explanations, which hold a sentence about style the route does not draw.
const withoutExplanations = (html) => html.replace(/<details class="explain">.*?<\/details>/gs, "");
/** What offends the look the pages share, in a page's HTML and the style sheets it linked: an embedded <style>, a style sheet linked beside the site's. */
const lookFindings = (html, sheets) => [...(/<style\b/i.test(html) ? ["a <style> element"] : []), ...sheets.map((sheet) => `a style sheet linked: ${sheet}`)];
/** What UC-008's steps 1 and 2 show of the fixture: each use case's status badge in the list, and the page of one with its status. */
const badgeOf = (html, id) => new RegExp(`<a href="#use-case/id=${id}">${id}</a></td><td>[^<]*</td><td><span class="badge (b-[a-z]+)">([^<]*)</span>`).exec(html)?.slice(1) ?? null;

// The imported route of a view, whose render a fault is planted in.
async function importedRoute(slug, name) {
  const { view } = await import(`../src/${slug}/index.mjs`);
  return await view.routes.find((route) => route.name === name).module();
}

// TST-1267201 · level: release · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the live app on the fixture product, a token stored, opened at #uc (the review-pages view's route use-case); known positive: the planted fault below is found by the same check
// input: the fragment moved in turn to #uc/UC-001, #arc, #arc/MOD-reader and #settings (a route of the settings-pages view, whose own file is imported by that move), #endpoints and #add
// expect: each address shows its heading ("UC-001 Read a file", "Architecture decisions", "MOD-reader Reads files at a pinned commit", "Settings", "Configure a model endpoint", "Add a product"); on none the page holds a <style> element or links a style sheet, and the styles linked after the last equal those after the first
// Planted fault: the settings route's render (imported by the move to #settings) appending a <style> element to the page fails the case on #settings, and the check names it.
test("TST-1267201 the routes imported when first shown draw with the site's style sheets only", async () => {
  const page = await world();
  const before = page.stylesheets();
  const shown = [["#uc/UC-001", "UC-001 Read a file"], ["#arc", "Architecture decisions"], ["#arc/MOD-reader", "MOD-reader Reads files at a pinned commit"],
    ["#settings", "Settings"], ["#endpoints", "Configure a model endpoint"], ["#add", "Add a product"]];
  assert.deepEqual(lookFindings("<p>x</p><style>.x{}</style>", ["https://example.org/x.css"]), ["a <style> element", "a style sheet linked: https://example.org/x.css"], "known positive: the check finds a planted style");
  for (const [address, heading] of shown) {
    await page.go(address);
    const html = withoutExplanations(page.main());
    assert.ok(html.includes(heading), `${address} shows ${heading}`);
    assert.deepEqual(lookFindings(html, page.stylesheets()), [], address);
  }
  assert.deepEqual(page.stylesheets(), before, "no route linked a style sheet");
});

// TST-1267203 · level: release · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the app of TST-1267201 with the imported route of #settings drawing a <style> element after its page
// input: the fragment moved to #settings
// expect: the check of TST-1267201 finds one finding on that page, a <style> element, and no other
test("TST-1267203 counter-proof of TST-1267201: a route's own file that draws a <style> element is found on that page", async () => {
  const page = await world();
  const settings = await importedRoute("settings-pages", "settings");
  const drawn = settings.render;
  settings.render = async (target, context, params) => { await drawn.call(settings, target, context, params); target.innerHTML += "<style>.planted{}</style>"; };
  try {
    await page.go("#settings");
    assert.deepEqual(lookFindings(withoutExplanations(page.main()), page.stylesheets()), ["a <style> element"]);
  } finally { settings.render = drawn; }
});

// TST-1267202 · level: release · module: MOD-site-frame
// guards: UC-008
// given: the live app on the fixture product, UC-001 accepted and UC-002 changed since its acceptance, a token stored; opened at #uc; known positive: UC-008 steps 1 and 2 on the fixture hold before the move to another view and back
// input: step 1, the list at #uc; step 2, #uc/UC-001; 2a, #uc/UC-002; then #settings (another view's route, imported by the move) and back to #uc and #uc/UC-002
// expect: the list shows UC-001 as accepted and UC-002 as changed since acceptance, and "Review all 1 not accepted"; UC-001's page shows "UC-001 Read a file", the badge accepted and its text; UC-002's page shows the badge changed since acceptance, the difference to the last accepted text (title "Show a status" removed, "Show the status" added) and its text; after the move to #settings and back the same
// Planted fault: the use-case route's render (imported when #uc is first shown) drawing every badge as open fails the case on the list's statuses and on UC-001's badge.
test("TST-1267202 the use-case pages show each use case with its derived status, its text and the difference since acceptance", async () => {
  const page = await world();
  const steps = async () => {
    await page.go("#uc");
    const list = withoutExplanations(page.main());
    assert.deepEqual(badgeOf(list, "UC-001"), ["b-accepted", "accepted"]);
    assert.deepEqual(badgeOf(list, "UC-002"), ["b-changed", "changed since acceptance"]);
    assert.match(list, /Review all 1 not accepted/);
    await page.go("#uc/UC-001");
    const one = withoutExplanations(page.main());
    assert.match(one, /<h2>UC-001 Read a file<\/h2><span class="badge b-accepted">accepted<\/span>/);
    assert.match(one, /# UC-001 Read a file/, "its text is shown");
    await page.go("#uc/UC-002");
    const changed = withoutExplanations(page.main());
    assert.match(changed, /<span class="badge b-changed">changed since acceptance<\/span>/);
    assert.match(changed, /<span class="ddel">- title: Show a status<\/span>/);
    assert.match(changed, /<span class="dadd">\+ title: Show the status<\/span>/);
    assert.match(changed, /# UC-002 Show the status/, "its text is shown");
  };
  await steps();
  await page.go("#settings");
  assert.match(page.main(), /<h2>Settings<\/h2>/);
  await steps();
});

// TST-1267204 · level: release · module: MOD-site-frame
// guards: UC-008
// given: the app of TST-1267202 with the imported route of the use cases drawing every status badge as open
// input: the fragment moved to #arc and on to #uc
// expect: UC-001's badge in the list is open, not accepted: the check of TST-1267202 on the list's statuses fails on that page
test("TST-1267204 counter-proof of TST-1267202: a use-case route that draws every status as open is found", async () => {
  const page = await world();
  const route = await importedRoute("review-pages", "use-case");
  const drawn = route.render;
  route.render = async (target, context, params) => { await drawn.call(route, target, context, params); target.innerHTML = target.innerHTML.replace(/badge b-(accepted|changed)">[^<]*/g, 'badge b-open">open'); };
  try {
    await page.go("#arc");
    await page.go("#uc");
    const list = withoutExplanations(page.main());
    assert.deepEqual(badgeOf(list, "UC-001"), ["b-open", "open"], "the planted fault is drawn");
    assert.notDeepEqual(badgeOf(list, "UC-001"), ["b-accepted", "accepted"]);
  } finally { route.render = drawn; }
});
