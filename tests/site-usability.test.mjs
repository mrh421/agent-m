// Every route of the instance's site, drawn in a browser at a phone's width and at a desktop's: it uses the site's style sheets only,
// offers no button or link below the minimum target size, and holds no element wider than the window. The routes that fail today are
// named as todos, each with its route and its finding; a planted table wider than a phone, a planted button below the minimum and a
// planted embedded style sheet each fail the same checks. A route that holds a block that did not render (a `.unrendered` block, which is
// what MOD-markdown-render shows for a diagram that fails) is a finding of that route, and a planted failed diagram fails it.
// Run: node --test tests/site-usability.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: system
//
// The expected results are written here from the requirement's check — "each route, drawn at a phone's width and at a desktop's, uses the
// site's style sheets only, offers no button or link below the minimum target size, and holds no element wider than the window;
// counter-proof: a planted table wider than a phone fails" — and none is read from a document. Readings taken where the check leaves one
// open, each adding no word to it:
//   - "Each route" is each page the site's two entry pages answer: the main page, and every address of the review pages that the page's
//     routing serves — the menu's addresses, and the routes' own names with one identifier of the fixture product where a route takes one.
//     The test names the first part of each address and compares them with the routes MOD-review-pages provides and the views
//     docs/assets/dashboard/built.json builds, so that a route added there and not drawn here fails.
//   - "The window" is the width the browser is given: 390 px for a phone, 1280 px for a desktop. A page "holds an element wider than the
//     window" when an element's box is wider than that width, or when the page can be scrolled sideways. A table in a box that scrolls
//     sideways is such an element: the requirement asks that tables are read "without scrolling sideways".
//   - "The minimum target size" is 24 by 24 CSS pixels (WCAG 2.2, success criterion 2.5.8). A button or link smaller than that is a finding
//     unless the criterion's exception for a link in a sentence, or its exception for spacing (a circle of 24 px centred on the target
//     meets no other target and no circle of another undersized target), holds. A button is a button, a [role=button] or a button input;
//     a link is an a[href] or a [role=link].
//   - "The site's style sheets" are the style sheets the pages link from their own address. A `<style>` element, a style sheet built in script
//     and a style sheet from another address are not; a `<style>` inside a drawn diagram is the diagram's.
// The engine is the controlled Electron in tests/site-usability.d/browser.mjs; the fixture
// product is in tests/site-usability.d/product.mjs. A route's finding is a todo: the test of its clause asserts that there is none, fails
// today, and names the finding. Each fix is an item of the route's module.
// The requirements-repair Markdown files are intentional, fixed snapshots of SPEC.md and docs/groups/requirements.md
// at 46a1cbad7ca3ac77055ebbb54695f2d9da6a567b (blobs ec0ef312994e5dbbe9e8996471f39d4d3878151b and
// 36facb5cb0e700bedb9fff823696597f43a717af; the SPEC copy adds a terminal newline). The 17 groups and 414 members below
// describe only that input, not a future live product.

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stageElectron, openWindow, configure, withStderr, until } from "./site-usability.d/browser.mjs";
import { ROUTES, CASES, OBSERVE, show, testId } from "./site-usability.d/routes.mjs";
import { serveSite, REPO } from "./site-usability.d/site.mjs";
import { files, history, pullsHandler, tagsHandler } from "./site-usability.d/product.mjs";
import { styleSheetFindings, targetFindings, unrenderedFindings, widthFindings } from "./site-usability.d/inspect.mjs";
import { view as reviewPages } from "../src/review-pages/index.mjs";
import { DASHBOARD, builtViews } from "../src/site/views.mjs";

const WIDTHS = [["phone", 390], ["desktop", 1280]];
const MINIMUM = 24;
const PHONE_MENU_EXPECTED = {
  main: [
    ["requirements", "docs/index.html#requirements", false], ["use-cases", "docs/index.html#use-cases", false], ["architecture", "docs/index.html#architecture", false],
    ["implementation", "docs/index.html#implementation", false], ["tests", "docs/index.html#tests", false], ["releases", "docs/index.html#releases", false],
    ["maintenance", "docs/index.html#maintenance", false], ["settings", "docs/index.html#settings", false],
  ],
  review: [
    ["requirements", "#spec", false], ["use-cases", "#uc", false], ["architecture", "#arc", false],
    ["implementation", "#progress", false], ["tests", "#schedule", false], ["releases", "#release", false],
    ["maintenance", "#mail", false], ["settings", "#settings", false],
  ],
};
const CLAUSES = [
  ["sheets", "uses the site's style sheets only"],
  ["targets", "offers no button or link below the minimum target size"],
  ["widths", "holds no element wider than the window"],
];

