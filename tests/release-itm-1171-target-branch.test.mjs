// Release tests of ITM-1171 — the pull request of an implementation job goes into the branch of the sprint that holds the item, else into the branch the declaration gives the item's phase, else into the default branch.
// Written from UC-034 8a ("The sprint has a branch of its own. The item's pull request targets that branch. At the sprint's end, the Product Owner merges it into the default branch") and the SPEC's A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN ("A product may give a phase or a sprint a branch of its own, into which its work is merged") and WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET ("Without a branch for the current phase or sprint, the work of every job is merged into the default branch").
// Run: node --test tests/release-itm-1171-target-branch.test.mjs
//
// Module: MOD-runtimes
// Module: MOD-work-plans
// Guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; UC-034
// Level: release
//
// Written for the release testing of sprint team1/133 by a participant who implemented none of ITM-1171 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The product reaches the behaviour through the job's writer `branch-and-pull-request` of MOD-runtimes' routeStrategies, as tests/runtimes-pull-request-target.test.mjs reaches it: a fake server host that records its calls,
// the job's snapshot holding the backlog item, the sprint records, the plan's order and the declaration. The cases use their own branch names and also the phase branch and the sprints of other items, which the implementer's cases do not.
// Readings the texts leave open, which the cases state:
//   - "the sprint that holds the item" is a sprint record whose selection names the item and which holds no ## Review; a sprint whose record holds ## Review has ended, and its branch is no longer one "for the current sprint".
//   - A phase's branch is the declaration's ## Branches row for the phase the plan's order gives the item's step, taken as written.
//   - The sprint's branch wins over the phase's branch (the narrower time box).

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";

const realFetch = globalThis.fetch;
test.beforeEach(() => { globalThis.fetch = async () => { throw new Error("the writer must reach the server only through the host"); }; });
test.afterEach(() => { globalThis.fetch = realFetch; });

const JOB = "JOB-20261031-1300-beef";
const lines = (...rows) => `${rows.join("\n")}\n`;
const treeOf = (commit, files) => ({ commit, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null, blob: (path) => (path in files ? `blob:${files[path]}` : null) });
const failure = (name) => Object.assign(new Error(name), { name });

const ITEM = lines("---", "id: ITM-5", "title: The fixture item", "level: module", "realises:", "  - UC-034", "modules:", "  - MOD-alpha", "tests:", "  - unit", "origin:", "  - the fixture", "---", "# ITM-5 The fixture item");
const sprint = (n, { branch = "", selection = ["ITM-5"], review = false } = {}) => [`docs/backlog/sprints/team9/${n}.md`,
  lines("---", `sprint: ${n}`, "goal: A goal", "start: 2026-10-31", "end:", "closer: alice", `branch: ${branch}`, "selection:", ...selection.map((item) => `  - ${item}`), "---", `# team9 Sprint ${n}`, ...(review ? ["", "## Review", "", "Reviewed."] : []))];
const declaration = (rows) => lines("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", "model_version: 1", "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", ...rows.map(([phase, branch]) => `| ${phase} | ${branch} |`), "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const ORDER = lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-5 | Testing |");
const BASE = { "docs/backlog/ITM-5-item.md": ITEM, "src/alpha/index.mjs": "export const a = 1;\n" };
const files = (...extra) => ({ ...BASE, ...Object.fromEntries(extra) });
const withPhase = (rows) => [["docs/plan/order.md", ORDER], ["docs/process.md", declaration(rows)]];

