// Release tests of ITM-1307 — UC-027 step 1 on Tests → Schedule: where the repository stores no view of the schedule's counts, each row shows the counts MOD-progress-measures' `scheduleView` gives for the test declarations of the product, so that a declaration of the level `paid` counts in no row of a level. The behaviour is
// docs/architecture/MOD-test-pages.md's (`schedule`: "each row with the number of the product's tests it holds — the declarations of its level, and for the row of paid services those that call one —, taken from the counts stored for the commit shown [...], or counted from the test files where the repository stores none")
// and docs/architecture/MOD-progress-measures.md's (`scheduleView(facts: Facts) -> ScheduleView` — "the counts of `facts.tests`"; `ScheduleView`: "the number of the test declarations of each level, and of those that call a paid service"), and the SPEC's DON'T REPEAT YOURSELF ("An architecture defines each function, data structure and rule in one place").
// Run: node --test tests/release-itm-1307-schedule-one-rule.test.mjs
//
// Module: MOD-test-pages
// Module: MOD-progress-measures
// Guards: DON'T REPEAT YOURSELF; THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// Level: release
//
// Written for the release testing of sprint 125 by a participant who implemented none of ITM-1307 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is the real route `schedule` of MOD-test-pages, drawn as a person opens Tests → Schedule, over the counting fake of GitHub of tests/app-harness.mjs behind MOD-repository-hosts' real host,
// with the branch overview-cache absent, so that no view is stored (storedView answers null). The implementer's case (tests/test-pages-schedule-one-rule.test.mjs) takes one declaration of the level paid that calls no paid service; this case takes its own files, a second declaration of the level paid that calls one, and the reads the page makes. No request leaves the process.
// Readings the texts leave open, which the case states:
//   - "the same declarations" are those MOD-test-document's testDeclarations reads from the product's test files; scheduleView is given them as the `tests` of Facts (tests/progress-measures-facts.mjs) of the product's commit.
//   - A declaration "of the level paid" is one whose `level:` is written paid, a name outside the five levels (EVERY TEST HAS ONE LEVEL); scheduleView counts it in no row of a level, and in the row paid only if it names a paid service in `paid:`.
//   - The count shown is the cell <td class="tests"> of the row. "One batch" for the test files is the one `readMany` of the snapshot that names every test file, and no test file read by itself, as TST-1265304 reads it.
//   - The route's former counting, the counter-proof, is stated in the case: a declaration counted under the row of its level (the level paid included) and, if it names a paid service, under the row paid as well.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as measures from "../src/progress-measures/index.mjs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { facts } from "./progress-measures-facts.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "schedule");

const ROWS = ["unit", "component", "system", "paid", "release", "user"];
// A test file's text: one declaration for each entry [level, paid]; the lines are built by join, so that no line of this file is a declaration.
const declarations = (entries, from) => entries.map(([level, paid], at) => ["// TST-" + String(from + at).padStart(3, "0") + " · level: " + level + " · module: MOD-ledger",
  "// guards: BOOKS BALANCE", "// given: g", "// input: i", "// expect: e", ...(paid ? ["// paid: " + paid] : []), "test(\"t\", () => {});", ""].join("\n")).join("\n");
// Eight declarations in two files: unit 2 (one calls the service oracle), component 1, system 1, release 1, user 1, and two of the level paid, of which one calls the service oracle.
const TEST_FILES = {
  "tests/ledger-a.test.mjs": declarations([["unit"], ["unit", "oracle"], ["component"], ["system"], ["release"]], 1),
  "tests/ledger-b.test.mjs": declarations([["paid"], ["paid", "oracle"], ["user"]], 11),
};
const TESTS = Object.entries(TEST_FILES).flatMap(([path, text]) => testDeclarations(path, text));

const REGISTER = "# Participants of this instance\n\n**REGISTER**\n\nThe participants.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
const FILES = { "docs/participants.md": REGISTER, ...TEST_FILES };
const ADDRESS = `https://github.com/${REPO}`;

