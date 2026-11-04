// Release tests of ITM-1280 — UC-036 step 1 and ONE DASHBOARD SHOWS EVERY JOB on the list of every job: the list reads each repository's job records in batches of at most a hundred files and sends no read of
// a record by itself, asks the job workflow's runs once for each repository whatever the number of jobs that have not ended, shows the states `liveState` gives one by one, and still asks a Bridge for a job
// taken on that Bridge. The behaviour is MOD-job-ledger (docs/architecture/MOD-job-ledger.md, Interfaces, `listJobs`: "The records of each snapshot are named to its `readMany` first, so that they are read in
// batches."), MOD-runtimes (docs/architecture/MOD-runtimes.md, Interfaces, `liveStates`: "`liveState` for each of the records of one repository that have not ended, keyed by job identifier, the runs of the
// job workflow listed once for all of them; the same states `liveState` gives one by one.") and MOD-main-page (docs/architecture/MOD-main-page.md, Interfaces, `jobs`: "The list reads every record, in batches
// (`listJobs`) … the live states of the jobs without an end it asks with MOD-runtimes' `liveStates`, which lists a repository's runs of the job workflow once.") as the SPEC's A PAGE LOAD READS THE REPOSITORY
// IN BATCHES ("the texts of the files it shows in requests of at most 100 files each") and ONE DASHBOARD SHOWS EVERY JOB ("Each job appears with its state") state it.
// Run: node --test tests/release-itm-1280-jobs-list-batches.test.mjs
//
// Module: MOD-job-ledger; MOD-runtimes; MOD-main-page
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036
// Level: release
//
// Written for the release testing of sprint 117 by a participant who implemented none of ITM-1280 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the counting fake GitHub of
// tests/progress-measures-load.mjs over the real MOD-repository-hosts host (cases 301 and 302), and the fake GitHub, the Bridge lab-pc-4 and the browser of tests/main-page-home-harness.mjs under the real
// routes of MOD-main-page (cases 303 to 307); the counts are read from the requests the fake received, not from a counter inside a fixture of the module under test. Readings the texts leave open, which the
// cases state:
//   - "in batches of at most a hundred files": the batches the host sends for the records, in the order sent, are counted as the files each names (POST /graphql, `f<n>:object(expression: …)`); a hundred
//     records are one batch, a hundred and one are two, of 100 and 1, none are none.
//   - "a listing of the runs": one request for the runs of the job workflow, GET /repos/<repository>/actions/workflows/agent-m-jobs.yml/runs; the fake serves it in one page.
//   - "the same states liveState gives one by one": for the same records and the same world, the Map liveStates gives holds, for each record that has not ended, the object liveState gives that record, and
//     holds no other key; a record that has ended is not in it.
//   - A job whose record names no run on the list is `ended without record` on the page (MOD-job-ledger, `jobState`: a runtime that is reachable and does not know the job).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { listJobs, startRecord, appendToRecord, recordsNewestFirst } from "../src/job-ledger/index.mjs";
import { liveState, liveStates } from "../src/runtimes/index.mjs";
import { bridgeAt } from "../src/bridge-client/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { view } from "../src/main-page/index.mjs";
import { PRODUCT as PROGRESS_PRODUCT, TOKEN, githubServer, productFiles, summary } from "./progress-measures-load.mjs";
import { INSTANCE, PRODUCT, PRODUCT_URL, PRODUCT_TOKEN, OTHER, OTHER_URL, OTHER_TOKEN, browser, byClass, draw, headOf, instanceFiles, network, smallProduct, timers, withEnd } from "./main-page-home-harness.mjs";

const jobsRoute = view.routes.find((candidate) => candidate.name === "jobs");
const homeRoute = view.routes.find((candidate) => candidate.name === "home");
let net;
afterEach(() => {
  net?.restore();
  net = undefined;
  timers.restore();
});