// The base of the one pull request the writer opened for the job of ITM-5 over a snapshot of these files; the server's default branch is `trunk`.
async function baseOver(snapshotFiles) {
  const calls = [];
  const host = {
    async readSnapshot(ref) { if (ref !== JOB) throw failure("NotFound"); return treeOf("c1", { ...snapshotFiles, "src/alpha/index.mjs": "export const a = 2;\n" }); },
    async listPullRequests() { return []; },
    async repositoryInfo() { return { defaultBranch: "trunk", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async openPullRequest(request) { calls.push(request); return { number: 3, url: "https://github.com/acme/product/pull/3", branch: request.branch, base: request.base, state: "open" }; },
  };
  const context = { kind: { name: "implement" }, params: { items: ["ITM-5"] }, product: { address: "https://github.com/acme/product", snapshot: treeOf("c0", snapshotFiles), host },
    instance: { snapshot: treeOf("i0", {}), host: null }, connect: async () => host, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    now: new Date("2026-10-31T13:00:00Z"), agentM: { version: "2026.10.0", commit: "a".repeat(40) }, jobId: JOB };
  const result = { draft: { branch: JOB, commits: ["c1"], pullRequest: "" }, raw: null, drafter: { name: "coder-a", model: "model-m" }, rounds: [{}], remaining: [], forPerson: [], stepFindings: [], classes: null, stoppedBecause: "passed", gate: null, usage: [], written: null };
  await runtimes.routeStrategies.writers["branch-and-pull-request"](result, context);
  assert.equal(calls.length, 1, "one pull request is opened");
  return calls[0].base;
}

// TST-1171101 · level: release · module: MOD-runtimes
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; UC-034
// given: a server whose default branch is trunk; the job's snapshot holds ITM-5; known positive first — a snapshot with no sprint and no declared branch gives trunk
// input: the writer for the job of ITM-5 over (a) a running sprint of team9 selecting ITM-5 with branch sprint/team9/42; (b) no sprint, the declaration giving the phase Testing, which the order gives ITM-5, the branch qa-line; (c) both (a) and (b)
// expect: (a) the pull request goes into sprint/team9/42; (b) into qa-line; (c) into sprint/team9/42, the sprint's own branch
// Planted fault: the writer's base taken from repositoryInfo alone (`base: await baseOf(...)` of src/runtimes/pull-request.mjs replaced by `base: defaultBranch`) opens (a) into trunk, and the case fails on (a).
// Planted fault: targetBranch ignoring the sprint (`own` forced to "" in src/work-plans/sprints.mjs) opens (a) and (c) into trunk/qa-line, and the case fails on (a).
test("TST-1171101 an item's pull request goes into its running sprint's branch, else into its phase's declared branch", async () => {
  assert.equal(await baseOver(files()), "trunk", "known positive: with no branch anywhere the default branch is the base");
  assert.equal(await baseOver(files(sprint(42, { branch: "sprint/team9/42" }))), "sprint/team9/42", "failure node: the sprint has a branch of its own and the pull request does not target it");
  assert.equal(await baseOver(files(...withPhase([["Testing", "qa-line"]]))), "qa-line", "failure node: the phase has a branch and the pull request does not target it");
  assert.equal(await baseOver(files(sprint(42, { branch: "sprint/team9/42" }), ...withPhase([["Testing", "qa-line"]]))), "sprint/team9/42", "the sprint's branch is narrower than the phase's");
});

// TST-1171102 · level: release · module: MOD-runtimes
// guards: WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; UC-034
// given: a server whose default branch is trunk; the job's snapshot holds ITM-5; known positive first — a running sprint selecting ITM-5 with a branch gives that branch
// input: the writer for the job of ITM-5 over (a) a running sprint selecting ITM-5 with no branch; (b) a sprint with branch sprint/team9/43 that selects only ITM-6; (c) a sprint selecting ITM-5 with branch sprint/team9/44 whose record holds ## Review; (d) the declaration giving a branch only for the phase Implementation, while the order puts ITM-5 in Testing
// expect: in each of (a) to (d) the pull request goes into trunk, the default branch
// Planted fault: targetBranch taking the branch of any sprint record (the `selectionOf(record).includes(item)` test dropped in src/work-plans/sprints.mjs) sends (b) into sprint/team9/43, and the case fails on (b).
// Planted fault: the closed-record test dropped (`!closedRecord(record)` removed in targetBranch) sends (c) into sprint/team9/44, and the case fails on (c).
test("TST-1171102 without a branch for the item's sprint or phase the pull request goes into the default branch", async () => {
  assert.equal(await baseOver(files(sprint(43, { branch: "sprint/team9/43" }))), "sprint/team9/43", "known positive: a running sprint selecting the item with a branch is targeted");
  assert.equal(await baseOver(files(sprint(41, { branch: "" }))), "trunk", "failure node (a): a sprint without a branch");
  assert.equal(await baseOver(files(sprint(43, { branch: "sprint/team9/43", selection: ["ITM-6"] }))), "trunk", "failure node (b): the branch of a sprint that does not hold the item");
  assert.equal(await baseOver(files(sprint(44, { branch: "sprint/team9/44", review: true }))), "trunk", "failure node (c): the branch of a sprint that has ended");
  assert.equal(await baseOver(files(...withPhase([["Implementation", "work-line"]]))), "trunk", "failure node (d): a branch declared for another phase");
});
