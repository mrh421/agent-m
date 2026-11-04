// The writer `branch-and-pull-request` of MOD-runtimes' `routeStrategies` (ITM-567), as the accepted text of docs/architecture/MOD-runtimes.md states it: "`routeStrategies` —
// `Partial<Strategies>` with the writer `branch-and-pull-request`. reads the branch named after the job and its commits. With a host of a server's API, it opens the pull request
// if the coding participant has not — into the default branch the host's `repositoryInfo` names —, gives it a description that names the job, the plan step or backlog item, its
// modules, the requirements its new tests guard — read with MOD-test-document's `testDeclarations` — and the provenance lines, and returns its address. With a local host — a
// Bridge's clone, which makes no server requests and throws `NotSupported` for them — it opens nothing and returns the branch and the pull request the agent reports. [...] It
// never merges [...]. Fails with `NoBranch`, `NoCommits`, and what the host names." With UC-024 steps 7 and 11 and UC-049 4a.
// Run: node --test tests/runtimes-pull-request.test.mjs
//
// Module: MOD-runtimes
// Guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; A REMOTE INTERFACE NAMES HOW IT FAILS; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-024; UC-034; UC-049
// Level: unit
//
// The readings of this file, each with the sentence it reads (ITM-567, sprint team1/54):
//   - The branch is the `branch` of the participant's answer (`result.draft.branch`), read through `context.product.host`'s `readSnapshot`. A branch the host does not hold
//     (`NotFound`) is `NoBranch`; one whose head commit is the job's snapshot commit has no commit beyond it: `NoCommits`. Any other failure of the host is thrown as it is.
//   - New tests are the declarations, read with `testDeclarations`, in the files whose blob on the branch differs from that of the job's snapshot, whose identifier that snapshot's
//     version of the file does not declare ("whose identifier that snapshot's version of the file does not declare").
//   - The host is a server's where `listPullRequests` answers, a local one where it throws `NotSupported`. A pull request of the branch that stands open or merged is the one
//     returned; the writer opens none beside it. `openPullRequest` failing with what the host names (`NotSupported` included) is thrown, not taken for a local host.
//   - The description is lines: `Job:`, `Kind:`, `Plan step:` and `Backlog item:` (those the job's parameters `steps` and `items` name), `Modules:` (see the next reading), `Requirements guarded by the new tests:`
//     (their `guards`, once each, in the order the new tests are found: the changed files by path, the declarations of a file in order), then a blank line and the provenance lines of MOD-job-runner's `provenanceLines`.
//     It holds none of the job's instruction.
//   - The modules (ITM-607, sprint team1/67). MOD-runtimes' `routeStrategies` says the description "names the job, the plan step or backlog item, its modules", and its Uses say:
//     "`MOD-trace-graph.traceGraph` — the modules of the plan step or backlog item a pull request names: its `changes` edges." So `Modules:` holds the targets of the `changes` edges, from
//     the node of each step and item the parameters name, in `traceGraph` of the job's snapshot (`context.product.snapshot`; the item's text says "over the job's snapshot"). The order is that of the names — the steps, then
//     the items, the order of the title — and, within a name, that of the item's `modules` as its file lists them; a module is named once. A module that only a new test declares, or only a text of the item mentions, is
//     none of them. A name the graph does not hold gives none, and with no module the line is left out. The graph is built once for a pull request the writer opens, and not at all where a pull request is
//     opened by none (one exists, or the host is local) or where no step and no item is named.
//   - What the item realises and its issue (ITM-1411, sprint team1/142). UC-034 step 5.3 says: "The pull request names the item, the requirements it realises and, for an item from an issue, the issue (UC-033)."
//     MOD-runtimes says the description holds "a description that names the job, the plan step or backlog item, its modules, the requirements its new tests guard [...] and the provenance lines"; it does not say the
//     description holds nothing else. So the description also holds, for the steps and items the job names, the line `Realises:` — the targets of their `realises` edges in the trace graph of the job's snapshot, in the
//     order of the names and, within a name, of the item's `realises` as its file lists them, each once, requirements and use cases alike — and the line `Issue:` — the entries of their `origin` that are an issue's
//     address (`.../issues/<n>`, GitLab's `.../-/issues/<n>`), in the same order, each once; a requirement's name or a use case among the origins is no issue. A line with no entry is left out. They stand after
//     `Modules:` and before `Requirements guarded by the new tests:`, which stays. The artifacts of the snapshot are read once for all of it, as for the modules.
// The tests TST-607001 to TST-607005 are ITM-607's, TST-1411001 to TST-1411003 are ITM-1411's, TST-1426001 is ITM-1426's; TST-567001 is the one existing test whose expected result changes (its `Modules:` line was the new tests' modules).
// Each test states its expected values in its own text; none reads them from a document. The repository server is the fake host of this file, which records every call; nothing
// reaches the network (a fetch that fails the test replaces the real one). A name the module does not provide yet is undefined here, so that each test fails by itself. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";

