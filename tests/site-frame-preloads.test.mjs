// MOD-site-frame's preloads.mjs: each entry page carries in its <head> the preloads of the files it loads as it starts — every module of its
// start, and every file those modules fetch as they are evaluated —, written by `node src/site-frame/preloads.mjs`, so that a browser asks
// for them at once instead of level by level. A page whose block differs from what preloads.mjs computes fails here, so a change that adds,
// moves or removes an import and leaves the block as it was fails its pull request.
//
// Run: node --test tests/site-frame-preloads.test.mjs
//
// Module: MOD-site-frame
// Guards: THE PAGES ROOT IS THE REPOSITORY ROOT; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The expected values are written here from MOD-site-frame's Parts (`preloads.mjs`) and from menuOf's "so that the main page loads none of
// their views"; none is read from a document.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ENTRY_PAGES, BEGIN, END, stalePages, withBlock, pageLoads } from "../src/site-frame/preloads.mjs";

const text = (page) => readFileSync(new URL(`../${page}`, import.meta.url), "utf8");

// TST-1290001 · level: unit · module: MOD-site-frame
// guards: THE PAGES ROOT IS THE REPOSITORY ROOT
// given: the entry pages index.html and docs/index.html as they stand in the repository
// input: stalePages()
// expect: no page — each page's block is the one preloads.mjs computes from the modules as they stand
test("TST-1290001 every entry page carries the preloads preloads.mjs computes", () => {
  assert.deepEqual(ENTRY_PAGES, ["index.html", "docs/index.html"]);
  assert.deepEqual(stalePages(), [], "run: node src/site-frame/preloads.mjs");
});

// TST-1290002 · level: unit · module: MOD-site-frame
// guards: THE PAGES ROOT IS THE REPOSITORY ROOT
// given: index.html with one of its modulepreload lines removed, and index.html without its block
// input: withBlock("index.html", page)
// expect: the page as it stands in the repository, in both cases — a missing line is put back, a missing block is put before </head>
test("TST-1290002 a block missing a line, or missing altogether, is written as preloads.mjs computes it", () => {
  const page = text("index.html");
  const line = page.split("\n").find((l) => l.includes('rel="modulepreload"') && l.includes("src/site-frame/index.mjs"));
  assert.ok(line, "index.html preloads src/site-frame/index.mjs");
  const lacking = page.replace(`${line}\n`, "");
  assert.notEqual(lacking, page);
  assert.equal(withBlock("index.html", lacking), page);
  const start = page.indexOf(BEGIN), end = page.indexOf(END) + END.length;
  const without = page.slice(0, page.lastIndexOf("\n", start) + 1) + page.slice(end + 1);
  assert.ok(!without.includes("modulepreload"));
  assert.equal(withBlock("index.html", without), page);
});

// TST-1290003 · level: unit · module: MOD-site-frame
// guards: THE PAGES ROOT IS THE REPOSITORY ROOT
// given: the two entry pages, index.html naming the view main-page and docs/index.html the review pages' views
// input: pageLoads(page)
// expect: index.html loads src/main-page/routes.mjs, the frame's start.mjs and the explanations the frame fetches, and none of the review pages' views; docs/index.html loads the review pages' views and the JSON of dashboard-app.mjs as a module
test("TST-1290003 each page preloads its own views and the files they fetch, and the main page none of the review pages' views", () => {
  const main = pageLoads("index.html");
  assert.ok(main.modules.includes("src/site-frame/start.mjs"));
  assert.ok(main.modules.includes("src/main-page/routes.mjs"));
  assert.ok(main.files.includes("src/site-frame/explanations.md"));
  for (const view of ["review-pages", "trace-pages", "implementation-pages", "test-pages", "maintenance-pages", "settings-pages"]) {
    assert.ok(!main.modules.includes(`src/${view}/routes.mjs`), `the main page preloads ${view}`);
  }
  const review = pageLoads("docs/index.html");
  for (const view of ["review-pages", "trace-pages", "implementation-pages", "test-pages", "maintenance-pages", "settings-pages"]) {
    assert.ok(review.modules.includes(`../src/${view}/routes.mjs`), `the review pages do not preload ${view}`);
  }
  assert.ok(review.modules.includes("assets/dashboard/built.json"));
  assert.match(text("docs/index.html"), /<link rel="modulepreload" as="json" href="assets\/dashboard\/built.json">/);
});

