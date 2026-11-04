// The stage a product is in, the build in progress and what waits for a person — MOD-progress-measures' currentStage,
// buildInProgress and waitingForAPerson, as the accepted text of docs/architecture/MOD-progress-measures.md states them:
// currentStage "the first stage that is not full"; buildInProgress "the steps or items in progress, each with the job working on it,
// its participant, state and elapsed time, jobs on Bridges included; a job whose runtime does not answer is listed as not
// reachable, with the state its record gives; a step or item leaves the list as done once its pull request is merged";
// waitingForAPerson "what waits for a person in the product: open use cases, open SPEC change entries, gates whose decider is a
// person and that are pending, failed jobs; `path` is the file or record it concerns". Of the module, these three alone.
// Run: node --test tests/progress-measures-build-and-waits.test.mjs
//
// Module: MOD-progress-measures
// Guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). The facts are held in memory, in the
// form of MOD-progress-measures' Facts (tests/progress-measures-facts.mjs); nothing is read from a document. `fetch` is replaced by
// a spy for every test and must not have been called when the test ends. The counter-proofs are recorded in the pull request.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildInProgress, currentStage, publishOverview, storedOverview, waitingForAPerson } from "../src/progress-measures/index.mjs";
import { itemStates } from "../src/work-plans/index.mjs";
import { COMMIT, facts, itemState, jobRow, queueOf, statusMap } from "./progress-measures-facts.mjs";

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

// ---------------------------------------------------------------- currentStage

const bar = (...shares) => ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"]
  .map((stage, i) => ({ stage, share: shares[i] }));

// TST-685010 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: bars of six shares: (a) 1, 1, 0.5, 0, 0, 0; (b) 1, 1, 1, null, 0.2, 0 (an unknown share); (c) 0.9, 1, 1, 1, 1, 1; (d) all 1; (e) 1, 1, 1, 1, 1, 0
// input: currentStage(bar)
// expect: (a) "Architecture"; (b) "Implementation" — an unknown share is not full; (c) "Requirements" — the first, though later ones are full; (d) null — no stage is left that is not full; (e) "Release"
test("currentStage — the first stage that is not full", () => {
  assert.equal(currentStage(bar(1, 1, 0.5, 0, 0, 0)), "Architecture");
  assert.equal(currentStage(bar(1, 1, 1, null, 0.2, 0)), "Implementation");
  assert.equal(currentStage(bar(0.9, 1, 1, 1, 1, 1)), "Requirements");
  assert.equal(currentStage(bar(1, 1, 1, 1, 1, 1)), null);
  assert.equal(currentStage(bar(1, 1, 1, 1, 1, 0)), "Release");
});

// ---------------------------------------------------------------- buildInProgress

const BUILD_STATES = [
  itemState("ITM-001", "done", { pullRequest: "1" }),
  itemState("ITM-002", "in progress", { job: "JOB-a", reason: "job JOB-a is running" }),
  itemState("ITM-003", "in progress", { job: "JOB-b", reason: "job JOB-b is running" }),
  itemState("ITM-004", "in progress", { pullRequest: "4", reason: "pull request 4 is open for review" }),
  itemState("ITM-005", "blocked", { job: "JOB-c", reason: "job JOB-c is failed" }),
  itemState("ITM-006", "ready"),
];
const BUILD_JOBS = [
  jobRow({ id: "JOB-a", participant: "developer-a", worksOn: ["ITM-002"], state: "running", elapsed: 125 }),
  jobRow({ id: "JOB-b", participant: "developer-b", worksOn: ["ITM-003"], state: "queued", elapsed: 40, reachable: false }),
  jobRow({ id: "JOB-c", participant: "developer-a", worksOn: ["ITM-005"], state: "failed", elapsed: 300 }),
];

// TST-685011 · level: unit · module: MOD-progress-measures
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046; UC-036
// given: six items in the plan's order — ITM-001 done by pull request 1; ITM-002 in progress by job JOB-a (developer-a, running, 125 s); ITM-003 in progress by job JOB-b on a Bridge that does not answer (developer-b, record says queued, 40 s); ITM-004 in progress by an open pull request with no job; ITM-005 blocked by a failed job; ITM-006 ready
// input: buildInProgress(facts)
// expect: exactly ITM-002 and ITM-003, in that order: { item, job, participant, state, elapsed, reachable } = ITM-002 JOB-a developer-a running 125 reachable true; ITM-003 JOB-b developer-b queued 40 reachable false — the state its record gives; nothing for the done, the blocked, the ready item or the item that has a pull request and no job
test("buildInProgress — the items in progress, each with its job, participant, state, elapsed time and whether its runtime answers", () => {
  assert.deepEqual(buildInProgress(facts({ plan: { order: null, items: [], states: BUILD_STATES }, jobs: BUILD_JOBS })), [
    { item: "ITM-002", job: "JOB-a", participant: "developer-a", state: "running", elapsed: 125, reachable: true },
    { item: "ITM-003", job: "JOB-b", participant: "developer-b", state: "queued", elapsed: 40, reachable: false },
  ]);
});

