// An item whose job a rejected gate ended is ready again, with the rejection's reason (ITM-1416) — MOD-work-plans' itemStates, for UC-034 7a ("The gate's decider rejects. The gate record states the rejection and its reason.
// The job ends, and the item returns to *ready* with the reason attached") and UC-024 10a. The job's End is the one ITM-1412 writes: `failed`, its reason "the gate <gate> was rejected by <gate record>: <the record's reason>".
// Pure: documents, JobRows and PullRequests are handed in; nothing is read, and `fetch` must not have been called when a test ends.
// Run: node --test tests/work-plans-rejected-gate.test.mjs
//
// Module: MOD-work-plans
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A JOB STOPS AT EVERY GATE; UC-034
// Level: unit

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { itemStates, startable } from "../src/work-plans/index.mjs";

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

const ID = "ITM-1416-work";
const GATE = "Building → Checking";
const RECORD = "docs/gates/20261102-0900-building-checking-1416.md";
const WHY = "The review found no test.";
const item = (id, fields = {}) => ({ kind: "item", path: `docs/backlog/${id}.md`, id, fields: { id, realises: ["UC-READY"], modules: [], builds_on: [], ...fields }, sections: [] });
const facts = (over = {}) => ({ statuses: new Map([["UC-READY", { id: "UC-READY", kind: "use-case", status: "accepted" }]]), queues: [], jobs: [], pullRequests: [], gates: [], workflow: null, ...over });
const ended = (id, state, reason, start = "2026-11-02T08:00:00Z") => ({ record: { id, worksOn: [ID], start: new Date(start), gates: [{ gate: GATE, decider: "Owner", resumedBy: null }],
  end: { at: new Date("2026-11-02T09:00:00Z"), state: "failed", results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason, log: null } }, state });
const rejectedEnd = (id = "JOB-1", why = WHY) => ended(id, "failed", `the gate ${GATE} was rejected by ${RECORD}${why ? `: ${why}` : ""}`);
const stateOf = (over, items = [item(ID)], order = null) => itemStates(items, order, facts(over)).find((state) => state.item === ID);
const pull = (state, number = 7) => ({ number, title: `${ID} work`, branch: `item/${ID}`, base: "main", head: "a".repeat(40), state, draft: false, url: `https://example.invalid/${number}`,
  opened: "2026-11-02T08:30:00Z", merged: state === "merged" ? "2026-11-02T09:30:00Z" : null, closed: null });

// TST-1416001 · level: unit · module: MOD-work-plans
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: an item whose only job JOB-1 ended failed with the End reason "the gate Building → Checking was rejected by docs/gates/20261102-0900-building-checking-1416.md: The review found no test."
// input: itemStates for the item
// expect: the item is ready, its reason is that End reason (so it names the gate, the gate record and "The review found no test."), its job is JOB-1 and it has no pull request
test("TST-1416001: UC-034 7a an item whose job a rejected gate ended is ready, with the gate, the record and the rejection's reason", () => {
  const got = stateOf({ jobs: [rejectedEnd()] });
  assert.deepEqual(got, { item: ID, state: "ready", reason: `the gate ${GATE} was rejected by ${RECORD}: ${WHY}`, job: "JOB-1", pullRequest: null });
});

// TST-1416002 · level: unit · module: MOD-work-plans
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: an item whose job ended failed otherwise — (a) "CI stayed red after the retry limit", (b) without any End reason, (c) a reason that mentions a rejection but names no gate record ("the review was rejected: no test"), (d) the same job still waiting at a gate
// input: itemStates for each
// expect: known positive: the item of TST-1416001 is ready; (a) to (c) are blocked and name the job as before ("job JOB-1 is failed", TST-805214), (d) is blocked and names the gate it waits at — a rejection is read only from an End that names its gate and its record
test("TST-1416002: UC-034 6a an item whose job failed otherwise, or waits at a gate, stays blocked", () => {
  assert.equal(stateOf({ jobs: [rejectedEnd()] }).state, "ready", "known positive: a job a rejected gate ended gives a ready item");
  for (const [label, job] of [["a", ended("JOB-1", "failed", "CI stayed red after the retry limit")], ["b", ended("JOB-1", "failed", null)],
    ["c", ended("JOB-1", "failed", "the review was rejected: no test")]]) {
    assert.deepEqual([label, stateOf({ jobs: [job] })], [label, { item: ID, state: "blocked", reason: "job JOB-1 is failed", job: "JOB-1", pullRequest: null }]);
  }
  const waiting = stateOf({ jobs: [{ ...rejectedEnd(), record: { ...rejectedEnd().record, end: null }, state: "waiting at a gate" }] });
  assert.deepEqual([waiting.state, waiting.reason], ["blocked", `job JOB-1 waits at ${GATE} for Owner`]);
});

