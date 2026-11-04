// Release tests of ITM-1159 — the modules table of #arc and #module in the rendered site, at a phone's width (390 px) and on a desktop (1280 px): below 600 px each row stands as a block and each cell shows its column's title as its label, every cell of a
// module's row carries that title in `data-label`, nothing scrolls sideways, and the cell of an opened row, which spans every column, has no label. The behaviour is docs/architecture/MOD-site-frame.md (`look.css`: "A cell is labelled by its column: the label is the cell's attribute
// `data-label`, which the route that draws the table sets to the column's title, and the stylesheet shows it before the cell's content; a cell without the attribute stands unlabelled", "a table, its rows and its cells are never wider than the window") and docs/architecture/MOD-trace-pages.md (the modules
// view: "table of modules: subsystem, the requirements its tests guard with their statuses, its file, code, tests"). The pages are drawn in the controlled Electron of tests/site-usability.d over the site's own style sheets and the fixture product of tests/site-usability.d/product.mjs, as
// tests/site-usability.test.mjs draws them; every label is read from the browser's computed style, never from look.css.
// Run: node --test tests/release-itm-1159-modules-labels.test.mjs
//
// Module: MOD-trace-pages; MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: release
//
// Written for the release testing of sprint 121 by a participant who implemented none of ITM-1159 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The expected values are written here from those texts, and none is read from a document. Readings taken where the texts leave one open:
//   - "a column's title" is read as the text of the table's header cells, in the order of the columns: Module, Subsystem, Realises, File, Code, Tests, which the case compares with each cell's `data-label` and with the label the browser draws.
//   - "the label is shown before the cell's content" is read as the computed content of the cell's ::before at a phone's width being the title in quotes; "unlabelled" as the computed content being none.
//   - "nothing scrolls sideways" is read as: the document is no wider than the window (scrollWidth not above innerWidth) and no element of <main> reaches beyond the window's right edge.
//   - "the opened row's spanning cell" is the cell of the row that opens under a module when its name is clicked (colspan 6), which has no column of its own.
//   - On a desktop the header row is shown and the cells stand in a row, so no cell is labelled by ::before.

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { stageElectron, openWindow, configure, withStderr, until } from "./site-usability.d/browser.mjs";
import { serveSite, REPO } from "./site-usability.d/site.mjs";
import { files, history, pullsHandler, tagsHandler } from "./site-usability.d/product.mjs";
import { show, OBSERVE } from "./site-usability.d/routes.mjs";

const TITLES = ["Module", "Subsystem", "Realises", "File", "Code", "Tests"];
const MODULES = ["MOD-pages", "MOD-progress-measures", "MOD-reader"];
const ROUTES = ["#arc", "#module"];
const WIDTHS = [["phone", 390], ["desktop", 1280]];

// What a page of the modules table shows, as the browser resolved it.
const TABLE = `(() => { const rows = [...document.querySelectorAll("main tr.module-row")];
  const shown = (element) => { const style = getComputedStyle(element); return { display: style.display, label: getComputedStyle(element, "::before").content }; };
  return { titles: [...document.querySelectorAll("main .modules-table th")].map((th) => th.textContent), head: getComputedStyle(document.querySelector("main .modules-table thead")).display,
    rows: rows.map((row) => ({ module: row.getAttribute("data-module"), display: shown(row).display, cells: [...row.children].map((cell) => ({ tag: cell.localName, dataLabel: cell.getAttribute("data-label"), ...shown(cell) })) })) }; })()`;
const SIDEWAYS = (width) => `(() => ({ document: document.documentElement.scrollWidth, window: ${width},
  wide: [...document.querySelectorAll("main *")].filter((element) => element.getBoundingClientRect().right > ${width} + 1).map((element) => element.localName + "." + element.className).slice(0, 5) }))()`;
const OPENED = `(() => ({ cells: [...document.querySelectorAll("main tr.module-opened > td")].map((cell) => ({ dataLabel: cell.getAttribute("data-label"), colspan: cell.getAttribute("colspan"), label: getComputedStyle(cell, "::before").content, text: cell.textContent.length })),
  first: [...document.querySelector("main tr.module-row").children].map((cell) => cell.getAttribute("data-label")) }))()`;
