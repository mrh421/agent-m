// MOD-main-page's route `job` reads its own job (ITM-1269), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `job`) states it: "The route reads the one record
// `docs/jobs/<id>.md` — of the product the address names, else of the first repository among the instance and the kept products whose tree holds it — and asks the live state of that job
// alone; it reads no other job's record." The list `jobs` is not this file's; tests/main-page-jobs.test.mjs keeps it.
// Run: node --test tests/main-page-job-one-record.test.mjs
//
// Module: MOD-main-page
// Guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// Level: component
//
// The real MOD-job-ledger, MOD-runtimes, MOD-bridge-client, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked, by tests/main-page-home-harness.mjs: the
// counting fake of GitHub, which answers the query of named files a narrowed snapshot sends (`net.folderReads`), and the Bridge lab-pc-4, which lists one job as running. No request leaves the fixtures.
//
// The fixture: the instance alice/agent-m holds no job; the products alice/product, bob/other and dave/third, kept in this order, hold ten job records each, every one taken by the Bridge lab-pc-4 and
// not ended. JOB-20261016-1000-0000 stands in alice/product (participant dev-a) and in bob/other (participant dev-b, with inputs, a destination and parameters); a job identifier is unique within its
// product only (A JOB IDENTIFIER IS NEVER REUSED), so two products may hold the same one.
//
// Readings the texts leave open, which the tests state (the pull request names them):
//   - "reads the one record": a record read is a request for a file under docs/jobs/ — GitHub's contents API with a token, or a file under docs/jobs/ that GitHub's batch request of files' texts
//     (POST /graphql, `f<n>:object(expression: "<commit>:<path>")`) names, of the repository its variables name, since listJobs names the records to the snapshot's readMany (ITM-1280) —; the trees
//     are read narrowed to that one path, one query of named files each.
//   - "asks the live state of that job alone": the Bridge lab-pc-4 is asked for its list of jobs (GET /v1/jobs) once.
//   - Without `product`, the tree of every source is read — the instance's and each kept product's —, and the record of the first of them, in the order instance, then the products as kept, that holds it.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { INSTANCE, PRODUCT, PRODUCT_URL, PRODUCT_TOKEN, OTHER, OTHER_URL, OTHER_TOKEN, browser, byClass, draw, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

const job = view.routes.find((candidate) => candidate.name === "job");
let net, batched = [];
afterEach(() => {
  net?.restore();
  timers.restore();
});

const THIRD = "dave/third";
const THIRD_URL = `https://github.com/${THIRD}`;
const THIRD_TOKEN = "github_pat_ITM1269THIRD0123456789abcdefghij";
const ID = "JOB-20261016-1000-0000";
const PLANTED = "JOB-20261016-1001-0001";
const at = (text) => new Date(`${text}:00Z`);

/** A job record of the kind implement-item for ITM-0900, taken by the Bridge lab-pc-4 and not ended, of `participant`, with the inputs, destinations and parameters given. */
function record(id, participant, { inputs = [], destinations = [], params = {} } = {}) {
  const { path, text } = startRecord({ id, kind: "implement-item", worksOn: ["ITM-0900"], participant, model: "model-x", route: "bridge lab-pc-4", run: null, retries: null, startedBy: "alice",
    start: at("2026-10-16T10:00"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs, limit: 5, task: "in parameters", conversation: null, destinations, params });
  return { path, text: appendToRecord(text, { part: "taken", at: at("2026-10-16T10:00"), by: "lab-pc-4" }) };
}
/** Ten records of a product: `first` (the job of the test, or another) and nine more of `participant`, JOB-20261016-10<nn>-<tag><nnn>. */
const tenOf = (tag, participant, first) => [first, ...Array.from({ length: 9 }, (_, n) => record(`JOB-20261016-10${String(n + 1).padStart(2, "0")}-${tag}${String(n + 1).padStart(3, "0")}`, participant))];

function open() {
  const inA = record(ID, "dev-a");
  const inB = record(ID, "dev-b", { inputs: ["docs/use-cases/UC-001-first.md", "SPEC.md"], destinations: [{ participant: "dev-b", place: "lab-pc-4", parts: ["the chosen item", "SPEC.md"] }], params: { item: "ITM-0900" } });
  const ofB = [inB, ...tenOf("b", "dev-b", record(PLANTED, "dev-b")).slice(0, 9)];
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct({ jobs: tenOf("a", "dev-a", inA) }), [OTHER]: smallProduct({ jobs: ofB }), [THIRD]: smallProduct({ jobs: tenOf("c", "dev-c", record("JOB-20261016-1000-c000", "dev-c")) }) },
    { bridgeLists: ID });
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
const one = (target, name) => byClass(target, name)[0];
const textsOf = (target, name) => byClass(target, name).map((node) => node.textContent);

