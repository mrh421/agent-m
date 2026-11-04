// MOD-main-page's route `home` — the stages, what is being built (ITM-827) and the link Jobs (ITM-1190), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `view`, `home`)
// and UC-046 (steps 3 to 5) state it: "one card per product this browser keeps, each with its name, its process model, its bar of six stages each filled by its share, the stage it is in
// marked, … and its build — the steps or items in progress, each with the job working on it, its participant, state and elapsed time; without a product, Agent M's own card from the
// instance repository; … below the cards, the link *Jobs* to the route `jobs`"; UC-046 step 5: "The main page itself does not list what waits." What waits is listed on the route `jobs`
// (tests/main-page-jobs-waits.test.mjs).
// Run: node --test tests/main-page-home.test.mjs
//
// Module: MOD-main-page
// Guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; THE BUILD IS SHOWN AS IT HAPPENS; WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; A PAGE LOAD READS THE REPOSITORY IN BATCHES; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-046; THE MENU FOLLOWS THE PROCESS; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// Each test states its input and its expected values in its own text (given / input / expect); no expected value is read from a document. The real MOD-progress-measures, MOD-job-ledger,
// MOD-runtimes, MOD-bridge-client, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked, by the helper tests/main-page-home-harness.mjs. No request
// leaves the fixtures; nothing sleeps.
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - A card is <article class="card"> with <h2> its name, <a class="card-repo"> its address, <p class="card-model"> "Developed with <model>" or, where the product declares none, "Its process
//     is chosen when implementation starts", and <ol class="stages"> of six <li class="stage" data-stage="<name>"> each with a .stage-share ("75 %", or "?" for a stage without a share) and a
//     .stage-detail; the stage the product is in is also <li class="stage is-current">. The build is <li class="build-row"> with .build-item, .build-job, .build-participant, .build-state and
//     .build-elapsed ("2h 0m 0s", as the route `jobs` writes it).
//   - The page holds no list of what waits: no <section class="waits"> and no <li class="wait">.
//   - A card whose repository cannot be read is <article class="card is-error"> with the reason its host gives; the other cards are drawn.
//   - A link is a <button type="button"> that calls the ViewContext's go(route, params): "Jobs" below the cards (.jobs-link, the link *Jobs*), "+ Add product" (.add-product, only beside Agent M's
//     own card) and "Open the token's setting" (.token-setting, in a card that could not be read). The routes are jobs, add-product and settings. No address is written by the page.
//   - The page draws a greeting with its folded explanation and a link from each stage (ITM-829; TST-829001, TST-829002), and *Get your own Agent M* (ITM-655; tests/main-page-get-your-own.test.mjs).
//   - While the page is open it reads the jobs' states again once a minute (MOD-main-page, Data: "at an interval the repository servers' rate limits allow"): the timer is a setTimeout of 60,000 milliseconds,
//     set when the cards are drawn and again after each reading, and a test fires it itself at a clock it names. A reading is made for each card that was read and whose repository this browser keeps a token
//     for (without one the network's limit is 60 requests an hour, which readings once a minute would use up): the default branch's snapshot — its commit and its tree, two requests — and the rows listJobs
//     derives from it with the live state of each job that has not ended; a record that changed is read by a request of its own. The stages, the shares, the plan,
//     the pull requests and what waits stay as they were drawn; the build's rows move. A reading that fails leaves the cards as drawn and adds <p class="warn reread-problem"> reading "The jobs' states could
//     not be read again. <product>: <the host's reason>", which the next reading that succeeds removes. Once the cards are no longer a child of the element they were drawn into, no reading is made.
//     While the tab is hidden (`document.visibilityState` is "hidden", MOD-main-page, Data: "except while its tab is hidden") the page starts no reading and sets no timer; when `visibilitychange` shows
//     the tab again it reads at once each card whose reading fell due meanwhile and leaves the others to their time; a reading in flight is not started again (TST-858001 to TST-858006).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { sourceStrategies } from "../src/source-register/index.mjs";
import { productCard } from "../src/main-page/cards.mjs";
import { chosenProduct } from "../src/site-frame/index.mjs";
import {
  INSTANCE, OTHER, PRODUCT, INSTANCE_TOKEN, INSTANCE_URL, MISSING_URL, OTHER_TOKEN, OTHER_URL, PRODUCT_TOKEN, PRODUCT_URL, RATE_RESET,
  browser, buildOf, byClass, cardsOf, click, countReads, currentOf, draw, endedJob, find, headOf, instanceFiles, network, productFiles, runningJob, smallProduct, stagesOf, timers, visibility, waitsOf, withEnd,
} from "./main-page-home-harness.mjs";

const home = view.routes.find((candidate) => candidate.name === "home");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const JOB = "JOB-20261016-1000-ffff";
const RUNNING = runningJob({ id: JOB, by: "lab-pc-4" });
const SMALL = () => smallProduct({ jobs: [RUNNING] });

// TST-827001 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
// given: the module's view
// input: its routes and its strategies read
// expect: the routes are exactly [home, jobs, job], home the first (the frame shows the first route for an address that names none); home is named "home", titled "Agent M", sits under no entry of the menu (entry null) and keeps the frame's default subject (no `subject`); the strategies are exactly [sourceStrategies] of MOD-source-register
test("TST-827001 the view hands the frame the routes home and jobs, home first, and the strategies of the source register", () => {
  assert.deepEqual(view.routes.map((candidate) => candidate.name), ["home", "jobs", "job"]);
  assert.equal(home.title, "Agent M");
  assert.equal(home.entry, null);
  assert.equal("subject" in home, false);
  assert.equal(typeof home.render, "function");
  assert.deepEqual(view.strategies, [sourceStrategies]);
});

// TST-827002 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-046
// given: this browser keeps the product alice/product, which holds two requirements, two use cases of which UC-001 is accepted, one backlog item, no architecture file, no tag and no declared process model
// input: the route home drawn
// expect: one card named "alice/product", its address https://github.com/alice/product, saying "Its process is chosen when implementation starts", with six stages in this order — Requirements 100 % "2 requirements, no change open", Use cases 50 % "1 of 2 accepted", Architecture 0 % "not designed yet", Implementation ? "the process is configured when implementation starts", Tests 0 % "0 of 2 requirements guarded by a passing test", Release 0 % "no release yet" — and the stage it is in marked: Use cases, and only it; counter-proof: with both use cases accepted, Use cases reads 100 % "2 of 2 accepted" and the stage marked is Architecture
test("TST-827002 a kept product has a card with its six stages, each with its share, and the stage it is in marked", async () => {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser());
  const [card, ...others] = cardsOf(target);
  assert.equal(others.length, 0);
  assert.equal(byClass(card, "card-head")[0].children[0].textContent, "alice/product");
  assert.equal(byClass(card, "card-repo")[0].getAttribute("href"), PRODUCT_URL);
  assert.equal(byClass(card, "card-model")[0].textContent, "Its process is chosen when implementation starts");
  assert.deepEqual(stagesOf(card), [
    ["Requirements", "100 %", "2 requirements, no change open"], ["Use cases", "50 %", "1 of 2 accepted"], ["Architecture", "0 %", "not designed yet"],
    ["Implementation", "?", "the process is configured when implementation starts"], ["Tests", "0 %", "0 of 2 requirements guarded by a passing test"], ["Release", "0 %", "no release yet"],
  ]);
  assert.deepEqual(currentOf(card), ["Use cases"]);

  net.restore();
  net = network({ [PRODUCT]: smallProduct({ accepted: ["UC-001", "UC-002"] }), [INSTANCE]: instanceFiles() });
  net.install();
  const both = cardsOf(await draw(home, browser()))[0];
  assert.deepEqual(stagesOf(both)[1], ["Use cases", "100 %", "2 of 2 accepted"]);
  assert.deepEqual(currentOf(both), ["Architecture"]);
});