const realFetch = globalThis.fetch;
test.beforeEach(() => { globalThis.fetch = async () => { throw new Error("the writer must reach the server only through the host"); }; });
test.afterEach(() => { globalThis.fetch = realFetch; });

const failure = (name, fields = {}) => Object.assign(new Error(name), { name, ...fields });
const JOB = "JOB-20261017-1000-abcd";
const SNAPSHOT_COMMIT = "c0";
const INSTRUCTION = "PLANTED-INSTRUCTION-91C2 add the export";

const declared = (id, module, guards) => [`// ${id} · level: unit · module: ${module}`, `// guards: ${guards}`, "// given: g", "// input: i", "// expect: e", "test(\"x\", () => {});", ""].join("\n");

// A tree is a map of path to text; its blob of a path is the text itself behind a prefix, `null` for a path it lacks. `reads`, where given, records every path read.
function treeOf(commit, files, reads = null) {
  return { commit, paths: Object.keys(files).sort(), read: async (path) => { reads?.push(path); return files[path] ?? null; }, blob: (path) => (path in files ? `blob:${files[path]}` : null) };
}

// The job's snapshot holds a backlog item ITM-9 that changes MOD-gamma and MOD-alpha, in that order, and whose text mentions MOD-beta; and a plan step ITM-10 that changes MOD-delta and MOD-alpha.
const artifact = (id, modules, text, { realises = ["UC-024"], origin = ["the fixture"] } = {}) => ["---", `id: ${id}`, `title: The fixture ${id}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((module) => `  - ${module}`), "tests:", "  - unit", "origin:", ...origin.map((entry) => `  - ${entry}`), "---", `# ${id} The fixture ${id}`, "", text, ""].join("\n");
const BASE_FILES = {
  "tests/old.test.mjs": declared("TST-001", "MOD-alpha", "OLD RULE"),
  "tests/same.test.mjs": declared("TST-004", "MOD-alpha", "UNTOUCHED RULE"),
  "src/alpha/index.mjs": "export const a = 1;\n",
  "docs/backlog/ITM-9-item.md": artifact("ITM-9", ["MOD-gamma", "MOD-alpha"], "It leaves MOD-beta alone."),
  "docs/plan/ITM-10-step.md": artifact("ITM-10", ["MOD-delta", "MOD-alpha"], "A step of the plan."),
};
const DOCS = ["docs/backlog/ITM-9-item.md", "docs/plan/ITM-10-step.md"];
const BRANCH_FILES = {
  ...BASE_FILES,
  "tests/old.test.mjs": `${declared("TST-001", "MOD-alpha", "OLD RULE")}\n${declared("TST-002", "MOD-alpha", "NEW RULE ONE")}`,
  "tests/new.test.mjs": `${declared("TST-003", "MOD-beta", "NEW RULE TWO; NEW RULE ONE")}\n${declared("TST-005", "system", "NEW RULE THREE")}`,
  "src/alpha/index.mjs": "export const a = 2;\n",
};

// The fake server: `branches` by name; `pulls` the pull requests of the repository; `local` makes every server request throw NotSupported, as a Bridge's clone does.
function fakeHost({ branches = { [JOB]: treeOf("c1", BRANCH_FILES) }, pulls = [], local = false, openFails = null } = {}) {
  const calls = [];
  const server = (name, answer) => async (...args) => {
    calls.push([name, ...args]);
    if (local) throw failure("NotSupported", { what: name });
    return answer(...args);
  };
  return {
    calls,
    host: {
      async readSnapshot(ref) {
        calls.push(["readSnapshot", ref]);
        if (!(ref in branches)) throw failure("NotFound", { what: ref });
        return branches[ref];
      },
      listPullRequests: server("listPullRequests", ({ branch }) => pulls.filter((pull) => pull.branch === branch)),
      repositoryInfo: server("repositoryInfo", () => ({ defaultBranch: "develop", visibility: "private", canWrite: true, archived: false, description: "" })),
      openPullRequest: server("openPullRequest", (request) => {
        if (openFails) throw openFails;
        return { number: 7, url: "https://github.com/acme/product/pull/7", branch: request.branch, base: request.base, state: "open" };
      }),
      async mergePullRequest(...args) { calls.push(["mergePullRequest", ...args]); return { commit: "merged" }; },
      async commitFiles(...args) { calls.push(["commitFiles", ...args]); return { commit: "made" }; },
    },
  };
}

const contextOf = (host, params = { items: ["ITM-9"], steps: ["ITM-10"], instruction: INSTRUCTION }, snapshot = treeOf(SNAPSHOT_COMMIT, BASE_FILES)) => ({
  kind: { name: "implement" }, params, product: { address: "https://github.com/acme/product", snapshot, host },
  instance: { snapshot: treeOf("i0", {}), host: null }, connect: async () => host, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
  now: new Date("2026-10-17T10:00:00Z"), agentM: { version: "2026.10.0", commit: "a".repeat(40) }, jobId: JOB,
});
const resultOf = (draft = { branch: JOB, commits: ["c1"], pullRequest: "" }) => ({ draft, raw: null, drafter: { name: "coder-a", model: "model-m" }, rounds: [{}, {}], remaining: [],
  forPerson: [], stepFindings: [], classes: null, stoppedBecause: "passed", gate: null, usage: [], written: null });
const writer = () => runtimes.routeStrategies?.writers?.["branch-and-pull-request"];
const write = (host, draft, params, snapshot) => writer()(resultOf(draft), contextOf(host, params, snapshot));
// The lines of the one description a write opened, and the paths under docs/ the job's snapshot was read at while it wrote.
const bodyOf = (server) => server.calls.find(([name]) => name === "openPullRequest")[1].body.split("\n");
async function writeRecording(server, params, draft) {
  const reads = [];
  await write(server.host, draft, params, treeOf(SNAPSHOT_COMMIT, BASE_FILES, reads));
  return reads.filter((path) => path.startsWith("docs/")).sort();
}

// TST-567001 · level: unit · module: MOD-runtimes
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-024
// given: a server host whose default branch is `develop`, no pull request of the branch; the job's snapshot at c0 declares TST-001 (OLD RULE) in tests/old.test.mjs and TST-004 (UNTOUCHED RULE) in tests/same.test.mjs; the branch is at c1 and, besides src/alpha/index.mjs, changes tests/old.test.mjs to declare TST-001 and TST-002 (NEW RULE ONE, module MOD-alpha), adds tests/new.test.mjs declaring TST-003 (NEW RULE TWO and NEW RULE ONE, module MOD-beta) and TST-005 (NEW RULE THREE, module system); the job's snapshot also holds the backlog item ITM-9, which changes MOD-gamma then MOD-alpha, and the plan step ITM-10, which changes MOD-delta then MOD-alpha; the job JOB-20261017-1000-abcd of kind implement names the backlog item ITM-9 and the plan step ITM-10, and its instruction holds PLANTED-INSTRUCTION-91C2
// input: the writer `branch-and-pull-request` of routeStrategies with the answer { branch: the job's id, commits: ["c1"], pullRequest: "" }, the drafter coder-a with model model-m, after two rounds
// expect: one openPullRequest, with branch = the job's id, base "develop" and a title that names the job; its body holds the lines "Job: JOB-20261017-1000-abcd", "Kind: implement", "Plan step: ITM-10", "Backlog item: ITM-9", "Modules: MOD-delta, MOD-alpha, MOD-gamma" (the step's modules, then the item's, MOD-alpha once), "Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE", and, after a blank line, exactly the six provenance lines ("Agent-M-Version: 2026.10.0, commit aaaa…", "Agent-M-Job: JOB-20261017-1000-abcd", "Agent-M-Kind: implement", "Agent-M-Participant: coder-a", "Agent-M-Model: model-m", "Agent-M-Rounds: 2"), and none of OLD RULE, UNTOUCHED RULE, MOD-beta (declared by a new test, named by no step or item), MOD-system or PLANTED-INSTRUCTION-91C2; the outcome's pullRequest is "https://github.com/acme/product/pull/7", its commits ["c1"] and its files the three paths the branch changes, sorted
test("the writer opens the pull request into the default branch with the job, the work, the modules, the new tests' requirements and the provenance lines", async () => {
  assert.equal(typeof writer(), "function", "failure node: routeStrategies offers the writer branch-and-pull-request");
  const server = fakeHost();
  const outcome = await write(server.host);
  const opened = server.calls.filter(([name]) => name === "openPullRequest");
  assert.equal(opened.length, 1, "one pull request opened");
  const request = opened[0][1];
  assert.equal(request.branch, JOB);
  assert.equal(request.base, "develop");
  assert.ok(request.title.includes(JOB), `the title names the job: ${request.title}`);
  const lines = request.body.split("\n");
  for (const line of [`Job: ${JOB}`, "Kind: implement", "Plan step: ITM-10", "Backlog item: ITM-9", "Modules: MOD-delta, MOD-alpha, MOD-gamma",
    "Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE"]) assert.ok(lines.includes(line), `the description holds the line ${line}`);
  const trailers = [`Agent-M-Version: 2026.10.0, commit ${"a".repeat(40)}`, `Agent-M-Job: ${JOB}`, "Agent-M-Kind: implement", "Agent-M-Participant: coder-a", "Agent-M-Model: model-m", "Agent-M-Rounds: 2"];
  assert.deepEqual(lines.slice(-trailers.length), trailers, "the provenance lines close the description");
  assert.equal(lines[lines.length - trailers.length - 1], "", "a blank line stands before them");
  for (const word of ["OLD RULE", "UNTOUCHED RULE", "MOD-beta", "MOD-system", "PLANTED-INSTRUCTION-91C2"]) assert.ok(!request.body.includes(word), `the description holds no ${word}`);
  assert.equal(outcome.pullRequest, "https://github.com/acme/product/pull/7");
  assert.deepEqual(outcome.commits, ["c1"]);
  assert.deepEqual(outcome.files, ["src/alpha/index.mjs", "tests/new.test.mjs", "tests/old.test.mjs"]);
});

// TST-567002 · level: unit · module: MOD-runtimes
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; UC-024
// given: the server host of TST-567001, known positive first; then the same host with an open pull request #5 of the branch (url https://github.com/acme/product/pull/5), and one with a merged pull request #4 of it
// input: the writer with the same answer on each host
// expect: with no pull request the writer opens one (positive); with the open one, and again with the merged one, it opens none and returns the existing pull request's url as `pullRequest`
test("the writer opens no pull request where the branch has one", async () => {
  const positive = fakeHost();
  await write(positive.host);
  assert.equal(positive.calls.filter(([name]) => name === "openPullRequest").length, 1, "known positive: with none it opens one");

  for (const [state, number] of [["open", 5], ["merged", 4]]) {
    const server = fakeHost({ pulls: [{ number, url: `https://github.com/acme/product/pull/${number}`, branch: JOB, base: "develop", state }] });
    const outcome = await write(server.host);
    assert.equal(server.calls.filter(([name]) => name === "openPullRequest").length, 0, `${state}: none opened`);
    assert.equal(outcome.pullRequest, `https://github.com/acme/product/pull/${number}`, `${state}: the existing one is returned`);
  }
});

// TST-567003 · level: unit · module: MOD-runtimes
// guards: UC-049; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a local host, a Bridge's clone: it holds the branch at c1, and every server request (listPullRequests, repositoryInfo, openPullRequest) throws NotSupported
// input: the writer with the answer { branch: the job's id, commits: ["c1"], pullRequest: "https://github.com/acme/product/pull/3" }
// expect: no openPullRequest call; the outcome's pullRequest is "https://github.com/acme/product/pull/3", its commits ["c1"]; and the same host with an answer that reports no pull request ("") gives pullRequest null
test("the writer on a local host opens nothing and returns the branch and the pull request the agent reports", async () => {
  const server = fakeHost({ local: true });
  const outcome = await write(server.host, { branch: JOB, commits: ["c1"], pullRequest: "https://github.com/acme/product/pull/3" });
  assert.equal(server.calls.filter(([name]) => name === "openPullRequest").length, 0, "nothing opened");
  assert.equal(outcome.pullRequest, "https://github.com/acme/product/pull/3");
  assert.deepEqual(outcome.commits, ["c1"]);
  const silent = await write(fakeHost({ local: true }).host, { branch: JOB, commits: ["c1"], pullRequest: "" });
  assert.equal(silent.pullRequest, null, "no pull request reported");
});

// TST-567004 · level: unit · module: MOD-runtimes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-024
// given: known positive first — the server host holding the branch; then a host that holds no branch of that name (readSnapshot throws NotFound), a server one and a local one; and a host whose readSnapshot throws RateLimited
// input: the writer with the answer naming the branch, and with an answer naming no branch (branch "")
// expect: the positive resolves; a branch the host does not hold rejects with name NoBranch whose message names the branch, on the server host and on the local one, with no pull request opened; an answer without a branch rejects NoBranch; RateLimited rejects as RateLimited, unchanged
test("the writer fails with NoBranch for a branch the host does not hold, and with the host's own failure otherwise", async () => {
  await write(fakeHost().host);

  for (const local of [false, true]) {
    const server = fakeHost({ branches: {}, local });
    await assert.rejects(write(server.host), (error) => error.name === "NoBranch" && error.message.includes(JOB), `local: ${local}`);
    assert.equal(server.calls.filter(([name]) => name === "openPullRequest").length, 0, "nothing opened");
  }
  await assert.rejects(write(fakeHost().host, { branch: "", commits: [], pullRequest: "" }), (error) => error.name === "NoBranch");

  const limited = fakeHost();
  limited.host.readSnapshot = async () => { throw failure("RateLimited", { limit: "account" }); };
  await assert.rejects(write(limited.host), (error) => error.name === "RateLimited");
});

// TST-567005 · level: unit · module: MOD-runtimes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-024
// given: known positive first — the branch at c1; then the branch at c0, the commit of the job's snapshot, which has no commit beyond it
// input: the writer with the answer naming the branch, on a server host and on a local one
// expect: the positive resolves; the branch at c0 rejects with name NoCommits, naming the branch, on both hosts, with no pull request opened
test("the writer fails with NoCommits for a branch with no commit beyond the job's snapshot", async () => {
  await write(fakeHost().host);

  for (const local of [false, true]) {
    const server = fakeHost({ branches: { [JOB]: treeOf(SNAPSHOT_COMMIT, BASE_FILES) }, local });
    await assert.rejects(write(server.host), (error) => error.name === "NoCommits" && error.message.includes(JOB), `local: ${local}`);
    assert.equal(server.calls.filter(([name]) => name === "openPullRequest").length, 0, "nothing opened");
  }
});

// TST-567006 · level: unit · module: MOD-runtimes
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: the server host with a merge spy, in three states: no pull request, an open one, and a local host
// input: the writer on each
// expect: on each host, mergePullRequest and commitFiles are called zero times; and a pull request the server refuses to open (openPullRequest throws NotSupported, as a server's adapter that is not built does) rejects with name NotSupported, not as a local host that returns the agent's report
test("the writer never merges and never commits, and a pull request the server cannot open is a failure", async () => {
  const hosts = [fakeHost(), fakeHost({ pulls: [{ number: 5, url: "https://github.com/acme/product/pull/5", branch: JOB, base: "develop", state: "open" }] }), fakeHost({ local: true })];
  for (const server of hosts) {
    await write(server.host);
    assert.deepEqual(server.calls.filter(([name]) => name === "mergePullRequest" || name === "commitFiles"), []);
  }
  const refusing = fakeHost({ openFails: failure("NotSupported", { what: "a pull request" }) });
  await assert.rejects(write(refusing.host), (error) => error.name === "NotSupported");
});

// TST-607001 · level: unit · module: MOD-runtimes
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-024
// given: the server host of TST-567001, no pull request of the branch; the job's snapshot holds the backlog item ITM-9, which changes MOD-gamma and then MOD-alpha, and whose text mentions MOD-beta; the branch's new tests declare MOD-alpha (TST-002) and MOD-beta (TST-003), and none declares MOD-gamma
// input: the writer with the job's parameters { items: ["ITM-9"] } (no step), the answer naming the branch
// expect: the one pull request's description holds exactly one line starting "Modules:", and it is "Modules: MOD-gamma, MOD-alpha" — both modules of the item, in the item's order, though no new test declares MOD-gamma — and the description holds no MOD-beta (a new test declares it, the item's text mentions it) and no MOD-delta (the step ITM-10, not named by this job, changes it)
test("the description names the modules the item changes, in the item's order, whether or not a new test declares them", async () => {
  const server = fakeHost();
  await write(server.host, undefined, { items: ["ITM-9"] });
  const lines = bodyOf(server);
  assert.deepEqual(lines.filter((line) => line.startsWith("Modules:")), ["Modules: MOD-gamma, MOD-alpha"]);
  for (const word of ["MOD-beta", "MOD-delta"]) assert.ok(!lines.join("\n").includes(word), `the description holds no ${word}`);
});

// TST-607002 · level: unit · module: MOD-runtimes
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-024
// given: the server host of TST-567001, no pull request of the branch; a job's snapshot that holds the step ITM-10 (MOD-delta, MOD-alpha) at docs/plan/ITM-10-step.md and the item ITM-9 (MOD-gamma, MOD-alpha) at docs/backlog/ITM-9-item.md, and records every path it is read at
// input: the writer with the job's parameters { steps: ["ITM-10"], items: ["ITM-9"] }
// expect: the description holds "Modules: MOD-delta, MOD-alpha, MOD-gamma" — the step's modules first, then the item's, MOD-alpha once —; the paths under docs/ that the snapshot was read at are exactly ["docs/backlog/ITM-9-item.md", "docs/plan/ITM-10-step.md"], each once: the graph is built once for the pull request, not once for each name
test("the description names the modules of the steps and then of the items, each once, from one graph", async () => {
  const server = fakeHost();
  const read = await writeRecording(server, { steps: ["ITM-10"], items: ["ITM-9"] });
  assert.ok(bodyOf(server).includes("Modules: MOD-delta, MOD-alpha, MOD-gamma"));
  assert.deepEqual(read, ["docs/backlog/ITM-9-item.md", "docs/plan/ITM-10-step.md"]);
});

// TST-607003 · level: unit · module: MOD-runtimes
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-024
// given: the server host of TST-567001, known positive first (with the item named, the description holds a Modules line and the snapshot's docs are read); no pull request of the branch; a snapshot that records the paths it is read at
// input: the writer with the job's parameters { instruction } — no step, no item
// expect: the positive holds; here the description holds no line starting "Modules:", it holds the line "Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE", and the snapshot was read at no path under docs/ — no graph was built
test("with no step and no item named the description holds no Modules line and the repository's artifacts are not read", async () => {
  const positive = fakeHost();
  const positiveReads = await writeRecording(positive, { items: ["ITM-9"] });
  assert.ok(bodyOf(positive).some((line) => line.startsWith("Modules:")), "known positive: with an item named the line is there");
  assert.equal(positiveReads.length, 2, "known positive: the docs are read");

  const server = fakeHost();
  const read = await writeRecording(server, { instruction: INSTRUCTION });
  const lines = bodyOf(server);
  assert.deepEqual(lines.filter((line) => line.startsWith("Modules:")), []);
  assert.ok(lines.includes("Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE"));
  assert.deepEqual(read, []);
});

// TST-607004 · level: unit · module: MOD-runtimes
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-024
// given: the server host of TST-567001, no pull request of the branch; the job's snapshot holds ITM-9 (MOD-gamma, MOD-alpha) and holds no ITM-77
// input: the writer with { items: ["ITM-77"] }, and, on another host, with { items: ["ITM-77", "ITM-9"] }
// expect: for ITM-77 alone one pull request is opened, its title names ITM-77, and its description holds the line "Backlog item: ITM-77" and no line starting "Modules:"; for both names the description holds "Modules: MOD-gamma, MOD-alpha" — the unknown name adds none and fails nothing
test("a name the graph does not hold names no module and fails nothing", async () => {
  const unknown = fakeHost();
  await write(unknown.host, undefined, { items: ["ITM-77"] });
  const opened = unknown.calls.filter(([name]) => name === "openPullRequest");
  assert.equal(opened.length, 1, "one pull request opened");
  assert.ok(opened[0][1].title.includes("ITM-77"), `the title names ITM-77: ${opened[0][1].title}`);
  const lines = bodyOf(unknown);
  assert.ok(lines.includes("Backlog item: ITM-77"));
  assert.deepEqual(lines.filter((line) => line.startsWith("Modules:")), []);

  const mixed = fakeHost();
  await write(mixed.host, undefined, { items: ["ITM-77", "ITM-9"] });
  assert.deepEqual(bodyOf(mixed).filter((line) => line.startsWith("Modules:")), ["Modules: MOD-gamma, MOD-alpha"]);
});

// TST-607005 · level: unit · module: MOD-runtimes
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-024
// given: the server host of TST-567001, known positive first; then the same host with an open pull request #5 of the branch, and a local host (every server request throws NotSupported); the item ITM-9 named in each case; a snapshot that records the paths it is read at
// input: the writer with { items: ["ITM-9"] } on each host
// expect: with no pull request the snapshot's docs are read (two paths, the positive); with the open pull request, and again on the local host, no openPullRequest call is made and the snapshot was read at no path under docs/ — a graph is built only for a pull request the writer opens
test("the repository's artifacts are read only for a pull request the writer opens", async () => {
  const positive = fakeHost();
  assert.equal((await writeRecording(positive, { items: ["ITM-9"] })).length, 2, "known positive: a pull request opened, the docs read");

  const existing = fakeHost({ pulls: [{ number: 5, url: "https://github.com/acme/product/pull/5", branch: JOB, base: "develop", state: "open" }] });
  assert.deepEqual(await writeRecording(existing, { items: ["ITM-9"] }), [], "an existing pull request: no docs read");
  assert.equal(existing.calls.filter(([name]) => name === "openPullRequest").length, 0);

  const local = fakeHost({ local: true });
  assert.deepEqual(await writeRecording(local, { items: ["ITM-9"] }), [], "a local host: no docs read");
  assert.equal(local.calls.filter(([name]) => name === "openPullRequest").length, 0);
});

// ITM-1411: the job's snapshot also holds the backlog item ITM-12, which realises RULE TWO and UC-024, changes MOD-alpha and comes from two issues (GitHub's and GitLab's form of the address), naming RULE TWO among its origins too;
// the backlog item ITM-13, which realises RULE THREE and comes from no issue (its origins are a requirement and a use case); and the plan step ITM-10 of BASE_FILES, which realises UC-024 and comes from no issue.
const ISSUE_A = "https://github.com/acme/product/issues/14";
const ISSUE_B = "https://gitlab.example/acme/product/-/issues/3";
const FILES_1411 = {
  ...BASE_FILES,
  "docs/backlog/ITM-12-item.md": artifact("ITM-12", ["MOD-alpha"], "An item from issues.", { realises: ["RULE TWO", "UC-024"], origin: [ISSUE_A, "RULE TWO", ISSUE_B] }),
  "docs/backlog/ITM-13-item.md": artifact("ITM-13", ["MOD-alpha"], "An item from no issue.", { realises: ["RULE THREE"], origin: ["RULE THREE", "UC-024"] }),
};
const BRANCH_1411 = { ...BRANCH_FILES, ...Object.fromEntries(Object.entries(FILES_1411).filter(([path]) => path.startsWith("docs/"))) };
async function write1411(params, snapshot = treeOf(SNAPSHOT_COMMIT, FILES_1411)) {
  const server = fakeHost({ branches: { [JOB]: treeOf("c1", BRANCH_1411) } });
  await write(server.host, undefined, params, snapshot);
  return server;
}
const linesOf = (server, prefix) => bodyOf(server).filter((line) => line.startsWith(prefix));

// TST-1411001 · level: unit · module: MOD-runtimes
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-034
// given: the server host of TST-567001, no pull request of the branch; the job's snapshot holds the backlog item ITM-12, which realises RULE TWO then UC-024 and has the origins https://github.com/acme/product/issues/14, RULE TWO and https://gitlab.example/acme/product/-/issues/3; the branch's new tests guard NEW RULE TWO, NEW RULE ONE and NEW RULE THREE
// input: the writer with the job's parameters { items: ["ITM-12"] }
// expect: UC-034 step 5.3 "The pull request names the item, the requirements it realises and, for an item from an issue, the issue": the one description holds the lines "Backlog item: ITM-12", "Realises: RULE TWO, UC-024" (the requirement and the use case, in the item's order), "Issue: https://github.com/acme/product/issues/14, https://gitlab.example/acme/product/-/issues/3" (the two issues, not RULE TWO) and still "Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE", each once; Modules stands before Realises, Realises before Issue and Issue before the guarded line, and a blank line and the six provenance lines still close the description
test("the description names the requirements and use cases the item realises and the issues it comes from, beside the requirements the new tests guard", async () => {
  const server = await write1411({ items: ["ITM-12"] });
  const lines = bodyOf(server);
  assert.ok(lines.includes("Backlog item: ITM-12"), "known positive: the item is named");
  assert.deepEqual(linesOf(server, "Realises:"), ["Realises: RULE TWO, UC-024"]);
  assert.deepEqual(linesOf(server, "Issue:"), [`Issue: ${ISSUE_A}, ${ISSUE_B}`]);
  assert.deepEqual(linesOf(server, "Requirements guarded"), ["Requirements guarded by the new tests: NEW RULE TWO; NEW RULE ONE; NEW RULE THREE"]);
  const at = (prefix) => lines.findIndex((line) => line.startsWith(prefix));
  assert.ok(at("Modules:") < at("Realises:") && at("Realises:") < at("Issue:") && at("Issue:") < at("Requirements guarded"), "the lines stand in that order");
  assert.equal(lines[lines.length - 7], "", "a blank line stands before the six provenance lines");
});

// TST-1411002 · level: unit · module: MOD-runtimes
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-034
// given: the server host of TST-567001, known positive first (ITM-12 gives a Realises and an Issue line); the snapshot of TST-1411001, which also holds ITM-13 (realises RULE THREE; its origins are RULE THREE and UC-024, no issue) and holds no ITM-77
// input: the writer with { items: ["ITM-13"] }, with { items: ["ITM-77"] }, and with { instruction } (no step, no item)
// expect: for ITM-13 the description holds "Realises: RULE THREE" and no line starting "Issue:" — a requirement or a use case among the origins is no issue —; for the unknown ITM-77 it holds "Backlog item: ITM-77" and neither a "Realises:" nor an "Issue:" line, and nothing fails; with no step and no item it holds neither line
test("an item from no issue has no Issue line, and a name the graph does not hold or no name has neither the Realises nor the Issue line", async () => {
  const positive = await write1411({ items: ["ITM-12"] });
  assert.equal(linesOf(positive, "Realises:").length + linesOf(positive, "Issue:").length, 2, "known positive: ITM-12 gives both lines");

  const noIssue = await write1411({ items: ["ITM-13"] });
  assert.deepEqual(linesOf(noIssue, "Realises:"), ["Realises: RULE THREE"]);
  assert.deepEqual(linesOf(noIssue, "Issue:"), []);

  const unknown = await write1411({ items: ["ITM-77"] });
  assert.ok(bodyOf(unknown).includes("Backlog item: ITM-77"));
  assert.deepEqual([...linesOf(unknown, "Realises:"), ...linesOf(unknown, "Issue:")], []);

  const none = await write1411({ instruction: INSTRUCTION });
  assert.deepEqual([...linesOf(none, "Realises:"), ...linesOf(none, "Issue:")], []);
});

// TST-1411003 · level: unit · module: MOD-runtimes
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-034
// given: the server host of TST-567001, no pull request of the branch; the snapshot of TST-1411001, which records every path it is read at; the plan step ITM-10 (realises UC-024, no issue) and the items ITM-12 (RULE TWO, UC-024; two issues) and ITM-13 (RULE THREE; no issue)
// input: the writer with { steps: ["ITM-10"], items: ["ITM-12", "ITM-13"] }
// expect: "Realises: UC-024, RULE TWO, RULE THREE" — the step's, then ITM-12's, then ITM-13's, UC-024 once — and "Issue: https://github.com/acme/product/issues/14, https://gitlab.example/acme/product/-/issues/3"; the paths under docs/ that the snapshot was read at are exactly the four artifacts, each once: reading the origins costs no second read
test("the realised requirements and the issues of the steps and items are named in the order of the names, each once, from the reading that builds the graph", async () => {
  const reads = [];
  const server = await write1411({ steps: ["ITM-10"], items: ["ITM-12", "ITM-13"] }, treeOf(SNAPSHOT_COMMIT, FILES_1411, reads));
  assert.deepEqual(linesOf(server, "Realises:"), ["Realises: UC-024, RULE TWO, RULE THREE"]);
  assert.deepEqual(linesOf(server, "Issue:"), [`Issue: ${ISSUE_A}, ${ISSUE_B}`]);
  assert.deepEqual(reads.filter((path) => path.startsWith("docs/")).sort(), ["docs/backlog/ITM-12-item.md", "docs/backlog/ITM-13-item.md", "docs/backlog/ITM-9-item.md", "docs/plan/ITM-10-step.md"]);
});

// ITM-1426: UC-026 step 8.4 and UC-034 step 5.3 say the pull request "records the Agent M version, the participant, the model and the date"; MOD-runtimes' `routeStrategies` says the description names
// "the provenance lines" and does not say the description holds nothing else. Reading taken: the date is the one of the job's run, `context.now` (MOD-job-runner's JobContext: "everything a strategy may read"; MOD-runtimes'
// tabContext: "`now` is the moment of the call"), as the calendar day in UTC, `YYYY-MM-DD`. The commit's date is none the host's `readSnapshot` gives, the wall clock is not deterministic, and a job's identifier is none
// for a job without a record. The line `Date:` stands among the lines before the blank line, so that the six provenance lines still close the description. Each test fixes `now`, not the wall clock.

// TST-1426001 · level: unit · module: MOD-runtimes
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-026; UC-034
// given: the server host of TST-567001, no pull request of the branch; the job JOB-20261017-1000-abcd of kind implement, whose context says it ran at 2026-10-17T10:00:00Z; then the same job with a context whose moment is 2026-11-03T23:59:59Z (the identifier unchanged); known positive first: the description of the first holds "Kind: implement" and the participant's provenance line
// input: the writer `branch-and-pull-request` with the answer { branch: the job's id, commits: ["c1"], pullRequest: "" } in each context
// expect: UC-026 8.4 "naming the Agent M version, the participant, the model and the date": the one description holds exactly one line starting "Date:", "Date: 2026-10-17" for the first and "Date: 2026-11-03" for the second — the day of the context's moment in UTC, not the day in the job's identifier (20261017) —, that line stands before the blank line, the six provenance lines still close the description, and the description holds no other date of the form YYYY-MM-DD
test("the description names the date the job ran, beside the version, the participant and the model", async () => {
  const opened = async (now) => {
    const server = fakeHost();
    await writer()(resultOf(), { ...contextOf(server.host), now });
    return bodyOf(server);
  };
  const first = await opened(new Date("2026-10-17T10:00:00Z"));
  assert.ok(first.includes("Kind: implement") && first.includes("Agent-M-Participant: coder-a"), "known positive: the description is there, with its provenance lines");
  assert.deepEqual(first.filter((line) => line.startsWith("Date:")), ["Date: 2026-10-17"]);
  const second = await opened(new Date("2026-11-03T23:59:59Z"));
  assert.deepEqual(second.filter((line) => line.startsWith("Date:")), ["Date: 2026-11-03"], "the day of the moment, not of the identifier");
  for (const lines of [first, second]) {
    assert.ok(lines.findIndex((line) => line.startsWith("Date:")) < lines.length - 7, "the date stands before the blank line");
    assert.equal(lines[lines.length - 7], "", "a blank line stands before the six provenance lines");
    assert.equal(lines.join("\n").match(/\b\d{4}-\d{2}-\d{2}\b/g)?.length, 1, "no other date");
  }
});