// TST-1416003 · level: unit · module: MOD-work-plans
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: an item whose job a rejected gate ended and whose rejection gave no reason (the End reason ends at the record's path)
// input: itemStates for the item
// expect: the item is ready, its reason the End reason as written, naming the gate and the gate record
test("TST-1416003: a rejection that gave no reason still returns the item to ready, naming the gate and the record", () => {
  const got = stateOf({ jobs: [rejectedEnd("JOB-1", "")] });
  assert.deepEqual([got.state, got.reason], ["ready", `the gate ${GATE} was rejected by ${RECORD}`]);
});

// TST-1416004 · level: unit · module: MOD-work-plans
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: an item whose newest job JOB-2 is running and whose older job JOB-1 a rejected gate ended; an item whose job a rejected gate ended and whose pull request is merged; one whose requirement is not accepted; one that builds on an item not done
// input: itemStates for each, the newest job first in the list as listJobs gives it
// expect: alone, the rejected job gives a ready item; the retry is in progress (job JOB-2) — only the newest job decides; the merged item is done; the item with the open requirement waits for acceptance; the dependent waits for the item it builds on — a rejected gate's End lifts none of what keeps an item from being ready
test("TST-1416004: only the newest job decides, and a rejection lifts neither a merge, nor an acceptance, nor a prerequisite", () => {
  assert.equal(stateOf({ jobs: [rejectedEnd()] }).state, "ready", "known positive: alone, the job a rejected gate ended gives a ready item");
  const retry = { record: { id: "JOB-2", worksOn: [ID], start: new Date("2026-11-02T10:00:00Z") }, state: "running" };
  assert.deepEqual([stateOf({ jobs: [retry, rejectedEnd()] }).state, stateOf({ jobs: [retry, rejectedEnd()] }).job], ["in progress", "JOB-2"]);
  assert.equal(stateOf({ jobs: [rejectedEnd()], pullRequests: [pull("merged")] }).state, "done");
  const open = stateOf({ jobs: [rejectedEnd()], statuses: new Map() });
  assert.equal(open.state, "waiting for acceptance");
  const dependent = itemStates([item("ITM-1416-base"), item(ID, { builds_on: ["ITM-1416-base"] })], null, facts({ jobs: [rejectedEnd()] })).find((state) => state.item === ID);
  assert.equal(dependent.state, "waiting for an item it builds on");
});

// TST-1416005 · level: unit · module: MOD-work-plans
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034; A JOB STOPS AT EVERY GATE
// given: a plan step in phase Checking, whose gate before the phase is passed, and an item, each whose job a rejected gate ended; and an item whose job failed otherwise
// input: itemStates for the step with the plan order and for the items, then startable for each
// expect: the step and the item are ready with the rejection's reason and startable names no reason of their state; the item whose job failed otherwise is blocked and startable names that it is blocked
test("TST-1416005: UC-024 10a, UC-034 7a a step or an item returned to ready by a rejection is not kept from starting by its state", () => {
  const workflow = { model: { name: "m", kind: "planned", flow: { wip: null, timeBox: null, sprints: false } },
    phases: [{ name: "Building", roles: ["Developers"], produces: ["MOD"] }, { name: "Checking", roles: ["Developers"], produces: ["MOD"] }], transitions: [],
    gates: [{ name: GATE, from: "Building", to: "Checking", artifacts: "x", condition: "y", decider: "Owner", addedBy: null, practice: null }],
    roles: [{ name: "Developers", filledBy: "agent", howMany: "several", capabilities: ["read the repository"] }], branches: {}, done: [] };
  const order = { path: "docs/plan/order.md", fields: {}, sections: [{ heading: "## Order", rows: [{ cells: { Step: ID, Phase: "Checking" } }] }] };
  const step = itemStates([item(ID)], order, facts({ workflow, gates: [{ gate: GATE, state: "passed" }], jobs: [rejectedEnd()] }));
  const backlog = [stateOf({ jobs: [rejectedEnd()] })];
  const other = [stateOf({ jobs: [ended("JOB-1", "failed", "CI stayed red after the retry limit")] })];
  const context = { workflow, assignment: null, sprint: null, held: [], wip: null, participants: [] };
  const byState = (states) => (startable(ID, states, context).reasons ?? []).filter((reason) => reason.startsWith(`${ID} is `));
  assert.deepEqual([step[0].state, step[0].reason], ["ready", `the gate ${GATE} was rejected by ${RECORD}: ${WHY}`]);
  assert.deepEqual(byState(step), []);
  assert.deepEqual(byState(backlog), []);
  assert.deepEqual(byState(other), [`${ID} is blocked: job JOB-1 is failed.`]);
});
