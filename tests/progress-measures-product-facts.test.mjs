// MOD-progress-measures' productFacts with the scope `work` (ITM-536) and `build`, publishOverview and storedOverview (ITM-940), as the accepted text of
// docs/architecture/MOD-progress-measures.md states it: "productFacts(host, instance, instanceAt, now, options?: { scope:
// "all" | "work" | "build" }) -> Promise<Facts> — with the scope `work`, what MOD-prompt-bar asks before a hand-over starts, it reads only what
// MOD-work-plans' `itemStates` and `startable` and MOD-product-process' `holdsRole` take — the approval statuses, the change queues,
// the declaration with its model and workflow, the participants, the plan or the backlog, the sprints, the role assignments, the
// gate records with their states, the job records without asking their live state, and the pull requests with `held` —, and every
// other fact is `"unknown"`." and, of the scope `all`, "for the head commits MOD-work-plans' `undecidedHeads` names, whether the
// default branch contains them, through the host's `containsCommit`, which `held` is computed with". The scope `all` adds the
// requirements, the graph, the tests, the branch test-results, the tags and the repository's information.
// Run: node --test tests/progress-measures-product-facts.test.mjs
//
// Module: MOD-progress-measures
// Guards: UC-032; UC-049; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Each test states its input and its expected values in its own text (given / input / expect); no expected value is read from a
// document. The fixture product is a Scrum product of one team: files held in memory, a host that records every call, and an
// instance snapshot that records every read. Nothing reaches the network: `fetch` is replaced by a spy for every test and must
// not have been called when the test ends. The counter-proofs are recorded in the pull request.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { productFacts } from "../src/progress-measures/index.mjs";

// ---------------------------------------------------------------- no network

let fetched = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
  fetched = [];
  globalThis.fetch = async (input) => { fetched.push(String(input?.url ?? input)); throw new Error("a test reached the network"); };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  assert.deepEqual(fetched, [], "no request reaches the network");
});

// ---------------------------------------------------------------- the fixture product

const NOW = new Date("2026-10-16T12:00:00Z");
const MODEL_VERSION = "5".repeat(40);
const H1 = "a1".repeat(20), H2 = "a2".repeat(20), H9 = "a9".repeat(20);

const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const named = (name, message = name) => Object.assign(new Error(message), { name });

// A snapshot (MOD-repository-hosts' Snapshot) of files held in memory; `reads` counts each path's reads.
function snapshotOf(files, web = "https://github.com/alice/product") {
  const reads = new Map();
  return {
    reads,
    repository: { server: "github", path: "alice/product", web },
    ref: "main",
    commit: "c".repeat(40),
    paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => { reads.set(path, (reads.get(path) ?? 0) + 1); return Object.hasOwn(files, path) ? files[path] : null; },
  };
}

const frontMatter = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value)
  ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: ${value}`])), "---"].join("\n");

const item = (id, { realises, modules, builds = [], level = "module" }) => [frontMatter({ id, title: `${id} the work`, level,
  realises, modules, ...(builds.length ? { builds_on: builds } : {}) }), `# ${id} the work`, ""].join("\n");
const moduleFile = (id, uses) => [frontMatter({ id, title: id, ...(uses.length ? { uses } : {}) }), `# ${id}`, ""].join("\n");
const sprintRecord = (selection) => [frontMatter({ sprint: 1, goal: "The fixture sprint", start: "2026-10-12", end: "", closer: "alice",
  branch: "", selection }), "# team1 Sprint 01", ""].join("\n");

const DECLARATION = (modelFile = "src/model-catalogue/models/scrum.md") => [
  frontMatter({ model: "scrum", model_file: modelFile, model_version: MODEL_VERSION }),
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|",
  "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.", "",
].join("\n");

const ROLE_ASSIGNMENT = ["# Role assignment of team1", "", "## Roles", "", "| Role | Participants |", "|---|---|",
  "| Product Owner | alice |", "| Scrum Master | alice |", "| Developers | developer-a |", ""].join("\n");

const QUEUE_INDEX = ["# SPEC approvals — queue 2026-03-01 · waiting queue", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
  "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
  "| 01 | `SPEC.md` | ## 1. Open section | — | — |", ""].join("\n");

const JOB = ["---", "id: JOB-20261014-0900-a1b2", "kind: implement", "works_on:", "  - ITM-002", "route: ci hosted",
  "started_by: alice", "start: 2026-10-14 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---",
  "## Destinations", "", "## Parameters", "", "```json", "{}", "```", ""].join("\n");

const REGISTER = ["# Participants of this instance", "", "**REGISTER**", "", "The people and agents of the fixture instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |",
  "| developer-a | CLI agent | example-model | 200000 | — | read the repository, write to the repository, run code and tests | this machine | bridge lab-pc agent claude |",
  ""].join("\n");

const UC1 = "docs/use-cases/UC-001-store.md", UC2 = "docs/use-cases/UC-002-pages.md";

// The files of the product's default branch: two use cases (UC-001 accepted by a record naming its blob, UC-002 open), two module
// files, four backlog items, one team's sprint selecting ITM-001, ITM-002 and ITM-004, one role assignment, one open SPEC change
// entry, one gate record and one job record.
function productFiles() {
  const files = {
    "SPEC.md": "# Spec\n",
    [UC1]: "# UC-001 store\n",
    [UC2]: "# UC-002 pages\n",
    "docs/architecture/MOD-store.md": moduleFile("MOD-store", []),
    "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read", "MOD-store.write"]),
    "docs/backlog/ITM-001-store.md": item("ITM-001", { realises: ["UC-001"], modules: ["MOD-store"] }),
    "docs/backlog/ITM-002-pages.md": item("ITM-002", { realises: ["UC-001"], modules: ["MOD-pages"], builds: ["ITM-001"] }),
    "docs/backlog/ITM-003-mail.md": item("ITM-003", { realises: ["UC-002"], modules: ["MOD-pages"] }),
    "docs/backlog/ITM-004-feed.md": item("ITM-004", { realises: ["UC-001"], modules: ["MOD-store"] }),
    "docs/backlog/sprints/team1/01.md": sprintRecord(["ITM-001", "ITM-002", "ITM-004"]),
    "docs/role-assignments/team1.md": ROLE_ASSIGNMENT,
    "docs/process.md": DECLARATION(),
    "docs/spec-freigaben/2026-03-01_waiting/index.md": QUEUE_INDEX,
    "docs/spec-freigaben/2026-03-01_waiting/01-open-section.md": "# Open section\n",
    "docs/jobs/JOB-20261014-0900-a1b2.md": JOB,
  };
  files[`docs/approvals/UC-001-${blobOf(files[UC1]).slice(0, 12)}.md`] = "kind: use-case\n";
  files["docs/gates/20261014-1000-development-sprint-review-a1b2.md"] = [
    frontMatter({ gate: "Development → Sprint Review", job: "", decider: "alice", role: "Product Owner", decision: "passed",
      on: [`docs/process.md@${blobOf(files["docs/process.md"])}`], date: "2026-10-14" }), "# Gate record", ""].join("\n");
  return files;
}

const pr = (number, id, base, state, head, merged = null) => ({ number, title: `${id}: the work`, branch: `work/${id}`, base, head,
  state, draft: false, url: `https://github.com/alice/product/pull/${number}`, opened: "2026-10-12T08:00:00Z", merged, closed: merged,
  body: "" });
// ITM-001 merged into the default branch, ITM-002 open.
const BASE_PULL_REQUESTS = [pr(1, "ITM-001", "main", "merged", H1, "2026-10-13T10:00:00Z"), pr(2, "ITM-002", "main", "open", H2)];

// The host (calls recorded), the instance and instanceAt (the commits asked recorded).
function fixture({ files = productFiles(), pullRequests = BASE_PULL_REQUESTS, serverOperations = true, contained = new Set(),
  instanceFailure = null, resultFiles = null, history = [], historyFailure = null, ciRuns = [], productWeb = "https://github.com/alice/product" } = {}) {
  const calls = [];
  const product = snapshotOf(files, productWeb);
  const results = resultFiles === null ? null : snapshotOf(resultFiles);
  const instance = snapshotOf({ "SPEC.md": "# Instance spec\n", "docs/participants.md": REGISTER }, "https://github.com/alice/agent-m");
  const asked = [];
  const host = {
    async repositoryInfo() {
      calls.push(["repositoryInfo"]);
      if (!serverOperations) throw named("NotSupported");
      return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" };
    },
    async readSnapshot(ref) {
      calls.push(["readSnapshot", ref]);
      if (ref === "test-results") {
        if (!serverOperations && results !== null) throw named("NotSupported");
        if (results === null) throw named("NotFound", "no branch test-results");
        return results;
      }
      return product;
    },
    async listTags(...pattern) { calls.push(["listTags", ...pattern]); return [{ name: "v2026.1.0", commit: H1 }]; },
    async listPullRequests(...filter) {
      calls.push(["listPullRequests", ...filter]);
      if (!serverOperations) throw named("NotSupported");
      return pullRequests;
    },
    async readHistory(path, options) {
      calls.push(["readHistory", path, options]);
      if (historyFailure) throw historyFailure;
      return history.map((commit) => ({ commit, parents: [], author: { account: null, name: "a" }, date: "2026-10-16T10:00:00Z", message: "m", changes: [] }));
    },
    async listCiRuns(...filter) {
      calls.push(["listCiRuns", ...filter]);
      if (!serverOperations) throw named("NotSupported");
      return ciRuns;
    },
    async readFileAt(path, commits) { calls.push(["readFileAt", path, commits]); return new Map(commits.map((commit) => [commit, Object.hasOwn(files, path) ? files[path] : null])); },
    async containsCommit(branch, commit) { calls.push(["containsCommit", branch, commit]); return contained.has(commit); },
  };
  const instanceAt = async (commit) => { asked.push(commit); if (instanceFailure) throw instanceFailure; return instance; };
  return { host, calls, product, instance, instanceAt, asked };
}