// TST-827003 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: the product of TST-827002 with UC-001 accepted, the item ITM-0900 that builds on it and a job record JOB-20261016-1000-ffff of dev-cli for ITM-0900, taken by the Bridge lab-pc-4 and not ended, started at 10:00 UTC; the clock at 12:00 UTC; this browser keeps lab-pc-4, which lists that job as running
// input: the route home drawn; and drawn again where lab-pc-4 lists no job
// expect: the build holds one row, ["ITM-0900", "JOB-20261016-1000-ffff", "dev-cli", "running", "2h 0m 0s"], and lab-pc-4 was asked exactly once; counter-proof: where the Bridge lists no job, the same row is ["ITM-0900", "JOB-20261016-1000-ffff", "dev-cli", "ended without record", "0h 0m 0s"] — the state and the elapsed time come from what the runtime reports (MOD-job-ledger counts a job's time only while its runtime knows it), and not from the record alone; a product whose item has no job has no build
test("TST-827003 the build lists the item in progress with its job, participant, state and elapsed time, the state as the job's runtime reports it", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const card = cardsOf(await draw(home, browser()))[0];
  assert.deepEqual(buildOf(card), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.equal(net.bridgeAsked(), 1);

  net.restore();
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: null });
  net.install();
  assert.deepEqual(buildOf(cardsOf(await draw(home, browser()))[0]), [["ITM-0900", JOB, "dev-cli", "ended without record", "0h 0m 0s"]]);

  net.restore();
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  assert.deepEqual(buildOf(cardsOf(await draw(home, browser()))[0]), []);
  assert.equal(net.bridgeAsked(), 0);
});

// TST-827004 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// given: the kept products alice/product (UC-001 accepted, UC-002 open) and bob/other (UC-002 accepted, UC-001 open), so that something waits in each; the browser's ViewContext records every call of go(route, params); and, for the counter-proof, a browser that keeps no product
// input: the route home drawn with both products; the button "Jobs" pressed; the route drawn with no product kept
// expect: the page holds no list of what waits — no section of the class waits and no item of the class wait —; below the two cards stands one button "Jobs" (type button, class jobs-link), the last control of the page, which calls nothing before the press and go("jobs", {}) once when pressed; counter-proof: with no product kept, the button "Jobs" stands below Agent M's card and + Add product, and there is still no list of what waits
test("TST-827004 the route home draws the link Jobs below the cards, which opens the route jobs, and no list of what waits", async () => {
  net = network({ [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() });
  net.install();
  const context = browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } });
  const target = await draw(home, context);
  assert.equal(cardsOf(target).length, 2);
  assert.deepEqual(byClass(target, "waits"), []);
  assert.deepEqual(waitsOf(target), []);
  const [link, ...more] = byClass(target, "jobs-link");
  assert.equal(more.length, 0);
  assert.equal(link.textContent, "Jobs");
  assert.equal(link.getAttribute("type"), "button");
  const controls = find(target, (node) => node.localName === "button" || node.localName === "a");
  assert.equal(controls.at(-1), link, "the link Jobs stands below the cards");
  assert.deepEqual(context.went, []);
  click(link);
  assert.deepEqual(context.went, [["jobs", {}]]);

  const own = await draw(home, browser({ products: [] }));
  const ownControls = find(own, (node) => node.localName === "button");
  assert.deepEqual(ownControls.slice(-2).map((node) => node.textContent), ["+ Add product", "Jobs"]);
  assert.deepEqual(byClass(own, "waits"), []);
});

// TST-827005 · level: unit · module: MOD-main-page
// guards: WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; UC-046
// given: this browser keeps no product; the instance alice/agent-m holds the files of the product of TST-827002
// input: the route home drawn; and drawn where the browser keeps the product alice/product
// expect: one card named "Agent M" at https://github.com/alice/agent-m, whose stages are read from the instance repository (Use cases 50 % "1 of 2 accepted"); counter-proof: with a product kept, no card is named "Agent M" and the product's is
test("TST-827005 while this browser keeps no product, the one card is Agent M's own, read from the instance repository", async () => {
  net = network({ [INSTANCE]: smallProduct(), [PRODUCT]: productFiles({ items: 1, jobs: 0 }) });
  net.install();
  const own = cardsOf(await draw(home, browser({ products: [] })));
  assert.equal(own.length, 1);
  assert.equal(byClass(own[0], "card-head")[0].children[0].textContent, "Agent M");
  assert.equal(byClass(own[0], "card-repo")[0].getAttribute("href"), INSTANCE_URL);
  assert.deepEqual(stagesOf(own[0])[1], ["Use cases", "50 %", "1 of 2 accepted"]);

  const kept = cardsOf(await draw(home, browser({ products: [PRODUCT_URL] })));
  assert.deepEqual(kept.map((card) => byClass(card, "card-head")[0].children[0].textContent), ["alice/product"]);
});

