// start.mjs on the main page registers the strategies of its view and of the prompt bar's hand-over, each set once (ITM-572): the
// main page's view hands sourceStrategies, MOD-prompt-bar's handOverStrategies are registered after it, and the set both hand is
// registered once. The kinds whose strategies are all handed are then prepared without UnknownStrategy.
//
// Run: node --test tests/site-frame-start-hand-over-main.test.mjs
//
// Module: MOD-site-frame; MOD-prompt-bar
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads them from a document. The view is a fixture
// (tests/site-frame-start.d/view-source) in the form of MOD-main-page's view. The job runner's registry is one per process, so this
// page is a file of its own, apart from the review page's. The fetch is the fixture's own, which refuses every request. The
// counter-proofs (a planted fault in src/site-frame/start.mjs or src/prompt-bar/hand-over.mjs and the test's failing result) are
// recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { outside } from "./site-frame-start.d/dom.mjs";
import { ownerOf, pageWithScript, unknownStrategyOf } from "./site-frame-start.d/page.mjs";
import { registeredAll } from "../src/job-runner/index.mjs";

const VIEW_SOURCE = "../tests/site-frame-start.d/view-source";

// TST-572005 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: a main page whose script tag has data-page="main" and data-views naming view-source (hands sourceStrategies), and an empty data-menu-views
// input: start.mjs is loaded
// expect: the load does not reject although the bar's handOverStrategies hold sourceStrategies too; the recipe chapters-for-implementation (sourceStrategies) is registered by view-source, the first that hands it; the recipes use-cases (approvalStrategies) and resource-check (resourceStrategies), the step due-diligence (reuseStrategies) and the writer queue-entries (specStrategies) by MOD-prompt-bar; no request left the fixture
test("TST-572005 on the main page start.mjs registers its view's set once and the bar's other sets under MOD-prompt-bar", async () => {
  pageWithScript({ "data-page": "main", "data-views": VIEW_SOURCE, "data-menu-views": "" });
  await import("../src/site-frame/start.mjs?hand-over-main");
  await registeredAll(); // the registrations the page makes before the runner first looks a strategy up
  assert.equal(ownerOf("recipes", "chapters-for-implementation"), VIEW_SOURCE);
  assert.equal(ownerOf("recipes", "use-cases"), "MOD-prompt-bar");
  assert.equal(ownerOf("recipes", "resource-check"), "MOD-prompt-bar");
  assert.equal(ownerOf("steps", "due-diligence"), "MOD-prompt-bar");
  assert.equal(ownerOf("writers", "queue-entries"), "MOD-prompt-bar");
  assert.deepEqual(outside.reached, []);
});

// TST-572006 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the main page of TST-572005, started
// input: MOD-job-runner's prepareJob for each kind of the catalogue named below, in a context with no snapshot and no participant
// expect: no kind of derive-requirements, change-requirements, derive-use-cases, change-use-case, derive-architecture, review-architecture, check-for-persons, check-resource, converse, implement and draft-plan meets an UnknownStrategy (implement's writer branch-and-pull-request is handed by MOD-runtimes' routeStrategies through the bar's handOverStrategies; draft-plan's recipe architecture-and-model, check plan-checks and writer plan-steps by MOD-work-plans' workStrategies); decide-gate meets the UnknownStrategy gate-inputs — a recipe no module offers (MOD-job-catalogue) — which shows that the check does detect a missing strategy
test("TST-572006 on the main page every kind whose strategies are all handed is prepared without UnknownStrategy", async () => {
  for (const kind of ["derive-requirements", "change-requirements", "derive-use-cases", "change-use-case", "derive-architecture",
    "review-architecture", "check-for-persons", "check-resource", "converse", "implement", "draft-plan"]) {
    assert.equal(await unknownStrategyOf(kind), null, `${kind} meets no UnknownStrategy`);
  }
  assert.equal(await unknownStrategyOf("decide-gate"), "gate-inputs");
});