const work = (f) => productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "work" });

// ---------------------------------------------------------------- what is read

// TST-536001 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: the fixture product (UC-001 accepted by a record naming its blob, UC-002 open; one open SPEC change entry; scrum declared at the commit 5…5; alice and developer-a in the instance's register; four backlog items; team1's sprint; team1's role assignment; one passed gate record; one job record; a merged and an open pull request) and its instance
// input: productFacts(host, instance, instanceAt, now, { scope: "work" })
// expect: address "https://github.com/alice/product"; UC-001 accepted and UC-002 open in statuses; one queue, 2026-03-01_waiting, whose entry 01 is open; the declaration's model "scrum"; model and workflow of scrum with the phases Sprint Planning, Development, Sprint Review, Sprint Retrospective; modelUnread null; participants alice and developer-a; plan.order null and plan.items ITM-001 to ITM-004; sprints [docs/backlog/sprints/team1/01.md]; assignments [docs/role-assignments/team1.md]; gates [the one record]; one job JOB-20261014-0900-a1b2 of a product at the address; pullRequests numbered 1 and 2
test("productFacts, scope work — reads the statuses, queues, declaration with model and workflow, participants, backlog, sprints, role assignments, gates, jobs and pull requests", async () => {
  const f = fixture();
  const facts = await work(f);
  assert.equal(facts.address, "https://github.com/alice/product");
  assert.equal(facts.snapshot, f.product);
  assert.deepEqual(facts.statuses.get(UC1), { id: "UC-001", kind: "use-case", status: "accepted" });
  assert.deepEqual(facts.statuses.get(UC2), { id: "UC-002", kind: "use-case", status: "open" });
  assert.deepEqual(facts.queues.map((q) => [q.folder, q.entries.map((e) => [e.number, e.state])]), [["docs/spec-freigaben/2026-03-01_waiting", [[1, "open"]]]]);
  assert.equal(facts.declaration.path, "docs/process.md");
  assert.equal(facts.declaration.fields.model, "scrum");
  assert.equal(facts.model.name, "scrum");
  assert.deepEqual(facts.workflow.phases.map((p) => p.name), ["Sprint Planning", "Development", "Sprint Review", "Sprint Retrospective"]);
  assert.equal(facts.workflow.model.name, "scrum");
  assert.equal(facts.modelUnread, null);
  assert.deepEqual(facts.participants.map((p) => [p.name, p.type]), [["alice", "person"], ["developer-a", "CLI agent"]]);
  assert.equal(facts.plan.order, null);
  assert.deepEqual(facts.plan.items.map((i) => i.id), ["ITM-001", "ITM-002", "ITM-003", "ITM-004"]);
  assert.deepEqual(facts.sprints.map((s) => s.path), ["docs/backlog/sprints/team1/01.md"]);
  assert.deepEqual(facts.assignments.map((a) => a.path), ["docs/role-assignments/team1.md"]);
  assert.deepEqual(facts.assignments[0].sections[0].rows.map((row) => [row.cells.Role, row.cells.Participants]),
    [["Product Owner", ["alice"]], ["Scrum Master", ["alice"]], ["Developers", ["developer-a"]]]);
  assert.deepEqual(facts.gates.map((g) => g.path), ["docs/gates/20261014-1000-development-sprint-review-a1b2.md"]);
  assert.deepEqual(facts.jobs.map((row) => [row.record.id, row.product, row.state]), [["JOB-20261014-0900-a1b2", "https://github.com/alice/product", "queued"]]);
  assert.deepEqual(facts.pullRequests.map((p) => p.number), [1, 2]);
});

// TST-536002 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: the fixture product
// input: productFacts(…, { scope: "work" })
// expect: exactly the fields address, info, snapshot, graph, requirements, statuses, queues, declaration, workflow, model, modelUnread, modelSince, participants, plan, sprints, assignments, held, modules, gates, gateStates, jobs, pullRequests, schedule, ci, tags, results, tests, resourceNeeds; and "unknown" in info, graph, requirements, modelSince, schedule, ci, tags, results, tests and resourceNeeds
test("productFacts, scope work — every fact the scope does not name is \"unknown\"", async () => {
  const facts = await work(fixture());
  assert.deepEqual(Object.keys(facts).sort(), ["address", "assignments", "ci", "declaration", "gateStates", "gates", "graph", "held", "info",
    "jobs", "model", "modelSince", "modelUnread", "modules", "own", "participants", "plan", "pullRequests", "queues", "requirements", "resourceNeeds",
    "resultCommits", "results", "schedule", "snapshot", "sprints", "statuses", "tags", "tests", "workflow"]);
  for (const field of ["info", "graph", "requirements", "modelSince", "schedule", "ci", "tags", "results", "resultCommits", "tests", "resourceNeeds"]) {
    assert.equal(facts[field], "unknown", field);
  }
});

// TST-536003 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-032
// given: the fixture product: ITM-001 (UC-001 accepted) with a merged pull request; ITM-002 (builds on ITM-001) with a queued job; ITM-003 realising the open UC-002; ITM-004 realising UC-001 with nothing else
// input: productFacts(…, { scope: "work" }).plan.states
// expect: in this order — ITM-001 done by pull request 1; ITM-002 in progress by job JOB-20261014-0900-a1b2; ITM-003 waiting for acceptance because "UC-002 is open, not accepted"; ITM-004 ready
test("productFacts, scope work — plan.states are derived with itemStates from the facts it read", async () => {
  const { plan } = await work(fixture());
  assert.deepEqual(plan.states, [
    { item: "ITM-001", state: "done", reason: null, job: null, pullRequest: "1" },
    { item: "ITM-002", state: "in progress", reason: "job JOB-20261014-0900-a1b2 is queued", job: "JOB-20261014-0900-a1b2", pullRequest: null },
    { item: "ITM-003", state: "waiting for acceptance", reason: "UC-002 is open, not accepted", job: null, pullRequest: null },
    { item: "ITM-004", state: "ready", reason: null, job: null, pullRequest: null },
  ]);
});

// TST-536004 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-049
// given: the fixture product: passed gate record for "Development → Sprint Review" naming docs/process.md at its current blob
// input: productFacts(…, { scope: "work" }).gateStates
// expect: "Development → Sprint Review" passed by the record docs/gates/20261014-1000-development-sprint-review-a1b2.md; "Sprint Retrospective → Sprint Planning" pending, needing "a decision by Product Owner"
test("productFacts, scope work — gateStates are derived from the gate records and the blobs the product holds now", async () => {
  const { gateStates } = await work(fixture());
  assert.deepEqual(gateStates, [
    { gate: "Development → Sprint Review", state: "passed", record: "docs/gates/20261014-1000-development-sprint-review-a1b2.md", needs: null, difference: null },
    { gate: "Sprint Retrospective → Sprint Planning", state: "pending", record: null, needs: "a decision by Product Owner", difference: null },
  ]);
});

// TST-536005 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-049
// given: the fixture product, whose gate record names docs/process.md at the blob 0…0, which is not the blob it holds now
// input: productFacts(…, { scope: "work" }).gateStates
// expect: "Development → Sprint Review" passed on an earlier text, its difference naming docs/process.md, checked 000000000000 and now the first twelve digits of the blob the product holds
test("productFacts, scope work — a gate record that names an earlier blob of its artifact gives passed on an earlier text", async () => {
  const files = productFiles();
  const path = "docs/gates/20261014-1000-development-sprint-review-a1b2.md";
  files[path] = files[path].replace(/docs\/process\.md@[0-9a-f]{40}/, `docs/process.md@${"0".repeat(40)}`);
  const { gateStates } = await work(fixture({ files }));
  assert.deepEqual(gateStates[0], { gate: "Development → Sprint Review", state: "passed on an earlier text", record: path,
    needs: "a decision on the current text", difference: `docs/process.md: checked 000000000000, now ${blobOf(files["docs/process.md"]).slice(0, 12)}` });
});

// ---------------------------------------------------------------- held

// TST-536006 · level: unit · module: MOD-progress-measures
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-032
// given: the fixture product; team1's sprint selects ITM-001, ITM-002 and ITM-004; ITM-001's pull request is merged into the default branch
// input: productFacts(…, { scope: "work" }).held, and the calls of the host
// expect: ITM-002 (changes MOD-pages, which uses MOD-store) and ITM-004 (changes MOD-store) are held, each by team1/01; ITM-001 is not; no containsCommit — no merged pull request of a held item is left undecided
test("productFacts, scope work — held is the items the teams' sprints hold, with the modules they change and use", async () => {
  const f = fixture();
  const { held } = await work(f);
  assert.deepEqual(held, [
    { item: "ITM-002", sprint: "team1/01", team: "team1", changes: ["MOD-pages"], uses: ["MOD-store"] },
    { item: "ITM-004", sprint: "team1/01", team: "team1", changes: ["MOD-store"], uses: [] },
  ]);
  assert.deepEqual(f.calls.filter((c) => c[0] === "containsCommit"), []);
});

