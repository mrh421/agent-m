// MOD-implementation-pages' route `backlog` keeps what is done (ITM-1252), as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`backlog`, `board` — the
// items, each after the items it builds on, with their derived states, the requirements and use cases no item realises; in a model with sprints, for each team its last sprint that
// has ended, linked to its record, with its final burn-down from `progressIn`; … *Plan sprint* and *Start sprint* for the person's team with `startSprint` — with the parameter `plan`
// naming a team, as `progress` links it, the route opens with that team's planning, and a planning opened or cancelled on the page is drawn from what the route has read, without
// reading it again; … It reads the product's facts with the scope `work`, every pull request among them." — and UC-032 step 1.
// Run: node --test tests/implementation-pages-backlog-history.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: component
//
// The product is the fixture of tests/implementation-pages-sprints.mjs. Where the texts leave a reading open, the test states the one it takes: the planning of a team is the
// panel `data-plan-team="<team>"`; Plan sprint is `data-plan="<team>"` and Cancel `data-cancel-plan`, as before; "sends no request" is no call of the product's
// host. Each test states its input and its expected result before it runs (given / input / expect). Counter-proof, recorded in the commit: the `again()` of today, which reads
// the product anew on Plan sprint and on Cancel, fails the third case.

import test from "node:test";
import assert from "node:assert/strict";
import { render, part, row, TEAM2_LAST } from "./implementation-pages-sprints.mjs";

// A quotation mark in a chart's source, as the page holds it: escaped in a code block, or plain once the chart is drawn.
const Q = '(?:&quot;|")';

// TST-1252301 · level: component · module: MOD-implementation-pages
// guards: UC-032 step 1; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: five items — ITM-001 merged, ITM-002 with an open pull request, ITM-003 merged during team2's sprint 02, ITM-004 and ITM-005 with none; team2's sprint 02, from 2026-10-06 to 2026-10-12, closed with ITM-003 merged on 2026-10-08 at 10:15 UTC
// input: the route backlog's render, with every pull request
// expect: a row for every item with its state — ITM-001 done, ITM-002 in progress, ITM-003 done, ITM-004 and ITM-005 ready —; team2's panel names its last sprint team2/02, linked to its record, with its final burn-down — start, the merge on 10-08 at 10:15, end: 1, 0 and 0 left —; the listing of the pull requests is not bounded
test("#backlog — every item with its state, and each team's last ended sprint with its final burn-down", async () => {
  const page = await render("backlog");
  try {
    const html = page.html();
    const backlog = part(html, 'data-part="backlog"');
    assert.deepEqual([...backlog.matchAll(/<tr data-item="(ITM-\d{3})"/g)].map((m) => m[1]), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]);
    assert.match(row(backlog, "ITM-001"), />done</);
    assert.match(row(backlog, "ITM-002"), />in progress</);
    assert.match(row(backlog, "ITM-003"), />done</);
    assert.match(row(backlog, "ITM-004"), />ready</);
    assert.match(row(backlog, "ITM-005"), />ready</);
    const team2 = part(html, 'data-team="team2"');
    assert.match(team2, new RegExp(`href="[^"]*/blob/main/${TEAM2_LAST.replaceAll("/", "\\/")}"[^>]*><b>team2/02</b>`));
    assert.match(team2, new RegExp(`x-axis \\[${Q}start${Q}, ${Q}10-08 10:15${Q}, ${Q}end${Q}\\]`));
    assert.match(team2, /line \[1, 0, 0\]/);
    assert.deepEqual(page.host.calls.filter((call) => call[0] === "listPullRequests").map((call) => call.slice(1)), [[]], "every pull request, in one listing");
  } finally { page.done(); }
});

// TST-1252302 · level: component · module: MOD-implementation-pages
// guards: UC-032 step 6; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the same product; team1's sprint 03 runs
// input: the route backlog's render with the parameter plan=team1 (as #backlog/plan=team1), and, as the known negative, without it
// expect: with it, the page opens with team1's planning — the panel data-plan-team="team1", which changes the selection of team1/03 —, beside what the other teams' sprints hold; without it, no planning is open
test("#backlog/plan=team1 opens with team1's planning", async () => {
  const plain = await render("backlog");
  try { assert.equal(plain.target.querySelector("[data-plan-team]"), null, "without plan= no planning is open"); } finally { plain.done(); }
  const page = await render("backlog", { plan: "team1" });
  try {
    const planning = part(page.html(), 'data-plan-team="team1"');
    assert.match(planning, /Change the selection of team1\/03/);
    assert.ok(page.target.querySelector('[data-part="held"]'), "what the other teams' sprints hold stands beside it");
  } finally { page.done(); }
});

// TST-1252303 · level: component · module: MOD-implementation-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE CLICK PER DECISION
// given: the backlog drawn
// input: a click on Plan sprint for team2, then a click on Cancel
// expect: the first opens team2's planning, the second closes it; neither sends a request — no call of the product's host
test("#backlog — Plan sprint and Cancel draw from what was read, and send no request", async () => {
  const page = await render("backlog");
  try {
    const before = page.host.calls.length;
    assert.ok(before > 0, "known positive: the render read the product");
    await page.press(page.target.querySelector('[data-plan="team2"]'));
    assert.ok(page.target.querySelector('[data-plan-team="team2"]'), "Plan sprint opens team2's planning");
    await page.press(page.target.querySelector("[data-cancel-plan]"));
    assert.equal(page.target.querySelector("[data-plan-team]"), null, "Cancel closes it");
    assert.deepEqual(page.host.calls.slice(before), [], "no request");
  } finally { page.done(); }
});
