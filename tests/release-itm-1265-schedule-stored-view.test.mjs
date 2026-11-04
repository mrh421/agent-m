// Release tests of ITM-1265 — UC-027 step 1 on Tests → Schedule: each row of the schedule names how many tests it holds, taken from the counts CI stored for the commit shown, or, where the repository stores none, counted from the test files. The behaviour is
// docs/architecture/MOD-progress-measures.md's (`scheduleView`: "the counts of `facts.tests`. Pure; `publishOverview` adds `<commit>.schedule.json.gz` from it, in the same commit as the other views, and a file the branch holds already is left as it is"; `publishOverview`:
// "A file the branch holds already is left as it is; `written` is `false` when it holds all three. A commit that adds any also writes `latest.json`") and docs/architecture/MOD-test-pages.md's (`schedule`: "each row with the number of the product's tests it holds ...,
// taken from the counts stored for the commit shown (MOD-progress-measures' `storedView` with the page `schedule`, with its as-of line while the head's are not stored yet), or counted from the test files where the repository stores none").
// Run: node --test tests/release-itm-1265-schedule-stored-view.test.mjs
//
// Module: MOD-progress-measures; MOD-test-pages
// Guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// Level: release
//
// Written for the release testing of sprint 114 by a participant who implemented none of ITM-1265 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases (tests/progress-measures-schedule-view.test.mjs, tests/test-pages-schedule-stored-view.test.mjs) take
// one set of four tests and three states of one repository; these cases take their own: thirteen tests in three files, the sixteen states of the four files on the branch, and the page over views of other formats. publishOverview is called over a host of this file's own that records each
// commitFiles; the page is the real route over tests/app-harness.mjs' counting fake of GitHub. No request leaves the process. Readings the texts leave open, taken here:
//   - "written is false when it holds all three" is read, with scheduleView's entry that gives the schedule's view "in the same commit as the other views", as: false exactly when the branch holds all four files of the commit, the overview, the three views; one missing makes it true.
//   - "an unknown level counts in no row" (the Acceptance's counter-proof) is read for a declaration of a level outside the five that calls no paid service. The row of paid services counts the declarations that call one (MOD-test-pages: "for the row of paid services those that call one"),
//     whatever their level, so an unknown level that calls a paid service counts there and nowhere else.
//   - "one batch" for the test files is read as the one `readMany` of the snapshot that names every test file, and no test file read by itself.
//   - A stored view that holds another format (the counts without the row paid) is no view stored: the page counts the test files.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import * as measures from "../src/progress-measures/index.mjs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { COMMIT, facts } from "./progress-measures-facts.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "schedule");

// ---------------------------------------------------------------- the tests of the product: thirteen declarations in three files
//
// unit 4 (one of them calls the service "oracle"), component 2, system 3 (one calls "oracle"), release 2, user 1, and one of the level "integration", which is none of the five and calls no paid service. The rows: unit 4, component 2, system 3, release 2, user 1, paid 2.

const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const DERIVED = { unit: 4, component: 2, system: 3, paid: 2, release: 2, user: 1 };
// A test file's text: one declaration for each entry [level, paid]; the lines are built by join, so that no line of this file is a declaration.
const declarations = (entries, from) => entries.map(([level, paid], at) => ["// TST-" + String(from + at).padStart(3, "0") + " · level: " + level + " · module: MOD-ledger",
  "// guards: BOOKS BALANCE", "// given: g", "// input: i", "// expect: e", ...(paid ? ["// paid: " + paid] : []), "test(\"t\", () => {});", ""].join("\n")).join("\n");
const TEST_FILES = {
  "tests/ledger-a.test.mjs": declarations([["unit"], ["unit"], ["unit", "oracle"], ["unit"]], 1),
  "tests/ledger-b.test.mjs": declarations([["component"], ["component"], ["system"], ["system", "oracle"], ["system"]], 11),
  "tests/ledger-c.test.mjs": declarations([["release"], ["release"], ["user"], ["integration"]], 21),
};
const TESTS = Object.entries(TEST_FILES).flatMap(([path, text]) => testDeclarations(path, text));

// ---------------------------------------------------------------- publishOverview over a host of this file's own

