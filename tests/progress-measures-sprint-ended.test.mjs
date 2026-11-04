// MOD-progress-measures' progressView and backlogView (ITM-1330) draw a sprint that has ended as ended, by the one rule MOD-work-plans' sprintsToClose gives, as the accepted texts state it: UC-032 6b, "The sprint
// ends — at the end of its time box or, in a sprint without one, when every selected item is done or the Product Owner presses **End sprint**, one click, which records the end with the sprint", and
// docs/architecture/MOD-work-plans.md, sprintsToClose: "every sprint whose record holds no `## Review` and that has ended: its `end` date is before or on `today`; or, without a time box, every item of its
// selection is `done`, or its record holds `## Ended`". MOD-progress-measures' `ProgressView` has `final` "a running sprint whose time box is over or that was ended", and `BacklogView` has `lastEnded`
// "the team's last sprint that has ended".
// Run: node --test tests/progress-measures-sprint-ended.test.mjs
//
// Module: MOD-progress-measures
// Guards: UC-032; UC-035; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// Level: unit
//
// The product is a small Scrum-with-limit fixture of one team held in memory behind a host of this file's own; its facts are read with productFacts' scope `work`. Nothing reaches the network. Today is
// 2026-10-22. Where the texts leave a reading open, the test states the one it takes: a time box that ends on today has ended (the rule says "before or on"); `ended` of a sprint is its `end`, else the
// `at` of its `## Ended`. Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as measures from "../src/progress-measures/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const COMMIT = "c".repeat(40);
const NOW = new Date("2026-10-22T12:00:00Z");
const SPRINT = "docs/backlog/sprints/team1/01.md";

const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the product is developed", "",
  "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const assignment = lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a |", "| Checker | dev-a |");
const item = (n, module) => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", "  - RULE ONE", "modules:", `  - ${module}`,
  "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const sprint = ({ end = "", tail = [] }) => lines("---", "sprint: 1", "goal: Store and show", "start: 2026-10-20", `end: ${end}`, "closer: alice", "branch:", "selection:", "  - ITM-001", "  - ITM-002", "---",
  "# Sprint 1", ...tail);
const ENDED_TODAY = ["", "## Ended", "", "at: 2026-10-22"];

const pr = (number, id, merged) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number).repeat(40).slice(0, 40), state: merged ? "merged" : "open",
  draft: false, url: `${ADDRESS}/pull/${number}`, opened: "2026-10-20T09:00:00Z", merged, closed: merged, body: "", mergeCommit: merged ? "f".repeat(40) : null });
const BOTH_MERGED = [pr(1, "ITM-001", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", "2026-10-21T11:00:00Z")];
const ONE_MERGED = [pr(1, "ITM-001", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", null)];

function hostOf(held, pullRequests) {
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(held),
    blob: (path) => (Object.hasOwn(held, path) ? blobOf(held[path]) : null), read: async (path) => (Object.hasOwn(held, path) ? held[path] : null), readMany: async () => {} });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return pullRequests; },
    async containsCommit() { return false; },
  };
}

// The facts of the product whose team1 holds `record` as its sprint 01, with the pull requests given.
async function factsOf(record, pullRequests = []) {
  const model = readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8");
  const product = hostOf({ "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": model, "docs/role-assignments/team1.md": assignment,
    "docs/backlog/ITM-001-item-1.md": item(1, "MOD-store"), "docs/backlog/ITM-002-item-2.md": item(2, "MOD-pages"), [SPRINT]: record }, pullRequests);
  const instance = hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": model }, []);
  const facts = await measures.productFacts(product, await instance.readSnapshot("main"), () => instance.readSnapshot("main"), NOW, { scope: "work" });
  return { ...facts, requirements: ["RULE ONE"] };
}
const sprintOf = async (record, pullRequests) => (measures.progressView(await factsOf(record, pullRequests), NOW).teams[0].sprint);

// TST-1330001 · level: unit · module: MOD-progress-measures
// guards: UC-032; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: team1's sprint 01 has no time box and its record holds `## Ended` of 2026-10-22, today, with no `## Review`; ITM-001 is merged and ITM-002 is not; known positive: the same sprint with a time box that ends 2026-10-23, tomorrow
// input: progressView(facts, 2026-10-22T12:00Z) of each
// expect: the sprint ended today is final, ended on 2026-10-22, and not endable; the sprint whose time box ends tomorrow is not final and not endable — a time box ends on its date
test("progressView takes a sprint the Product Owner ended today as final", async () => {
  const boxed = await sprintOf(sprint({ end: "2026-10-23" }), ONE_MERGED);
  assert.deepEqual([boxed.name, boxed.final, boxed.endable], ["team1/01", false, false], "known positive: a sprint whose time box ends tomorrow runs");
  const ended = await sprintOf(sprint({ tail: ENDED_TODAY }), ONE_MERGED);
  assert.deepEqual([ended.name, ended.final, ended.ended, ended.endable], ["team1/01", true, "2026-10-22", false]);
});