// What each route `module` of a page's views loads beyond the block, as the page holds it: the JSON of the block's element `route-preloads`, by route name.
const routeData = (page) => JSON.parse(/<script type="application\/json" id="route-preloads">([\s\S]*?)<\/script>/.exec(text(page))?.[1] ?? "{}");

// The files of each view folder that the routes' heads need, which the view module imports as it is loaded (MOD-site-frame.md, Interfaces: Route, "its `name`,
// `entry`, `entryShown` and `title` stand in the view module"): the view module itself (routes.mjs), the review pages' descriptors and the trace pages' descriptors.
const HEADS = { "review-pages": ["routes.mjs", "kinds.mjs"], "trace-pages": ["routes.mjs", "views.mjs"], "implementation-pages": ["routes.mjs"],
  "test-pages": ["routes.mjs"], "maintenance-pages": ["routes.mjs"], "settings-pages": ["routes.mjs"] };

// TST-1267001 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: docs/index.html as it stands, its views' routes each naming `module`
// input: pageLoads("docs/index.html").modules
// expect: no module under src/mail-routes/, and of each view folder only the files the routes' heads need; known positive: the page's data for the route mail names ../src/mail-routes/index.mjs
test("TST-1267001 the review page's block names no module that only a route's own file or src/mail-routes/ imports", () => {
  const { modules } = pageLoads("docs/index.html");
  assert.deepEqual(modules.filter((path) => path.startsWith("../src/mail-routes/")), []);
  for (const [view, heads] of Object.entries(HEADS)) {
    assert.deepEqual(modules.filter((path) => path.startsWith(`../src/${view}/`)).map((path) => path.slice(`../src/${view}/`.length)).sort(), [...heads].sort(), view);
  }
  assert.ok(routeData("docs/index.html").mail?.modules.includes("../src/mail-routes/index.mjs"), "known positive: the data names a module of src/mail-routes/ in the same form");
});

// TST-1267002 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: docs/index.html as it stands
// input: the JSON of its element route-preloads, and pageLoads("docs/index.html").routes
// expect: the route mail names the vendor modules ../src/mail-routes/vendor/msal-browser.min.js and ../src/mail-routes/vendor/postal-mime/postal-mime.js, and the page's data is what pageLoads computes for every route
test("TST-1267002 the review page names, as data, the vendor modules of the route mail", () => {
  const data = routeData("docs/index.html");
  for (const vendor of ["../src/mail-routes/vendor/msal-browser.min.js", "../src/mail-routes/vendor/postal-mime/postal-mime.js"]) {
    assert.ok(data.mail?.modules.includes(vendor), vendor);
  }
  const { routes } = pageLoads("docs/index.html");
  assert.deepEqual(data, Object.fromEntries(Object.entries(routes).map(([name, { modules, files }]) => [name, { modules, files }])));
});

// TST-1267003 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: docs/index.html as it stands
// input: pageLoads("docs/index.html").routes
// expect: the route mail loads modules beyond the block, and every route's own modules arrive in 1 level once the frame preloads them
test("TST-1267003 pageLoads reports a route's own modules in one level once they are preloaded", () => {
  const { routes } = pageLoads("docs/index.html");
  assert.ok(routes.mail?.modules.length > 0, "known positive: the route mail loads modules beyond the block");
  assert.deepEqual(Object.entries(routes).filter(([, { depth }]) => depth !== 1).map(([name]) => name), []);
});

// TST-1267004 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: docs/index.html with ../src/mail-routes/vendor/msal-browser.min.js taken out of the route mail's data, which the route's file still imports
// input: withBlock("docs/index.html", page)
// expect: the page as it stands in the repository — the data the check computes names the module, so a page whose data lacks it is stale
test("TST-1267004 a route's file that imports a module the page's data does not name fails the check", () => {
  const page = text("docs/index.html");
  const line = page.split("\n").find((candidate) => candidate.trimStart().startsWith('"mail": '));
  assert.ok(line?.includes('"../src/mail-routes/vendor/msal-browser.min.js",'), "docs/index.html names the vendor module for the route mail");
  const lacking = page.replace(line, line.replace('"../src/mail-routes/vendor/msal-browser.min.js",', ""));
  assert.notEqual(lacking, page);
  assert.notEqual(withBlock("docs/index.html", lacking), lacking, "the check finds the page stale");
  assert.equal(withBlock("docs/index.html", lacking), page);
});
