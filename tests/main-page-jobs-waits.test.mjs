// MOD-main-page's route `jobs` — what waits for a person, above the list of jobs (ITM-1190), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `jobs`) and UC-036 step 2 state
// it: "first, what waits for a person across the instance, each item linked to the page where it is decided (MOD-progress-measures' `waitingForAPerson`, from the instance's own stored overview where
// there is one); then every job of every product and of the instance in one list"; UC-036 step 2: "Above the list, Agent M shows what waits for a person across the instance: open use cases, open
// SPEC changes, gates waiting for a decision, and failed jobs, each linked to the page where it is decided."
// Run: node --test tests/main-page-jobs-waits.test.mjs
//
// Module: MOD-main-page
// Guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; ONE DASHBOARD SHOWS EVERY JOB; A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036; UC-046
// Level: unit
//
// The real MOD-progress-measures, MOD-job-ledger, MOD-runtimes, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked, by tests/main-page-home-harness.mjs
// over the counting fake GitHub of tests/progress-measures-load.mjs. No request leaves the fixtures; nothing sleeps. Every expected value is written in this file's own text.
//
// Readings the texts leave open, which the tests state (the pull request names them):
//   - "Across the instance" covers the instance and each product this browser keeps. Each repository's list is read as its card on `home` reads its overview (MOD-main-page, Interfaces `home`): the
//     overview stored for its head (one request of `<head>.json` on the branch overview-cache), else the one `latest.json` names (two requests more), else waitingForAPerson of its facts of the scope
//     `all`, which lists the pull requests among other things.
//   - What waits is a <section class="waits"> below the page's heading "Every job" and above the list (<table class="jobs">), drawn by the same waitsList the main page drew it with: <li class="wait">
//     reading "<kind>: <id>", and " · <product>" — the repository's path, or "Agent M" for the instance — where the route reads more than one source; without an item, "Nothing waits for a person.".
//     Each item has an "Open" button (.wait-link) that calls the ViewContext's go(route, params), with `product: <its address>` unless the item is the instance's own.
//   - A source that cannot be read adds no item; it is named once above the list, as the list names it (<li class="source">).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import {
  INSTANCE, OTHER, PRODUCT, MISSING_URL, OTHER_TOKEN, OTHER_URL, PRODUCT_TOKEN, PRODUCT_URL,
  browser, byClass, click, draw, failedJob, find, headOf, instanceFiles, network, smallProduct, timers, waitsOf,
} from "./main-page-home-harness.mjs";

const jobs = view.routes.find((candidate) => candidate.name === "jobs");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const JOB = "JOB-20261016-1000-ffff";
const BOTH = { products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } };
// The overview stored for `commit`, in the format MOD-progress-measures' Data names, with the one use case `waiting` that waits.
const STORED = (commit, waiting) => JSON.stringify({ commit, waiting: [{ kind: "use case", id: waiting, path: `docs/use-cases/${waiting}-stored.md` }],
  shares: [{ stage: "Requirements", share: 1, detail: "stored" }], model: null, build: { states: [], records: [] }, queues: [] });
// The requests to the branch overview-cache of `repository`, each as the file it asks for.
const overviewReads = (repository) => net.requests.filter((request) => request.url.includes("ref=overview-cache") && request.url.includes(`/repos/${repository}/`))
  .map((request) => new URL(request.url).pathname.replace(`/repos/${repository}/contents/`, ""));
const pullListings = (repository) => net.requests.filter((request) => new URL(request.url).pathname === `/repos/${repository}/pulls`).length;
// The elements of the page in the order they stand, by the class or the tag they are known by.
const order = (target) => target.children.map((node) => (node.localName === "h2" ? `h2 ${node.textContent}` : node.localName === "table" ? "table.jobs" : `${node.localName}.${node.className.split(/\s+/)[0]}`));