// TST-1161005 · level: unit · module: MOD-progress-measures
// guards: SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product, whose architecture holds the module files MOD-store (uses nothing) and MOD-pages (uses MOD-store.read and MOD-store.write); a host that does server operations, and one that does none
// input: productFacts(…, { scope: "work" }) and productFacts(…, { scope: "all" }), for each of the two hosts; and productFacts(…, { scope: "build" }), which reads no sprint and computes no held
// expect: with the scope work and all, modules is the two module files as documents, in the order of their paths — docs/architecture/MOD-pages.md (id MOD-pages, uses MOD-store.read and MOD-store.write) and docs/architecture/MOD-store.md (id MOD-store, no uses) —, and no module file is read more than once; with the scope build, modules is empty, as held is, and no module file is read
test("productFacts — modules is the architecture's module files that held is computed with", async () => {
  for (const serverOperations of [true, false]) {
    for (const scope of ["work", "all"]) {
      const f = fixture({ serverOperations });
      const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
      assert.deepEqual(facts.modules.map((file) => [file.path, file.id, file.fields.uses ?? []]), [
        ["docs/architecture/MOD-pages.md", "MOD-pages", ["MOD-store.read", "MOD-store.write"]],
        ["docs/architecture/MOD-store.md", "MOD-store", []],
      ], `${scope}, server operations ${serverOperations}`);
      assert.deepEqual([...f.product.reads].filter(([path, count]) => path.startsWith("docs/architecture/") && count > 1), [], scope);
    }
  }
  const f = fixture();
  const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "build" });
  assert.deepEqual([facts.modules, facts.held], [[], []], "build: no module file is read, and no item is held");
  assert.deepEqual([...f.product.reads.keys()].filter((path) => path.startsWith("docs/architecture/")), [], "build");
});

// The pull requests of the held test below: ITM-001 merged into a sprint branch that reaches no main (head H1: undecided), ITM-002
// merged into main (head H2: decided by the chain), ITM-009 — in no sprint — merged into a side branch (head H9), ITM-004 open.
const UNDECIDED = [pr(1, "ITM-001", "sprint/team1/01", "merged", H1, "2026-10-13T10:00:00Z"), pr(2, "ITM-002", "main", "merged", H2, "2026-10-13T11:00:00Z"),
  pr(3, "ITM-009", "side", "merged", H9, "2026-10-13T12:00:00Z"), pr(4, "ITM-004", "main", "open", "a4".repeat(20))];

// TST-536007 · level: unit · module: MOD-progress-measures
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-032
// given: the pull requests UNDECIDED, so the only head commit undecidedHeads names is H1 (ITM-001's merge into a branch that reaches no main); a host whose default branch contains H1 (a), then none (b)
// input: productFacts(…, { scope: "work" }), and the containsCommit calls of the host
// expect: in both cases exactly one containsCommit call, ("main", H1) — not H2 (ITM-002's chain reaches main), not H9 (no held item names it); (a) held ITM-004 only: ITM-001's change is on the default branch; (b) held ITM-001 and ITM-004
test("productFacts, scope work — held asks containsCommit for exactly the heads undecidedHeads names", async () => {
  const a = fixture({ pullRequests: UNDECIDED, contained: new Set([H1]) });
  const heldA = (await work(a)).held;
  assert.deepEqual(a.calls.filter((c) => c[0] === "containsCommit"), [["containsCommit", "main", H1]]);
  assert.deepEqual(heldA.map((h) => h.item), ["ITM-004"]);

  const b = fixture({ pullRequests: UNDECIDED, contained: new Set() });
  const heldB = (await work(b)).held;
  assert.deepEqual(b.calls.filter((c) => c[0] === "containsCommit"), [["containsCommit", "main", H1]]);
  assert.deepEqual(heldB.map((h) => h.item), ["ITM-001", "ITM-004"]);
});

// ---------------------------------------------------------------- built by

