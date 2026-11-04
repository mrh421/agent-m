// Release tests of ITM-1269 — UC-036 step 4 on the job's page: the page of one job reads that job's one record and asks that job's live state alone, and the list of every job
// (step 1) still reads every record. The behaviour is UC-036 (docs/use-cases/UC-036-inspect-running-jobs.md, Main flow 1 and 4) as docs/architecture/MOD-main-page.md (Interfaces, `job`: "The
// route reads the one record `docs/jobs/<id>.md` — of the product the address names, else of the first repository among the instance and the kept products whose tree holds it — and asks the
// live state of that job alone; it reads no other job's record."; Interfaces, `jobs`: "The list reads every record, in batches") states it.
// Run: node --test tests/release-itm-1269-job-page-reads-its-own-job.test.mjs
//
// Module: MOD-main-page
// Guards: ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036
// Level: release
//
// Written for the release testing of sprint 115 by a participant who implemented none of ITM-1269 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). It reads the page from the outside: the real route
// `job` and the real route `jobs` of the main page, drawn over the fixtures of the main page's tests (tests/main-page-home-harness.mjs: the counting fake of GitHub, which answers the query of named
// files a narrowed tree sends, and the Bridge lab-pc-4, which lists one job as running), with a fixture of its own and not that of tests/main-page-job-one-record.test.mjs. What the page read is counted
// from the requests the fake received: a record read is a request for a file under docs/jobs/ or a file under docs/jobs/ that GitHub's batch request of files' texts (POST /graphql,
// `f<n>:object(expression: "<commit>:<path>")`) names, of the repository its variables name, since listJobs names the records to the snapshot's readMany (ITM-1280) and the fake answers that batch, a tree read narrowed to named files is a query of named files (`net.folderReads`), a live state asked
// is a request for the Bridge's list of jobs. Each count is first shown to count: the control is the route `jobs` over the same fixture, which reads more records than one and asks the Bridge, so that a
// count of one stands for what the page read and not for a counter that sees little. Readings the texts leave open, which the cases state:
//   - "the first repository among the instance and the kept products whose tree holds it": the order is the one the list shows — the instance, then the products as the browser keeps them.
//   - "the same id planted in two repositories is read once": a job identifier is unique within its product only (A JOB IDENTIFIER IS NEVER REUSED), so two repositories may hold one; the page then
//     shows the first holder's record and no request names the other's.
//   - "the list is unchanged": it still reads the tree of each source whole, not narrowed to a path, and every record of it.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { INSTANCE, PRODUCT, PRODUCT_URL, PRODUCT_TOKEN, OTHER, OTHER_URL, OTHER_TOKEN, browser, byClass, draw, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

const jobRoute = view.routes.find((candidate) => candidate.name === "job");
const listRoute = view.routes.find((candidate) => candidate.name === "jobs");
let net, batched = [];
afterEach(() => {
  net?.restore();
  timers.restore();
});

const THIRD = "dave/third";
const THIRD_URL = `https://github.com/${THIRD}`;
const THIRD_TOKEN = "github_pat_ITM1269REL0123456789abcdefghijklm";
const SHARED = "JOB-20261020-0900-5555";
const at = (text) => new Date(`${text}:00Z`);