// TST-1190001 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-036
// given: the instance alice/agent-m, in which nothing waits, and the kept products alice/product (UC-001 accepted, UC-002 open) and bob/other (UC-002 accepted, UC-001 open), each with its token; no repository stores an overview
// input: the route jobs drawn; then drawn where bob/other's two use cases are accepted; then where alice/product's are accepted too
// expect: the page reads, in order, "h2 Every job", the section of what waits, the filters and the list (table.jobs), the explanations; what waits reads "use case: UC-002 · alice/product" and "use case: UC-001 · bob/other"; counter-proof: with bob/other's use cases accepted, it reads "use case: UC-002 · alice/product" alone — a product with nothing waiting adds no entry —, and with both products' accepted no item is listed and the section says "Nothing waits for a person."
test("TST-1190001 the route jobs draws what waits for a person across the instance above the list, each item with its product", async () => {
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }) });
  net.install();
  const target = await draw(jobs, browser(BOTH));
  assert.deepEqual(order(target), ["h2 Every job", "section.waits", "p.filters", "table.jobs", "section.job-explanations"]);
  assert.deepEqual(waitsOf(target), ["use case: UC-002 · alice/product", "use case: UC-001 · bob/other"]);

  net.restore();
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-001", "UC-002"] }) });
  net.install();
  assert.deepEqual(waitsOf(await draw(jobs, browser(BOTH))), ["use case: UC-002 · alice/product"]);

  net.restore();
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct({ accepted: ["UC-001", "UC-002"] }), [OTHER]: smallProduct({ accepted: ["UC-001", "UC-002"] }) });
  net.install();
  const none = await draw(jobs, browser(BOTH));
  assert.deepEqual(waitsOf(none), []);
  assert.deepEqual(byClass(none, "waits").map((section) => section.textContent), ["What waits for a personNothing waits for a person."]);
});

// TST-1190002 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-036
// given: alice/product, whose branch overview-cache holds the overview of its head with UC-077 waiting (its files hold UC-002 open); bob/other, whose branch holds no overview of its head but latest.json naming the older commit eee…e, whose overview holds UC-078 waiting; the instance alice/agent-m, which stores no overview
// input: the route jobs drawn; the requests to each repository's branch overview-cache and its listings of pull requests counted
// expect: what waits reads "use case: UC-077 · alice/product" and "use case: UC-078 · bob/other" — the stored entries, not the open use cases the files hold —; the reads of overview-cache are alice/product [<its head>.json] (one request), bob/other [<its head>.json, latest.json, eee…e.json] (two more) and alice/agent-m [<its head>.json, latest.json]; the pull requests are listed by alice/agent-m once, whose list is read from its facts of the scope all, and by neither product; counter-proof: with nothing stored on alice/product's branch, its line reads "use case: UC-002 · alice/product" and its pull requests are listed once (known positive: the count sees the listing)
test("TST-1190002 each repository's list is read from the overview stored for its head, else the one stored last, else its facts, and the reads are counted", async () => {
  const head = headOf(PRODUCT), older = "e".repeat(40);
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }) });
  net.overviews[PRODUCT] = { [head]: STORED(head, "UC-077") };
  net.overviews[OTHER] = { [older]: STORED(older, "UC-078"), latest: `${JSON.stringify({ commit: older })}\n` };
  net.install();
  const target = await draw(jobs, browser(BOTH));
  assert.deepEqual(waitsOf(target), ["use case: UC-077 · alice/product", "use case: UC-078 · bob/other"]);
  assert.deepEqual(overviewReads(PRODUCT), [`${head}.json`]);
  assert.deepEqual(overviewReads(OTHER), [`${headOf(OTHER)}.json`, "latest.json", `${older}.json`]);
  assert.deepEqual(overviewReads(INSTANCE), [`${headOf(INSTANCE)}.json`, "latest.json"]);
  assert.deepEqual([pullListings(INSTANCE), pullListings(PRODUCT), pullListings(OTHER)], [1, 0, 0]);

  net.restore();
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }) });
  net.overviews[OTHER] = { [older]: STORED(older, "UC-078"), latest: `${JSON.stringify({ commit: older })}\n` };
  net.install();
  const derived = await draw(jobs, browser(BOTH));
  assert.deepEqual(waitsOf(derived), ["use case: UC-002 · alice/product", "use case: UC-078 · bob/other"]);
  assert.equal(pullListings(PRODUCT), 1, "known positive: without a stored overview the pull requests are listed, and the count sees it");
});