const B1 = "b1".repeat(20), B2 = "b2".repeat(20);
// The fixture product, with ITM-001 built by B1 and ITM-004 built by B1 and B2 — no pull request names either.
function builtByFiles() {
  const files = productFiles();
  const withBuiltBy = (text, commits) => text.replace(/\n---\n# /, `\nbuilt_by:\n${commits.map((c) => `  - ${c}`).join("\n")}\n---\n# `);
  files["docs/backlog/ITM-001-store.md"] = withBuiltBy(files["docs/backlog/ITM-001-store.md"], [B1]);
  files["docs/backlog/ITM-004-feed.md"] = withBuiltBy(files["docs/backlog/ITM-004-feed.md"], [B1, B2]);
  return files;
}

// TST-8109 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-032
// given: the fixture product with ITM-001 built by B1 and ITM-004 built by B1 and B2, and no pull request at all; a host with server operations, then one without (a clone)
// input: productFacts(…) with the scopes work, all and build, and the containsCommit calls of the host
// expect: in every scope no containsCommit call — the records decide, no request is made for them —; ITM-001 and ITM-004 done, each with pullRequest null, and ITM-002, which builds on ITM-001, in progress by its job, not waiting for ITM-001
test("productFacts — an item's built_by makes it done with no request", async () => {
  for (const serverOperations of [true, false]) {
    for (const scope of ["work", "all", "build"]) {
      const f = fixture({ files: builtByFiles(), pullRequests: [], serverOperations });
      const { plan } = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
      const at = `server operations ${serverOperations}, ${scope}`;
      assert.deepEqual(f.calls.filter((c) => c[0] === "containsCommit"), [], at);
      assert.deepEqual(plan.states.filter((s) => s.state === "done").map((s) => [s.item, s.pullRequest]), [["ITM-001", null], ["ITM-004", null]], at);
      assert.equal(plan.states.find((s) => s.item === "ITM-002").state, "in progress", at);
    }
  }
});

// ---------------------------------------------------------------- once

// TST-536008 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: the fixture product, a host and an instance that record their calls and reads
// input: one productFacts(…, { scope: "work" })
// expect: the host is asked once for the repository's information, once for the snapshot of "main", once for the pull requests; instanceAt is asked once, for the commit 5…5 the declaration names; no file of the product and no file of the instance is read twice
test("productFacts, scope work — each fact is read once", async () => {
  const f = fixture();
  await work(f);
  assert.deepEqual(f.calls, [["repositoryInfo"], ["readSnapshot", "main"], ["listPullRequests"]]);
  assert.deepEqual(f.asked, [MODEL_VERSION]);
  assert.deepEqual([...f.product.reads].filter(([, count]) => count > 1), []);
  assert.deepEqual([...f.instance.reads].filter(([, count]) => count > 1), []);
  assert.ok(f.product.reads.size > 10, "the product's files were read");
  assert.deepEqual([...f.instance.reads.keys()].sort(), ["SPEC.md", "docs/participants.md"]);
});

// ---------------------------------------------------------------- the model cannot be read

// TST-536009 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-049
// given: the fixture product, whose instanceAt fails with an error named NotFound, TokenRefused, PermissionMissing or Unreachable
// input: productFacts(…, { scope: "work" }) for each of the four
// expect: it does not fail; model and workflow "unknown"; modelUnread { commit: "5…5", error: <the name> }; gateStates []; the other facts as read — the participants alice and developer-a, the states of the four items as with the workflow (ITM-001 done, ITM-002 in progress, ITM-003 waiting for acceptance, ITM-004 ready)
test("productFacts, scope work — a commit instanceAt cannot read leaves model and workflow unknown and names the error", async () => {
  for (const name of ["NotFound", "TokenRefused", "PermissionMissing", "Unreachable"]) {
    const facts = await work(fixture({ instanceFailure: named(name, `${name}: the instance`) }));
    assert.equal(facts.model, "unknown", name);
    assert.equal(facts.workflow, "unknown", name);
    assert.deepEqual(facts.modelUnread, { commit: MODEL_VERSION, error: name });
    assert.deepEqual(facts.gateStates, []);
    assert.deepEqual(facts.participants.map((p) => p.name), ["alice", "developer-a"]);
    assert.deepEqual(facts.plan.states.map((s) => [s.item, s.state]), [["ITM-001", "done"], ["ITM-002", "in progress"],
      ["ITM-003", "waiting for acceptance"], ["ITM-004", "ready"]]);
  }
});

// TST-536010 · level: unit · module: MOD-progress-measures
// guards: UC-049
// given: the fixture product, whose instanceAt fails with a TypeError — a fault of the caller, no cause the module file names
// input: productFacts(…, { scope: "work" })
// expect: it rejects with that TypeError; known positive first — the same call with an instanceAt that works resolves
test("productFacts, scope work — an error of instanceAt that is none of the four causes is not hidden", async () => {
  assert.ok(await work(fixture()));
  await assert.rejects(work(fixture({ instanceFailure: new TypeError("instanceAt was misused") })), { name: "TypeError" });
});

// TST-536011 · level: unit · module: MOD-progress-measures
// guards: UC-049
// given: the fixture product with no docs/process.md
// input: productFacts(…, { scope: "work" })
// expect: declaration null, model null, workflow null, modelUnread null; instanceAt is not asked; gateStates []; the four items' states as before
test("productFacts, scope work — a product with no declaration has none, and instanceAt is not asked", async () => {
  const files = productFiles();
  delete files["docs/process.md"];
  const f = fixture({ files });
  const facts = await work(f);
  assert.equal(facts.declaration, null);
  assert.equal(facts.model, null);
  assert.equal(facts.workflow, null);
  assert.equal(facts.modelUnread, null);
  assert.deepEqual(f.asked, []);
  assert.deepEqual(facts.gateStates, []);
  assert.deepEqual(facts.plan.states.map((s) => s.state), ["done", "in progress", "waiting for acceptance", "ready"]);
});

// TST-536012 · level: unit · module: MOD-progress-measures
// guards: UC-049
// given: the fixture product whose declaration names the model file docs/process-models/nothing.md, which the instance's catalogue at that commit does not hold
// input: productFacts(…, { scope: "work" })
// expect: the declaration is read; model null and workflow null; modelUnread null — the commit was read, it holds no such model
test("productFacts, scope work — a declared model the catalogue does not hold is null, not unknown", async () => {
  const files = productFiles();
  files["docs/process.md"] = DECLARATION("docs/process-models/nothing.md");
  const facts = await work(fixture({ files }));
  assert.equal(facts.declaration.fields.model_file, "docs/process-models/nothing.md");
  assert.equal(facts.model, null);
  assert.equal(facts.workflow, null);
  assert.equal(facts.modelUnread, null);
});

// ---------------------------------------------------------------- a host without server operations

// TST-536013 · level: unit · module: MOD-progress-measures
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-049
// given: a host that does no server operations — repositoryInfo and listPullRequests fail with NotSupported — over the fixture product
// input: productFacts(…, { scope: "work" }), and the calls of the host
// expect: the snapshot is read at "HEAD", the branch the clone has checked out; pullRequests "unknown"; held is every selected item — ITM-001, ITM-002, ITM-004; plan.states ITM-001 and ITM-004 unknown (they need the pull requests), ITM-002 waiting for an item it builds on (ITM-001, which it builds on, is not done: its state is unknown), ITM-003 waiting for acceptance; containsCommit is not asked
test("productFacts, scope work — a host that does no server operations gives unknown pull requests and holds every selected item", async () => {
  const f = fixture({ serverOperations: false });
  const facts = await work(f);
  assert.deepEqual(f.calls, [["repositoryInfo"], ["readSnapshot", "HEAD"], ["listPullRequests"]]);
  assert.equal(facts.pullRequests, "unknown");
  assert.deepEqual(facts.held.map((h) => h.item), ["ITM-001", "ITM-002", "ITM-004"]);
  assert.deepEqual(facts.plan.states.map((s) => [s.item, s.state]), [["ITM-001", "unknown"], ["ITM-002", "waiting for an item it builds on"],
    ["ITM-003", "waiting for acceptance"], ["ITM-004", "unknown"]]);
});

// ---------------------------------------------------------------- the plan

// TST-536014 · level: unit · module: MOD-progress-measures
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: a product that keeps an implementation plan — docs/plan/order.md listing ITM-011 then ITM-010, both in the phase Development, and the step files docs/plan/ITM-010-… and ITM-011-… — and no file under docs/backlog/ITM-*
// input: productFacts(…, { scope: "work" }).plan
// expect: order is docs/plan/order.md; items ITM-010 and ITM-011; states in the plan's order, ITM-011 then ITM-010, both ready
test("productFacts, scope work — a product with a plan has its steps and order; the states follow the order", async () => {
  const files = productFiles();
  for (const path of Object.keys(files)) if (/^docs\/backlog\/ITM-/.test(path)) delete files[path];
  files["docs/backlog/sprints/team1/01.md"] = sprintRecord(["ITM-010"]);
  files["docs/plan/ITM-010-store.md"] = item("ITM-010", { realises: ["UC-001"], modules: ["MOD-store"] });
  files["docs/plan/ITM-011-pages.md"] = item("ITM-011", { realises: ["UC-001"], modules: ["MOD-pages"] });
  files["docs/plan/order.md"] = ["# Order of the plan", "", "## Order", "", "| Step | Phase |", "|---|---|", "| ITM-011 | Development |",
    "| ITM-010 | Development |", ""].join("\n");
  const { plan } = await work(fixture({ files, pullRequests: [] }));
  assert.equal(plan.order.path, "docs/plan/order.md");
  assert.deepEqual(plan.items.map((i) => i.id), ["ITM-010", "ITM-011"]);
  assert.deepEqual(plan.states.map((s) => [s.item, s.state]), [["ITM-011", "ready"], ["ITM-010", "ready"]]);
});

// ---------------------------------------------------------------- the scope all

// TST-536015 · level: unit · module: MOD-progress-measures
// guards: UC-049
// given: the fixture product, whose SPEC.md holds no requirement and which has no branch test-results (readSnapshot("test-results") fails with NotFound) and one tag v2026.1.0; known positive first — the scope work resolves
// input: productFacts(…) with the scope "all", and with no options (the default, "all"); and with the scope "everything"
// expect: both of the first resolve; requirements [] (SPEC.md holds none); tags [v2026.1.0 on the commit H1]; results null; graph "unknown" (the scope builds no trace graph); tests []; info.defaultBranch "main"; modelSince null (the history of docs/process.md is empty); schedule the book's default; ci with no run; resourceNeeds []; the host is asked once for the repository's information, for the snapshot of "main", for the pull requests, for the snapshot of "test-results", for the tags, for the CI runs of the head (the branch main and the commit of the snapshot) and for the history of docs/process.md from main without the changes; the scope "everything" rejects with a TypeError before the host is called
test("productFacts — the scope all adds the requirements, tests, results, tags, information, schedule, CI runs and resources; another scope is refused", async () => {
  assert.ok(await work(fixture()));
  for (const options of [{ scope: "all" }, undefined]) {
    const f = fixture();
    const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, options);
    assert.deepEqual(facts.requirements, []);
    assert.deepEqual(facts.tags, [{ name: "v2026.1.0", commit: H1 }]);
    assert.equal(facts.results, null);
    assert.equal(facts.graph, "unknown");
    assert.deepEqual(facts.tests, []);
    assert.equal(facts.info.defaultBranch, "main");
    assert.equal(facts.modelSince, null);
    assert.equal(facts.schedule.default, true);
    assert.deepEqual(facts.ci.runs, []);
    assert.deepEqual(facts.resourceNeeds, []);
    assert.deepEqual(f.calls, [["repositoryInfo"], ["readSnapshot", "main"], ["listPullRequests"], ["readSnapshot", "test-results"], ["listTags"],
      ["listCiRuns", { branch: "main", commit: "c".repeat(40) }], ["readHistory", "docs/process.md", { ref: "main", changes: false }]]);
  }
  const f = fixture();
  await assert.rejects(productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "everything" }), { name: "TypeError" });
  assert.deepEqual(f.calls, []);
});

// ---------------------------------------------------------------- resultCommits and own (ITM-809)
//
// MOD-progress-measures: "`resultCommits` the commits of the default branch that `results` holds records of (`runs/<commit>/`), newest first by
// the default branch's history (`readHistory`, `changes: false`), empty while there is no `results`, and `"unknown"` when that history cannot be
// read; `own` whether the product's repository is the instance's own, the repository of `instance`".
// Readings these tests state: a history that cannot be read is one that fails with a host's own errors — NotSupported, NotFound, TokenRefused,
// PermissionMissing, RateLimited or Unreachable; the scopes `work` and `build` read no `results`, so their resultCommits is "unknown"; the
// repository is the instance's own where its address is the address of the instance's snapshot.

const H3 = "a3".repeat(20);
const RESULT_FILES = { [`runs/${H1}/20261016-1000-commit-aaaa.md`]: "x", [`runs/${H2}/20261016-1000-commit-aaaa.md`]: "x",
  [`runs/${H2}/20261016-1100-pull-request-bbbb.md`]: "x", [`runs/${H9}/20261016-1000-commit-aaaa.md`]: "x", "README.md": "x" };
const all = (f) => productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "all" });
// The history of the whole repository (path null) that resultCommits are told from; the history of the declaration (modelSince) is another call.
const historyCalls = (f) => f.calls.filter((call) => call[0] === "readHistory" && call[1] === null);

// TST-809007 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: the fixture product with a branch test-results that holds records of the commits H1 (one), H2 (two) and H9 and a file README.md, and a default branch whose history, newest first, is H3, H2, H1 (H9 is on no branch of it, H3 has no record)
// input: productFacts(…, { scope: "all" }).resultCommits
// expect: [H2, H1] — each commit once, in the order of the history, only those with records under runs/<commit>/; the host's history is read once, for the whole repository (path null) from the default branch, without the changes: ["readHistory", null, { ref: "main", changes: false }]
test("productFacts, scope all — resultCommits are the commits of the default branch that the results hold records of, newest first", async () => {
  const f = fixture({ resultFiles: RESULT_FILES, history: [H3, H2, H1] });
  const facts = await all(f);
  assert.deepEqual(facts.resultCommits, [H2, H1]);
  assert.deepEqual(historyCalls(f), [["readHistory", null, { ref: "main", changes: false }]]);
  assert.equal(facts.results.paths.length, 5);
});

// TST-809008 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: the fixture product with no branch test-results (readSnapshot("test-results") fails with NotFound); (b) a branch test-results that holds no record of a commit
// input: productFacts(…, { scope: "all" }).resultCommits
// expect: (a) [] — and no history is read; (b) [] — the history holds commits, none of which has records
test("productFacts, scope all — resultCommits are empty while there is no results, or no record of a commit of the default branch", async () => {
  const a = fixture({ history: [H2] });
  assert.deepEqual((await all(a)).resultCommits, []);
  assert.deepEqual(historyCalls(a), []);
  const b = fixture({ resultFiles: { "README.md": "x", [`runs/${H9}/20261016-1000-commit-aaaa.md`]: "x" }, history: [H2, H1] });
  assert.deepEqual((await all(b)).resultCommits, []);
});