// TST-685012 · level: unit · module: MOD-progress-measures
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the six items of the test above, but ITM-002's pull request is now merged (ITM-002 done); (b) an item in progress whose job the facts' jobs do not hold; (c) no item
// input: buildInProgress of each
// expect: (a) only ITM-003 — the item left the list once its pull request was merged; (b) an empty list; (c) an empty list
test("buildInProgress — an item leaves the list once its pull request is merged; an item without a job row and an empty plan list nothing", () => {
  const merged = BUILD_STATES.map((s) => (s.item === "ITM-002" ? itemState("ITM-002", "done", { pullRequest: "2" }) : s));
  assert.deepEqual(buildInProgress(facts({ plan: { order: null, items: [], states: merged }, jobs: BUILD_JOBS })).map((b) => b.item), ["ITM-003"]);
  const missing = [itemState("ITM-009", "in progress", { job: "JOB-zz" })];
  assert.deepEqual(buildInProgress(facts({ plan: { order: null, items: [], states: missing }, jobs: BUILD_JOBS })), []);
  assert.deepEqual(buildInProgress(facts()), []);
});

// TST-864005 · level: unit · module: MOD-progress-measures
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the plan states MOD-work-plans' itemStates derives for three items whose job ended as done at 09:00 — ITM-010 with no pull request yet, ITM-011 with a pull request opened at 10:00 and open, ITM-012 with one opened at 10:00 and merged
// input: buildInProgress(facts) over those states and the job rows
// expect: ITM-010 and ITM-011 each listed with their job, its state done, and the participant and elapsed time of its record; ITM-012 not listed — it leaves the list once its pull request is merged
test("buildInProgress — a step whose job ended as done is listed with state done until its pull request is merged", () => {
  const rows = [["JOB-d", "ITM-010"], ["JOB-e", "ITM-011"], ["JOB-f", "ITM-012"]].map(([id, item]) => {
    const row = jobRow({ id, participant: "developer-i", worksOn: [item], state: "done", elapsed: 90 });
    return { ...row, record: { ...row.record, start: new Date("2026-10-20T09:00:00Z") } };
  });
  const items = ["ITM-010", "ITM-011", "ITM-012"].map((id) => ({ kind: "item", path: `docs/backlog/${id}-x.md`, id,
    fields: { id, realises: [], builds_on: [] }, sections: [] }));
  const pull = (number, state) => ({ number, title: `ITM-0${number} work`, branch: `item/ITM-0${number}`, base: "main", head: "a".repeat(40),
    state, draft: false, url: `https://example.invalid/${number}`, opened: "2026-10-20T10:00:00Z",
    merged: state === "merged" ? "2026-10-20T11:00:00Z" : null, closed: null });
  const states = itemStates(items, null, { statuses: new Map(), queues: [], jobs: rows, pullRequests: [pull(11, "open"), pull(12, "merged")],
    gates: [], workflow: null });
  assert.deepEqual(states.map((s) => [s.item, s.state]), [["ITM-010", "in progress"], ["ITM-011", "in progress"], ["ITM-012", "done"]]);
  assert.deepEqual(buildInProgress(facts({ plan: { order: null, items, states }, jobs: rows })), [
    { item: "ITM-010", job: "JOB-d", participant: "developer-i", state: "done", elapsed: 90, reachable: true },
    { item: "ITM-011", job: "JOB-e", participant: "developer-i", state: "done", elapsed: 90, reachable: true },
  ]);
});

// ---------------------------------------------------------------- waitingForAPerson

const role = (name, ...holders) => ({ cells: { Role: name, Participants: holders } });
const gate = (name, decider) => ({ name, from: "A", to: "B", artifacts: "x", condition: "y", decider, addedBy: null, practice: null });
const pending = (name) => ({ gate: name, state: "pending", record: null, needs: "a decision", difference: null });