// What the pages do today that the check names: route -> clause -> the finding, as measured in the controlled Electron at a phone's width
// (at a desktop's width every route passes). Each is a todo until the module of its route fixes it; each fix is an item of that module.
const TODAY = {};

// ---------------------------------------------------------------- drawing

const MEASURE = (width) => `(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const styleSheetFindings = ${styleSheetFindings}, targetFindings = ${targetFindings}, widthFindings = ${widthFindings}, unrenderedFindings = ${unrenderedFindings};
  return { sheets: styleSheetFindings(), targets: targetFindings(${MINIMUM}), widths: widthFindings(${width}), diagrams: unrenderedFindings(),
    boxes: [...document.querySelectorAll("main pre.diff")].map((box) => box.getAttribute("tabindex")),
    controls: document.querySelectorAll("a[href], button").length,
    text: (document.querySelector("main")?.innerText ?? "").replace(/\\s+/g, " ") };
})()`;

// The menu of the two live entry pages, as drawn at the width set: the button that folds it — its name (the text a screen reader reads, without
// the hidden glyph), its aria-expanded, whether it controls the menu, whether it is shown and whether it meets the minimum target size — and
// whether the menu is shown; then, where a button is shown, the same after a click and after a second click. `entries` is read with the menu
// unfolded: the eight entries' destinations, disabled state and whether each entry's rendered box is visible within the window; `fits` says that
// the menu does not scroll sideways, and `row` that every entry stands on one line. CSS source text alone would establish none of these.
const MENU_STATE = `(() => {
  const menu = document.querySelector(".site-header .menu"), button = document.querySelector(".site-header .menu-button");
  const visible = (node) => { const box = node.getBoundingClientRect(), style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth; };
  const buttonState = () => button === null ? null : {
    name: [...button.childNodes].filter((node) => !(node.nodeType === 1 && node.getAttribute("aria-hidden") === "true")).map((node) => node.textContent).join("").trim(),
    expanded: button.getAttribute("aria-expanded"), controls: button.getAttribute("aria-controls") === menu.id, shown: visible(button),
    target: button.getBoundingClientRect().width >= ${MINIMUM} && button.getBoundingClientRect().height >= ${MINIMUM} };
  const state = () => ({ button: buttonState(), menu: visible(menu) });
  const folded = state();
  if (folded.button?.shown) button.click();
  const unfolded = state();
  const entries = [...menu.children].map((entry) => [entry.dataset.entry, entry.getAttribute("href"), entry.getAttribute("aria-disabled") === "true", visible(entry)]);
  const tops = new Set([...menu.children].map((entry) => Math.round(entry.getBoundingClientRect().top)));
  const fits = menu.scrollWidth <= menu.clientWidth;
  if (folded.button?.shown) button.click();
  return { folded, unfolded, refolded: state(), entries, fits, row: tops.size === 1 };
})()`;

const measured = new Map(); // "<address> <width name>" -> { sheets, targets, widths, text }
const planted = {};
const phoneMenus = {};
const desktopMenus = {};
let site = null, browser = null;

const started = Date.now();
const progress = (step) => console.log(`site-usability ${((Date.now() - started) / 1000).toFixed(1)} s: ${step}`);

// Each width's routes are drawn by WINDOWS windows at once, the routes dealt out in turn: a route waits for its page to be quiet (400 ms, DRAWN) and for the measure's
// own 100 ms, which no window can shorten but all can spend together. Each window has a folder of its own for the browser's data, so that no two share a lock.
const WINDOWS = 3;
const windows = [];
const drawn = async (executable, kind, width, routes, index) => {
  const window_ = await openWindow(executable, `${site.address}/__blank`);
  windows.push(window_);
  const page = window_.page;
  await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
  await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: kind === "phone" });
  const took = [];
  for (const route of routes) {
    const at = Date.now();
    await show(page, site, route.address);
    const drawnAt = Date.now() - at;
    measured.set(`${route.address} ${kind}`, await page.evaluate(MEASURE(width)));
    took.push([route.address, drawnAt, Date.now() - at]);
  }
  progress(`window ${index + 1} of the ${kind}'s width has drawn ${routes.length} routes; the slowest (drawn ms, measured ms): ${JSON.stringify(took.sort((a, b) => b[2] - a[2]).slice(0, 2))}`);
  return window_;
};

