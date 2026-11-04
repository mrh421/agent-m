// MOD-implementation-pages' route `progress`: "a cell, card or point leads to the trace page of what is behind it" (docs/architecture/MOD-implementation-pages.md, Interfaces: `progress`), and
// UC-035 step 6: "The reader clicks a cell, a card or a point on the chart. Agent M shows the items or requirements behind it and their traceability" (ITM-1339).
// Run: node --test tests/implementation-pages-progress-trace.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-035
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory, with the instance's V-model, the Kanban fixture or the fixture's Scrum model. Nothing reaches the network.
// Readings the item takes, which the tests state (the pull request names them):
//   - what is behind a cell of the grid is its requirement; behind a card, the requirements and use cases its item realises; behind a point, those of the items merged — a chart's
//     points are reached by one link under it, as the route draws it, so behind it stand the items the chart counts as merged: the board's done items, or the sprint's merged items in
//     the order of their merges; a card or point with several leads to the first of them;
//   - the trace page of a requirement is the specification at the branch shown, narrowed to that requirement by the part `text` the route `trace` takes (`#trace/key=specification/ref=<branch>/text=<name>`);
//     the page of a use case is the one the trace page itself links a use case to (`use-case` with `id`);
//   - the item's file is read only on the click, so that the page's first load over a stored view reads no item (EVERY PAGE LOADS IN UNDER THREE SECONDS); the click goes there through the
//     frame (ViewContext's go). Where no view is stored, the page derives it from the facts, which read the items, so the first load is counted over a stored view only (TST-1339005).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMIT, DECLARATION_AT_HEAD, found, productFiles, render, renderOverGitHub, storedViewBytes } from "./implementation-pages-sprints.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const model = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const TWO_RULES = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE TWO** *(PO, 2026-09-01)*", "The second rule.", "*Check:* no automatic check; at review.");
// The item n of the fixture, realising `realises` in this order.
const item = (n, realises) => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", ...realises.map((each) => `  - ${each}`), "modules:", "  - MOD-store",
  "builds_on: []", "tests:", "  - unit", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const attr = (node, name) => node?.getAttribute(name) ?? null;

// TST-1339001 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the V-model, with RULE ONE and RULE TWO in its SPEC
// input: the route progress's render; the reader looks at where the cells of the grid lead
// expect: each cell of RULE ONE leads to #trace/key=specification/ref=main/text=RULE%20ONE and each cell of RULE TWO to #trace/key=specification/ref=main/text=RULE%20TWO; known positive: both rows are drawn; counter-proof: a cell of RULE ONE and one of RULE TWO lead to different places
test("TST-1339001 #progress — a cell of the grid leads to the trace page of its requirement", async () => {
  const page = await render("progress", {}, { files: productFiles({ "SPEC.md": TWO_RULES, "docs/process-models/fixture.md": model("../src/model-catalogue/models/v-model.md") }) });
  try {
    const cells = found(page.target, "[data-cell]");
    const of = (name) => cells.filter((each) => attr(each, "data-requirement") === name);
    assert.ok(of("RULE ONE").length > 0 && of("RULE TWO").length > 0, `known positive: both rows are drawn (${cells.length} cells)`);
    for (const each of of("RULE ONE")) assert.equal(attr(each, "href"), "#trace/key=specification/ref=main/text=RULE%20ONE", attr(each, "data-phase"));
    for (const each of of("RULE TWO")) assert.equal(attr(each, "href"), "#trace/key=specification/ref=main/text=RULE%20TWO", attr(each, "data-phase"));
    assert.notEqual(attr(of("RULE ONE")[0], "href"), attr(of("RULE TWO")[0], "href"), "counter-proof: two requirements, two places");
  } finally { page.done(); }
});

