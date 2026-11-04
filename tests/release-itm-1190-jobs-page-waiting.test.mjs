// Release tests of ITM-1190 — the page Jobs holds what waits for a person, and the main page links it. The behaviour is UC-036 (docs/use-cases/UC-036-inspect-running-jobs.md, step 2: "Above the list, Agent M shows what waits for a person across the instance: open use cases, open SPEC
// changes, gates waiting for a decision, and failed jobs, each linked to the page where it is decided. Then it shows one list across products") and UC-046 (docs/use-cases/UC-046-see-what-goes-on-in-the-instance.md, step 5: "Below the products, a link **Jobs** opens the page of every
// job and of what waits for a person (UC-036). The main page itself does not list what waits."), as docs/architecture/MOD-main-page.md (Interfaces: `home`, `jobs`) states it, and as ITM-1190 reads it (docs/backlog/ITM-1190-the-jobs-page-holds-what-waits-for-a-person.md).
// Run: node --test tests/release-itm-1190-jobs-page-waiting.test.mjs
//
// Module: MOD-main-page; MOD-progress-measures
// Guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036; UC-046
// Level: release
//
// Written for the release testing of sprint 124 by a participant who implemented none of ITM-1190 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the release tests of ITM-1280 (tests/main-page-home-harness.mjs: the fake GitHub, the Bridge lab-pc-4 and the
// browser) under the real routes `home` and `jobs` of MOD-main-page and the real MOD-progress-measures; the counts are read from the requests the fake received. The component tests of the item (tests/main-page-jobs-waits.test.mjs, tests/main-page-home.test.mjs) draw one
// route; these cases walk the person's path across the two pages, pressing the control the first page draws and drawing the route it names. Readings the texts leave open, which the cases state:
//   - the person's navigation is the ViewContext's `go`: the case presses the button, reads the route and parameters it called `go` with, and draws that route with those parameters, as the frame does; a route of another module (`use-case`, `spec-entry`, `job`) is not drawn here, its call is read.
//   - "what waits" is read by item: its kind and identifier as the list prints them ("use case: UC-002"), with " · <repository's path>" where the page reads more than one source ("Agent M" for the instance).
//   - "linked to the page where it is decided" is a button *Open* of the item that calls `go` with the route that decides the kind (`use-case`, `spec-entry`, `job`) and the item's identifier, and with `product: <the repository's address>` unless the item is the instance's own.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import {
  INSTANCE, OTHER, PRODUCT, OTHER_TOKEN, OTHER_URL, PRODUCT_TOKEN, PRODUCT_URL,
  browser, byClass, cardsOf, click, draw, failedJob, headOf, instanceFiles, network, smallProduct, timers, waitsOf,
} from "./main-page-home-harness.mjs";

const home = view.routes.find((candidate) => candidate.name === "home");
const jobs = view.routes.find((candidate) => candidate.name === "jobs");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const JOB = "JOB-20261016-1000-ffff";
const BOTH = { products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } };
const order = (target) => target.children.map((node) => (node.localName === "h2" ? `h2 ${node.textContent}` : node.localName === "table" ? "table.jobs" : `${node.localName}.${node.className.split(/\s+/)[0]}`));
const rowsOf = (target) => byClass(target, "job").map((row) => row.getAttribute("data-id"));
const overviewReads = (repository) => net.requests.filter((request) => request.url.includes("ref=overview-cache") && request.url.includes(`/repos/${repository}/`))
  .map((request) => new URL(request.url).pathname.replace(`/repos/${repository}/contents/`, ""));
const pullListings = (repository) => net.requests.filter((request) => new URL(request.url).pathname === `/repos/${repository}/pulls`).length;
// The overview stored for `commit`, in the format MOD-progress-measures' Data names, with the one use case `waiting` that waits.
const STORED = (commit, waiting) => JSON.stringify({ commit, waiting: [{ kind: "use case", id: waiting, path: `docs/use-cases/${waiting}-stored.md` }],
  shares: [{ stage: "Requirements", share: 1, detail: "stored" }], model: null, build: { states: [], records: [] }, queues: [] });
// The overview of a head in which nothing waits.
const QUIET = (commit) => JSON.stringify({ commit, waiting: [], shares: [], model: null, build: { states: [], records: [] }, queues: [] });

/** The person presses the button *Jobs* of the main page drawn in `page` and the page it names is drawn with the parameters `go` was given. -> the drawn page */
async function openJobs(context, page) {
  const link = byClass(page, "jobs-link");
  assert.equal(link.length, 1, "the main page draws one link Jobs");
  assert.equal(link[0].textContent, "Jobs");
  click(link[0]);
  const [route, params] = context.went.at(-1);
  assert.equal(route, "jobs");
  return draw(jobs, context, params);
}

