// Release test of ITM-1337 — the burn-down of a running sprint has a point for each day. Written from PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE (remaining items per time box) and UC-035's table ("a burn-down of remaining items per day of the sprint").
// Run: node --test tests/release-itm-1337-burn-down-per-day.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// Level: release
//
// Written for the release testing of sprint team1/139 by a participant who implemented none of it (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is reached as the dashboard does: the route `progress` of MOD-implementation-pages drawn into a DOM over a product held in memory (tests/implementation-pages-sprints.mjs). The clock is fixed at 2026-10-23 12:00 UTC; team1's sprint 03 started on 2026-10-20 and here holds ITM-001 (merged 2026-10-21 10:00 UTC), ITM-002 and ITM-004, so that it stays running while ITM-002 is merged.

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { PULL_REQUESTS, TEAM1_RUNNING, found, productFiles, render, sprint } from "./implementation-pages-sprints.mjs";

const NOW = Date.UTC(2026, 9, 23, 12);
const THREE = productFiles({ [TEAM1_RUNNING]: sprint({ n: 3, start: "2026-10-20", goal: "Store and show", selection: ["ITM-001", "ITM-002", "ITM-004"] }) });
const chartOf = async (pullRequests = PULL_REQUESTS) => {
  const page = await render("progress", {}, { files: THREE, pullRequests });
  try {
    const source = (found(page.target, "[data-burn-down]")[0]?.innerHTML ?? "").replace(/&gt;/g, ">");
    const list = (pattern) => (pattern.exec(source)?.[1] ?? "").split(",").map((each) => each.trim().replace(/^"|"$/g, ""));
    return { source, days: list(/x-axis \[([^\]]*)\]/), left: list(/line \[([^\]]*)\]/).map(Number) };
  } finally { page.done(); }
};

// TST-1337101 · level: release · module: MOD-implementation-pages
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// given: team1's running sprint 03, started 2026-10-20, with ITM-001 merged on 2026-10-21, ITM-002 and ITM-004 open; the clock at 2026-10-23 12:00 UTC; then the same with ITM-002 merged on 2026-10-22 15:00 UTC
// input: the reader opens Progress
// expect: the burn-down has one point for each day from 10-20 to 10-23, each the items left at that day's end: 3, 2, 2, 2; with ITM-002 merged on 10-22 it is 3, 2, 1, 1
// Planted fault: remainingPerDay in src/implementation-pages/progress.mjs counting a merge from the next day on (at <= day replaced by at < day) fails the case on "the items left at each day's end".
test("TST-1337101 the burn-down of a running sprint has one point for each day with the items left at that day's end", async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    const open = await chartOf();
    assert.ok(open.days.length > 1, `known positive: the chart is drawn (${open.source.slice(0, 80)})`);
    assert.deepEqual(open.days, ["10-20", "10-21", "10-22", "10-23"], "a point for each day");
    assert.deepEqual(open.left, [3, 2, 2, 2], "the items left at each day's end");
    const merged = await chartOf(PULL_REQUESTS.map((each) => (/ITM-002/.test(each.title) ? { ...each, state: "merged", merged: "2026-10-22T15:00:00Z", closed: "2026-10-22T15:00:00Z", updated: "2026-10-22T15:00:00Z", mergeCommit: "e".repeat(40) } : each)));
    assert.deepEqual(merged.days, ["10-20", "10-21", "10-22", "10-23"]);
    assert.deepEqual(merged.left, [3, 2, 1, 1], "a merge on the 22nd counts at that day's end");
  } finally { mock.timers.reset(); }
});
