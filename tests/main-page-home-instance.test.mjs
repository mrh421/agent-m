// MOD-main-page's route `home` reads the instance only for a card it derives (ITM-1281), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `home`) states it: "The instance's
// snapshot, which the scope `all` takes for the participants and the process models, is read only for a card drawn from that scope, once for all such cards, and for Agent M's own card; while every card
// has an overview, the route reads none of the instance."
// Run: node --test tests/main-page-home-instance.test.mjs
//
// Module: MOD-main-page
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// Level: component
//
// The real MOD-progress-measures, MOD-job-ledger, MOD-runtimes, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked, by the counting fake of
// tests/main-page-home-harness.mjs, which holds a repository's branch overview-cache as `net.overviews[repository][commit]`. Each test states its input and its expected values in its own text.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import {
  INSTANCE, OTHER, OTHER_TOKEN, OTHER_URL, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL,
  browser, buildOf, cardsOf, draw, headOf, instanceFiles, network, runningJob, smallProduct, stagesOf, timers,
} from "./main-page-home-harness.mjs";

const home = view.routes.find((route) => route.name === "home");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const JOB = "JOB-20261016-1000-ffff";
const RUNNING = runningJob({ id: JOB, by: "lab-pc-4" });
// The overview stored for `commit`, in the format MOD-progress-measures' Data names: six stages, UC-077 waiting, ITM-0900 in progress with the running job and that job's record.
const STORED = (commit) => JSON.stringify({ commit, waiting: [{ kind: "use case", id: "UC-077", path: "docs/use-cases/UC-077-stored.md" }], shares: [
  { stage: "Requirements", share: 1, detail: "stored requirements" }, { stage: "Use cases", share: 0.25, detail: "stored use cases" },
  { stage: "Architecture", share: 0, detail: "stored architecture" }, { stage: "Implementation", share: 0.5, detail: "stored implementation" },
  { stage: "Tests", share: null, detail: "stored tests" }, { stage: "Release", share: 0, detail: "stored release" }], model: null,
  build: { states: [{ item: "ITM-0900", state: "in progress", reason: `job ${JOB} is running`, job: JOB, pullRequest: null }], records: [{ path: RUNNING.path, text: RUNNING.text }] },
  queues: [] });
const STORED_STAGES = [["Requirements", "100 %", "stored requirements"], ["Use cases", "25 %", "stored use cases"], ["Architecture", "0 %", "stored architecture"],
  ["Implementation", "50 %", "stored implementation"], ["Tests", "?", "stored tests"], ["Release", "0 %", "stored release"]];
const ROW = ["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"];

// The paths of the requests to `repository`, its prefix left out ("" is the repository itself).
const requestsTo = (repository) => net.requests.map((request) => new URL(request.url).pathname).filter((path) => path.startsWith(`/repos/${repository}`)).map((path) => path.slice(`/repos/${repository}`.length));
const READ_ONCE = ["", "/commits/main", `/git/trees/${headOf(INSTANCE)}`];

// Draws the route home for alice/product and bob/other, each with its own token, the products' branches overview-cache holding the overview of their heads for those named in `stored`.
async function drawn(stored) {
  net = network({ [PRODUCT]: smallProduct({ jobs: [RUNNING] }), [OTHER]: smallProduct({ accepted: ["UC-002"] }), [INSTANCE]: instanceFiles() }, { bridgeLists: JOB });
  for (const repository of stored) net.overviews[repository] = { [headOf(repository)]: STORED(headOf(repository)) };
  net.install();
  return draw(home, browser({ products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } }));
}

// TST-1302010 · level: component · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: this browser keeps alice/product and bob/other, each with its own token, and the instance alice/agent-m with the instance's token; each product's branch overview-cache holds the overview of its head (six stored stages; ITM-0900 in progress with the job JOB-20261016-1000-ffff, which the Bridge lab-pc-4 lists as running); the instance holds its participant list
// input: the route home drawn; every request counted by the repository it names
// expect: two cards, each with the six stored stages ("Requirements 100 % stored requirements" … "Release 0 % stored release") and the build row ["ITM-0900", the job, "dev-cli", "running", "2h 0m 0s"]; known positive: requests to alice/product were made; not one request names alice/agent-m — no repository, no commit and no tree of the instance — and none is a batch: the only POST /graphql are the two of greenToMerge (ITM-1170), one with each product's token; counter-proof: with bob/other's overview left out, its card is derived from its files ("Use cases 50 % 1 of 2 accepted") and the instance is read once — its repository, the commit of main and its tree, ["", "/commits/main", "/git/trees/<the instance's head>"] —; with neither overview, the instance is read once for both cards, the same three requests; and with no product kept, Agent M's own card, whose repository the instance is, reads the instance's repository, the commit of main and its tree once each
test("TST-1302010 while every card has a stored overview the route home reads none of the instance; a card drawn from the scope all, or Agent M's own, reads it once", async () => {
  const both = await drawn([PRODUCT, OTHER]);
  const cards = cardsOf(both);
  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.deepEqual(stagesOf(card), STORED_STAGES);
    assert.deepEqual(buildOf(card), [ROW]);
  }
  assert.ok(requestsTo(PRODUCT).length > 0, "known positive: the count sees the requests to alice/product");
  assert.deepEqual(requestsTo(INSTANCE), []);
  // ITM-1170: each product's repositoryInfo sends the one GraphQL request of greenToMerge, with that product's token; no other request is a batch.
  assert.deepEqual(net.requests.filter((request) => request.url.endsWith("/graphql")).map((request) => request.authorization).sort(), [`Bearer ${PRODUCT_TOKEN}`, `Bearer ${OTHER_TOKEN}`].sort());

  net.restore();
  timers.restore();
  const one = await drawn([PRODUCT]);
  assert.deepEqual(stagesOf(cardsOf(one)[0]), STORED_STAGES);
  assert.deepEqual(stagesOf(cardsOf(one)[1])[1], ["Use cases", "50 %", "1 of 2 accepted"]);
  assert.deepEqual(requestsTo(INSTANCE), READ_ONCE);

  net.restore();
  timers.restore();
  await drawn([]);
  assert.deepEqual(requestsTo(INSTANCE), READ_ONCE);

  net.restore();
  timers.restore();
  net = network({ [INSTANCE]: smallProduct({ jobs: [RUNNING] }) }, { bridgeLists: JOB });
  net.install();
  const own = cardsOf(await draw(home, browser({ products: [] })));
  assert.equal(own.length, 1);
  assert.deepEqual(buildOf(own[0]), [ROW]);
  // The instance is the card's own repository here, whose overview, pull requests and tags the card reads besides: its commit and tree are each read once.
  const ownReads = requestsTo(INSTANCE);
  assert.deepEqual(READ_ONCE.map((path) => ownReads.filter((read) => read === path).length), [1, 1, 1]);
});
