// Release test of ITM-716 — a review page draws from the snapshot the frame read and asks the repository's information only where it needs it. Written from the SPEC's A PAGE LOAD READS THE REPOSITORY IN BATCHES ("one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100 files each") and from ITM-716's Outcome (with a token, #uc, #arc and #review/uc made one request more per load than the frame alone: the repository's information, `GET /repos/<repo>`).
// Run: node --test tests/release-itm-716-page-load-batches.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: release
//
// Written for the release testing of sprint team1/135 by a participant who implemented none of ITM-716 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the pages as tests/load-per-view.test.mjs does: the real app (tests/app-harness.mjs' openDashboard) against a counting fake of GitHub, with a token, over the product of tests/fixtures/architecture. A request for the repository's information is counted as `repository`.
// Readings the texts leave open, which the case states: MOD-trace-pages' modules view (#arc) and MOD-approvals' lastAcceptedText (a changed file) read the repository's information for their own use and are not this item's modules (ITM-716's Acceptance): they serve as the known positives that the count can see such a request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard } from "./app-harness.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const count = (requests, what) => requests.filter((request) => request === what).length;
const useCase = (n, title) => `---\nid: UC-${n}\ntitle: ${title}\narea: 1\nactors:\n  - Reader\nrealises: []\n---\n# UC-${n} ${title}\n`;

// TST-716101 · level: release · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product with a token, its two use cases open for acceptance; known positives: #arc, whose modules view reads the repository's information once,
// input: open #uc, go on to #review/uc and press Accept all (known positive: it writes); in a load of its own open #arc
// expect: #uc sends its commit once, no git tree and no file by itself; neither #uc nor #review/uc sends a request for the repository's information, and both show Accept (whether the person may write is shown); pressing Accept all writes one commit; #arc, in its own load, sends one
// Planted fault: a route asking its own default branch (`const { defaultBranch } = await host.repositoryInfo();` reached because `take` of handedPlace in src/review-pages/common.mjs gives nothing: `const given = null && handed ? …`) fails the case on "#uc asks no repository information".
test("TST-716101 #uc and #review/uc read no repository information of their own, and still offer Accept", async () => {
  const srv = await repoServer({ files: { ...base, "docs/use-cases/UC-003-third.md": useCase("003", "Third") } });
  const page = await openDashboard({ server: srv });
  assert.match(page.main(), /Accept/, "Accept is offered where the person may write");
  assert.equal(count(page.requests, "commit"), 1, "the commit once");
  assert.equal(count(page.requests, "tree"), 0, "no git tree");
  assert.deepEqual(page.requests.filter((request) => request.startsWith("file ")), [], "no file by itself");
  assert.equal(count(page.requests, "repository"), 0, "failure node: #uc asks no repository information");
  const review = await page.go("#review/uc");
  assert.match(page.main(), /Accept all/, "known positive: the review page offers Accept all");
  assert.equal(count(review, "repository"), 0, "failure node: #review/uc asks no repository information");
  await page.click(".accept-all");
  assert.equal(srv.writes.length, 1, "one commit written: the write still works");
  const arc = await openDashboard({ server: await repoServer({ files: base }), hash: "#arc" });
  assert.equal(count(arc.requests, "repository"), 1, "known positive: the modules view of #arc reads it once, so the count sees such a request");
});