// TST-1339002 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the Kanban fixture; ITM-002 realises RULE ONE, ITM-003 realises UC-007 and then RULE ONE
// input: the route progress's render; the reader clicks the card of ITM-002, then the card of ITM-003
// expect: the click on ITM-002 goes to the trace of RULE ONE (trace, key specification, ref main, text RULE ONE); the click on ITM-003 to the first of what it realises, the use case UC-007 (use-case, id UC-007); counter-proof: the two cards lead to different places
test("TST-1339002 #progress — a card leads to the trace page of the first requirement or use case its item realises", async () => {
  const files = productFiles({ "docs/process-models/fixture.md": model("./fixtures/flow/kanban.md"), "docs/backlog/ITM-003-item-3.md": item(3, ["UC-007", "RULE ONE"]) });
  const page = await render("progress", {}, { files });
  try {
    const card = (id) => found(page.target, "[data-card]").find((each) => attr(each, "data-card") === id);
    assert.ok(card("ITM-002") && card("ITM-003"), "known positive: both cards are drawn");
    await page.press(card("ITM-002"));
    await page.press(card("ITM-003"));
    assert.deepEqual(page.went, [["trace", { key: "specification", ref: "main", text: "RULE ONE" }], ["use-case", { id: "UC-007" }]]);
    assert.notDeepEqual(page.went[0], page.went[1], "counter-proof: two items, two places");
  } finally { page.done(); }
});

// TST-1339003 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the Kanban fixture; its done items are ITM-001, which realises UC-002, and ITM-003, which realises RULE ONE
// input: the route progress's render; the reader clicks the link under the cumulative flow, by which its points are reached
// expect: the click goes to the first of what the first done item realises, the use case UC-002 (use-case, id UC-002), not to the specification as a whole
test("TST-1339003 #progress — the points of the cumulative flow lead to what the items merged realise", async () => {
  const files = productFiles({ "docs/process-models/fixture.md": model("./fixtures/flow/kanban.md"), "docs/backlog/ITM-001-item-1.md": item(1, ["UC-002"]) });
  const page = await render("progress", {}, { files });
  try {
    const points = found(page.target, "[data-point]");
    assert.equal(points.length, 1, "known positive: the link under the chart is drawn");
    await page.press(points[0]);
    assert.deepEqual(page.went, [["use-case", { id: "UC-002" }]]);
  } finally { page.done(); }
});

// TST-1339004 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product of two teams whose model works in sprints; team1's running sprint holds ITM-001, merged on 2026-10-21, which realises RULE ONE, and ITM-002, not merged
// input: the route progress's render; the reader clicks the link under team1's burn-down, by which its points are reached
// expect: team1's panel holds one link under its burn-down; the click goes to the trace of RULE ONE (trace, key specification, ref main, text RULE ONE)
test("TST-1339004 #progress — the points of a sprint's burn-down lead to what its merged items realise", async () => {
  const page = await render("progress");
  try {
    const panel = found(page.target, "[data-team]").find((each) => attr(each, "data-team") === "team1" && each.localName === "section");
    assert.ok(found(panel, "[data-burn-down]").length > 0, "known positive: team1's burn-down is drawn");
    const points = found(panel, "[data-point]");
    assert.equal(points.length, 1, "one link under the burn-down");
    await page.press(points[0]);
    assert.deepEqual(page.went, [["trace", { key: "specification", ref: "main", text: "RULE ONE" }]]);
  } finally { page.done(); }
});

// TST-1339005 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product of two teams over the counting fake of GitHub, overview-cache holding the progress view of the head ccc…c; team1's sprint holds ITM-001, merged, which realises RULE ONE
// input: the route progress's render; then the reader clicks the link under team1's burn-down
// expect: the first load sends no request that names an item's file; the click reads ITM-001's file (known positive: a request names it) and goes to the trace of RULE ONE (trace, key specification, ref main, text RULE ONE)
test("TST-1339005 #progress — the first load reads no item's file; the click reads the item behind it", async () => {
  const files = () => productFiles({ "docs/process.md": DECLARATION_AT_HEAD });
  const page = await renderOverGitHub("progress", {}, { files: files(), overview: { [`${COMMIT}.progress.json.gz`]: await storedViewBytes("progress", files()) } });
  try {
    const naming = () => page.srv.requests.filter((request) => /ITM-00\d-item/.test(decodeURIComponent(request)));
    assert.deepEqual(naming(), [], "the first load names no item's file");
    const panel = found(page.target, "[data-team]").find((each) => attr(each, "data-team") === "team1" && each.localName === "section");
    const points = found(panel, "[data-point]");
    assert.equal(points.length, 1, "known positive: the link under the burn-down is drawn");
    await page.press(points[0]);
    assert.ok(naming().some((request) => decodeURIComponent(request).includes("ITM-001-item-1")), `known positive: the click reads ITM-001's file (${page.srv.requests.join("\n")})`);
    assert.deepEqual(page.went, [["trace", { key: "specification", ref: "main", text: "RULE ONE" }]]);
  } finally { page.done(); }
});