// The route drawn over a repository that stores no view -> { target, srv }.
async function show() {
  const srv = await repoServer({ files: FILES });
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
const testBatches = (srv) => srv.batches.map((batch) => batch.filter((path) => path.startsWith("tests/"))).filter((batch) => batch.length);
const testFilesByThemselves = (srv) => srv.requests.filter((request) => request.startsWith("file tests/"));
// The route's former rule, the counter-proof: the row of a declaration's level (the level paid included) and, for one that names a paid service, the row paid as well.
const formerCounts = (tests) => {
  const counts = Object.fromEntries(ROWS.map((row) => [row, 0]));
  for (const declaration of tests) {
    if (declaration.level in counts) counts[declaration.level] += 1;
    if (declaration.paid) counts.paid += 1;
  }
  return counts;
};

// TST-1307301 · level: release · module: MOD-test-pages
// guards: DON'T REPEAT YOURSELF; THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: a product whose repository stores no view (no branch overview-cache) and whose two test files hold eight declarations: two of the level unit (one calling the service oracle), one each of component, system, release and user, and two of the level paid, one calling the service oracle and one calling none; known positive first — testDeclarations reads the eight declarations from the two files, two of them of the level paid
// input: a person opens Tests → Schedule (the route schedule's render over the fake of GitHub); and scheduleView of the Facts of the product's commit whose tests are the eight declarations
// expect: the rows unit, component, system, paid, release and user show 2, 1, 1, 2, 1 and 1, the counts scheduleView gives for the same declarations; the declaration of the level paid that calls no paid service counts under no row, and the one that calls the oracle counts under the row paid once; counter-proof — the route's former rule gives 2, 1, 1, 4, 1 and 1 for the same declarations, which the page does not show; the two test files are told to the snapshot in one batch and neither is read by itself; no line "As of"
// Planted fault: the route's former counting put back (the `return { counts: scheduleView(testFacts(snapshot, declared)).counts, asOf: null }` of testCounts in src/test-pages/schedule.mjs replaced by a loop that counts `declaration.level in counts` and `declaration.paid`) shows 4 under paid, and the case fails on the counts.
// Planted fault: scheduleView given no declaration (`testFacts(snapshot, [])`) shows zero in every row, and the case fails on the counts.
// Planted fault: scheduleView counting a declaration under the row of its level whatever the level (`declaration.level !== "paid" &&` left out of scheduleView in src/progress-measures/views.mjs) counts the two declarations of the level paid under paid, and the case fails on scheduleView's counts.
// Planted fault: the test files not told to the snapshot in one batch (the `readMany` of testCounts left out) makes no batch, and the case fails on the batch.
test("TST-1307301 #schedule, where no view is stored, shows the counts scheduleView gives, a declaration of the level paid counted in no row of a level", async () => {
  assert.equal(TESTS.length, 8, "known positive: the eight declarations are read from the two files");
  assert.deepEqual(TESTS.filter((declaration) => declaration.level === "paid").map((declaration) => declaration.paid), [null, "oracle"], "known positive: two declarations are of the level paid, one calling the oracle");
  const expected = measures.scheduleView(facts({ tests: TESTS })).counts;
  assert.deepEqual(expected, { unit: 2, component: 1, system: 1, release: 1, user: 1, paid: 2 }, "scheduleView counts the level paid in no row, and the one calling the oracle under paid");
  const counted = (tests) => measures.scheduleView(facts({ tests })).counts;
  const levelPaid = TESTS.filter((declaration) => declaration.level === "paid");
  assert.deepEqual(counted(TESTS.filter((declaration) => declaration !== levelPaid[0])), expected, "the declaration of the level paid that calls no paid service counts under no row");
  assert.equal(counted(TESTS.filter((declaration) => declaration !== levelPaid[1])).paid, expected.paid - 1, "the one that calls the oracle counts under paid once");
  assert.deepEqual(formerCounts(TESTS), { unit: 2, component: 1, system: 1, paid: 4, release: 1, user: 1 }, "counter-proof: the former rule counts both declarations of the level paid under paid");
  assert.notDeepEqual(formerCounts(TESTS), expected, "counter-proof: the former rule counts the same declarations otherwise");

  const { target, srv } = await show();
  const shown = countsOf(target);
  assert.deepEqual(shown, { unit: expected.unit, component: expected.component, system: expected.system, paid: expected.paid, release: expected.release, user: expected.user }, "the route's counts are scheduleView's");
  assert.notDeepEqual(shown, formerCounts(TESTS), "the page does not show the former rule's counts");
  assert.deepEqual(testBatches(srv).map((batch) => [...batch].sort()), [Object.keys(TEST_FILES).sort()], "the two test files in one batch");
  assert.deepEqual(testFilesByThemselves(srv), [], "no test file is read by itself");
  assert.doesNotMatch(target.textContent, /As of/);
});
