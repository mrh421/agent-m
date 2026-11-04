// What the route `runs/<commit>` reads of the product (ITM-1279) — MOD-test-pages' text: "`runs/<commit>` reads, of the branch `test-results`, only the records of the commit shown and of the last
// release's commit, through a snapshot of that branch narrowed to their folders (MOD-repository-hosts' `readSnapshot` with `folders`), and the test files of the commit in batches (`readMany`)."; and
// the requirement A PAGE LOAD READS THE REPOSITORY IN BATCHES: "one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100
// files each". What the page shows of the commit is what tests/test-pages-runs.test.mjs expects; this file counts what it asks of the host to show it.
// Run: node --test tests/test-pages-runs-reads.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: component
//
// The product is a host of this file, kept to MOD-repository-hosts' interface (repositoryInfo, readSnapshot, readHistory, listPullRequests, listTags, ciRunLog, webLinks), which counts every request the page
// makes of it: no request leaves the process. A snapshot answers as the interface states it: `read` fetches a file's text once, one request; `readMany` fetches the texts of many files ahead, a request for
// each hundred files at most (the limit of one query of the server's batch request, as tests/repository-hosts-read-many.test.mjs counts it), after which the `read`s make no request; with `folders`, `paths` are
// the files of those folders only, and a read of any other path fails with OutsideSnapshot, as tests/repository-hosts-snapshot-folders.test.mjs states it. The branch test-results holds the records of 40
// commits, three of them named below; the commit shown holds 150 test files in one folder, one declaration each.
// Where the texts leave a reading open, the test states the reading it takes, and the pull request names it:
//   - The records of the two commits are named to `readMany` before they are read, so that they too are read in a batch; the texts say "the texts of the files it shows in requests of at most 100 files each".
//   - The commit's own tree is read once, whole (`readSnapshot(commit)`): the texts say "its commit and that commit's tree once".

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/test-pages/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "runs");
const PRODUCT = "https://github.com/org/product";
const COMMIT = "c".repeat(40);
const RELEASE = "d".repeat(40);
const THIRD = "3".repeat(40);
const BATCH = 100;

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const levelOf = (page, level) => descendants(page, (node) => node.getAttribute?.("data-level") === level)[0];
const testOf = (page, id) => descendants(page, (node) => node.getAttribute?.("data-test") === id)[0];
const textOf = (node) => node.textContent.replace(/\s+/g, " ");

// ---------------------------------------------------------------- the fixtures

const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A GUARDED RULE** *(Product Owner)*", "A rule.", "*Check:* `tests/t000.test.mjs`", ""].join("\n");
// 150 test files, tests/t000.test.mjs to tests/t149.test.mjs, one declaration each: TST-9000 to TST-9119 of level unit, TST-9120 to TST-9139 of level component, TST-9140 to TST-9149 of level release;
// TST-9121 is model-dependent. Built by join, so that no line of this file is a declaration.
const TEST_FILES = Object.fromEntries(Array.from({ length: 150 }, (_, i) => {
  const level = i < 120 ? "unit" : i < 140 ? "component" : "release";
  const extra = i === 121 ? ["// runs: 20", "// phrasings: 2"] : [];
  return [`tests/t${String(i).padStart(3, "0")}.test.mjs`, ["// TST-" + (9000 + i) + " · level: " + level + " · module: system", "// guards: A GUARDED RULE", "// given: g", "// input: i", "// expect: e", ...extra,
    "test(\"t\", () => {});", ""].join("\n")];
}));
const COMMIT_FILES = { "SPEC.md": SPEC, ...TEST_FILES };

const front = (commit, who, extra = "") => `---\ncommit: ${commit}\nlevels:\n  - unit\n  - component\noccasion: commit\nparticipant: ${who}\ndate: 2026-10-18T10:00:00Z\n${extra}---\n`;
const outcomes = (...rows) => `## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const failures = (...rows) => `\n## Failures\n\n| Test | Expected | Observed | Log |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const FIRST = `runs/${COMMIT}/20261018-1000-commit-aaaa.md`;
const SECOND = `runs/${COMMIT}/20261018-1100-on-demand-bbbb.md`;
const AT_RELEASE = `runs/${RELEASE}/20261001-1000-release-candidate-dddd.md`;
const AT_THIRD = `runs/${THIRD}/20261015-1000-commit-eeee.md`;
const ANOTHER = (i) => `runs/${String(i).padStart(2, "0").repeat(20)}/20261010-1000-commit-ffff.md`;
const RECORDS = {
  [FIRST]: front(COMMIT, "ci-hosted", `run: ${PRODUCT}/actions/runs/777\n`) + outcomes("| TST-9000 | unit | passed | |", "| TST-9001 | unit | failed | |", "| TST-9120 | component | passed | |",
    "| TST-9121 | component | passed | 17 of 20 |") + failures("| TST-9001 | the list is empty | the list holds one entry | AssertionError at line 4 |"),
  [SECOND]: front(COMMIT, "lab-runner") + outcomes("| TST-9002 | unit | passed | |"),
  [AT_RELEASE]: front(RELEASE, "ci-hosted") + outcomes("| TST-9121 | component | passed | 18 of 20 |"),
  [AT_THIRD]: front(THIRD, "ci-hosted") + outcomes("| TST-9003 | unit | failed | |") + failures("| TST-9003 | x | y | z |"),
  // 37 more commits, so that the branch holds the records of 40.
  ...Object.fromEntries(Array.from({ length: 37 }, (_, i) => [ANOTHER(10 + i), front(String(10 + i).repeat(20), "ci-hosted") + outcomes("| TST-9004 | unit | passed | |")])),
};