const BRANCH_HEAD = "0".repeat(40);
const SCHEDULE = `${COMMIT}.schedule.json.gz`;
const OVERVIEW = [`${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`, SCHEDULE];
const snapshot = { commit: COMMIT, paths: [], blob: () => null, read: async () => null };
function hostOver(paths) {
  const commits = [];
  return { commits, readSnapshot: async () => ({ commit: BRANCH_HEAD, paths }), commitFiles: async (change) => { commits.push(change); return { commit: "9".repeat(40), url: "" }; } };
}
const unzipped = (bytes) => JSON.parse(gunzipSync(Buffer.from(bytes)).toString("utf8"));

// TST-1265301 · level: release · module: MOD-progress-measures
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: facts at the commit ccc…c whose tests are the thirteen declarations of the three files above; a branch overview-cache that holds no file
// input: publishOverview(host, snapshot, facts)
// expect: { commit: ccc…c, written: true } by exactly one commit, on overview-cache at the head it read, that holds ccc…c.json, ccc…c.progress.json.gz, ccc…c.backlog.json.gz, ccc…c.schedule.json.gz and latest.json, and no other file; the schedule's file gunzips to { commit: ccc…c, counts: { unit: 4, component: 2, system: 3, release: 2, user: 1, paid: 2 } }, with no declaration in it
// Planted fault: a publishOverview that leaves the schedule's view out of the commit (the schedule entry of the list in src/progress-measures/stages.mjs) writes four files; one that writes it in a commit of its own makes two commits; one that counts the declaration of the unknown level fails the counts; one that stores the declarations beside the counts fails the equality.
test("TST-1265301 publishOverview adds the schedule's view with the overview, the other views and latest.json in one commit", async () => {
  assert.equal(TESTS.length, 13, "known positive: the thirteen declarations are read from the three files");
  const host = hostOver([]);
  assert.deepEqual(await measures.publishOverview(host, snapshot, facts({ tests: TESTS })), { commit: COMMIT, written: true });
  assert.equal(host.commits.length, 1, "one commit");
  assert.deepEqual([host.commits[0].branch, host.commits[0].expectedHead], ["overview-cache", BRANCH_HEAD]);
  assert.deepEqual(host.commits[0].files.map((file) => file.path).sort(), [...OVERVIEW, "latest.json"].sort());
  const stored = unzipped(host.commits[0].files.find((file) => file.path === SCHEDULE).bytes);
  assert.deepEqual(stored, { commit: COMMIT, counts: { unit: 4, component: 2, system: 3, release: 2, user: 1, paid: 2 } });
});

// TST-1265302 · level: release · module: MOD-progress-measures
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: the facts of TST-1265301; the four files of the commit ccc…c — the overview, the progress, backlog and schedule views —, and the sixteen branches that hold each subset of them, a latest.json naming 0c0c…0c besides
// input: publishOverview(host, snapshot, facts) to each of the sixteen
// expect: for the branch that holds all four: { written: false }, no commit; for each of the other fifteen: { written: true } by one commit that holds exactly the files the branch lacks and latest.json naming ccc…c, and none it holds — so the schedule's view is added where only it is missing, and is left where it is held
// Planted fault: a publishOverview that never writes the schedule's view (the `["schedule", scheduleView]` entry of the list in src/progress-measures/stages.mjs left out) fails the branches that lack it; one that writes latest.json although it adds no file (the `files.length > 0` guard of latest.json left out) makes a commit for the branch that holds all four and fails that case.
test("TST-1265302 publishOverview answers written false only where the branch holds all four files, and adds exactly the ones it lacks", async () => {
  for (let mask = 0; mask < 16; mask += 1) {
    const held = OVERVIEW.filter((_, at) => mask & (1 << at)), lacking = OVERVIEW.filter((_, at) => !(mask & (1 << at)));
    const host = hostOver([...held, "latest.json"]);
    const result = await measures.publishOverview(host, snapshot, facts({ tests: TESTS }));
    if (lacking.length === 0) {
      assert.deepEqual(result, { commit: COMMIT, written: false }, "all four held");
      assert.deepEqual(host.commits, [], "all four held: no commit");
      continue;
    }
    assert.deepEqual(result, { commit: COMMIT, written: true }, `holds ${held.join(", ") || "nothing"}`);
    assert.equal(host.commits.length, 1, `holds ${held.join(", ") || "nothing"}`);
    assert.deepEqual(host.commits[0].files.map((file) => file.path).sort(), [...lacking, "latest.json"].sort(), `holds ${held.join(", ") || "nothing"}`);
  }
});

