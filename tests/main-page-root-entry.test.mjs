// MOD-main-page's root entry and its cached home reading (ITM-684).
// Run: node --test tests/main-page-root-entry.test.mjs
//
// Module: MOD-main-page
// Level: component

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { view } from "../src/main-page/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { productFacts, publishOverview } from "../src/progress-measures/index.mjs";
import { INSTANCE, NOW, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, buildOf, cardsOf, draw, endedJob, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const home = view.routes.find((route) => route.name === "home");
const JOB = "JOB-20261016-1000-ffff";
const overviewReads = (net) => net.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}/contents/`) && request.url.includes("ref=overview-cache"));
const requestPaths = (net, from) => net.requests.slice(from).map((request) => new URL(request.url).pathname.replace(/[0-9a-f]{40}$/, "<commit>"));

async function cachedContext(net) {
  const context = browser();
  const { defaultBranch } = await context.instance.host.repositoryInfo();
  const instanceSnapshot = await context.instance.host.readSnapshot(defaultBranch);
  const host = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const snapshot = await host.readSnapshot("main");
  const facts = await productFacts(host, instanceSnapshot, (commit) => context.instance.host.readSnapshot(commit), new Date(NOW), { scope: "all" });
  const head = headOf(PRODUCT);
  const commits = [];
  await publishOverview({
    readSnapshot: async (ref) => {
      assert.equal(ref, "overview-cache");
      return { commit: "0".repeat(40), paths: [] };
    },
    commitFiles: async (change) => { commits.push(change); return { commit: "1".repeat(40), url: "https://example.test/overview" }; },
  }, snapshot, facts);
  const files = commits[0].files;
  // The overview, the views of the progress and the backlog page (ITM-1260) and of the schedule page (ITM-1265) and latest.json; the main page reads the two .json files.
  assert.deepEqual(files.map((file) => file.path).sort(), [`${head}.backlog.json.gz`, `${head}.json`, `${head}.progress.json.gz`, `${head}.schedule.json.gz`, "latest.json"]);
  net.overviews[PRODUCT] = Object.fromEntries(files.filter((file) => file.path.endsWith(".json")).map((file) => [file.path.replace(/\.json$/, ""), file.text]));
  return context;
}

// TST-684001 · level: component · module: MOD-main-page
// guards: EVERY CODE FILE BELONGS TO A MODULE; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
// given: the real root entry index.html and the native MOD-main-page View
// input: the root's module script setup and the View's routes
// expect: index.html loads the Frame start entry with data-page="main" and data-views="main-page"; it loads neither src/home/home.mjs nor the legacy home stylesheet; the named native view supplies the home route
test("TST-684001 the real root starts the native main-page view, not the legacy home", () => {
  const html = readFileSync(new URL("index.html", ROOT), "utf8");
  assert.match(html, /<script type="module" src="src\/site-frame\/start\.mjs" data-page="main" data-views="main-page"><\/script>/);
  assert.doesNotMatch(html, /src\/home\/home\.mjs/);
  assert.doesNotMatch(html, /src\/home\/home\.css/);
  assert.equal(home?.name, "home");
});

// TST-684002 · level: component · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the native home route, one kept product with a real ended job plus the overview and latest.json its existing producer writes for the product's exact default-branch head; the existing Host fake records requests
// input: home is drawn; its first one-minute poll fires unchanged; then the same job record changes from done to failed and the following poll fires
// expect: after the public producer has prepared the cache, the initial draw reads its overview alone — and no job-record source fetch: the overview holds the build's records; the unchanged poll reads only product main commit/tree; the changed poll reads those plus one GraphQL batch containing only that changed job record
test("TST-684002 the native cached home keeps its initial job facts and polls unchanged and changed job records distinctly", async () => {
  const ended = endedJob({ id: JOB, by: "lab-pc-4", state: "done" });
  const files = smallProduct({ jobs: [ended] });
  const net = network({ [PRODUCT]: files, [INSTANCE]: instanceFiles() });
  net.install();
  try {
    const context = await cachedContext(net);
    const preparedRequests = net.requests.length;
    const preparedLog = net.server.log.length;
    const target = await draw(home, context);
    assert.equal(cardsOf(target).length, 1);
    const initialRequests = net.requests.slice(preparedRequests);
    assert.equal(initialRequests.filter((request) => request.url.includes("ref=overview-cache")).length, 1, "the overview alone is read after the producer prepared it");
    assert.equal(overviewReads({ requests: initialRequests }).length, 1);
    const initial = net.server.log.slice(preparedLog);
    assert.equal(initial.some((entry) => (entry.kind === "file" || entry.kind === "batch") && entry.files.includes(ended.path)), false, "the stored overview supplies the initial job text");
    const before = net.requests.length;
    await timers.fire(NOW + 60000);
    assert.deepEqual(requestPaths(net, before), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
    assert.deepEqual(net.requests.slice(before).map((request) => request.authorization), [`Bearer ${PRODUCT_TOKEN}`, `Bearer ${PRODUCT_TOKEN}`]);
    const changed = { ...files, [ended.path]: endedJob({ id: JOB, by: "lab-pc-4", state: "failed" }).text };
    net.change(PRODUCT, changed);
    const after = net.requests.length;
    const beforeLog = net.server.log.length;
    await timers.fire(NOW + 120000);
    assert.deepEqual(requestPaths(net, after), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>", "/graphql"]);
    assert.deepEqual(net.server.log.slice(beforeLog).filter((entry) => entry.kind === "batch").map((entry) => entry.files), [[ended.path]]);
  } finally {
    timers.restore();
    net.restore();
  }
});

// TST-684005 · level: component · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: the cached native home of TST-684002, then a newer main snapshot that adds one ended job record and then one that removes it
// input: the next two one-minute polls
// expect: the readings follow the jobs the card was drawn with alone (MOD-main-page, Data: "the records of the jobs the cards were drawn with, and nothing else"): the added record is not read — the poll reads the product's main commit and tree and nothing else, no GraphQL batch — and the card's build is unchanged; its removal reads no record text either
test("TST-684005 the native cached home reads no job record added after it was drawn, nor one removed", async () => {
  const ended = endedJob({ id: JOB, by: "lab-pc-4", state: "done" });
  const added = endedJob({ id: "JOB-20261016-1001-ffff", by: "lab-pc-4", state: "done" });
  const files = smallProduct({ jobs: [ended] });
  const net = network({ [PRODUCT]: files, [INSTANCE]: instanceFiles() });
  net.install();
  try {
    const context = await cachedContext(net);
    const target = await draw(home, context);
    const drawn = buildOf(cardsOf(target)[0]);
    assert.equal(drawn.length, 1, "known positive: the drawn job is in the build");
    net.change(PRODUCT, { ...files, [added.path]: added.text });
    const beforeAdded = net.requests.length;
    await timers.fire(NOW + 60000);
    assert.deepEqual(requestPaths(net, beforeAdded), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
    assert.deepEqual(net.server.log.filter((entry) => entry.files?.includes(added.path)), []);
    assert.deepEqual(buildOf(cardsOf(target)[0]), drawn);
    const withoutAdded = { ...files };
    delete withoutAdded[added.path];
    net.change(PRODUCT, withoutAdded);
    const beforeRemoved = net.requests.length;
    await timers.fire(NOW + 120000);
    assert.deepEqual(requestPaths(net, beforeRemoved), ["/repos/alice/product/commits/main", "/repos/alice/product/git/trees/<commit>"]);
  } finally {
    timers.restore();
    net.restore();
  }
});

// TST-684003 · level: component · module: MOD-main-page
// guards: WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the native home route with no kept product, so its only card is the instance
// input: the route is drawn through the existing instance Host
// expect: the instance's default branch commit and tree are each read once for the initial card, a positive control that the own card does not select another product head
test("TST-684003 the native home reads the own instance head and tree once", async () => {
  const net = network({ [INSTANCE]: instanceFiles() });
  net.install();
  try {
    const target = await draw(home, browser({ products: [] }));
    assert.equal(cardsOf(target).length, 1);
    const paths = requestPaths(net, 0).filter((path) => path.startsWith(`/repos/${INSTANCE}/`));
    assert.equal(paths.filter((path) => path === `/repos/${INSTANCE}/commits/main`).length, 1);
    assert.equal(paths.filter((path) => path === `/repos/${INSTANCE}/git/trees/<commit>`).length, 1);
  } finally {
    timers.restore();
    net.restore();
  }
});
