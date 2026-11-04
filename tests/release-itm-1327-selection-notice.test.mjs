// Release tests of ITM-1327 — "A changed sprint selection names what it adds and removes": the SPEC's A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT ("a team's implementation jobs start only for items selected for that
// team's current sprint") and ONE CLICK PER DECISION ("a decision a person makes on the dashboard takes one click once its inputs are complete, and everything that follows from it is done by Agent M"), with UC-032 6a
// ("Changing the sprint selection is a new Start sprint decision, and Agent M shows what it removes or adds"). The cases walk the Product Owner's path on the route `backlog` of MOD-implementation-pages over the real
// MOD-work-plans, behind the fake of GitHub's API of tests/uc-032-harness.mjs, and read the notice the page shows and the record the repository holds afterwards; they never read the code files.
// Run: node --test tests/release-itm-1327-selection-notice.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-032; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; ONE CLICK PER DECISION
// Level: release
//
// Written for the release testing of sprint team1/132 by developer-sonnet-l, who implemented none of ITM-1327 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event. Readings the texts leave open, which the cases state:
//   - "shows what it removes or adds" is read as: the notice the click draws names each item the new selection holds that the old one did not, and each item the old one held that the new one does not.
//   - "the sprint's selection" is read as the last `## Selection` of the sprint's record.

import test from "node:test";
import assert from "node:assert/strict";
import { fieldOf, flash, found, open, planOf, product, sprintPath, tickOf, typeValue } from "./uc-032-harness.mjs";

const lastSelection = (record) => fieldOf(record.slice(record.lastIndexOf("## Selection")), "selection");
async function change(ticked, unticked, { team = "team1", files } = {}) {
  const page = await open("backlog", {}, { files: files ?? await product() });
  await planOf(page, team);
  for (const id of ticked) tickOf(page, id).checked = true;
  for (const id of unticked) tickOf(page, id).checked = false;
  typeValue(page, "[data-sprint-goal]", "Store and show");
  typeValue(page, "[data-sprint-closer]", "alice");
  const before = page.srv.writes.length;
  return { page, before, press: () => page.press(found(page.target, "[data-start-sprint]")[0]) };
}

// TST-1327101 · level: release · module: MOD-implementation-pages
// guards: UC-032; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the product of tests/uc-032-harness.mjs in which team1's sprint team1/02 runs with ITM-001 (merged) and ITM-002; known positive first — team2 has no sprint, and starts one with ITM-003
// input: the Product Owner of team2 starts a sprint with ITM-003; then the Product Owner of team1 presses Change the selection, adds ITM-003 and takes ITM-002 out, and presses Start sprint
// expect: known positive — a sprint started anew names ITM-003 as added and no item as removed; the change names ITM-003 as added and ITM-002 as removed, and the last selection of team1/02's record is exactly the ticked items (ITM-003, without ITM-002), so jobs start only for those
test("TST-1327101: UC-032 6a the notice of a changed selection names the items it adds and removes, and the record holds exactly the new selection", async () => {
  const anew = await change(["ITM-003"], [], { team: "team2" });
  try {
    await anew.press();
    assert.match(flash(anew.page), /is started/);
    assert.match(flash(anew.page), /Added: ITM-003\./, "known positive: a sprint started anew names its selection as added");
    assert.doesNotMatch(flash(anew.page), /Removed/, "and removes nothing");
  } finally { anew.page.done(); }
  const { page, press } = await change(["ITM-003"], ["ITM-002"]);
  try {
    await press();
    const notice = flash(page);
    assert.match(notice, /is changed/);
    assert.match(notice, /Added: [^.]*ITM-003/, notice);
    assert.match(notice, /Removed: [^.]*ITM-002/, notice);
    assert.doesNotMatch(notice.replace(/Removed:.*/, ""), /ITM-002/, "ITM-002 is not among the added");
    assert.equal(lastSelection(page.srv.files[sprintPath("team1", 2)]), "ITM-003", "the sprint's selection is what was ticked");
  } finally { page.done(); }
});

// TST-1327102 · level: release · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION
// given: the product of TST-1327101; the Product Owner of team1 has Plan sprint open and has ticked ITM-003 and cleared ITM-002
// input: reading the page and the repository before any press; then one press of Start sprint
// expect: before the press nothing is written; the one press makes one commit, of team1/02's record alone, and draws the notice that names ITM-003 as added and ITM-002 as removed — no second control is needed to see what the decision changed
test("TST-1327102: UC-032 6a one press of Start sprint commits the new selection and names what it adds and removes", async () => {
  const { page, before, press } = await change(["ITM-003"], ["ITM-002"]);
  try {
    assert.equal(page.srv.writes.length, before, "ticking and clearing writes nothing");
    assert.doesNotMatch(flash(page), /Added|Removed/, "and shows no notice yet");
    await press();
    assert.equal(page.srv.writes.length, before + 1, "one press, one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), [sprintPath("team1", 2)], "of the sprint's record alone");
    assert.match(flash(page), /Added: [^.]*ITM-003[^]*Removed: [^.]*ITM-002/, flash(page));
  } finally { page.done(); }
});
