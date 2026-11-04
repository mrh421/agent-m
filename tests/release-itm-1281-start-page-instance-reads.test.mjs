// Release tests of ITM-1281 — UC-046 on the start page: the route `home` reads the instance's repository only for a card it derives. The behaviour is docs/architecture/MOD-main-page.md (Interfaces: `home`: "The instance's snapshot, which
// the scope `all` takes for the participants and the process models, is read only for a card drawn from that scope, once for all such cards, and for Agent M's own card; while every card has an overview, the route reads none of the instance.", and
// "A card whose repository cannot be read says which") and UC-046 (alternative flow 3b: "A product's repository cannot be read [...] Its card says which [...]; the other cards are shown.") as SPEC.md (A PAGE LOAD READS THE REPOSITORY IN BATCHES)
// states it.
// Run: node --test tests/release-itm-1281-start-page-instance-reads.test.mjs
//
// Module: MOD-main-page
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// Level: release
//
// Written for the release testing of sprint 116 by a participant who implemented none of ITM-1281 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of tests/main-page-home-harness.mjs: the real route `home` with the real
// modules it uses, a browser that keeps products with tokens of their own, and a counting fake GitHub that notes every request with the authorisation it carried. The implementers' cases (tests/main-page-home-instance.test.mjs) take two
// products; these cases take three, a card drawn from the overview stored last, a mix of cards, a page read again, and an instance GitHub refuses. They count from the outside: the requests that name the instance's repository, the commit of main and
// its tree, and whether the instance's token is sent at all. Each count is first shown to count: a case begins with the requests to a product, which the count must see. Readings the texts leave open, which the cases state:
//   - "reads none of the instance" is read as no request that names the instance's repository, none of the graph query, and no request that carries the instance's token.
//   - "once for all such cards" is read as one request each for the instance's repository, the commit of main and its tree, whatever the number of cards drawn from the scope `all`.
//   - "Agent M's own card" reads the instance as its own repository, which it reads besides for its overview, pull requests and tags; the cases count only the repository, the commit and the tree, each once.
//   - "A card whose repository cannot be read says which" is read of a card that needs the instance: its warning names the instance's repository; a card drawn from its overview reads nothing of the instance and has no reading that fails.
//   - the card of a product whose head has no stored overview but whose branch holds the overview stored last is drawn from that, "As of <seven characters>", and reads none of the instance either.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import {
  INSTANCE, INSTANCE_TOKEN, OTHER, OTHER_TOKEN, OTHER_URL, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL,
  browser, byClass, cardsOf, draw, headOf, instanceFiles, network, runningJob, smallProduct, stagesOf, timers,
} from "./main-page-home-harness.mjs";

const home = view.routes.find((route) => route.name === "home");
const THIRD = "carol/third", THIRD_URL = `https://github.com/${THIRD}`, THIRD_TOKEN = "github_pat_HOME827THIRD00000123456789abcdefghij";
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const JOB = "JOB-20261016-1000-ffff";
const RUNNING = runningJob({ id: JOB, by: "lab-pc-4" });
// An overview stored for `commit`, with six stages that no derivation from the files gives (the shares and details are the overview's own).
const STORED = (commit) => JSON.stringify({ commit, waiting: [], shares: [
  { stage: "Requirements", share: 1, detail: "stored requirements" }, { stage: "Use cases", share: 0.25, detail: "stored use cases" },
  { stage: "Architecture", share: 0, detail: "stored architecture" }, { stage: "Implementation", share: 0.5, detail: "stored implementation" },
  { stage: "Tests", share: null, detail: "stored tests" }, { stage: "Release", share: 0, detail: "stored release" }], model: null,
  build: { states: [], records: [] }, queues: [] });
const STORED_USE_CASES = ["Use cases", "25 %", "stored use cases"];
const DERIVED_USE_CASES = (accepted) => ["Use cases", `${accepted * 50} %`, `${accepted} of 2 accepted`];
const LATEST = "a".repeat(40);

const requestsTo = (repository) => net.requests.map((request) => new URL(request.url).pathname).filter((path) => path.startsWith(`/repos/${repository}`)).map((path) => path.slice(`/repos/${repository}`.length));
const READ_ONCE = ["", "/commits/main", `/git/trees/${headOf(INSTANCE)}`];
const countOf = (reads, path) => reads.filter((read) => read === path).length;
const useCasesOf = (card) => stagesOf(card)[1];
const isError = (card) => card.className.split(/\s+/).includes("is-error");

/**
 * The world: the products alice/product, bob/other and carol/third, each with its own token, the instance alice/agent-m with its token. `stored` names the products whose head holds an overview, `latest` those whose branch holds only the overview stored last;
 * `kept` the products this browser keeps; `refusing` is what GitHub refuses (tests/main-page-home-harness.mjs).
 */