// A cell planted into a row, with and without a data-label, and a block wider than a phone planted into <main>.
const PLANT = `(() => { const row = document.querySelector("main tr.module-row"); const labelled = document.createElement("td"); labelled.setAttribute("data-label", "Planted"); labelled.textContent = "labelled";
  const bare = document.createElement("td"); bare.textContent = "bare"; row.append(labelled, bare);
  document.querySelector("main").insertAdjacentHTML("beforeend", '<div id="planted-wide" style="width:900px;height:10px"></div>');
  return { labelled: getComputedStyle(labelled, "::before").content, bare: getComputedStyle(bare, "::before").content }; })()`;

const found = new Map(); // "<width> <route>" -> { table, sideways, opened }
let planted = null;
let site = null, browser = null;

before(async () => {
  try {
    site = await serveSite({ files: await files(), history: await history(), handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
    browser = await openWindow(await stageElectron(), `${site.address}/__blank`);
    const page = browser.page;
    await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    for (const [name, width] of WIDTHS) {
      await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      for (const address of ROUTES) {
        await show(page, site, address);
        const table = await page.evaluate(TABLE), sideways = await page.evaluate(SIDEWAYS(width));
        await page.evaluate(`document.querySelector("main .module-name").click()`);
        await until(`${address} opens a row`, () => page.evaluate(`document.querySelector("main tr.module-opened > td")?.textContent.length > 0`, 3000));
        found.set(`${name} ${address}`, { table, sideways, opened: await page.evaluate(OPENED) });
      }
    }
    await configure(page, "Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await show(page, site, "#arc");
    planted = { cells: await page.evaluate(PLANT), sideways: await page.evaluate(SIDEWAYS(390)) };
  } catch (failure) { throw browser ? withStderr(failure, browser.stderr()) : failure; }
}, { timeout: 170000 });

after(async () => {
  browser?.close();
  await site?.close();
});

const drawn = (name, address) => found.get(`${name} ${address}`);

// TST-1159301 · level: release · module: MOD-trace-pages, MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture product's #arc and #module drawn at 390 px; a cell planted into a module's row, once with a data-label and once without
// input: the computed content of ::before of every cell of every module row; the computed display of the header row and of the rows
// expect: the header row is not shown and each row is a block; the six cells of each of the three module rows show their column's title as the label, in order, Module to Tests; the planted cell with a data-label shows it and the planted cell without shows none
// Planted fault: look.css without the rule that shows a cell's data-label before its content leaves every label at none, and the case fails on the first cell.
test("TST-1159301 at a phone's width the modules table of #arc and #module shows each cell's column title as its label", () => {
  for (const address of ROUTES) {
    const { table } = drawn("phone", address);
    assert.deepEqual(table.titles, TITLES, `${address}: the columns`);
    assert.equal(table.head, "none", `${address}: the header row is not shown`);
    assert.deepEqual(table.rows.map((row) => row.module), MODULES, `${address}: one row per module`);
    for (const row of table.rows) {
      assert.equal(row.display, "block", `${address} ${row.module}: the row stands as a block`);
      assert.deepEqual(row.cells.map((cell) => cell.label), TITLES.map((title) => `"${title}"`), `${address} ${row.module}: the labels the browser draws`);
    }
  }
  assert.equal(planted.cells.labelled, '"Planted"', "known positive: a cell with a data-label shows it");
  assert.equal(planted.cells.bare, "none", "counter-proof: a cell without the attribute stands unlabelled");
});

// TST-1159302 · level: release · module: MOD-trace-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture product's #arc and #module drawn at 390 px and at 1280 px
// input: the header cells of the modules table and the attribute data-label of every cell of every module row
// expect: the header cells are Module, Subsystem, Realises, File, Code, Tests; there is one row for each of the three modules; each row has six td cells whose data-label equals, cell by cell, the header cell of its column; the same at both widths
// Planted fault: flow.mjs giving every cell the first title (MODULE_COLUMNS[0] in place of MODULE_COLUMNS[at]) fails the equality of the second cell.
test("TST-1159302 every cell of each module row carries a data-label equal to its column's header", () => {
  for (const [name] of WIDTHS) {
    for (const address of ROUTES) {
      const { table } = drawn(name, address);
      assert.deepEqual(table.titles, TITLES, `${name} ${address}: the header cells`);
      assert.deepEqual(table.rows.map((row) => row.module), MODULES, `${name} ${address}: one row per module`);
      for (const row of table.rows) {
        assert.deepEqual(row.cells.map((cell) => cell.tag), Array(6).fill("td"), `${name} ${address} ${row.module}: six cells`);
        assert.deepEqual(row.cells.map((cell) => cell.dataLabel), table.titles, `${name} ${address} ${row.module}: each cell's label against its header`);
      }
    }
  }
});

// TST-1159303 · level: release · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture product's #arc and #module drawn at 390 px and at 1280 px; and, as the counter-proof, #arc at 390 px with a block 900 px wide planted into <main>
// input: the width of the document against the window's, and the elements of <main> that reach beyond the window's right edge
// expect: at both widths on both routes the document is no wider than the window and no element reaches beyond it; with the block planted the same reading finds the document wider than the window and names the block
// Planted fault: look.css giving the narrow form of a table a minimum width of 900 px (`@media (max-width: 599px) { table.list { min-width: 900px; } }`) widens the page, and the case fails on #arc at 390 px.
test("TST-1159303 nothing in the modules table scrolls sideways at a phone's width or on a desktop", () => {
  for (const [name] of WIDTHS) {
    for (const address of ROUTES) {
      const { sideways } = drawn(name, address);
      assert.ok(sideways.document <= sideways.window, `${name} ${address}: the document is ${sideways.document} px wide in a window of ${sideways.window} px`);
      assert.deepEqual(sideways.wide, [], `${name} ${address}: elements beyond the window`);
    }
  }
  assert.ok(planted.sideways.document > planted.sideways.window, `${JSON.stringify(planted.sideways)} counter-proof: a planted block wider than a phone widens the document`);
  assert.ok(planted.sideways.wide.some((element) => element.includes("div")), `counter-proof: the planted block is named: ${planted.sideways.wide}`);
});

// TST-1159304 · level: release · module: MOD-trace-pages, MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: #arc and #module at 390 px and at 1280 px, with the name of the first module clicked so that its row opens
// input: the cells of the row that opened under the module, their data-label and colspan and the label the browser draws; the data-label of the cells of the module's own row
// expect: the opened row holds one cell, colspan 6, with no data-label and no label drawn (none), while the module's own row keeps its six titles, at both widths on both routes
// Planted fault: flow.mjs giving the opened row's cell a data-label (panel.setAttribute("data-label", "Module")) draws a label over the opened file, and the case fails on it.
test("TST-1159304 the cell of an opened row spans every column and has no label", () => {
  for (const [name] of WIDTHS) {
    for (const address of ROUTES) {
      const { opened } = drawn(name, address);
      assert.deepEqual(opened.first, TITLES, `${name} ${address}: the module's own row keeps its labels while it is open`);
      assert.equal(opened.cells.length, 1, `${name} ${address}: one cell in the opened row`);
      assert.deepEqual([opened.cells[0].dataLabel, opened.cells[0].colspan, opened.cells[0].label], [null, "6", "none"], `${name} ${address}: the opened row's cell`);
      assert.ok(opened.cells[0].text > 0, `${name} ${address}: the opened row shows the module's file`);
    }
  }
});

// TST-1159305 · level: release · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture product's #arc and #module drawn at 1280 px
// input: the computed display of the header row and of the cells, and the label drawn before every cell of every module row
// expect: the header row is shown (table-header-group), the cells stand as table cells, and no cell is labelled by a ::before (none), since the column heads name the columns
// Planted fault: look.css showing a cell's data-label before its content on every width (a rule `table.list td[data-label]::before { content: attr(data-label); }` outside the phone's media query) labels the desktop's cells and fails the case.
test("TST-1159305 on a desktop the modules table keeps its header row and labels no cell", () => {
  for (const address of ROUTES) {
    const { table } = drawn("desktop", address);
    assert.equal(table.head, "table-header-group", `${address}: the header row is shown`);
    for (const row of table.rows) {
      assert.deepEqual(row.cells.map((cell) => cell.display), Array(6).fill("table-cell"), `${address} ${row.module}: the cells stand in a row`);
      assert.deepEqual(row.cells.map((cell) => cell.label), Array(6).fill("none"), `${address} ${row.module}: no cell is labelled by ::before`);
    }
  }
});