const WAIT = {
  statuses: statusMap([
    ["docs/use-cases/UC-001-a.md", "UC-001", "use-case", "accepted"],
    ["docs/use-cases/UC-002-b.md", "UC-002", "use-case", "open"],
    ["docs/use-cases/UC-003-c.md", "UC-003", "use-case", "changed"],
    ["docs/architecture/ARC-001-d.md", "ARC-001", "architecture-decision", "open"],
    ["docs/architecture/MOD-e.md", "MOD-e", "module", "changed"],
  ]),
  queues: [queueOf("docs/spec-freigaben/2026-10-01_a", [[1, "open"], [2, "in SPEC"], [3, "stale"], [4, "approved"]])],
  declaration: { path: "docs/process.md", fields: {} },
  workflow: { gates: [gate("Development → Sprint Review", "Product Owner"), gate("Sprint Retrospective → Sprint Planning", "Scrum Master"),
    gate("Review → Release", "Product Owner"), gate("Build → Test", "check: CI"), gate("Plan → Build", "Product Owner")] },
  gateStates: [pending("Development → Sprint Review"), pending("Sprint Retrospective → Sprint Planning"), pending("Review → Release"),
    pending("Build → Test"), { gate: "Plan → Build", state: "passed", record: "docs/gates/x.md", needs: null, difference: null }],
  assignments: [{ path: "docs/role-assignments/team1.md", sections: [{ rows: [role("Product Owner", "alice", "po-agent"), role("Scrum Master", "sm-agent")] }] }],
  participants: [{ name: "alice", type: "person" }, { name: "po-agent", type: "CLI agent" }, { name: "sm-agent", type: "CLI agent" }],
  jobs: [
    jobRow({ id: "JOB-w", state: "waiting at a gate", gates: [{ gate: "Development → Sprint Review", decider: "Product Owner", resumedBy: null }] }),
    jobRow({ id: "JOB-f", state: "failed" }),
    jobRow({ id: "JOB-r", state: "running" }),
  ],
};

// TST-685013 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046; UC-047
// given: use cases UC-001 accepted, UC-002 open and UC-003 changed since its acceptance; an architecture decision and a module file that are not accepted; a queue with one entry open, one in SPEC, one stale and one approved; a workflow of five gates — "Development → Sprint Review" (Product Owner) pending and awaited by the waiting job JOB-w, "Sprint Retrospective → Sprint Planning" (Scrum Master) pending, "Review → Release" (Product Owner) pending with no job at it, "Build → Test" decided by the check CI, pending, "Plan → Build" (Product Owner) passed; the Product Owner role held by alice, a person, and po-agent, an agent; the Scrum Master role held by an agent only; jobs JOB-w waiting at a gate, JOB-f failed, JOB-r running
// input: waitingForAPerson(facts)
// expect: in this order — use case UC-002 at its file; use case UC-003 at its file; SPEC change spec-2026-10-01_a-01 at its proposal; gate "Development → Sprint Review" at the record of JOB-w, the job waiting at it; gate "Review → Release" at docs/process.md, where it is declared; failed job JOB-f at its record — and nothing for the accepted use case, the architecture files, the entries in SPEC, stale or approved, the gate an agent decides, the check's gate, the passed gate or the running job
test("waitingForAPerson — open use cases, open SPEC changes, pending gates a person decides, and failed jobs, each with the path it concerns", () => {
  assert.deepEqual(waitingForAPerson(facts(WAIT)), [
    { kind: "use case", id: "UC-002", path: "docs/use-cases/UC-002-b.md" },
    { kind: "use case", id: "UC-003", path: "docs/use-cases/UC-003-c.md" },
    { kind: "SPEC change", id: "spec-2026-10-01_a-01", path: "docs/spec-freigaben/2026-10-01_a/01-section.md" },
    { kind: "gate", id: "Development → Sprint Review", path: "docs/jobs/JOB-w.md" },
    { kind: "gate", id: "Review → Release", path: "docs/process.md" },
    { kind: "failed job", id: "JOB-f", path: "docs/jobs/JOB-f.md" },
  ]);
});

