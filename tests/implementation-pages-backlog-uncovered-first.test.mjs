// MOD-implementation-pages' route `backlog` draws what no item realises at its top (ITM-1325), as UC-032 step 1 states it: "The top of the page shows accepted
// requirements and use cases that no item realises yet." The accepted text of docs/architecture/MOD-implementation-pages.md fixes no order of the route's parts.
// Run: node --test tests/implementation-pages-backlog-uncovered-first.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs. A reading the texts leave open, which the test takes: the part `teams` is each team's panel
// (`data-team`) where role assignments name teams, and the panel `data-part="teams"` where none does. Counter-proof: on the base, where paint draws the part of what
// no item realises after the backlog, the case fails.

import test from "node:test";
import assert from "node:assert/strict";
import { render, productFiles } from "./implementation-pages-sprints.mjs";

const withoutTeams = () => {
  const files = productFiles();
  for (const path of Object.keys(files)) if (path.startsWith("docs/role-assignments/") || path.startsWith("docs/backlog/sprints/")) delete files[path];
  return files;
};
const at = (html, marker) => { const found = html.indexOf(marker); assert.ok(found >= 0, `${marker} stands on the page`); return found; };

// TST-1325001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the fixture's product, once with the role assignments and sprints of team1 and team2 and once with no role assignment and no sprint
// input: the route backlog's render; the positions of the parts uncovered, teams and backlog in its HTML are read
// expect: with teams, data-part="uncovered" stands before data-team="team1", data-team="team2" and data-part="backlog"; without, before data-part="teams" and data-part="backlog"; known positive: on the base it stands after them
test("TST-1325001: #backlog draws the part of what no item realises before the teams and the backlog", async () => {
  for (const [files, teams] of [[productFiles(), ['data-team="team1"', 'data-team="team2"']], [withoutTeams(), ['data-part="teams"']]]) {
    const page = await render("backlog", {}, { files });
    try {
      const html = page.html();
      const uncovered = at(html, 'data-part="uncovered"');
      for (const marker of [...teams, 'data-part="backlog"']) assert.ok(uncovered < at(html, marker), `the part uncovered stands before ${marker}`);
    } finally { page.done(); }
  }
});
