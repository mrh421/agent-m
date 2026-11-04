// The main page's job table names its columns on a phone (ITM-1455): each cell of the table `jobs` that the route `jobs` draws carries its column's title in `data-label`, which look.css shows before the
// cell's content below 600 px (look.css: "table.list td[data-label]::before { content: attr(data-label) ... }").
// Run: node --test tests/main-page-job-table-labels.test.mjs
//
// Module: MOD-main-page
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The expected results are written here from the item's Acceptance ("Every cell of the table `jobs` carries `data-label` with its column's title") and from MOD-site-frame's text ("the label is the
// cell's attribute `data-label`, which the route that draws the table sets to the column's title"), and none is read from the code. Readings taken where the texts leave one open:
//   - "Every cell" is every element <td> of a job's row: the nine cells under the nine column titles. The <th> that names a group of rows (class group-state) is no cell of a column and stands outside the check.
//   - A column's title is the text of its <th> in the table's head; the nine titles are written here in the order the table draws its columns.
//   - The route `jobs` is drawn in the world of tests/main-page-home-harness.mjs with one failed job of a kept product.
// The counter-proofs are in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { PRODUCT, INSTANCE, browser, draw, failedJob, find, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

const routeOf = (name) => view.routes.find((candidate) => candidate.name === name);
let net;
afterEach(() => { net?.restore(); timers.restore(); document.body.replaceChildren(); });

const COLUMNS = ["Job", "Product", "Works on", "Kind", "Participant", "Where it runs", "State", "Elapsed", "Cost"];
const cellsOf = (row) => find(row, (node) => node.localName === "td");
const rowsOf = (root) => find(root, (node) => node.localName === "tr" && node.className.split(/\s+/).includes("job"));
const findings = (root) => rowsOf(root).flatMap((row) => cellsOf(row).map((cell, at) => [cell, at]).filter(([cell, at]) => cell.getAttribute("data-label") !== COLUMNS[at])
  .map(([cell, at]) => `cell ${at + 1} (${COLUMNS[at]}) of ${row.getAttribute("data-id") ?? "a row"} carries data-label ${JSON.stringify(cell.getAttribute("data-label"))}`));

// TST-1455001 · level: unit · module: MOD-main-page
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the kept product alice/product with the failed job JOB-20261016-1000-ffff; a token for it and for the instance; then a planted row of nine <td> without data-label
// input: the route jobs drawn; the check applied to the page, and to the planted row
// expect: the page draws one table, of the class jobs, whose head names Job, Product, Works on, Kind, Participant, Where it runs, State, Elapsed and Cost, and one job row of nine cells carrying those nine titles in this order as data-label: no finding; the planted row gives nine findings, the first `cell 1 (Job) of a row carries data-label null`
test("TST-1455001: every cell of the table jobs carries its column's title as data-label", async () => {
  const JOB = "JOB-20261016-1000-ffff";
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct({ jobs: [failedJob({ id: JOB, by: "lab-pc-4" })] }) });
  net.install();
  const target = await draw(routeOf("jobs"), browser());
  const table = find(target, (node) => node.localName === "table");
  assert.deepEqual(table.map((node) => node.className.split(/\s+/)[0]), ["jobs"]);
  assert.deepEqual(find(find(table[0], (node) => node.localName === "thead")[0], (node) => node.localName === "th").map((node) => node.textContent), COLUMNS);
  assert.deepEqual(rowsOf(target).map((row) => row.getAttribute("data-id")), [JOB]);
  assert.deepEqual(rowsOf(target).map((row) => cellsOf(row).map((cell) => cell.getAttribute("data-label"))), [COLUMNS]);
  assert.deepEqual(findings(target), []);
  const bare = document.createElement("table");
  const planted = document.createElement("tr");
  planted.className = "job";
  planted.append(...COLUMNS.map(() => document.createElement("td")));
  bare.append(planted);
  const plantedFindings = findings(bare);
  assert.equal(plantedFindings.length, 9);
  assert.equal(plantedFindings[0], "cell 1 (Job) of a row carries data-label null");
});
