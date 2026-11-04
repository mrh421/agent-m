// MOD-implementation-pages' route `backlog` in a product whose model plans its work in advance (ITM-1328), as UC-032 1b states it: "The product's model works from a plan. There is no backlog.
// Agent M links to the implementation plan (UC-045)." — the mirror of the route `plan`, which for a model that works from a backlog gives "a link to `backlog`, and nothing else"
// (docs/architecture/MOD-implementation-pages.md, Interfaces, `plan`).
// Run: node --test tests/implementation-pages-backlog-planned-model.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UC-045
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory behind that file's host; for the planned case its declaration names the catalogue's V-model
// (src/model-catalogue/models/v-model.md, kind planned) in place of the fixture's Scrum model. Nothing reaches the network. Readings the texts leave open, which the test states (the pull request
// names them): "draws no backlog" is read as: neither the part `backlog` nor the part `uncovered` stands on the page, nor a team's panel or a planning of a sprint; the warning keeps its words
// "plans its work in advance: there is no backlog (UC-032 1b)" and links `#plan`. The test states its input and its expected result before it runs (given / input / expect). The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const vModel = () => {
  const files = productFiles();
  files["docs/process.md"] = files["docs/process.md"].replace("model: fixture-scrum-wip", "model: v-model").replace("docs/process-models/fixture.md", "src/model-catalogue/models/v-model.md");
  return files;
};
const parts = (page) => found(page.target, "[data-part]").map((node) => node.getAttribute("data-part"));
const links = (page) => found(page.target, "[href]").map((node) => node.getAttribute("href"));

// TST-1328001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; UC-045
// given: the fixture product with its Scrum model, and the same product whose declaration names the V-model, a model of kind planned
// input: the route backlog's render, for each
// expect: known positive — the Scrum product's page draws the part backlog and the part uncovered; the V-model product's page says "plans its work in advance: there is no backlog (UC-032 1b)", links #plan, and draws no part backlog, no part uncovered, no team's panel and no part flow; counter-proof — on the base the V-model page draws the backlog
test("#backlog — in a planned model the page links the implementation plan and draws no backlog", async () => {
  const scrum = await render("backlog");
  try {
    assert.ok(parts(scrum).includes("backlog"), `known positive: the Scrum page draws the backlog: ${parts(scrum)}`);
    assert.ok(parts(scrum).includes("uncovered"), `known positive: and what no item realises: ${parts(scrum)}`);
  } finally { scrum.done(); }

  const planned = await render("backlog", {}, { files: vModel() });
  try {
    assert.match(planned.html(), /plans its work in advance: there is no backlog \(UC-032 1b\)/, "known positive: the warning stands");
    assert.ok(links(planned).includes("#plan"), `the page links the implementation plan: ${links(planned)}`);
    assert.deepEqual(parts(planned).filter((name) => ["backlog", "uncovered", "teams", "flow"].includes(name)), [], `no backlog, nothing realised by no item, no team, no flow: ${parts(planned)}`);
    assert.equal(found(planned.target, "[data-team]").length, 0, "no team's panel");
    assert.equal(found(planned.target, "[data-plan-team]").length, 0, "no planning of a sprint");
  } finally { planned.done(); }
});
