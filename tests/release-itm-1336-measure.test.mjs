// Release test of ITM-1336 — the panel Blocked stands beside the model's own measure, whatever the model. Written from UC-035 step 4 ("A panel **Blocked** lists every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, each with its reason") and from the SPEC's PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE.
// Run: node --test tests/release-itm-1336-measure.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// Level: release
//
// Written for the release testing of sprint team1/134 by a participant who implemented none of ITM-1336 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the page as the existing tests of the route do (tests/implementation-pages-sprints.mjs: the product held in memory behind a host that records its calls, the route `progress` of MOD-implementation-pages drawn into a DOM), with the V-model of the instance's catalogue or the Kanban fixture (tests/fixtures/flow/kanban.md) as the product's process model. The marks read are those of the page's panels: the panel is `data-part="blocked"`, an entry of it `data-blocked="<item>"`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const modelFile = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const vModel = () => productFiles({ "docs/process-models/fixture.md": modelFile("../src/model-catalogue/models/v-model.md") });
const kanban = () => productFiles({ "docs/process-models/fixture.md": modelFile("./fixtures/flow/kanban.md") });
const parts = (page) => found(page.target, "[data-part]").map((each) => each.getAttribute("data-part"));

// TST-1336101 · level: release · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// given: three products that differ in their process model only — the V-model, the Kanban fixture, the Scrum fixture —, each with the items ITM-001 to ITM-005
// input: the reader opens Progress of each
// expect: each page holds exactly one panel Blocked and the model's own measure beside it (the V-model's grid cells and no card; the Kanban's five cards and a cumulative flow chart and no cell; the Scrum's panels of two teams and neither cell nor card), so the panel adds to the measure and replaces none
// Planted fault: the measure panel left out for a model without sprints (`measurePanel(ctx, model)` replaced by `""` in draw of src/implementation-pages/progress.mjs) fails the V-model case on "the model's own measure"; the panel Blocked left out (`${blockedPanel(ctx, sprints)}` removed) fails it on "one Blocked panel".
test("TST-1336101 each model's progress page holds the panel Blocked beside its own measure", async () => {
  const pages = [["V-model", vModel()], ["Kanban", kanban()], ["Scrum", productFiles()]];
  for (const [name, files] of pages) {
    const page = await render("progress", {}, { files });
    try {
      assert.equal(parts(page).filter((each) => each === "blocked").length, 1, `${name}: one Blocked panel`);
      const count = (selector) => found(page.target, selector).length;
      const own = { cells: count("[data-cell]"), cards: count("[data-card]"), flow: count("[data-flow-chart]"), teams: count("[data-team]") };
      if (name === "V-model") assert.ok(own.cells >= 7 && !own.cards && !own.flow && !own.teams, `${name}: the model's own measure (${JSON.stringify(own)})`);
      if (name === "Kanban") assert.ok(own.cards === 5 && own.flow === 1 && !own.cells && !own.teams, `${name}: the model's own measure (${JSON.stringify(own)})`);
      if (name === "Scrum") assert.ok(own.teams >= 2 && !own.cells && !own.cards && !own.flow, `${name}: the model's own measure (${JSON.stringify(own)})`);
    } finally { page.done(); }
  }
});