// TST-1190003 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-036; UC-046
// given: the kept product alice/product with the open use case UC-002, an open SPEC change entry (queue 2026-10-01a_fixture, entry 1) and a failed job JOB-20261016-1000-ffff; the browser's ViewContext records every call of go(route, params)
// input: the route jobs drawn; the "Open" button of each of the three items pressed in turn
// expect: three items wait, each with one button; pressing them calls go exactly as ["use-case", { id: "UC-002", product: "https://github.com/alice/product" }], ["spec-entry", { id: "spec-2026-10-01a_fixture-01", product: … }] and ["job", { id: "JOB-20261016-1000-ffff", product: … }], in the order of the list, and nothing before the press; counter-proof: where no product is kept and the instance holds the open use case UC-002, the item reads "use case: UC-002" with no product and its call is ["use-case", { id: "UC-002" }] with no product
test("TST-1190003 each item that waits for a person opens the page where it is decided, through the ViewContext's go", async () => {
  net = network({ [PRODUCT]: smallProduct({ queue: true, jobs: [failedJob({ id: JOB, by: "lab-pc-4" })] }), [INSTANCE]: instanceFiles() });
  net.install();
  const context = browser();
  const target = await draw(jobs, context);
  assert.equal(waitsOf(target).length, 3);
  assert.deepEqual(context.went, []);
  const buttons = byClass(target, "wait-link");
  assert.equal(buttons.length, 3);
  for (const button of buttons) click(button);
  const product = { product: PRODUCT_URL };
  assert.deepEqual(context.went, [["use-case", { id: "UC-002", ...product }], ["spec-entry", { id: "spec-2026-10-01a_fixture-01", ...product }], ["job", { id: JOB, ...product }]]);

  net.restore();
  net = network({ [INSTANCE]: smallProduct(), [PRODUCT]: smallProduct() });
  net.install();
  const own = browser({ products: [] });
  const ownTarget = await draw(jobs, own);
  assert.deepEqual(waitsOf(ownTarget), ["use case: UC-002"]);
  click(byClass(ownTarget, "wait-link")[0]);
  assert.deepEqual(own.went, [["use-case", { id: "UC-002" }]]);
});

// TST-1190004 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: this browser keeps alice/product (UC-002 open) and carol/missing, which the server does not find
// input: the route jobs drawn
// expect: what waits reads "use case: UC-002 · alice/product" alone; carol/missing adds no item and is named once above the list, "https://github.com/carol/missing: https://github.com/carol/missing was not found — a private repository is found only with a token that reaches it."; counter-proof: with carol/missing left out, no source is named and the same item is listed
test("TST-1190004 a source that cannot be read adds no item and is named once; what waits in the others is listed", async () => {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(jobs, browser({ products: [PRODUCT_URL, MISSING_URL] }));
  assert.deepEqual(waitsOf(target), ["use case: UC-002 · alice/product"]);
  assert.deepEqual(byClass(target, "source").map((node) => node.textContent), [`${MISSING_URL}: ${MISSING_URL} was not found — a private repository is found only with a token that reaches it.`]);

  const clean = await draw(jobs, browser({ products: [PRODUCT_URL] }));
  assert.deepEqual(byClass(clean, "source"), []);
  assert.deepEqual(waitsOf(clean), ["use case: UC-002 · alice/product"]);
  assert.equal(find(clean, (node) => node.localName === "table").length, 1, "known positive: the list is drawn");
});
