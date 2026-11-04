// Release test of ITM-1333, a start refused as Moved names the collision at the moved head — what the Product Owner meets on the Backlog page: SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES says a
// refusal "names the holding sprint, the item and the module", and UC-032 6c says that when another team started a sprint in the meantime, Start sprint "is refused and names the sprint, the held item and the module". The case
// presses Start sprint on the route `backlog` over the real MOD-repository-hosts host behind a fake of GitHub's API (tests/uc-032-harness.mjs), on a page drawn before another team committed its sprint; it reads the
// refusal the page shows and the repository and the branches afterwards, never a code file.
// Run: node --test tests/release-itm-1333-moved-start-names-the-collision.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// Level: release
//
// Written for the release testing of sprint 131 by developer-sonnet-l, who implemented none of ITM-1333 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event; no input event of the operating system is made. Readings the texts leave open, which the case states:
//   - "in the meantime" is read as: after the page was drawn and before the click, team1's sprint team1/01 with ITM-001 (MOD-store) was committed to the default branch, which moves its head.
//   - "names the sprint, the held item and the module" is read as: the refusal the page prints contains `team1/01`, `ITM-001` and `MOD-store`.
//   - The redraw of the marks "anew" (UC-032 6c) is not tested here: MOD-implementation-pages' text gives the route no redraw on a refusal (team1/131.md, "Cannot be built as specified").

import test from "node:test";
import assert from "node:assert/strict";
import { found, frozen, HEAD, open, planOf, planResult, product, sprintPath, sprintText, tickOf, typeValue } from "./uc-032-harness.mjs";

const TEAM1_FIRST = sprintText({ n: 1, goal: "Store", start: "2026-10-30", closer: "alice", selection: ["ITM-001"], branch: "sprint/team1/01" });

// Team2 has Plan sprint open on a page drawn at HEAD, `item` ticked, the goal and the closer typed; then team1 commits its sprint; Start sprint is pressed. Returns what the page said and what was written.
async function pressed(item) {
  const files = await product({ files: { [sprintPath("team1", 2)]: null } });
  const page = await open("backlog", {}, { files, pullRequests: [], server: [await frozen(HEAD, { ...files })] });
  try {
    await planOf(page, "team2");
    typeValue(page, "[data-sprint-goal]", "Team two's goal");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, item).checked = true;
    await page.srv.change(sprintPath("team1", 1), TEAM1_FIRST);
    const writes = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    return { refusal: planResult(page), written: page.srv.writes.length - writes, team2: Object.hasOwn(page.srv.files, sprintPath("team2", 1)), team1: Object.hasOwn(page.srv.files, sprintPath("team1", 1)), branches: page.created };
  } finally { page.done(); }
}

// TST-1333101 · level: release · module: MOD-work-plans
// guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: the product of tests/uc-032-harness.mjs with no sprint running; ITM-001 and ITM-005 change MOD-store, ITM-003 changes MOD-mail; the Product Owner of team2 has Plan sprint open on a page drawn at the head, with the goal and the closer typed; then team1 commits its sprint team1/01 holding ITM-001, which moves the head; known positive first — team1's sprint stands on the default branch
// input: the Product Owner of team2 selects ITM-005 and presses Start sprint; then, in a second world, selects ITM-003, which shares no module with ITM-001, and presses Start sprint
// expect: known positive — team1's sprint team1/01 stands on the default branch in both worlds; with ITM-005 the start is refused and the refusal names team1/01, ITM-001 and MOD-store, nothing is written by the click, no record of team2 stands and no branch is created; counter-proof — with ITM-003 the start is refused as the default branch having moved on, and the refusal names no sprint, no held item and no module, and nothing is written and no branch is created either
test("TST-1333101: SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES — a Start sprint refused because another team committed meanwhile names the holding sprint, the item and the module", async () => {
  const collision = await pressed("ITM-005");
  assert.equal(collision.team1, true, "known positive: team1's sprint stands on the default branch");
  for (const named of ["team1/01", "ITM-001", "MOD-store"]) assert.ok(collision.refusal.includes(named), `the refusal names ${named}: ${collision.refusal}`);
  assert.doesNotMatch(collision.refusal, /moved on/, "and it is the collision that is said, not that the branch moved");
  assert.equal(collision.written, 0, "the click wrote nothing");
  assert.equal(collision.team2, false, "no record of team2 stands");
  assert.deepEqual(collision.branches, [], "and no branch was created");
  const apart = await pressed("ITM-003");
  assert.equal(apart.team1, true, "known positive: team1's sprint stands on the default branch");
  assert.match(apart.refusal, /moved on/, "counter-proof: with no collision the refusal is the host's: the default branch has moved");
  for (const named of ["team1/01", "ITM-001", "MOD-store"]) assert.ok(!apart.refusal.includes(named), `counter-proof: and it does not name ${named}: ${apart.refusal}`);
  assert.equal(apart.written, 0, "counter-proof: nothing is written");
  assert.equal(apart.team2, false);
  assert.deepEqual(apart.branches, []);
});