const at = (text) => new Date(`${text}:00Z`);
const runUrl = (repository, n) => `https://github.com/${repository}/actions/runs/${n}`;
const RUNS = /\/actions\/workflows\/agent-m-jobs\.yml\/runs/;
const run = (repository, id, status, conclusion = null) => ({ id, status, conclusion, html_url: runUrl(repository, id), path: ".github/workflows/agent-m-jobs.yml", head_sha: "a".repeat(40), event: "push" });
// Listings of the job workflow's runs, per repository, from the requests the fake received.
const listingsOf = (repository) => net.requests.filter(({ url }) => url.startsWith(`https://api.github.com/repos/${repository}/`) && RUNS.test(url)).length;

/** A job record of `repository`: taken by `by` (a run's address, a Bridge's name, `tab …` or `ci hosted`; null for a job no route has taken), on `route`, ended as done where `ended`. */
function job({ id, route = "ci hosted", by = null, ended = false }) {
  let { path, text } = startRecord({ id, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-ci", model: "model-x", route, run: null, retries: null, startedBy: "alice", start: at("2026-10-16T08:00"),
    agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
  if (by !== null) text = appendToRecord(text, { part: "taken", at: at("2026-10-16T08:00"), by });
  return { path, text: ended ? withEnd(text, "done") : text };
}
const ID = (tag, n) => `JOB-20261016-${String(800 + n).padStart(4, "0")}-${tag}${String(n).padStart(3, "0")}`;

/** The records of `repository` as MOD-job-ledger reads them, from files in memory. */
async function recordsOf(files) {
  const held = new Map(files.map(({ path, text }) => [path, text]));
  const records = [];
  for await (const record of recordsNewestFirst({ repository: { web: "https://github.com/alice/product" }, ref: "main", commit: "c0", paths: [...held.keys()], read: async (path) => held.get(path) ?? null, blob: () => null })) records.push(record);
  return records;
}

// ---------------------------------------------------------------- listJobs over a real host

/** listJobs over the snapshot of a fake GitHub repository of `count` job records and the files besides `extra`: the rows and what the fake received after the snapshot was read. */
async function listed(count, extra = {}) {
  const files = { ...productFiles({ items: 0, jobs: count }), ...extra };
  const server = githubServer({ [PROGRESS_PRODUCT]: files });
  server.install();
  try {
    const host = connect(parseAddress(`https://github.com/${PROGRESS_PRODUCT}`), { token: TOKEN });
    const snapshot = await host.readSnapshot("main");
    server.log.length = 0;
    const rows = await listJobs([{ address: PROGRESS_PRODUCT, snapshot }], new Map());
    const plain = await listJobs([{ address: PROGRESS_PRODUCT, snapshot: { paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) } }], new Map());
    return { rows, plain, read: summary(server.log) };
  } finally { server.restore(); }
}

// TST-1280301 · level: release · module: MOD-job-ledger
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: product repositories of 0, 1, 100, 101 and 201 job records, each with a SPEC.md, a test file and a file docs/jobs/README.md that is no record, served by the counting fake GitHub; the host connected with a token; known positive first — a repository of 250 records is read in batches (TST-1280001 reads its sizes as well)
// input: listJobs([{ address, snapshot }], new Map()) over the snapshot of each, and over a plain snapshot of the same texts without readMany
// expect: the batches sent are [], [1], [100], [100, 1] and [100, 100, 1] files for 0, 1, 100, 101 and 201 records; every file named is a record under docs/jobs/ (no SPEC.md, no test file, no docs/jobs/README.md); no record is read by itself; the rows are as many as the records and equal, in order, to the rows over the plain snapshot
// Planted fault: listJobs not naming the records to readMany (the `await snapshot.readMany?.(paths)` taken out of listJobs in src/job-ledger/index.mjs) fails the assertion that no record is read by itself.
// Planted fault: listJobs naming every path of the snapshot (`snapshot.readMany?.(snapshot.paths)`) fails the assertion that every file named is a record.
test("TST-1280301 listJobs reads a repository's records in batches of at most a hundred files, none by itself, and the rows are today's, at 0, 1, 100, 101 and 201 records", async () => {
  const extra = { "docs/jobs/README.md": "# Jobs\n" };
  const known = await listed(250, extra);
  assert.deepEqual(known.read.batches, [100, 100, 50], "known positive: 250 records are three batches");
  const sizes = { 0: [], 1: [1], 100: [100], 101: [100, 1], 201: [100, 100, 1] };
  for (const [count, batches] of Object.entries(sizes)) {
    const { rows, plain, read } = await listed(Number(count), extra);
    assert.deepEqual(read.batches, batches, `${count} records`);
    assert.equal(read.allFiles.every((path) => /^docs\/jobs\/JOB-[^/]+\.md$/.test(path)), true, `${count} records: every file named is a record`);
    assert.deepEqual(read.singles, [], `${count} records: no record is read by itself`);
    assert.equal(rows.length, Number(count), `${count} records: a row for each`);
    assert.deepEqual(rows, plain, `${count} records: the rows are today's`);
  }
});

// TST-1280302 · level: release · module: MOD-job-ledger
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: a snapshot of three job records whose readMany is refused with a used-up rate limit, and one whose record JOB-20261014-0900-0002 cannot be read (its read answers nothing) and whose readMany answers; known positive first — over a snapshot that has no readMany the three rows are read
// input: listJobs over each, and over the plain snapshot of the same texts
// expect: with the readMany refused, listJobs does not fail and gives the three rows of the plain snapshot, each record read by its own read; with the one record unreadable, it gives three rows, in which that record is listed with source.reachable false and the reason "not held at this commit" and the other two equal the plain snapshot's
// Planted fault: the call of readMany not guarded (the `try { … } catch` around `await snapshot.readMany?.(paths)` taken out of listJobs in src/job-ledger/index.mjs) fails the case with the used-up limit.
// Planted fault: a record that is not held left out of the rows fails the assertion on the three rows.
test("TST-1280302 a refused batch does not fail the list, and a record that cannot be read is listed with its reason", async () => {
  const files = productFiles({ items: 0, jobs: 3 });
  const plainSnapshot = { paths: Object.keys(files), read: async (path) => files[path] ?? null };
  const plain = await listJobs([{ address: "alice/product", snapshot: plainSnapshot }], new Map());
  assert.equal(plain.length, 3, "known positive: three rows over a snapshot without readMany");

  const refusals = [], reads = [];
  const refused = { ...plainSnapshot, read: async (path) => { reads.push(path); return files[path] ?? null; }, readMany: async (paths) => { refusals.push(paths.length); throw Object.assign(new Error("rate limit"), { name: "RateLimited" }); } };
  const afterRefusal = await listJobs([{ address: "alice/product", snapshot: refused }], new Map());
  assert.deepEqual(refusals, [3], "the records were named to readMany");
  assert.deepEqual(reads.sort(), Object.keys(files).filter((path) => path.startsWith("docs/jobs/")).sort(), "each record was read by its own read");
  assert.deepEqual(afterRefusal, plain);

  const missing = "docs/jobs/JOB-20261014-0900-0002.md";
  const unreadable = { paths: plainSnapshot.paths, read: async (path) => (path === missing ? null : files[path] ?? null), readMany: async () => {} };
  const rows = await listJobs([{ address: "alice/product", snapshot: unreadable }], new Map());
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.filter((row) => !row.source.reachable).map((row) => row.source.reason), ["not held at this commit"]);
  assert.deepEqual(rows.filter((row) => row.source.reachable), plain.filter((row) => row.record.id !== "JOB-20261014-0900-0002"));
});

