// The branch the writer `branch-and-pull-request` of MOD-runtimes' `routeStrategies` opens its pull request into (ITM-1171), as the accepted text of docs/architecture/MOD-runtimes.md states it: "With a host of
// a server's API, it opens the pull request if the coding participant has not — into MOD-work-plans' `targetBranch` of the item or step the job works on, over the product's sprint records, plan order and
// declared branches, with the default branch the host's `repositoryInfo` names —", and UC-034 8a: "The sprint has a branch of its own. The item's pull request targets that branch".
// Run: node --test tests/runtimes-pull-request-target.test.mjs
//
// Module: MOD-runtimes
// Guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; UC-034
// Level: unit
//
// Readings of this file, which the pull request names: the sprint records, the plan's order and the declaration are read from the job's snapshot (`context.product.snapshot`), the commit the job worked on;
// the item or step is the job's first named one (the steps, then the items, of its parameters). The host is this file's fake server, which records every call; nothing reaches the network. Each test states its
// input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";

const realFetch = globalThis.fetch;
test.beforeEach(() => { globalThis.fetch = async () => { throw new Error("the writer must reach the server only through the host"); }; });
test.afterEach(() => { globalThis.fetch = realFetch; });

const failure = (name, fields = {}) => Object.assign(new Error(name), { name, ...fields });
const JOB = "JOB-20261031-1200-abcd";
const lines = (...rows) => `${rows.join("\n")}\n`;

// A tree is a map of path to text; its blob of a path is the text itself behind a prefix, `null` for a path it lacks.
const treeOf = (commit, files) => ({ commit, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null, blob: (path) => (path in files ? `blob:${files[path]}` : null) });

const ITEM = lines("---", "id: ITM-9", "title: The fixture item", "level: module", "realises:", "  - UC-034", "modules:", "  - MOD-alpha", "tests:", "  - unit", "origin:", "  - the fixture", "---", "# ITM-9 The fixture item");
const SPRINT = "docs/backlog/sprints/team1/7.md";
// A running sprint of team1 — no ## Review, no ## Increment given up — whose selection names ITM-9, with the branch given.
const sprintRecord = (branch) => lines("---", "sprint: 7", "goal: The fixture's goal", "start: 2026-10-31", "end:", "closer: alice", `branch: ${branch}`, "selection:", "  - ITM-9", "---", "# team1 Sprint 7");
const BASE = { "docs/backlog/ITM-9-item.md": ITEM, "src/alpha/index.mjs": "export const a = 1;\n" };
const branchFiles = (files) => ({ ...files, "src/alpha/index.mjs": "export const a = 2;\n" });

// The fake server: the job's branch at c1; no pull request of it; the default branch `develop`.
function fakeHost(snapshotFiles) {
  const calls = [];
  const host = {
    async readSnapshot(ref) {
      calls.push(["readSnapshot", ref]);
      if (ref !== JOB) throw failure("NotFound", { what: ref });
      return treeOf("c1", branchFiles(snapshotFiles));
    },
    async listPullRequests(request) { calls.push(["listPullRequests", request]); return []; },
    async repositoryInfo() { calls.push(["repositoryInfo"]); return { defaultBranch: "develop", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async openPullRequest(request) { calls.push(["openPullRequest", request]); return { number: 7, url: "https://github.com/acme/product/pull/7", branch: request.branch, base: request.base, state: "open" }; },
  };
  return { calls, host };
}

const contextOf = (host, snapshotFiles) => ({
  kind: { name: "implement" }, params: { items: ["ITM-9"] }, product: { address: "https://github.com/acme/product", snapshot: treeOf("c0", snapshotFiles), host },
  instance: { snapshot: treeOf("i0", {}), host: null }, connect: async () => host, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
  now: new Date("2026-10-31T12:00:00Z"), agentM: { version: "2026.10.0", commit: "a".repeat(40) }, jobId: JOB,
});
const resultOf = () => ({ draft: { branch: JOB, commits: ["c1"], pullRequest: "" }, raw: null, drafter: { name: "coder-a", model: "model-m" }, rounds: [{}], remaining: [],
  forPerson: [], stepFindings: [], classes: null, stoppedBecause: "passed", gate: null, usage: [], written: null });
// The base of the one pull request the writer opened over a job's snapshot of these files.
async function baseOver(snapshotFiles) {
  const server = fakeHost(snapshotFiles);
  await runtimes.routeStrategies.writers["branch-and-pull-request"](resultOf(), contextOf(server.host, snapshotFiles));
  const opened = server.calls.filter(([name]) => name === "openPullRequest");
  assert.equal(opened.length, 1, "one pull request opened");
  return opened[0][1].base;
}

// TST-1171001 · level: unit · module: MOD-runtimes
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; UC-034
// given: a server host whose default branch is `develop`, no pull request of the job's branch; the job's snapshot holds the backlog item ITM-9 and the record docs/backlog/sprints/team1/7.md of a running sprint (no ## Review, no ## Increment given up) whose selection names ITM-9 and whose branch is sprint/team1/7
// input: the writer `branch-and-pull-request` for the implementation job JOB-20261031-1200-abcd of ITM-9 ({ items: ["ITM-9"] }), the answer naming the job's branch
// expect: one openPullRequest, with base "sprint/team1/7" — the sprint's own branch, not the default branch develop
test("the pull request of an item of a sprint with a branch goes into that branch", async () => {
  assert.equal(await baseOver({ ...BASE, [SPRINT]: sprintRecord("sprint/team1/7") }), "sprint/team1/7");
});

// TST-1171002 · level: unit · module: MOD-runtimes
// guards: WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; UC-034
// given: the server host of TST-1171001; the job's snapshot holds ITM-9 and either no sprint record, or the record of the running sprint of TST-1171001 with an empty branch
// input: the writer for the job of ITM-9, over each of the two snapshots
// expect: on each, one openPullRequest, with base "develop", the default branch repositoryInfo names
test("the pull request of an item of a sprint without a branch, or of no sprint, goes into the default branch", async () => {
  assert.equal(await baseOver(BASE), "develop", "no sprint record");
  assert.equal(await baseOver({ ...BASE, [SPRINT]: sprintRecord("") }), "develop", "a sprint without a branch");
});