// TST-685014 · level: unit · module: MOD-progress-measures
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: (a) the facts of the test above whose workflow could not be read ("unknown"); (b) the same with no workflow (null); (c) a product with nothing that waits
// input: waitingForAPerson of each
// expect: (a) and (b) the use cases, the SPEC change and the failed job, and no gate — a gate cannot be told without the workflow; (c) an empty list
test("waitingForAPerson — without a workflow no gate waits; with nothing waiting the list is empty", () => {
  const ids = (f) => waitingForAPerson(f).map((w) => w.kind === "use case" || w.kind === "SPEC change" || w.kind === "failed job" ? w.id : "gate");
  const expected = ["UC-002", "UC-003", "spec-2026-10-01_a-01", "JOB-f"];
  assert.deepEqual(ids(facts({ ...WAIT, workflow: "unknown" })), expected);
  assert.deepEqual(ids(facts({ ...WAIT, workflow: null })), expected);
  assert.deepEqual(waitingForAPerson(facts()), []);
});

// ---------------------------------------------------------------- the overview stored for a commit: what the pages read in place of the files

// TST-943101 · level: unit · module: MOD-progress-measures
// guards: THE BUILD IS SHOWN AS IT HAPPENS; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the six items of the build above with their job rows, the records of JOB-a and JOB-b as the commit's files, the model "scrum", and three change queues — one whose entries are all in the SPEC, one with an open entry, one with a stale entry; a branch overview-cache that holds nothing yet, whose commitFiles is recorded; then a snapshot of the commit whose readOn answers the text committed
// input: publishOverview(host, snapshot, facts); then storedOverview(snapshot) twice
// expect: one commit of `<commit>.json`, the three views of the commit (ITM-1260, ITM-1265) and latest.json; the overview holds the model "scrum", the build's states of ITM-002 and ITM-003 alone (in progress with a job; not ITM-004, in progress without one), the records of JOB-a and JOB-b with the commit's texts, and the two queues with an entry not in the SPEC; storedOverview gives the same model, build and queues — and buildInProgress over the stored states and the job rows gives the rows it gives over the facts —, read with one readOn for both calls; counter-proof: an overview text without the build is none (null)
test("publishOverview stores the model, the build with its jobs' records and the undecided queues, and storedOverview reads them back once", async () => {
  const RECORDS = { "docs/jobs/JOB-a.md": "record of JOB-a\n", "docs/jobs/JOB-b.md": "record of JOB-b\n" };
  const queues = [queueOf("docs/spec-freigaben/2026-10-01_done", [[1, "in SPEC"]]), queueOf("docs/spec-freigaben/2026-10-02_open", [[1, "in SPEC"], [2, "open"]]),
    queueOf("docs/spec-freigaben/2026-10-03_stale", [[1, "stale"]])];
  const given = facts({ plan: { order: null, items: [], states: BUILD_STATES }, jobs: BUILD_JOBS, queues, model: { name: "scrum" } });
  const snapshot = { commit: COMMIT, paths: Object.keys(RECORDS), blob: () => null, read: async (path) => RECORDS[path] ?? null };
  const commits = [];
  const host = { readSnapshot: async () => ({ commit: "0".repeat(40), paths: [] }), commitFiles: async (change) => { commits.push(change); } };
  await publishOverview(host, snapshot, given);
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files.map((file) => file.path).sort(), [`${COMMIT}.backlog.json.gz`, `${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.schedule.json.gz`, "latest.json"]);
  const text = commits[0].files.find((file) => file.path === `${COMMIT}.json`).text;
  const held = JSON.parse(text);
  assert.equal(held.model, "scrum");
  assert.deepEqual(held.build.states.map((state) => state.item), ["ITM-002", "ITM-003"]);
  assert.deepEqual(held.build.records, [{ path: "docs/jobs/JOB-a.md", text: "record of JOB-a\n" }, { path: "docs/jobs/JOB-b.md", text: "record of JOB-b\n" }]);
  assert.deepEqual(held.queues.map((queue) => queue.folder), ["docs/spec-freigaben/2026-10-02_open", "docs/spec-freigaben/2026-10-03_stale"]);

  const reads = [];
  const at = { commit: COMMIT, readOn: async (branch, path) => { reads.push([branch, path]); return text; } };
  const [first, second] = [await storedOverview(at), await storedOverview(at)];
  assert.equal(first, second);
  assert.deepEqual(reads, [["overview-cache", `${COMMIT}.json`]]);
  assert.deepEqual([first.model, first.build, first.queues], [held.model, held.build, held.queues]);
  assert.deepEqual(buildInProgress(facts({ plan: { order: null, items: [], states: first.build.states }, jobs: BUILD_JOBS })),
    buildInProgress(given));
  const before = { commit: COMMIT, readOn: async () => JSON.stringify({ commit: COMMIT, shares: held.shares, waiting: held.waiting }) };
  assert.equal(await storedOverview(before), null);
});
