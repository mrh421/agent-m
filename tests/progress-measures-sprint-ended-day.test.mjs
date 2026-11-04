// MOD-progress-measures' progressView and backlogView (ITM-1332): a sprint without a time box that ended because every item it selects is done ended on the day the last of those items was merged,
// the day MOD-work-plans' sprintsToClose first names it as ended. Its ProgressView sprint names that day in `ended`; its final burn-down ends on that day, so BacklogView's `lastEnded.end` names it too.
// Run: node --test tests/progress-measures-sprint-ended-day.test.mjs
//
// Module: MOD-progress-measures
// Guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// The product is the small Scrum-with-limit fixture of tests/progress-measures-sprint-ended.test.mjs, one team, held in memory; nothing reaches the network. Today is 2026-10-22. Each test states its
// input and its expected result before it runs (given / input / expect).

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


const burnDownEnd = async (record, pullRequests) => measures.progressIn(await factsOf(record, pullRequests), NOW).sprints[0].burnDown.at(-1)?.day;
// ITM-001 merged on 2026-10-20, ITM-002 on 2026-10-21: the later day is the day the sprint ended.
const TWO_DAYS = [pr(1, "ITM-001", "2026-10-20T10:00:00Z"), pr(2, "ITM-002", "2026-10-21T11:00:00Z")];

// TST-1332001 · level: unit · module: MOD-progress-measures
// guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: team1's sprint 01 has no time box and no `## Ended`; ITM-001 was merged on 2026-10-20 and ITM-002 on 2026-10-21; known positive: the same sprint with `## Ended` of 2026-10-22, today
// input: progressView(facts, 2026-10-22T12:00Z) of each
// expect: the sprint ended by its items is final and names 2026-10-21, the later merge, as `ended`; the known positive names 2026-10-22
test("progressView names the day the last selected item was merged as the day a sprint without a time box ended", async () => {
  const byOwner = await sprintOf(sprint({ tail: ENDED_TODAY }), TWO_DAYS);
  assert.deepEqual([byOwner.final, byOwner.ended], [true, "2026-10-22"], "known positive: a sprint whose `## Ended` is today names today");
  const byItems = await sprintOf(sprint({}), TWO_DAYS);
  assert.deepEqual([byItems.final, byItems.ended], [true, "2026-10-21"]);
});

// TST-1332002 · level: unit · module: MOD-progress-measures
// guards: UC-032; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the sprint of TST-1332001 with ITM-001 merged on 2026-10-20 and ITM-002 on 2026-10-21; known positive: the same sprint with `## Ended` of 2026-10-22; counter-proof: ITM-002 still open
// input: backlogView(facts, 2026-10-22T12:00Z) and progressIn(facts, ...) of each
// expect: lastEnded.end is 2026-10-21 and the final burn-down's last day is 2026-10-21; the known positive names 2026-10-22 in both; with ITM-002 open the sprint runs and has no lastEnded
test("backlogView ends the last ended sprint's burn-down on the day its last selected item was merged", async () => {
  const byOwner = measures.backlogView(await factsOf(sprint({ tail: ENDED_TODAY }), TWO_DAYS), NOW).teams[0];
  assert.deepEqual([byOwner.lastEnded.end, await burnDownEnd(sprint({ tail: ENDED_TODAY }), TWO_DAYS)], ["2026-10-22", "2026-10-22"], "known positive: a sprint ended today names today");
  const open = measures.backlogView(await factsOf(sprint({}), [pr(1, "ITM-001", "2026-10-20T10:00:00Z"), pr(2, "ITM-002", null)]), NOW).teams[0];
  assert.deepEqual([open.running?.name, open.lastEnded], ["team1/01", null], "counter-proof: one item open, the sprint runs");
  const byItems = measures.backlogView(await factsOf(sprint({}), TWO_DAYS), NOW).teams[0];
  assert.deepEqual([byItems.lastEnded.end, await burnDownEnd(sprint({}), TWO_DAYS)], ["2026-10-21", "2026-10-21"]);
});

// TST-1332003 · level: unit · module: MOD-progress-measures
// guards: UC-032; UC-035
// given: the sprint of TST-1332001, ended by its items on 2026-10-21; its views read one day later, 2026-10-23
// input: progressView and backlogView at 2026-10-23T12:00Z
// expect: the day does not move with the day it is read: `ended` and `lastEnded.end` are still 2026-10-21
test("the day a sprint ended by its items does not move with the day its views are read", async () => {
  const later = new Date("2026-10-23T12:00:00Z");
  const facts = await factsOf(sprint({}), TWO_DAYS);
  assert.equal(measures.progressView(facts, later).teams[0].sprint.ended, "2026-10-21");
  assert.equal(measures.backlogView(facts, later).teams[0].lastEnded.end, "2026-10-21");
});