// TST-827006 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: this browser keeps the product alice/product of 600 backlog items, 400 job records, SPEC.md and one test file, with a token for it and one for the instance, whose repository holds its participant list
// input: the route home drawn; the fake's requests counted
// expect: 27 requests in all — the repository 2 (the instance's and the product's), each with the GraphQL request of greenToMerge beside it (ITM-1170) 2, the commits 3 (the instance's main, the product's main and test-results), the trees 2, the pull requests 1, the tags 1, the CI runs of the product's head 1, the overview of the product's head and the file latest.json of its branch overview-cache 1 each (it holds neither; with a token they are read from the branch, not by the fake's file log) and 13 batch requests of at most a hundred files; not one file is read by a request of its own; no facts file is asked for; every request carries an Authorization header
test("TST-827006 with a token, the route home reads 600 items and 400 job records in 13 batches, 27 requests in all", async () => {
  net = network({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser());
  const kinds = {};
  for (const { kind } of net.server.log) kinds[kind] = (kinds[kind] ?? 0) + 1;
  assert.equal(cardsOf(target).length, 1);
  assert.equal(byClass(target, "is-error").length, 0);
  assert.equal(net.requests.length, 27);
  // ITM-1170: the fake logs every POST /graphql as a batch; 2 of the 15 are the GraphQL requests of greenToMerge beside the two repositoryInfo calls.
  assert.deepEqual(kinds, { repository: 2, commit: 3, tree: 2, "pull requests": 1, tags: 1, "ci runs": 1, batch: 15 });
  assert.deepEqual(net.requests.filter((request) => request.url.includes(".facts.json")), []);
  assert.deepEqual(net.server.log.filter((entry) => entry.kind === "file"), []);
  assert.deepEqual(net.requests.filter((request) => request.authorization === null), []);
});

// TST-827007 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the product, the instance and the browser of TST-827006, with no token stored for the instance or the product, so that the host has no batch request and every file is read by a request of its own
// input: the route home drawn; the fake's requests counted
// expect: 1,015 requests in all — the repository 2, the commits 3, the trees 2, the pull requests 1, the tags 1, the CI runs of the product's head 1, the overview of the product's head and the file latest.json of its branch overview-cache 1 each (it holds neither; from the raw host, the 1,004th and 1,005th file read) and 1,003 files each by a request of its own (the 600 items, the 400 job records, SPEC.md, the test file and the instance's participant list); no batch request; no facts file is asked for; no request carries an Authorization header
test("TST-827007 without a token, the route home reads every file by a request of its own, 1,015 requests in all", async () => {
  net = network({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser({ tokens: {}, instanceToken: null }));
  const kinds = {};
  for (const { kind } of net.server.log) kinds[kind] = (kinds[kind] ?? 0) + 1;
  assert.equal(byClass(target, "is-error").length, 0);
  assert.equal(net.requests.length, 1015);
  assert.deepEqual(kinds, { repository: 2, commit: 3, tree: 2, "pull requests": 1, tags: 1, "ci runs": 1, file: 1005 });
  assert.deepEqual(net.requests.filter((request) => request.url.includes(".facts.json")), []);
  assert.deepEqual(net.requests.filter((request) => request.authorization !== null), []);
});

// TST-827008 · level: unit · module: MOD-main-page
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-046
// given: this browser keeps the product alice/product with its own token and the instance with the instance's token
// input: the route home drawn; every request to a repository sorted by the repository it names
// expect: known positive — requests to alice/product and to alice/agent-m were made; every request to alice/product carries the product's token and no other, every request to alice/agent-m carries the instance's; no request to another address
test("TST-827008 each repository is read with the token this browser keeps for it, and a token reaches no other repository", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  const product = net.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}`) || request.url.includes(`githubusercontent.com/${PRODUCT}/`));
  const instance = net.requests.filter((request) => request.url.includes(`/repos/${INSTANCE}`) || request.url.includes(`githubusercontent.com/${INSTANCE}/`));
  assert.ok(product.length > 0 && instance.length > 0, "known positive: both repositories were read");
  assert.deepEqual([...new Set(product.map((request) => request.authorization))], [`Bearer ${PRODUCT_TOKEN}`]);
  assert.deepEqual([...new Set(instance.map((request) => request.authorization))], [`Bearer ${INSTANCE_TOKEN}`]);
  assert.deepEqual(net.requests.filter((request) => request.host !== "api.github.com" && request.host !== "127.0.0.1:4711").map((request) => request.host), []);
});

// TST-827009 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// given: this browser keeps the product alice/product and a product carol/missing that the server does not find
// input: the route home drawn
// expect: two cards; the first is alice/product's with its six stages; the second is <article class="card is-error"> named "carol/missing" with its address and the reason its host gives, "https://github.com/carol/missing was not found — a private repository is found only with a token that reaches it."; the page holds no list of what waits (the route jobs lists it, TST-1190004); counter-proof: with carol/missing left out, no card is an error
test("TST-827009 a product whose repository cannot be read has a card that says so, and the other cards are drawn", async () => {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser({ products: [PRODUCT_URL, MISSING_URL] }));
  const [good, bad, ...rest] = cardsOf(target);
  assert.equal(rest.length, 0);
  assert.equal(stagesOf(good).length, 6);
  assert.equal(good.className.includes("is-error"), false);
  assert.equal(bad.className.includes("is-error"), true);
  assert.equal(byClass(bad, "card-head")[0].children[0].textContent, "carol/missing");
  assert.equal(byClass(bad, "warn")[0].textContent, `${MISSING_URL} was not found — a private repository is found only with a token that reaches it.`);
  assert.deepEqual(byClass(target, "waits"), []);
  assert.equal(byClass(await draw(home, browser({ products: [PRODUCT_URL] })), "is-error").length, 0);
});

// TST-827010 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: a build of one row whose job's runtime does not answer, as MOD-progress-measures' buildInProgress gives it (reachable false), and a build of one row whose runtime answers
// input: productCard drawn with each
// expect: the first row ends with "not reachable" and shows the state its record gives ("running"); the second row has no such mark
test("TST-827010 a build row whose runtime does not answer is marked as not reachable, with the state its record gives", () => {
  const shares = [{ stage: "Implementation", share: 0.5, detail: "1 of 2 items done" }];
  const row = (reachable) => ({ item: "ITM-0900", job: JOB, participant: "dev-cli", state: "running", elapsed: 7200, reachable });
  const draw1 = (reachable) => productCard({ title: "alice/product", address: PRODUCT_URL, model: "Kanban", shares, current: "Implementation", build: [row(reachable)] });
  const missing = draw1(false), answering = draw1(true);
  assert.deepEqual(byClass(missing, "not-reachable").map((node) => node.textContent), ["not reachable"]);
  assert.deepEqual(byClass(answering, "not-reachable"), []);
  assert.deepEqual(buildOf(missing), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.equal(byClass(missing, "card-model")[0].textContent, "Developed with Kanban");
});

// TST-827012 · level: unit · module: MOD-main-page
// guards: WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; UC-046
// given: this browser keeps no product; and, for the counter-proof, keeps alice/product
// input: the route home drawn; the "+ Add product" button pressed
// expect: one button reading "+ Add product" stands beside Agent M's card, and pressing it calls go("add-product", {}) once; with a product kept there is no such button
test("TST-827012 while no product is kept, + Add product opens the add-product route", async () => {
  net = network({ [INSTANCE]: smallProduct(), [PRODUCT]: smallProduct() });
  net.install();
  const context = browser({ products: [] });
  const target = await draw(home, context);
  const [add, ...more] = byClass(target, "add-product");
  assert.equal(more.length, 0);
  assert.equal(add.textContent, "+ Add product");
  assert.deepEqual(context.went, []);
  click(add);
  assert.deepEqual(context.went, [["add-product", {}]]);
  assert.deepEqual(byClass(await draw(home, browser({ products: [PRODUCT_URL] })), "add-product"), []);
});

// TST-827013 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// given: this browser keeps alice/product and carol/missing, which the server does not find
// input: the route home drawn; the token-setting button of carol/missing's card pressed
// expect: the unreadable card holds one button reading "Open the token's setting", the readable card none; pressing it calls go("settings", none given) once
test("TST-827013 a card whose repository cannot be read opens the token's setting", async () => {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const context = browser({ products: [PRODUCT_URL, MISSING_URL] });
  const [good, bad] = cardsOf(await draw(home, context));
  assert.deepEqual(byClass(good, "token-setting"), []);
  const [setting, ...more] = byClass(bad, "token-setting");
  assert.equal(more.length, 0);
  assert.equal(setting.textContent, "Open the token's setting");
  click(setting);
  assert.deepEqual(context.went, [["settings", {}]]);
});

// ---------------------------------------------------------------- the jobs' states read again while the page is open (ITM-847)

const at = (clock) => Date.parse(`2026-10-16T${clock}:00Z`);
const waitingDelays = () => timers.waiting.map((timer) => timer.delay);
// A request's address with the commit of a tree left out, so that the expected address is written whole.
const addressOf = (request) => new URL(request.url).pathname.replace(/[0-9a-f]{40}$/, "<commit>");
const problemsOf = (target) => byClass(target, "reread-problem").map((node) => node.textContent);

// TST-847001 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: this browser keeps alice/product, whose job JOB-20261016-1000-ffff runs on the Bridge lab-pc-4; the timers a page sets are kept by the test and fired by it
// input: the route home drawn; the timer fired at 12:01 UTC; and, for the counter-proof, the route drawn where the one product kept is carol/missing, which cannot be read
// expect: after the draw exactly one timer waits, of 60000 milliseconds; after it was fired exactly one waits again, of 60000 milliseconds; counter-proof: where no card could be read, no timer waits
test("TST-847001 the page reads the jobs' states again once a minute, and sets no timer where no card was read", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  assert.deepEqual(waitingDelays(), [60000]);
  await timers.fire(at("12:01"));
  assert.deepEqual(waitingDelays(), [60000]);

  timers.restore();
  await draw(home, browser({ products: [MISSING_URL] }));
  assert.deepEqual(waitingDelays(), []);
});

// TST-847002 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: this browser keeps the product alice/product of 600 backlog items and 400 job records, none of them taken or ended, with a token for it and one for the instance (the page of TST-827006 read it in 27 requests)
// input: the route home drawn; the timer fired at 12:01 UTC, the requests since the draw counted; then one job record, JOB-20261014-0900-0001, given its end on the server and the timer fired at 12:02
// expect: the first reading sends exactly 2 requests, both to alice/product and both with the product's token — the commit of main and the tree of that commit —, and not one file, batch, pull request, tag or repository request, and none to alice/agent-m; counter-proof: the reading after the record changed sends 3 — the commit, the tree and one batch holding the changed record, docs/jobs/JOB-20261014-0900-0001.md —, and the 399 records that did not change are not read again
test("TST-847002 with a token, a reading of the jobs' states is the product's commit and tree, 2 requests, and a record that changed costs 1 more", async () => {
  net = network({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  net.install();
  await draw(home, browser());
  assert.equal(net.requests.length, 27);
  const sent = net.requests.length, logged = net.server.log.length;
  await timers.fire(at("12:01"));
  assert.deepEqual(net.requests.slice(sent).map(addressOf), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
  assert.deepEqual(net.requests.slice(sent).map((request) => request.authorization), [`Bearer ${PRODUCT_TOKEN}`, `Bearer ${PRODUCT_TOKEN}`]);
  assert.deepEqual(net.server.log.slice(logged).map((entry) => [entry.kind, ...entry.files]), [["commit"], ["tree"]]);

  const record = "docs/jobs/JOB-20261014-0900-0001.md";
  const files = productFiles({ items: 600, jobs: 400 });
  files[record] = withEnd(files[record], "done");
  net.change(PRODUCT, files);
  const again = net.requests.length, loggedAgain = net.server.log.length;
  await timers.fire(at("12:02"));
  assert.equal(net.requests.length - again, 3);
  assert.deepEqual(net.server.log.slice(loggedAgain).map((entry) => [entry.kind, ...entry.files]), [["commit"], ["tree"], ["batch", record]]);
});

// TST-847003 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the product, the instance and the browser of TST-847002, with no token stored for the instance or the product (the page of TST-827007 read it in 1,015 requests); and, for the counter-proof, the same where the product's token is stored and the instance's is not
// input: the route home drawn
// expect: 1,015 requests for the draw and no timer waiting, so that no reading is made — GitHub's limit without a token is 60 requests an hour for the network, which a reading each minute would use up in half an hour; counter-proof: with the product's token stored, one timer of 60000 milliseconds waits
test("TST-847003 a card whose repository this browser keeps no token for is not read again", async () => {
  net = network({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  net.install();
  await draw(home, browser({ tokens: {}, instanceToken: null }));
  assert.equal(net.requests.length, 1015);
  assert.deepEqual(waitingDelays(), []);

  net.restore();
  timers.restore();
  net = network({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  net.install();
  await draw(home, browser({ instanceToken: null }));
  assert.deepEqual(waitingDelays(), [60000]);
});

// TST-847004 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: the product of TST-827003 (UC-001 accepted, the item ITM-0900, the job JOB-20261016-1000-ffff of dev-cli taken by the Bridge lab-pc-4 and not ended, started at 10:00 UTC), which lab-pc-4 lists as running; the page drawn at 12:00 UTC
// input: the timer fired at 12:01; the Bridge then listing no job and the timer fired at 12:02; the record then ended as done at 11:00 UTC on the server and the timer fired at 12:03
// expect: the build holds one row throughout — after the draw ["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]; after 12:01 the same row at "2h 1m 0s", the Bridge asked once more (2 times in all); after 12:02 ["ITM-0900", JOB, "dev-cli", "ended without record", "0h 0m 0s"], the Bridge asked a third time; after 12:03 ["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"] and the Bridge not asked again (3 in all), since a record that has its end needs no runtime
test("TST-847004 the build's row moves with the job's record and its runtime: running, ended without record, done", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.equal(net.bridgeAsked(), 1);

  await timers.fire(at("12:01"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 1m 0s"]]);
  assert.equal(net.bridgeAsked(), 2);

  net.bridgeLists = null;
  await timers.fire(at("12:02"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "ended without record", "0h 0m 0s"]]);
  assert.equal(net.bridgeAsked(), 3);

  net.change(PRODUCT, smallProduct({ jobs: [endedJob({ id: JOB, by: "lab-pc-4", state: "done" })] }));
  await timers.fire(at("12:03"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"]]);
  assert.equal(net.bridgeAsked(), 3);
});

// TST-847005 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: the product of TST-847004 drawn at 12:00 UTC (Use cases 50 % "1 of 2 accepted"); then, on the server, UC-002 accepted and the job ended as done
// input: the timer fired at 12:01; and, for the counter-proof, the route drawn anew
// expect: the build's row reads "done"; the six stages are exactly what they were (Use cases still 50 % "1 of 2 accepted"), and neither the draw nor the reading draws a list of what waits; the reading sent 3 requests — the commit, the tree and one batch holding the job's record, docs/jobs/JOB-20261016-1000-ffff.md — and read no use case and no approval record; counter-proof: the route drawn anew reads Use cases 100 % "2 of 2 accepted", so that the change was on the server and only the reading left it alone
test("TST-847005 a reading moves the build's rows and nothing else: the stages stay as drawn", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  const stages = stagesOf(cardsOf(target)[0]);
  assert.deepEqual(stages[1], ["Use cases", "50 %", "1 of 2 accepted"]);
  assert.deepEqual(byClass(target, "waits"), []);

  net.change(PRODUCT, smallProduct({ accepted: ["UC-001", "UC-002"], jobs: [endedJob({ id: JOB, by: "lab-pc-4", state: "done" })] }));
  const logged = net.server.log.length;
  await timers.fire(at("12:01"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"]]);
  assert.deepEqual(stagesOf(cardsOf(target)[0]), stages);
  assert.deepEqual(byClass(target, "waits"), []);
  assert.deepEqual(net.server.log.slice(logged).map((entry) => [entry.kind, ...entry.files]), [["commit"], ["tree"], ["batch", `docs/jobs/${JOB}.md`]]);

  const anew = await draw(home, browser());
  assert.deepEqual(stagesOf(cardsOf(anew)[0])[1], ["Use cases", "100 %", "2 of 2 accepted"]);
});

// TST-847006 · level: unit · module: MOD-main-page
// guards: A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-046
// given: this browser keeps alice/product and bob/other, each with a token of its own, and carol/missing, which the server does not find; the page drawn with two cards and one that says it could not be read; and, for the counter-proof, the same where bob/other has no token stored
// input: the timer fired at 12:01 UTC, the requests since the draw listed
// expect: exactly 4 requests, the commit of main and the tree of each of alice/product and bob/other — no request to carol/missing and none to the instance alice/agent-m —, those to alice/product carrying "Bearer <the product's token>" and those to bob/other carrying "Bearer <bob/other's token>"; counter-proof: where bob/other has no token, exactly 2 requests, the commit of main and the tree of alice/product
test("TST-847006 a reading asks each card that was read, and has a token, for its commit and tree with its own token, and no other", async () => {
  net = network({ [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() });
  net.install();
  const products = [PRODUCT_URL, OTHER_URL, MISSING_URL];
  const target = await draw(home, browser({ products, tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
  assert.equal(cardsOf(target).length, 3);
  assert.equal(byClass(target, "is-error").length, 1);
  const sent = net.requests.length;
  await timers.fire(at("12:01"));
  const added = net.requests.slice(sent);
  assert.deepEqual(added.map(addressOf).sort(), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>", "/repos/bob/other/commits/main", "/repos/bob/other/git/trees/<commit>"]);
  assert.deepEqual(added.filter((request) => request.url.includes("/repos/alice/product/")).map((request) => request.authorization), [`Bearer ${PRODUCT_TOKEN}`, `Bearer ${PRODUCT_TOKEN}`]);
  assert.deepEqual(added.filter((request) => request.url.includes("/repos/bob/other/")).map((request) => request.authorization), [`Bearer ${OTHER_TOKEN}`, `Bearer ${OTHER_TOKEN}`]);

  timers.restore();
  await draw(home, browser({ products, tokens: { [PRODUCT]: PRODUCT_TOKEN } }));
  const sentAgain = net.requests.length;
  await timers.fire(at("12:02"));
  assert.deepEqual(net.requests.slice(sentAgain).map(addressOf), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
});

// TST-847007 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page drawn into an element, with a job running; the timer fired once while the cards are in the element
// input: the frame draws another route into the same element (the cards are no longer in it); the timer set after the first reading is fired
// expect: the first firing sends 2 requests to GitHub and 1 to the Bridge lab-pc-4 (the job has not ended) and sets the next timer; the second sends none and sets none, so that no reading is made once the route is no longer shown
test("TST-847007 the readings stop once the route is no longer the one shown", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  const sent = net.requests.length;
  await timers.fire(at("12:01"));
  assert.equal(net.requests.slice(sent).filter((request) => request.host === "api.github.com").length, 2);
  assert.equal(net.requests.slice(sent).filter((request) => request.host === "127.0.0.1:4711").length, 1);
  assert.deepEqual(waitingDelays(), [60000]);

  target.replaceChildren("Another route is drawn here.");
  const later = net.requests.length;
  await timers.fire(at("12:02"));
  assert.equal(net.requests.length, later);
  assert.deepEqual(waitingDelays(), []);
});

// TST-847008 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page drawn at 12:00 UTC with a job running (row "2h 0m 0s"); GitHub then answers every request of its API with a server error, 500
// input: the timer fired at 12:01; GitHub then answering again and the timer fired at 12:02
// expect: after the failure the row still reads ["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"], one paragraph reads "The jobs' states could not be read again. alice/product: GitHub answered 500", and one timer waits, of 60000 milliseconds (a failure that is no used-up limit is tried again at the next interval); after the answer the row reads "2h 2m 0s" and no such paragraph is left
test("TST-847008 a reading that fails leaves the cards as drawn, says why, and the next reading is made at the next interval", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  net.refusing = { how: "error" };
  await timers.fire(at("12:01"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(problemsOf(target), ["The jobs' states could not be read again. alice/product: GitHub answered 500"]);
  assert.deepEqual(waitingDelays(), [60000]);

  net.refusing = null;
  await timers.fire(at("12:02"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 2m 0s"]]);
  assert.deepEqual(problemsOf(target), []);
});

// TST-847009 · level: unit · module: MOD-main-page
// guards: WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-046
// given: this browser keeps no product; the instance alice/agent-m holds the files of the product of TST-847004, whose job lab-pc-4 lists as running; the page drawn at 12:00 UTC
// input: the timer fired at 12:01 UTC, the requests since the draw listed
// expect: exactly 2 requests, the commit of main and its tree of alice/agent-m, both with "Bearer <the instance's token>", and none to alice/product; the Bridge lab-pc-4 is asked once more (2 times in all); the row reads ["ITM-0900", JOB, "dev-cli", "running", "2h 1m 0s"]
test("TST-847009 Agent M's own card is read again through the instance's host, 2 requests with the instance's token", async () => {
  net = network({ [INSTANCE]: SMALL(), [PRODUCT]: smallProduct() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser({ products: [] }));
  assert.equal(net.bridgeAsked(), 1);
  const sent = net.requests.length;
  await timers.fire(at("12:01"));
  const added = net.requests.slice(sent).filter((request) => request.host === "api.github.com");
  assert.deepEqual(added.map(addressOf), ["/repos/alice/agent-m/commits/main", "/repos/alice/agent-m/git/trees/<commit>"]);
  assert.deepEqual(added.map((request) => request.authorization), [`Bearer ${INSTANCE_TOKEN}`, `Bearer ${INSTANCE_TOKEN}`]);
  assert.equal(net.requests.length - sent, 3);
  assert.equal(net.bridgeAsked(), 2);
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 1m 0s"]]);
});

// TST-847010 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-046
// given: the product with two jobs, JOB-20261016-1000-aaaa and JOB-20261016-1000-bbbb, taken by CI runs (https://github.com/alice/product/actions/runs/101 and …/102) and not ended; the job workflow's run list, one page, holds run 101 in progress and run 102 completed with success
// input: the route home drawn; the timer fired at 12:01 UTC, the requests since the draw listed
// expect: 3 requests in all — the commit, the tree and, for the two jobs together, one request of the job workflow's run list (/repos/alice/product/actions/workflows/agent-m-jobs.yml/runs), since MOD-runtimes' liveStates lists a repository's runs once (ITM-1280); where no job is taken by a CI run (TST-847002), the reading sends no such request
test("TST-847010 the jobs taken by CI runs that have not ended cost one request of the run list for their repository, in each reading", async () => {
  const run = (id, status, conclusion) => ({ id, status, conclusion, html_url: `https://github.com/alice/product/actions/runs/${id}`, path: ".github/workflows/agent-m-jobs.yml", head_sha: "a".repeat(40), event: "push" });
  const jobs = [runningJob({ id: "JOB-20261016-1000-aaaa", by: "https://github.com/alice/product/actions/runs/101" }), runningJob({ id: "JOB-20261016-1000-bbbb", by: "https://github.com/alice/product/actions/runs/102" })];
  net = network({ [PRODUCT]: smallProduct({ jobs }), [INSTANCE]: instanceFiles() });
  net.ciRuns = [run(101, "in_progress", null), run(102, "completed", "success")];
  net.install();
  await draw(home, browser());
  const sent = net.requests.length;
  await timers.fire(at("12:01"));
  assert.deepEqual(net.requests.slice(sent).map(addressOf), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>",
    "/repos/alice/product/actions/workflows/agent-m-jobs.yml/runs"]);
});