/** A job record of the kind implement-item for ITM-0900, taken by the Bridge lab-pc-4 and not ended, of `participant`. */
function record(id, participant) {
  const { path, text } = startRecord({ id, kind: "implement-item", worksOn: ["ITM-0900"], participant, model: "model-x", route: "bridge lab-pc-4", run: null, retries: null, startedBy: "alice",
    start: at("2026-10-20T09:00"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
  return { path, text: appendToRecord(text, { part: "taken", at: at("2026-10-20T09:00"), by: "lab-pc-4" }) };
}
/** Four records of other jobs of a repository, each of `participant`: the identifiers end in the tag and 1 to 4. */
const others = (tag, participant) => Array.from({ length: 4 }, (_, n) => record(`JOB-20261020-08${String(n + 1).padStart(2, "0")}-${tag}${n + 1}`, participant));
const asFiles = (records) => Object.fromEntries(records.map(({ path, text }) => [path, text]));

/** The fixture: the instance and the products alice/product, bob/other and dave/third, in this order, each with four other jobs; `holders` names the repositories that hold the job SHARED, each with its own participant. */
function open(holders) {
  const participantOf = { [INSTANCE]: "dev-i", [PRODUCT]: "dev-a", [OTHER]: "dev-b", [THIRD]: "dev-c" };
  const jobsOf = (repository, tag) => [...(holders.includes(repository) ? [record(SHARED, participantOf[repository])] : []), ...others(tag, participantOf[repository])];
  net = network({ [INSTANCE]: { ...instanceFiles(), ...asFiles(jobsOf(INSTANCE, "i")) }, [PRODUCT]: smallProduct({ jobs: jobsOf(PRODUCT, "a") }), [OTHER]: smallProduct({ jobs: jobsOf(OTHER, "b") }),
    [THIRD]: smallProduct({ jobs: jobsOf(THIRD, "c") }) }, { bridgeLists: SHARED });
  net.install();
  // The records a batch request of files' texts names, as "<owner>/<name>:<path>", kept before the request goes on to the fake.
  batched = [];
  const spy = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.host === "api.github.com" && url.pathname === "/graphql" && typeof init?.body === "string") {
      const { query, variables } = JSON.parse(init.body);
      for (const [, quoted] of query.matchAll(/\bf\d+:object\(expression:("(?:[^"\\]|\\.)*")\)/g)) {
        const path = JSON.parse(quoted).replace(/^[^:]*:/, "");
        if (path.startsWith("docs/jobs/")) batched.push(`${variables.owner}/${variables.name}:${path}`);
      }
    }
    return spy(input, init);
  };
}
const context = () => browser({ products: [PRODUCT_URL, OTHER_URL, THIRD_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN, [THIRD]: THIRD_TOKEN } });
/** The records the page read: each request for a file under docs/jobs/, and each such file a batch request named, as "<owner>/<name>:<path>". */
const recordsRead = () => [...net.requests.map(({ url }) => /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/(docs\/jobs\/[^?]+)/.exec(url)).filter(Boolean).map((m) => `${m[1]}:${decodeURIComponent(m[2])}`),
  ...batched];
/** The live states asked: each request for the Bridge lab-pc-4's list of jobs. */
const liveAsked = () => net.requests.filter(({ url }) => new URL(url).host === "127.0.0.1:4711" && new URL(url).pathname === "/v1/jobs").length;
const factsOf = (target) => byClass(target, "job-facts")[0]?.textContent ?? "";
const mentions = (facts, ...participants) => participants.filter((participant) => facts.includes(participant));

/** The control: the route `jobs` drawn over the fixture of `holders`, which reads records and asks the Bridge, so that the counts of a case count something. Returns what it read; the fixture is closed again. */
async function listing(holders) {
  open(holders);
  const target = await draw(listRoute, context());
  const read = { rows: byClass(target, "job").length, records: recordsRead().length, narrowed: net.folderReads.length, live: liveAsked() };
  net.restore();
  timers.restore();
  return read;
}

// TST-1269301 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: known positive first — the route jobs over the same fixture lists its jobs, reads more records than one and asks the Bridge. The instance and the three products of five job records each; one job of the same identifier in each of the four, of the participants dev-i, dev-a, dev-b and dev-c; the person opens that job with the address naming dave/third, the last product kept
// input: the route job drawn with that identifier and the product dave/third
// expect: the page shows dave/third's record — the participant dev-c and none of dev-i, dev-a, dev-b; one record was read, dave/third's docs/jobs/<id>.md, and the same identifier held by the three repositories before it in the order was not read; one tree was read, dave/third's, narrowed to that path; the live state was asked once
// Planted fault: oneJob ignoring the product of the address (`product === null ||` made `true ||` in the filter of oneJob, src/main-page/jobs.mjs) reads the trees of all four sources, shows dev-i's record, and the case fails on the participant.
// Planted fault: the page reading its job with the list's reading (`oneJob` returning `everyJob(context)`, src/main-page/jobs.mjs) reads every record, and the case fails on the record read.
test("TST-1269301 the page of a job a product's address names reads that product's record alone, though earlier repositories hold the same identifier", async () => {
  const control = await listing([INSTANCE, PRODUCT, OTHER, THIRD]);
  assert.deepEqual([control.rows > 1, control.records > 1, control.live >= 1], [true, true, true], `known positive: the list reads records and asks the Bridge (${JSON.stringify(control)})`);
  open([INSTANCE, PRODUCT, OTHER, THIRD]);
  const target = await draw(jobRoute, context(), { id: SHARED, product: THIRD_URL });
  const facts = factsOf(target);
  assert.deepEqual(mentions(facts, "dev-i", "dev-a", "dev-b", "dev-c"), ["dev-c"], `the page of dave/third's record: ${facts}`);
  assert.deepEqual(recordsRead(), [`${THIRD}:docs/jobs/${SHARED}.md`]);
  assert.deepEqual(net.folderReads, [{ repository: THIRD, paths: ["docs/jobs/"] }]);
  assert.equal(liveAsked(), 1);
});

// TST-1269302 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: known positive first (TST-1269301's control). The same job identifier in bob/other and in dave/third and in neither the instance nor alice/product, which hold other jobs; bob/other's record names dev-b and dave/third's dev-c
// input: the route job drawn with that identifier and no product
// expect: the page shows bob/other's record — the first holder in the order the instance, alice/product, bob/other, dave/third — with the participant dev-b and not dev-c; the trees of the four repositories were read, each narrowed to docs/jobs/<id>.md and to nothing else; one record was read, bob/other's, and dave/third's record of the same identifier was not; the live state was asked once
// Planted fault: the holder taken from the end of the order (`sources.findLast` in place of `sources.find` in oneJob, src/main-page/jobs.mjs) shows dev-c and reads dave/third's record, and the case fails on the participant.
// Planted fault: the record of every holder read (`jobsOf(context, sources.filter((source) => source.snapshot?.paths.includes(path)))` in oneJob) reads the same identifier twice, and the case fails on the one record read.
test("TST-1269302 without a product, the page reads the one record of the first repository that holds the identifier, though a later one holds it too", async () => {
  const control = await listing([OTHER, THIRD]);
  assert.deepEqual([control.rows > 1, control.records > 1, control.live >= 1], [true, true, true], `known positive: the list reads records and asks the Bridge (${JSON.stringify(control)})`);
  open([OTHER, THIRD]);
  const target = await draw(jobRoute, context(), { id: SHARED });
  const facts = factsOf(target);
  assert.deepEqual(mentions(facts, "dev-i", "dev-a", "dev-b", "dev-c"), ["dev-b"], `the page of bob/other's record: ${facts}`);
  assert.deepEqual(net.folderReads.map(({ repository }) => repository).sort(), [INSTANCE, OTHER, PRODUCT, THIRD].sort(), "the tree of the instance and of each product");
  assert.deepEqual([...new Set(net.folderReads.flatMap(({ paths }) => paths))], ["docs/jobs/"], "each narrowed to the one record");
  assert.deepEqual(recordsRead(), [`${OTHER}:docs/jobs/${SHARED}.md`]);
  assert.equal(liveAsked(), 1);
});

// TST-1269303 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: known positive first (TST-1269301's control). The same job identifier in the instance and in alice/product, of the participants dev-i and dev-a
// input: the route job drawn with that identifier and no product
// expect: the page shows the instance's record — the instance comes before the products — with the participant dev-i and not dev-a; one record was read, the instance's, and alice/product's was not; the live state was asked once
// Planted fault: the products placed before the instance (`[...products, ...(listsInstance ? [own] : [])]` at the end of sourcesOf, src/main-page/sources.mjs) shows dev-a, and the case fails on the participant.
test("TST-1269303 without a product, the instance's record is the first holder's, before a product's of the same identifier", async () => {
  const control = await listing([INSTANCE, PRODUCT]);
  assert.deepEqual([control.rows > 1, control.records > 1, control.live >= 1], [true, true, true], `known positive: the list reads records and asks the Bridge (${JSON.stringify(control)})`);
  open([INSTANCE, PRODUCT]);
  const target = await draw(jobRoute, context(), { id: SHARED });
  const facts = factsOf(target);
  assert.deepEqual(mentions(facts, "dev-i", "dev-a", "dev-b", "dev-c"), ["dev-i"], `the page of the instance's record: ${facts}`);
  assert.deepEqual(recordsRead(), [`${INSTANCE}:docs/jobs/${SHARED}.md`]);
  assert.equal(liveAsked(), 1);
});

// TST-1269304 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: the instance and the three products of four job records each, and the same job identifier in alice/product and in bob/other
// input: the route jobs drawn
// expect: the list has a row for each of the eighteen jobs — the shared identifier once for each repository that holds it — and reads the tree of each of the four repositories whole, none narrowed to a path; it reads the eighteen records, each once, and asks the Bridge for the live states of the jobs without an end
// Planted fault: the list's trees narrowed (`readSource(source)` given the folders `["docs/jobs/x.md"]` in everyJob, src/main-page/jobs.mjs) lists no job, and the case fails on the rows.
test("TST-1269304 the list of every job is not narrowed: it reads every tree whole and every record", async () => {
  open([PRODUCT, OTHER]);
  const target = await draw(listRoute, context());
  assert.equal(byClass(target, "job").length, 18, "every job of the four repositories is a row, the shared identifier once for each holder");
  assert.deepEqual(net.folderReads, [], "no tree of the list is narrowed to named files");
  assert.equal(recordsRead().length, 18, "every record, once");
  assert.equal(liveAsked() >= 1, true, "the list asks the Bridge");
});