// TST-809009 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product with a branch test-results of records of H1, and (a) a history that fails with Unreachable; (b) with RateLimited; (c) with TokenRefused; (d) a host that does no server operations (the branch test-results is then "unknown" too); (e) a history that fails with a TypeError
// input: productFacts(…, { scope: "all" })
// expect: (a), (b), (c) resultCommits "unknown" and the other facts read as before (results the Snapshot of test-results); (d) resultCommits "unknown", results "unknown", and no history is asked; (e) productFacts rejects with the TypeError — an error that is no host's failure is not hidden
test("productFacts, scope all — resultCommits are \"unknown\" where the default branch's history cannot be read", async () => {
  const resultFiles = { [`runs/${H1}/20261016-1000-commit-aaaa.md`]: "x" };
  for (const name of ["Unreachable", "RateLimited", "TokenRefused"]) {
    const facts = await all(fixture({ resultFiles, historyFailure: named(name) }));
    assert.equal(facts.resultCommits, "unknown", name);
    assert.deepEqual(facts.results.paths, Object.keys(resultFiles), name);
  }
  const d = fixture({ resultFiles, history: [H1], serverOperations: false });
  const facts = await all(d);
  assert.equal(facts.resultCommits, "unknown");
  assert.equal(facts.results, "unknown");
  assert.deepEqual(historyCalls(d), []);
  await assert.rejects(all(fixture({ resultFiles, historyFailure: new TypeError("a bug") })), { name: "TypeError" });
});

// TST-809010 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: the fixture product with a branch test-results of records of H1 and a history H1
// input: productFacts(…, { scope: "work" }) and productFacts(…, { scope: "build" })
// expect: resultCommits "unknown" in both, the branch test-results is not asked for and no history is read
test("productFacts, scopes work and build — resultCommits are \"unknown\" and no history is read", async () => {
  for (const scope of ["work", "build"]) {
    const f = fixture({ resultFiles: { [`runs/${H1}/20261016-1000-commit-aaaa.md`]: "x" }, history: [H1] });
    const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
    assert.equal(facts.resultCommits, "unknown", scope);
    assert.deepEqual(historyCalls(f), [], scope);
    assert.deepEqual(f.calls.filter((call) => call[1] === "test-results"), [], scope);
  }
});

// TST-809011 · level: unit · module: MOD-progress-measures
// guards: WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; UC-046
// given: the instance's snapshot at https://github.com/alice/agent-m; (a) the product's snapshot at the same address; (b) at https://github.com/alice/product
// input: productFacts(…).own, in each scope
// expect: (a) true in the scopes all, work and build; (b) false in all three
test("productFacts — own is whether the product's repository is the instance's own", async () => {
  for (const scope of ["all", "work", "build"]) {
    for (const [web, expected] of [["https://github.com/alice/agent-m", true], ["https://github.com/alice/product", false]]) {
      const f = fixture({ productWeb: web });
      const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
      assert.equal(facts.own, expected, `${scope} ${web}`);
    }
  }
});

// ---------------------------------------------------------------- the scope build, and the overview of a commit stored (ITM-940)
//
// MOD-progress-measures (accepted blob 30691d42): "with the scope `build`, what `buildInProgress` takes and nothing else — the plan or the
// backlog, the job records and the pull requests"; "`productFacts` asks no job's live state: the rows of `jobs` give the state of the record"; "`publishOverview(host, snapshot,
// facts)` — adds `<commit>.json` to the branch `overview-cache` by `commitFiles`, on the head it read: the stage shares and what waits for a
// person, from `facts` read with the scope `all` at the snapshot's commit. `written` is `false` when the branch holds the file already.
// … fails as `commitFiles` fails, with `NotFound` naming the branch when the repository has none."; "`storedOverview(snapshot)` — the overview
// stored for the snapshot's commit, read with the snapshot's `readOn` in one request; `null` when the branch or the file is missing or holds
// another format." Data: `<commit>.json` … `{ commit, shares, waiting }`.
// Readings these tests state (the pull request names them):
//   - productFacts takes no bridges and asks no job's live state in any scope: the fifth argument is the options, and a job's row gives the state its record gives.
//   - The scope `build` takes the approval statuses, which are derived from the tree's paths and blobs and read no file, so that an item's state is
//     what the scope `all` gives it where no change queue and no gate holds it back; it reads neither the queues, the declaration, the sprints, the
//     role assignments, the gate records, the module files, nor the SPEC, the tests, the results, the tags or the information. The facts it reads not are
//     "unknown" where the Facts type allows it, else empty.
//   - A file of the stored overview is `{ commit, shares, waiting }` as JSON and a line end; one of another shape, or naming another commit, is another format.

import * as measures from "../src/progress-measures/index.mjs";

const TEST_FILE = "tests/unit.test.mjs";
const withTests = () => ({ ...productFiles(), [TEST_FILE]: "// TST-001 · level: unit · module: MOD-store\n// guards: FIRST RULE\ntest(\"a\", () => {});\n" });
const build = (f) => productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "build" });
const readPaths = (f) => [...f.product.reads.keys()].sort();
const COMMIT = "c".repeat(40), OVERVIEW_HEAD = "0".repeat(39) + "1";

// TST-940001 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product with a test file
// input: productFacts(…, { scope: "build" }); and, as a known positive, the same product with the scope "all"
// expect: the product's files read are exactly the four backlog items, the job record, the change queue (its index and decisions files, and the SPEC.md they stand against), the declaration docs/process.md and the gate record — no use case, no decision or module file, no test file, no sprint, no role assignment; the host is asked repositoryInfo, readSnapshot("main") and listPullRequests, and nothing else (no tags, no test-results, no containsCommit); instanceAt is asked once, for the commit the declaration names, and the instance's docs/participants.md is not read. The scope "all" reads the test file too
test("TST-940001 productFacts, scope build — reads the plan or backlog, the job records, the pull requests, the change queues and the gate records, and no use case, decision, test or other file", async () => {
  const f = fixture({ files: withTests() });
  const facts = await build(f);
  assert.deepEqual(readPaths(f), ["SPEC.md", "docs/backlog/ITM-001-store.md", "docs/backlog/ITM-002-pages.md", "docs/backlog/ITM-003-mail.md", "docs/backlog/ITM-004-feed.md",
    "docs/gates/20261014-1000-development-sprint-review-a1b2.md", "docs/jobs/JOB-20261014-0900-a1b2.md", "docs/process.md",
    "docs/spec-freigaben/2026-03-01_waiting/entscheidungen.md", "docs/spec-freigaben/2026-03-01_waiting/index.md"]);
  assert.deepEqual(f.calls, [["repositoryInfo"], ["readSnapshot", "main"], ["listPullRequests"]]);
  assert.deepEqual(f.asked, [MODEL_VERSION]);
  assert.equal(f.instance.reads.has("docs/participants.md"), false);
  assert.deepEqual(facts.pullRequests.map((p) => p.number), [1, 2]);
  assert.deepEqual(facts.jobs.map((row) => row.record.id), ["JOB-20261014-0900-a1b2"]);
  assert.deepEqual(facts.gateStates.map((state) => [state.gate, state.state]), [["Development → Sprint Review", "passed"], ["Sprint Retrospective → Sprint Planning", "pending"]]);

  const every = fixture({ files: withTests() });
  await productFacts(every.host, every.instance, every.instanceAt, NOW, { scope: "all" });
  assert.equal(every.product.reads.has(TEST_FILE), true, "known positive: the scope all reads the test file");
});

// TST-940002 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: the fixture product (ITM-001 merged, ITM-002 under way by a queued job, ITM-003 realising the open UC-002, ITM-004 ready)
// input: buildInProgress of the facts read with the scope "build", and of the facts read with the scope "all"
// expect: both lists are the same and hold one row, for ITM-002 and the job JOB-20261014-0900-a1b2; the plan's states from the scope "build" are those of the scope "all": ITM-001 done, ITM-002 in progress, ITM-003 waiting for acceptance, ITM-004 ready
test("TST-940002 buildInProgress gives the same list from the facts of the scope build as from those of the scope all", async () => {
  const small = await build(fixture({ files: withTests() }));
  const every = fixture({ files: withTests() });
  const all = await productFacts(every.host, every.instance, every.instanceAt, NOW, { scope: "all" });
  const rows = measures.buildInProgress(small);
  assert.deepEqual(rows.map((row) => [row.item, row.job]), [["ITM-002", "JOB-20261014-0900-a1b2"]]);
  assert.deepEqual(rows, measures.buildInProgress(all));
  assert.deepEqual(small.plan.states.map((s) => [s.item, s.state]), all.plan.states.map((s) => [s.item, s.state]));
  assert.deepEqual(small.plan.states.map((s) => [s.item, s.state]), [["ITM-001", "done"], ["ITM-002", "in progress"], ["ITM-003", "waiting for acceptance"], ["ITM-004", "ready"]]);
});