// TST-847011 · level: unit · module: MOD-main-page
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-046
// given: the page drawn at 12:00 UTC with a job running (row "2h 0m 0s"); GitHub then refuses its API with a used-up limit of the account, which resets at 13:00 UTC (X-RateLimit-Reset 2026-10-16T13:00:00Z)
// input: the timer fired at 12:01; the limit then given back and the timer fired at 13:00
// expect: after the refusal the row still reads ["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"], one paragraph reads "The jobs' states could not be read again. alice/product: GitHub's request limit for the account these requests are made with is used up; it resets at 2026-10-16T13:00:00.000Z.", and one timer waits, of 3540000 milliseconds — the 59 minutes from 12:01 to the reset at 13:00, not the 60000 of an ordinary interval; the reading at 13:00 sends 2 requests, the row reads "3h 0m 0s", no such paragraph is left, and the next timer is of 60000 milliseconds
test("TST-847011 a used-up limit makes the next reading wait until the limit resets, 3,540,000 milliseconds from 12:01 to 13:00", async () => {
  assert.equal(RATE_RESET, Date.parse("2026-10-16T13:00:00Z"));
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  net.refusing = { how: "limit" };
  await timers.fire(at("12:01"));
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(problemsOf(target), ["The jobs' states could not be read again. alice/product: GitHub's request limit for the account these requests are made with is used up; it resets at 2026-10-16T13:00:00.000Z."]);
  assert.deepEqual(waitingDelays(), [3540000]);

  net.refusing = null;
  const sent = net.requests.length;
  await timers.fire(at("13:00"));
  assert.equal(net.requests.slice(sent).filter((request) => request.host === "api.github.com").length, 2);
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "3h 0m 0s"]]);
  assert.deepEqual(problemsOf(target), []);
  assert.deepEqual(waitingDelays(), [60000]);
});

