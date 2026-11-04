// Release tests of ITM-1330, a sprint that has ended is drawn as ended — what the Product Owner reads on Progress and on Backlog: UC-032 6b says a sprint ends "at the end of its time box or, in a sprint without one,
// when every selected item is done or the Product Owner presses End sprint, one click, which records the end with the sprint", and step 1 says the Backlog shows for each team "its last sprint that has ended, linked to its
// record, with its final burn-down" (A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT: it is closed after that). The cases open the routes `progress` and `backlog` over the real MOD-repository-hosts host behind a fake of
// GitHub's API (tests/uc-032-harness.mjs) and read what the pages show; they never read a code file.
// Run: node --test tests/release-itm-1330-sprint-ended-is-drawn-as-ended.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// Level: release
//
// Written for the release testing of sprint 130 by developer-sonnet-l, who implemented none of ITM-1330 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own listener called with a
// trusted event; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "a time box ends at its end date": a sprint whose end date is today has ended today, a sprint whose end date is tomorrow runs; this is the rule MOD-work-plans' sprintsToClose gives ("its `end` date is before or on
//     `today`"), which the cases take from UC-032 6b's "at the end of its time box" and state themselves. The pages take today from the clock, so the cases compute today and tomorrow from it as UTC days.
//   - "drawn as ended": Progress says "It ended on <day>; its review and retrospective are not recorded yet", offers neither End sprint nor Change the selection, and Backlog names the sprint as the team's last sprint
//     that has ended and no longer as running.

