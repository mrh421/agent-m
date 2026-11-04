// MOD-implementation-pages' route `progress` for the models without sprints (ITM-800), as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`progress` — the
// progress in the model's measure — the grid of requirements by phases with the steps of the plan, the burn-down of each team's running sprint, or the board's cumulative flow —, the gates
// passed, pending and not reached, what is blocked, who works on what; a cell, card or point leads to the trace page of what is behind it." — and UC-035 steps 1 to 6, 1a and 2a.
// Run: node --test tests/implementation-pages-progress-measures.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY STEP EXPLAINS ITSELF; UC-035
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory, with the instance's V-model (src/model-catalogue/models/v-model.md) or the Kanban fixture
// (tests/fixtures/flow/kanban.md) as its process model; the Scrum fixture's measure stands in tests/implementation-pages-progress.test.mjs (TST-1252201). Nothing reaches the network.
// Readings the texts leave open, which the tests state (the pull request names them): the measure's panel is the element `data-part="measure"`; a grid cell is `data-cell` with
// `data-requirement` and `data-phase`, a card of the board `data-card="<item>"`, the cumulative flow's chart `data-flow-chart`; "the trace page of what is behind it" is the route `trace`
// of the specification, `#trace/key=specification/ref=<branch>`, where a requirement's trace opens, since the route takes no part naming one requirement.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADDRESS, found, hostOf, productFiles, render, part } from "./implementation-pages-sprints.mjs";

const withModel = (path, edit = (text) => text) => productFiles({ "docs/process-models/fixture.md": edit(readFileSync(new URL(path, import.meta.url), "utf8")) });
const vModel = () => withModel("../src/model-catalogue/models/v-model.md");
const kanban = (edit) => withModel("./fixtures/flow/kanban.md", edit);
const measure = (page) => part(page.html(), 'data-part="measure"');
const hrefs = (node) => found(node, "[href]").map((each) => each.getAttribute("href"));

// TST-800001 · level: unit · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; EVERY STEP EXPLAINS ITSELF; UC-035
// given: the fixture product whose model is the V-model (kind planned; seven phases), with the requirement RULE ONE in its SPEC and the steps ITM-001 to ITM-005
// input: the route progress's render
// expect: the measure's panel holds the grid of RULE ONE × the seven phases — the cell of Requirements done, the cell of Design open —, each cell a link to the trace page #trace/key=specification/ref=main, the steps of the plan with their states (ITM-001 done), a folded "What is this?", and no line saying the measure is not drawn
test("#progress — a V-model product draws the grid of requirements by phases with the steps of the plan", async () => {
  const page = await render("progress", {}, { files: vModel() });
  try {
    const panel = measure(page);
    assert.match(panel, /plan entries per phase/, "known positive: the panel is the measure's");
    const cells = found(page.target, "[data-cell]");
    assert.equal(cells.length, 7, "RULE ONE in each of the seven phases");
    const cell = (phase) => cells.find((each) => each.getAttribute("data-phase") === phase);
    assert.equal(cell("Requirements")?.getAttribute("data-requirement"), "RULE ONE");
    assert.match(cell("Requirements")?.textContent ?? "", /done/);
    assert.match(cell("Design")?.textContent ?? "", /open/);
    for (const each of cells) assert.match(each.getAttribute("href") ?? "", /^#trace\/key=specification\/ref=main/, each.getAttribute("data-phase"));
    assert.match(panel, /ITM-001[\s\S]*done/);
    assert.match(panel, /<details class="explain"><summary>What is this\?<\/summary>/);
    assert.doesNotMatch(panel, /not drawn/);
  } finally { page.done(); }
});

// TST-800002 · level: unit · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; EVERY STEP EXPLAINS ITSELF; UC-035
// given: the fixture product whose model is the Kanban fixture (a work-in-progress limit of 2); ITM-001 and ITM-003 are done, ITM-002 is in progress, ITM-004 and ITM-005 are ready
// input: the route progress's render
// expect: the measure's panel names the limit 2, holds a card for each of the five items, each a link to #trace/key=specification/ref=main, ITM-002's card under "in progress" and ITM-001's under "done", the cumulative flow's chart (xychart-beta), and a folded "What is this?"
test("#progress — a Kanban product draws the board's cards with its limit and the cumulative flow", async () => {
  const page = await render("progress", {}, { files: kanban() });
  try {
    const panel = measure(page);
    assert.match(panel, /items per state over time/, "known positive: the panel is the measure's");
    assert.match(panel, /limit[^<]*2/i);
    const cards = found(page.target, "[data-card]");
    assert.deepEqual(cards.map((each) => each.getAttribute("data-card")).sort(), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]);
    for (const each of cards) assert.match(each.getAttribute("href") ?? "", /^#trace\/key=specification\/ref=main/, each.getAttribute("data-card"));
    const column = (name) => found(page.target, "[data-column]").find((each) => each.getAttribute("data-column") === name);
    assert.ok(column("in progress")?.innerHTML.includes('data-card="ITM-002"'), "ITM-002 in progress");
    assert.ok(column("done")?.innerHTML.includes('data-card="ITM-001"'), "ITM-001 done");
    assert.equal(found(page.target, "[data-flow-chart]").length, 1);
    assert.match(measure(page), /xychart-beta/);
    assert.match(panel, /<details class="explain"><summary>What is this\?<\/summary>/);
  } finally { page.done(); }
});

// TST-800003 · level: unit · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// given: the fixture product whose model is pulled, without sprints and without a work-in-progress limit: progressIn gives it neither a grid, sprints nor a flow
// input: the route progress's render
// expect: the measure's panel keeps the link to the backlog (#backlog), draws no grid cell, no card and no chart
test("#progress — a model with neither grid, sprints nor flow keeps its link to the backlog", async () => {
  const page = await render("progress", {}, { files: kanban((text) => text.replace("| WIP limit | 2 |", "| WIP limit | none |")) });
  try {
    const panel = measure(page);
    assert.ok(panel.length > 0, "known positive: the measure's panel stands");
    assert.ok(hrefs(page.target).includes("#backlog"), "the link to the backlog");
    assert.match(panel, /href="#backlog"/);
    assert.equal(found(page.target, "[data-cell], [data-card], [data-flow-chart]").length, 0);
  } finally { page.done(); }
});

// TST-800004 · level: unit · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: the product's host refuses its snapshot with NotFound, as GitHub does for a private repository that no stored token reaches
// input: the route progress's render
// expect: the render rejects with NotFound, for the frame to say that no token reaches the product (readProblem); the page holds no panel of the measure, no gates and no chart
test("#progress — a product that no token reaches shows nothing and carries the refusal to the frame", async () => {
  const host = hostOf(vModel());
  host.readSnapshot = async () => { throw Object.assign(new Error("Not Found"), { name: "NotFound" }); };
  const { view } = await import("../src/implementation-pages/index.mjs");
  const route = view.routes.find((each) => each.name === "progress");
  const target = globalThis.document.createElement("div");
  await assert.rejects(route.render(target, { page: "review", instance: { repository: "acme/agent-m", host }, product: { address: ADDRESS, kind: "github", host, tokenStored: false }, store: {}, go() {} }), { name: "NotFound" });
  assert.equal(found(target, "[data-part]").length, 0);
});