// ---------------------------------------------------------------- the page: the route schedule over a counting fake of GitHub

const ADDRESS = `https://github.com/${REPO}`;
const HEAD = "d".repeat(40);
const C0 = "0d".repeat(20);
const REGISTER = "# Participants of this instance\n\n**REGISTER**\n\nThe participants.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
const FILES = { "docs/participants.md": REGISTER, ...TEST_FILES };
const STORED = { unit: 21, component: 22, system: 23, paid: 24, release: 25, user: 26 };
const stored = (commit, counts) => new Uint8Array(gzipSync(JSON.stringify({ commit, counts })));

// The route drawn with the branch overview-cache holding `overview` (null: no such branch) -> { target, srv }.
async function show(overview) {
  const cache = (url) => {
    if (url.origin !== "https://api.github.com" || url.searchParams.get("ref") !== "overview-cache") return undefined;
    const path = decodeURIComponent(url.pathname.slice(`/repos/${REPO}/contents/`.length));
    return overview !== null && Object.hasOwn(overview, path) ? new Response(overview[path], { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
  };
  const srv = await repoServer({ files: FILES, handlers: [cache], head: HEAD });
  const real = globalThis.fetch;
  globalThis.fetch = srv.fetch;
  try {
    const host = connect(parseAddress(ADDRESS), { token: TOKEN });
    const target = globalThis.document.createElement("div");
    globalThis.document.body.append(target);
    await route.render(target, { page: "main", instance: { repository: REPO, host }, store: null, go() {}, product: { address: ADDRESS, kind: "github", host, tokenStored: true } }, {});
    return { target, srv };
  } finally {
    globalThis.fetch = real;
  }
}
const walk = (root, match) => { const found = []; (function visit(node) { for (const kid of node.childNodes ?? []) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); visit(kid); } } })(root); return found; };
const countsOf = (target) => Object.fromEntries(ROWS.map((row) => [row, Number(walk(walk(target, (node) => node.localName === "tr" && node.getAttribute("data-row") === row)[0],
  (node) => node.localName === "td" && (node.className ?? "").split(" ").includes("tests"))[0].textContent)]));
const cacheReads = (srv) => srv.requests.filter((request) => request.startsWith("handler GET ") && request.includes("ref=overview-cache"));
const testBatches = (srv) => srv.batches.map((batch) => batch.filter((path) => path.startsWith("tests/"))).filter((batch) => batch.length);
const testFilesByThemselves = (srv) => srv.requests.filter((request) => request.startsWith("file tests/"));

// TST-1265303 · level: release · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: a product whose three test files hold 4, 2, 3, 2 and 1 tests of the five levels and two that call the service oracle; the branch overview-cache holds the schedule's view of the head ddd…d with the counts 21, 22, 23, 24, 25 and 26, words the test files do not say
// input: the route schedule's render
// expect: the rows unit, component, system, paid, release and user show 21, 22, 23, 24, 25 and 26, the stored counts and not those of the files; one read of overview-cache; no batch that names a test file and no test file read by itself; no line "As of"
// Planted fault: a route that counts the test files although a view is stored (the `if (stored)` return of testCounts in src/test-pages/schedule.mjs left out) shows 4, 2, 3, 2, 2 and 1 and reads the files; a route that reads the view and the files both fails the reads; one that shows the as-of line for the head's own view fails the last assertion.
test("TST-1265303 #schedule draws the head's stored view and reads no test file", async () => {
  const { target, srv } = await show({ [`${HEAD}.schedule.json.gz`]: stored(HEAD, STORED) });
  assert.deepEqual(countsOf(target), STORED);
  assert.equal(cacheReads(srv).length, 1, srv.requests.join("\n"));
  assert.deepEqual(testBatches(srv), [], "no batch names a test file");
  assert.deepEqual(testFilesByThemselves(srv), [], "no test file is read by itself");
  assert.doesNotMatch(target.textContent, /As of/);
});