const setUp = async () => {
  site = await serveSite({ files: await files(), history: await history(), handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
  progress("the site is served");
  const executable = await stageElectron();
  progress("Electron is staged");
  const opened = await Promise.all(WIDTHS.flatMap(([kind, width]) => Array.from({ length: WINDOWS }, (_, index) =>
    drawn(executable, kind, width, ROUTES.filter((_route, at) => at % WINDOWS === index), index))));
  progress("every route is drawn at both widths");
  // The first window drew the phone's routes; the counter-proofs below plant in it, and the others are closed.
  browser = opened[0];
  for (const each of opened.slice(1)) each.close();
  const page = browser.page;
  // The counter-proofs: the same page at a phone's width, first as it is, then with a table 600 px wide, a button 10 px square and an
  // embedded style sheet planted in it.
  await configure(page, "Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await show(page, site, "/");
  phoneMenus.main = await page.evaluate(MENU_STATE);
  await show(page, site, "#uc");
  phoneMenus.review = await page.evaluate(MENU_STATE);
  await configure(page, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await show(page, site, "/");
  desktopMenus.main = await page.evaluate(MENU_STATE);
  await show(page, site, "#uc");
  desktopMenus.review = await page.evaluate(MENU_STATE);
  await configure(page, "Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await show(page, site, "#how");
  planted.before = await page.evaluate(MEASURE(390));
  await page.evaluate(`(() => { const main = document.querySelector("main");
    main.insertAdjacentHTML("beforeend", '<table id="planted-table" style="width:600px"><tr><td>planted</td></tr></table>'
      + '<p id="planted-button-row"><button style="width:10px;height:10px;padding:0">x</button><button style="width:10px;height:10px;padding:0;margin-left:2px">x</button></p>'
      + '<style id="planted-style">.planted { color: red; }</style>'); })()`);
  planted.after = await page.evaluate(MEASURE(390));
  // The counter-proof of the failed diagram: the same page with a block that did not render planted, as `renderMermaid` returns one.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<div id="planted-unrendered" class="unrendered"><p>Diagram error: planted</p><pre><code>flowchart LR</code></pre></div>')`);
  planted.afterDiagram = await page.evaluate(MEASURE(390));
  // The counter-proof of the closed <details>: two buttons 10 px square in one, first closed — displayed nowhere —, then opened.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend", '<details id="planted-details"><summary>planted</summary>'
    + '<p><button style="width:10px;height:10px;padding:0">y</button><button style="width:10px;height:10px;padding:0;margin-left:2px">y</button></p></details>')`);
  planted.closedDetails = await page.evaluate(MEASURE(390));
  await page.evaluate(`document.getElementById("planted-details").open = true`);
  planted.openDetails = await page.evaluate(MEASURE(390));
  console.log(`site-usability ${JSON.stringify([...measured].map(([key, value]) => [key, value.sheets, value.targets.length, value.widths.length]))}`);
};
// A failure after the window opened carries the tail of the browser child's stderr (withStderr), which nothing else writes.
before(async () => { try { await setUp(); } catch (failure) { throw browser ? withStderr(failure, browser.stderr()) : failure; } }, { timeout: 110000 });

after(async () => {
  for (const each of windows) each.close();
  await site?.close();
});

// ---------------------------------------------------------------- the routes

test(`${testId(904, CASES[904].routes)}: the routes drawn are the routes of the site: every route of MOD-review-pages and every view the dashboard builds`, () => {
  const builtFiles = JSON.parse(readFileSync(new URL("../docs/assets/dashboard/built.json", import.meta.url), "utf8"));
  const named = new Set(ROUTES.filter((route) => route.address.startsWith("#")).map((route) => route.address.slice(1).split("/")[0]));
  const required = new Set([...reviewPages.routes.map((route) => route.name), ...builtViews(builtFiles),
    ...DASHBOARD.filter((entry) => entry.builtIn && entry.view).map((entry) => entry.view)]);
  const missing = [...required].filter((name) => !named.has(name) && !["uc", "arc", "spec", "review"].includes(name));
  assert.deepEqual(missing, [], `routes of the site that this test does not draw: ${missing.join(", ")}`);
  for (const name of ["uc", "arc", "spec", "review"]) assert.ok(named.has(name), `the menu's address #${name} is drawn`);
  assert.ok(ROUTES.some((route) => route.address === "/"), "the main page is drawn");
});

for (const route of ROUTES) {
  test(`${testId(904, route.ids[904].drawn)}: ${route.address} was drawn, with its content and its controls, at both widths`, () => {
    for (const [kind] of WIDTHS) {
      const result = measured.get(`${route.address} ${kind}`);
      assert.ok(result.text.includes(route.shows), `${route.address} at a ${kind}'s width shows "${route.shows}"; it shows: ${result.text.slice(0, 200)}`);
      assert.ok(result.controls > 0, `${route.address} at a ${kind}'s width has buttons or links for the target-size check to measure`);
    }
  });
}

for (const route of ROUTES) {
  for (const [clause, title] of CLAUSES) {
    const today = TODAY[route.address]?.[clause];
    test(`${testId(904, route.ids[904][clause])}: ${route.address} ${title}`,
      today ? { todo: `FINDING ${route.address} - ${today}` } : {}, () => {
        for (const [kind] of WIDTHS) {
          const found = measured.get(`${route.address} ${kind}`)[clause];
          assert.deepEqual(found, [], `${route.address} at a ${kind}'s width: ${found.join("; ")}`);
        }
      });
  }
}

// TST-917002 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the live fixture use case UC-001, whose rendered Markdown holds the Request / Path read / Batch table and its long code run
// input: #uc/UC-001 and #review/uc, each drawn through the unchanged Electron geometry caller at 390 px and 1280 px
// expect: no width finding at either width, while each route still shows the literal table headings, readFile cell and code address
test("TST-917002 the live use-case and review pages reflow their Markdown table and code at phone and desktop widths", () => {
  for (const address of ["#uc/UC-001", "#review/uc"]) {
    for (const [kind] of WIDTHS) {
      const result = measured.get(`${address} ${kind}`);
      assert.deepEqual(result.widths, [], `${address} at a ${kind}'s width: ${result.widths.join("; ")}`);
      for (const literal of ["Request", "Path read", "Batch", "readFile", "/repos/akmaier/agent-m/git/trees/"]) {
        assert.equal(result.text.includes(literal), true, `${address} at a ${kind}'s width retains ${literal}`);
      }
    }
  }
});

// ---------------------------------------------------------------- the menu at a phone's width

// The fold of the menu at a phone's width: a button named Menu, shown and of the minimum target size, that controls the menu and says it is folded;
// the menu hidden. A click unfolds it: the button says so, and the eight entries stand visible, none scrolled sideways. A second click folds it again.
const FOLDED = { name: "Menu", expanded: "false", controls: true, shown: true, target: true };
const assertFolds = (page, actual, expected) => {
  assert.deepEqual(actual.folded, { button: FOLDED, menu: false }, `${page}: at 390 px the menu is one button, folded`);
  assert.deepEqual(actual.unfolded, { button: { ...FOLDED, expanded: "true" }, menu: true }, `${page}: a click unfolds the menu`);
  assert.equal(actual.fits, true, `${page} menu is not wider than its visible box`);
  assert.deepEqual(actual.entries, expected.map(([key, href, disabled]) => [key, href, disabled, true]),
    `${page} menu order, destinations, disabled entry, and visible entry geometry at 390 px, unfolded`);
  assert.deepEqual(actual.refolded, { button: FOLDED, menu: false }, `${page}: a second click folds the menu again`);
};

// TST-920001 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-046
// given: the live main entry page at a 390 px phone viewport
// input: the menu's button clicked once, then again
// expect: one button named Menu (aria-expanded false, at least 24 x 24 px, controlling the menu) and the menu hidden; after the click aria-expanded true and the literal eight-entry main-menu contract, every entry visible and no sideways menu scrolling; after the second click folded again
test("TST-920001 the main entry page folds its eight process-menu entries behind one Menu button at 390 px", () => {
  assertFolds("main", phoneMenus.main, PHONE_MENU_EXPECTED.main);
});

// TST-920002 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-046
// given: the live review entry page at a 390 px phone viewport
// input: the menu's button clicked once, then again
// expect: as TST-920001, with the literal eight-entry review-menu contract
test("TST-920002 the review entry page folds its eight process-menu entries behind one Menu button at 390 px", () => {
  assertFolds("review", phoneMenus.review, PHONE_MENU_EXPECTED.review);
});

// TST-1191002 · level: system · module: MOD-site-frame
// guards: UC-046
// given: the live main and review entry pages at a 1280 px desktop viewport
// input: the menu as drawn
// expect: no menu button is shown; the eight entries are visible and stand in one row
test("TST-1191002 at 1280 px neither entry page shows the menu button, and the eight entries stand in a row", () => {
  for (const [page, expected] of Object.entries(PHONE_MENU_EXPECTED)) {
    const actual = desktopMenus[page];
    assert.equal(actual.folded.button.shown, false, `${page}: no menu button at 1280 px`);
    assert.equal(actual.folded.menu, true, `${page}: the menu is shown at 1280 px`);
    assert.deepEqual(actual.entries, expected.map(([key, href, disabled]) => [key, href, disabled, true]), `${page}: the eight entries at 1280 px`);
    assert.equal(actual.row, true, `${page}: the entries stand in one row at 1280 px`);
  }
});

// ---------------------------------------------------------------- the counter-proofs

// TST-1178001 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-020
// given: the fixed 46a1cbad SPEC and requirements group file, with 17 groups and 414 unique members, through the unchanged native site and Electron callers
// input: #spec at 390 px and 1280 px; open and close 0. Hard product rules, open NO SERVER, then narrow and open A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL
// expect: Current requirements, 17 groups from 0. Hard product rules to 16. Usability, 414 unique requirement buttons; inherited shared-control typography, solid token borders, padding and boxes at least 24 px high; hidden closed content, visible opened fields and traces, exactly one narrowed member; unfiltered width and target findings [] throughout
test("TST-1178001 the fixed complete requirements tree and its controls share the responsive Frame look", async () => {
  const ownFiles = Object.fromEntries(Object.entries(await files()).filter(([path]) => !path.startsWith("docs/spec-freigaben/")));
  ownFiles["SPEC.md"] = readFileSync(new URL("./fixtures/requirements-repair/SPEC.md", import.meta.url), "utf8");
  ownFiles["docs/groups/requirements.md"] = readFileSync(new URL("./fixtures/requirements-repair/requirements.md", import.meta.url), "utf8");
  const ownSite = await serveSite({ files: ownFiles, history: await history(), handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
  let window_;
  try {
    window_ = await openWindow(await stageElectron(), `${ownSite.address}/__blank`);
    const page = window_.page;
    await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    for (const [kind, width] of WIDTHS) {
      await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: kind === "phone" });
      await show(page, ownSite, "#uc");
      await show(page, ownSite, "#spec");
      const tree = await page.evaluate(`(() => {
        const visible = (node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
        const styleOf = (node) => { const s = getComputedStyle(node), b = node.getBoundingClientRect();
          return { font: s.fontFamily, size: parseFloat(s.fontSize), border: s.borderTopStyle, borderWidth: s.borderTopWidth,
            borderColor: s.borderTopColor, padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat),
            height: b.height, left: b.left, right: b.right, visible: visible(node) }; };
        const groups = [...document.querySelectorAll(".spec-group")];
        const controls = [...document.querySelectorAll(".spec-narrow input, .spec-narrow select, .version-choice")];
        return { heading: document.querySelector(".current-requirements h2")?.textContent,
          names: [...document.querySelectorAll(".requirement-name")].map((node) => node.textContent),
          groups: groups.map((group) => ({ title: group.querySelector(".spec-group-toggle").textContent,
            held: group.querySelector(".spec-group-held").textContent, closed: !visible(group.querySelector(".spec-group-body")) })),
          controls: controls.map(styleOf), positive: styleOf(document.querySelector(".spec-group-toggle")),
          widths: (${widthFindings})(${width}), targets: (${targetFindings})(24) };
      })()`);
      assert.equal(tree.heading, "Current requirements", kind);
      assert.equal(tree.groups.length, 17, kind);
      assert.equal(tree.groups[0].title, "0. Hard product rules", kind);
      assert.equal(tree.groups.at(-1).title, "16. Usability", kind);
      assert.equal(tree.names.length, 414, kind);
      assert.equal(new Set(tree.names).size, 414, kind);
      assert.equal(tree.groups.every((group) => group.closed && /[1-9][0-9]* requirements?/.test(group.held)), true, kind);
      assert.equal(tree.controls.length, 5, "one search, three filters and the version choice");
      assert.equal(tree.positive.visible, true, "the existing shared group button is the rendered positive control");
      assert.equal(tree.positive.border, "solid", "the positive control uses the shared boxed-control border");
      assert.deepEqual(tree.widths, [], `${kind} closed tree widths`);
      assert.deepEqual(tree.targets, [], `${kind} closed tree targets`);

      await page.evaluate(`document.querySelector(".spec-group-toggle").click()`);
      assert.equal(await page.evaluate(`document.querySelector(".spec-group-body").getBoundingClientRect().height > 0`), true, `${kind} group opens`);
      await page.evaluate(`[...document.querySelectorAll(".requirement-name")].find((node) => node.textContent === "NO SERVER").click()`);
      await until(`${kind} requirement traces are read`, () => page.evaluate(`!document.querySelector(".requirement-traces .traces-reading")`));
      const opened = await page.evaluate(`({ name: document.querySelector(".requirement-detail h3")?.textContent,
        fields: [...document.querySelectorAll(".requirement-detail h4")].map((node) => node.textContent),
        traces: document.querySelector(".requirement-traces")?.innerText, widths: (${widthFindings})(${width}), targets: (${targetFindings})(24) })`);
      assert.equal(opened.name, "NO SERVER", `${kind} opened requirement name`);
      assert.deepEqual(opened.fields, ["Source", "Rule", "Check"], `${kind} opened requirement fields`);
      assert.equal(Boolean(opened.traces?.trim()), true, `${kind} actual trace content is present`);
      assert.deepEqual(opened.widths, [], `${kind} opened requirement widths`);
      assert.deepEqual(opened.targets, [], `${kind} opened requirement targets`);
      await page.evaluate(`document.querySelector(".spec-group-toggle").click()`);
      assert.equal(await page.evaluate(`document.querySelector(".spec-group-body").getBoundingClientRect().height`), 0, `${kind} group closes`);

      const longName = "A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL";
      await page.evaluate(`(() => { const input = document.querySelector(".spec-narrow-text"); input.value = ${JSON.stringify(longName)}; input.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      const narrowed = await page.evaluate(`[...document.querySelectorAll(".requirement-name")].filter((node) => node.getBoundingClientRect().height > 0).map((node) => node.textContent)`);
      assert.deepEqual(narrowed, [longName], `${kind} narrowing shows exactly the matching member`);
      await page.evaluate(`[...document.querySelectorAll(".requirement-name")].find((node) => node.textContent === ${JSON.stringify(longName)}).click()`);
      const narrow = await page.evaluate(`({ text: document.querySelector(".current-requirements").innerText,
        widths: (${widthFindings})(${width}), targets: (${targetFindings})(24) })`);
      assert.equal(narrow.text.includes(longName), true, `${kind} opened long name remains visible`);
      assert.deepEqual(narrow.widths, [], `${kind} narrowed long content widths`);
      assert.deepEqual(narrow.targets, [], `${kind} narrowed long content targets`);
      for (const [index, control] of tree.controls.entries()) {
        const label = `${kind} requirements control ${index}: ${JSON.stringify(control)}`;
        assert.equal(control.visible, true, label);
        assert.equal(control.font, tree.positive.font, `${label} inherits the shared Frame font`);
        assert.ok(control.size >= 14, `${label} has shared-control readable typography`);
        assert.equal(control.border, "solid", label);
        assert.equal(control.borderWidth, tree.positive.borderWidth, label);
        assert.equal(control.borderColor, tree.positive.borderColor, label);
        assert.ok(control.padding.every((padding) => padding >= 4), `${label} has boxed-control padding`);
        assert.ok(control.height >= 24 && control.left >= 0 && control.right <= width, `${label} is a visible phone-fitting target`);
      }
    }
  } catch (failure) {
    throw window_ ? withStderr(failure, window_.stderr()) : failure;
  } finally {
    window_?.close();
    await ownSite.close();
  }
});

// The page the counter-proofs plant in, as it is, has none of the planted faults — the known positive of the three that follow.
test(`${testId(904, CASES[904].plantedBefore)}: the page before the planting has no table, button or embedded style sheet that the checks name`, () => {
  assert.deepEqual(planted.before.sheets, [], "no style sheet finding before the planting");
  assert.equal(planted.before.widths.some((finding) => finding.startsWith("table#planted-table")), false);
  assert.equal(planted.before.targets.some((finding) => finding.includes('"x"')), false);
});

test(`${testId(904, CASES[904].plantedTable)}: a planted table wider than a phone fails the width check`, () => {
  assert.ok(planted.after.widths.some((finding) => finding.startsWith("table#planted-table is 600 px wide")), `findings: ${planted.after.widths.join("; ")}`);
  assert.ok(planted.after.widths.some((finding) => finding.startsWith("the page scrolls sideways")), `findings: ${planted.after.widths.join("; ")}`);
});

test(`${testId(904, CASES[904].plantedButton)}: a planted button 10 px square fails the target-size check`, () => {
  assert.ok(planted.after.targets.includes('button "x" is 10 x 10 px'), `findings: ${planted.after.targets.join("; ")}`);
});

test(`${testId(904, CASES[904].plantedSheet)}: a planted embedded style sheet fails the style-sheet check`, () => {
  assert.deepEqual(planted.after.sheets, ["an embedded <style> element"]);
});

// ---------------------------------------------------------------- a target in a closed <details>

// TST-904205 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the page of the counter-proofs with two buttons 10 px square, 2 px apart, planted in a <details>
// input: the target-size check, with the <details> closed and then opened
// expect: closed, no finding names the buttons, since the page displays neither; opened, the check names them. The links in the closed <details> of a route's explanations are no targets either, so that the box the browser still reports for one does not take part in the spacing of the link that stands where the box lies (SPEC EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE).
test(`${testId(904, CASES[904].closedDetails)}: a button in a closed <details> is no target: the check names none`, () => {
  assert.equal(planted.closedDetails.targets.some((finding) => finding.includes('"y"')), false, `findings: ${planted.closedDetails.targets.join("; ")}`);
});

test(`${testId(904, CASES[904].openDetails)}: the same buttons in the opened <details> fail the target-size check`, () => {
  assert.ok(planted.openDetails.targets.includes('button "y" is 10 x 10 px'), `findings: ${planted.openDetails.targets.join("; ")}`);
});

// ---------------------------------------------------------------- a diagram that failed

// TST-904134 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: every route drawn at both widths
// input: the blocks of the page with the class `unrendered`, which MOD-markdown-render shows for a diagram that fails
// expect: none
for (const route of ROUTES) {
  test(`${testId(904, route.ids[904].diagrams)}: ${route.address} holds no block that did not render, such as a diagram that failed`, () => {
    for (const [kind] of WIDTHS) {
      const found = measured.get(`${route.address} ${kind}`).diagrams;
      assert.deepEqual(found, [], `${route.address} at a ${kind}'s width: ${found.join("; ")}`);
    }
  });
}

// The counter-proof: the page before the planting has no such block; with a failed diagram planted, the check names it with its reason.
test(`${testId(904, CASES[904].diagramBefore)}: the page before the planting holds no block that did not render`, () => {
  assert.deepEqual(planted.before.diagrams, []);
});

test(`${testId(904, CASES[904].diagramAfter)}: a planted failed diagram fails the check and is named with its reason`, () => {
  assert.deepEqual(planted.afterDiagram.diagrams, ['a block that did not render: "Diagram error: planted"']);
});

// ---------------------------------------------------------------- a changed file

// TST-904168 · level: system · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture's use case UC-001, accepted at an earlier text and changed since
// input: the routes that draw it, at both widths, and each `pre.diff` in <main>
// expect: the route draws at least one difference box (the known positive that the checks above meet it), and each has tabindex "0" (ITM-921)
for (const address of ["#uc/UC-001", "#review/uc"]) {
  test(`${testId(904, ROUTES.find((each) => each.address === address).ids[904].box)}: ${address} draws the difference box of the changed use case, which the keyboard reaches`, () => {
    for (const [kind] of WIDTHS) {
      const boxes = measured.get(`${address} ${kind}`).boxes;
      assert.equal(boxes.length > 0, true, `${address} at a ${kind}'s width draws a difference box`);
      assert.deepEqual(boxes.filter((tabindex) => tabindex !== "0"), [], `${address} at a ${kind}'s width: boxes without tabindex 0`);
    }
  });
}
