// MOD-runtimes' resumeJob (ITM-790), as docs/architecture/MOD-runtimes.md states it (blob b8aa99a6, accepted): "`resumeJob(record: JobRecord, gateRecord: string, route: Route, host: Host,
// head: string, bridge?: Bridge) -> Promise<void>` — appends the resumption, naming the gate record, on the head read, and hands the job back to its route: in the tab it goes on from the result
// this module kept for it, its end appended as a job of the tab ends; on a Bridge it is handed over again when `bridge` is given, and otherwise taken up when the Bridge next reads the repository;
// on CI the push itself starts the job workflow, which goes on." And Data: "It keeps, in memory, the jobs running in this tab, the result of each job of this tab that waits at a gate".
// For UC-034 step 7 ("Agent M commits the gate record ... and the job continues") and A JOB STOPS AT EVERY GATE.
// Run: node --test tests/runtimes-resume.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-034; A JOB STOPS AT EVERY GATE; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RUNTIME IS INTERCHANGEABLE
// Level: unit
//
// The repository is a fake host in memory (default branch `trunk`); the tab's job runs the real runOnTab over a fixture endpoint behind the global `fetch`, which a test replaces and restores; the Bridge
// is a fixture behind the same `fetch`, spoken to by the real Bridge client (MOD-bridge-client: `POST /v1/jobs`). Nothing reaches the network. Where the texts leave a reading open, the tests state the one
// they take, and the pull request names it:
//   - The resumption is the first commit and the tab's end the second, each on the head read just before it (as runOnTab appends a part); the end is the one a job of the tab that ended without a gate gets:
//     state, results, usage and cost. The writer is not called again and the drafter is not asked again: the job goes on from the kept result.
//   - Appending the resumption is refused as MOD-job-ledger's appendToRecord refuses it — `NotWaiting` for a job at no gate or at a gate already resumed — and then nothing is committed and no Bridge is asked.
//   - A job of the tab route of which the tab keeps no result (the tab was closed, or another tab ran it) is refused by name, `NotHeld { job }`, before anything is committed: the record then shows it as
//     ended without record (MOD-runtimes, Data; UC-036). The result stays kept when the commit is refused (`Moved`), so the caller reads the record again and resumes.
// Each test states its input and its expected result before it runs (given / input / expect); where a test asserts a refusal or an absence, the same call is first shown to succeed. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";
import { bridgeAt } from "../src/bridge-client/index.mjs";
import { appendToRecord, recordsNewestFirst, startRecord } from "../src/job-ledger/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";

