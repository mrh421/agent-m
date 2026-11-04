// Release tests of ITM-1279 — the route `runs/<commit>` reads, of the branch test-results, only the records of the commit shown and of the last release's commit, and the test
// files of the commit in batches, seen from outside: what the page asks of the product's host, and what it shows. The behaviour is docs/architecture/MOD-test-pages.md's: "`runs/<commit>`
// reads, of the branch `test-results`, only the records of the commit shown and of the last release's commit, through a snapshot of that branch narrowed to their folders
// (MOD-repository-hosts' `readSnapshot` with `folders`), and the test files of the commit in batches (`readMany`)."; the requirement A PAGE LOAD READS THE REPOSITORY IN BATCHES ("one load
// of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100 files each"); and UC-028 step 2 (the result records of that
// commit, and one line per level), alternative flow 2b (records that cannot be read) and 7a (a rate beside the last release's).
// Run: node --test tests/release-itm-1279-runs-reads-two-commits.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES; EVERY TEST RUN LEAVES A RESULT RECORD
// Level: release
//
// Written for the release testing of sprint 112 by a participant who implemented none of ITM-1279 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/test-pages-runs-reads.test.mjs) count the reads for a product with a release and 150 test files; these cases take the boundaries that file leaves out: a product with no release tag
// yet, tags that are no release, the highest of several releases, the commit shown being the release's own, the sizes at which a batch is full, and records that cannot be read. They are written
// from the texts, with their own fixtures and their own counting host.
//
// The host is a stand-in for MOD-repository-hosts' interface (repositoryInfo, readSnapshot, readHistory, listPullRequests, listTags, ciRunLog, webLinks) and logs every request of the page;
// no request leaves the process. A snapshot answers as the interface states it: `paths` are the files of the folders it was read with (the whole branch without `folders`), a `read` of a path
// outside them fails with OutsideSnapshot, `readMany` fetches the texts of the files not yet fetched ahead, one request for each hundred of them at most (the host's BATCH), and a `read` of a file
// not fetched is a request of its own. The `folders` are listed once each, as the host lists them. Readings the texts leave open, taken here:
//   - "the last release's commit": the commit of the highest tag v<major>.<minor>.<patch>, by the numbers (v1.10.0 above v1.9.0); a tag with a suffix (v2.0.0-rc.1) or without three numbers is none.
//     The route's header (src/test-pages/runs.mjs) states the same reading; the texts do not say how releases are ordered.
//   - a product with no release tag: the texts name "the last release's commit" and rateComparison states "no comparison without a last release", so no folder for it is read and no rate is compared.
//   - the commit shown is a release's own: the folder is the same, so it is read once (the host lists each folder once).

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/test-pages/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "runs");
const PRODUCT = "https://github.com/org/product";
const COMMIT = "c".repeat(40);
const R9 = "9".repeat(40);
const R10 = "a".repeat(40);
const RC = "e".repeat(40);
const OTHER = "3".repeat(40);
const BATCH = 100;

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const testOf = (page, id) => descendants(page, (node) => node.getAttribute?.("data-test") === id)[0];
const levelOf = (page, level) => descendants(page, (node) => node.getAttribute?.("data-level") === level)[0];
const rowsOf = (page) => descendants(page, (node) => Boolean(node.getAttribute?.("data-test")));
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
const sorted = (list) => [...list].sort();

// ---------------------------------------------------------------- the fixtures

const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A GUARDED RULE** *(Product Owner)*", "A rule.", "*Check:* `tests/t000.test.mjs`", ""].join("\n");
// The text of one test file with one declaration. Built by join, so that no line of this file is a declaration.
const declaration = (number, level, extra = []) => ["// TST-" + number + " · level: " + level + " · module: system", "// guards: A GUARDED RULE", "// given: g", "// input: i", "// expect: e", ...extra,
  "test(\"t\", () => {});", ""].join("\n");
const testPath = (i) => `tests/t${String(i).padStart(3, "0")}.test.mjs`;
// `count` test files of level unit, TST-8000 on; and, where `rated`, one more of level component, TST-8100, model-dependent (20 runs).
function commitFiles(count, { rated = false } = {}) {
  const files = { "SPEC.md": SPEC, "src/a.mjs": "export const a = 1;\n", "docs/note.md": "# Note\n" };
  for (let i = 0; i < count; i += 1) files[testPath(i)] = declaration(8000 + i, "unit");
  if (rated) files["tests/rated.test.mjs"] = declaration(8100, "component", ["// runs: 20", "// phrasings: 2"]);
  return files;
}