// TST-1190301 · level: release · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; ONE DASHBOARD SHOWS EVERY JOB; UC-036; UC-046
// given: UC-046 step 5 and UC-036 step 2. the kept product alice/product with the open use case UC-002, an open SPEC change entry (queue 2026-10-01a_fixture, entry 1) and a failed job JOB-20261016-1000-ffff; the instance alice/agent-m, in which nothing waits; a token for each; no overview is stored
// input: the route home drawn; the person presses the button Jobs; the route jobs drawn with what the press gave to go
// expect: known positive first — the main page draws the card of alice/product; it draws the button Jobs below the cards and no list of what waits: no section of the class waits and no item; the press calls go once with the route "jobs" and no parameter; the page Jobs reads, in order, "h2 Every job", the section of what waits, the filters, the list and the explanations, and what waits reads "use case: UC-002", "SPEC change: spec-2026-10-01a_fixture-01" and "failed job: JOB-20261016-1000-ffff" (each with its product, since the page reads two sources, the instance and alice/product), and the failed job is also a row of the list
// Planted fault: the main page given back its list of what waits (`waitsList(…)` appended to the page that `render` draws in src/main-page/home.mjs, as before ITM-1190) fails the case on the section of what waits on the main page.
// Planted fault: the button Jobs left out of the main page (`el("p", "jobs-entry", jobs)` made `el("p", "jobs-entry")` in `render` of src/main-page/home.mjs) fails the case on the link, and TST-1190303 on the press.
// Planted fault: the page Jobs drawing no list of what waits (`waitsList(waits.items, { several, go: context.go }),` dropped from `render` in src/main-page/jobs.mjs) fails every case of this file.
test("TST-1190301 the main page links Jobs and lists nothing that waits, and the page Jobs lists what waits above the list of jobs", async () => {
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct({ queue: true, jobs: [failedJob({ id: JOB, by: "lab-pc-4" })] }) });
  net.install();
  const context = browser();
  const main = await draw(home, context);
  assert.equal(cardsOf(main).length, 1, "known positive: the card of alice/product is drawn");
  assert.deepEqual(byClass(main, "waits"), [], "the main page lists no section of what waits");
  assert.deepEqual(waitsOf(main), [], "the main page lists no item that waits");
  assert.deepEqual(context.went, []);
  const page = await openJobs(context, main);
  assert.deepEqual(context.went, [["jobs", {}]]);
  assert.deepEqual(order(page), ["h2 Every job", "section.waits", "p.filters", "table.jobs", "section.job-explanations"]);
  assert.deepEqual(waitsOf(page), ["use case: UC-002 · alice/product", "SPEC change: spec-2026-10-01a_fixture-01 · alice/product", `failed job: ${JOB} · alice/product`]);
  assert.deepEqual(rowsOf(page), [JOB], "the failed job is also a row of the list");
});

