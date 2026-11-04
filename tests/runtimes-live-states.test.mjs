// MOD-runtimes' liveStates — the live states of a repository's jobs that have not ended, with one listing of the job workflow's runs (ITM-1280), as the accepted text of
// docs/architecture/MOD-runtimes.md states it (Interfaces: `liveStates`): "`liveState` for each of the records of one repository that have not ended, keyed by job identifier, the runs of the job
// workflow listed once for all of them; the same states `liveState` gives one by one."
// Run: node --test tests/runtimes-live-states.test.mjs
//
// Module: MOD-runtimes
// Guards: ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-036
// Level: unit
//
// The host is a fake in memory whose CI lists the runs it is given and counts each listing; the records are written with MOD-job-ledger's startRecord and appendToRecord and read back with its
// recordsNewestFirst. The Bridge is the fixture Bridge of tests/runtimes-live-bridge-fixture.mjs, which stands in for the global `fetch` and keeps every request; in the CI cases `fetch` is the spy of
// tests/runtimes-live-fixture.mjs, which every test checks was never called. A name the module does not provide yet is undefined here, so that each test fails by itself.

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";
import { appendToRecord, recordsNewestFirst, startRecord } from "../src/job-ledger/index.mjs";
import { REPOSITORY, START, ciRun, fetched, restoreFetch, spyOnFetch } from "./runtimes-live-fixture.mjs";
import { BRIDGES, bridgeRow, fixtureBridge } from "./runtimes-live-bridge-fixture.mjs";

test.afterEach(() => restoreFetch());

const RUN = (n) => `https://github.com/alice/product/actions/runs/${n}`;

// The records of one repository, newest first: for each { id, by, ended } a start of START's form, taken by `by` (a CI run's address or a Bridge's name) at 11:01, and ended as done where `ended`.
async function recordsOf(jobs) {
  const files = new Map(jobs.map(({ id, by, ended = false }) => {
    let { path, text } = startRecord({ ...START, id });
    text = appendToRecord(text, { part: "taken", at: new Date("2026-10-16T11:01:00Z"), by });
    if (ended) text = appendToRecord(text, { part: "end", at: new Date("2026-10-16T11:30:00Z"), state: "done", results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason: null, log: null });
    return [path, text];
  }));
  const records = [];
  for await (const record of recordsNewestFirst({ repository: REPOSITORY, ref: "trunk", commit: "c0", paths: [...files.keys()], read: async (path) => files.get(path) ?? null, blob: () => null })) records.push(record);
  return records;
}

// A host whose CI lists `runs` and keeps each listing in `calls` as `list <workflow>`.
function ciHost(runs) {
  const calls = [];
  return { calls, host: { listCiRuns: async (filter) => { calls.push(`list ${filter?.workflow}`); return runs.filter((run) => !filter?.workflow || run.workflow === filter.workflow).map((run) => ({ ...run })); } } };
}

const FIVE = [["JOB-20261016-1101-0001", 1, "queued"], ["JOB-20261016-1102-0002", 2, "running"], ["JOB-20261016-1103-0003", 3, "waiting"], ["JOB-20261016-1104-0004", 4, "success"], ["JOB-20261016-1105-0005", 5, null]];