// TST-847012 · level: unit · module: MOD-main-page
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-046
// given: this browser keeps alice/product and bob/other, each with a token of its own; the page drawn at 12:00 UTC; GitHub then refuses requests to alice/product only, with a used-up limit that resets at 13:00 UTC
// input: the timer fired at 12:01; the timer fired at 12:02, the requests since each firing listed
// expect: the firing at 12:01 sends 3 requests — the commit of main of alice/product, which is refused, and the commit and the tree of bob/other —, and one timer waits, of 60000 milliseconds, since bob/other's card is due at 12:02 while alice/product's waits for 13:00; the firing at 12:02 sends exactly 2 requests, the commit and the tree of bob/other, none to alice/product; the paragraph naming alice/product's limit is still shown after it
test("TST-847012 a limit used up by one card's token holds back only that card; the other card is read at the ordinary interval", async () => {
  net = network({ [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
  net.refusing = { how: "limit", repository: PRODUCT };
  let sent = net.requests.length;
  await timers.fire(at("12:01"));
  assert.deepEqual(net.requests.slice(sent).map(addressOf).sort(), ["/repos/alice/product/commits/main", "/repos/bob/other/commits/main", "/repos/bob/other/git/trees/<commit>"]);
  assert.deepEqual(waitingDelays(), [60000]);

  sent = net.requests.length;
  await timers.fire(at("12:02"));
  assert.deepEqual(net.requests.slice(sent).map(addressOf), ["/repos/bob/other/commits/main", "/repos/bob/other/git/trees/<commit>"]);
  assert.equal(problemsOf(target).length, 1);
  assert.equal(problemsOf(target)[0].includes("alice/product: GitHub's request limit"), true);
});

// TST-847013 · level: unit · module: MOD-main-page
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-046
// given: the page drawn at 12:00 UTC with a job running; GitHub then refuses its API with a used-up limit of the account and sends no time at which it resets (no X-RateLimit-Reset)
// input: the timer fired at 12:01
// expect: one paragraph reads "The jobs' states could not be read again. alice/product: GitHub's request limit for the account these requests are made with is used up; GitHub does not tell this page when it resets.", and one timer waits, of 60000 milliseconds, since no time is known to wait until
test("TST-847013 a used-up limit with no reset time given is tried again at the ordinary interval", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  net.refusing = { how: "limit, no reset time" };
  await timers.fire(at("12:01"));
  assert.deepEqual(problemsOf(target), ["The jobs' states could not be read again. alice/product: GitHub's request limit for the account these requests are made with is used up; GitHub does not tell this page when it resets."]);
  assert.deepEqual(waitingDelays(), [60000]);
});

// ---------------------------------------------------------------- the readings pause while the tab is hidden (ITM-858)

// What the readings after `sent` asked, by host: [GitHub, the Bridge lab-pc-4].
const askedSince = (sent) => [net.requests.slice(sent).filter((request) => request.host === "api.github.com").length, net.requests.slice(sent).filter((request) => request.host === "127.0.0.1:4711").length];

// TST-858001 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page drawn at 12:00 UTC with a job running on the Bridge lab-pc-4 (a reading costs 2 requests to GitHub and 1 to the Bridge), the tab shown
// input: the tab hidden (document.visibilityState "hidden", then visibilitychange); the timer fired at 12:01, and the next one, if one waits, at 12:02 and 12:03; the requests since the hiding counted
// expect: no request at all in the three minutes, to GitHub or to the Bridge (the base sends 3 for each firing: 9), and no timer waits afterwards — the readings are paused, not postponed
test("TST-858001 while the tab is hidden the page starts no reading and sets no timer", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  await visibility.hide(at("12:00"));
  const sent = net.requests.length;
  await timers.fire(at("12:01"));
  for (const minute of ["12:02", "12:03"]) if (timers.waiting.length) await timers.fire(at(minute));
  assert.deepEqual(askedSince(sent), [0, 0]);
  assert.deepEqual(waitingDelays(), []);
});

// TST-858002 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page of TST-858001, hidden at 12:00, its timer fired at 12:01 while hidden; the job still running
// input: the tab shown again at 12:05 UTC (visibilitychange)
// expect: at once, and with no timer fired, exactly one reading: 2 requests to GitHub — the commit and the tree of alice/product — and 1 to the Bridge; the row reads ["ITM-0900", JOB, "dev-cli", "running", "2h 5m 0s"]; one timer waits again, of 60000 milliseconds
test("TST-858002 when the tab is shown again the card whose reading fell due is read at once, once", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  await visibility.hide(at("12:00"));
  await timers.fire(at("12:01"));
  const sent = net.requests.length;
  await visibility.show(at("12:05"));
  assert.deepEqual(askedSince(sent), [2, 1]);
  assert.deepEqual(net.requests.slice(sent).filter((request) => request.host === "api.github.com").map(addressOf), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
  assert.deepEqual(buildOf(cardsOf(target)[0]), [["ITM-0900", JOB, "dev-cli", "running", "2h 5m 0s"]]);
  assert.deepEqual(waitingDelays(), [60000]);
});

// TST-858003 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page drawn at 12:00 UTC, the first reading due at 12:01
// input: the tab hidden and shown again, both at 12:00, before the reading fell due
// expect: no request; exactly one timer waits, of 60000 milliseconds (the reading is still due at 12:01, and the timer that was waiting is not left beside a second one)
test("TST-858003 a tab shown again before a reading fell due reads nothing, and leaves one timer", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  const sent = net.requests.length;
  await visibility.hide(at("12:00"));
  await visibility.show(at("12:00"));
  assert.deepEqual(askedSince(sent), [0, 0]);
  assert.deepEqual(waitingDelays(), [60000]);
});