// ---------------------------------------------------------------- liveStates over a real host

const BRIDGE_JOB = "JOB-20261016-0900-b001";
const BRIDGES = { "lab-pc-4": bridgeAt({ address: "http://127.0.0.1:4711", token: "pairing-token-four" }) };

/** The world of the liveStates cases: the fake GitHub with the runs given, the Bridge lab-pc-4 listing BRIDGE_JOB as running, and the host of alice/product connected with its token. */
function world(runs) {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() }, { bridgeLists: BRIDGE_JOB });
  net.ciRuns = runs;
  net.install();
  return { host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }) };
}
const listingsNow = () => listingsOf(PRODUCT);
const bridgeNow = () => net.bridgeAsked();

// TST-1280303 · level: release · module: MOD-runtimes
// guards: ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-036
// given: the records of one repository: five jobs taken by CI runs 1 to 5 (the fake GitHub lists run 1 queued, 2 in progress, 3 waiting, 4 completed with success and no run 5), one job taken by "ci hosted" without a run's address, one taken by the Bridge lab-pc-4, which lists it as running, one taken by another browser's tab, one no route has taken, and one CI job that has ended (run 6, listed); the host of the repository connected with its token over the fake
// input: liveState for each record that has not ended, one by one, and then liveStates(all ten records, { host }, { "lab-pc-4": its handle }), the requests counted for each
// expect: known positive — one by one, the runs of the job workflow are listed six times (once for each of the six CI jobs) and the Bridge is asked once; liveStates gives a Map whose keys are the nine jobs that have not ended and not the ended one, each value equal to the object liveState gave that job (the queued, in progress and waiting runs known and running with the run's address as log, the completed run known and not running, run 5 and "ci hosted" unknown, the Bridge's job known and running, the other browser's tab unreachable with its reason, the job no route took unknown); it lists the runs once and asks the Bridge once
// Planted fault: liveStates calling liveState for each record (`open.map((record) => liveState(record, product, bridges))` in src/runtimes/index.mjs) lists the runs six times, and the case fails on the count of listings.
// Planted fault: liveStates giving the states of the CI jobs only (the records taken on a Bridge or a tab left out of `open`) fails the assertion that the keys are the nine jobs.
// Planted fault: liveStates not asking the Bridge for a job taken on it (the `bridge` case of stateOf answering unknown) fails the assertion that the Bridge's job is known and running.
// Planted fault: liveStates keeping the records that have ended (`const open = records`) fails the assertion that the keys are the nine jobs that have not ended.
test("TST-1280303 liveStates gives the unended jobs of a repository the states liveState gives one by one, listing the runs once and still asking the Bridge", async () => {
  const jobs = [
    ...[1, 2, 3, 4, 5].map((n) => job({ id: ID("c", n), by: runUrl(PRODUCT, n) })),
    job({ id: ID("c", 7), by: "ci hosted" }),
    job({ id: BRIDGE_JOB, route: "bridge lab-pc-4", by: "lab-pc-4" }),
    job({ id: ID("t", 1), route: "tab", by: "tab another-browser" }),
    job({ id: ID("n", 1), by: null }),
    job({ id: ID("c", 6), by: runUrl(PRODUCT, 6), ended: true }),
  ];
  const records = await recordsOf(jobs);
  assert.equal(records.length, 10);
  const { host } = world([run(PRODUCT, 1, "queued"), run(PRODUCT, 2, "in_progress"), run(PRODUCT, 3, "waiting"), run(PRODUCT, 4, "completed", "success"), run(PRODUCT, 6, "completed", "success")]);
  const open = records.filter((record) => !record.end);
  assert.equal(open.length, 9);

  const byOne = new Map();
  for (const record of open) byOne.set(record.id, await liveState(record, { host }, BRIDGES));
  assert.equal(listingsNow(), 6, "known positive: one by one, the runs are listed once for each of the six CI jobs");
  assert.equal(bridgeNow(), 1, "known positive: one by one, the Bridge is asked for its job");
  assert.deepEqual([byOne.get(ID("c", 1)).known, byOne.get(ID("c", 1)).running, byOne.get(ID("c", 1)).log], [true, true, runUrl(PRODUCT, 1)]);
  assert.deepEqual([byOne.get(ID("c", 4)).known, byOne.get(ID("c", 4)).running], [true, false]);
  assert.deepEqual([byOne.get(ID("c", 5)).known, byOne.get(ID("c", 7)).known, byOne.get(ID("n", 1)).known], [false, false, false]);
  assert.deepEqual([byOne.get(BRIDGE_JOB).known, byOne.get(BRIDGE_JOB).running], [true, true]);
  assert.equal(byOne.get(ID("t", 1)).reachable, false);

  const before = [listingsNow(), bridgeNow()];
  const states = await liveStates(records, { host }, BRIDGES);
  assert.deepEqual([...states.keys()].sort(), open.map((record) => record.id).sort(), "the nine jobs that have not ended, and not the one that has");
  assert.equal(states.has(ID("c", 6)), false);
  for (const record of open) assert.deepEqual(states.get(record.id), byOne.get(record.id), `${record.id}: the state liveState gives`);
  assert.equal(listingsNow() - before[0], 1, "the runs are listed once");
  assert.equal(bridgeNow() - before[1], 1, "the Bridge is asked once for its job");
});