const front = (commit, who, extra = "") => `---\ncommit: ${commit}\nlevels:\n  - unit\n  - component\noccasion: commit\nparticipant: ${who}\ndate: 2026-10-18T10:00:00Z\n${extra}---\n`;
const outcomes = (...rows) => `## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const at = (commit, name) => `runs/${commit}/${name}.md`;
const FIRST = at(COMMIT, "20261018-1000-commit-aaaa");
const SECOND = at(COMMIT, "20261018-1100-on-demand-bbbb");
const AT_R9 = at(R9, "20260901-1000-release-candidate-9999");
const AT_R10 = at(R10, "20261001-1000-release-candidate-1010");
const AT_RC = at(RC, "20261015-1000-release-candidate-eeee");
const AT_OTHER = at(OTHER, "20261015-1000-commit-3333");
// The commit shown: TST-8000 passed, TST-8001 failed, TST-8100 17 of 20. Its second record: TST-8002 passed. The rates of the others: v1.9.0 20 of 20, v1.10.0 18 of 20.
const RECORDS = {
  [FIRST]: front(COMMIT, "ci-hosted") + outcomes("| TST-8000 | unit | passed | |", "| TST-8001 | unit | failed | |", "| TST-8100 | component | passed | 17 of 20 |"),
  [SECOND]: front(COMMIT, "lab-runner") + outcomes("| TST-8002 | unit | passed | |"),
  [AT_R9]: front(R9, "ci-hosted") + outcomes("| TST-8100 | component | passed | 20 of 20 |"),
  [AT_R10]: front(R10, "ci-hosted") + outcomes("| TST-8100 | component | passed | 18 of 20 |"),
  [AT_RC]: front(RC, "ci-hosted") + outcomes("| TST-8100 | component | passed | 19 of 20 |"),
  [AT_OTHER]: front(OTHER, "ci-hosted") + outcomes("| TST-8003 | unit | failed | |"),
};

// ---------------------------------------------------------------- the counting host

// A snapshot of `files` that logs what it is asked, into `log`; `folders` narrows it as readSnapshot's folders do.
function snapshotOf(label, commit, files, log, { folders = null, extra = {} } = {}) {
  const inside = (path) => folders === null || folders.some((folder) => path === folder || path.startsWith(`${folder}/`));
  const held = Object.fromEntries(Object.entries(files).filter(([path]) => inside(path)));
  const fetched = new Set();
  const refuse = (path) => { if (!inside(path)) throw Object.assign(new Error(`OutsideSnapshot ${path}`), { name: "OutsideSnapshot", path }); };
  return {
    commit, paths: Object.keys(held), blob: () => "b".repeat(40),
    read: async (path) => {
      refuse(path);
      if (!fetched.has(path) && path in held) { fetched.add(path); log.push({ kind: "file", snapshot: label, path }); }
      return held[path] ?? null;
    },
    readMany: async (paths) => {
      for (const path of paths) refuse(path);
      const wanted = [...new Set(paths)].filter((path) => path in held && !fetched.has(path));
      for (let from = 0; from < wanted.length; from += BATCH) {
        const batch = wanted.slice(from, from + BATCH);
        for (const path of batch) fetched.add(path);
        log.push({ kind: "batch", snapshot: label, paths: batch });
      }
    },
    ...extra,
  };
}

function productHost(log, { tags = [], files = commitFiles(3, { rated: true }), failTags = null, failResults = null } = {}) {
  const entry = (commit, message, date) => ({ commit, parents: [], author: { account: null, name: "x" }, date, message, changes: [] });
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }),
    readHistory: async (path, options) => [entry(options.ref, "Fix the list", "2026-10-17T09:00:00Z")],
    listPullRequests: async () => [],
    listTags: async () => { if (failTags) throw failTags; return tags; },
    readSnapshot: async (ref, options = {}) => {
      if (ref === "test-results") {
        if (failResults) throw failResults;
        const folders = options.folders ? [...new Set(options.folders.map((folder) => folder.replace(/\/+$/, "")))] : null;
        log.push({ kind: folders ? "folders" : "tree", snapshot: "test-results", folders: folders ? sorted(folders) : null });
        return snapshotOf("test-results", "r".repeat(40), RECORDS, log, { folders });
      }
      log.push({ kind: "tree", snapshot: ref });
      // The graph "main changed" stored for the commit is read through readOn, as the page reads it; building it is no read of the page.
      return snapshotOf(ref, ref, files, log, { extra: { readOn: storedGraphReadOn({ paths: Object.keys(files), read: async (path) => files[path] ?? null, commit: ref }) } });
    },
    ciRunLog: async () => null,
    webLinks: () => ({ actions: `${PRODUCT}/actions`, run: (id) => `${PRODUCT}/actions/runs/${id}`, secrets: `${PRODUCT}/settings/secrets/actions`,
      commitRuns: (commit) => `${PRODUCT}/commit/${commit}/checks`, branch: (name) => `${PRODUCT}/tree/${name}` }),
  };
}

// The route rendered for COMMIT against a product with these tags, test files and failures; resolves with the page and the log.
async function load(options = {}) {
  const log = [];
  const context = { page: "main", instance: { repository: "alice/agent-m", host: productHost([]) }, store: null, go: () => {},
    product: { address: PRODUCT, kind: "github", host: productHost(log, options), tokenStored: true } };
  const target = document.createElement("div");
  document.body.append(target);
  await route().render(target, context, { commit: COMMIT });
  return { page: target, log };
}

const named = (log, snapshot) => log.filter((each) => each.snapshot === snapshot);
const readPaths = (log) => log.flatMap((each) => each.kind === "file" ? [each.path] : each.kind === "batch" ? each.paths : []);

// What the page asked of the branch test-results: no whole tree, one request for the folders, the records in one batch, none by itself.
function assertRecordsRead(log, { folders, records }) {
  const results = named(log, "test-results");
  assert.deepEqual(results.filter((each) => each.kind === "tree"), [], "no recursive tree of the branch test-results");
  assert.deepEqual(results.filter((each) => each.kind === "folders").map((each) => each.folders), [sorted(folders)], "one request, for the folders of the commit shown and of the last release");
  assert.deepEqual(results.filter((each) => each.kind === "batch").map((each) => sorted(each.paths)), [sorted(records)], "the records of those folders, in one batch");
  assert.deepEqual(results.filter((each) => each.kind === "file"), [], "no record by itself");
}

// ================================================================== the tests

// TST-1279301 · level: release · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product that has no tag at all, so that no release exists (the last release is none); the branch test-results holds the two records of the commit shown, one each of the commits v1.9.0 and v1.10.0 would name, of a release candidate and of a third commit; the commit holds 3 test files and 1 model-dependent one
// input: the route runs rendered for the commit, with a token
// expect: the branch is read once, narrowed to the one folder runs/<commit> — no tree of it, no folder for a release —, and its two records are read in one batch; the unit line reads "2 passed, 1 failed, 0 flaky, 0 not run" (TST-8000 and TST-8002 passed, TST-8001 failed); the rate of TST-8100 reads "17 of 20 runs" with no "last release" and no "worse"; the commit's own tree is read once; counter-proof: with a release tag the same fixture reads the release's folder too
// Planted fault: the route naming `runs/${lastRelease}` whether a release exists (the spread guard `lastRelease ?` left out of detail in src/test-pages/runs.mjs) asks for runs/null, and the case fails on the folders; the route reading the whole branch fails on the tree.
test("TST-1279301 a product with no release tag yet reads only the folder of the commit shown", async () => {
  const { page, log } = await load({ tags: [] });
  assertRecordsRead(log, { folders: [`runs/${COMMIT}`], records: [FIRST, SECOND] });
  assert.equal(readPaths(named(log, "test-results")).some((path) => !path.startsWith(`runs/${COMMIT}/`)), false, "no record of another commit is read");
  assert.match(textOf(byClass(levelOf(page, "unit"), "summary")[0]), /^2 passed, 1 failed, 0 flaky, 0 not run$/);
  assert.equal(byClass(testOf(page, "TST-8001"), "outcome")[0].textContent, "failed");
  const rate = textOf(testOf(page, "TST-8100"));
  assert.ok(rate.includes("17 of 20 runs"), rate);
  assert.ok(!/last release|worse/.test(rate), `no comparison without a release: ${rate}`);
  assert.equal(named(log, COMMIT).filter((each) => each.kind === "tree").length, 1, "the commit's tree once");
  // The counter-proof: the same product with a release tag reads that release's folder too, so that the single folder above is the page's choice.
  const withRelease = await load({ tags: [{ name: "v1.0.0", commit: R10 }] });
  assertRecordsRead(withRelease.log, { folders: [`runs/${COMMIT}`, `runs/${R10}`], records: [FIRST, SECOND, AT_R10] });
});

// TST-1279302 · level: release · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product whose tags are none of them a release — v1.0.0-rc.1 and v2.0.0-rc.2 on the commit of a release candidate, v1.2 (two numbers), v1 and nightly on others — and whose branch test-results holds a record of the release candidate's commit
// input: the route runs rendered for the commit, with a token
// expect: only the folder runs/<commit> is read, and the record of the release candidate's commit is read by no request; the rate of TST-8100 reads "17 of 20 runs" with no "last release"
// Planted fault: the route taking the highest tag of any kind as the last release (the pattern RELEASE_TAG of src/test-pages/runs.mjs matching v1.0.0-rc.1) reads runs/<rc commit> too, and the case fails on the folders.
test("TST-1279302 tags that are no release are not the last release", async () => {
  const tags = [{ name: "v1.0.0-rc.1", commit: RC }, { name: "v2.0.0-rc.2", commit: RC }, { name: "v1.2", commit: R9 }, { name: "v1", commit: R9 }, { name: "nightly", commit: OTHER }];
  const { page, log } = await load({ tags });
  assertRecordsRead(log, { folders: [`runs/${COMMIT}`], records: [FIRST, SECOND] });
  const rate = textOf(testOf(page, "TST-8100"));
  assert.ok(rate.includes("17 of 20 runs") && !/last release|worse/.test(rate), rate);
});

// TST-1279303 · level: release · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: tags v1.9.0 (commit 9…), v2.0.0-rc.1 (commit of a release candidate), v1.10.0 (commit a…) and v1.2.0, listed in that order, and a record at each of those commits — TST-8100 at 20 of 20 at v1.9.0, 19 of 20 at the candidate, 18 of 20 at v1.10.0
// input: the route runs rendered for the commit, where TST-8100 ran 17 of 20
// expect: the folders read are runs/<commit> and runs/<v1.10.0's commit> only; the three records of those folders are read in one batch, and no record of v1.9.0, of the candidate or of the third commit is read by any request; TST-8100 reads "17 of 20 runs", "(last release: 18 of 20)" and "worse than the last release"
// Planted fault: the route taking the first release in the tags' order, or ordering the names as text (v1.9.0 above v1.10.0), takes v1.9.0 and reads runs/9… and the case fails on the folders.
test("TST-1279303 the last release is the highest version by its numbers, whatever the order of the tags", async () => {
  const tags = [{ name: "v1.9.0", commit: R9 }, { name: "v2.0.0-rc.1", commit: RC }, { name: "v1.10.0", commit: R10 }, { name: "v1.2.0", commit: OTHER }];
  const { page, log } = await load({ tags });
  assertRecordsRead(log, { folders: [`runs/${COMMIT}`, `runs/${R10}`], records: [FIRST, SECOND, AT_R10] });
  const read = readPaths(log);
  for (const left of [AT_R9, AT_RC, AT_OTHER]) assert.equal(read.includes(left), false, `${left} is read by no request`);
  const rate = textOf(testOf(page, "TST-8100"));
  assert.ok(rate.includes("17 of 20 runs") && rate.includes("(last release: 18 of 20)") && /worse than the last release/.test(rate), rate);
});

// TST-1279304 · level: release · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the commit shown is itself the commit of the last release, v1.0.0
// input: the route runs rendered for that commit
// expect: the branch is read once, narrowed to the one folder runs/<commit>, its two records read in one batch and once each; TST-8100 reads "17 of 20 runs" beside "(last release: 17 of 20)" and not "worse than the last release"
// Planted fault: a route that read the release's folder as a second request, or that read a record once for the commit and again for the release, fails on the one folders request or on the one batch.
test("TST-1279304 the commit shown being the release's own reads its folder once", async () => {
  const { page, log } = await load({ tags: [{ name: "v1.0.0", commit: COMMIT }] });
  assertRecordsRead(log, { folders: [`runs/${COMMIT}`], records: [FIRST, SECOND] });
  const rate = textOf(testOf(page, "TST-8100"));
  assert.ok(rate.includes("17 of 20 runs") && rate.includes("(last release: 17 of 20)") && !/worse/.test(rate), rate);
});

// TST-1279305 · level: release · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a commit that holds, besides SPEC.md, a source file and a note, 0, 1, 100, 101 and 250 test files of one declaration each, in five loads; the host answers a readMany with one request for each hundred files not yet fetched
// input: the route runs rendered for the commit, with a token, once for each number
// expect: the commit's tree is read once; the requests that carry test files are, for 0 files none, for 1 file [1], for 100 files [100], for 101 files [100, 1], for 250 files [100, 100, 50]; no test file is read by itself, every batch holds only test files, together exactly the commit's test files, and neither SPEC.md, the source file nor the note is in a batch; the page shows one row for each test file
// Planted fault: the route naming the files to readMany one by one (a readMany call for each path in src/test-pages/runs.mjs) makes a request of one file for each, and the case fails on the sizes from 101 on; the route naming only the first hundred leaves the 101st to a read of its own.
test("TST-1279305 the test files are read in batches of a hundred, at the sizes where a batch fills", async () => {
  for (const [count, sizes] of [[0, []], [1, [1]], [100, [100]], [101, [100, 1]], [250, [100, 100, 50]]]) {
    const files = commitFiles(count);
    const { page, log } = await load({ tags: [], files });
    const shown = named(log, COMMIT);
    assert.equal(shown.filter((each) => each.kind === "tree").length, 1, `${count} files: the commit's tree once`);
    const batches = shown.filter((each) => each.kind === "batch");
    assert.deepEqual(batches.map((each) => each.paths.length), sizes, `${count} files: the sizes of the batches`);
    const tests = Object.keys(files).filter((path) => path.startsWith("tests/"));
    assert.deepEqual(sorted(batches.flatMap((each) => each.paths)), sorted(tests), `${count} files: the batches hold exactly the test files`);
    assert.deepEqual(shown.filter((each) => each.kind === "file" && tests.includes(each.path)), [], `${count} files: no test file by itself`);
    assert.equal(rowsOf(page).length, count, `${count} files: a row for each test`);
  }
});