// TST-940003 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product
// input: productFacts(…, { scope: "build" })
// expect: the same fields as the scope "work" has; info, requirements, tags, results and tests are "unknown", graph "unknown"; the model is scrum (read for the gates); a host that does no server operations gives unknown pull requests, the states that need them unknown (ITM-001, ITM-004), ITM-002 waiting for ITM-001, and no row of the build
test("TST-940003 productFacts, scope build — the facts it does not read are unknown, and a host without server operations gives unknown pull requests", async () => {
  const facts = await build(fixture());
  assert.deepEqual(Object.keys(facts).sort(), Object.keys(await work(fixture())).sort());
  for (const field of ["info", "graph", "requirements", "modelSince", "schedule", "ci", "tags", "results", "tests", "resourceNeeds"]) {
    assert.equal(facts[field], "unknown", field);
  }
  assert.equal(facts.model.name, "scrum");
  const bare = await build(fixture({ serverOperations: false }));
  assert.equal(bare.pullRequests, "unknown");
  assert.deepEqual(bare.plan.states.map((s) => [s.item, s.state]), [["ITM-001", "unknown"], ["ITM-002", "waiting for an item it builds on"], ["ITM-003", "waiting for acceptance"], ["ITM-004", "unknown"]]);
  assert.deepEqual(measures.buildInProgress(bare), [], "nothing is guessed: ITM-001's state is unknown, so ITM-002 is not listed");
});

// A product whose one change queue targets the use case UC-001 itself: its entry 01 is open, and ITM-002 (a job queued) realises UC-001.
function queuedFiles() {
  const files = withTests();
  files["docs/spec-freigaben/2026-03-01_waiting/index.md"] = QUEUE_INDEX.replaceAll("`SPEC.md`", `\`${UC1}\``);
  return files;
}

// TST-940008 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product in which an open change queue (entry 01, state open) targets UC-001, which ITM-002 realises, and a job of ITM-002 is queued
// input: productFacts(…, { scope: "build" }) and productFacts(…, { scope: "all" }); buildInProgress of each
// expect: ITM-002 is "waiting for acceptance" with the reason that UC-001 is still in the queue 2026-03-01_waiting#1, in both; buildInProgress gives [] in both — a step held back by a change queue is not in the build
test("TST-940008 a step a change queue holds back is not in the build, in the scope build as in the scope all", async () => {
  const small = await build(fixture({ files: queuedFiles() }));
  const every = fixture({ files: queuedFiles() });
  const all = await productFacts(every.host, every.instance, every.instanceAt, NOW, { scope: "all" });
  for (const facts of [small, all]) {
    const state = facts.plan.states.find((each) => each.item === "ITM-002");
    assert.equal(state.state, "waiting for acceptance");
    assert.match(state.reason, /UC-001 is still in docs\/spec-freigaben\/2026-03-01_waiting#1/);
    assert.deepEqual(measures.buildInProgress(facts), []);
  }
  assert.deepEqual(small.plan.states.map((s) => [s.item, s.state]), all.plan.states.map((s) => [s.item, s.state]));
});

// A product that keeps a plan: ITM-010, realising the accepted UC-001, in the phase Sprint Review, with a job queued for it and no record of the gate "Development → Sprint Review" (its record is not held).
function gatedFiles() {
  const files = withTests();
  for (const path of Object.keys(files)) if (/^docs\/backlog\/ITM-|^docs\/gates\//.test(path)) delete files[path];
  files["docs/backlog/sprints/team1/01.md"] = sprintRecord(["ITM-010"]);
  files["docs/plan/ITM-010-store.md"] = item("ITM-010", { realises: ["UC-001"], modules: ["MOD-store"] });
  files["docs/plan/order.md"] = ["# Order of the plan", "", "## Order", "", "| Step | Phase |", "|---|---|", "| ITM-010 | Sprint Review |", ""].join("\n");
  files["docs/jobs/JOB-20261014-0900-a1b2.md"] = JOB.replace("ITM-002", "ITM-010");
  return files;
}

// TST-940009 · level: unit · module: MOD-progress-measures
// guards: STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a product with a plan whose step ITM-010 (UC-001 accepted) is in the phase Sprint Review, a job queued for it, and no record of the gate "Development → Sprint Review", which stands before that phase
// input: productFacts(…, { scope: "build" }) and productFacts(…, { scope: "all" }); buildInProgress of each
// expect: ITM-010 is "waiting" in both, the reason naming the gate "Development → Sprint Review", decided by Product Owner; buildInProgress gives [] in both — a step a gate holds back is not in the build; with the gate record present (known positive) ITM-010 is "in progress" in both and buildInProgress lists it
test("TST-940009 a step a gate holds back is not in the build, in the scope build as in the scope all", async () => {
  const both = async (files) => {
    const every = fixture({ files });
    return [await build(fixture({ files })), await productFacts(every.host, every.instance, every.instanceAt, NOW, { scope: "all" })];
  };
  for (const facts of await both(gatedFiles())) {
    const state = facts.plan.states.find((each) => each.item === "ITM-010");
    assert.equal(state.state, "waiting");
    assert.match(state.reason, /Development → Sprint Review, decided by Product Owner/);
    assert.deepEqual(measures.buildInProgress(facts), []);
  }
  const files = gatedFiles();
  files["docs/gates/20261014-1000-development-sprint-review-a1b2.md"] = productFiles()["docs/gates/20261014-1000-development-sprint-review-a1b2.md"];
  for (const facts of await both(files)) {
    assert.equal(facts.plan.states.find((each) => each.item === "ITM-010").state, "in progress");
    assert.deepEqual(measures.buildInProgress(facts).map((row) => row.item), ["ITM-010"]);
  }
});

// An overview branch (a fake of a Snapshot of the branch `overview-cache`): its files by path, readOn counted.
function overviewBranch(files = {}) {
  const asked = [];
  return {
    asked, commit: OVERVIEW_HEAD, paths: Object.keys(files), ref: "overview-cache",
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => { asked.push(["read", path]); return files[path] ?? null; },
  };
}
// The host of a repository that holds the branch `overview-cache` (or none), recording every commitFiles.
function overviewHost(branch) {
  const commits = [];
  return {
    commits,
    async readSnapshot(ref) {
      if (ref !== "overview-cache") throw named("NotFound", `no snapshot of ${ref}`);
      if (branch === null) throw named("NotFound", "alice/product at overview-cache was not found.");
      return branch;
    },
    async commitFiles(change) { commits.push(change); return { commit: "9".repeat(40), url: "https://example.test/commit" }; },
  };
}
const allFacts = async (files) => { const f = fixture({ files }); return productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "all" }); };