// TST-858004 · level: unit · module: MOD-main-page
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: this browser keeps alice/product and bob/other, each with its own token; the page drawn at 12:00; GitHub then refuses requests to alice/product with a used-up limit that resets at 13:00; the timer fired at 12:01 (alice/product's reading fails and is next due at 13:00, bob/other's is read and next due at 12:02); the tab hidden at 12:01; GitHub answering again
// input: the tab shown at 12:05
// expect: exactly 2 requests, the commit and the tree of bob/other (the card whose reading fell due); none to alice/product, whose reading is due at 13:00
test("TST-858004 on resuming only the cards whose reading fell due are read", async () => {
  net = network({ [PRODUCT]: smallProduct(), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() });
  net.install();
  await draw(home, browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
  net.refusing = { how: "limit", repository: PRODUCT };
  await timers.fire(at("12:01"));
  await visibility.hide(at("12:01"));
  net.refusing = null;
  const sent = net.requests.length;
  await visibility.show(at("12:05"));
  assert.deepEqual(net.requests.slice(sent).map(addressOf), ["/repos/bob/other/commits/main", "/repos/bob/other/git/trees/<commit>"]);
});

// TST-858005 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page of TST-858002 hidden at 12:00, a card due; the tab shown twice at 12:05, both visibilitychange events fired before either reading has ended
// input: the two events
// expect: the card is read once: 2 requests to GitHub and 1 to the Bridge, not 4 and 2 (a reading in flight is not started again)
test("TST-858005 a tab shown twice in a row reads a due card once", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  await visibility.hide(at("12:00"));
  await timers.fire(at("12:01"));
  const sent = net.requests.length;
  await Promise.all([visibility.show(at("12:05")), visibility.show(at("12:05"))]);
  assert.deepEqual(askedSince(sent), [2, 1]);
});

// TST-858006 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the page drawn into an element (it listens for visibilitychange while its cards are shown)
// input: the frame draws another route into the same element; the tab is hidden at 12:04 and shown again at 12:05
// expect: no request, and the page no longer listens (visibility.listening is 0 after the event that found the cards gone), so that no reading is made for a route that is no longer shown
test("TST-858006 once the route is no longer shown a tab shown again reads nothing and the page stops listening", async () => {
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  assert.equal(visibility.listening, 1, "known positive: the page listens for visibilitychange while its cards are shown");
  target.replaceChildren("Another route is drawn here.");
  const sent = net.requests.length;
  await visibility.hide(at("12:04"));
  await visibility.show(at("12:05"));
  assert.deepEqual(askedSince(sent), [0, 0]);
  assert.equal(visibility.listening, 0);
});

// ---------------------------------------------------------------- the card reads the overview stored for its head, and then only the build (ITM-943)
//
// MOD-main-page, Interfaces `home`: "A card first reads the overview stored for its default branch's head (MOD-progress-measures' `storedOverview`, one request).
// Where there is one, the card is drawn from it alone: its stage bar, its model, what waits for a person, and its build — the states of the steps or items in progress
// and the records of the jobs working on them, from which `listJobs` derives the rows with the live states of those jobs whose record has no end, asked at once. It lists
// no pull request and reads no other file … Where there is none, the card reads the scope `all` as before. … The rows of the build are the same whether the stage bar
// comes from a stored overview or from the scope `all`."
// The fake GitHub holds the branch `overview-cache` of a repository as `net.overviews[repository][commit]`; its head is `headOf(repository)`. The overview stored is
// the format MOD-progress-measures' Data names: { commit, shares, waiting, model, build: { states, records }, queues } — here ITM-0900 in progress with the running job
// and that job's record as the commit holds it.

const STORED = (commit) => JSON.stringify({ commit, waiting: [{ kind: "use case", id: "UC-077", path: "docs/use-cases/UC-077-stored.md" }], shares: [
  { stage: "Requirements", share: 1, detail: "stored requirements" }, { stage: "Use cases", share: 0.25, detail: "stored use cases" },
  { stage: "Architecture", share: 0, detail: "stored architecture" }, { stage: "Implementation", share: 0.5, detail: "stored implementation" },
  { stage: "Tests", share: null, detail: "stored tests" }, { stage: "Release", share: 0, detail: "stored release" }], model: null,
  build: { states: [{ item: "ITM-0900", state: "in progress", reason: `job ${JOB} is running`, job: JOB, pullRequest: null }], records: [{ path: RUNNING.path, text: RUNNING.text }] },
  queues: [] });
