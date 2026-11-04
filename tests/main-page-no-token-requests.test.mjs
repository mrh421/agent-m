// MOD-main-page's route `home` reads a product that has no stored overview for its head at a cost the module file states and accepts (ITM-842; UC-046 step 3): "Without a token, that reading
// costs one request per test file of the default branch (MOD-progress-measures' `stageShares`); that cost is accepted." This test pins that
// cost as a formula over the files of the fixture: requests = backlog items + job records + test files + a fixed part, and names each request of the fixed part. GitHub's raw host takes no
// batch, so without a token every file is a request of its own (`A PAGE LOAD READS THE REPOSITORY IN BATCHES` holds with a token); with one the files go in batches of at most a hundred.
// The native route runs over the counting fake of GitHub (tests/progress-measures-load.mjs, through tests/main-page-home-harness.mjs), and every request is attributed to what it reads.
// The counts are taken, not copied from a document.
// Run: node --test tests/main-page-no-token-requests.test.mjs
//
// Module: MOD-main-page
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Each test states its input and its expected values in its own text (given / input / expect). Nothing reaches the network; nothing sleeps.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { INSTANCE, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, byClass, cardsOf, draw, instanceFiles, network, productFiles, timers } from "./main-page-home-harness.mjs";

const home = view.routes.find((candidate) => candidate.name === "home");
let net;
afterEach(() => { net?.restore(); timers.restore(); });

// The fixture: 600 backlog items, 400 job records, SPEC.md, tests/unit.test.mjs, and `testFiles` more test files, each with the declarations of one test. This repository's tests folder holds about 700.
const ITEMS = 600, JOBS = 400, TEST_FILES = 700, FEWER_TEST_FILES = 350;
const testFile = (n) => [`// TST-${String(n).padStart(6, "0")} · level: unit · module: MOD-store`, "// guards: FIRST RULE", "// given: a store", "// input: a read", "// expect: its text",
  `test("a store reads ${n}", () => {});`, ""].join("\n");
const files = (testFiles) => ({ ...productFiles({ items: ITEMS, jobs: JOBS }), ...Object.fromEntries(Array.from({ length: testFiles }, (_, i) => [`tests/t${String(i).padStart(4, "0")}.test.mjs`, testFile(i + 1)])) });