// TST-1269001 · level: component · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: the instance and three kept products of ten job records each, all running on the Bridge lab-pc-4; JOB-20261016-1000-0000 in alice/product (dev-a) and in bob/other (dev-b, inputs docs/use-cases/UC-001-first.md and SPEC.md, the destination dev-b at lab-pc-4 with "the chosen item" and "SPEC.md", the parameters { "item": "ITM-0900" }), and beside it in bob/other the planted record of JOB-20261016-1001-0001
// input: the route job drawn with params { id: "JOB-20261016-1000-0000", product: "https://github.com/bob/other" } — the address #job/id=JOB-20261016-1000-0000/product=https://github.com/bob/other
// expect: the page main-page-job.test.mjs expects, of bob/other's record: the heading "Job JOB-20261016-1000-0000"; the facts name https://github.com/bob/other, ITM-0900, implement-item, dev-b, lab-pc-4 and running; the inputs, the destination and the parameters of that record. One record was read, bob/other's docs/jobs/JOB-20261016-1000-0000.md; one tree was read, bob/other's, narrowed to that path; the live state was asked once; counter-proof: the planted record JOB-20261016-1001-0001 beside it was not read, nor any record of alice/product or dave/third (the list's reading reads all thirty)
test("TST-1269001 a job's page for a named product reads that product's one record and asks one live state", async () => {
  open();
  const target = await draw(job, context(), { id: ID, product: OTHER_URL });
  assert.equal(byClass(target, "job-facts").length, 1, "known positive: the page is drawn");
  assert.equal(target.textContent.includes(`Job ${ID}`), true);
  const facts = one(target, "job-facts").textContent;
  for (const part of [OTHER_URL, "ITM-0900", "implement-item", "dev-b", "lab-pc-4", "running"]) assert.equal(facts.includes(part), true, `the facts name ${part}`);
  assert.deepEqual(textsOf(target, "job-input"), ["docs/use-cases/UC-001-first.md", "SPEC.md"]);
  assert.deepEqual(textsOf(target, "job-destination"), ["dev-b, at lab-pc-4: the chosen item, SPEC.md."]);
  assert.equal(one(target, "job-params").textContent, JSON.stringify({ item: "ITM-0900" }, null, 2));
  assert.deepEqual(recordsRead(), [`${OTHER}:docs/jobs/${ID}.md`], "one record, of bob/other");
  assert.equal(recordsRead().includes(`${OTHER}:docs/jobs/${PLANTED}.md`), false, "the planted record beside it is not read");
  assert.deepEqual(net.folderReads, [{ repository: OTHER, paths: ["docs/jobs/"] }], "bob/other's tree alone, narrowed to the one record");
  assert.equal(liveAsked(), 1, "one live state");
});

// TST-1269002 · level: component · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: the fixture of TST-1269001
// input: the route job drawn with params { id: "JOB-20261016-1000-0000" } — no product named
// expect: the page of the first repository among the instance and the kept products whose tree holds the record — alice/product, whose facts name dev-a and not dev-b; the trees of the instance and of the three products were read, each narrowed to docs/jobs/JOB-20261016-1000-0000.md; one record was read, alice/product's; the live state was asked once; counter-proof: bob/other's record of the same identifier and the planted record were not read
test("TST-1269002 a job's page without a product reads the trees, then the one record of the first repository that holds it", async () => {
  open();
  const target = await draw(job, context(), { id: ID });
  assert.equal(byClass(target, "job-facts").length, 1, "known positive: the page is drawn");
  const facts = one(target, "job-facts").textContent;
  assert.deepEqual([facts.includes(PRODUCT_URL), facts.includes("dev-a"), facts.includes("dev-b")], [true, true, false]);
  assert.deepEqual(net.folderReads.map(({ repository }) => repository).sort(), [INSTANCE, OTHER, PRODUCT, THIRD].sort(), "the tree of the instance and of each product");
  assert.deepEqual([...new Set(net.folderReads.flatMap(({ paths }) => paths))], ["docs/jobs/"], "each narrowed to the one record");
  assert.deepEqual(recordsRead(), [`${PRODUCT}:docs/jobs/${ID}.md`], "one record, of alice/product");
  assert.equal(liveAsked(), 1, "one live state");
});
