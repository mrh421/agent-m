// The recipe `sprint-facts` of MOD-work-plans' `workStrategies` (ITM-618), as the accepted text of docs/architecture/MOD-work-plans.md states it
// (read from main, blob ee571b6be5a5; the issues by `opened` or `closed` since ITM-1102): "recipe `sprint-facts` — the sprint's facts, the product's issues opened or closed during the sprint, its job
// records and result records — each named as a source; never a mail. The sprint is the one the job's parameter `sprint` names; its facts are
// `sprintFacts` of the product's items, of its tests with what each guards (`isTestFile`, `testDeclarations`), of the items' states (`itemStates`,
// with the product's workflow), of its jobs (`listJobs`, without live states), of the branch `test-results` (the product host's `readSnapshot`),
// and of its pull requests and issues; where the product's host gives no issues, they are left out and named as not read".
// Run: node --test tests/work-plans-sprint-facts-recipe.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; NO COST IS GUESSED
// Level: unit
//
// The readings, named in the pull request: the job's parameter `sprint` is the sprint's name `<team>/<nn>` (sprintOf's); the recipe's parts are the
// sprint's record, its facts as JSON, its issues, its job records and its result records, each line of the last three naming its source; an Issue
// names when it was opened and closed (MOD-repository-hosts, ITM-1102), so an issue is the sprint's when its `opened` or its `closed` is dated within the sprint's time box (the days start to end, both included);
// the result records are those of the head commits of the increment's merged pull requests.
// The product is a fixture held in memory behind a host of this file's own; nothing reaches the network. Each test states its input and its expected
// result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as workPlans from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const DECLARED = "5".repeat(40), H1 = "a1".repeat(20);
const ADDRESS = "https://github.com/acme/product";

const item = (id, extra = []) => lines("---", `id: ${id}`, `title: ${id} item`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", ...extra, "tests:", "  - unit",
  "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const sprint = (number, selection) => lines("---", `sprint: ${number}`, "goal: The fixture sprint", "start: 2026-10-12", "end: 2026-10-19", "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---",
  `# team1 Sprint ${number}`);
const JOB = lines("---", "id: JOB-20261014-0900-a1b2", "kind: implement", "works_on:", "  - ITM-002", "route: ci hosted", "started_by: alice", "start: 2026-10-14 09:00 UTC",
  "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```");
