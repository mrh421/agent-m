// Release tests of ITM-1326, the backlog lists what the other teams' sprints hold without a plan open — what the Product Owner reads on the Backlog page: UC-032 step 5 says that, in a product with several teams, "Agent M
// lists beside the backlog every item that another team's sprint holds … each with its sprint, its team, the modules it changes and the modules whose interfaces they use", and "with one team, there is nothing to list"
// (SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD). The cases open the route `backlog` over the real MOD-repository-hosts host behind a fake of GitHub's API (tests/uc-032-harness.mjs) and read the page; they
// never read a code file.
// Run: node --test tests/release-itm-1326-held-list-beside-the-backlog.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// Level: release
//
// Written for the release testing of sprint 130 by developer-sonnet-l, who implemented none of ITM-1326 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "its sprint, its team" is read as the sprint's name `<team>/<nn>`, whose first part is the team: a row has the cells item, title, sprint, the modules it changes and the modules those use.
//   - "beside the backlog" is read as: the list is a part of the page that stands before the backlog's table, whether or not Plan sprint is open.
//   - "with one team" is read as a product with one role assignment.

import test from "node:test";
import assert from "node:assert/strict";
import { backlogOf, found, itemsOf, open, part, planOf, plain, product, sprintPath, sprintText } from "./uc-032-harness.mjs";

const heldRows = (html) => Object.fromEntries([...html.matchAll(/<tr data-held="(ITM-\d{3})">([\s\S]*?)<\/tr>/g)].map(([, id, tr]) => [id, [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => plain(m[1]))]));
const heldOf = (page) => heldRows(part(page.html(), 'data-part="held"'));
const TEAM1 = ["ITM-002", "The work of item 2", "team1/02", "MOD-pages", "MOD-store"];
const TEAM2 = ["ITM-003", "The work of item 3", "team2/01", "MOD-mail", "—"];
const team2Sprint = sprintText({ n: 1, goal: "Mail", start: "2026-10-22", closer: "bob", selection: ["ITM-003"], branch: "sprint/team2/01" });

// TST-1326101 · level: release · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the product of tests/uc-032-harness.mjs with two teams, whose team1 sprint team1/02 holds ITM-002 (changing MOD-pages, which uses MOD-store; its pull request is open) and whose team2 sprint team2/01 holds ITM-003 (changing MOD-mail); known positive first — the backlog's column Held or kept names team1/02 for ITM-002
// input: the Product Owner opens Backlog and does not press Plan sprint
// expect: known positive — ITM-002's row says it is held by team1/02; the page holds a part of what the teams' sprints hold, before the backlog's table, whose heading does not say "other"; it lists exactly ITM-002 and ITM-003, ITM-002 with its title, its sprint team1/02, the module it changes MOD-pages and the module those use MOD-store, and ITM-003 with its title, its sprint team2/01, MOD-mail and no used module; nothing is written
test("TST-1326101: UC-032 5 in a product with two teams the backlog lists, with no plan open, every item a team's sprint holds, with its sprint, the modules it changes and the modules those use, before the backlog's table", async () => {
  const page = await open("backlog", {}, { files: await product({ files: { [sprintPath("team2", 1)]: team2Sprint } }) });
  try {
    assert.match(plain(backlogOf(page)), /ITM-002 .*held by team1\/02/, "known positive: the backlog's own column names the holder");
    assert.equal(found(page.target, "[data-plan-team]").length, 0, "no plan is open");
    const html = page.html();
    assert.ok(html.includes('data-part="held"'), "the list is on the page");
    assert.ok(html.indexOf('data-part="held"') < html.indexOf('data-part="backlog"'), "and stands before the backlog's table");
    assert.doesNotMatch(plain(part(html, 'data-part="held"')), /What the other teams/, "no team is chosen, so no team is another");
    assert.deepEqual(heldOf(page), { "ITM-002": TEAM1, "ITM-003": TEAM2 });
    assert.equal(page.srv.writes.length, 0, "reading the page writes nothing");
  } finally { page.done(); }
});

// TST-1326102 · level: release · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the product of TST-1326101 with one team — team2's role assignment is left out, so that only team1 runs sprints — and its sprint team1/02 holding ITM-002; known positive first — the same product with team2's role assignment lists ITM-002
// input: the Product Owner opens Backlog of each product
// expect: known positive — with two teams the page lists ITM-002 as held by team1/02; with one team the page has no part of what the teams' sprints hold and lists no held item, while the backlog still lists its items and ITM-002's row still says it is held by team1/02
test("TST-1326102: UC-032 5 in a product with one team there is nothing to list beside the backlog", async () => {
  const two = await open("backlog", {}, { files: await product() });
  try { assert.deepEqual(heldOf(two), { "ITM-002": TEAM1 }, "known positive: with two teams the held item is listed"); } finally { two.done(); }
  const one = await open("backlog", {}, { files: await product({ files: { "docs/role-assignments/team2.md": null } }) });
  try {
    assert.ok(!one.html().includes('data-part="held"'), "with one team no list is drawn");
    assert.deepEqual(heldOf(one), {}, "and no held item is listed");
    assert.ok(itemsOf(one).includes("ITM-002"), "the backlog still lists its items");
    assert.match(plain(backlogOf(one)), /ITM-002 .*held by team1\/02/);
  } finally { one.done(); }
});

// TST-1326103 · level: release · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the product of TST-1326101 with two teams, team1 holding ITM-002 and team2 holding ITM-003; known positive first — with no plan open both items are listed
// input: the Product Owner opens Backlog, presses Plan sprint for team2, then Plan sprint for team1, and then cancels the plan
// expect: known positive — with no plan open the list holds ITM-002 and ITM-003 and its heading does not say "other"; with team2's plan open it holds exactly ITM-002, the other team's item, under a heading that says "other teams'"; with team1's plan open it holds exactly ITM-003; with the plan cancelled the list holds both again
test("TST-1326103: UC-032 5 with a team's plan open the list is what the other teams' sprints hold; with the plan closed it is what every team's sprint holds", async () => {
  const page = await open("backlog", {}, { files: await product({ files: { [sprintPath("team2", 1)]: team2Sprint } }) });
  try {
    assert.deepEqual(Object.keys(heldOf(page)), ["ITM-002", "ITM-003"], "known positive: with no plan open both items are listed");
    assert.doesNotMatch(plain(part(page.html(), 'data-part="held"')), /What the other teams/);
    await planOf(page, "team2");
    assert.deepEqual(heldOf(page), { "ITM-002": TEAM1 }, "team2's plan: what team1's sprint holds");
    assert.match(plain(part(page.html(), 'data-part="held"')), /What the other teams' sprints hold/);
    await planOf(page, "team1");
    assert.deepEqual(heldOf(page), { "ITM-003": TEAM2 }, "team1's plan: what team2's sprint holds");
    await page.press(found(page.target, "[data-cancel-plan]")[0]);
    assert.deepEqual(Object.keys(heldOf(page)), ["ITM-002", "ITM-003"], "the plan cancelled: every team's holds");
  } finally { page.done(); }
});