async function drawn({ stored = [], latest = [], kept = [PRODUCT, OTHER, THIRD], refusing = null, own = false } = {}) {
  net = network({ [PRODUCT]: smallProduct({ jobs: [RUNNING] }), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [THIRD]: smallProduct({ accepted: [] }), [INSTANCE]: own ? smallProduct({ jobs: [RUNNING] }) : instanceFiles() }, { bridgeLists: JOB });
  for (const repository of stored) net.overviews[repository] = { [headOf(repository)]: STORED(headOf(repository)) };
  for (const repository of latest) net.overviews[repository] = { [LATEST]: STORED(LATEST), latest: `${JSON.stringify({ commit: LATEST })}\n` };
  net.refusing = refusing;
  net.install();
  const urls = { [PRODUCT]: PRODUCT_URL, [OTHER]: OTHER_URL, [THIRD]: THIRD_URL };
  const tokens = { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN, [THIRD]: THIRD_TOKEN };
  return draw(home, browser({ products: own ? [] : kept.map((repository) => urls[repository]), tokens }));
}
const fresh = () => { net.restore(); timers.restore(); };

// TST-1281301 · level: release · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: this browser keeps alice/product, bob/other and carol/third, each with its own token, and the instance alice/agent-m with its token; the head of alice/product and of carol/third hold a stored overview, and bob/other's branch holds only the overview stored last
// input: the route home drawn; then the timer the page set for reading the jobs' states again fired
// expect: known positive first — requests to the three products were made; three cards, two with the stored stages ("Use cases 25 % stored use cases") and bob/other's too, saying "As of aaaaaaa"; not one request names alice/agent-m (no repository, commit or tree), none carries the instance's token, and the only POST /graphql are the three products' requests for greenToMerge (ITM-1170), one with each product's token; after the page reads again, still none of the instance
// Planted fault: the instance read before any card, as before ITM-1281 (`await reading.instance()` called in render before the cards, src/main-page/home.mjs) sends the repository, the commit and the tree of alice/agent-m and the instance's token, and the case fails at the requests to the instance.
test("TST-1281301 while every card has an overview, stored for its head or stored last, the route home reads none of the instance, nor when it reads again", async () => {
  const target = await drawn({ stored: [PRODUCT, THIRD], latest: [OTHER] });
  assert.ok(requestsTo(PRODUCT).length > 0 && requestsTo(OTHER).length > 0 && requestsTo(THIRD).length > 0, "known positive: the count sees the requests to the three products");
  const cards = cardsOf(target);
  assert.equal(cards.length, 3);
  for (const card of cards) assert.deepEqual(useCasesOf(card), STORED_USE_CASES);
  assert.equal(cards.filter(isError).length, 0);
  assert.match(cards[1].textContent, /As of aaaaaaa/);
  const instanceRequests = () => net.requests.filter((request) => new URL(request.url).pathname.startsWith(`/repos/${INSTANCE}`) || request.authorization?.includes(INSTANCE_TOKEN));
  assert.deepEqual(instanceRequests().map((request) => request.url), [], "nothing of the instance is read, and its token is not sent");
  assert.deepEqual(net.requests.filter((request) => request.url.endsWith("/graphql")).map((request) => request.authorization).sort(), [`Bearer ${PRODUCT_TOKEN}`, `Bearer ${OTHER_TOKEN}`, `Bearer ${THIRD_TOKEN}`].sort(), "the only POST /graphql are the three products' greenToMerge requests (ITM-1170), each with its product's token");
  const before = net.requests.length;
  await timers.fire();
  assert.ok(net.requests.length >= before, "the page read again");
  assert.deepEqual(instanceRequests().map((request) => request.url), [], "nor when it reads again");
});