// TST-1280304 · level: release · module: MOD-runtimes
// guards: ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036
// given: known positive first (TST-1280303: with CI jobs that have not ended the runs are listed once); a repository whose records are a job taken by the Bridge lab-pc-4, a job taken by another browser's tab and a CI job that has ended; and a repository of two CI jobs that have not ended and a job taken by the Bridge, whose server refuses the list of the job workflow's runs with an error (500)
// input: liveStates over the first repository's records, and liveStates and liveState one by one over the second's, the requests counted
// expect: the first repository's runs are not listed at all; the second's liveStates gives each CI job the object liveState gives it, reachable false with the reason of the server's refusal, the job taken by the Bridge known and running, and it asks for the runs as often as one liveState does, where one by one the two CI jobs ask twice that
// Planted fault: liveStates asking for the listing whether or not a record was taken on CI (`runs()` called before the `Promise.all` of liveStates in src/runtimes/index.mjs) lists the runs in the first repository, and the case fails on the count.
// Planted fault: liveStates letting the refusal of the listing end the call (the `catch` of the CI case of stateOf rethrowing, in src/runtimes/index.mjs) fails the second case with the error.
// Planted fault: the refusal read as an unknown job (the `catch` of the CI case of stateOf returning `{ ...UNKNOWN }`) fails the assertion that a CI job is unreachable.
test("TST-1280304 liveStates lists no runs where no job was taken on CI, and a refused listing makes each CI job unreachable and no other", async () => {
  const known = await recordsOf([job({ id: ID("c", 1), by: runUrl(PRODUCT, 1) })]);
  const only = await recordsOf([job({ id: BRIDGE_JOB, route: "bridge lab-pc-4", by: "lab-pc-4" }), job({ id: ID("t", 1), route: "tab", by: "tab another-browser" }), job({ id: ID("c", 6), by: runUrl(PRODUCT, 6), ended: true })]);
  const { host } = world([run(PRODUCT, 1, "in_progress"), run(PRODUCT, 6, "completed", "success")]);
  await liveStates(known, { host }, BRIDGES);
  assert.equal(listingsNow(), 1, "known positive: a CI job that has not ended makes one listing");
  const states = await liveStates(only, { host }, BRIDGES);
  assert.equal(listingsNow(), 1, "no CI job has not ended: no further listing");
  assert.deepEqual([...states.keys()].sort(), [BRIDGE_JOB, ID("t", 1)].sort());
  net.restore();

  const records = await recordsOf([job({ id: ID("c", 1), by: runUrl(PRODUCT, 1) }), job({ id: ID("c", 2), by: runUrl(PRODUCT, 2) }), job({ id: BRIDGE_JOB, route: "bridge lab-pc-4", by: "lab-pc-4" })]);
  const second = world([run(PRODUCT, 1, "in_progress")]);
  const spy = globalThis.fetch;
  globalThis.fetch = async (input, init) => (RUNS.test(String(input)) ? (net.requests.push({ url: String(input), host: new URL(String(input)).host, authorization: null }), new Response("{}", { status: 500, headers: { "content-type": "application/json" } })) : spy(input, init));
  try {
    const byOne = new Map();
    byOne.set(ID("c", 1), await liveState(records.find((record) => record.id === ID("c", 1)), { host: second.host }, BRIDGES));
    const perListing = listingsNow();
    assert.equal(byOne.get(ID("c", 1)).reachable, false, "known positive: a refused listing makes a CI job unreachable");
    for (const record of records.filter((each) => each.id !== ID("c", 1))) byOne.set(record.id, await liveState(record, { host: second.host }, BRIDGES));
    assert.equal(byOne.get(BRIDGE_JOB).running, true);
    assert.equal(listingsNow(), 2 * perListing, "known positive: one by one, each CI job asks for the listing itself");
    const sent = listingsNow();
    const all = await liveStates(records, { host: second.host }, BRIDGES);
    for (const record of records) assert.deepEqual(all.get(record.id), byOne.get(record.id), `${record.id}: the state liveState gives`);
    assert.equal(listingsNow() - sent, perListing, "the runs are asked for once, as a single liveState asks for them");
  } finally { globalThis.fetch = spy; }
});

