// start.mjs on a review page registers the strategies of the views and of the prompt bar's hand-over, each set once (ITM-572): the
// views hand their sets as `View.strategies`; MOD-prompt-bar's `handOverStrategies` are registered after them, under the owner
// MOD-prompt-bar; a set that a view and the bar hand, or two views hand, is registered once; a second evaluation of start.mjs in one
// process counts a strategy its own owner registered as already registered; any other DuplicateStrategy still throws. The kinds
// whose strategies are all handed are then prepared without UnknownStrategy.
//
// Run: node --test tests/site-frame-start-hand-over-review.test.mjs
//
// Module: MOD-site-frame; MOD-prompt-bar
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads them from a document. The views are fixtures
// (tests/site-frame-start.d/view-approvals-a, view-approvals-b, view-taken) that hand the real approvalStrategies and sourceStrategies,
// as MOD-review-pages hands them. The job runner's registry is one per process, so each test builds on the registrations of the ones
// before it, in this file's order. The fetch is the fixture's own, which refuses every request. The counter-proofs (a planted fault in
// src/site-frame/start.mjs or src/prompt-bar/hand-over.mjs and the test's failing result) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { outside } from "./site-frame-start.d/dom.mjs";
import { ownerOf, pageWithScript, unknownStrategyOf } from "./site-frame-start.d/page.mjs";
import { registeredAll } from "../src/job-runner/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";

const VIEW_A = "../tests/site-frame-start.d/view-approvals-a";
const VIEW_B = "../tests/site-frame-start.d/view-approvals-b";
const VIEW_TAKEN = "../tests/site-frame-start.d/view-taken";

// The page of the review pages: the two views, which both hand approvalStrategies and one of which hands sourceStrategies.
const reviewPage = () => pageWithScript({ "data-page": "review", "data-views": `${VIEW_A} ${VIEW_B}`, "data-menu-views": "" }, "#alpha");

// TST-572001 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: a review page whose script tag has data-page="review" and data-views naming view-approvals-a (hands approvalStrategies and the check itm572OwnA) and view-approvals-b (hands approvalStrategies, sourceStrategies and the check itm572OwnB); the fragment #alpha
// input: start.mjs is loaded
// expect: the load does not reject although two views hand approvalStrategies; approvalStrategies' recipe use-cases is registered by view-approvals-a, the first view that hands it; sourceStrategies' recipe chapters-for-implementation by view-approvals-b; the checks itm572OwnA and itm572OwnB by their own views; and what no view hands but MOD-prompt-bar's handOverStrategies do — the recipe resource-check (resourceStrategies), the recipe implementation-inputs (runStrategies), the step due-diligence (reuseStrategies), the writer queue-entries (specStrategies) and the writer open-files (editStrategies) — by MOD-prompt-bar; no request left the fixture
test("TST-572001 start.mjs registers each set once however many views hand it, and the bar's sets under MOD-prompt-bar", async () => {
  reviewPage();
  await import("../src/site-frame/start.mjs?hand-over-review");
  await registeredAll(); // the registrations the page makes before the runner first looks a strategy up
  assert.equal(ownerOf("recipes", "use-cases"), VIEW_A);
  assert.equal(ownerOf("recipes", "chapters-for-implementation"), VIEW_B);
  assert.equal(ownerOf("checks", "itm572OwnA"), VIEW_A);
  assert.equal(ownerOf("checks", "itm572OwnB"), VIEW_B);
  assert.equal(ownerOf("recipes", "resource-check"), "MOD-prompt-bar");
  assert.equal(ownerOf("recipes", "implementation-inputs"), "MOD-prompt-bar");
  assert.equal(ownerOf("steps", "due-diligence"), "MOD-prompt-bar");
  assert.equal(ownerOf("writers", "queue-entries"), "MOD-prompt-bar");
  assert.equal(ownerOf("writers", "open-files"), "MOD-prompt-bar");
  assert.deepEqual(outside.reached, []);
});

// TST-572002 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the review page of TST-572001, started
// input: MOD-job-runner's prepareJob for each kind of the catalogue named below, in a context with no snapshot and no participant
// expect: no kind of derive-requirements, change-requirements, derive-use-cases, change-use-case, derive-architecture, review-architecture, check-for-persons, check-resource, converse, implement and draft-plan meets an UnknownStrategy (implement's writer branch-and-pull-request is handed by MOD-runtimes' routeStrategies through the bar's handOverStrategies; draft-plan's recipe architecture-and-model, check plan-checks and writer plan-steps by MOD-work-plans' workStrategies); decide-gate meets the UnknownStrategy gate-inputs (a recipe no module offers, MOD-job-catalogue) — which shows that the check does detect a missing strategy
test("TST-572002 on a review page every kind whose strategies are all handed is prepared without UnknownStrategy", async () => {
  for (const kind of ["derive-requirements", "change-requirements", "derive-use-cases", "change-use-case", "derive-architecture",
    "review-architecture", "check-for-persons", "check-resource", "converse", "implement", "draft-plan"]) {
    assert.equal(await unknownStrategyOf(kind), null, `${kind} meets no UnknownStrategy`);
  }
  assert.equal(await unknownStrategyOf("decide-gate"), "gate-inputs");
});

// TST-572003 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the registrations of TST-572001, and a review page with the same script tag and fragment
// input: start.mjs is loaded a second time in the same process (under another query), as TST-531013 loads it
// expect: the load does not reject: the sets the first load registered under view-approvals-a, view-approvals-b and MOD-prompt-bar are counted as already registered; and their owners are those of the first load
test("TST-572003 a second evaluation of start.mjs counts the strategies its own owners registered as already registered", async () => {
  reviewPage();
  await import("../src/site-frame/start.mjs?hand-over-review-again");
  await registeredAll(); // the registrations the page makes before the runner first looks a strategy up
  assert.equal(ownerOf("recipes", "use-cases"), VIEW_A);
  assert.equal(ownerOf("recipes", "chapters-for-implementation"), VIEW_B);
  assert.equal(ownerOf("recipes", "resource-check"), "MOD-prompt-bar");
  assert.deepEqual(outside.reached, []);
});

// TST-572004 · level: unit · module: MOD-site-frame
// guards: UC-049
// given: the check itm572Taken registered by the owner someone-else, and a review page whose data-views names view-taken, which hands a set holding a check of that name
// input: start.mjs is loaded
// expect: the load rejects with a DuplicateStrategy whose owners are ["someone-else", the slug of view-taken]: a duplicate whose first owner is not the owner now registering is not counted as already registered
test("TST-572004 a strategy another owner registered still throws DuplicateStrategy", async () => {
  registerStrategies("someone-else", { checks: { itm572Taken: () => [] } });
  pageWithScript({ "data-page": "review", "data-views": VIEW_TAKEN, "data-menu-views": "" });
  await assert.rejects(import("../src/site-frame/start.mjs?hand-over-taken"), (error) => {
    assert.equal(error.name, "DuplicateStrategy");
    assert.deepEqual(error.owners, ["someone-else", VIEW_TAKEN]);
    return true;
  });
});