import test from "node:test";
import assert from "node:assert/strict";
import { MODELS, PULL_REQUESTS, backlogOf, found, open, part, plain, pr, product, sprintPath, sprintText } from "./uc-032-harness.mjs";

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const team1 = (page) => plain(part(page.html(), 'data-team="team1"'));
const RECORD = "https://github.com/akmaier/agent-m/blob/main/docs/backlog/sprints/team1/02.md";
const BOTH_MERGED = [PULL_REQUESTS[0], pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-30T09:00:00Z")];
const record = (over) => sprintText({ n: 2, goal: "Store and show", start: day(-14), closer: "alice", selection: ["ITM-001", "ITM-002"], branch: "sprint/team1/02", ...over });

// What Progress and Backlog say of team1's sprint, by the files and the pull requests.
async function read(files, pulls = PULL_REQUESTS) {
  const progress = await open("progress", {}, { files, pullRequests: pulls });
  const backlog = await open("backlog", {}, { files, pullRequests: pulls });
  try {
    return { progress: team1(progress), endSprint: found(progress.target, "[data-end-sprint]").length, backlog: plain(part(backlog.html(), 'data-team="team1"')), backlogHtml: part(backlog.html(), 'data-team="team1"') };
  } finally { progress.done(); backlog.done(); }
}
const ended = (text, on = /\d{4}-\d{2}-\d{2}/) => new RegExp(`It ended on ${on.source}; its review and retrospective are not recorded yet\\.`).test(text);

// TST-1330101 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of tests/uc-032-harness.mjs, whose model has no time box and whose team1 sprint team1/02 selects ITM-001, merged, and ITM-002, whose pull request is open; known positive first — Progress draws the sprint as running and offers End sprint, and Backlog says a sprint runs
// input: the Product Owner presses End sprint for team1 on Progress, and then opens Progress and Backlog again on the repository the click wrote
// expect: known positive — before the click Progress offers End sprint and does not say the sprint ended, and Backlog says a sprint runs; after it the record holds ## Ended with today's day, and Progress says "It ended on" that day, "its review and retrospective are not recorded yet", offers no End sprint and no Change the selection; Backlog says team1 has no running sprint and names team1/02 as its last sprint, ended on that day, linked to docs/backlog/sprints/team1/02.md
test("TST-1330101: UC-032 6b a sprint the Product Owner ended is drawn as ended on Progress and as the team's last sprint on Backlog, the day the End sprint click was made", async () => {
  const files = await product();
  const before = await read(files);
  assert.equal(before.endSprint, 1, "known positive: End sprint is offered while the sprint runs");
  assert.equal(ended(before.progress), false, "known positive: and the sprint is not said to have ended");
  assert.match(before.backlog, /a sprint runs/, "known positive: Backlog says a sprint runs");
  const page = await open("progress", {}, { files });
  let written;
  try {
    await page.press(found(page.target, "[data-end-sprint]")[0]);
    written = page.srv.files;
  } finally { page.done(); }
  assert.match(written[sprintPath("team1", 2)], new RegExp(`\\n## Ended\\n\\nat: ${day(0)}\\n`), "the record holds the end, today's day");
  const after = await read(written);
  assert.ok(ended(after.progress, new RegExp(day(0))), `Progress says the sprint ended on ${day(0)}: ${after.progress}`);
  assert.equal(after.endSprint, 0, "no End sprint");
  assert.doesNotMatch(after.progress, /Change the selection/);
  assert.match(after.backlog, /no running sprint/, "Backlog: no running sprint");
  assert.match(after.backlog, new RegExp(`Its last sprint, .*team1/02.*ended on ${day(0)}`), "Backlog: the team's last sprint that has ended");
  assert.ok(after.backlogHtml.includes(`href="${RECORD}"`), "and it is linked to its record");
});

// TST-1330102 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of tests/uc-032-harness.mjs, whose model has no time box and whose team1 sprint team1/02 selects ITM-001 and ITM-002; counter-proof first — ITM-001 is merged and ITM-002's pull request is open
// input: the Product Owner opens Progress and Backlog with ITM-002's pull request open, and again with both pull requests merged
// expect: counter-proof — with one item open the sprint runs: Progress offers End sprint and does not say it ended, and Backlog says a sprint runs; with both items done Progress says "It ended on" and "its review and retrospective are not recorded yet", offers no End sprint, and Backlog says team1 has no running sprint and names team1/02 as its last sprint, linked to its record, with a burn-down that ends at no item left
test("TST-1330102: UC-032 6b a sprint without a time box is drawn as ended once every selected item is done, though no one pressed End sprint", async () => {
  const files = await product();
  const open_ = await read(files, PULL_REQUESTS);
  assert.equal(open_.endSprint, 1, "counter-proof: with ITM-002 open End sprint is offered");
  assert.equal(ended(open_.progress), false, "counter-proof: the sprint has not ended");
  assert.match(open_.backlog, /a sprint runs/, "counter-proof: Backlog says it runs");
  const done = await read(files, BOTH_MERGED);
  assert.match(done.progress, /It ended on [^;]*; its review and retrospective are not recorded yet\./, `Progress says the sprint ended: ${done.progress}`);
  assert.equal(done.endSprint, 0, "no End sprint is offered");
  assert.doesNotMatch(done.progress, /Change the selection/);
  assert.match(done.backlog, /no running sprint/);
  assert.match(done.backlog, /Its last sprint, .*team1\/02.*ended on \d{4}-\d{2}-\d{2}/s);
  assert.ok(done.backlogHtml.includes(`href="${RECORD}"`), "linked to its record");
  assert.match(done.backlog, /line \[[\d, ]*, 0\]/, "the final burn-down ends at no item left");
});

// TST-1330103 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of tests/uc-032-harness.mjs whose model has a time box of two weeks; team1's sprint team1/02 selects ITM-001, merged, and ITM-002, whose pull request is open, and starts 14 days ago; known positive first — the same sprint with its end date tomorrow
// input: the Product Owner opens Progress and Backlog with the end date tomorrow, and again with the end date today
// expect: known positive — with the end tomorrow the sprint runs: Progress does not say it ended and Backlog says a sprint runs; with the end today, the last day of the time box, Progress says "It ended on" today's day and "its review and retrospective are not recorded yet", and Backlog says team1 has no running sprint and names team1/02 as its last sprint; with the end yesterday the same
test("TST-1330103: UC-032 6b a sprint whose time box ends today is drawn as ended; one whose time box ends tomorrow still runs", async () => {
  const withEnd = (end) => product({ model: MODELS.timeBox, files: { [sprintPath("team1", 2)]: record({ end }) } });
  const tomorrow = await read(await withEnd(day(1)));
  assert.equal(ended(tomorrow.progress), false, "known positive: a time box that ends tomorrow runs");
  assert.match(tomorrow.backlog, /a sprint runs/, "known positive: Backlog says it runs");
  for (const end of [day(0), day(-1)]) {
    const over = await read(await withEnd(end));
    assert.ok(ended(over.progress, new RegExp(end)), `the end ${end}: Progress says the sprint ended: ${over.progress}`);
    assert.match(over.backlog, /no running sprint/, `the end ${end}: Backlog has no running sprint`);
    assert.match(over.backlog, new RegExp(`Its last sprint, .*team1/02.*ended on ${end}`), `the end ${end}: it is the team's last sprint that has ended`);
  }
});

// TST-1330104 · level: release · module: MOD-implementation-pages
// guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of TST-1330102 with both items of team1/02 merged and no End sprint pressed; known positive first — Backlog names the day the sprint ended
// input: the Product Owner opens Progress and Backlog
// expect: known positive — Backlog says the sprint ended on a day; Progress says "It ended on" the same day, so that its sentence reads "It ended on <day>; its review and retrospective are not recorded yet"
test("TST-1330104: UC-032 6b Progress names the day a sprint without a time box ended when every selected item was done, the day Backlog names", async () => {
  const done = await read(await product(), BOTH_MERGED);
  const backlogDay = /ended on (\d{4}-\d{2}-\d{2})/.exec(done.backlog)?.[1];
  assert.ok(backlogDay, `known positive: Backlog names the day: ${done.backlog}`);
  assert.ok(ended(done.progress, new RegExp(backlogDay)), `Progress names the day ${backlogDay}: ${done.progress}`);
});
