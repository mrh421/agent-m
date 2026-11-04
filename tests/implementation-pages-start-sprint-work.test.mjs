// MOD-implementation-pages' routes `backlog` and `progress` offer *Start sprint work* (ITM-1408), as UC-034 step 1 states it: "The author opens **Backlog** and selects one or more *ready* items, or presses **Start sprint
// work** to select every ready item of the sprint." The accepted text of docs/architecture/MOD-implementation-pages.md holds the backlog with its sprints and "starting the jobs of steps or items" (`implement`); the route `implement`
// reads the address `#implement/sprint=<team>/<nn>` and lists the items of that sprint's selection, and nothing led to it. Both pages show each team's running sprint, so each offers the control where it shows one.
// Run: node --test tests/implementation-pages-start-sprint-work.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-034; ONE CLICK PER DECISION; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs: team1's sprint 03 runs with ITM-001 and ITM-002; team2 runs no sprint. Nothing reaches the network. Readings the texts leave open, which the tests state
// (the pull request names them):
//   - The module text names no control, so *Start sprint work* is a link, as *Change the selection* on the progress is, named by UC-034's words; it stands in the panel of a team that has a running sprint, beside the control that
//     changes that sprint's selection, and a team without a running sprint has none.
//   - The address is the one the frame writes for a route and a parameter (MOD-site-frame's fragmentOf): the parameter `sprint` holds `<team>/<nn>`, so its slash is percent-encoded, `#implement/sprint=team1%2F03`; the frame
//     splits a fragment at every slash before it decodes, so the address with a bare slash would give the route the sprint `team1` and no number.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { found, render } from "./implementation-pages-sprints.mjs";
import { routeOf } from "../src/site-frame/routing.mjs";

const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// The links and buttons of `root` whose text is exactly `label`.
// (the fixture DOM's selectors know attributes only, so the elements are walked.)
const walk = (node) => [...node.childNodes].filter((child) => child.nodeType === 1).flatMap((child) => [child, ...walk(child)]);
const controls = (root, label) => walk(root).filter((node) => ["a", "button"].includes(node.localName) && plain(node.innerHTML) === label);
// The panel of a team: the element `data-team="<team>"`.
const panelOf = (page, team) => found(page.target, `[data-team="${team}"]`)[0];

// TST-1408001 · level: unit · module: MOD-implementation-pages
// guards: UC-034; ONE CLICK PER DECISION
// given: the fixture; team1's sprint docs/backlog/sprints/team1/03.md runs with ITM-001 and ITM-002; team2 has no running sprint
// input: the route backlog's render
// expect: known positive — team1's panel offers the button Change the selection; team1's panel offers exactly one link named Start sprint work, whose address is #implement/sprint=team1%2F03; team2's panel offers none
test("#backlog — the panel of a team with a running sprint offers Start sprint work, which leads to Implement for that sprint", async () => {
  const page = await render("backlog");
  try {
    const team1 = panelOf(page, "team1");
    assert.equal(controls(team1, "Change the selection").length, 1, "known positive: team1's panel offers Change the selection");
    const start = controls(team1, "Start sprint work");
    assert.equal(start.length, 1, "team1's panel offers one Start sprint work");
    assert.equal(start[0].localName, "a");
    assert.equal(start[0].getAttribute("href"), "#implement/sprint=team1%2F03");
    assert.equal(controls(panelOf(page, "team2"), "Start sprint work").length, 0, "team2 runs no sprint, so its panel offers none");
  } finally { page.done(); }
});

// TST-1408002 · level: unit · module: MOD-implementation-pages
// guards: UC-034; ONE CLICK PER DECISION
// given: the fixture; team1's sprint 03 runs; team2 has no running sprint
// input: the route progress's render
// expect: known positive — team1's panel links Change the selection to #backlog/plan=team1; team1's panel offers exactly one link named Start sprint work, whose address is #implement/sprint=team1%2F03; team2's panel offers none
test("#progress — the panel of a team with a running sprint offers Start sprint work, which leads to Implement for that sprint", async () => {
  const page = await render("progress");
  try {
    const team1 = panelOf(page, "team1");
    const change = controls(team1, "Change the selection");
    assert.equal(change.length, 1, "known positive: team1's panel offers Change the selection");
    assert.equal(change[0].getAttribute("href"), "#backlog/plan=team1");
    const start = controls(team1, "Start sprint work");
    assert.equal(start.length, 1, "team1's panel offers one Start sprint work");
    assert.equal(start[0].localName, "a");
    assert.equal(start[0].getAttribute("href"), "#implement/sprint=team1%2F03");
    assert.equal(controls(panelOf(page, "team2"), "Start sprint work").length, 0, "team2 runs no sprint, so its panel offers none");
  } finally { page.done(); }
});

// TST-1408003 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the address of Start sprint work on the backlog and on the progress for team1's sprint 03; the frame's own reading of a fragment (routeOf)
// input: the frame reads each address as it reads the address bar
// expect: known positive — the address with a bare slash, #implement/sprint=team1/03, is read as the route implement with the sprint team1 and no number; the address of each page is read as the route implement with the sprint team1/03, the name the panel shows for the running sprint and the route matches against its file docs/backlog/sprints/team1/03.md
test("Start sprint work — the frame reads its address as the route implement with the sprint <team>/<nn>", async () => {
  assert.deepEqual(routeOf("#implement/sprint=team1/03"), { name: "implement", params: { sprint: "team1" } }, "known positive: a bare slash cuts the sprint at its team");
  for (const name of ["backlog", "progress"]) {
    const page = await render(name);
    try {
      const href = controls(panelOf(page, "team1"), "Start sprint work")[0]?.getAttribute("href");
      assert.ok(href, `${name}: a link named Start sprint work`);
      assert.deepEqual(routeOf(href), { name: "implement", params: { sprint: "team1/03" } }, name);
      assert.ok(plain(panelOf(page, "team1").innerHTML).includes("team1/03"), `${name}: the sprint the address names is the one the panel shows`);
    } finally { page.done(); }
  }
});