// TST-1279306 · level: release · module: MOD-test-pages
// guards: UC-028
// given: UC-028 alternative flow 2b — records that cannot be read from the browser, for example in a private repository without a token: first the host's listTags fails (Unreachable), then, with the tags readable, its read of the branch test-results fails (TokenRefused); known positive first — a readable product shows no such notice
// input: the route runs rendered for the commit in each of the three
// expect: the readable product shows no notice of unreadable records; in each failing one the render completes, the page says the result records cannot be read and links the branch test-results and the runs of the commit on the server (the addresses webLinks gives), and the commit's tree, its test files and the records are read by no request
// Planted fault: the route reading the tags outside its guard (listTags before the try of detail in src/test-pages/runs.mjs) lets the first failure reject the render, and the case fails on it; a route that read the commit's tree before the records fails the last assertion.
test("TST-1279306 records that cannot be read give the notice of the use case and read nothing more", async () => {
  const ok = await load({ tags: [] });
  assert.equal(byClass(ok.page, "unreadable").length, 0, "known positive: a readable product shows no notice of unreadable records");
  const failures = [
    ["the tags fail", { failTags: Object.assign(new Error("offline"), { name: "Unreachable" }) }],
    ["the branch fails", { tags: [], failResults: Object.assign(new Error("refused"), { name: "TokenRefused" }) }],
  ];
  for (const [what, options] of failures) {
    const { page, log } = await load(options);
    const notice = byClass(page, "unreadable");
    assert.equal(notice.length, 1, `${what}: the notice`);
    assert.match(textOf(notice[0]), /cannot be read/, what);
    assert.deepEqual(descendants(notice[0], (node) => node.localName === "a").map((link) => link.getAttribute("href")),
      [`${PRODUCT}/tree/test-results`, `${PRODUCT}/commit/${COMMIT}/checks`], `${what}: the branch and the runs of the commit on the server`);
    assert.deepEqual(log.filter((each) => each.kind === "batch" || each.kind === "file" || (each.kind === "tree" && each.snapshot === COMMIT)), [], `${what}: nothing is read after it`);
  }
});
