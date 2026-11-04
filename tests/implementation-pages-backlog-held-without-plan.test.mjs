// MOD-implementation-pages' route `backlog` lists what the teams' sprints hold without a plan open (ITM-1326), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states it: "`backlog`, `board` — … in a product with several teams, what the other teams' sprints hold, from
// `heldItems`" — and UC-032 step 5: "Agent M lists beside the backlog every item that another team's sprint holds … each with its sprint, its team, the modules it
// changes and the modules whose interfaces they use … With one team, there is nothing to list."
// Run: node --test tests/implementation-pages-backlog-held-without-plan.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, with two module files added: MOD-pages, which uses MOD-store. Readings the texts leave open, which
// the test takes: a held item's sprint `<team>/<nn>` names its team, so the list has no column of its own for the team; without a plan open, no team is the planning one, so
// the list holds what every team's sprint holds. Counter-proof: on the base, where paint draws the list only under `planning && teams.length > 1`, the first case fails.

import test from "node:test";
import assert from "node:assert/strict";
import { render, part, productFiles } from "./implementation-pages-sprints.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const moduleFile = (id, uses) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001",
  `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`, "provides:", "  - read", "---", `# ${id} The module ${id}`);
const files = () => productFiles({ "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]) });
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
// The rows of the list of held items: each item with its cells, as the page reads them.
const heldRows = (html) => Object.fromEntries([...html.matchAll(/<tr data-held="(ITM-\d{3})">([\s\S]*?)<\/tr>/g)].map(([, id, tr]) => [id, [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => plain(m[1]))]));

// TST-1326001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: two teams; team1's running sprint team1/03 holds ITM-002, whose pull request is open, which changes MOD-pages, which uses MOD-store; ITM-001 of the same sprint is merged into main; team2 runs no sprint
// input: the route backlog's render, with no plan open
// expect: beside the backlog, the list of what the teams' sprints hold names exactly ITM-002 with its title, its sprint team1/03, the module it changes MOD-pages and the module those use MOD-store; the list stands before the backlog's table
test("TST-1326001: without a plan open, the backlog lists every item a team's sprint holds, with its sprint and the modules it changes and uses", async () => {
  const page = await render("backlog", {}, { files: files() });
  try {
    const html = page.html();
    assert.equal(page.target.querySelector("[data-plan-team]"), null, "no plan is open");
    assert.deepEqual(heldRows(part(html, 'data-part="held"')), { "ITM-002": ["ITM-002", "The work of item 2", "team1/03", "MOD-pages", "MOD-store"] });
    assert.ok(html.indexOf('data-part="held"') < html.indexOf('data-part="backlog"'), "the list stands beside the backlog, before its table");
  } finally { page.done(); }
});

// TST-1326002 · level: unit · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the same product with one team only — team2's role assignment and sprints removed —, team1's sprint team1/03 holding ITM-002
// input: the route backlog's render, with no plan open
// expect: the page has no list of held items: with one team there is nothing to list (the known positive of TST-1326001)
test("TST-1326002: with one team, the backlog lists nothing a sprint holds", async () => {
  const alone = files();
  for (const path of Object.keys(alone)) if (/(^|\/)team2(\/|\.md$)/.test(path)) delete alone[path];
  assert.ok(!Object.keys(alone).some((path) => path.includes("team2")) && Object.hasOwn(alone, "docs/role-assignments/team1.md"), "known positive: only team1 is left");
  const page = await render("backlog", {}, { files: alone });
  try {
    assert.ok(page.target.querySelector('[data-team="team1"]'), "team1's panel is drawn");
    assert.equal(page.target.querySelector('[data-part="held"]'), null, "nothing is listed");
  } finally { page.done(); }
});

// TST-1326003 · level: unit · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the product of TST-1326001
// input: Plan sprint for team2, then Cancel and Plan sprint for team1
// expect: beside team2's plan the list names ITM-002 held by team1/03, as without a plan; beside team1's plan it lists no item of team1's own sprint and says that no other team's sprint holds an item
test("TST-1326003: with a plan open, the list holds what the other teams' sprints hold", async () => {
  const page = await render("backlog", {}, { files: files() });
  try {
    await page.press(page.target.querySelector('[data-plan="team2"]'));
    assert.ok(page.target.querySelector('[data-plan-team="team2"]'), "team2's plan is open");
    assert.deepEqual(heldRows(part(page.html(), 'data-part="held"')), { "ITM-002": ["ITM-002", "The work of item 2", "team1/03", "MOD-pages", "MOD-store"] });
    await page.press(page.target.querySelector("[data-cancel-plan]"));
    await page.press(page.target.querySelector('[data-plan="team1"]'));
    const held = part(page.html(), 'data-part="held"');
    assert.deepEqual(heldRows(held), {});
    assert.match(plain(held), /No other team's sprint holds an item\./);
  } finally { page.done(); }
});
