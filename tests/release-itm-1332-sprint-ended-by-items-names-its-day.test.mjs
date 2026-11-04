// Release test of ITM-1332, a sprint ended by its items names the day it ended — what the Product Owner reads on Progress and on Backlog: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED says everything the dashboard shows "is
// computed from the repositories and the runtimes"; UC-032 6b says a sprint without a time box ends "when every selected item is done", and UC-035 shows a sprint on Progress. The case opens the routes `progress` and `backlog`
// over the real MOD-repository-hosts host behind a fake of GitHub's API (tests/uc-032-harness.mjs) and reads what the pages show; it never reads a code file.
// Run: node --test tests/release-itm-1332-sprint-ended-by-items-names-its-day.test.mjs
//
// Module: MOD-progress-measures
// Guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: release
//
// Written for the release testing of sprint 131 by developer-sonnet-l, who implemented none of ITM-1332 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the case states:
//   - "the day it ended" of a sprint whose every selected item is done is read as the day the last of them was merged (the later of the merge days, whichever item is listed last), in UTC, as the pages draw days.
//   - "derived, not stored" is read as: the record of the sprint holds no `## Ended` and no end date, each page is opened afresh on the same repository, and both pages name the same day.
//   - "the final burn-down ends on that day" is read as: the last merge the chart marks is that day's, and the chart reaches no item left there.

import test from "node:test";
import assert from "node:assert/strict";
import { PULL_REQUESTS, open, part, plain, pr, product, sprintPath } from "./uc-032-harness.mjs";

const team1 = (page) => plain(part(page.html(), 'data-team="team1"'));
async function read(files, pulls) {
  const progress = await open("progress", {}, { files, pullRequests: pulls });
  const backlog = await open("backlog", {}, { files, pullRequests: pulls });
  try { return { progress: team1(progress), backlog: team1(backlog) }; } finally { progress.done(); backlog.done(); }
}
const OPEN = [PULL_REQUESTS[0], pr(2, "ITM-002", "open", "2026-10-21T12:00:00Z")];
// ITM-001 merged on the 21st, ITM-002 on the 25th; and the same days the other way round.
const LATER_LAST = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-25T09:30:00Z")];
const LATER_FIRST = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-25T09:30:00Z"), pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-21T10:00:00Z")];

// TST-1332101 · level: release · module: MOD-progress-measures
// guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of tests/uc-032-harness.mjs, whose model has no time box and whose team1 sprint team1/02 selects ITM-001 and ITM-002 and holds no ## Ended; known positive first — with ITM-002's pull request open the sprint runs
// input: the Product Owner opens Progress and Backlog with ITM-002 open; then with ITM-001 merged on 2026-10-21 and ITM-002 on 2026-10-25; then with ITM-001 merged on 2026-10-25 and ITM-002 on 2026-10-21; each time on pages drawn afresh from the same repository
// expect: known positive — with ITM-002 open Progress says no "It ended on" and Backlog says a sprint runs; with both merged, in either order, Progress says "It ended on 2026-10-25; its review and retrospective are not recorded yet" and Backlog says team1/02 ended on 2026-10-25, the day of the later merge and no other, and its final burn-down marks the merge "10-25 09:30" last before "end" and reaches 0 items left; the record of the sprint holds no end
test("TST-1332101: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED — a sprint ended by its items is drawn, on Progress and on Backlog, as ended on the day its last item was merged", async () => {
  const files = await product();
  const running = await read(files, OPEN);
  assert.doesNotMatch(running.progress, /It ended on/, "known positive: with an item open the sprint has not ended");
  assert.match(running.backlog, /a sprint runs/, "known positive: Backlog says it runs");
  for (const [order, pulls] of [["the later merge last", LATER_LAST], ["the later merge first", LATER_FIRST]]) {
    const done = await read(files, pulls);
    assert.match(done.progress, /It ended on 2026-10-25; its review and retrospective are not recorded yet\./, `${order}: Progress names the day of the later merge: ${done.progress}`);
    assert.match(done.backlog, /no running sprint/, `${order}: Backlog has no running sprint`);
    assert.match(done.backlog, /Its last sprint, .*team1\/02.*ended on 2026-10-25/s, `${order}: Backlog names the same day: ${done.backlog}`);
    assert.match(done.backlog, /"10-25 09:30", "end"\]/, `${order}: the final burn-down marks that merge last, before its end`);
    assert.match(done.backlog, /line \[[\d, ]*, 0, 0\]/, `${order}: and reaches no item left`);
  }
  assert.equal(files[sprintPath("team1", 2)].includes("## Ended"), false, "the record holds no end: the day is derived from the pull requests");
});