// What a request reads. Every request is given one of these names; one that fits none is counted as `unattributed`, so that a request the tables below do not name fails the test.
const fileOf = (who, path) => {
  if (who === "product" && /^docs\/backlog\/ITM-/.test(path)) return "product: backlog item";
  if (who === "product" && /^docs\/jobs\/JOB-/.test(path)) return "product: job record";
  if (who === "product" && /^tests\/.*\.test\.mjs$/.test(path)) return "product: test file";
  if (who === "product" && path === "SPEC.md") return "product: SPEC.md";
  if (who === "instance" && path === "docs/participants.md") return "instance: participants.md";
  return `unattributed: ${who} file ${path}`;
};
// What a read of the branch overview-cache reads: the overview of a commit, or latest.json, which names the commit of the overview stored last; a read of a commit's facts file, which no page makes, is named too, so that one fails the counts.
const storedOf = (who, file) => `${who}: ${file === "latest.json" ? "stored latest.json" : `stored ${file.endsWith(".facts.json") ? "facts" : "overview"}`}`;
function labelOf({ url }) {
  const address = new URL(url), path = decodeURIComponent(address.pathname);
  const whoOf = (repository) => (repository === PRODUCT ? "product" : repository === INSTANCE ? "instance" : `other ${repository}`);
  if (address.host === "raw.githubusercontent.com") {
    const [, owner, name, ref, ...rest] = path.split("/"), file = rest.join("/"), who = whoOf(`${owner}/${name}`);
    if (ref === "overview-cache") return storedOf(who, file);
    return fileOf(who, file);
  }
  if (address.host !== "api.github.com") return `unattributed: ${address.host}${path}`;
  if (path === "/graphql") return "GraphQL batch of files";
  const repo = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(path);
  if (!repo) return `unattributed: ${path}`;
  const who = whoOf(repo[1]), rest = repo[2] ?? "";
  if (rest === "") return `${who}: repository`;
  if (rest === "/commits/main") return `${who}: commit of main`;
  if (rest === "/commits/test-results") return `${who}: branch test-results`;
  if (rest.startsWith("/git/trees/")) return `${who}: tree of main`;
  if (rest === "/pulls") return `${who}: pull requests`;
  if (rest === "/tags" || rest.startsWith("/git/matching-refs/tags/")) return `${who}: tags`;
  if (rest === "/actions/runs") return `${who}: CI runs of the head`;
  if (rest.startsWith("/contents/")) {
    const file = rest.slice("/contents/".length);
    return address.searchParams.get("ref") === "overview-cache" ? storedOf(who, file) : fileOf(who, file);
  }
  return `unattributed: ${path}`;
}
const tally = (requests) => {
  const counts = {};
  for (const request of requests) { const label = labelOf(request); counts[label] = (counts[label] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};
const total = (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0);
/** What `after` has beyond `before`, label by label: only the labels whose counts differ. */
const beyond = (after, before) => Object.fromEntries([...new Set([...Object.keys(after), ...Object.keys(before)])].sort()
  .map((label) => [label, (after[label] ?? 0) - (before[label] ?? 0)]).filter(([, difference]) => difference !== 0));

/** The requests the route `home` makes for the same product on a fresh fake, with the product's token or without any (and none for the instance), as { counts, requests, batches }: `batches` the files of each GraphQL batch. */
async function newPage(testFiles, token) {
  net = network({ [PRODUCT]: files(testFiles), [INSTANCE]: instanceFiles() });
  net.install();
  const target = await draw(home, token ? browser({ instanceToken: null }) : browser({ tokens: {}, instanceToken: null }));
  assert.equal(cardsOf(target).length, 1);
  assert.equal(byClass(target, "is-error").length, 0);
  const requests = net.requests.slice(), batches = net.server.log.filter((entry) => entry.kind === "batch").map((entry) => entry.files);
  net.restore();
  timers.restore();
  return { counts: tally(requests), requests, batches };
}

// The reads the old page and the route `home` make alike, and the reads of the fixed part that only the route makes.
const SHARED = { "product: commit of main": 1, "product: tree of main": 1, "product: pull requests": 1, "product: SPEC.md": 1, "product: tags": 1 };
const ONLY_THE_ROUTE = { "instance: repository": 1, "instance: commit of main": 1, "instance: tree of main": 1, "instance: participants.md": 1,
  "product: repository": 1, "product: branch test-results": 1, "product: stored overview": 1, "product: stored latest.json": 1, "product: CI runs of the head": 1 };
const FIXED = total(SHARED) + total(ONLY_THE_ROUTE);

// TST-842001 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: a product of 600 backlog items, 400 job records, SPEC.md and 701 test files, no overview stored for its head, no token stored for it or for the instance; an instance holding its participant list
// input: the route home drawn on a fresh fake of GitHub
// expect: it makes 1,715 requests = 600 items + 400 job records + 701 test files + 14 more; the 14 are the product's commit, tree, pull requests, SPEC.md and tags (5), the instance's repository, commit, tree and participants.md (4), the product's repository, its branch test-results, the stored overview of its head and the file latest.json of its branch overview-cache, which are not there (4), and the CI runs of its head (1); no request is unattributed, and no facts file is asked for
test("TST-842001 without a token and without a stored overview, the route home makes one request per backlog item, job record and test file, and 14 more", async () => {
  const { counts } = await newPage(TEST_FILES, null);
  assert.deepEqual(counts, { ...SHARED, ...ONLY_THE_ROUTE, "product: backlog item": ITEMS, "product: job record": JOBS, "product: test file": TEST_FILES + 1 });
  assert.equal(FIXED, 14);
  assert.equal(total(counts), ITEMS + JOBS + (TEST_FILES + 1) + FIXED);
  assert.equal(total(counts), 1715);
});

// TST-842002 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the product of TST-842001, and the same product with 350 test files fewer; no token, nothing stored
// input: the route home drawn on each
// expect: the route home makes 350 requests fewer on the smaller one (one for each test file)
test("TST-842002 the route home's cost grows by one request per test file", async () => {
  const many = await newPage(TEST_FILES, null);
  const fewer = await newPage(TEST_FILES - FEWER_TEST_FILES, null);
  assert.equal(total(many.counts) - total(fewer.counts), FEWER_TEST_FILES);
  assert.deepEqual(beyond(many.counts, fewer.counts), { "product: test file": FEWER_TEST_FILES });
});

// TST-842003 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the product of TST-842001; no token, nothing stored
// input: the route home drawn on a fresh fake
// expect: it makes 1,715 requests: the 701 test files and the instance's 4 reads, the product's repository, branch test-results, stored overview and latest.json (4) and the CI runs of the head (1), beside its product reads
test("TST-842003 the route home's 1,715 requests include its test files and fixed instance and stored-overview reads", async () => {
  const now = await newPage(TEST_FILES, null);
  assert.equal(total(now.counts), 1715);
  assert.deepEqual(Object.fromEntries(Object.entries(now.counts).filter(([label]) => label in ONLY_THE_ROUTE || label === "product: test file")),
    { ...ONLY_THE_ROUTE, "product: test file": TEST_FILES + 1 });
  for (const [label, count] of Object.entries({ ...SHARED, "product: backlog item": ITEMS, "product: job record": JOBS })) {
    assert.equal(now.counts[label], count, label);
  }
});

// TST-842004 · level: unit · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-046
// given: the product of TST-842001 with a token stored for it
// input: the route home drawn
// expect: the route home makes 33 requests — 20 POST /graphql: 19 batches of at most a hundred files, which hold the 600 items, 400 job records, 701 test files and SPEC.md, and greenToMerge's beside the product's repositoryInfo (ITM-1170), which holds none —, and 13 more: the 9 reads only the route makes, the product's commit, tree, pull requests and tags —, with no backlog item, job record or test file by itself
test("TST-842004 with a token, the route home reads the files in batches of at most a hundred and makes 33 requests", async () => {
  const now = await newPage(TEST_FILES, PRODUCT_TOKEN);
  assert.equal(total(now.counts), 33);
  // ITM-1170: the label counts every POST /graphql; one of the 20 is greenToMerge's, beside the product's repositoryInfo, and holds no file.
  assert.equal(now.counts["GraphQL batch of files"], 20);
  assert.equal(now.batches.length, 20);
  assert.ok(now.batches.every((paths) => paths.length <= 100), "a batch holds at most a hundred files");
  const read = now.batches.flat();
  assert.equal(read.filter((path) => path.startsWith("docs/backlog/")).length, ITEMS);
  assert.equal(read.filter((path) => path.startsWith("docs/jobs/")).length, JOBS);
  assert.equal(read.filter((path) => /^tests\/.*\.test\.mjs$/.test(path)).length, TEST_FILES + 1);
  assert.equal(read.filter((path) => path === "SPEC.md").length, 1);
  assert.equal(read.length, ITEMS + JOBS + (TEST_FILES + 1) + 1);
  assert.equal(now.counts["instance: participants.md"], 1); // the instance has no token here: its participant list is a raw read of its own
  for (const label of ["product: backlog item", "product: job record", "product: test file"]) assert.equal(now.counts[label], undefined, `${label} is read by itself`);
});