// TST-1265304 · level: release · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: the same product, and three states of its overview-cache: no such branch; a branch that holds the schedule's view of the head in another format — counts without the row paid —, and nothing else; a branch with a latest.json naming 0d0d…0d and no view of it
// input: the route schedule's render over each
// expect: over each the rows show the counts of the test files, 4, 2, 3, 2, 2 and 1 (unit, component, system, paid, release, user), with no line "As of"; the three test files are told to the snapshot in one batch and none is read by itself; known positive: the test files are read
// Planted fault: a route that draws a stored view of another format (the `schedule` format check of FORMAT in src/progress-measures/views.mjs made always true) shows that view's counts and fails the second state; one that does not tell the snapshot the test files in one batch (the `readMany` of testCounts in src/test-pages/schedule.mjs left out) makes no batch and fails the batch assertion.
test("TST-1265304 #schedule counts the test files in one batch where the repository stores no usable view", async () => {
  const states = [["no branch", null], ["a view of another format", { [`${HEAD}.schedule.json.gz`]: stored(HEAD, { unit: 1, component: 1, system: 1, release: 1, user: 1 }) }],
    ["latest.json names a commit with no view", { "latest.json": `${JSON.stringify({ commit: C0 })}\n` }]];
  for (const [what, overview] of states) {
    const { target, srv } = await show(overview);
    assert.deepEqual(countsOf(target), DERIVED, what);
    assert.deepEqual(testBatches(srv).map((batch) => [...batch].sort()), [Object.keys(TEST_FILES).sort()], `${what}: the three test files in one batch`);
    assert.deepEqual(testFilesByThemselves(srv), [], `${what}: no test file is read by itself`);
    assert.doesNotMatch(target.textContent, /As of/, what);
  }
});

// TST-1265305 · level: release · module: MOD-progress-measures
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: the three test files, whose thirteen declarations include one of the level integration that calls no paid service; the facts of the commit with those declarations, without that one, and with a fourteenth of the level integration that calls the service oracle
// input: scheduleView of the facts of each of the three; the route schedule's render over the files and no stored view
// expect: scheduleView gives the same counts with and without the declaration of the unknown level, 4, 2, 3, 2, 1 and 2 for unit, component, system, release, user and paid; with the fourteenth, which calls the oracle, only the row paid gains one (3); the page, counting the files, shows for each row the number scheduleView gives for the same files
// Planted fault: a scheduleView that counts an unknown level under a row (`Object.hasOwn(counts, declaration.level)` of src/progress-measures/views.mjs replaced by true) adds a key "integration" or a count to a row and fails the first equality; one that counts a paid declaration only under its level fails the row paid; a page and a scheduleView that count by other rules differ on the final comparison.
test("TST-1265305 a declaration of an unknown level counts in no row of a level, and the page and scheduleView count the same files alike", async () => {
  const counted = (tests) => measures.scheduleView(facts({ tests })).counts;
  const without = TESTS.filter((declaration) => declaration.level !== "integration");
  assert.equal(TESTS.length - without.length, 1, "known positive: the file holds one declaration of the unknown level");
  assert.deepEqual(counted(TESTS), counted(without), "the declaration of the unknown level changes no row");
  assert.deepEqual(counted(TESTS), { unit: 4, component: 2, system: 3, release: 2, user: 1, paid: 2 });
  const calling = { ...TESTS.find((declaration) => declaration.level === "integration"), id: "TST-099", paid: "oracle" };
  assert.deepEqual(counted([...TESTS, calling]), { unit: 4, component: 2, system: 3, release: 2, user: 1, paid: 3 }, "an unknown level that calls a paid service counts in the row paid alone");
  const { target } = await show(null);
  const viewed = counted(TESTS);
  assert.deepEqual(countsOf(target), { unit: viewed.unit, component: viewed.component, system: viewed.system, paid: viewed.paid, release: viewed.release, user: viewed.user });
});
