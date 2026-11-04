// MOD-implementation-pages' route `progress` for a model with sprints (ITM-1252), as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`progress` — …
// In a model with sprints it shows what goes on now (UC-035): each team's running sprint with its goal, start, end, branch and closer, its items with their states and the modules
// they change and use, and its burn-down; *End sprint* with `endSprint` for a running sprint without a time box, and, for one that has ended, that its review and retrospective
// are not recorded yet; a team without a running sprint says so; *Plan sprint* and *Change the selection* lead to `backlog` with `plan=<team>`, and a link leads to `backlog`, where every
// item and each team's last ended sprint stand; what is blocked among the items the running sprints hold; who works on what, each current job linked to its page on the job
// dashboard (UC-036). … It draws no final burn-down." — and UC-035 2b and 2d. These cases render the route over a host that stores no view, so that the route derives the view
// in the page (ITM-1260); what the route reads where a view is stored is tests/implementation-pages-progress-stored-view.test.mjs'.
// Run: node --test tests/implementation-pages-progress.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-035; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY TEAM RUNS SPRINTS OF ITS OWN; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: component
//
// The product is the fixture of tests/implementation-pages-sprints.mjs. Where the texts leave a reading open, the test states the one it takes: a team's panel is the element
// `data-team="<team>"`; End sprint is `data-end-sprint="<team>"`, as on the backlog before; the parts are `data-part="gates"`, `data-part="blocked"` and `data-part="who"`; a job's page
// on the job dashboard is MOD-main-page's route `job`, `#job/id=<id>`. Each test states its input and its expected result before it runs (given / input / expect). Counter-proof,
// recorded in the commit: a route that draws every item of the backlog shows ITM-005, which no sprint selects, and fails the first case.

import test from "node:test";
import assert from "node:assert/strict";
import { render, part, row, TEAM1_RUNNING, JOB } from "./implementation-pages-sprints.mjs";