// TST-1330002 · level: unit · module: MOD-progress-measures
// guards: UC-032; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: team1's sprint 01 has no time box and no `## Ended`; both items it selects are merged by 2026-10-21; counter-proof: the same sprint with ITM-002's pull request still open
// input: progressView(facts, 2026-10-22T12:00Z) of each
// expect: with both items done the sprint is final and not endable, ended on 2026-10-21, the day the last was merged (ITM-1332); with ITM-002 open it is not final and endable
test("progressView takes a sprint without a time box as final when every selected item is done", async () => {
  const open = await sprintOf(sprint({}), ONE_MERGED);
  assert.deepEqual([open.final, open.endable], [false, true], "counter-proof: one item is not done");
  const done = await sprintOf(sprint({}), BOTH_MERGED);
  assert.deepEqual(done.items.map((each) => each.state.state), ["done", "done"], "known positive: both items are done");
  assert.deepEqual([done.final, done.ended, done.endable], [true, "2026-10-21", false]); // ITM-1332: the day the last selected item was merged
});

// TST-1330003 · level: unit · module: MOD-progress-measures
// guards: UC-032; UC-035
// given: team1's sprint 01 has a time box whose end is 2026-10-22, today; counter-proof: the same sprint whose end is 2026-10-23
// input: progressView(facts, 2026-10-22T12:00Z) of each
// expect: the sprint ending today is final and ended on 2026-10-22; the one ending tomorrow is not final
test("progressView takes a sprint whose time box ends today as final", async () => {
  const tomorrow = await sprintOf(sprint({ end: "2026-10-23" }), ONE_MERGED);
  assert.deepEqual([tomorrow.final, tomorrow.ended], [false, "2026-10-23"], "counter-proof: a time box that ends tomorrow runs");
  const today = await sprintOf(sprint({ end: "2026-10-22" }), ONE_MERGED);
  assert.deepEqual([today.final, today.ended], [true, "2026-10-22"]);
});

// TST-1330004 · level: unit · module: MOD-progress-measures
// guards: UC-032; UC-035
// given: team1's sprint 01 with ITM-001 and ITM-002: (a) no time box and `## Ended` of 2026-10-22, today; (b) no time box and both items merged on 2026-10-21; known positive: (c) a time box ending 2026-10-23, tomorrow
// input: backlogView(facts, 2026-10-22T12:00Z) of each
// expect: in (a) and (b) team1 has no running sprint and its lastEnded is team1/01 from 2026-10-20 with ITM-001 and ITM-002 and, in (b), their two merges; in (c) team1 runs team1/01 with the selection ITM-001, ITM-002 and has no lastEnded
test("backlogView shows a sprint that has ended today as the team's last ended sprint, not as running", async () => {
  const running = measures.backlogView(await factsOf(sprint({ end: "2026-10-23" }), ONE_MERGED), NOW).teams[0];
  assert.deepEqual([running.running?.name, running.running?.selection, running.lastEnded], ["team1/01", ["ITM-001", "ITM-002"], null], "known positive: a sprint whose time box ends tomorrow runs");
  const byOwner = measures.backlogView(await factsOf(sprint({ tail: ENDED_TODAY }), ONE_MERGED), NOW).teams[0];
  assert.equal(byOwner.running, null);
  assert.deepEqual([byOwner.lastEnded.name, byOwner.lastEnded.start, byOwner.lastEnded.items], ["team1/01", "2026-10-20", ["ITM-001", "ITM-002"]]);
  const byItems = measures.backlogView(await factsOf(sprint({}), BOTH_MERGED), NOW).teams[0];
  assert.equal(byItems.running, null);
  assert.deepEqual([byItems.lastEnded.name, byItems.lastEnded.items, byItems.lastEnded.merges.map((each) => each.item)], ["team1/01", ["ITM-001", "ITM-002"], ["ITM-001", "ITM-002"]]);
});