// TST-1280002 · level: unit · module: MOD-runtimes
// guards: ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-036
// given: five jobs of one repository that have not ended, each taken by its own CI run (runs 1 to 5), and a sixth that has ended (run 6); the CI lists run 1 queued, 2 running, 3 waiting, 4 success and 6 success, and no run 5, besides a run of another workflow
// input: liveState for each of the five, one by one, counting the CI's listings; then liveStates(all six records, { host }, {}) on a fresh count
// expect: one by one, five listings of agent-m-jobs.yml; liveStates gives a Map of the five unended jobs' identifiers, in the order of the records, each to the state liveState gave it — runs 1, 2 and 3 known and running with their address as log, run 4 known and not running, job 5 unknown —, and the ended job is not among them; with one listing of agent-m-jobs.yml; no request reaches the network
test("TST-1280002 liveStates gives five unended CI jobs the states liveState gives one by one, with one listing of the runs", async () => {
  spyOnFetch();
  assert.equal(typeof runtimes.liveStates, "function", "MOD-runtimes provides liveStates");
  const runs = [...FIVE.filter(([, , state]) => state !== null).map(([, n, state]) => ciRun(n, state)), ciRun(6, "success"), ciRun(9, "running", "other.yml")];
  const records = await recordsOf([...FIVE.map(([id, n]) => ({ id, by: RUN(n) })), { id: "JOB-20261016-1000-0006", by: RUN(6), ended: true }]);
  const one = ciHost(runs);
  const byOne = [];
  for (const [id] of FIVE) byOne.push([id, await runtimes.liveState(records.find((record) => record.id === id), { host: one.host }, {})]);
  assert.equal(one.calls.length, 5, "known positive: one by one, the runs are listed once for each job");
  assert.deepEqual(byOne.map(([, live]) => [live.known, live.running, live.log]), [[true, true, RUN(1)], [true, true, RUN(2)], [true, true, RUN(3)], [true, false, RUN(4)], [false, false, null]]);

  const all = ciHost(runs);
  const states = await runtimes.liveStates(records, { host: all.host }, {});
  assert.deepEqual([...states.keys()].sort(), FIVE.map(([id]) => id).sort(), "the five jobs that have not ended, and not the one that has");
  assert.deepEqual(FIVE.map(([id]) => [id, states.get(id)]), byOne, "the same states liveState gives one by one");
  assert.deepEqual(all.calls, ["list agent-m-jobs.yml"], "one listing of the job workflow's runs");
  assert.deepEqual(fetched, [], "no request reached the network");
});

// TST-1280003 · level: unit · module: MOD-runtimes
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: one repository's records: a job taken by the Bridge lab-pc, which lists it as running with the usage { tokens: 12 }, and a job taken by the CI run 1, which the CI lists as running
// input: liveStates(records, { host }, { "lab-pc": its handle })
// expect: the Bridge's job is asked of the Bridge — one request, GET http://localhost:4712/v1/jobs — and is known and running with the usage { tokens: 12 }, as liveState gives it; the CI job is known and running with run 1's address; the runs are listed once; no request goes elsewhere
test("TST-1280003 liveStates asks the Bridge for a record without an end taken on a Bridge, beside the one listing of the runs", async () => {
  assert.equal(typeof runtimes.liveStates, "function", "MOD-runtimes provides liveStates");
  const records = await recordsOf([{ id: "JOB-20261016-1101-b001", by: "lab-pc" }, { id: "JOB-20261016-1102-c001", by: RUN(1) }]);
  const ci = ciHost([ciRun(1, "running")]);
  const bridge = fixtureBridge({ jobs: [{ row: bridgeRow("JOB-20261016-1101-b001", "running", { tokens: 12 }), lines: [], ended: false }] });
  const states = await runtimes.liveStates(records, { host: ci.host }, BRIDGES);
  assert.deepEqual(bridge.requests.map(({ method, url }) => [method, url]), [["GET", "http://localhost:4712/v1/jobs"]], "the Bridge is asked");
  assert.deepEqual(states.get("JOB-20261016-1101-b001"), { reachable: true, reason: null, known: true, running: true, cancelling: false, log: null, usage: { tokens: 12 }, writtenAfterCancel: [] });
  assert.deepEqual(states.get("JOB-20261016-1102-c001"), { reachable: true, reason: null, known: true, running: true, cancelling: false, log: RUN(1), usage: null, writtenAfterCancel: [] });
  assert.deepEqual(ci.calls, ["list agent-m-jobs.yml"]);
  assert.deepEqual(bridge.stray, []);
});