// TST-1252201 · level: component · module: MOD-implementation-pages
// guards: UC-035; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: team1's sprint 03 runs since 2026-10-20 with ITM-001 (merged on 2026-10-21) and ITM-002 (pull request open); team2 closed its sprint 02; ITM-003, ITM-004 and ITM-005 are in no running sprint
// input: the route progress's render
// expect: team1's panel names team1/03 and its goal, lists ITM-001 done and ITM-002 in progress, each with the module it changes, holds the sprint's burn-down — 2 left at its start, 1 after the merge — and offers End sprint; team2's panel says it runs no sprint, links #backlog/plan=team2 and #backlog, and holds no chart; no row of ITM-003, ITM-004 or ITM-005 stands on the page
test("#progress — each team's running sprint with its items, their states and its burn-down; a team without one says so and links the backlog", async () => {
  const page = await render("progress");
  try {
    const html = page.html();
    const team1 = part(html, 'data-team="team1"');
    assert.match(team1, /team1\/03/);
    assert.match(team1, /Store and show/);
    assert.match(row(team1, "ITM-001"), /done/);
    assert.match(row(team1, "ITM-001"), /MOD-store/);
    assert.match(row(team1, "ITM-002"), /in progress/);
    assert.match(team1, /xychart-beta/);
    assert.match(team1, /line \[2, 1/);
    assert.match(team1, /data-end-sprint="team1"/);
    const team2 = part(html, 'data-team="team2"');
    assert.match(team2, /no running sprint/i);
    assert.match(team2, /href="#backlog\/plan=team2"/);
    assert.match(team2, /href="#backlog"/);
    assert.doesNotMatch(team2, /xychart-beta/, "no chart for a team without a running sprint");
    assert.ok(html.includes('data-item="ITM-001"'), "known positive: an item of the running sprint has its row");
    for (const outside of ["ITM-003", "ITM-004", "ITM-005"]) assert.ok(!html.includes(`data-item="${outside}"`), `${outside}, in no running sprint, is not shown`);
  } finally { page.done(); }
});

// TST-1252202 · level: component · module: MOD-implementation-pages
// guards: UC-035; EVERY STEP EXPLAINS ITSELF
// given: the same product; the job JOB-20261027-0900-a1b2 of dev-a, which has not ended, works on ITM-002
// input: the route progress's render
// expect: the gates, what is blocked and who works on what each stand in a panel of their own with a folded "What is this?"; who works on what names dev-a with its job, linked to the job's page on the job dashboard (#job/id=JOB-20261027-0900-a1b2); team1's panel offers Change the selection, leading to #backlog/plan=team1
test("#progress — the gates, what is blocked, and who works on what with each current job linked to its page", async () => {
  const page = await render("progress");
  try {
    const html = page.html();
    for (const name of ["gates", "blocked", "who"]) assert.match(part(html, `data-part="${name}"`), /<details class="explain"><summary>What is this\?<\/summary>/, name);
    const who = part(html, 'data-part="who"');
    assert.match(who, /dev-a/);
    assert.match(who, new RegExp(`<a href="[^"]*#job/id=${JOB}[^"]*">${JOB}</a>`));
    assert.match(part(html, 'data-team="team1"'), /href="#backlog\/plan=team1"/);
  } finally { page.done(); }
});

// TST-1252204 · level: component · module: MOD-implementation-pages
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: team1's running sprint 03, without a time box
// input: the person's click on End sprint
// expect: one commit holding only docs/backlog/sprints/team1/03.md with ## Ended, on the default branch at the head read; the page is drawn again with no End sprint for team1
test("#progress — End sprint is one click that writes ## Ended", async () => {
  const page = await render("progress");
  try {
    await page.press(page.target.querySelector('[data-end-sprint="team1"]'));
    assert.equal(page.host.commits.length, 1);
    assert.deepEqual(page.host.commits[0].files.map((file) => file.path), [TEAM1_RUNNING]);
    assert.match(page.files[TEAM1_RUNNING], /^## Ended$/m);
    assert.deepEqual([page.host.commits[0].branch, page.host.commits[0].expectedHead], ["main", "c".repeat(40)]);
    assert.equal(page.target.querySelector("[data-end-sprint]"), null);
  } finally { page.done(); }
});

// TST-1252205 · level: component · module: MOD-implementation-pages
// guards: UC-035
// given: the same product with team1's sprint 03 closed too — no team runs a sprint
// input: the route progress's render
// expect: each team's panel says it runs no sprint and links #backlog/plan=<team>; the page holds no chart and no End sprint
test("#progress — without a running sprint, each team says so and links its planning", async () => {
  const { productFiles, sprint } = await import("./implementation-pages-sprints.mjs");
  const files = productFiles({ [TEAM1_RUNNING]: sprint({ n: 3, start: "2026-10-20", end: "2026-10-24", goal: "Store and show", selection: ["ITM-001", "ITM-002"], closed: true }) });
  const page = await render("progress", {}, { files });
  try {
    const html = page.html();
    for (const team of ["team1", "team2"]) {
      assert.match(part(html, `data-team="${team}"`), /no running sprint/i, team);
      assert.match(part(html, `data-team="${team}"`), new RegExp(`href="#backlog/plan=${team}"`), team);
    }
    assert.doesNotMatch(html, /xychart-beta|data-end-sprint/);
  } finally { page.done(); }
});

// TST-1262001 · level: component · module: MOD-implementation-pages
// guards: UC-041; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// given: the same product with team1's sprint 03 ended on 2026-10-24 and not closed
// input: the route progress's render
// expect: team1's panel says that its review and retrospective are not recorded yet, offers no link to a route sprint/<team>/<n>/close and no Close sprint, and holds no chart
test("#progress — an ended sprint says its review and retrospective are not recorded yet, and offers no close page", async () => {
  const { productFiles, sprint } = await import("./implementation-pages-sprints.mjs");
  const files = productFiles({ [TEAM1_RUNNING]: sprint({ n: 3, start: "2026-10-20", end: "2026-10-24", goal: "Store and show", selection: ["ITM-001", "ITM-002"] }) });
  const page = await render("progress", {}, { files });
  try {
    const team1 = part(page.html(), 'data-team="team1"');
    assert.match(team1, /review and retrospective are not recorded yet/, "known positive: the panel is the one of an ended sprint");
    assert.doesNotMatch(team1, /#sprint\/[^"]*\/close|Close sprint/);
    assert.doesNotMatch(team1, /xychart-beta/);
  } finally { page.done(); }
});