// ---------------------------------------------------------------- the route jobs

const REPOSITORY_OF = { instance: INSTANCE, product: PRODUCT, other: OTHER };
/** Job records of `repository` for the list: `count` in all, those in `unended` as given ({ n: { by, route } }), every other taken by its own run and ended as done. */
function listOfRecords(repository, tag, count, unended = {}) {
  return Array.from({ length: count }, (_, n) => job({ id: ID(tag, n), route: unended[n]?.route ?? "ci hosted", by: unended[n] && "by" in unended[n] ? unended[n].by : runUrl(repository, n + 1), ended: !(n in unended) }));
}
const asFiles = (records) => Object.fromEntries(records.map(({ path, text }) => [path, text]));
// The batch requests of files' texts, as { repository, files }: each POST /graphql whose query asks for blobs by `f<n>:object(expression: …)`, of the repository its variables name.
function keepBatches() {
  const batches = [];
  const spy = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.host === "api.github.com" && url.pathname === "/graphql" && init?.body) {
      const { query, variables } = JSON.parse(init.body);
      const files = [...query.matchAll(/\bf\d+:object\(expression:/g)].length;
      if (files > 0) batches.push({ repository: `${variables.owner}/${variables.name}`, files });
    }
    return spy(input, init);
  };
  return batches;
}
const singleReads = () => net.requests.filter(({ url }) => /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\/docs\/jobs\//.test(url));
const rowsOf = (target) => Object.fromEntries(byClass(target, "job").map((row) => [row.getAttribute("data-id"), byClass(row, "state")[0].textContent]));

// The world of the route jobs: the instance of 100 records, alice/product of 101 and bob/other of 5 that all have ended; the unended jobs and their runs as the cases below say.
function listWorld() {
  const instance = listOfRecords(INSTANCE, "i", 100, { 0: { by: runUrl(INSTANCE, 1) }, 1: { by: runUrl(INSTANCE, 2) } });
  const product = listOfRecords(PRODUCT, "p", 101, { 0: { by: runUrl(PRODUCT, 1) }, 1: { by: runUrl(PRODUCT, 2) }, 2: { by: runUrl(PRODUCT, 3) }, 3: { by: "lab-pc-4", route: "bridge lab-pc-4" }, 4: { by: null } });
  const other = listOfRecords(OTHER, "o", 5);
  net = network({ [INSTANCE]: { ...instanceFiles(), ...asFiles(instance) }, [PRODUCT]: smallProduct({ jobs: product }), [OTHER]: smallProduct({ jobs: other }) }, { bridgeLists: ID("p", 3) });
  for (const repository of [INSTANCE, PRODUCT, OTHER]) {
    const commit = headOf(repository);
    net.overviews[repository] = { [commit]: JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: [] }) };
  }
  net.ciRuns = [run(INSTANCE, 1, "in_progress"), run(INSTANCE, 2, "queued"), run(PRODUCT, 1, "in_progress"), run(PRODUCT, 2, "queued")];
  net.install();
  return keepBatches();
}
const context = () => browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } });

