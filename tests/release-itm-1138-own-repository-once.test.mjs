// Release test of ITM-1138 — the pages of roles, process, releases and settings read the repository they show once per load. Written from the SPEC's A PAGE LOAD READS THE REPOSITORY IN BATCHES ("With a token on GitHub, one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100 files each; a file whose blob the page has read already is not read again") and from ITM-1138's Outcome (with a token, #roles, #process, #release and #settings read the same commit and tree three or four times).
// Run: node --test tests/release-itm-1138-own-repository-once.test.mjs
//
// Module: MOD-site-frame
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: release
//
// Reading the texts leave open, which the case states: #roles and #process read SPEC.md as one request for that one file (not as a batch of one); the requirement names batches for the files a page shows and a second read of a file as the fault, so the case asserts the latter and not that no file is read by itself.
// Written for the release testing of sprint team1/136 by a participant who implemented none of ITM-1138 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the pages as tests/load-per-view.test.mjs does: the real app (tests/app-harness.mjs' openDashboard) against a counting fake of GitHub, with a token, over the product of tests/fixtures/architecture, as the instance and as another repository on a server of its own.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard, setting } from "./app-harness.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const ROUTES = ["#roles", "#process", "#release", "#settings"];
const OTHER = "alice/product";
const count = (requests, what) => requests.filter((request) => request === what).length;

// What one load of `hash` sent to the repository it shows: for the instance, to the instance's server; for another product, to that product's server.
async function load(hash, ofProduct) {
  if (!ofProduct) {
    const instance = await repoServer({ files: { ...base } });
    const page = await openDashboard({ server: instance, hash });
    return { page, requests: instance.requests };
  }
  const instance = await repoServer({ files: { ...base } });
  const shown = await repoServer({ files: { ...base }, repo: OTHER, head: "b0ffee".padEnd(40, "0") });
  const isShown = (url, init) => (url.pathname === "/graphql"
    ? `${JSON.parse(init.body).variables?.owner}/${JSON.parse(init.body).variables?.name}` === OTHER
    : url.pathname.includes(`/${OTHER}/`) || url.pathname.endsWith(`/${OTHER}`));
  const both = {
    get requests() { return instance.requests; },
    get pending() { return instance.pending + shown.pending; },
    fetch: (u, init = {}) => (isShown(new URL(String(u)), init) ? shown : instance).fetch(u, init),
  };
  const page = await openDashboard({ server: both, hash, search: `?repo=${OTHER}`, entries: setting("products", [`https://github.com/${OTHER}`]) });
  for (let idle = 0; idle < 40; idle += 1) await new Promise((r) => setTimeout(r, 0));
  return { page, requests: shown.requests };
}

// TST-1138101 · level: release · module: system
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product with a token, as the instance itself, and as another repository (alice/product) on a server of its own
// input: open #roles, #process, #release and #settings, each in a load of its own, for the instance and with ?repo=alice/product
// expect: each load sends the shown repository's commit once and its tree once; no file or blob read twice; every batch of files holds at most 100 files; the page is drawn (known positive: the load is not empty and sends some request)
// Planted fault: the frame's wrapped host no longer hands the snapshot the load read back (src/site-frame/dashboard-app.mjs pagesHost, `if (false && ref === T.ref && …)`) fails the case on "#roles of the instance: the commit once".
test("TST-1138101 #roles, #process, #release and #settings read the repository they show: its commit and tree once, files in batches", async () => {
  for (const ofProduct of [false, true]) {
    for (const hash of ROUTES) {
      const where = `${hash} of ${ofProduct ? "another product" : "the instance"}`;
      const { page, requests } = await load(hash, ofProduct);
      assert.ok(requests.length > 0 && page.main().length > 0, `${where}: known positive: the page is drawn and the server was asked`);
      assert.equal(count(requests, "commit"), 1, `${where}: the commit once`);
      assert.equal(count(requests, "tree"), 1, `${where}: the tree once`);
      const texts = requests.filter((r) => /^(file|blob) /.test(r));
      assert.equal(new Set(texts).size, texts.length, `${where}: no file and no blob read twice`);
      for (const r of requests.filter((x) => /^batch \d+$/.test(x))) assert.ok(Number(r.slice(6)) <= 100, `${where}: ${r} holds at most 100 files`);
    }
  }
});