// ---------------------------------------------------------------- the counting host

// A snapshot of `files` that counts what it is asked, into `log`. `folders` narrows it as readSnapshot's folders do.
function snapshotOf(label, commit, files, log, { folders = null, extra = {} } = {}) {
  const inside = (path) => folders === null || folders.some((folder) => path === folder || path.startsWith(`${folder}/`));
  const held = Object.fromEntries(Object.entries(files).filter(([path]) => inside(path)));
  const fetched = new Set();
  const refuse = (path) => { if (!inside(path)) throw Object.assign(new Error(`OutsideSnapshot ${path}`), { name: "OutsideSnapshot", path }); };
  const fetch = (paths, request) => { for (const path of paths) fetched.add(path); log.push(request); };
  return {
    commit, paths: Object.keys(held), blob: () => "b".repeat(40),
    read: async (path) => { refuse(path); if (!fetched.has(path) && path in held) fetch([path], { kind: "file", snapshot: label, path }); return held[path] ?? null; },
    readMany: async (paths) => {
      for (const path of paths) refuse(path);
      const wanted = [...new Set(paths)].filter((path) => path in held && !fetched.has(path));
      for (let at = 0; at < wanted.length; at += BATCH) fetch(wanted.slice(at, at + BATCH), { kind: "batch", snapshot: label, paths: wanted.slice(at, at + BATCH) });
    },
    ...extra,
  };
}

function productHost(log) {
  const entry = (commit, message, date) => ({ commit, parents: [], author: { account: null, name: "x" }, date, message, changes: [] });
  const known = { [COMMIT]: entry(COMMIT, "Fix the list", "2026-10-17T09:00:00Z"), [RELEASE]: entry(RELEASE, "Release one", "2026-10-01T09:00:00Z") };
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }),
    readHistory: async (path, options) => [known[options.ref]],
    listPullRequests: async () => [],
    listTags: async () => [{ name: "v1.0.0", commit: RELEASE }, { name: "v1.1.0-rc.1", commit: "f".repeat(40) }],
    readSnapshot: async (ref, options = {}) => {
      if (ref === "test-results") {
        log.push({ kind: options.folders ? "folders" : "tree", snapshot: "test-results", folders: options.folders ? [...options.folders].sort() : null });
        return snapshotOf("test-results", "r".repeat(40), RECORDS, log, { folders: options.folders ?? null });
      }
      log.push({ kind: "tree", snapshot: ref });
      // The graph the workflow "main changed" stored for the commit is read through readOn, as the page reads it (tests/stored-graph-fake.mjs); building it is no read of the page.
      return snapshotOf(ref, ref, COMMIT_FILES, log, { extra: { readOn: storedGraphReadOn({ paths: Object.keys(COMMIT_FILES), read: async (path) => COMMIT_FILES[path] ?? null, commit: ref }) } });
    },
    ciRunLog: async (id) => (id === "777" ? "the full log of run 777" : null),
    webLinks: () => ({ actions: `${PRODUCT}/actions`, run: (id) => `${PRODUCT}/actions/runs/${id}`, secrets: `${PRODUCT}/settings/secrets/actions`,
      commitRuns: (commit) => `${PRODUCT}/commit/${commit}/checks`, branch: (name) => `${PRODUCT}/tree/${name}` }),
  };
}

async function load() {
  const log = [];
  const context = { page: "main", instance: { repository: "alice/agent-m", host: productHost([]) }, store: null, go: () => {},
    product: { address: PRODUCT, kind: "github", host: productHost(log), tokenStored: true } };
  const target = document.createElement("div");
  document.body.append(target);
  await route().render(target, context, { commit: COMMIT });
  return { page: target, log };
}

const named = (log, snapshot) => log.filter((each) => each.snapshot === snapshot);
const sorted = (list) => [...list].sort();

// ================================================================== the tests

