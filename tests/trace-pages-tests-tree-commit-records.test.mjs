// MOD-trace-pages' tests tree shows each test's outcome on the commit of the version shown (UC-029 step 1). The records it needs are those of that commit alone, so it reads the branch `test-results`
// through one snapshot narrowed to `runs/<commit>` (ITM-1309), as MOD-test-pages' route `runs` does and as the history of a test does (ITM-1276), and never the branch's whole tree.
// docs/architecture/MOD-trace-pages.md (Files): "It reads ... the result records on the branch `test-results`." It names what is read, not how; "A PAGE LOAD READS THE REPOSITORY IN BATCHES" (SPEC.md)
// asks for no more than the page shows.
//
// Run: node --test tests/trace-pages-tests-tree-commit-records.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: component
//
// The route is called through its public Route.render with the key "tests". The product's Host is the one of tests/trace-pages-harness.mjs, whose snapshot of `test-results` holds only the files of the folders it
// was narrowed to and fails a read of any other path (OutsideSnapshot); it notes every readSnapshot with the folders it was given and every read. The branch holds the records of three commits: the main
// commit, an older commit and the commit of the tag v2026.1.0. Each case states its expected requests in its own text; none is read from a document. Readings the cases take, each from the sentence quoted:
//   - "narrowed to `runs/<commit>`" (ITM-1309): the folder is `runs/` and the commit the version's snapshot names (a tag's commit for a tag), and no other folder; the read is one snapshot of the branch.
//   - "and no whole tree" (ITM-1309): no readSnapshot of the branch without folders.
//   - "a record of another commit is not read" (ITM-1309): no read of a path outside `runs/<commit>/`, which the narrowed snapshot would refuse in any case.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const MAIN = "a".repeat(40), OLD = "c".repeat(40), TAG = "b".repeat(40);
const COMMITS = { main: MAIN, "v2026.1.0": TAG };

const SPEC = ["# Records fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const declared = (id, title) => [`// ${id} · level: unit · module: system`, "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", `test("${title}", () => {});`, ""].join("\n");
const FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": [declared("TST-701", "alpha holds"), declared("TST-702", "alpha again")].join("\n") };

function record(commit, rows) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.map(([id, outcome]) => `| ${id} | unit | ${outcome} | |`).join("\n")}\n`;
}
const RESULTS = {
  [`runs/${MAIN}/20261007-1000-commit-aaaa.md`]: record(MAIN, [["TST-701", "passed"], ["TST-702", "failed"]]),
  [`runs/${OLD}/20261006-1000-commit-cccc.md`]: record(OLD, [["TST-701", "failed"], ["TST-702", "passed"]]),
  [`runs/${TAG}/20261005-1000-commit-bbbb.md`]: record(TAG, [["TST-701", "passed"], ["TST-702", "passed"]]),
};

// `held` notes the paths each snapshot of the branch test-results was handed with.
function hostOf() {
  const base = treeHost({ trees: { main: FILES, "v2026.1.0": FILES, "test-results": RESULTS }, tags: ["v2026.1.0"] });
  const held = [];
  return { ...base, held, async readSnapshot(ref, options) {
    const snapshot = await base.readSnapshot(ref, options);
    if (ref === "test-results") held.push([...snapshot.paths]);
    return { ...snapshot, commit: COMMITS[ref] ?? ref };
  } };
}
const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
const outcomesOf = (target) => withClass(target, "tests-case").map((node) => [withClass(node, "tests-id")[0].textContent, withClass(node, "tests-outcome")[0].textContent]);
async function render(host, ref = "main") {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/product", host } }, { key: "tests", ref });
  await until(() => outcomesOf(target).length >= 2);
  return target;
}
const ofResults = (host) => host.log.narrowed.filter(([ref]) => ref === "test-results");
const recordsRead = (host) => host.log.reads.filter((path) => path.startsWith("runs/"));

// TST-1309001 · level: component · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a branch test-results with the records of three commits (main's: 701 passed, 702 failed; an older commit's: 701 failed, 702 passed; the tag's), and a Host that refuses a read outside the folders a snapshot was narrowed to
// input: Route.render with the key "tests" at main
// expect: the two cases show 701 "passed" and 702 "failed", main's outcomes (known positive: the page is drawn from records); exactly one readSnapshot of test-results, narrowed to the one folder runs/<main's commit>, and no readSnapshot of it without folders
test("the tests tree reads the branch test-results through one snapshot narrowed to the folder of the version's commit, and no whole tree", async () => {
  const host = hostOf();
  const target = await render(host);
  assert.deepEqual(outcomesOf(target), [["TST-701", "passed"], ["TST-702", "failed"]], "known positive: main's outcomes are shown");
  const read = ofResults(host);
  assert.equal(read.length, 1, "one snapshot of the branch");
  assert.deepEqual(read[0][1], [`runs/${MAIN}`]);
  assert.equal(read.filter(([, folders]) => folders === null).length, 0, "no whole tree of the branch");
});

// TST-1309002 · level: component · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture of TST-1309001
// input: Route.render with the key "tests" at main
// expect: counter-proof — the snapshot of the branch holds the one record file of main's commit and no record of the older commit or of the tag's commit; the records read are that one file (known positive: main's record is held and read)
test("a record of another commit than the version's is not held and not read", async () => {
  const host = hostOf();
  await render(host);
  assert.deepEqual(recordsRead(host), [`runs/${MAIN}/20261007-1000-commit-aaaa.md`], "known positive: main's record is read");
  assert.deepEqual(host.held, [[`runs/${MAIN}/20261007-1000-commit-aaaa.md`]], "the snapshot holds main's record alone, none of the older commit or the tag's");
});

// TST-1309003 · level: component · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture of TST-1309001
// input: Route.render with the key "tests" at the tag v2026.1.0
// expect: the two cases show 701 "passed" and 702 "passed", the tag commit's outcomes; one readSnapshot of test-results, narrowed to runs/<the tag's commit> alone, and none without folders
test("at a tag the tests tree reads the folder of the tag's commit alone", async () => {
  const host = hostOf();
  const target = await render(host, "v2026.1.0");
  assert.deepEqual(outcomesOf(target), [["TST-701", "passed"], ["TST-702", "passed"]], "known positive: the tag commit's outcomes are shown");
  const read = ofResults(host);
  assert.equal(read.length, 1);
  assert.deepEqual(read[0][1], [`runs/${TAG}`]);
});
