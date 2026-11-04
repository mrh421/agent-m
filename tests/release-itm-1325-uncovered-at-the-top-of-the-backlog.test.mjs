// Release test of ITM-1325, the backlog page shows what no item realises at its top — what the Product Owner reads on Backlog: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN says a requirement or a use case that is
// realised by nothing "is shown in the dashboard; neither blocks a run", and UC-032 step 1 says "The top of the page shows accepted requirements and use cases that no item realises yet". The case opens the route
// `backlog` over the real MOD-repository-hosts host behind a fake of GitHub's API (tests/uc-032-harness.mjs), reads the page's parts in the order they stand, and plans and starts a sprint on the same product; it never reads a code file.
// Run: node --test tests/release-itm-1325-uncovered-at-the-top-of-the-backlog.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// Level: release
//
// Written for the release testing of sprint 131 by developer-sonnet-l, who implemented none of ITM-1325 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event; no input event of the operating system is made. Readings the texts leave open, which the case states:
//   - "at the top" is read as: the part of what no item realises stands under the page's head and before every team's panel and before the table of the backlog, in the page's own order of parts.
//   - "neither blocks a run" is read as: with a requirement and a use case that no item realises, a team can still plan a sprint and start it, and its record is committed.
//   - "shown" is read as: the part names the requirement and the use case, and names none that an item realises.

import test from "node:test";
import assert from "node:assert/strict";
import { HEAD, found, open, part, planOf, plain, product, sprintPath, tickOf, typeValue } from "./uc-032-harness.mjs";

// TST-1325101 · level: release · module: MOD-implementation-pages
// guards: UC-032; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the product of tests/uc-032-harness.mjs whose accepted RULE TWO and accepted UC-001 are realised by no item, and whose RULE ONE, RULE THREE and RULE FOUR are realised; two teams, neither with a running sprint; known positive first — the part of what no item realises names RULE TWO and UC-001
// input: the Product Owner of team2 opens Backlog and reads its parts in the order they stand; then plans a sprint with ITM-003, types the goal "Mail" and the closer bob, and presses Start sprint
// expect: known positive — the part of what no item realises names RULE TWO and UC-001 and none of RULE ONE, RULE THREE, RULE FOUR, and the head's explanation names it first; the part stands before the panel of team1, before the panel of team2 and before the table of the backlog, and after the head; neither blocks a run: team2 is offered Plan sprint, and its Start sprint commits docs/backlog/sprints/team2/01.md
test("TST-1325101: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN — Backlog shows the requirement and the use case no item realises at the top, before the teams and the backlog, and the team can still start its sprint", async () => {
  const page = await open("backlog", {}, { files: await product({ files: { [sprintPath("team1", 2)]: null } }), pullRequests: [] });
  try {
    const html = page.html();
    const uncovered = plain(part(html, 'data-part="uncovered"'));
    assert.match(uncovered, /RULE TWO/, "known positive: the requirement no item realises is shown");
    assert.match(uncovered, /UC-001/, "known positive: the use case no item realises is shown");
    for (const realised of ["RULE ONE", "RULE THREE", "RULE FOUR"]) assert.doesNotMatch(uncovered, new RegExp(realised), `${realised} is realised, so it is not shown there`);
    const at = (needle) => html.indexOf(needle);
    const head = at('class="head"'), top = at('data-part="uncovered"'), team1 = at('data-team="team1"'), team2 = at('data-team="team2"'), backlog = at('data-part="backlog"');
    assert.ok(head >= 0 && top > head, "the part stands under the page's head");
    assert.ok(team1 > top && team2 > top, "and before the panel of every team");
    assert.ok(backlog > top, "and before the table of the backlog");
    const explanation = plain(html.slice(head, top));
    assert.ok(explanation.indexOf("realised by no item") >= 0 && explanation.indexOf("realised by no item") < explanation.indexOf("each team"), `the head's What is this? names that part before the teams: ${explanation}`);
    assert.equal(found(page.target, '[data-plan="team2"]').length, 1, "neither blocks a run: team2 is offered Plan sprint");
    await planOf(page, "team2");
    typeValue(page, "[data-sprint-goal]", "Mail");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, "ITM-003").checked = true;
    assert.equal(page.srv.head, HEAD, "known positive: the page is read at the head");
    const writes = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.equal(page.srv.writes.length, writes + 1, "and its Start sprint is one commit");
    assert.ok(Object.hasOwn(page.srv.files, sprintPath("team2", 1)), "of team2's sprint record");
  } finally { page.done(); }
});