// TST-1280305 · level: release · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036
// given: the instance alice/agent-m of exactly 100 job records, two of them not ended (taken by runs 1 and 2); alice/product of 101, five of them not ended (runs 1 and 2, run 3 which the fake does not list, one taken by the Bridge lab-pc-4, which lists it as running, and one no route has taken); bob/other of 5 records, all ended; the fake lists runs 1 (in progress) and 2 (queued) of the instance and of alice/product; a token for each repository; each repository's branch overview-cache holds the overview of its head, in which nothing waits (what waits stands above the list, ITM-1190); known positive first — every row is a job
// input: the route jobs drawn
// expect: 206 rows; the instance's records are one batch of 100 files, alice/product's two of 100 and 1, bob/other's one of 5, and no record is read by itself; the runs of the job workflow are listed once for alice/agent-m and once for alice/product, and not at all for bob/other, whose jobs have all ended; the Bridge is asked; the rows read running for the instance's and the product's runs 1 and 2 (a queued run is a job the runtime holds), ended without record for the product's run 3, running for the Bridge's job, queued for the job no route has taken, and done for every other
// Planted fault: the page asking liveState once for each unended job (the `liveStates` call of liveStatesOf in src/main-page/sources.mjs replaced by one `liveState` per row) lists alice/product's runs three times and the instance's twice, and the case fails on the listings.
// Planted fault: listJobs not naming the records to readMany fails the assertion that no record is read by itself.
// Planted fault: liveStates not asking the Bridge for a job taken on it (the `bridge` case of stateOf answering unknown) fails the assertion that the Bridge's job reads running.
test("TST-1280305 #jobs with a hundred and a hundred and one records sends their batches and one listing of runs for each repository that has a job not ended, and none for one that has not", async () => {
  const batches = listWorld();
  const target = await draw(jobsRoute, context());
  const rows = rowsOf(target);
  assert.equal(Object.keys(rows).length, 206, "known positive: every job is a row");
  const of = (repository) => batches.filter((batch) => batch.repository === repository).map((batch) => batch.files);
  assert.deepEqual([of(INSTANCE), of(PRODUCT), of(OTHER)], [[100], [100, 1], [5]], "the batches of each repository");
  assert.deepEqual(singleReads(), [], "no record is read by itself");
  assert.deepEqual([listingsOf(INSTANCE), listingsOf(PRODUCT), listingsOf(OTHER)], [1, 1, 0], "the job workflow's runs are listed once for a repository with a job not ended, and not for one with none");
  assert.equal(net.bridgeAsked() >= 1, true, "the Bridge is asked for the job taken on it");
  assert.deepEqual([rows[ID("i", 0)], rows[ID("i", 1)], rows[ID("p", 0)], rows[ID("p", 1)], rows[ID("p", 2)], rows[ID("p", 3)]], ["running", "running", "running", "running", "ended without record", "running"]);
  assert.equal(rows[ID("p", 4)], "queued", "the job no route has taken");
  assert.deepEqual([...new Set(Object.entries(rows).filter(([id]) => ![ID("i", 0), ID("i", 1), ID("p", 0), ID("p", 1), ID("p", 2), ID("p", 3), ID("p", 4)].includes(id)).map(([, state]) => state))], ["done"]);
});

