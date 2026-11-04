// Release tests of ITM-800 — the progress page of a product, drawn in the measure of the product's own process model. Written from UC-035 ("The reader opens **Progress** ... Agent M computes the progress in the measure the model defines, and draws it as in the table above. Every number is computed now. None is read from a stored status." and "Each chart and panel carries a folded **What is this?**") and from the SPEC's PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE ("A V-model, a Scrum and a Kanban fixture each render their declared measure"), PROGRESS AND JOB STATE ARE DERIVED, NOT STORED, UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN and EVERY STEP EXPLAINS ITSELF.
// Run: node --test tests/release-itm-800-progress-page.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; EVERY STEP EXPLAINS ITSELF; UC-035
// Level: release
//
// Written for the release testing of sprint team1/133 by a participant who implemented none of ITM-800 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the page as the existing tests of the route do (tests/implementation-pages-sprints.mjs: the product held in memory behind a host that records its calls, the route `progress` of MOD-implementation-pages drawn into a DOM), with the V-model
// of the instance's catalogue, the Kanban fixture (tests/fixtures/flow/kanban.md) and the Scrum fixture of that file. The cases read the page's outcome, not the panels' markup beyond the marks the SPEC names (a folded explanation is a `details` with the summary "What is this?").
// Readings the texts leave open, which the cases state:
//   - A model's "declared measure" is drawn when the page holds the thing the UC table names for the model kind: for the V-model a grid of requirements by phases, for Kanban cards by state with a cumulative flow chart, for Scrum a panel for each team's running sprint; a measure of another kind is not drawn on that page.
//   - "Stored" is anything the page writes: a commit or a call of the host that changes the repository.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PULL_REQUESTS, found, productFiles, render } from "./implementation-pages-sprints.mjs";

const modelFile = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const vModel = (extra = {}) => productFiles({ "docs/process-models/fixture.md": modelFile("../src/model-catalogue/models/v-model.md"), ...extra });
const kanban = (extra = {}) => productFiles({ "docs/process-models/fixture.md": modelFile("./fixtures/flow/kanban.md"), ...extra });
const kinds = (page) => ({ cells: found(page.target, "[data-cell]").length, cards: found(page.target, "[data-card]").length, flow: found(page.target, "[data-flow-chart]").length, teams: found(page.target, "[data-team]").length });
const SPEC_TWO = "# SPEC\n\n## 1. Rules\n\n**RULE ONE** *(PO, 2026-09-01)*\nThe first rule.\n*Check:* at review.\n\n**RULE TWO** *(PO, 2026-09-01)*\nNo use case realises this one.\n*Check:* at review.\n";

// TST-800101 · level: release · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// given: three products that differ in their process model only — the V-model, the Kanban fixture (limit 2), the Scrum fixture —, each with the one requirement RULE ONE and the items ITM-001 to ITM-005
// input: the reader opens Progress of each
// expect: the V-model's page holds a grid cell for RULE ONE in each phase and no card and no flow chart; the Kanban page holds a card for each of the five items and one cumulative flow chart and no grid cell; the Scrum page holds no grid cell, no card and no flow chart, and a panel for each of the two teams (team1's running sprint, the measure of remaining items per time box)
// Planted fault: the Kanban branch of measurePanel disabled (`measure?.flow ? flowPanel(ctx, measure.flow)` replaced by `false ? flowPanel(ctx, measure.flow)` in src/implementation-pages/progress.mjs) draws no cards and no chart, and the case fails on "Kanban's cards and cumulative flow".
test("TST-800101 each model's product shows its own measure and not another's", async () => {
  const v = await render("progress", {}, { files: vModel() }), k = await render("progress", {}, { files: kanban() }), s = await render("progress", {});
  try {
    assert.deepEqual({ ...kinds(v), cellsFound: kinds(v).cells > 0 }, { cells: kinds(v).cells, cards: 0, flow: 0, teams: 0, cellsFound: true }, "V-model: a grid and nothing of the others");
    assert.ok(kinds(v).cells >= 7 && new Set(found(v.target, "[data-cell]").map((each) => each.getAttribute("data-requirement"))).has("RULE ONE"), "known positive: RULE ONE in each phase");
    assert.deepEqual(kinds(k), { cells: 0, cards: 5, flow: 1, teams: 0 }, "failure node: Kanban's cards and cumulative flow");
    const scrum = kinds(s);
    assert.deepEqual([scrum.cells, scrum.cards, scrum.flow], [0, 0, 0], "Scrum: neither the grid nor the board");
    assert.ok(scrum.teams >= 2, `known positive: a panel for each team's running sprint (${scrum.teams})`);
  } finally { v.done(); k.done(); s.done(); }
});