// TST-1281302 · level: release · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the world of TST-1281301, with no overview for the heads of three products, of two of them, and of one
// input: the route home drawn for each
// expect: with three cards derived from the scope all, the instance's repository, the commit of main and its tree are each requested once (["", "/commits/main", "/git/trees/<the instance's head>"], once each), not three times; with two cards derived and one drawn from its overview, once each too; with one derived, once each; the derived cards show their use cases as the fixtures say (alice/product and bob/other 1 of 2 accepted, carol/third 0 of 2) and the card of an overview shows the overview's
// Planted fault: the instance read once for each card that needs it (`instanceOnce` made to read again, `held ??=` dropped in src/main-page/home.mjs) requests the repository, the commit and the tree three times for three derived cards, and the case fails at the first count.
test("TST-1281302 however many cards are drawn from the scope all, the instance's repository, the commit of main and its tree are read once each", async () => {
  const three = cardsOf(await drawn());
  assert.ok(requestsTo(PRODUCT).length > 0, "known positive: the count sees the requests to a product");
  assert.deepEqual(three.map(useCasesOf), [DERIVED_USE_CASES(1), DERIVED_USE_CASES(1), DERIVED_USE_CASES(0)]);
  assert.deepEqual(READ_ONCE.map((path) => countOf(requestsTo(INSTANCE), path)), [1, 1, 1], "three derived cards");
  fresh();
  const mixed = cardsOf(await drawn({ stored: [PRODUCT] }));
  assert.deepEqual(mixed.map(useCasesOf), [STORED_USE_CASES, DERIVED_USE_CASES(1), DERIVED_USE_CASES(0)]);
  assert.deepEqual(READ_ONCE.map((path) => countOf(requestsTo(INSTANCE), path)), [1, 1, 1], "two derived cards and one drawn from its overview");
  fresh();
  const one = cardsOf(await drawn({ stored: [PRODUCT, OTHER] }));
  assert.deepEqual(one.map(useCasesOf), [STORED_USE_CASES, STORED_USE_CASES, DERIVED_USE_CASES(0)]);
  assert.deepEqual(READ_ONCE.map((path) => countOf(requestsTo(INSTANCE), path)), [1, 1, 1], "one derived card");
});

// TST-1281303 · level: release · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; UC-046
// given: this browser keeps no product, and the instance alice/agent-m holds the job JOB-20261016-1000-ffff that the Bridge lab-pc-4 lists as running
// input: the route home drawn
// expect: known positive first — requests to the instance were made; one card, Agent M's own, which is no error card, with its build row for the running job ("running"); the instance's repository, the commit of main and its tree each requested once
// Planted fault: Agent M's card not sharing the instance's reading with the scope all (`const known = null` in cardOf, src/main-page/home.mjs) reads the instance's commit and tree besides its own, and requests the commit and the tree twice, and the case fails at the count.
test("TST-1281303 Agent M's own card, with no product kept, reads the instance's repository, the commit of main and its tree once each", async () => {
  const target = await drawn({ own: true });
  const reads = requestsTo(INSTANCE);
  assert.ok(reads.length > 0, "known positive: the count sees the requests to the instance");
  const cards = cardsOf(target);
  assert.equal(cards.length, 1);
  assert.equal(isError(cards[0]), false);
  assert.ok(byClass(cards[0], "build-state").map((node) => node.textContent).includes("running"));
  assert.deepEqual(READ_ONCE.map((path) => countOf(reads, path)), [1, 1, 1]);
});

// TST-1281304 · level: release · module: MOD-main-page
// guards: UC-046; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
// given: the world of TST-1281301 in which GitHub answers every request to the instance's repository with a server error; the head of alice/product holds a stored overview, bob/other and carol/third have none
// input: the route home drawn; then the same with every product overview stored; then with no product kept
// expect: known positive first — the card of alice/product is drawn with its stored stages; the cards of bob/other and carol/third, which need the instance, are error cards whose warning names "Agent M's own repository could not be read" and the settings button; they are the only error cards; the page is drawn all the same, with the greeting and the three cards; with every overview stored the three cards are drawn and none is an error; with no product kept, Agent M's own card is an error card
// Planted fault: the instance read for every card, so that its failure is every card's (`const known0 = await reading.instance()` at the head of cardOf, src/main-page/home.mjs, as before ITM-1281) makes alice/product's card an error card too, and the case fails at its stored stages.
test("TST-1281304 an unreadable instance gives its error only on the cards that need it, and the cards drawn from an overview are drawn", async () => {
  const target = await drawn({ stored: [PRODUCT], refusing: { how: "error", repository: INSTANCE } });
  const cards = cardsOf(target);
  assert.equal(cards.length, 3);
  assert.equal(isError(cards[0]), false, "known positive: the card of an overview is drawn");
  assert.deepEqual(useCasesOf(cards[0]), STORED_USE_CASES);
  assert.deepEqual(cards.map(isError), [false, true, true]);
  for (const card of cards.slice(1)) {
    assert.match(byClass(card, "warn").map((node) => node.textContent).join(" "), /Agent M's own repository could not be read/);
    assert.equal(byClass(card, "token-setting").length, 1);
  }
  fresh();
  const stored = cardsOf(await drawn({ stored: [PRODUCT, OTHER, THIRD], refusing: { how: "error", repository: INSTANCE } }));
  assert.deepEqual(stored.map(isError), [false, false, false]);
  assert.deepEqual(stored.map(useCasesOf), [STORED_USE_CASES, STORED_USE_CASES, STORED_USE_CASES]);
  fresh();
  const own = cardsOf(await drawn({ own: true, refusing: { how: "error", repository: INSTANCE } }));
  assert.deepEqual(own.map(isError), [true], "Agent M's own card needs the instance");
});
