// A done item whose requirement or use case is withdrawn, changed or not accepted, or whose item it builds on is not done, is marked — MOD-work-plans' itemStates as
// docs/architecture/MOD-work-plans.md states it: "A requirement or use case it realises that is withdrawn, changed or not accepted, or an item it builds on that is not done, marks a `done` item: its
// `reason` names that", and `ItemState.reason` — "for a `done` item its mark, null without one" —, for UC-032 1a (ITM-1316).
// Run: node --test tests/work-plans-done-marks.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; STATUS IS DERIVED FROM THE RECORDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). The items are Documents in the form MOD-documents' readDocument gives them; the statuses, queues and
// pull requests are the facts itemStates takes. Nothing is read and nothing reaches the network. The reading of "changed" is the item's: against the text that holds now, from the facts itemStates
// already takes — a use case is changed while its status is `changed`, a requirement while an entry of a change queue that is not yet in the SPEC changes it; a change written into the SPEC marks
// nothing. The known positive of each case is that the base gives the item the reason null; the counter-proof is the same item with its requirement standing, which has the reason it has today.

import test from "node:test";
import assert from "node:assert/strict";
import { itemStates } from "../src/work-plans/index.mjs";

const BUILT = "c1".repeat(20);
const item = (id, fields = {}) => ({
  kind: "item",
  path: `docs/backlog/${id}-work.md`,
  id,
  fields: { id, realises: ["GONE"], modules: ["MOD-work-plans"], builds_on: [], built_by: [BUILT], ...fields },
  sections: [],
});
const statusMap = (entries) => new Map(entries.map(([id, status, kind = "requirement"]) => [id, { id, kind, status }]));
const facts = (overrides = {}) => ({
  statuses: statusMap([["STANDS", "accepted"]]),
  queues: [],
  jobs: [],
  pullRequests: [],
  gates: [],
  workflow: null,
  ...overrides,
});
const stateOf = (states, id) => states.find((state) => state.item === id);
const merged = (id, number) => ({ number, title: `${id} work`, branch: `work/${id}`, base: "main", head: "a".repeat(40), state: "merged",
  draft: false, url: `https://example.invalid/${number}`, opened: "2026-10-13T08:00:00Z", merged: "2026-10-13T09:00:00Z", closed: null });
const queue = (state, change = "changed") => ({ folder: "docs/spec-freigaben/q", title: "queue", target: "SPEC.md", entries: [{
  number: 3, file: "SPEC.md", anchor: "STANDS", until: null, proposal: { path: "docs/spec-freigaben/q/03.md", blob: "b".repeat(40) }, rationale: "", record: null, decision: null, state,
  impact: [{ name: "STANDS", change }], createdBy: null }] });

// TST-1316001 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001 whose built_by names a commit and that realises GONE, a requirement no status names; ITM-002 the same, realising STANDS, which is accepted
// input: itemStates([ITM-001, ITM-002], null, facts) with the statuses {STANDS accepted}
// expect: both done, with pullRequest null; ITM-001's reason is "GONE is not accepted"; ITM-002's reason is null, as it is today
test("TST-1316001: itemStates — a done item that realises a requirement no status names is marked, one whose requirement stands is not", () => {
  const states = itemStates([item("ITM-001"), item("ITM-002", { realises: ["STANDS"] })], null, facts());
  assert.deepEqual(stateOf(states, "ITM-001"), { item: "ITM-001", state: "done", reason: "GONE is not accepted", job: null, pullRequest: null });
  assert.deepEqual(stateOf(states, "ITM-002"), { item: "ITM-002", state: "done", reason: null, job: null, pullRequest: null }, "counter-proof: the requirement stands");
});

// TST-1316002 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001 whose pull request 7 is merged and that realises UC-001, whose status is changed; ITM-002 whose pull request 8 is merged and that realises UC-002, which is accepted
// input: itemStates([ITM-001, ITM-002], null, facts) with the statuses {UC-001 changed, UC-002 accepted} and both pull requests
// expect: both done by their pull requests, "7" and "8"; ITM-001's reason is "UC-001 is changed, not accepted"; ITM-002's is null
test("TST-1316002: itemStates — a merged pull request still decides first, and a changed use case it realises marks the item", () => {
  const items = [item("ITM-001", { realises: ["UC-001"], built_by: [] }), item("ITM-002", { realises: ["UC-002"], built_by: [] })];
  const states = itemStates(items, null, facts({ statuses: statusMap([["UC-001", "changed", "use-case"], ["UC-002", "accepted", "use-case"]]),
    pullRequests: [merged("ITM-001", 7), merged("ITM-002", 8)] }));
  assert.deepEqual(stateOf(states, "ITM-001"), { item: "ITM-001", state: "done", reason: "UC-001 is changed, not accepted", job: null, pullRequest: "7" });
  assert.deepEqual(stateOf(states, "ITM-002"), { item: "ITM-002", state: "done", reason: null, job: null, pullRequest: "8" }, "counter-proof: the use case stands");
});