// TST-940004 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product read with the scope "all" at the commit ccc…c; a repository whose branch overview-cache holds no file for that commit
// input: publishOverview(host, snapshot, facts)
// expect: { commit: "ccc…c", written: true }; exactly one commitFiles, on the branch "overview-cache", expectedHead the branch's head 00…01, five files: `ccc…c.json`, then the views of the progress and the backlog page (ITM-1260; their content is TST-1260011's) and of the schedule page (ITM-1265; its content is TST-1265002's), then latest.json (TST-940010's); `ccc…c.json`'s text is the JSON { commit, shares, waiting, model, build, queues } and a line end — shares the six stages in their order, waiting what waitingForAPerson gives, whose first two entries are UC-002 (open) and the open SPEC change entry; model the name of the facts' model or null; build { states, records } of the steps in progress that a job works on, with those jobs' records as the snapshot reads them; queues the facts' queues with an entry not in the SPEC — and no other file
test("TST-940004 publishOverview adds <commit>.json with the stage shares, what waits, the model, the build and the undecided queues, on the head it read", async () => {
  const facts = await allFacts(withTests());
  const host = overviewHost(overviewBranch());
  const done = await measures.publishOverview(host, facts.snapshot, facts);
  assert.deepEqual(done, { commit: COMMIT, written: true });
  assert.equal(host.commits.length, 1);
  assert.deepEqual([host.commits[0].branch, host.commits[0].expectedHead, host.commits[0].files.map((file) => file.path)], ["overview-cache", OVERVIEW_HEAD,
    [`${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`, `${COMMIT}.schedule.json.gz`, "latest.json"]]);
  const stored = JSON.parse(host.commits[0].files[0].text);
  assert.equal(host.commits[0].files[0].text.endsWith("}\n"), true);
  assert.deepEqual(Object.keys(stored), ["commit", "shares", "waiting", "model", "build", "queues"]);
  assert.equal(stored.model, typeof facts.model?.name === "string" ? facts.model.name : null);
  const inProgress = facts.plan.states.filter((state) => state.state === "in progress" && facts.jobs.some((row) => row.record.id === state.job));
  assert.deepEqual(stored.build.states, JSON.parse(JSON.stringify(inProgress)));
  const records = [...new Set(inProgress.map((state) => facts.jobs.find((row) => row.record.id === state.job).record.path))];
  assert.deepEqual(stored.build.records, await Promise.all(records.map(async (path) => ({ path, text: await facts.snapshot.read(path) }))));
  assert.deepEqual(stored.queues, JSON.parse(JSON.stringify(facts.queues.filter((queue) => queue.entries.some((entry) => entry.state !== "in SPEC")))));
  assert.ok(stored.queues.length > 0, "known positive: the fixture's waiting queue is held");
  assert.equal(stored.commit, COMMIT);
  assert.deepEqual(stored.shares.map((entry) => entry.stage), ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"]);
  assert.deepEqual(stored.shares, JSON.parse(JSON.stringify(await measures.stageShares(facts))));
  assert.deepEqual(stored.waiting, measures.waitingForAPerson(facts));
  assert.deepEqual(stored.waiting.slice(0, 2).map((entry) => [entry.kind, entry.id]), [["use case", "UC-002"], ["SPEC change", "spec-2026-03-01_waiting-01"]]);
});

// TST-940005 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the same facts; a branch overview-cache that holds ccc…c.json and the three views of ccc…c already (ITM-1260, ITM-1265); and a repository with no branch overview-cache
// input: publishOverview twice (the files held; no branch)
// expect: the first gives { commit: "ccc…c", written: false } and sends no commitFiles — the files are left as they are; the second rejects with an error named NotFound that names the branch
test("TST-940005 publishOverview leaves a file the branch holds as it is, and fails with NotFound naming a missing branch", async () => {
  const facts = await allFacts(withTests());
  const held = overviewHost(overviewBranch({ [`${COMMIT}.json`]: "{}\n", [`${COMMIT}.progress.json.gz`]: "", [`${COMMIT}.backlog.json.gz`]: "", [`${COMMIT}.schedule.json.gz`]: "" }));
  assert.deepEqual(await measures.publishOverview(held, facts.snapshot, facts), { commit: COMMIT, written: false });
  assert.deepEqual(held.commits, []);
  await assert.rejects(measures.publishOverview(overviewHost(null), facts.snapshot, facts), (error) => error.name === "NotFound" && /overview-cache/.test(error.message));
});

// A snapshot of the product (its commit ccc…c) whose readOn is the one the test gives, counted.
function withReadOn(readOn) {
  const calls = [];
  return { calls, snapshot: { commit: COMMIT, paths: [], blob: () => null, read: async (path) => { calls.push(["read", path]); return null; },
    readOn: async (branch, path) => { calls.push(["readOn", branch, path]); return readOn(branch, path); } } };
}

// TST-940006 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the overview that TST-940004 stores, served by the snapshot's readOn
// input: storedOverview(snapshot)
// expect: { shares, waiting, model, build, queues } as stored — the same lists publishOverview wrote —; exactly one request, readOn("overview-cache", "ccc…c.json"), and no read
test("TST-940006 storedOverview reads the overview of the snapshot's commit with one readOn, and gives what it holds", async () => {
  const facts = await allFacts(withTests());
  const host = overviewHost(overviewBranch());
  await measures.publishOverview(host, facts.snapshot, facts);
  const text = host.commits[0].files[0].text;
  const held = withReadOn(() => text);
  const overview = await measures.storedOverview(held.snapshot);
  const { shares, waiting, model, build, queues } = JSON.parse(text);
  assert.deepEqual(overview, { shares, waiting, model, build, queues });
  assert.equal(overview.shares.length, 6);
  assert.deepEqual(held.calls, [["readOn", "overview-cache", `${COMMIT}.json`]]);
});

// TST-940007 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: snapshots whose readOn gives null (no branch or no file); text that is no JSON; JSON of another shape; an overview naming another commit; an overview of the earlier format, { commit, shares, waiting } without the model, the build and the queues; and a readOn that fails with NotFound (no branch)
// input: storedOverview of each
// expect: null for each — the branch or the file missing, or another format, is no failure
test("TST-940007 storedOverview gives null for a missing branch or file and for another format", async () => {
  const rest = { model: null, build: { states: [], records: [] }, queues: [] };
  const good = JSON.stringify({ commit: COMMIT, shares: [], waiting: [], ...rest });
  const cases = [() => null, () => "not json", () => "[]", () => JSON.stringify({ commit: COMMIT, shares: {}, waiting: [], ...rest }),
    () => JSON.stringify({ commit: "d".repeat(40), shares: [], waiting: [], ...rest }), () => JSON.stringify({ commit: COMMIT, shares: [], waiting: [] }),
    () => { throw named("NotFound", "no branch overview-cache"); }];
  for (const [at, readOn] of cases.entries()) assert.equal(await measures.storedOverview(withReadOn(readOn).snapshot), null, `case ${at}`);
  assert.deepEqual(await measures.storedOverview(withReadOn(() => good).snapshot), { shares: [], waiting: [], ...rest }, "known positive: a well-formed overview is returned");
});

// TST-940010 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product read with the scope "all" at the commit ccc…c; a branch overview-cache that holds no file for it; and one that holds ccc…c.json
// input: publishOverview to each
// expect: the first commit holds, last, latest.json whose text is {"commit":"ccc…c"} and a line end; the second — whose branch holds the overview and the three views (ITM-1260, ITM-1265) — sends no commit and gives written false, so latest.json is written only with an overview's files
test("TST-940010 publishOverview writes latest.json naming its commit with the files it adds, and not when it adds none", async () => {
  const facts = await allFacts(withTests());
  const latest = `${JSON.stringify({ commit: COMMIT })}\n`;
  const empty = overviewHost(overviewBranch());
  await measures.publishOverview(empty, facts.snapshot, facts);
  assert.deepEqual(empty.commits.map((commit) => commit.files.at(-1)), [{ path: "latest.json", text: latest }]);
  const held = overviewHost(overviewBranch({ [`${COMMIT}.json`]: "{}\n", [`${COMMIT}.progress.json.gz`]: "", [`${COMMIT}.backlog.json.gz`]: "", [`${COMMIT}.schedule.json.gz`]: "" }));
  assert.deepEqual(await measures.publishOverview(held, facts.snapshot, facts), { commit: COMMIT, written: false });
  assert.deepEqual(held.commits, []);
});

// TST-940011 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a snapshot of ccc…c whose readOn serves on overview-cache latest.json naming the older commit bbb…b and the overview TST-940004 stores, rewritten as bbb…b's; then readOns where latest.json is missing (null; NotFound), holds no JSON or no commit, or names bbb…b whose overview is missing (null; NotFound)
// input: latestOverview(snapshot) for each
// expect: the first gives { commit: "bbb…b", shares, waiting, model, build, queues } as stored, by two readOns — latest.json, then bbb…b.json — and no read; every other gives null
test("TST-940011 latestOverview gives the overview latest.json names with its commit, and null where latest.json or that overview is missing", async () => {
  const OLDER = "b".repeat(40);
  const facts = await allFacts(withTests());
  const host = overviewHost(overviewBranch());
  await measures.publishOverview(host, facts.snapshot, facts);
  const text = JSON.stringify({ ...JSON.parse(host.commits[0].files[0].text), commit: OLDER });
  const latest = JSON.stringify({ commit: OLDER });
  const served = (files) => (branch, path) => {
    assert.equal(branch, "overview-cache");
    const file = files[path];
    if (typeof file === "function") return file();
    return file ?? null;
  };
  const held = withReadOn(served({ "latest.json": latest, [`${OLDER}.json`]: text }));
  const { shares, waiting, model, build, queues } = JSON.parse(text);
  assert.deepEqual(await measures.latestOverview(held.snapshot), { commit: OLDER, shares, waiting, model, build, queues });
  assert.deepEqual(held.calls, [["readOn", "overview-cache", "latest.json"], ["readOn", "overview-cache", `${OLDER}.json`]]);
  const notFound = () => { throw named("NotFound", "no such file on overview-cache"); };
  const cases = [{ [`${OLDER}.json`]: text }, { "latest.json": notFound, [`${OLDER}.json`]: text }, { "latest.json": "not json", [`${OLDER}.json`]: text },
    { "latest.json": "{}", [`${OLDER}.json`]: text }, { "latest.json": latest }, { "latest.json": latest, [`${OLDER}.json`]: notFound }];
  for (const [at, files] of cases.entries()) assert.equal(await measures.latestOverview(withReadOn(served(files)).snapshot), null, `case ${at}`);
});

// TST-1070001 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product, with a job record that has not ended
// input: productFacts(host, instance, instanceAt, now, { scope: "all" }) and its parameters; and a host that fails on any request for a job's live state (none is made)
// expect: productFacts takes four required parameters and the options (no bridges), and the job's row gives the state its record gives, `queued`, with the source reachable
test("TST-1070001 productFacts takes no bridges and asks no job's live state: a job's row gives the state of its record", async () => {
  assert.equal(productFacts.length, 4);
  const f = fixture({ files: withTests() });
  const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "all" });
  const row = facts.jobs.find((each) => each.record.id === "JOB-20261014-0900-a1b2");
  assert.equal(row.state, "queued");
  assert.equal(row.source.reachable, true);
});

// ---------------------------------------------------------------- no facts file of a commit
//
// MOD-progress-measures (Data): the branch `overview-cache` holds `<commit>.json`, the views of the progress and the backlog page and `latest.json`; `publishOverview` "adds `<commit>.json`,
// `<commit>.progress.json.gz` and `<commit>.backlog.json.gz` to the branch `overview-cache` … A commit that adds any also writes `latest.json`"; and `productFacts` reads the product's files (Interfaces). No
// `<commit>.facts.json` is written, and none is asked for. (The two views are not built yet; their tests come with their item.)

const FACTS_FILE = `${COMMIT}.facts.json`;
const SPEC_RULE = "# Spec\n\n## 1. Section\n\n**FIRST RULE** *(Product Owner)*\nThe first rule holds.\n*Check:* `tests/unit.test.mjs`\n";
const storedFiles = () => ({ ...withTests(), "SPEC.md": SPEC_RULE });
const without = (facts) => { const { snapshot, ...rest } = facts; return rest; };
// A facts file in the old format 1 that lists nothing: planted on overview-cache, it would empty the facts of whoever took it.
const PLANTED = `${JSON.stringify({ format: 1, commit: COMMIT, declaration: null, order: null, items: [], sprints: [], assignments: [], gates: [], modules: [], queues: [], requirements: [], tests: [], jobs: [] })}\n`;
// A fixture whose default branch has readOn: it serves PLANTED for any path on overview-cache, and counts every call.
function plantedOn(files) {
  const f = fixture({ files });
  f.readOnCalls = [];
  f.product.readOn = async (branch, path) => { f.readOnCalls.push([branch, path]); if (branch === "overview-cache") return PLANTED; throw named("NotFound", "no such file"); };
  return f;
}

