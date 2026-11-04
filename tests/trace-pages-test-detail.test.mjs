// MOD-trace-pages' tests view opens a test (ITM-767), as UC-029 steps 4, 5 and 5a state it and as the accepted text of docs/architecture/MOD-trace-pages.md has it for the tests view: "its declaration, its schedule, its
// counter-proof, its code, its history across commits and releases", with the Uses MOD-test-schedule (occasionsOf, scheduleSchema, defaultSchedule), MOD-result-records (testHistory, resultSchema), MOD-repository-hosts
// (readHistory, readFileAt, listTags, WebLinks' file) and MOD-test-document (testDeclarations).
//
// Run: node --test tests/trace-pages-test-detail.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; EVERY TEST RUN LEAVES A RESULT RECORD; THE NAME IS THE ID AND IT SURVIVES
// Level: unit
//
// The route is called through its public Route.render with the key "tests" and the param row, the address `trace/tests/<TST>` that the page's links use, with a Host of the test's own (tests/trace-pages-harness.mjs): the
// files of the default branch and of the tag v2026.1.0, the branch `test-results`, the history of one test file, and a `webLinks` that records its arguments. The fixture: TST-801, a unit test with a counter-proof
// record, a run that failed and passed on later commits; TST-802, a model-dependent test that calls a paid service, with its rate at two releases; TST-803, flaky on the latest commit; TST-899, declared at the tag and
// removed from the default branch by the third commit of its file's history. The expected values are written in each case; none is read from a document. Readings the cases take where the texts leave one open, each
// named in the pull request:
//   - the detail is the section `test-detail` above the tree of the tests; its parts are `test-level`, `test-guards`, `test-given`, `test-input`, `test-expect`, `test-schedule`, `test-counter-proof` with
//     `test-participant`, `test-code`, `test-history-commits` (items `test-history-commit`, `test-history-flaky` for a flaky one), `test-history-releases` (items `test-history-release`) and `test-rate-line`
//     (items `test-rate-point`), `test-removed` and `test-unknown`; the id of a test in the tree is a link to it;
//   - the schedule row of a test is its level, and `paid` for a test that declares a paid service; the schedule is the product's docs/tests/schedule.md at the version shown, the book's default where there is none;
//   - the participant who wrote the test is the counter-proof record's `participant`; the record is shown as its file reads;
//   - the link to the code is WebLinks' `file` for the test's file at the version shown;
//   - a model-dependent test has a rate line with a point for each release that holds its runs, "<tag>: <k> of <n>";
//   - a test that is not declared at the version shown is looked for in the release tags, newest first; the commit that removed it is the first, in the history of its file, whose version no longer declares it
//     (the item's reading of 5a), however many commits of the file came after it; a test no release declares is unknown;
//   - what the page reads for a part and cannot read is named in a line `traces-problem` and leaves the other parts.
// Each case states its input and its expected result before it runs (given / input / expect). The counter-proofs are run as mutations and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const MAIN = "a".repeat(40), TAG = "b".repeat(40), EARLY = "c".repeat(40);
const C1 = "1".repeat(40), C2 = "2".repeat(40), C3 = "3".repeat(40);
const COMMITS = { main: MAIN, "v2026.1.0": TAG };
const SPEC = ["# Detail fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");

const declared = (id, { level = "unit", guards = "ALPHA RULE", given = "a fixture", input = "a call", expect = "a result", runs = null, paid = null }, title) => [
  `// ${id} · level: ${level} · module: system`, `// guards: ${guards}`, ...(runs ? [`// runs: ${runs}`, "// phrasings: 2"] : []), ...(paid ? [`// paid: ${paid}`] : []),
  `// given: ${given}`, `// input: ${input}`, `// expect: ${expect}`, `test("${title}", () => {});`, ""].join("\n");

const ALPHA = [
  declared("TST-801", { guards: "ALPHA RULE; UC-001", given: "a library with one loan", input: "the loan is returned", expect: "the loan is closed" }, "alpha holds"),
  declared("TST-802", { level: "release", runs: "5", paid: "Fixture AI" }, "beta asks a model"),
  declared("TST-803", { level: "component" }, "gamma flips"),
].join("\n");
const OLD_AT_TAG = [declared("TST-810", {}, "old stays"), declared("TST-899", {}, "old goes")].join("\n");
const OLD_AT_C1 = declared("TST-810", {}, "old stays");
const OLD_AT_MAIN = declared("TST-810", {}, "old stays");
const COUNTER_PROOF = ["---", "test: TST-801", `commit: ${EARLY}`, "participant: dev-sonnet-x", "date: 2026-09-01 10:00 UTC", "outcome: failed", "---",
  "## Fault", "", "The loan's due date is dropped.", "", "## Result", "", "It failed with the fault and passed without it.", ""].join("\n");
