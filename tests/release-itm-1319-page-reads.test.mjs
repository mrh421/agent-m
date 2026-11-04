// Release test of ITM-1319's page loads — a page of use cases in a product whose model pulls its work now names, beside Accept, the participant that checks the modules, and must still read the repository as
// the SPEC's A PAGE LOAD READS THE REPOSITORY IN BATCHES asks: "one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100
// files each". The real dashboard app (tests/app-harness.mjs) runs over a GitHub API mock that counts every request, on the fixture product of tests/fixtures/architecture, once as it is and once declaring a
// pulled model in docs/process.md. The expected counts are written here from the requirement; no case reads a code file.
// Run: node --test tests/release-itm-1319-page-reads.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS
// Level: release
//
// Written for the release testing of sprint 128 by developer-sonnet-l, who implemented none of ITM-1319 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the case states:
//   - the load of a page is the requests from the opening of its address to the moment the app has nothing in flight, and "its commit once" is one request named `commit`;
//   - a page of the product as it is (no docs/process.md) is the base line: the requests of a pulled product are those of the same page without the declaration, the commit once among them;
//   - the model's file and the participant list are the instance's own files, which this product is, read within the page's folders.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard } from "./app-harness.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path); else base[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8");
  }
})(FIX);
const HEAD = "c0ffee".padEnd(40, "0");
// The product declaring a model that pulls its work, with the model's file and a register whose participant checker-a drafts text from this tab.
const PULLED = {
  "docs/process.md": ["---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${HEAD}`, "---", "# How the fixture product is developed", ""].join("\n"),
  "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
  "docs/participants.md": [...readFileSync(new URL("../docs/participants.md", import.meta.url), "utf8").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))),
    "| checker-a | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |", ""].join("\n"),
};
const count = (requests, what) => requests.filter((request) => request === what).length;
const perLoad = (requests) => Object.fromEntries(["commit", "tree", "folders", "repository"].map((what) => [what, count(requests, what)]));
const filesByThemselves = (requests) => requests.filter((request) => request.startsWith("file "));

// TST-1319204 · level: release · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS
// given: the fixture product with a token, once as it is and once declaring a pulled model (fixture-scrum-wip at the commit the page reads) with the model's file and a register with checker-a
// input: open #use-case, #use-case/id=UC-002 and #use-case/id=all, each in a load of its own, for both products
// expect: known positive — #use-case of the product as it is reads its commit once, the request for its folders once and one batch of 2 files, and no git tree; in the pulled product each page names checker-a beside Accept, reads its commit once and no tree, and sends as many commit, tree and folders requests as the same page of the product as it is, and one repository request where the product as it is sends none; docs/process.md and SPEC.md are read in batches, none by itself
test("TST-1319204: a page of use cases in a pulled product reads its commit once, as it does without the declaration, and names the checking participant", async () => {
  const plainList = await openDashboard({ server: await repoServer({ files: base }), hash: "#use-case" });
  assert.deepEqual(plainList.requests.filter((request) => ["commit", "folders", "tree"].includes(request) || request.startsWith("batch ")), ["commit", "folders", "batch 2"], "known positive: the base's requests");
  for (const hash of ["#use-case", "#use-case/id=UC-002", "#use-case/id=all"]) {
    const plain = await openDashboard({ server: await repoServer({ files: base }), hash });
    const pulled = await openDashboard({ server: await repoServer({ files: { ...base, ...PULLED } }), hash });
    assert.match(pulled.main(), /class="participant">checker-a</, `${hash}: checker-a is named beside Accept`);
    assert.doesNotMatch(plain.main(), /class="participant"/, `${hash}: the product as it is names none`);
    assert.equal(perLoad(plain.requests).repository, 0, `${hash}: the product as it is asks no repository information`);
    assert.deepEqual(perLoad(pulled.requests), { ...perLoad(plain.requests), repository: 1 }, `${hash}: commit, tree and folders as often as without the declaration, and the repository information once for the pulled product`);
    assert.equal(perLoad(pulled.requests).commit, 1, `${hash}: the commit once`);
    assert.equal(perLoad(pulled.requests).tree, 0, `${hash}: no tree beside the folders`);
    assert.deepEqual(filesByThemselves(pulled.requests).filter((request) => /docs\/process\.md|SPEC\.md/.test(request)), [], `${hash}: docs/process.md and SPEC.md are read in batches`);
  }
});