// TST-1190302 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-036
// given: UC-036 step 2 "what waits for a person across the instance". the instance alice/agent-m with the open use case UC-002, the kept products alice/product (UC-001 accepted, UC-002 open) and bob/other (both accepted); a token for each; no overview is stored
// input: the route jobs drawn; the Open of each item pressed in turn; then the page drawn again where alice/product's use cases are accepted too, and again where the instance's are accepted as well
// expect: what waits reads "use case: UC-002 · Agent M" and "use case: UC-002 · alice/product" and no item for bob/other, which has nothing waiting; nothing is called before the press; the presses call go with ["use-case", { id: "UC-002" }] for the instance's own item, with no product, and ["use-case", { id: "UC-002", product: "https://github.com/alice/product" }] for the product's, in the order listed; counter-proof: with alice/product's use cases accepted it reads "use case: UC-002 · Agent M" alone, and with the instance's accepted too the section says "Nothing waits for a person."
// Planted fault: the instance's repository left out of what waits (`sources.filter((each) => each.snapshot)` made `… && !each.own` in `waitsOf` of src/main-page/jobs.mjs) fails the case on the instance's item, and TST-1190303 on the reads of the instance.
// Planted fault: every item taken as the instance's own (`own: source.own` made `own: true` in `waitsOf` of src/main-page/jobs.mjs) sends no product with the product's call, and the case fails on the second call (TST-1190304 on both).
test("TST-1190302 the page Jobs lists what waits in the instance and in each kept product, each item opening the page that decides it, and a repository with nothing waiting adds none", async () => {
  net = network({ [INSTANCE]: smallProduct(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-001", "UC-002"] }) });
  net.install();
  const context = browser(BOTH);
  const page = await draw(jobs, context);
  assert.deepEqual(waitsOf(page), ["use case: UC-002 · Agent M", "use case: UC-002 · alice/product"]);
  assert.deepEqual(context.went, [], "nothing is called before the press");
  const buttons = byClass(page, "wait-link");
  assert.equal(buttons.length, 2);
  for (const button of buttons) click(button);
  assert.deepEqual(context.went, [["use-case", { id: "UC-002" }], ["use-case", { id: "UC-002", product: PRODUCT_URL }]]);

  net.restore();
  net = network({ [INSTANCE]: smallProduct(), [PRODUCT]: smallProduct({ accepted: ["UC-001", "UC-002"] }), [OTHER]: smallProduct({ accepted: ["UC-001", "UC-002"] }) });
  net.install();
  assert.deepEqual(waitsOf(await draw(jobs, browser(BOTH))), ["use case: UC-002 · Agent M"]);

  net.restore();
  net = network({ [INSTANCE]: smallProduct({ accepted: ["UC-001", "UC-002"] }), [PRODUCT]: smallProduct({ accepted: ["UC-001", "UC-002"] }), [OTHER]: smallProduct({ accepted: ["UC-001", "UC-002"] }) });
  net.install();
  const none = await draw(jobs, browser(BOTH));
  assert.deepEqual(waitsOf(none), []);
  assert.deepEqual(byClass(none, "waits").map((section) => section.textContent), ["What waits for a personNothing waits for a person."]);
});

// TST-1190303 · level: release · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-036; UC-046
// given: alice/product, whose branch overview-cache holds the overview of its head with UC-077 waiting (its files hold UC-002 open); bob/other, which holds none of its head but latest.json naming the older commit eee…e, whose overview holds UC-078 waiting; the instance alice/agent-m, which stores no overview; a token for each
// input: the route home drawn in a world of its own; the route home drawn, the press on Jobs and the route jobs drawn in a second; the route jobs drawn alone in a third; the requests to overview-cache and the listings of pull requests counted in the first and the third (each world is made again from the same files, so that no earlier page has read for it)
// expect: the main page reads what it read before the item — alice/product [<head>.json], bob/other [<head>.json, latest.json, eee…e.json], nothing of the instance's overview — and lists no pull request; known positive: a card for each product; after the press the page Jobs reads "use case: UC-077 · alice/product" and "use case: UC-078 · bob/other", the stored entries and not the open use cases the files hold, and neither product lists its pull requests; drawn alone, the page Jobs reads the same of the products (alice/product [<head>.json] one request, bob/other the three) and of alice/agent-m its head's overview and latest.json, and lists its pull requests once for the facts of the scope all, as its card on the main page would read it
// Planted fault: what waits derived from the facts although an overview is stored (`if (stored) return stored.waiting;` removed from `waitingOf` in src/main-page/waits.mjs) lists the pull requests of the products and reads their files' use cases, and the case fails on the items and the listings (TST-1190304 on the items).
// Planted fault: the overview stored last never read (`const latest = await latestOverview(snapshot);` made `const latest = null;` in `storedOf` of src/main-page/waits.mjs) fails the case on bob/other's reads and items.
test("TST-1190303 the main page reads what it did, and the page Jobs reads each repository's stored overview for what waits, else the facts of the instance alone", async () => {
  const head = headOf(PRODUCT), older = "e".repeat(40);
  const world = () => {
    net?.restore();
    net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }) });
    net.overviews[PRODUCT] = { [head]: STORED(head, "UC-077") };
    net.overviews[OTHER] = { [older]: STORED(older, "UC-078"), latest: `${JSON.stringify({ commit: older })}\n` };
    net.install();
    return browser(BOTH);
  };
  const reads = () => [overviewReads(PRODUCT), overviewReads(OTHER), overviewReads(INSTANCE)];
  const listings = () => [pullListings(INSTANCE), pullListings(PRODUCT), pullListings(OTHER)];
  const otherReads = [`${headOf(OTHER)}.json`, "latest.json", `${older}.json`];

  const context = world();
  const main = await draw(home, context);
  assert.deepEqual(reads(), [[`${head}.json`], otherReads, []]);
  assert.deepEqual(listings(), [0, 0, 0], "the main page lists no pull request");
  assert.equal(cardsOf(main).length, 2, "known positive: a card for each product");

  const second = world();
  const page = await openJobs(second, await draw(home, second));
  assert.deepEqual(waitsOf(page), ["use case: UC-077 · alice/product", "use case: UC-078 · bob/other"]);
  assert.equal(listings()[1] + listings()[2], 0, "neither product lists its pull requests");

  const alone = world();
  await draw(jobs, alone);
  assert.deepEqual(reads(), [[`${head}.json`], otherReads, [`${headOf(INSTANCE)}.json`, "latest.json"]]);
  assert.deepEqual(listings(), [1, 0, 0], "the instance's facts list its pull requests once");
});