const OTHER_JOB = JOB.replace("JOB-20261014-0900-a1b2", "JOB-20261014-1000-c3d4").replace("ITM-002", "ITM-003");
const DECLARATION = lines("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${DECLARED}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const TEST_FILE = lines("// TST-001 · level: unit · module: MOD-store", "// guards: UC-001", "// given: a store", "// input: a read", "// expect: its text", 'test("a store reads", () => {});');
const RUN_RECORD = lines("---", `commit: ${H1}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-14 10:00 UTC", "---", "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|",
  "| TST-001 | unit | passed |  |");
const RECORD_PATH = `runs/${H1}/20261014-1000-commit-aaaa.md`;

function productFiles() {
  const files = {
    "SPEC.md": "# Fixture\n", "docs/process.md": DECLARATION, "docs/use-cases/UC-001-store.md": "# UC-001 store\n",
    "docs/backlog/ITM-001-a.md": item("ITM-001"), "docs/backlog/ITM-002-b.md": item("ITM-002", ["builds_on:", "  - ITM-001"]), "docs/backlog/ITM-003-c.md": item("ITM-003"),
    "docs/backlog/sprints/team1/01.md": sprint(1, ["ITM-001", "ITM-002"]), "docs/backlog/sprints/team1/02.md": sprint(2, ["ITM-003"]),
    "docs/jobs/JOB-20261014-0900-a1b2.md": JOB, "docs/jobs/JOB-20261014-1000-c3d4.md": OTHER_JOB, "tests/store.test.mjs": TEST_FILE,
  };
  files[`docs/approvals/UC-001-${blobOf(files["docs/use-cases/UC-001-store.md"]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

const snapshotOf = (files, web) => ({ repository: { server: "github", path: "acme/product", web }, ref: "main", commit: "c".repeat(40), paths: Object.keys(files),
  blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
const named = (name) => Object.assign(new Error(name), { name });
const pullRequest = (number, id, state, head) => ({ number, title: `${id}: the work`, branch: `job/${id}`, base: "main", head, state, draft: false, url: `${ADDRESS}/pull/${number}`,
  opened: "2026-10-13T08:00:00Z", merged: state === "merged" ? "2026-10-14T09:30:00Z" : null, closed: null, body: "" });
const issue = (number, opened, closed = null, comments = []) => ({ number, title: `Issue ${number}`, body: "", labels: [], state: closed ? "closed" : "open", url: `${ADDRESS}/issues/${number}`, opened, closed, comments });

// The context of a close-sprint job; the host answers readSnapshot (the product, the branch test-results), listPullRequests and listIssues.
function contextOf({ params = { sprint: "team1/01" }, issues = [issue(7, "2026-10-14T10:00:00Z"), issue(8, "2026-09-01T10:00:00Z")], noIssues = false, files = productFiles() } = {}) {
  const asked = [];
  const product = snapshotOf(files, ADDRESS);
  const results = { paths: [RECORD_PATH], blob: () => null, read: async (path) => (path === RECORD_PATH ? RUN_RECORD : null) };
  const host = {
    async readSnapshot(ref) { asked.push(["readSnapshot", ref]); if (ref === "test-results") return results; return product; },
    async listPullRequests() { return [pullRequest(1, "ITM-001", "merged", H1), pullRequest(2, "ITM-002", "open", "a2".repeat(20))]; },
    async listIssues(filter) { asked.push(["listIssues", filter]); if (noIssues) throw named("NotSupported"); return issues; },
  };
  const instance = snapshotOf({ "SPEC.md": "# Instance\n" }, "https://github.com/acme/agent-m");
  const instanceHost = { async readSnapshot(ref) { asked.push(["instance", ref]); return instance; } };
  return { asked, context: { kind: null, params, product: { address: ADDRESS, snapshot: product, host }, instance: { snapshot: instance, host: instanceHost, checkout: null }, connect: async () => null,
    participants: [], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-19T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null } };
}
const recipe = (setting) => workPlans.workStrategies.recipes["sprint-facts"](setting.context, setting.context.params);
const byName = (parts, name) => parts.find((part) => part.name === name);

// TST-618001 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the fixture Scrum product; the job's parameter sprint is "team1/01", which selects ITM-001 (its pull request merged) and ITM-002 (its pull request open, building on ITM-001); the sprint "team1/02" selects ITM-003
// input: the recipe sprint-facts
// expect: five parts, by name, in this order: the sprint's record "docs/backlog/sprints/team1/01.md" whole; "facts of sprint team1/01"; "issues of sprint team1/01"; "job records of sprint team1/01"; "result records of sprint team1/01". The facts part is JSON: the increment holds ITM-001 with pull request 1, what it realises (UC-001) and its test TST-001; ITM-003 of the other sprint is in none of it; the items not done hold ITM-002 with its state "in progress"
// Planted fault: reading the sprint of the other team's record, or leaving the sprint's record out, changes the names; counting ITM-003 puts it in the facts.
test("the recipe gives the sprint's record, its facts, its issues, its job records and its result records, for the sprint the parameter names", async () => {
  const parts = await recipe(contextOf());
  assert.deepEqual(parts.map((part) => part.name), ["docs/backlog/sprints/team1/01.md", "facts of sprint team1/01", "issues of sprint team1/01", "job records of sprint team1/01", "result records of sprint team1/01"]);
  assert.equal(parts[0].text, productFiles()["docs/backlog/sprints/team1/01.md"]);
  assert.ok(parts.every((part) => part.required === true && Array.isArray(part.sources)));
  const facts = JSON.parse(byName(parts, "facts of sprint team1/01").text);
  assert.deepEqual(facts.increment, [{ item: "ITM-001", pullRequest: "1", realises: ["UC-001"], tests: ["TST-001"] }]);
  assert.deepEqual(facts.notDone.map((each) => [each.item, each.state]), [["ITM-002", "in progress"]]);
  assert.ok(!JSON.stringify(facts).includes("ITM-003"));
});

// TST-618002 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: the fixture product; the parameter sprint is "team1/02", then "team1/09", which has no record, then missing
// input: the recipe
// expect: for team1/02 the facts part names ITM-003 as not done; for team1/09 and for no parameter the recipe fails with UnknownWork naming the sprint's record or the parameter, and reads no other sprint
// Planted fault: falling back to the newest sprint where the parameter is missing gives facts instead of the failure.
test("the sprint is the one the job's parameter names; a sprint without a record, or no parameter, is refused by name", async () => {
  const second = JSON.parse(byName(await recipe(contextOf({ params: { sprint: "team1/02" } })), "facts of sprint team1/02").text);
  assert.deepEqual(second.notDone.map((each) => each.item), ["ITM-003"]);
  await assert.rejects(recipe(contextOf({ params: { sprint: "team1/09" } })), (error) => error.name === "UnknownWork" && /team1\/09/.test(error.message));
  await assert.rejects(recipe(contextOf({ params: {} })), (error) => error.name === "UnknownWork" && /sprint/.test(error.message));
});

// TST-618003 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: the fixture; the host lists issue 7 (opened 2026-10-14, within the sprint's time box 2026-10-12 to 2026-10-19) and issue 8 (opened 2026-09-01, still open)
// input: the recipe
// expect: the issues part names issue 7 by its address and not issue 8; the host was asked for the issues of every state; the job records part names JOB-20261014-0900-a1b2 (it works on ITM-002, selected) with its record path and not JOB-20261014-1000-c3d4 (ITM-003, of the other sprint); the result records part names the record runs/<H1>/20261014-1000-commit-aaaa.md; no part names a mail
// Planted fault: listing every issue, or every job, puts issue 8 or the other job into a part.
test("the issues of the time box, the sprint's job records and its result records are named as sources, and no mail", async () => {
  const setting = contextOf();
  const parts = await recipe(setting);
  const issues = byName(parts, "issues of sprint team1/01").text;
  assert.match(issues, /acme\/product\/issues\/7/);
  assert.doesNotMatch(issues, /issues\/8/);
  assert.deepEqual(setting.asked.find(([name]) => name === "listIssues")[1], { state: "all" });
  const jobs = byName(parts, "job records of sprint team1/01").text;
  assert.match(jobs, /JOB-20261014-0900-a1b2/);
  assert.match(jobs, /docs\/jobs\/JOB-20261014-0900-a1b2\.md/);
  assert.doesNotMatch(jobs, /JOB-20261014-1000-c3d4/);
  assert.match(byName(parts, "result records of sprint team1/01").text, new RegExp(RECORD_PATH.replaceAll(".", "\\.")));
  assert.doesNotMatch(parts.map((part) => part.name).join(" "), /mail/i);
});

// TST-618004 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: the fixture, whose host gives no issues (listIssues fails with NotSupported)
// input: the recipe
// expect: the issues part says they were not read and gives the reason NotSupported; the other four parts stand as in TST-618001
// Planted fault: failing the whole recipe on the host's NotSupported, or leaving the part out without naming it, fails.
test("where the product's host gives no issues, they are left out and named as not read", async () => {
  const parts = await recipe(contextOf({ noIssues: true }));
  assert.equal(parts.length, 5);
  assert.match(byName(parts, "issues of sprint team1/01").text, /not read.*NotSupported/s);
  assert.ok(JSON.parse(byName(parts, "facts of sprint team1/01").text).increment.length === 1);
});

// TST-618005 · level: unit · module: MOD-work-plans
// guards: UC-041; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture, whose declaration names the commit DECLARED as model_version; the instance's host answers readSnapshot(ref) for every ref
// input: the recipe
// expect: the instance's host was asked for the snapshot at DECLARED (the product's workflow is productWorkflow's, read at the version the product declared); the product's host was asked for the branch test-results
// Planted fault: composing the workflow at the instance's current commit asks for no such ref.
test("the item states are derived with the product's workflow, read at the commit the declaration names, and the results from the branch test-results", async () => {
  const setting = contextOf();
  await recipe(setting);
  assert.ok(setting.asked.some(([name, ref]) => name === "instance" && ref === DECLARED), "the instance was read at the declared commit");
  assert.ok(setting.asked.some(([name, ref]) => name === "readSnapshot" && ref === "test-results"), "the branch test-results was read");
});

// TST-1102003 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: the fixture, sprint team1/01 (time box 2026-10-12 to 2026-10-19); the host lists issue 20 (opened 2026-10-13, closed 2026-10-15, no comment), 21 (opened 2026-09-01, still open, no comment), 22 (opened 2026-09-01, closed 2026-10-16), 23 (opened 2026-10-18, still open), 24 (opened 2026-09-01, closed 2026-09-02, with a comment dated 2026-10-14), 25 (opened 2026-10-19T23:00:00Z, the last day), 26 (opened 2026-10-11T23:59:59Z, the day before)
// input: the recipe
// expect: the issues part names 20, 22, 23 and 25 and not 21, 24 or 26; the host was asked with state "all"; the facts part is the same as without the issues Planted fault: reading a comment's date instead of the issue's dates names 24 and misses 20; reading only `opened` misses 22; asking for open issues only misses 20 and 22; a time box end taken as exclusive misses 25.
test("an issue opened or closed within the sprint's time box is among its facts, with or without a comment; one opened before and still open is not", async () => {
  const note = [{ author: "alice", body: "seen", date: "2026-10-14T10:00:00Z" }];
  const issues = [issue(20, "2026-10-13T08:00:00Z", "2026-10-15T09:00:00Z"), issue(21, "2026-09-01T08:00:00Z"), issue(22, "2026-09-01T08:00:00Z", "2026-10-16T09:00:00Z"), issue(23, "2026-10-18T08:00:00Z"),
    issue(24, "2026-09-01T08:00:00Z", "2026-09-02T08:00:00Z", note), issue(25, "2026-10-19T23:00:00Z"), issue(26, "2026-10-11T23:59:59Z")];
  const setting = contextOf({ issues });
  const parts = await recipe(setting);
  const text = byName(parts, "issues of sprint team1/01").text;
  for (const n of [20, 22, 23, 25]) assert.match(text, new RegExp(`issue #${n} `));
  for (const n of [21, 24, 26]) assert.doesNotMatch(text, new RegExp(`issue #${n} `));
  assert.deepEqual(setting.asked.find(([name]) => name === "listIssues")[1], { state: "all" });
  assert.deepEqual(byName(parts, "facts of sprint team1/01").text, byName(await recipe(contextOf({ issues: [] })), "facts of sprint team1/01").text);
});

// TST-1102004 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: the fixture; the host lists issues of which none is opened or closed within the time box
// input: the recipe
// expect: the issues part says that none of the product's issues was opened or closed within the time box
test("where no issue is dated within the time box, the issues part says so", async () => {
  const parts = await recipe(contextOf({ issues: [issue(30, "2026-09-01T08:00:00Z")] }));
  assert.match(byName(parts, "issues of sprint team1/01").text, /none of the product's issues was opened or closed within the time box/);
});

// TST-1405001 · level: unit · module: MOD-work-plans
// guards: UC-041; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture, whose SPEC.md holds the requirement RULE ONE; ITM-002, selected for team1/01, realises RULE ONE instead of UC-001, its pull request 2 is open and its job JOB-20261014-0900-a1b2 ended failed; ITM-003, selected for team1/02, realises RULE NINE, which the SPEC does not hold
// input: the recipe sprint-facts for team1/01, then for team1/02
// expect: the facts of team1/01 name ITM-002 not done with the state "blocked" and a reason that names the failed job, never "not accepted": RULE ONE counts as accepted because the SPEC holds it, as on Progress; known positive: the facts of team1/02 name ITM-003 "waiting for acceptance" with a reason naming RULE NINE
// Planted fault: deriving the states from statuses(snapshot) alone sends ITM-002 as "waiting for acceptance — RULE ONE is not accepted"; counting every name an item realises as accepted sends ITM-003 as "ready".
test("the closer is sent each item's state as Progress derives it: a requirement the SPEC holds is accepted, one it does not hold is not", async () => {
  const files = productFiles();
  files["SPEC.md"] = lines("# Fixture", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The rule RULE ONE.", "*Check:* no automatic check; at review.", "");
  files["docs/backlog/ITM-002-b.md"] = files["docs/backlog/ITM-002-b.md"].replace("  - UC-001\nmodules:", "  - RULE ONE\nmodules:");
  files["docs/backlog/ITM-003-c.md"] = files["docs/backlog/ITM-003-c.md"].replace("  - UC-001\nmodules:", "  - RULE NINE\nmodules:");
  files["docs/jobs/JOB-20261014-0900-a1b2.md"] = `${JOB}\n## End\n\nat: 2026-10-14 11:00 UTC\nstate: failed\n`;
  const first = JSON.parse(byName(await recipe(contextOf({ files })), "facts of sprint team1/01").text);
  const blocked = first.notDone.find((each) => each.item === "ITM-002");
  assert.equal(blocked?.state, "blocked", JSON.stringify(blocked));
  assert.match(blocked.reason ?? "", /fail/);
  assert.doesNotMatch(blocked.reason ?? "", /not accepted/);
  const second = JSON.parse(byName(await recipe(contextOf({ files, params: { sprint: "team1/02" } })), "facts of sprint team1/02").text);
  const waiting = second.notDone.find((each) => each.item === "ITM-003");
  assert.equal(waiting?.state, "waiting for acceptance", `known positive: a requirement the SPEC does not hold is not accepted — ${JSON.stringify(waiting)}`);
  assert.match(waiting.reason ?? "", /RULE NINE/);
});