// The overview of the format before the model, the build and the queues were stored: a reader takes it for none.
const STORED_BEFORE = (commit) => JSON.stringify({ commit, waiting: [], shares: JSON.parse(STORED(commit)).shares });
const STORED_STAGES = [["Requirements", "100 %", "stored requirements"], ["Use cases", "25 %", "stored use cases"], ["Architecture", "0 %", "stored architecture"],
  ["Implementation", "50 %", "stored implementation"], ["Tests", "?", "stored tests"], ["Release", "0 %", "stored release"]];
const REVIEWED = /^(docs\/use-cases\/|docs\/architecture\/|tests\/)/;
const filesRead = () => net.server.log.flatMap((entry) => entry.files);
const overviewReads = () => net.requests.filter((request) => request.url.includes("ref=overview-cache"));

// TST-943001 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; UC-049
// given: this browser keeps alice/product, whose branch overview-cache holds the overview of its head (six stored stages, UC-077 waiting) and whose backlog holds ITM-0900 with a job running on the Bridge lab-pc-4
// input: the route home drawn
// expect: the card's six stages are the stored ones — "Requirements 100 % stored requirements" … "Tests ? stored tests" — and the stage it is in is "Use cases"; the page holds no list of what waits (the route jobs lists the stored entry, TST-1190002); the build row is ["ITM-0900", the job, "dev-cli", "running", "2h 0m 0s"] — the stored record with the live state the Bridge reports; the overview was asked for once, as one request for <head>.json on overview-cache
test("TST-943001 a card with a stored overview shows its stages and its build from it", async () => {
  const head = headOf(PRODUCT);
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED(head) };
  net.install();
  const target = await draw(home, browser());
  const [card] = cardsOf(target);
  assert.deepEqual(stagesOf(card), STORED_STAGES);
  assert.deepEqual(currentOf(card), ["Use cases"]);
  assert.deepEqual(byClass(target, "waits"), []);
  assert.deepEqual(buildOf(card), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.equal(overviewReads().length, 1);
  assert.equal(overviewReads()[0].url.includes(`/contents/${head}.json`), true);
});

// TST-943002 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-943001 (a use case, an architecture-less tree and a test file among its files); once with the overview of its head stored, once with none
// input: the route home drawn; the files the fake GitHub served counted
// expect: with the overview, no file of the product is read at all — not the backlog, not the job record, no use case, decision or test file and not SPEC.md; without one, the card reads the scope all: tests/unit.test.mjs and the backlog are read (known positive: the count sees the files read) and the stages are those the files give ("Use cases 50 % 1 of 2 accepted")
test("TST-943002 with a stored overview no file of the product is read, and without one the card reads the scope all", async () => {
  const head = headOf(PRODUCT);
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED(head) };
  net.install();
  await draw(home, browser());
  assert.deepEqual(filesRead(), []);

  net.restore();
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const target = await draw(home, browser());
  assert.equal(filesRead().includes("tests/unit.test.mjs"), true, "without a stored overview the scope all reads the test file");
  assert.equal(filesRead().includes("docs/backlog/ITM-0900-work.md"), true, "known positive: the count sees the backlog read");
  assert.deepEqual(stagesOf(cardsOf(target)[0])[1], ["Use cases", "50 %", "1 of 2 accepted"]);
});