const REPOSITORY = { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" };
const TAB = { kind: "tab" }, CI = { kind: "ci", runner: "hosted" }, BRIDGE_ROUTE = { kind: "bridge", bridge: "lab-pc" };
const BRIDGE_ADDRESS = "http://127.0.0.1:4712";
const GATE = "docs/gates/GATE-20261020-1000-review.md";
const GATE_NAME = "Development → Review";
const DRAFTER = { name: "drafter-a", type: "model endpoint", model: "example-model", context: 200000, price: null, capabilities: ["draft text"], place: "this machine", route: "endpoint ep1" };
const CONNECTIONS = { endpoints: { ep1: { config: { name: "ep1", kind: "openai-compatible", baseUrl: "https://ep1.example.test/v1", model: "m", key: null }, bridge: null } }, bridges: {} };
const START = {
  id: "JOB-20261020-0930-abcd", kind: "fixture-writer", worksOn: ["ITM-790"], participant: "drafter-a", model: "example-model", route: "tab",
  run: null, retries: null, startedBy: "alice", start: new Date("2026-10-20T09:30:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) },
  inputs: ["SPEC.md@deadbeef"], limit: 5, destinations: [{ participant: "drafter-a", place: "this machine", parts: ["the draft"] }], params: {},
};
const RECORD_PATH = `docs/jobs/${START.id}.md`;
const OUTCOME = { commits: ["abc1234"], files: ["src/x.mjs"], pullRequest: "https://github.com/alice/product/pull/7", shown: null, notes: ["opened by the writer"] };

// ---------------------------------------------------------------- the fake repository

function fakeRepository(files = {}) {
  const tree = new Map(Object.entries(files));
  const writes = [];
  let head = "c0", made = 0;
  const snapshot = () => ({ repository: REPOSITORY, ref: "trunk", commit: head, paths: [...tree.keys()].sort(), read: async (path) => tree.get(path) ?? null, blob: () => null });
  return {
    writes, tree, head: () => head, moveOn: () => { head = `moved${++made}`; },
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot() { return snapshot(); },
      async commitFiles({ branch, expectedHead, files: changed, message }) {
        if (expectedHead !== head) throw Object.assign(new Error("Moved"), { name: "Moved", head });
        for (const file of changed) tree.set(file.path, file.text);
        head = `c${++made}`;
        writes.push({ branch, expectedHead, files: changed, message });
        return { commit: head };
      },
    },
    record: async () => { for await (const each of recordsNewestFirst(snapshot())) return each; return null; },
    text: () => tree.get(RECORD_PATH),
  };
}

// A repository holding a job's record that has reached its gate (and, with `resumed`, had it resumed): the start, a taking where the route is the tab's, the gate reached.
function repositoryAtGate(start = START, { resumed = false } = {}) {
  let text = startRecord(start).text;
  text = appendToRecord(text, { part: "gate reached", at: new Date("2026-10-20T09:40:00Z"), gate: GATE_NAME, decider: "the product owner" });
  if (resumed) text = appendToRecord(text, { part: "resumed", at: new Date("2026-10-20T09:50:00Z"), gateRecord: GATE });
  return fakeRepository({ [`docs/jobs/${start.id}.md`]: text });
}

// ---------------------------------------------------------------- the tab's job: a writer, an endpoint and a gate before the merge

let writerCalls = [];
const WRITER = "resume fixture writer";
registerStrategies("tests/runtimes-resume.test.mjs", { writers: { [WRITER]: async (result) => { writerCalls.push(result.draft); return OUTCOME; } } });
const ANSWER = { type: "object", required: ["text"], properties: { text: { type: "string" } } };
const jobOf = (gatePoints) => ({
  kind: { name: "fixture-writer", serves: [], participant: "one", needs: ["draft text"], resources: "none", preconditions: [], recipes: [], checks: [], personDecides: [], reviewer: null,
    reviewers: 0, steps: [], gatePoints, review: "none", writer: WRITER, limit: 5, purpose: "Writes, for a test.", prompt: "Write.", answer: ANSWER },
  params: {}, drafter: DRAFTER, reviewers: [], parts: [], destinations: [], fits: true, notFitting: [], leftOut: [], blocking: [], limit: 5,
});
const contextOf = (gates) => ({ kind: null, params: {}, product: { address: REPOSITORY.web, snapshot: null, host: null }, instance: { snapshot: null, host: null }, connect: async () => null,
  participants: [DRAFTER], places: { sources: {}, mailbox: null }, gates, person: "alice", now: new Date("2026-10-20T09:30:00Z"), agentM: START.agentM, jobId: START.id });
const BEFORE_MERGE = [{ name: GATE_NAME, point: "before-merge", passed: false, decider: "the product owner" }];

let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers() {
  requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { text: "the draft" }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
// The Bridge behind fetch: each request kept with the number of commits made when it arrived.
let handOvers = [], bridgeFake = null;
function bridgeAnswers() {
  handOvers = [];
  globalThis.fetch = async (url, init) => {
    const where = new URL(String(url));
    handOvers.push({ method: init.method, path: where.pathname, origin: where.origin, body: init.body ? JSON.parse(init.body) : null, writes: bridgeFake ? bridgeFake.writes.length : null });
    return new Response(JSON.stringify({ accepted: START.id }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; bridgeFake = null; });

// A queued job of the tab's route run to its gate: the start and the taking, the run, the gate reached; the tab keeps the result.
async function tabJobAtGate(id = START.id) {
  endpointAnswers();
  writerCalls = [];
  const fake = fakeRepository();
  await runtimes.queueJob(fake.host, { ...START, id }, TAB, fake.head());
  const record = await fake.record();
  const result = await runtimes.runOnTab(jobOf(["before-merge"]), contextOf(BEFORE_MERGE), CONNECTIONS, { host: fake.host, record });
  return { fake, result };
}

// TST-790001 · level: unit · module: MOD-runtimes
// guards: UC-034; A JOB STOPS AT EVERY GATE; A RUNTIME IS INTERCHANGEABLE
// given: a job of the tab's route run to a gate before the merge — its writer has run once, its record has a `Gate reached` and no End; a second job of the tab, run to its end with no gate, as the known comparison
// input: resumeJob(record, GATE, { kind: "tab" }, host, head) with the head read, on the first job
// expect: it resolves with nothing; the record shows the gate resumed — `gate record:` GATE — and then the End `done` with the writer's results (`commit abc1234`, `file src/x.mjs`, `pull request …/7`, `note: …`), the usage (10 input, 5 output tokens) and the cost the other job's End holds; the resumption is a commit on the head read, the End the next commit on the head after it; the writer is called no second time and no request goes to the drafter's endpoint
test("resumeJob — in the tab it appends the resumption, then the end the job would have had, from the result the tab kept", async () => {
  assert.equal(typeof runtimes.resumeJob, "function");
  const { fake, result } = await tabJobAtGate();
  assert.equal(result.stoppedBecause, "gate");
  assert.equal((await fake.record()).end, null);
  assert.equal(writerCalls.length, 1);
  const calls = requests.length, commits = fake.writes.length, head = fake.head();
  const outcome = await runtimes.resumeJob(await fake.record(), GATE, TAB, fake.host, head);
  assert.equal(outcome, undefined);
  assert.deepEqual([fake.writes.length - commits, fake.writes[commits].expectedHead, fake.writes[commits + 1].expectedHead], [2, head, `c${commits + 1}`]);
  assert.deepEqual(fake.writes.slice(commits).map((write) => write.files.map((file) => file.path)), [[RECORD_PATH], [RECORD_PATH]]);
  const text = fake.text();
  assert.ok(text.indexOf("## Gate reached") < text.indexOf("## Resumed") && text.indexOf("## Resumed") < text.indexOf("## End"), "gate reached, then resumed, then the end");
  const record = await fake.record();
  assert.deepEqual(record.gates.map((gate) => [gate.gate, gate.resumedBy]), [[GATE_NAME, GATE]]);
  assert.equal(record.end.state, "done");
  assert.deepEqual(record.end.results, ["commit abc1234", "file src/x.mjs", "pull request https://github.com/alice/product/pull/7", "note: opened by the writer"]);
  assert.deepEqual([writerCalls.length, requests.length], [1, calls], "nothing is drafted or written again");
  // The comparison: a job of the tab that ended without a gate has the same state, results, usage and cost in its End.
  endpointAnswers();
  const plain = fakeRepository();
  await runtimes.queueJob(plain.host, START, TAB, plain.head());
  await runtimes.runOnTab(jobOf([]), contextOf([]), CONNECTIONS, { host: plain.host, record: await plain.record() });
  const ended = (await plain.record()).end;
  assert.deepEqual([record.end.state, record.end.results, record.end.usage, record.end.cost], [ended.state, ended.results, ended.usage, ended.cost]);
  assert.deepEqual([record.end.usage.inputTokens, record.end.usage.outputTokens], [10, 5]);
});

// TST-790002 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the job at its gate of TST-790001 (known positive: resumeJob resumes it); a job whose record shows a gate reached but of which this tab keeps no result (another tab ran it, or this one was closed)
// input: resumeJob of the second, on the tab's route
// expect: refused by name, `NotHeld` naming the job; nothing is committed — no resumption, no end
test("resumeJob — a tab job of which the tab keeps no result is refused by name, with nothing committed", async () => {
  const { fake } = await tabJobAtGate();
  await runtimes.resumeJob(await fake.record(), GATE, TAB, fake.host, fake.head());
  assert.equal((await fake.record()).end.state, "done");
  const lost = repositoryAtGate({ ...START, id: "JOB-20261020-0931-ffff" });
  const record = await lost.record();
  assert.equal(record.path, "docs/jobs/JOB-20261020-0931-ffff.md");
  await assert.rejects(runtimes.resumeJob(record, GATE, TAB, lost.host, lost.head()), (error) => error.name === "NotHeld" && error.job === "JOB-20261020-0931-ffff");
  assert.equal(lost.writes.length, 0);
});

// TST-790003 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RUNTIME IS INTERCHANGEABLE
// given: a job on CI whose record shows a gate reached; the host has no `startWorkflow` (the push starts the job workflow)
// input: resumeJob(record, GATE, { kind: "ci", runner: "hosted" }, host, head)
// expect: it resolves with nothing; exactly one commit, on `trunk`, on the head read, of the job's record alone, which gains `## Resumed` with `gate record:` GATE after its `## Gate reached` and gains no End; the earlier bytes are unchanged
test("resumeJob — on CI it commits the resumption alone, whose push starts the job workflow", async () => {
  const fake = repositoryAtGate({ ...START, route: "ci hosted" });
  const before = fake.text(), head = fake.head();
  const outcome = await runtimes.resumeJob(await fake.record(), GATE, CI, fake.host, head);
  assert.equal(outcome, undefined);
  assert.equal(fake.writes.length, 1);
  assert.deepEqual([fake.writes[0].branch, fake.writes[0].expectedHead, fake.writes[0].files.map((file) => file.path)], ["trunk", head, [RECORD_PATH]]);
  assert.ok(fake.text().startsWith(before), "the bytes before stay as they are");
  const record = await fake.record();
  assert.deepEqual(record.gates.map((gate) => [gate.gate, gate.resumedBy]), [[GATE_NAME, GATE]]);
  assert.equal(record.end, null);
});

// TST-790004 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE
// given: a job on CI at no gate (known positive of the call: the same job at a gate resumes); a job on CI whose gate is resumed already; a job of the tab that is held at no gate
// input: resumeJob of each
// expect: refused with `NotWaiting`, MOD-job-ledger's own; nothing is committed; the job goes on only after resumeJob names a gate record
test("resumeJob — a job at no gate, or at a gate already resumed, is refused and nothing is committed", async () => {
  const atGate = repositoryAtGate({ ...START, route: "ci hosted" });
  await runtimes.resumeJob(await atGate.record(), GATE, CI, atGate.host, atGate.head());
  assert.equal(atGate.writes.length, 1);
  const noGate = fakeRepository({ [RECORD_PATH]: startRecord({ ...START, route: "ci hosted" }).text });
  await assert.rejects(runtimes.resumeJob(await noGate.record(), GATE, CI, noGate.host, noGate.head()), (error) => error.name === "NotWaiting");
  assert.equal(noGate.writes.length, 0);
  const twice = repositoryAtGate({ ...START, route: "ci hosted" }, { resumed: true });
  await assert.rejects(runtimes.resumeJob(await twice.record(), GATE, CI, twice.host, twice.head()), (error) => error.name === "NotWaiting");
  assert.equal(twice.writes.length, 0);
});

// TST-790005 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a job on a Bridge route whose record shows a gate reached; the Bridge `lab-pc` behind fetch
// input: resumeJob(record, GATE, { kind: "bridge", bridge: "lab-pc" }, host, head, bridge); and, as the comparison, the same without a Bridge handle
// expect: with the handle, one commit of the resumption on the head read, then one request, POST /v1/jobs to the Bridge, naming the product's address, the record's path and the resumption's commit — the job handed over again; without it, the commit alone and no request: the Bridge takes the job up when it next reads the repository
test("resumeJob — on a Bridge it hands the job over again when a Bridge is given, and otherwise leaves it to be taken up", async () => {
  bridgeAnswers();
  bridgeFake = repositoryAtGate({ ...START, route: "bridge lab-pc" });
  const head = bridgeFake.head();
  await runtimes.resumeJob(await bridgeFake.record(), GATE, BRIDGE_ROUTE, bridgeFake.host, head, bridgeAt({ name: "lab-pc", address: BRIDGE_ADDRESS, token: "token-lab-pc" }));
  assert.deepEqual([bridgeFake.writes.length, bridgeFake.writes[0].expectedHead, bridgeFake.writes[0].files.map((file) => file.path)], [1, head, [RECORD_PATH]]);
  assert.deepEqual(handOvers.map((each) => [each.method, each.path, each.origin, each.writes]), [["POST", "/v1/jobs", BRIDGE_ADDRESS, 1]]);
  assert.deepEqual(handOvers[0].body, { product: REPOSITORY.web, record: RECORD_PATH, commit: bridgeFake.head() });
  assert.deepEqual((await bridgeFake.record()).gates.map((gate) => gate.resumedBy), [GATE]);
  bridgeAnswers();
  bridgeFake = repositoryAtGate({ ...START, route: "bridge lab-pc" });
  await runtimes.resumeJob(await bridgeFake.record(), GATE, BRIDGE_ROUTE, bridgeFake.host, bridgeFake.head());
  assert.deepEqual([bridgeFake.writes.length, handOvers.length], [1, 0]);
});

// TST-790006 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: a job on a Bridge at its gate, and a job of the tab held at its gate; the branch moved after the head was read
// input: resumeJob with the stale head on each; then, for the tab's, again with the head read anew
// expect: refused with the host's `Moved`; nothing is committed and the Bridge is not asked; the tab keeps its result, so that the second call resumes it and appends its end
test("resumeJob — a branch that moved refuses the resumption with nothing written, and the tab's result stays kept", async () => {
  bridgeAnswers();
  bridgeFake = repositoryAtGate({ ...START, route: "bridge lab-pc" });
  const stale = bridgeFake.head();
  bridgeFake.moveOn();
  await assert.rejects(runtimes.resumeJob(await bridgeFake.record(), GATE, BRIDGE_ROUTE, bridgeFake.host, stale, bridgeAt({ name: "lab-pc", address: BRIDGE_ADDRESS, token: "t" })),
    (error) => error.name === "Moved");
  assert.deepEqual([bridgeFake.writes.length, handOvers.length], [0, 0]);
  const { fake } = await tabJobAtGate("JOB-20261020-0932-cccc");
  const old = fake.head(), commits = fake.writes.length;
  fake.moveOn();
  const record = await fake.record();
  await assert.rejects(runtimes.resumeJob(record, GATE, TAB, fake.host, old), (error) => error.name === "Moved");
  assert.equal(fake.writes.length, commits);
  await runtimes.resumeJob(record, GATE, TAB, fake.host, fake.head());
  assert.equal((await fake.record()).end.state, "done");
});

// ---------------------------------------------------------------- a gate that is rejected (ITM-1412)
//
// UC-034 7a / UC-024 10a: "The gate record states the rejection and its reason. The job ends, and the item returns to *ready* with the reason attached." MOD-runtimes resumes a job "after its gate"; a gate that is
// rejected is decided too, so resumeJob, given the record of the rejection, ends the job where it resumes it for a passed one. Readings taken, which the pull request names:
//   - resumeJob reads the gate record it is given. A record that is `decision: rejected` ends the job: one commit on the head read appends `## End`, state `failed`, no results, whose reason names the gate the
//     job last reached, the gate record's path and its `## Reason`, on one line; no `## Resumed` is appended, and nothing goes on — the tab drops the result it kept, a Bridge is not asked, CI starts nothing.
//   - A record that is not rejected, or that the repository does not hold at that path (as in the tests above), resumes the job as before.
//   - A job that is at no gate is refused with `NotWaiting` as for a resumption, and an ended one with `RecordEnded`; a tab job of which the tab keeps no result is ended all the same, since the end needs no result.

const text = (...lines) => `${lines.join("\n")}\n`;
const REASON = "The review found no test.";
const gateRecord = (decision) => text("---", `gate: ${GATE_NAME}`, `job: ${START.id}`, "decider: bob", "role: Owner", `decision: ${decision}`, "on:", "  - 0123456789abcdef0123456789abcdef01234567",
  "date: 2026-10-20 09:45 UTC", "---", "# Gate record", "", "**REGISTER**", "", ...(decision === "rejected" ? ["## Reason", "", REASON] : []));
const withGateRecord = (fake, decision) => { fake.tree.set(GATE, gateRecord(decision)); return fake; };
const reasonOf = async (fake) => (await fake.record()).end.reason;

// TST-1412005 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; THE GATE IS RECORDED; UC-034; UC-024
// given: a job on CI whose record shows a gate reached, and the gate record GATE in the repository with `decision: rejected` and the reason "The review found no test."
// input: resumeJob(record, GATE, { kind: "ci", runner: "hosted" }, host, head)
// expect: it resolves with nothing; exactly one commit, on `trunk`, on the head read, of the job's record alone, which gains an `## End` of state failed with no results whose reason names the gate "Development → Review", GATE and "The review found no test.", and gains no `## Resumed`; the earlier bytes are unchanged; the record's state is failed
test("resumeJob — a rejected gate record ends the job failed, naming the gate record and its reason", async () => {
  const fake = withGateRecord(repositoryAtGate({ ...START, route: "ci hosted" }), "rejected");
  const before = fake.text(), head = fake.head();
  const outcome = await runtimes.resumeJob(await fake.record(), GATE, CI, fake.host, head);
  assert.equal(outcome, undefined);
  assert.equal(fake.writes.length, 1);
  assert.deepEqual([fake.writes[0].branch, fake.writes[0].expectedHead, fake.writes[0].files.map((file) => file.path)], ["trunk", head, [RECORD_PATH]]);
  assert.ok(fake.text().startsWith(before), "the bytes before stay as they are");
  assert.doesNotMatch(fake.text(), /## Resumed/);
  const record = await fake.record();
  assert.deepEqual([record.end.state, record.end.results], ["failed", []]);
  assert.equal(record.end.reason.includes("\n"), false, "the reason is on one line");
  for (const named of [GATE_NAME, GATE, REASON]) assert.ok(record.end.reason.includes(named), `the reason names ${named}: ${record.end.reason}`);
});

// TST-1412006 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-034
// given: the job of TST-790001 run in the tab to a gate before the merge (its writer has run once), and the gate record GATE in the repository with `decision: rejected`
// input: resumeJob(record, GATE, { kind: "tab" }, host, head); then resumeJob of the same record again with a gate record that is not rejected
// expect: one commit of the End `failed` with the reason of TST-1412005 and nothing else — no `## Resumed`, no result of the writer, no second call of the writer and no request to the drafter's endpoint; the second call is refused `NotHeld`, since the tab no longer keeps the job's result
test("resumeJob — in the tab a rejected gate ends the job and the tab drops the result it kept", async () => {
  const { fake } = await tabJobAtGate("JOB-20261020-0933-dddd");
  const id = "JOB-20261020-0933-dddd", path = `docs/jobs/${id}.md`;
  fake.tree.set(GATE, gateRecord("rejected"));
  const calls = requests.length, commits = fake.writes.length;
  await runtimes.resumeJob(await fake.record(), GATE, TAB, fake.host, fake.head());
  assert.equal(fake.writes.length - commits, 1);
  assert.deepEqual(fake.writes[commits].files.map((file) => file.path), [path]);
  const record = await fake.record();
  assert.deepEqual([record.end.state, record.end.results], ["failed", []]);
  for (const named of [GATE_NAME, GATE, REASON]) assert.ok(record.end.reason.includes(named), `the reason names ${named}: ${record.end.reason}`);
  assert.doesNotMatch(fake.tree.get(path), /## Resumed/);
  assert.deepEqual([writerCalls.length, requests.length], [1, calls], "nothing is drafted or written again");
  fake.tree.set(GATE, gateRecord("passed"));
  await assert.rejects(runtimes.resumeJob(record, GATE, TAB, fake.host, fake.head()), (error) => error.name === "NotHeld" && error.job === id);
});

// TST-1412007 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-034
// given: a job on a Bridge route at a gate, and the gate record GATE with `decision: rejected`, the Bridge `lab-pc` behind fetch; a job of the tab at a gate of which the tab keeps no result (the known positive of TST-790002: with a gate record not rejected it is refused `NotHeld`)
// input: resumeJob of the Bridge's job with the Bridge's handle; resumeJob of the tab's job
// expect: the Bridge's job: one commit of the End `failed`, no request to the Bridge; the tab's job: one commit of the End `failed` with the same reason, and no `NotHeld`
test("resumeJob — a rejected gate hands nothing over to a Bridge and ends a tab job whose result is not kept", async () => {
  bridgeAnswers();
  bridgeFake = withGateRecord(repositoryAtGate({ ...START, route: "bridge lab-pc" }), "rejected");
  await runtimes.resumeJob(await bridgeFake.record(), GATE, BRIDGE_ROUTE, bridgeFake.host, bridgeFake.head(), bridgeAt({ name: "lab-pc", address: BRIDGE_ADDRESS, token: "token-lab-pc" }));
  assert.deepEqual([bridgeFake.writes.length, handOvers.length], [1, 0]);
  assert.equal((await bridgeFake.record()).end.state, "failed");
  const lost = repositoryAtGate({ ...START, id: "JOB-20261020-0934-eeee" });
  lost.tree.set(GATE, gateRecord("passed"));
  await assert.rejects(runtimes.resumeJob(await lost.record(), GATE, TAB, lost.host, lost.head()), (error) => error.name === "NotHeld");
  assert.equal(lost.writes.length, 0);
  lost.tree.set(GATE, gateRecord("rejected"));
  await runtimes.resumeJob(await lost.record(), GATE, TAB, lost.host, lost.head());
  assert.equal(lost.writes.length, 1);
  assert.ok((await lost.record()).end.reason.includes(REASON));
});

// TST-1412008 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE; UC-034
// given: a job on CI at a gate and another on a Bridge at a gate, the gate record GATE in the repository with `decision: passed` (the counter-proof: a passed record resumes)
// input: resumeJob of each
// expect: CI: one commit that gains `## Resumed` with `gate record:` GATE and no End; the Bridge: the same commit, then one request, POST /v1/jobs — the job handed over again
test("resumeJob — a passed gate record still resumes the job and ends nothing", async () => {
  const fake = withGateRecord(repositoryAtGate({ ...START, route: "ci hosted" }), "passed");
  await runtimes.resumeJob(await fake.record(), GATE, CI, fake.host, fake.head());
  assert.equal(fake.writes.length, 1);
  assert.deepEqual([(await fake.record()).gates.map((gate) => gate.resumedBy), (await fake.record()).end], [[GATE], null]);
  bridgeAnswers();
  bridgeFake = withGateRecord(repositoryAtGate({ ...START, route: "bridge lab-pc" }), "passed");
  await runtimes.resumeJob(await bridgeFake.record(), GATE, BRIDGE_ROUTE, bridgeFake.host, bridgeFake.head(), bridgeAt({ name: "lab-pc", address: BRIDGE_ADDRESS, token: "token-lab-pc" }));
  assert.deepEqual([bridgeFake.writes.length, handOvers.map((each) => [each.method, each.path])], [1, [["POST", "/v1/jobs"]]]);
  assert.equal((await bridgeFake.record()).end, null);
});

// TST-1412009 · level: unit · module: MOD-runtimes
// guards: A JOB STOPS AT EVERY GATE
// given: a job on CI at no gate, and one that has its End already, each with the gate record GATE `decision: rejected` in the repository (known positive: the job at a gate is ended by it, TST-1412005)
// input: resumeJob of each
// expect: the first is refused `NotWaiting`, the second `RecordEnded`; nothing is committed
test("resumeJob — a rejected gate record ends no job that waits at no gate, nor one that has ended", async () => {
  const noGate = withGateRecord(fakeRepository({ [RECORD_PATH]: startRecord({ ...START, route: "ci hosted" }).text }), "rejected");
  await assert.rejects(runtimes.resumeJob(await noGate.record(), GATE, CI, noGate.host, noGate.head()), (error) => error.name === "NotWaiting");
  assert.equal(noGate.writes.length, 0);
  const ended = withGateRecord(repositoryAtGate({ ...START, route: "ci hosted" }), "rejected");
  await runtimes.resumeJob(await ended.record(), GATE, CI, ended.host, ended.head());
  await assert.rejects(runtimes.resumeJob(await ended.record(), GATE, CI, ended.host, ended.head()), (error) => error.name === "RecordEnded");
  assert.equal(ended.writes.length, 1);
});
