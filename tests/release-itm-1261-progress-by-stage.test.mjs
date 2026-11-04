// Release test of ITM-1261 — a product stores its overview for each commit of its default branch. Written from the SPEC's THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE ("The main page shows each product's progress as one bar of six stages — requirements, use cases, architecture, implementation, tests, release —, each filled by the share of its work that is accepted or done"; its Check: a fixture product with three of its four use cases accepted shows its use-case stage at 75 %; with all four accepted, at 100 %), from UC-035 step 2 and from ITM-1261's Outcome (a product's card reads the scope `all` because no file Agent M writes into a product stores the overview).
// Run: node --test tests/release-itm-1261-progress-by-stage.test.mjs
//
// Module: MOD-main-page
// Guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// Level: release
//
// Written for the release testing of sprint team1/136 by a participant who implemented none of ITM-1261 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The behaviour is reached as the existing tests reach it: onMainChanged runs in a temporary git repository of a product (tests/workflow-entries-main-changed-product.test.mjs, through tests/release-itm-1261-product-run.mjs), and the main page is MOD-main-page's route `home`, drawn with tests/main-page-home-harness.mjs over a fake GitHub whose branch overview-cache of the product holds the file the run stored (`net.overviews`, as tests/main-page-home-instance.test.mjs does). Reading taken: the harness names the product's head by a SHA of its own, so the stored file's `commit` field is set to that SHA and nothing else of it is changed. Nothing reaches the network.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";
import { PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, INSTANCE, browser, cardsOf, draw, headOf, instanceFiles, network, smallProduct, stagesOf, timers } from "./main-page-home-harness.mjs";
import { runInProduct } from "./release-itm-1261-product-run.mjs";

const home = view.routes.find((route) => route.name === "home");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const SPEC = ["# Library — Specification", "", "## Only section", "", "**A THING IS DONE** *(Product Owner)*", "It is done.", "*Check:* at review.", ""].join("\n");
const useCase = (n) => `---\nid: UC-00${n}\ntitle: Use case ${n}\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-00${n} Use case ${n}\n`;
// A product of one requirement and four use cases, of which the first `accepted` carry an approval record naming their text.
async function library(accepted) {
  const files = { "SPEC.md": SPEC };
  for (const n of [1, 2, 3, 4]) {
    const path = `docs/use-cases/UC-00${n}-case.md`;
    files[path] = useCase(n);
    if (n <= accepted) files[approvalPath(`UC-00${n}`, await blobSha(files[path]))] = recordText(reviewedRecord(path, await blobSha(files[path])));
  }
  return files;
}
// The main page with the product's card drawn from the overview the run stored on its overview-cache.
async function cardAfterRun(accepted) {
  const run = await runInProduct(await library(accepted));
  assert.equal(run.outcome, "done", `the run stored the overview: ${run.summary}`);
  const stored = JSON.parse(run.overview);
  net = network({ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.overviews[PRODUCT] = { [headOf(PRODUCT)]: JSON.stringify({ ...stored, commit: headOf(PRODUCT) }) };
  net.install();
  const cards = cardsOf(await draw(home, browser({ products: [PRODUCT_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN } })));
  assert.equal(cards.length, 1);
  return stagesOf(cards[0]);
}

// TST-1261402 · level: release · module: system
// guards: THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// given: a product alice/library with one requirement and four use cases, three of them accepted, whose overview-cache holds only its first commit; as the counter-proof the same product with all four accepted
// input: the workflow's onMainChanged run in the product; then the main page's route home, drawn over the file the run stored on overview-cache for main's commit
// expect: the product's card shows six stages in the order Requirements, Use cases, Architecture, Implementation, Tests, Release; the stage Use cases reads 75 %; counter-proof: with all four use cases accepted it reads 100 %
// Planted fault: onMainChanged in a product not adding the overview (src/workflow-entries/main-changed.mjs, `publishOverview` skipped when `inProduct`) leaves the card derived from the files (Use cases 50 %) and fails the case on "three of four use cases accepted".
test("TST-1261402 a product's card, drawn from the overview its run stored, shows six stages and its use cases at 75 %, with all four accepted at 100 %", async () => {
  const three = await cardAfterRun(3);
  assert.deepEqual(three.map(([stage]) => stage), ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"]);
  assert.equal(three[1][1], "75 %", "three of four use cases accepted");
  net.restore();
  timers.restore();
  const four = await cardAfterRun(4);
  assert.equal(four[1][1], "100 %", "counter-proof: all four accepted");
});
