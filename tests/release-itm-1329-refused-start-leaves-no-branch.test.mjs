// Release tests of ITM-1329, a refused Start sprint leaves no branch — what the Product Owner meets on the Backlog page: UC-032 6c says a Start sprint that cannot be committed "is refused"; with a branch of
// its own for each sprint (A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN), a refused start leaves nothing behind, and a start that is written commits the sprint's record and then makes its branch. The cases press
// Start sprint on the route `backlog` over the real MOD-repository-hosts host behind a fake of GitHub's API (tests/uc-032-harness.mjs); they read the repository and the branches created afterwards, never a code file.
// Run: node --test tests/release-itm-1329-refused-start-leaves-no-branch.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// Level: release
//
// Written for the release testing of sprint 130 by developer-sonnet-l, who implemented none of ITM-1329 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "the default branch has moved" is read as: another commit reached the default branch after the page was drawn, whatever it changed; the cases use a commit that touches no sprint and no item, so that the refusal is the
//     host's `Moved` and no other check of Start sprint.
//   - "leaves no branch" is read as: no reference `refs/heads/sprint/<team>/<nn>` was created, in the time between the click and the next read of the repository.

import test from "node:test";
import assert from "node:assert/strict";
import { HEAD, found, frozen, open, planOf, planResult, product, sprintPath, tickOf, typeValue } from "./uc-032-harness.mjs";

const MOVED = "docs/notes/another-commit.md";

// Team2 has Plan sprint open on a page drawn at HEAD with ITM-003 ticked and its goal and closer typed; the click is not yet made.
async function planning() {
  const files = await product({ files: { [sprintPath("team1", 2)]: null } });
  const page = await open("backlog", {}, { files, pullRequests: [], server: [await frozen(HEAD, { ...files })] });
  await planOf(page, "team2");
  typeValue(page, "[data-sprint-goal]", "Mail");
  typeValue(page, "[data-sprint-closer]", "bob");
  tickOf(page, "ITM-003").checked = true;
  return page;
}

// TST-1329101 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: the product of tests/uc-032-harness.mjs with no sprint running, whose declaration gives each sprint the branch sprint/<team>/<nn>; the Product Owner of team2 has Plan sprint open on a page drawn at the head, ITM-003 ticked, the goal "Mail" and the closer bob typed; then another commit, which changes no sprint and no item, reaches the default branch; known positive first — that commit is on the default branch and the head has moved
// input: the Product Owner of team2 presses Start sprint on the page drawn before the commit; then opens Backlog again and presses Start sprint a second time, with the same selection
// expect: known positive — the default branch holds the other commit and its head is no longer the one the page was read at; the first press is refused, says the default branch has moved, and nothing is written: no record docs/backlog/sprints/team2/01.md stands, no commit is added by the click and no branch sprint/team2/01 was created; counter-proof — the second press, from a page drawn at the new head, writes one commit of the one file docs/backlog/sprints/team2/01.md, and then creates the branch sprint/team2/01 once
test("TST-1329101: UC-032 6c a Start sprint refused because the default branch has moved writes nothing and creates no branch; the same start from a page drawn at the new head is written", async () => {
  const page = await planning();
  let files;
  try {
    await page.srv.change(MOVED, "Another commit.\n");
    assert.ok(Object.hasOwn(page.srv.files, MOVED), "known positive: the other commit is on the default branch");
    assert.notEqual(page.srv.head, HEAD, "known positive: the head has moved on");
    const writes = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.match(planResult(page), /moved on/, "the refusal says that the default branch has moved");
    assert.ok(!Object.hasOwn(page.srv.files, sprintPath("team2", 1)), "no record of team2 stands");
    assert.equal(page.srv.writes.length, writes, "the click wrote nothing");
    assert.deepEqual(page.created, [], "and no branch was created");
    files = page.srv.files;
  } finally { page.done(); }
  const fresh = await open("backlog", {}, { files, pullRequests: [] });
  try {
    await planOf(fresh, "team2");
    typeValue(fresh, "[data-sprint-goal]", "Mail");
    typeValue(fresh, "[data-sprint-closer]", "bob");
    tickOf(fresh, "ITM-003").checked = true;
    const writes = fresh.srv.writes.length, at = fresh.srv.head;
    await fresh.press(found(fresh.target, "[data-start-sprint]")[0]);
    assert.equal(fresh.srv.writes.length, writes + 1, "counter-proof: one commit");
    assert.deepEqual(Object.keys(fresh.srv.writes.at(-1).files), [sprintPath("team2", 1)]);
    assert.deepEqual(fresh.created.map((made) => [made.ref, made.sha]), [["refs/heads/sprint/team2/01", at]], "the branch is created once, at the head the record was committed on");
  } finally { fresh.done(); }
});

// TST-1329102 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: the product of TST-1329101 whose default branch is at HEAD; team1 and team2 have no sprint; known positive first — the declaration gives a sprint the branch sprint/<team>/<nn>
// input: the Product Owner of team2 presses Start sprint with ITM-003 and the head unmoved; then the Product Owner of team1 presses Start sprint with ITM-001 on the repository team2's start wrote
// expect: known positive — team2's start is written; it makes one commit of docs/backlog/sprints/team2/01.md, whose branch field is sprint/team2/01, and creates the reference refs/heads/sprint/team2/01 at HEAD, the head the commit was written on; team1's start, on the repository as it then stands, makes one commit of docs/backlog/sprints/team1/01.md and creates refs/heads/sprint/team1/01 — each team's sprint has its own branch, numbered within the team
test("TST-1329102: UC-032 6 a Start sprint that is written commits the sprint's record and creates the sprint's own branch from the head the commit was written on, for each team", async () => {
  const first = await open("backlog", {}, { files: await product({ files: { [sprintPath("team1", 2)]: null } }), pullRequests: [] });
  let files;
  try {
    assert.equal(first.srv.head, HEAD, "known positive: the page is read at the head");
    await planOf(first, "team2");
    typeValue(first, "[data-sprint-goal]", "Mail");
    typeValue(first, "[data-sprint-closer]", "bob");
    tickOf(first, "ITM-003").checked = true;
    const writes = first.srv.writes.length;
    await first.press(found(first.target, "[data-start-sprint]")[0]);
    assert.equal(first.srv.writes.length, writes + 1, "one commit");
    assert.deepEqual(Object.keys(first.srv.writes.at(-1).files), [sprintPath("team2", 1)]);
    assert.match(first.srv.files[sprintPath("team2", 1)], /^branch: sprint\/team2\/01$/m, "the record names the branch");
    assert.deepEqual(first.created.map((made) => [made.ref, made.sha]), [["refs/heads/sprint/team2/01", HEAD]], "the branch is created at the head the commit was written on");
    files = first.srv.files;
  } finally { first.done(); }
  const second = await open("backlog", {}, { files, pullRequests: [] });
  try {
    assert.ok(Object.hasOwn(second.srv.files, sprintPath("team2", 1)), "known positive: team1 reads the repository as team2's start left it");
    await planOf(second, "team1");
    typeValue(second, "[data-sprint-goal]", "Store");
    typeValue(second, "[data-sprint-closer]", "alice");
    tickOf(second, "ITM-001").checked = true;
    await second.press(found(second.target, "[data-start-sprint]")[0]);
    assert.deepEqual(Object.keys(second.srv.writes.at(-1).files), [sprintPath("team1", 1)], "team1 numbers its sprints within the team");
    assert.deepEqual(second.created.map((made) => made.ref), ["refs/heads/sprint/team1/01"]);
  } finally { second.done(); }
});