// TST-1175001 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product with the accepted SPEC requirement EVERY ARTIFACT HAS AN IDENTIFIER, whose reviewed statuses still name only UC-001; a merged ITM-1000 realising that requirement, the existing merged ITM-001 realising UC-001, and ITM-1001 realising the absent requirement A MISSING ACCEPTANCE RULE
// input: productFacts with scopes work, build and all over the files
// expect: in every scope, ITM-001 and ITM-1000 are done and ITM-1001 waits for acceptance with the literal reason "A MISSING ACCEPTANCE RULE is not accepted"; the public Facts.requirements remains "unknown" outside scope all, whose value is ["EVERY ARTIFACT HAS AN IDENTIFIER"]
test("TST-1175001 productFacts gives itemStates the accepted SPEC requirements without changing public statuses", async () => {
  const files = storedFiles();
  files["SPEC.md"] = [
    "# Spec",
    "",
    "**EVERY ARTIFACT HAS AN IDENTIFIER** *(Product Owner)*",
    "Each artifact has an identifier.",
    "*Check:* `tests/progress-measures-product-facts.test.mjs`",
    "",
  ].join("\n");
  files["docs/backlog/ITM-1000-identifier.md"] = item("ITM-1000", { realises: ["EVERY ARTIFACT HAS AN IDENTIFIER"], modules: ["MOD-store"] });
  files["docs/backlog/ITM-1001-missing.md"] = item("ITM-1001", { realises: ["A MISSING ACCEPTANCE RULE"], modules: ["MOD-store"] });
  const pullRequests = [...BASE_PULL_REQUESTS, pr(3, "ITM-1000", "main", "merged", H9, "2026-10-14T10:00:00Z")];
  for (const scope of ["work", "build", "all"]) {
    const f = fixture({ files, pullRequests });
    const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
    assert.deepEqual(facts.plan.states.filter((state) => ["ITM-001", "ITM-1000", "ITM-1001"].includes(state.item)).map((state) => [state.item, state.state, state.reason]), [
      ["ITM-001", "done", null],
      ["ITM-1000", "done", null],
      ["ITM-1001", "waiting for acceptance", "A MISSING ACCEPTANCE RULE is not accepted"],
    ], scope);
    assert.equal(facts.requirements === "unknown" ? "unknown" : facts.requirements.join(","), scope === "all" ? "EVERY ARTIFACT HAS AN IDENTIFIER" : "unknown", `${scope} requirements`);
    assert.deepEqual([facts.statuses.has("EVERY ARTIFACT HAS AN IDENTIFIER"), facts.statuses.get(UC1)?.status], [false, "accepted"], `${scope} public statuses`);
  }
  const withoutReviewedFiles = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith("docs/approvals/")));
  for (const scope of ["work", "build", "all"]) {
    const f = fixture({ files: withoutReviewedFiles, pullRequests });
    const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope });
    assert.deepEqual(facts.plan.states.filter((state) => ["ITM-1000", "ITM-1001"].includes(state.item)).map((state) => [state.item, state.state, state.reason]), [
      ["ITM-1000", "done", null],
      ["ITM-1001", "waiting for acceptance", "A MISSING ACCEPTANCE RULE is not accepted"],
    ], `${scope} without reviewed files`);
    assert.equal([...facts.statuses.values()].filter((status) => status.status === "accepted").length, 0, `${scope} preserves no accepted public statuses`);
  }
});

// TST-1117009 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product with a SPEC rule, a test file and a job record, read with the scope "all" at the commit ccc…c; a branch overview-cache that holds no file for it
// input: publishOverview(host, snapshot, facts)
// expect: { commit, written: true }; one commitFiles whose files are exactly `ccc…c.json`, the three views of the commit (ITM-1260, ITM-1265) and latest.json — no path ends in `.facts.json`; counter-proof: the overview `ccc…c.json` and latest.json are still added
test("TST-1117009 publishOverview adds no <commit>.facts.json, and still adds <commit>.json and latest.json", async () => {
  const facts = await allFacts(storedFiles());
  const host = overviewHost(overviewBranch());
  assert.deepEqual(await measures.publishOverview(host, facts.snapshot, facts), { commit: COMMIT, written: true });
  assert.equal(host.commits.length, 1);
  const paths = host.commits[0].files.map((file) => file.path);
  assert.deepEqual(paths.filter((path) => path.endsWith(".facts.json")), [], "no facts file is added");
  assert.deepEqual(paths, [`${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`, `${COMMIT}.schedule.json.gz`, "latest.json"], "counter-proof: the overview and latest.json are added");
});

// TST-1117010 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture product whose default branch's snapshot has a readOn that counts every call and serves, on overview-cache, a facts file of the old format 1 that lists nothing; and the same product without readOn
// input: productFacts with the scope "all", "work" and "build" for each (the scope "now" is withdrawn, ITM-1260)
// expect: in each scope, readOn is asked for no path ending in `.facts.json` and `read` reads none; the facts equal those of the product without readOn (the snapshot aside), the four backlog items among them, so the planted file is not taken; known positive: the counter records a readOn of `ccc…c.facts.json` when one is made
test("TST-1117010 productFacts asks for no <commit>.facts.json in any scope, and reads its facts from the files", async () => {
  for (const scope of ["all", "work", "build"]) {
    const counted = plantedOn(storedFiles());
    const plain = fixture({ files: storedFiles() });
    const got = await productFacts(counted.host, counted.instance, counted.instanceAt, NOW, { scope });
    const expected = await productFacts(plain.host, plain.instance, plain.instanceAt, NOW, { scope });
    assert.deepEqual(counted.readOnCalls.filter(([, path]) => path.endsWith(".facts.json")), [], `${scope}: no facts file is asked for`);
    assert.deepEqual(readPaths(counted).filter((path) => path.endsWith(".facts.json")), [], `${scope}: no facts file is read`);
    assert.deepEqual(without(got), without(expected), `${scope}: the facts are those of the files`);
    assert.equal(got.plan.items.length, 4, `${scope}: the backlog items are read from the files`);
    await counted.product.readOn("overview-cache", FACTS_FILE);
    assert.deepEqual(counted.readOnCalls.filter(([, path]) => path.endsWith(".facts.json")), [["overview-cache", FACTS_FILE]], `${scope}: known positive: the counter records a request`);
  }
});

// TST-843011 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: a product that saves docs/tests/schedule.md with the nightly time 03:30 and lists a compute resource on the route `bridge lab-pc` in docs/resources.md
// input: productFacts with the scope "all"
// expect: schedule is the saved one (nightly "03:30"), resourceNeeds [{ resource: "gpu-box", route: "bridge lab-pc" }] and ci.runs []; both files are read from the snapshot
test("TST-843011 the schedule and the resources are read from their files", async () => {
  const resources = ["# Resources of this product", "", "**REGISTER**", "", "The resources.", "",
    "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |", "|---|---|---|---|---|---|---|---|---|---|",
    "| gpu-box | compute | gpu01.example.org | — | — | — | bridge lab-pc | this machine | — | — |", ""].join("\n");
  const schedule = ["---", "nightly: 03:30", "---", "## Levels", "", "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |", "|---|---|---|---|---|---|---|",
    "| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |", "| component | ✓ | ✓ | ✓ | ✓ | ✓ | |", "| system | ✓ | ✓ | ✓ | ✓ | ✓ | |", "| paid | | | ✓ | ✓ | ✓ | |",
    "| release | | | | ✓ | ✓ | |", "| user | | | | ✓ | ✓ | |", ""].join("\n");
  const files = { ...storedFiles(), "docs/tests/schedule.md": schedule, "docs/resources.md": resources };
  const f = fixture({ files });
  const facts = await productFacts(f.host, f.instance, f.instanceAt, NOW, { scope: "all" });
  assert.equal(facts.schedule.fields.nightly, "03:30");
  assert.deepEqual(facts.resourceNeeds, [{ resource: "gpu-box", route: "bridge lab-pc" }]);
  assert.deepEqual(facts.ci.runs, []);
  assert.equal(f.product.reads.has("docs/tests/schedule.md") && f.product.reads.has("docs/resources.md"), true);
});

// TST-843012 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: the fixture product on a host that does no server operations (a Bridge's local clone): the CI runs refuse with NotSupported
// input: productFacts(…, { scope: "all" })
// expect: ci.runs is "unknown" and the rest of ci is read from the files (configured false, one difference: the generated file is missing); schedule, resourceNeeds and modelSince are read as before
test("TST-843012 a host that does no server operations leaves ci.runs unknown, and the rest of ci is read", async () => {
  const facts = await all(fixture({ serverOperations: false }));
  assert.equal(facts.ci.runs, "unknown");
  assert.deepEqual([facts.ci.configured, facts.ci.drift.map((each) => each.path)], [false, [".github/workflows/agent-m-tests.yml"]]);
  assert.deepEqual([facts.schedule.default, facts.resourceNeeds, facts.modelSince], [true, [], null]);
});
