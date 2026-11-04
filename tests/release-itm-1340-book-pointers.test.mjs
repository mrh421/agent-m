// Release test of ITM-1340 — every explanation on the progress page points to book ch. 7 or ch. 15. Written from EVERY STEP EXPLAINS ITSELF (every step that asks something of the person carries an explanation that can be expanded) and UC-035 ("Each chart and panel carries a folded What is this? ... It points to book ch. 7 or ch. 15").
// Run: node --test tests/release-itm-1340-book-pointers.test.mjs
//
// Module: MOD-implementation-pages
// Guards: EVERY STEP EXPLAINS ITSELF; UC-035
// Level: release
//
// Written for the release testing of sprint team1/139 by a participant who implemented none of it (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is reached as the dashboard does: the route `progress` of MOD-implementation-pages drawn into a DOM over a product held in memory (tests/implementation-pages-sprints.mjs). The page's own introduction ("What goes on now: ...") belongs to no chart and no panel and is not read here. The explanations are the elements of class explain: a details element whose summary is "What is this?".

import test from "node:test";
import assert from "node:assert/strict";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const explanations = (root) => found(root, "[class]").filter((each) => each.localName === "details");

// TST-1340101 · level: release · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the Scrum product with two teams, one with a running sprint and one without, whose page draws the panels Gates, Blocked and Who works on what, a burn-down and a team without a sprint
// input: the reader opens Progress
// expect: each of the three panels holds a folded What is this? (not open); and every explanation of a panel or of a team's sprint section (its burn-down and the team without a sprint among them) names book ch. 7 or ch. 15
// Planted fault: the book pointer removed from the explanation of the panel Gates in src/implementation-pages/progress.mjs fails the case on "points to book ch. 7 or ch. 15".
test("TST-1340101 every folded explanation on the progress page points to book ch. 7 or ch. 15", async () => {
  const page = await render("progress", {}, { files: productFiles() });
  try {
    const all = [...new Set([...found(page.target, "[data-part]"), ...found(page.target, "[data-team]")].flatMap(explanations))];
    assert.ok(all.length >= 4, `known positive: the panels and team sections carry explanations (${all.length})`);
    for (const name of ["gates", "blocked", "who"]) {
      const panel = found(page.target, "[data-part]").find((each) => each.getAttribute("data-part") === name);
      const own = explanations(panel);
      assert.ok(own.length >= 1 && /What is this\?/.test(own[0].textContent) && own[0].getAttribute("open") === null, `the panel ${name} holds a folded What is this?`);
    }
    for (const each of all) assert.match(each.textContent.replace(/\s+/g, " "), /ch\. ?(7|15)\b/, `an explanation points to book ch. 7 or ch. 15: "${each.textContent.slice(0, 60)}"`);
  } finally { page.done(); }
});