// TST-1279001 · level: component · module: MOD-test-pages
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a branch test-results that holds the records of 40 commits — two of the commit shown, one of the last release v1.0.0's commit, one of a third commit — and a host that counts its requests
// input: the route runs rendered for the commit, with a token
// expect: the branch is read once, narrowed to the folders runs/<commit> and runs/<release commit> — no recursive tree of it —, and the snapshot holds the three records of those two commits and none of the third commit's; the three records are read in one batch of their own, none by itself, and the third commit's record is read by no request; the rate of TST-9121 reads "17 of 20 runs" beside the last release's "18 of 20" and "worse than the last release", which only the release's record gives; counter-proof: a read of the whole branch on the same host lists the third commit's record
test("runs/<commit> reads the branch test-results narrowed to the folders of the commit and of the last release, and their records in one batch", async () => {
  const { page, log } = await load();
  const results = named(log, "test-results");
  assert.deepEqual(results.filter((each) => each.kind === "tree"), [], "no recursive tree of the branch test-results");
  assert.deepEqual(results.filter((each) => each.kind === "folders").map((each) => each.folders), [sorted([`runs/${COMMIT}`, `runs/${RELEASE}`])], "one request, for the two folders");
  assert.deepEqual(results.filter((each) => each.kind === "batch").map((each) => sorted(each.paths)), [sorted([FIRST, SECOND, AT_RELEASE])], "the three records in one batch");
  assert.deepEqual(results.filter((each) => each.kind === "file"), [], "no record by itself");
  assert.equal(results.some((each) => [each.path, ...(each.paths ?? [])].includes(AT_THIRD)), false, "the third commit's record is read by no request");
  const rate = textOf(testOf(page, "TST-9121"));
  assert.ok(rate.includes("17 of 20 runs") && rate.includes("18 of 20") && /worse than the last release/.test(rate), rate);
  // The counter-proof: the host's whole-branch read does hold the third commit's record, so that its absence above is the page's.
  const whole = await productHost([]).readSnapshot("test-results");
  assert.ok(whole.paths.includes(AT_THIRD), "the fake branch holds the third commit's record");
  assert.equal(whole.paths.length, 41, "the branch holds the records of 40 commits: two of the commit shown, one each of the release and the third commit, one each of 37 others");
  const narrowed = await productHost([]).readSnapshot("test-results", { folders: [`runs/${COMMIT}`, `runs/${RELEASE}`] });
  assert.deepEqual(sorted(narrowed.paths), sorted([FIRST, SECOND, AT_RELEASE]));
});

// TST-1279002 · level: component · module: MOD-test-pages
// guards: UC-028; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the commit shown holds 150 test files, TST-9000 to TST-9149, and the host counts its requests
// input: the route runs rendered for the commit, with a token
// expect: the page shows what tests/test-pages-runs.test.mjs expects of a commit — the line of unit "2 passed, 1 failed, 0 flaky, 117 not run", that of component "2 passed, 0 failed, 0 flaky, 18 not run", that of release "not run on this commit", and TST-9001 with its expected and observed result and the log "the full log of run 777" —, one row for each of the 150 tests; the commit's tree is read once, whole; the 150 test files are read in two batches, of 100 and 50 files, and none by itself
test("runs/<commit> reads the 150 test files of the commit in two batches and none by itself", async () => {
  const { page, log } = await load();
  assert.match(textOf(byClass(levelOf(page, "unit"), "summary")[0]), /^2 passed, 1 failed, 0 flaky, 117 not run$/);
  assert.match(textOf(byClass(levelOf(page, "component"), "summary")[0]), /^2 passed, 0 failed, 0 flaky, 18 not run$/);
  assert.match(textOf(byClass(levelOf(page, "release"), "summary")[0]), /not run on this commit/);
  const failed = testOf(page, "TST-9001");
  assert.equal(byClass(failed, "expected")[0].textContent, "the list is empty");
  assert.equal(byClass(failed, "observed")[0].textContent, "the list holds one entry");
  assert.equal(byClass(failed, "log")[0].textContent, "the full log of run 777");
  assert.equal(descendants(page, (node) => Boolean(node.getAttribute?.("data-test"))).length, 150, "a row for every test");
  const shown = named(log, COMMIT);
  assert.equal(shown.filter((each) => each.kind === "tree").length, 1, "the commit's tree once");
  assert.deepEqual(shown.filter((each) => each.kind === "batch").map((each) => each.paths.length), [100, 50]);
  assert.deepEqual(sorted(shown.filter((each) => each.kind === "batch").flatMap((each) => each.paths)), sorted(Object.keys(TEST_FILES)), "the batches name the 150 test files");
  assert.deepEqual(shown.filter((each) => each.kind === "file"), [], "no test file by itself");
});