// TST-1280306 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-036
// given: the world of TST-1280305, with the same overviews, except that alice/product's server refuses the list of the job workflow's runs with an error (500); known positive first — the instance's two jobs are listed with their states
// input: the route jobs drawn
// expect: the instance's jobs read running, as with a listing that succeeds; each of alice/product's jobs taken on CI that has not ended reads its state with "not reachable" and the server's reason, its job taken by the Bridge reads running without it, the job no route has taken reads queued, and every ended job reads done; the page asks for alice/product's runs once, as often as a single liveState does for one job
// Planted fault: liveStates letting the refusal end the call (the `catch` of the CI case of stateOf rethrowing, in src/runtimes/index.mjs) leaves alice/product's jobs with no state and the case fails on their states.
// Planted fault: the refusal read as an unknown job (the `catch` of the CI case of stateOf returning `{ ...UNKNOWN }`) shows the jobs as ended without record and the case fails on "not reachable".
// Planted fault: the page asking liveState once for each unended job (src/main-page/jobs.mjs) asks for the runs three times and the case fails on the count.
test("TST-1280306 where one repository's list of runs is refused, only its jobs taken on CI that have not ended are not reachable", async () => {
  const batches = listWorld();
  const spy = globalThis.fetch;
  globalThis.fetch = async (input, init) => (RUNS.test(String(input)) && String(input).includes(`/repos/${PRODUCT}/`)
    ? (net.requests.push({ url: String(input), host: new URL(String(input)).host, authorization: null }), new Response("{}", { status: 500, headers: { "content-type": "application/json" } })) : spy(input, init));
  const [control] = await recordsOf([job({ id: ID("c", 1), by: runUrl(PRODUCT, 1) })]);
  await liveState(control, { host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }) }, {});
  const perListing = listingsOf(PRODUCT);
  assert.equal(perListing >= 1, true, "known positive: a single liveState asks for the listing");
  const target = await draw(jobsRoute, context());
  const rows = rowsOf(target);
  assert.deepEqual([rows[ID("i", 0)], rows[ID("i", 1)]], ["running", "running"], "known positive: the instance's jobs have their states");
  assert.deepEqual(batches.filter((batch) => batch.repository === PRODUCT).map((batch) => batch.files), [100, 1]);
  for (const n of [0, 1, 2]) assert.match(rows[ID("p", n)], /not reachable/, `alice/product's job ${n} taken on CI`);
  assert.equal(rows[ID("p", 3)], "running", "the job taken by the Bridge");
  assert.equal(rows[ID("p", 4)], "queued");
  assert.equal(Object.values(rows).filter((state) => state === "done").length, 206 - 7);
  assert.equal(listingsOf(PRODUCT), 2 * perListing, "alice/product's runs asked for once by the page, as the single liveState asked for them");
  assert.equal(listingsOf(INSTANCE), 1);
});