// TST-943003 · level: unit · module: MOD-main-page
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-049
// given: the product of TST-943001 with the overview of its head stored, and the same product without
// input: the route home drawn for each
// expect: the build rows of the two cards are equal — [["ITM-0900", the job, "dev-cli", "running", "2h 0m 0s"]] —, whether the stage bar comes from the stored overview or from the scope all
test("TST-943003 the rows of the build are the same whether the stage bar comes from a stored overview or from the scope all", async () => {
  const head = headOf(PRODUCT);
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED(head) };
  net.install();
  const withStored = buildOf(cardsOf(await draw(home, browser()))[0]);
  net.restore();
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  const without = buildOf(cardsOf(await draw(home, browser()))[0]);
  assert.deepEqual(withStored, [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(withStored, without);
});

// TST-943004 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// given: this browser keeps alice/product and bob/other; only alice/product's branch has an overview for its head, and bob/other's branch holds the overview of another commit (not its head)
// input: the route home drawn
// expect: alice/product's stages are the stored ones; bob/other's are those its files give (Use cases 100 % "2 of 2 accepted" for UC-002 accepted… "1 of 2 accepted") — the overview of another commit is none, and bob/other's branch holds no latest.json —; alice/product's card asked for its head's overview once, bob/other's for its head's overview and then latest.json, two requests
test("TST-943004 each card reads its own head's overview, and an overview stored for another commit is none", async () => {
  const head = headOf(PRODUCT), elsewhere = "e".repeat(40);
  net = network({ [PRODUCT]: SMALL(), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED(head) };
  net.overviews[OTHER] = { [elsewhere]: STORED(elsewhere) };
  net.install();
  const target = await draw(home, browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
  const [first, second] = cardsOf(target);
  assert.deepEqual(stagesOf(first), STORED_STAGES);
  assert.deepEqual(stagesOf(second)[1], ["Use cases", "50 %", "1 of 2 accepted"]);
  assert.equal(overviewReads().filter((request) => request.url.includes("/repos/alice/product/")).length, 1);
  // bob/other: its head's overview, then the file `latest`, which its branch does not hold — so its card is derived from its files.
  assert.equal(overviewReads().filter((request) => request.url.includes("/repos/bob/other/")).length, 2);
});

// TST-943005 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: this browser keeps alice/product, whose branch overview-cache holds the overview of its head (ITM-0900 in progress, its running job's record), the job running on the Bridge lab-pc-4; and, for the counter-proof, the same product without an overview
// input: the route home drawn; every request counted
// expect: with the overview, no request lists the pull requests (no …/pulls), none is a batch — the one POST /graphql is greenToMerge's, with the product's token (ITM-1170) — and none reads a file of the product other than the overview: the requests to alice/product are exactly its repository, its head's commit, its tree and the overview — 4 —, none goes to the instance, since its one card has an overview (ITM-1281), and the Bridge is asked once for the live state of the one job in progress; counter-proof: without the overview the card lists the pull requests (known positive: the count sees …/pulls)
test("TST-943005 with a stored overview the route home lists no pull request and reads no file: four requests for the card, the live state asked once", async () => {
  const head = headOf(PRODUCT);
  const pulls = () => net.requests.filter((request) => /\/pulls(\?|$)/.test(new URL(request.url).pathname + new URL(request.url).search));
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED(head) };
  net.install();
  await draw(home, browser());
  const of = (repository) => net.requests.filter((request) => new URL(request.url).pathname.startsWith(`/repos/${repository}`)).map((request) => new URL(request.url).pathname.replace(`/repos/${repository}`, ""));
  assert.deepEqual(pulls(), []);
  assert.deepEqual(net.requests.filter((request) => request.url.endsWith("/graphql")).map((request) => request.authorization), [`Bearer ${PRODUCT_TOKEN}`], "the one POST /graphql is greenToMerge's (ITM-1170)");
  assert.deepEqual(of(PRODUCT), ["", "/commits/main", `/git/trees/${head}`, `/contents/${head}.json`]);
  assert.deepEqual(of(INSTANCE), []);
  assert.equal(net.bridgeAsked(), 1);

  net.restore();
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.install();
  await draw(home, browser());
  assert.equal(pulls().length > 0, true, "known positive: without an overview the pull requests are listed, and the count sees it");
});

// TST-943006 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: alice/product, whose branch overview-cache holds for its head an overview of the format before the model, the build and the queues were stored ({ commit, shares, waiting } alone)
// input: the route home drawn
// expect: the overview is taken for none — the stages are those the files give ("Use cases 50 % 1 of 2 accepted"), not the stored ones —, and the build row is the one the files give: ["ITM-0900", the job, "dev-cli", "running", "2h 0m 0s"]
test("TST-943006 an overview of the format before the build was stored is none: the card reads the scope all", async () => {
  const head = headOf(PRODUCT);
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [head]: STORED_BEFORE(head) };
  net.install();
  const [card] = cardsOf(await draw(home, browser()));
  assert.deepEqual(stagesOf(card)[1], ["Use cases", "50 %", "1 of 2 accepted"]);
  assert.deepEqual(buildOf(card), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
});

// TST-943007 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: alice/product, whose branch overview-cache holds no overview for its head but the overview of an older commit eee…e, and latest.json naming eee…e; the job running on the Bridge lab-pc-4; and, for the counter-proof, the same branch without latest.json
// input: the route home drawn; every request counted
// expect: the card's six stages are the stored ones of eee…e, the page holds no list of what waits (the route jobs lists the stored entry, TST-1190002), the build row is ["ITM-0900", the job, "dev-cli", "running", "2h 0m 0s"], and the card says "As of eeeeeee: the overview of the newest commit is being stored."; the overview-cache reads are the head's overview, latest.json and eee…e.json in that order; no request lists the pull requests (no …/pulls) and none is a batch — the one POST /graphql is greenToMerge's, with the product's token (ITM-1170) —; counter-proof: without latest.json the card has no such note and lists the pull requests (known positive: the count sees …/pulls)
test("TST-943007 while the head's overview is not stored, the card shows the overview latest.json names, says of which commit, and lists no pull request", async () => {
  const head = headOf(PRODUCT), older = "e".repeat(40);
  const pulls = () => net.requests.filter((request) => /\/pulls$/.test(new URL(request.url).pathname));
  const asOf = (card) => byClass(card, "card-as-of").map((note) => note.textContent);
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [older]: STORED(older), latest: `${JSON.stringify({ commit: older })}\n` };
  net.install();
  const target = await draw(home, browser());
  const [card] = cardsOf(target);
  assert.deepEqual(stagesOf(card), STORED_STAGES);
  assert.deepEqual(byClass(target, "waits"), []);
  assert.deepEqual(buildOf(card), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(asOf(card), ["As of eeeeeee: the overview of the newest commit is being stored."]);
  assert.deepEqual(overviewReads().map((request) => new URL(request.url).pathname.replace(`/repos/${PRODUCT}/contents/`, "")), [`${head}.json`, "latest.json", `${older}.json`]);
  assert.deepEqual(pulls(), []);
  assert.deepEqual(net.requests.filter((request) => request.url.endsWith("/graphql")).map((request) => request.authorization), [`Bearer ${PRODUCT_TOKEN}`], "the one POST /graphql is greenToMerge's (ITM-1170)");

  net.restore();
  net = network({ [PRODUCT]: SMALL(), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  net.overviews[PRODUCT] = { [older]: STORED(older) };
  net.install();
  const [derived] = cardsOf(await draw(home, browser()));
  assert.deepEqual(asOf(derived), []);
  assert.deepEqual(stagesOf(derived)[1], ["Use cases", "50 %", "1 of 2 accepted"]);
  assert.equal(pulls().length > 0, true, "known positive: without latest.json the pull requests are listed, and the count sees it");
});

// ---------------------------------------------------------------- whether a token is stored is the frame's to say (ITM-856)

// TST-856004 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-046
// given: this browser keeps the product alice/product, with its own token github-token:alice/product; and, for the counter-proof, the same browser with no token of that product; the pages are counted by the reads of that one key from the browser's local storage — the number of reads one call of MOD-site-frame's chosenProduct makes for the product, and the number the route home makes in drawing its card
// input: chosenProduct({ store, fragment: "#home/product=<the product>" }) called alone, its reads of the key counted; then the route home drawn on a fresh browser of the same kind, its reads counted
// expect: the call alone reads the key at least once (known positive: the count sees a read) and the route home reads it exactly as often as that call alone, with a token and without — the route reads nothing for "is a token stored" besides what the frame's chosenProduct reads and says — , and the card, drawn with the token, sets the timer of the readings again (one timer of 60000 milliseconds) and, drawn without it, sets none
test("TST-856004 the route home reads the product's token key no oftener than the frame's chosenProduct does, and takes from it whether a token is stored", async () => {
  const key = `github-token:${PRODUCT}`;
  for (const [tokens, delays] of [[{ [PRODUCT]: PRODUCT_TOKEN }, [60000]], [{}, []]]) {
    net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
    net.install();
    const alone = browser({ tokens });
    const aloneReads = countReads(alone.store, key);
    await chosenProduct({ store: alone.store, fragment: `#home/product=${encodeURIComponent(PRODUCT_URL)}` });
    assert.ok(aloneReads.count >= 1, "known positive: the count sees the read chosenProduct makes");

    const context = browser({ tokens });
    const reads = countReads(context.store, key);
    await draw(home, context);
    assert.equal(reads.count, aloneReads.count);
    assert.deepEqual(waitingDelays(), delays);
    net.restore();
    timers.restore();
  }
});

// TST-829001 · level: unit · module: MOD-main-page
// guards: UC-046; EVERY STEP EXPLAINS ITSELF
// given: this browser keeps the product alice/product
// input: the route home drawn
// expect: the first child of the page is the greeting: a heading "Welcome to Agent M", a sentence naming "requirements-driven software engineering with people and agents", a paragraph on what to do first (the requirements and the use cases, then a product), and a link "Review the use cases" whose address is "docs/index.html#use-cases"; and a folded "What is this?"; the cards come after it
test("TST-829001 the page opens with a greeting: Agent M's name, what it is, what to do first, Review the use cases, and its folded explanation", async () => {
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, browser());
  const [greeting] = byClass(target, "greeting");
  assert.ok(greeting, "the greeting is drawn");
  assert.equal(target.children[0], greeting, "the greeting comes before the cards");
  assert.equal(find(greeting, (node) => node.localName === "h1")[0].textContent, "Welcome to Agent M");
  assert.match(byClass(greeting, "lead")[0].textContent, /requirements-driven software engineering with people and agents/);
  assert.match(byClass(greeting, "first")[0].textContent, /requirements and the use cases.*add the repository of a product/);
  const [review] = find(greeting, (node) => node.localName === "a" && node.textContent === "Review the use cases");
  assert.equal(review.getAttribute("href"), "docs/index.html#use-cases");
  const [folded] = find(greeting, (node) => node.localName === "details");
  assert.equal(folded.getAttribute("open"), null, "the explanation is folded");
  assert.equal(find(folded, (node) => node.localName === "summary")[0].textContent, "What is this?");
});

// TST-829002 · level: unit · module: MOD-main-page
// guards: UC-046; THE MENU FOLLOWS THE PROCESS
// given: this browser keeps the product alice/product; and, in a second browser, no product, so that Agent M's own card is drawn
// input: the route home drawn in each
// expect: each of the six stages of a card is a link, in this order of stage and menu entry — Requirements to Requirements, Use cases to Use cases, Architecture to Architecture, Implementation to Implementation, Tests to Tests, Release to Releases — whose address is "docs/index.html#<entry>", followed for the product's card by "/product=" and the percent-encoded address "https%3A%2F%2Fgithub.com%2Falice%2Fproduct"; Agent M's own card has the same addresses without "/product="
test("TST-829002 each stage of a card links to the menu entry of the same place in the process, for the card's product", async () => {
  const entries = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases"];
  const stages = ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"];
  const linksOf = (card) => byClass(card, "stage").map((stage) => [stage.getAttribute("data-stage"), byClass(stage, "stage-link")[0]?.getAttribute("href")]);
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  const product = cardsOf(await draw(home, browser()))[0];
  assert.deepEqual(linksOf(product), stages.map((stage, at) => [stage, `docs/index.html#${entries[at]}/product=https%3A%2F%2Fgithub.com%2Falice%2Fproduct`]));

  net.restore();
  net = network({ [INSTANCE]: instanceFiles() });
  net.install();
  const own = cardsOf(await draw(home, browser({ products: [], tokens: {} })))[0];
  assert.deepEqual(linksOf(own), stages.map((stage, at) => [stage, `docs/index.html#${entries[at]}`]));
});