// TST-1190304 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; A JOB STOPS AT EVERY GATE; UC-036
// given: UC-036 steps 2 and 5. alice/product, whose branch overview-cache holds the overview of its head with a gate waiting for a person at the job JOB-20261016-1000-aaaa (the gate's record is that job's) and a failed job JOB-20261016-1000-ffff; the instance alice/agent-m, in which nothing waits; a token for each
// input: the route jobs drawn; the Open of each of the two items pressed in turn
// expect: what waits reads "gate: Review the design · alice/product" and "failed job: JOB-20261016-1000-ffff · alice/product", the stored entries; each Open calls go with the page of the job whose record it is, ["job", { id: "JOB-20261016-1000-aaaa", product: "https://github.com/alice/product" }] and ["job", { id: "JOB-20261016-1000-ffff", product: "https://github.com/alice/product" }], where UC-036 step 5 shows the gate and the person decides it; nothing is called before the press
// Planted fault: the failed job's item sent to no page of the job (`return ["job", { id }]` for the kind "failed job" made `return ["process", {}]` in `placeOf` of src/main-page/waits.mjs) fails the case on the second call.
// Planted fault: the gate's item sent to no page of the job whose record it is (`return job ? ["job", { id: job[1] }] : ["process", {}]` made `return ["process", {}]` in `placeOf`) fails the case on the first call.
test("TST-1190304 a gate and a failed job that wait are listed from the stored overview, each opening the page of the job it concerns", async () => {
  const head = headOf(PRODUCT), gate = "JOB-20261016-1000-aaaa";
  const stored = JSON.stringify({ commit: head, shares: [], model: null, build: { states: [], records: [] }, queues: [],
    waiting: [{ kind: "gate", id: "Review the design", path: `docs/jobs/${gate}.md` }, { kind: "failed job", id: JOB, path: `docs/jobs/${JOB}.md` }] });
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct() });
  net.overviews[PRODUCT] = { [head]: stored };
  net.overviews[INSTANCE] = { [headOf(INSTANCE)]: QUIET(headOf(INSTANCE)) };
  net.install();
  const context = browser();
  const page = await draw(jobs, context);
  assert.deepEqual(waitsOf(page), ["gate: Review the design · alice/product", `failed job: ${JOB} · alice/product`]);
  assert.deepEqual(context.went, []);
  for (const button of byClass(page, "wait-link")) click(button);
  assert.deepEqual(context.went, [["job", { id: gate, product: PRODUCT_URL }], ["job", { id: JOB, product: PRODUCT_URL }]]);
});

// TST-1190305 · level: release · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: UC-036 step 2. the kept products alice/product, whose server refuses every request with a used-up limit, and bob/other with the open use case UC-002; the instance alice/agent-m, in which nothing waits; a token for each
// input: the route jobs drawn
// expect: known positive first — the page is drawn, with what waits and the list; what waits reads "use case: UC-002 · bob/other" alone, so that the refused repository adds no item; alice/product is named above the list, once, with its reason (the sentence the host gives for a used-up limit), as the list names any source it cannot read
// Planted fault: a source that could not be read also read for what waits (`sources.filter((each) => each.snapshot)` made `sources` in `waitsOf` of src/main-page/jobs.mjs) names alice/product a second time, "what waits could not be read", and the case fails on the sources named.
test("TST-1190305 a repository whose server refuses adds no item to what waits, is named above the list, and the others are listed", async () => {
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct() });
  net.refusing = { how: "limit", repository: PRODUCT };
  net.install();
  const page = await draw(jobs, browser(BOTH));
  assert.equal(byClass(page, "waits").length, 1, "known positive: the page is drawn with its section of what waits");
  assert.equal(byClass(page, "filters").length, 1, "known positive: the list of jobs is drawn");
  assert.deepEqual(waitsOf(page), ["use case: UC-002 · bob/other"]);
  const named = byClass(page, "source").map((node) => node.textContent);
  assert.equal(named.length, 1, "the refused repository is named once");
  assert.match(named[0], new RegExp(PRODUCT_URL.replace(/[.\/]/g, "\\$&")));
  assert.match(named[0], /limit/i, "with its reason");
});
