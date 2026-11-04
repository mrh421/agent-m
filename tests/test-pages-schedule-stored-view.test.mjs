// MOD-test-pages' route `schedule` shows the counts of the tests stored for its commit (ITM-1265), as the accepted text of docs/architecture/MOD-test-pages.md states it: "each row
// with the number of the product's tests it holds — the declarations of its level, and for the row of paid services those that call one —, taken from the counts stored for the
// commit shown (MOD-progress-measures' `storedView` with the page `schedule`, with its as-of line while the head's are not stored yet), or counted from the test files where the
// repository stores none"; and MOD-progress-measures' `storedView`: "while that is not stored yet, the view of the commit `latest.json` names … what a page shows, with the line
// `As of <asOf, 7 characters>: the view of the newest commit is being stored.`".
// Run: node --test tests/test-pages-schedule-stored-view.test.mjs
//
// Module: MOD-test-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// Level: component
//
// The product is served by tests/app-harness.mjs' repoServer, a fake of GitHub's API that counts every request, through the real MOD-repository-hosts host connected with a token;
// the product is the instance itself, at the commit ccc…c, so that the instance's participants are read from it too. Its test files are those of TST-758006 in
// tests/test-pages-schedule.test.mjs — three unit tests (one calling the paid service oracle), one component test, two system tests (one calling oracle) and one release test —, whose
// counts are 3, 1, 2, 2, 1 and 0. `overview` holds the files of the branch overview-cache by path, served through the contents API (`?ref=overview-cache`) and counted as
// `handler GET …`; a file it does not hold is answered 404, as is every file where the repository has no such branch. The views on it are written by hand, gzipped JSON of
// ScheduleView's shape. Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - The count shown is the cell <td class="tests"> of the row; the as-of line is the page's text.
//   - "No batch of test files" is: no batch request names a path under tests/, and no file under tests/ is read by itself.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "schedule");

const ADDRESS = `https://github.com/${REPO}`;
const COMMIT = "c".repeat(40);
const C0 = "0c".repeat(20);
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const EXPECTED = { unit: 3, component: 1, system: 2, paid: 2, release: 1, user: 0 };

// A test file's text: one declaration for each entry [level, paid]; the lines are built by join, so that no line of this file is a declaration.
const declarations = (entries, from) => entries.map(([level, paid], at) => ["// TST-" + String(from + at).padStart(3, "0") + " · level: " + level + " · module: MOD-sample",
  "// guards: A SAMPLE REQUIREMENT", "// given: g", "// input: i", "// expect: e", ...(paid ? ["// paid: " + paid] : []), "test(\"t\", () => {});", ""].join("\n")).join("\n");
const REGISTER = "# Participants of this instance\n\n**REGISTER**\n\nThe participants.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
const FILES = {
  "docs/participants.md": REGISTER,
  "tests/a.test.mjs": declarations([["unit"], ["unit", "oracle"], ["unit"], ["component"]], 1),
  "tests/b.test.mjs": declarations([["system", "oracle"], ["system"], ["release"]], 10),
};
const stored = (commit, counts) => new Uint8Array(gzipSync(JSON.stringify({ commit, counts })));

// The route schedule drawn over the fake, with the branch overview-cache holding `overview` (null: no such branch) -> { target, srv }.
async function show(overview) {
  const cache = (url) => {
    if (url.origin !== "https://api.github.com" || url.searchParams.get("ref") !== "overview-cache") return undefined;
    const path = decodeURIComponent(url.pathname.slice(`/repos/${REPO}/contents/`.length));
    return overview !== null && Object.hasOwn(overview, path) ? new Response(overview[path], { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
  };
  const srv = await repoServer({ files: FILES, handlers: [cache], head: COMMIT });
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
const testFileReads = (srv) => [...srv.batches.flat().filter((path) => path.startsWith("tests/")), ...srv.requests.filter((request) => request.startsWith("file tests/"))];

// TST-1265004 · level: component · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: overview-cache holding the schedule's view of the head ccc…c with the counts 3, 1, 2, 2, 1 and 0
// input: the route schedule's render
// expect: the rows unit, component, system, paid, release and user show 3, 1, 2, 2, 1 and 0; one read of overview-cache; no test file is read — in a batch or by itself —; no line "As of"
test("schedule — the counts are the view stored for the head, with one read of overview-cache and no batch of test files", async () => {
  const { target, srv } = await show({ [`${COMMIT}.schedule.json.gz`]: stored(COMMIT, EXPECTED) });
  assert.deepEqual(countsOf(target), EXPECTED);
  assert.equal(cacheReads(srv).length, 1, srv.requests.join("\n"));
  assert.deepEqual(testFileReads(srv), [], "no test file is read");
  assert.doesNotMatch(target.textContent, /As of/);
});

// TST-1265005 · level: component · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: overview-cache holding no view of the head, latest.json naming 0c0c…0c, and the schedule's view of 0c0c…0c with the counts 7, 6, 5, 4, 3 and 2
// input: the route schedule's render
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; the rows unit, component, system, paid, release and user show 7, 6, 5, 4, 3 and 2; three reads of overview-cache; no test file is read
test("schedule — while the head's counts are not stored, the counts stored last are shown with the as-of line", async () => {
  const older = { unit: 7, component: 6, system: 5, paid: 4, release: 3, user: 2 };
  const { target, srv } = await show({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.schedule.json.gz`]: stored(C0, older) });
  assert.match(target.textContent, /As of 0c0c0c0: the view of the newest commit is being stored\./);
  assert.deepEqual(countsOf(target), older);
  assert.equal(cacheReads(srv).length, 3, srv.requests.join("\n"));
  assert.deepEqual(testFileReads(srv), [], "no test file is read");
});

// TST-1265006 · level: component · module: MOD-test-pages
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: a repository without the branch overview-cache
// input: the route schedule's render
// expect: the rows show the counts of the test files, 3, 1, 2, 2, 1 and 0; both test files are read; both test files are read in a batch, and none by itself; no line "As of"
test("schedule — where the repository stores no view, the counts are taken from the test files", async () => {
  const { target, srv } = await show(null);
  assert.deepEqual(countsOf(target), EXPECTED);
  assert.deepEqual([...new Set(testFileReads(srv))].sort(), ["tests/a.test.mjs", "tests/b.test.mjs"], "known positive: the test files are read");
  assert.deepEqual([...new Set(srv.batches.flat().filter((path) => path.startsWith("tests/")))].sort(), ["tests/a.test.mjs", "tests/b.test.mjs"], "both test files are read in a batch");
  assert.deepEqual(srv.requests.filter((request) => request.startsWith("file tests/")), [], "no test file is read by itself");
  assert.doesNotMatch(target.textContent, /As of/);
});