const SCHEDULE = ["---", "nightly: 02:00", "---", "## Levels", "",
  "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |", "|---|---|---|---|---|---|---|",
  "| unit | ✓ | ✓ | | | | |", "| component | | | ✓ | | | |", "| system | | | | | | |", "| paid | | | ✓ | ✓ | | |", "| release | | | | ✓ | | |", "| user | | | | | | |", ""].join("\n");

const MAIN_FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA, "tests/old.test.mjs": OLD_AT_MAIN, "docs/tests/counter-proofs/TST-801.md": COUNTER_PROOF, "docs/tests/schedule.md": SCHEDULE };
const TAG_FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA, "tests/old.test.mjs": OLD_AT_TAG };

function record(commit, rows, run = null) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", ...(run ? [`run: ${run}`] : []), "---"].join("\n");
  const table = ["| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  return `${front}\n## Outcomes\n\n${table}\n`;
}
const RESULTS = {
  [`runs/${EARLY}/20260901-1000-commit-aaaa.md`]: record(EARLY, [["TST-801", "unit", "failed", ""]]),
  [`runs/${TAG}/20261001-1000-release-bbbb.md`]: record(TAG, [["TST-801", "unit", "passed", ""], ["TST-802", "release", "passed", "3 of 5"]]),
  [`runs/${MAIN}/20261007-1000-commit-cccc.md`]: record(MAIN, [["TST-801", "unit", "passed", ""], ["TST-802", "release", "passed", "4 of 5"], ["TST-803", "component", "passed", ""]]),
  [`runs/${MAIN}/20261007-1005-commit-dddd.md`]: record(MAIN, [["TST-803", "component", "failed", ""]]),
};
const HISTORY = [
  { commit: C3, date: "2026-10-05T10:00:00Z", files: { "tests/old.test.mjs": OLD_AT_MAIN } },
  { commit: C2, date: "2026-10-03T10:00:00Z", files: { "tests/old.test.mjs": OLD_AT_TAG } },
  { commit: C1, date: "2026-10-01T10:00:00Z", files: { "tests/old.test.mjs": OLD_AT_C1 } },
];

const asked = [];
function hostOf({ files = MAIN_FILES, results = RESULTS, failResults = false, history = HISTORY, logs = {} } = {}) {
  const base = treeHost({ trees: { main: files, "v2026.1.0": TAG_FILES, "test-results": results }, tags: ["v2026.1.0"], history, onDefault: [MAIN, TAG, EARLY] });
  return { ...base,
    async readSnapshot(ref) {
      if (failResults && ref === "test-results") throw Object.assign(new Error("unreachable"), { name: "Unreachable" });
      return { ...(await base.readSnapshot(ref)), commit: COMMITS[ref] ?? ref };
    },
    async listTags() { return [{ name: "v2026.1.0", commit: TAG }]; },
    async ciRunLog(id) { return logs[id] ?? null; },
    webLinks: () => ({ file: (path, ref) => { asked.push([path, ref]); return `https://example.test/blob/${ref}/${path}`; }, run: (id) => `https://example.test/actions/runs/${id}` }) };
}
async function render(productHost, row, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/product", host: productHost } }, { key: "tests", ref: "main", ...(row ? { row } : {}), ...params });
  await until(() => find(target, (node) => String(node.className).split(" ").includes("test-detail")).length > 0 || !row);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return target;
}
const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
const textOf = (root, name) => withClass(root, name)[0]?.textContent;
const textsOf = (root, name) => withClass(root, name).map((node) => node.textContent);

// TST-767001 · level: unit · module: MOD-trace-pages
// guards: UC-029; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the fixture at main; known positive: without the param row the page has the tree and no detail
// input: the route rendered with row TST-801
// expect: a detail headed TST-801 alpha holds with its level unit, its guarded identifiers ALPHA RULE and UC-001, its precondition "a library with one loan", its input "the loan is returned" and its expected result "the loan is closed"
test("an opened test shows its level, guarded identifiers, precondition, input and expected result", async () => {
  assert.equal(withClass(await render(hostOf()), "test-detail").length, 0, "known positive");
  const target = await render(hostOf(), "TST-801");
  assert.match(textOf(target, "test-detail"), /^TST-801 alpha holds/);
  assert.equal(textOf(target, "test-level"), "unit");
  assert.deepEqual(textsOf(target, "test-guards-item"), ["ALPHA RULE", "UC-001"]);
  assert.equal(textOf(target, "test-given"), "a library with one loan");
  assert.equal(textOf(target, "test-input"), "the loan is returned");
  assert.equal(textOf(target, "test-expect"), "the loan is closed");
});