// TST-1316003 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001, done by its built_by, that realises STANDS, which is accepted; the queue docs/spec-freigaben/q whose entry 3 changes STANDS, once open and once in SPEC
// input: itemStates([ITM-001], null, facts) with each queue
// expect: with the entry open, ITM-001 is done with a reason naming "docs/spec-freigaben/q#3 as changed, state open"; with the entry in SPEC, the change is the requirement's text now and the reason is null
test("TST-1316003: itemStates — a change queue entry not yet in the SPEC marks a done item, one written into the SPEC marks nothing", () => {
  const items = [item("ITM-001", { realises: ["STANDS"] })];
  const open = stateOf(itemStates(items, null, facts({ queues: [queue("open")] })), "ITM-001");
  assert.equal(open.state, "done");
  assert.equal(open.reason, "STANDS is still in docs/spec-freigaben/q#3 as changed, state open");
  const written = stateOf(itemStates(items, null, facts({ queues: [queue("in SPEC")] })), "ITM-001");
  assert.deepEqual(written, { item: "ITM-001", state: "done", reason: null, job: null, pullRequest: null }, "counter-proof: the change is in the SPEC");
});

// TST-1316004 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001 realising STANDS and ready; ITM-002 done by its built_by that builds on ITM-001; and ITM-003 done by its built_by that builds on ITM-004, which is done too
// input: itemStates([ITM-002, ITM-001, ITM-003, ITM-004], null, facts)
// expect: ITM-001 ready; ITM-002 done with the reason "ITM-001 is not done"; ITM-003 and ITM-004 done with the reason null
test("TST-1316004: itemStates — a done item that builds on an item that is not done is marked", () => {
  const stands = { realises: ["STANDS"] };
  const states = itemStates([item("ITM-002", { ...stands, builds_on: ["ITM-001"] }), item("ITM-001", { ...stands, built_by: [] }),
    item("ITM-003", { ...stands, builds_on: ["ITM-004"] }), item("ITM-004", stands)], null, facts());
  assert.equal(stateOf(states, "ITM-001").state, "ready");
  assert.deepEqual(stateOf(states, "ITM-002"), { item: "ITM-002", state: "done", reason: "ITM-001 is not done", job: null, pullRequest: null });
  assert.equal(stateOf(states, "ITM-003").reason, null, "counter-proof: the item it builds on is done");
  assert.equal(stateOf(states, "ITM-004").reason, null);
});

// TST-1316005 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001 ready; ITM-002 done by its built_by that realises GONE and builds on ITM-001
// input: itemStates([ITM-001, ITM-002], null, facts)
// expect: ITM-002 stays done, whatever marks it, and its reason holds both causes, joined by "; ": "GONE is not accepted; ITM-001 is not done"
test("TST-1316005: itemStates — a done item with both causes names both in its reason, and stays done", () => {
  const states = itemStates([item("ITM-001", { realises: ["STANDS"], built_by: [] }), item("ITM-002", { builds_on: ["ITM-001"] })], null, facts());
  assert.deepEqual(stateOf(states, "ITM-002"), { item: "ITM-002", state: "done", reason: "GONE is not accepted; ITM-001 is not done", job: null, pullRequest: null });
});

// TST-1316006 · level: unit · module: MOD-work-plans
// guards: UC-032; STATUS IS DERIVED FROM THE RECORDS
// given: ITM-001 whose pull requests are unknown, done by its built_by, realising GONE
// input: itemStates([ITM-001], null, facts) with the pull requests "unknown"
// expect: ITM-001 is done with the reason "GONE is not accepted": its record decides the state, the facts of its requirement decide the mark, and no pull request is needed for either
test("TST-1316006: itemStates — the mark of an item done by its built_by needs no pull request", () => {
  const states = itemStates([item("ITM-001")], null, facts({ pullRequests: "unknown" }));
  assert.deepEqual(stateOf(states, "ITM-001"), { item: "ITM-001", state: "done", reason: "GONE is not accepted", job: null, pullRequest: null });
});