// TST-1280307 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036; UC-046
// given: this browser keeps alice/product and bob/other, each with two jobs for ITM-0900 taken by CI runs of its own and not ended, and a token each; the fake lists the runs of both
// input: the route home drawn, and then the timer of its reading again fired at 12:01 UTC
// expect: known positive first — the cards are drawn and the build of each shows the item its two jobs work on; the runs of the job workflow are listed once for alice/product and once for bob/other in the draw, and once more for each in the reading again, never once for each job
// Planted fault: the cards asking liveState for each of their jobs (the `liveStates` call of liveStatesOf in src/main-page/sources.mjs replaced by one `liveState` per row) lists each repository's runs twice in the draw and the case fails on the count.
test("TST-1280307 the main page's cards list a repository's runs once in each reading, whatever the number of its jobs", async () => {
  const two = (repository, tag) => [0, 1].map((n) => job({ id: ID(tag, n), by: runUrl(repository, n + 1) }));
  net = network({ [PRODUCT]: smallProduct({ jobs: two(PRODUCT, "p") }), [OTHER]: smallProduct({ jobs: two(OTHER, "o") }), [INSTANCE]: instanceFiles() });
  net.ciRuns = [run(PRODUCT, 1, "in_progress"), run(PRODUCT, 2, "queued"), run(OTHER, 1, "in_progress"), run(OTHER, 2, "queued")];
  net.install();
  const target = await draw(homeRoute, browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
  const builds = byClass(target, "card").map((card) => byClass(card, "build-row").length);
  assert.deepEqual(builds, [1, 1], "known positive: the build of each card shows the item the two jobs work on");
  assert.deepEqual([listingsOf(PRODUCT), listingsOf(OTHER)], [1, 1], "once for each repository in the draw");
  await timers.fire(at("2026-10-16T12:01"));
  assert.deepEqual([listingsOf(PRODUCT), listingsOf(OTHER)], [2, 2], "once more for each in the reading again");
});