// TST-767002 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture, whose docs/tests/schedule.md ticks unit for every commit and pull request, component for nightly, and paid for nightly and release candidate; and the same product without that file
// input: TST-801 (unit), TST-803 (component) and TST-802 (release, declaring a paid service) opened; TST-801 opened without the schedule file
// expect: "every commit, pull request"; "nightly"; "nightly, release candidate" (the paid row); and, with the book's default, "every commit, pull request, nightly, release candidate, on demand" marked as the default
test("an opened test says when the schedule runs it, by its level or as a paid test, and the book's default where the product has none", async () => {
  const when = async (id, files) => textOf(await render(hostOf(files ? { files } : {}), id), "test-schedule");
  assert.equal(await when("TST-801"), "every commit, pull request");
  assert.equal(await when("TST-803"), "nightly");
  assert.equal(await when("TST-802"), "nightly, release candidate");
  const { "docs/tests/schedule.md": _schedule, ...without } = MAIN_FILES;
  assert.equal(await when("TST-801", without), "every commit, pull request, nightly, release candidate, on demand (the book's default schedule)");
});

// TST-767003 · level: unit · module: MOD-trace-pages
// guards: UC-029; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the fixture, whose docs/tests/counter-proofs/TST-801.md names the participant dev-sonnet-x; TST-802 has no record
// input: TST-801 opened; TST-802 opened
// expect: TST-801: the participant "dev-sonnet-x" and the record as its file reads (the fault "The loan's due date is dropped." in it); TST-802: "No counter-proof record." and no participant
test("an opened test shows its counter-proof record and the participant it names, or says it has none", async () => {
  const given = await render(hostOf(), "TST-801");
  assert.equal(textOf(given, "test-participant"), "dev-sonnet-x");
  assert.match(textOf(given, "test-counter-proof"), /The loan's due date is dropped\./);
  const none = await render(hostOf(), "TST-802");
  assert.equal(textOf(none, "test-counter-proof-none"), "No counter-proof record.");
  assert.equal(withClass(none, "test-participant").length, 0);
});

// TST-767004 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture; WebLinks' file records what it is asked
// input: TST-801 opened at main; at the tag v2026.1.0
// expect: a link test-code to https://example.test/blob/main/tests/alpha.test.mjs, the file and the version asked for; at the tag …/blob/v2026.1.0/tests/alpha.test.mjs
test("an opened test links to its code at the version shown", async () => {
  const at = async (ref) => withClass(await render(hostOf(), "TST-801", { ref }), "test-code")[0]?.getAttribute("href");
  assert.equal(await at("main"), "https://example.test/blob/main/tests/alpha.test.mjs");
  assert.equal(await at("v2026.1.0"), "https://example.test/blob/v2026.1.0/tests/alpha.test.mjs");
});

// TST-767005 · level: unit · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the fixture: TST-801 failed on the early commit and passed on the tag's and the latest; TST-803 passed and failed on the latest commit
// input: TST-801 opened; TST-803 opened
// expect: TST-801: one mark per commit that ran it, in the order of the records: cccccccc failed, bbbbbbb passed, aaaaaaa passed (first seven digits, then the outcome); one row for the tag v2026.1.0, passed; TST-803: the latest commit marked flaky
test("an opened test shows one mark per commit it ran on and one row per release, a flaky commit marked", async () => {
  const given = await render(hostOf(), "TST-801");
  assert.deepEqual(textsOf(given, "test-history-commit"), ["ccccccc failed", "bbbbbbb passed", "aaaaaaa passed"]);
  assert.deepEqual(textsOf(given, "test-history-release"), ["v2026.1.0 passed"]);
  const flaky = await render(hostOf(), "TST-803");
  assert.deepEqual(textsOf(flaky, "test-history-commit"), ["aaaaaaa flaky"]);
  assert.equal(withClass(flaky, "test-history-flaky").length, 1);
  assert.equal(withClass(given, "test-history-flaky").length, 0, "known positive: an ordinary commit is not marked flaky");
});

// TST-1168001 · level: unit · module: MOD-trace-pages
// guards: UC-029; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: TST-801 failed in an early result record whose run is https://example.test/actions/runs/701 and passed in the release record whose run is https://example.test/actions/runs/702; WebLinks' run URLs match both ids; ciRunLog gives null for 701 and a kept log for 702
// input: TST-801 opened through the public trace route
// expect: drawn, the early mark reads "ccccccc failed" with its log link at …/actions/runs/701 reading "log", and the release mark's link at …/actions/runs/702 reads "log"; once the early link is opened (clicked), only it reads "no longer available" (still at …/actions/runs/701) and the mark still reads "ccccccc failed"; the release link, opened, still reads "log"
test("TST-1168001 trace detail keeps an outcome when its run log is unavailable and links a kept log", async () => {
  const unavailable = "https://example.test/actions/runs/701";
  const kept = "https://example.test/actions/runs/702";
  const results = {
    ...RESULTS,
    [`runs/${EARLY}/20260901-1000-commit-aaaa.md`]: record(EARLY, [["TST-801", "unit", "failed", ""]], unavailable),
    [`runs/${TAG}/20261001-1000-release-bbbb.md`]: record(TAG, [["TST-801", "unit", "passed", ""], ["TST-802", "release", "passed", "3 of 5"]], kept),
  };
  const marks = withClass(await render(hostOf({ results, logs: { 702: "the kept log" } }), "TST-801"), "test-history-commit");
  assert.match(marks[0].textContent, /^ccccccc failed\b/, "the recorded outcome stays readable");
  const unavailableLink = find(marks[0], (node) => node.localName === "a")[0];
  const keptLink = find(marks[1], (node) => node.localName === "a")[0];
  assert.equal(unavailableLink.textContent, "log", "the link reads log until it is opened");
  assert.equal(unavailableLink.getAttribute("href"), unavailable);
  assert.equal(keptLink.textContent, "log");
  assert.equal(keptLink.getAttribute("href"), kept);
  unavailableLink.dispatchEvent(new Event("click"));
  await until(() => unavailableLink.textContent !== "log");
  assert.equal(unavailableLink.textContent, "no longer available");
  assert.equal(unavailableLink.getAttribute("href"), unavailable);
  assert.match(marks[0].textContent, /^ccccccc failed\b/, "the recorded outcome stays readable");
  keptLink.dispatchEvent(new Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(keptLink.textContent, "log");
  assert.equal(keptLink.getAttribute("href"), kept);
});

// TST-767006 · level: unit · module: MOD-trace-pages
// guards: UC-029; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: the fixture: TST-802 is model-dependent, 3 of 5 runs passed at the release v2026.1.0 (its tag's commit); TST-801 is not
// input: TST-802 opened; TST-801 opened
// expect: TST-802: a rate line with the point "v2026.1.0: 3 of 5"; TST-801: no rate line
test("a model-dependent test shows its rate per release as a line with the runs behind each point", async () => {
  assert.deepEqual(textsOf(await render(hostOf(), "TST-802"), "test-rate-point"), ["v2026.1.0: 3 of 5"]);
  assert.equal(withClass(await render(hostOf(), "TST-801"), "test-rate-line").length, 0);
});

// TST-767007 · level: unit · module: MOD-trace-pages
// guards: UC-029; THE NAME IS THE ID AND IT SURVIVES
// given: the fixture: TST-899 is declared at the tag v2026.1.0 in tests/old.test.mjs and no longer at main; the history of that file is three commits, the first and the second declaring it, the third (2026-10-05) not
// input: TST-899 opened at main; TST-810, which the file still declares, opened as the known positive; TST-777, which no release declares
// expect: TST-899: "Removed at commit 3333333 (2026-10-05)"; TST-810: no removal; TST-777: "No test TST-777 is declared at this version or at a release." and no removal
test("a removed test is marked as removed at the commit that removed it, and an unknown one is said to be unknown", async () => {
  const removed = await render(hostOf(), "TST-899");
  assert.equal(textOf(removed, "test-removed"), "Removed at commit 3333333 (2026-10-05)");
  assert.equal(withClass(await render(hostOf(), "TST-810"), "test-removed").length, 0, "known positive: a test still declared is not removed");
  const unknown = await render(hostOf(), "TST-777");
  assert.equal(textOf(unknown, "test-unknown"), "No test TST-777 is declared at this version or at a release.");
  assert.equal(withClass(unknown, "test-removed").length, 0);
});

// TST-767008 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture on main
// input: the route rendered without the param row
// expect: the id of each test in the tree is a link to #trace/key=tests/ref=main/row=<id>, the text of the id unchanged
test("the id of a test in the tree is a link to its detail", async () => {
  const target = await render(hostOf());
  const ids = withClass(target, "tests-id");
  assert.ok(ids.length >= 3, "known positive: the tree lists the tests");
  const first = ids.find((node) => node.textContent === "TST-801");
  assert.equal(first.localName, "a");
  assert.equal(first.getAttribute("href"), "#trace/key=tests/ref=main/row=TST-801");
});

// TST-767009 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture, in which the branch test-results cannot be read
// input: TST-801 opened
// expect: a line "The history could not be read: unreachable"; the declaration, the schedule, the counter-proof and the link to the code stay
test("a history that cannot be read is named and leaves the other parts", async () => {
  const target = await render(hostOf({ failResults: true }), "TST-801");
  assert.ok(textsOf(target, "traces-problem").includes("The history could not be read: unreachable"));
  assert.equal(textOf(target, "test-given"), "a library with one loan");
  assert.equal(textOf(target, "test-schedule"), "every commit, pull request");
  assert.equal(textOf(target, "test-participant"), "dev-sonnet-x");
  assert.equal(withClass(target, "test-code").length, 1);
});

// TST-767010 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture, but the history of tests/old.test.mjs is 42 commits: the first declares TST-899, the second removes it, and the forty after it change the file without declaring it again
// input: TST-899 opened at main
// expect: "Removed at commit 0202020 (2026-10-02)" — the removing commit, which lies beyond the latest thirty commits of the file
test("the commit that removed a test is named however many commits of its file came after it", async () => {
  const commit = (n) => String(n).padStart(2, "0").repeat(20);
  const history = [];
  for (let n = 42; n >= 1; n -= 1) {
    const text = n === 1 ? OLD_AT_TAG : `${OLD_AT_MAIN}// edit ${n}\n`;
    history.push({ commit: commit(n), date: `2026-10-${String(n < 10 ? n : 9 + 1).padStart(2, "0")}T10:00:00Z`, files: { "tests/old.test.mjs": text } });
  }
  history[history.length - 2].date = "2026-10-02T10:00:00Z";
  const target = await render(hostOf({ history }), "TST-899");
  assert.equal(textOf(target, "test-removed"), "Removed at commit 0202020 (2026-10-02)");
});

// TST-767011 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the fixture, but every commit of the history of tests/old.test.mjs (35 of them) declares TST-899, so that no commit of the file's history removes it
// input: TST-899 opened at main
// expect: the page ends, saying "Removed (no commit of its file's history is found that declares it and one after it that does not)" and naming no commit
test("a removed test whose removing commit the file's history does not show is said so, and the page ends", async () => {
  const history = [];
  for (let n = 35; n >= 1; n -= 1) history.push({ commit: String(n).padStart(2, "0").repeat(20), date: "2026-10-01T10:00:00Z", files: { "tests/old.test.mjs": `${OLD_AT_TAG}// edit ${n}\n` } });
  const target = await render(hostOf({ history }), "TST-899");
  assert.equal(textOf(target, "test-removed"), "Removed (no commit of its file's history is found that declares it and one after it that does not)");
});

// TST-767012 · level: unit · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the history of TST-767010 (42 commits of tests/old.test.mjs, the removal at the second), over a Host that notes every commit whose text of the file it is asked for
// input: TST-899 opened at main
// expect: the removing commit named (0202020), the text of the file asked for at forty-two commits, each once: no commit appears twice among the commits asked for, however many times the history was read
test("the text of a test file at a commit is read once, however far back the removal lies", async () => {
  const history = [];
  for (let n = 42; n >= 1; n -= 1) history.push({ commit: String(n).padStart(2, "0").repeat(20), date: "2026-10-02T10:00:00Z", files: { "tests/old.test.mjs": n === 1 ? OLD_AT_TAG : `${OLD_AT_MAIN}// edit ${n}\n` } });
  const host = hostOf({ history });
  const asked = [];
  const readFileAt = host.readFileAt;
  host.readFileAt = async (path, commits) => { if (path === "tests/old.test.mjs") asked.push(...commits); return readFileAt.call(host, path, commits); };
  const target = await render(host, "TST-899");
  assert.match(textOf(target, "test-removed"), /^Removed at commit 0202020/);
  assert.equal(asked.length, 42, "the text at each of the forty-two commits is asked for");
  assert.equal(new Set(asked).size, asked.length, "and no commit twice");
});
