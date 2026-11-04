// Release tests of ITM-1328 — "In a planned model the backlog page links the implementation plan and draws no backlog": UC-032 1b ("The product's model works from a plan. There is no backlog. Agent M links to the implementation
// plan (UC-045)"), UC-045 1a (the mirror: "The product's model works from a backlog ... There is no implementation plan; Agent M links to the backlog"), the SPEC's A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN ("In a model
// that plans its work in advance, an implementation job starts only for a step of the product's implementation plan") and THE PROCESS MODEL IS DECLARED PER PRODUCT ("Each managed product declares exactly one process model ...;
// Agent M does not assume a default"). The cases open the route `backlog` of MOD-implementation-pages over the real MOD-work-plans, behind the fake of GitHub's API of tests/uc-032-harness.mjs, and read the page; they never read
// the code files.
// Run: node --test tests/release-itm-1328-planned-model-links-plan.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UC-045; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; THE PROCESS MODEL IS DECLARED PER PRODUCT
// Level: release
//
// Written for the release testing of sprint team1/132 by developer-sonnet-l, who implemented none of ITM-1328 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the cases state:
//   - "draws no backlog" is read as: the page draws no part (`[data-part]`: the backlog, the uncovered requirements, a team's last sprint) and none of the controls that select, add or propose items or plan a sprint.
//   - "links the implementation plan" is read as: the page holds a link to the route `plan` (`#plan`), which opens.
//   - "starts only for a step of the plan" is read, for the page, as: the backlog route offers no way to start work on an item in a planned model.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODELS, found, open, plain, product, walk } from "./uc-032-harness.mjs";

const PLANNED = readFileSync(new URL("./fixtures/process-models/planned.md", import.meta.url), "utf8");
const CONTROLS = ["[data-propose-items]", "[data-add-item]", "[data-plan]", "[data-select-item]", "[data-start-sprint]"];
const hrefs = (page) => walk(page.target, (node) => node.localName === "a").map((link) => link.getAttribute("href"));
async function backlogOf(model) { return open("backlog", {}, { files: await product({ model }) }); }

// TST-1328101 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-045; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the product of tests/uc-032-harness.mjs whose declared model plans its work in advance; known positive first — the same product with a Scrum model
// input: the Product Owner opens Backlog in the Scrum product, and then in the planned product, and follows the link to the plan
// expect: known positive — the Scrum product draws its parts, offers + Item, Propose items and Plan sprint, and does not link #plan; the planned product says it plans its work in advance and has no backlog, links #plan, draws no part and offers none of those controls, so no work is started from this page; the route plan opens
test("TST-1328101: UC-032 1b a planned model's backlog page links the implementation plan and draws no backlog and no way to start work on an item", async () => {
  const scrum = await backlogOf(MODELS.scrum);
  try {
    assert.ok(found(scrum.target, "[data-part]").length > 0, "known positive: a Scrum product draws its parts");
    for (const control of ["[data-propose-items]", "[data-add-item]", "[data-plan]"]) assert.ok(found(scrum.target, control).length > 0, `known positive: ${control} is offered`);
    assert.ok(!hrefs(scrum).includes("#plan"), "and links no plan");
  } finally { scrum.done(); }
  const page = await backlogOf(PLANNED);
  try {
    assert.match(plain(page.html()), /plans its work in advance: there is no backlog \(UC-032 1b\)/);
    assert.ok(hrefs(page).includes("#plan"), "the page links the implementation plan");
    assert.equal(found(page.target, "[data-part]").length, 0, "no part is drawn");
    for (const control of CONTROLS) assert.equal(found(page.target, control).length, 0, `${control} is not offered`);
  } finally { page.done(); }
  const plan = await open("plan", {}, { files: await product({ model: PLANNED }) });
  try { assert.match(plain(plan.html()), /plan/i, "the linked route opens"); } finally { plan.done(); }
});

// TST-1328102 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-045; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: two products with the same items, modules and teams that differ only in the model they declare: the planned model and Kanban
// input: the Product Owner opens Backlog of each
// expect: what the page draws follows the declared model alone: the planned product says there is no backlog and links #plan; the Kanban product draws its parts, does not say there is no backlog and does not link #plan
test("TST-1328102: UC-032 1b the backlog page follows the model the product declares, not a default", async () => {
  const kanban = await backlogOf(MODELS.kanban);
  try {
    assert.ok(found(kanban.target, "[data-part]").length > 0, "Kanban draws its parts");
    assert.doesNotMatch(plain(kanban.html()), /there is no backlog/);
    assert.ok(!hrefs(kanban).includes("#plan"));
  } finally { kanban.done(); }
  const planned = await backlogOf(PLANNED);
  try {
    assert.match(plain(planned.html()), /there is no backlog/);
    assert.ok(hrefs(planned).includes("#plan"));
    assert.equal(found(planned.target, "[data-part]").length, 0);
  } finally { planned.done(); }
});