// TST-800102 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: the Kanban product with ITM-002's pull request open; known positive: ITM-002 stands in the column "in progress"
// input: the reader opens Progress; then the product's pull request of ITM-002 is merged and the reader opens Progress again, on a page with no state carried over from the first
// expect: the first page writes nothing (the host saw no commit); ITM-002 is in "in progress" on the first page and in "done" on the second, so the card follows the repository and nothing stored
// Planted fault: every column drawing the last column's cards (`column.items.map` of flowPanel replaced by `columns.at(-1).items.map`) fails the case on the known positive.
test("TST-800102 the board follows the repository and the page writes nothing", async () => {
  const column = (page, name) => found(page.target, "[data-column]").find((each) => each.getAttribute("data-column") === name);
  const before = await render("progress", {}, { files: kanban() });
  try {
    assert.ok(column(before, "in progress")?.innerHTML.includes('data-card="ITM-002"'), "known positive: ITM-002 is in progress while its pull request is open");
    assert.deepEqual(before.host.calls.filter(([name]) => name === "commitFiles"), [], "failure node: the page wrote");
    assert.deepEqual(before.host.commits, []);
  } finally { before.done(); }
  const merged = PULL_REQUESTS.map((each) => (each.number === 2 ? { ...each, state: "merged", merged: "2026-10-22T09:00:00Z", closed: "2026-10-22T09:00:00Z", updated: "2026-10-22T09:00:00Z", mergeCommit: "e".repeat(40) } : each));
  const after = await render("progress", {}, { files: kanban(), pullRequests: merged });
  try {
    assert.ok(column(after, "done")?.innerHTML.includes('data-card="ITM-002"'), "failure node: the merged item is not in done");
    assert.ok(!(column(after, "in progress")?.innerHTML ?? "").includes('data-card="ITM-002"'), "ITM-002 is still in progress");
  } finally { after.done(); }
});

// TST-800103 · level: release · module: MOD-implementation-pages
// guards: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; UC-035
// given: the V-model product whose SPEC holds RULE ONE, which items realise, and RULE TWO, which no use case and no item realises
// input: the reader opens Progress
// expect: the grid holds a row of cells for RULE TWO as for RULE ONE (it is shown, not hidden), and the page is complete: the gates and who-works-on-what panels stand beside it
// Planted fault: RULE TWO filtered out of plannedPanel's requirements (`.filter((name) => name !== "RULE TWO")` added to `requirements`) fails the case on "the unrealised requirement is not shown in the grid".
test("TST-800103 a requirement nothing realises is shown in the grid and blocks nothing", async () => {
  const page = await render("progress", {}, { files: vModel({ "SPEC.md": SPEC_TWO }) });
  try {
    const of = (name) => found(page.target, "[data-cell]").filter((each) => each.getAttribute("data-requirement") === name).length;
    assert.ok(of("RULE ONE") >= 7, "known positive: RULE ONE has a cell in every phase");
    assert.equal(of("RULE TWO"), of("RULE ONE"), "failure node: the unrealised requirement is not shown in the grid");
    const parts = found(page.target, "[data-part]").map((each) => each.getAttribute("data-part"));
    assert.ok(parts.includes("gates") && parts.includes("who") && parts.includes("measure"), `the rest of the page stands (${parts})`);
  } finally { page.done(); }
});

// TST-800104 · level: release · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the progress pages of the V-model, the Kanban and the Scrum products
// input: the reader opens each
// expect: every panel of the page (each element with a data-part) holds a folded explanation — a `details` with the summary "What is this?" that is not open — and so does the page's head; the V-model and Kanban pages hold at least three panels, the measure's among them (known positive)
// Planted fault: the measure's explanation left out (`${WHY_MEASURE}` removed from measurePanel in src/implementation-pages/progress.mjs) fails the case on the measure panel of the V-model page.
test("TST-800104 each chart and panel of the progress page carries a folded explanation", async () => {
  for (const [name, files] of [["V-model", vModel()], ["Kanban", kanban()], ["Scrum", productFiles()]]) {
    const page = await render("progress", {}, { files });
    try {
      const panels = found(page.target, "[data-part]");
      if (name !== "Scrum") assert.ok(panels.length >= 3 && panels.some((each) => each.getAttribute("data-part") === "measure"), `known positive: ${name} draws its panels (${panels.length})`);
      for (const panel of panels) {
        const explain = found(panel, "[class]").filter((each) => each.localName === "details");
        assert.ok(explain.length >= 1 && /What is this\?/.test(explain[0].textContent) && explain[0].getAttribute("open") === null, `failure node: ${name}'s panel ${panel.getAttribute("data-part")} has no folded "What is this?"`);
      }
      const head = found(page.target, "[class]").filter((each) => each.localName === "section" && each.getAttribute("class") === "head")[0];
      assert.ok(head && /What is this\?/.test(head.textContent), `${name}'s head carries an explanation`);
    } finally { page.done(); }
  }
});

// TST-800105 · level: release · module: MOD-implementation-pages
// guards: UC-035
// given: the V-model product, whose model has no sprints, with the item ITM-002 whose job is working on it
// input: the reader opens Progress
// expect: UC-035 step 4 — a panel "Blocked" stands on the page, whatever the model's kind, listing every item or plan entry that cannot move, or saying none does
// Planted fault: the panel left out for a model without sprints (`${blockedPanel(ctx)}` in draw of src/implementation-pages/progress.mjs replaced by `${sprints ? blockedPanel(ctx) : ""}`) fails the case on "no Blocked panel".
test("TST-800105 a planned or Kanban product's progress page holds the Blocked panel", async () => {
  for (const files of [vModel(), kanban()]) {
    const page = await render("progress", {}, { files });
    try {
      assert.ok(found(page.target, "[data-part]").some((each) => each.getAttribute("data-part") === "blocked"), "no Blocked panel");
    } finally { page.done(); }
  }
});
