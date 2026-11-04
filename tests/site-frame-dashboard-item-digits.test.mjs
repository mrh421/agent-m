// The live app reads backlog items of four or more digits (ITM-1089) — MOD-site-frame's `src/site-frame/dashboard-app.mjs` reads the files a route shows in batches (docs/architecture/MOD-site-frame.md:93, :132); for the
// route #backlog those include the product's backlog items, whose identifier is `ITM-<nnn>`, three or more digits (MOD-identifiers.md:54).
// Run: node --test tests/site-frame-dashboard-item-digits.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY ARTIFACT HAS AN IDENTIFIER; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The real app (src/site-frame/dashboard-app.mjs) runs in tests/app-harness.mjs against a GitHub API mock that serves GitHub's batch request and records the files of each batch (as tests/load-per-view.test.mjs does).
// Readings the texts leave open, which the tests state: the reader does not order the items it reads (it hands the paths to one batch), so no order is asserted; the page drawn from the files is the views' (src/implementation-pages/backlog.mjs,
// ITM-1087), not this item's, so only the files read are asserted.
// The counter-proofs are recorded in the pull request.

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
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);

const item = (id) => ["---", `id: ${id}`, `title: The work of ${id}`, "level: module", "realises:", "  - RULE ONE", "modules:", "  - MOD-reader", "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ${id} The work of ${id}`, "", "## Outcome", "", "What it delivers.", "", "## Acceptance", "", "- a unit test.", ""].join("\n");
const SPRINT = "---\nsprint: 1\ngoal: Read\nstart: 2026-09-14\nend:\ncloser: alice\nbranch:\nselection:\n  - ITM-100\n---\n# team1 Sprint 01\n";
const ITEMS = { "docs/backlog/ITM-99-too-short.md": "ITM-99", "docs/backlog/ITM-100-three.md": "ITM-100", "docs/backlog/ITM-999-last-three.md": "ITM-999",
  "docs/backlog/ITM-1000-four.md": "ITM-1000", "docs/backlog/ITM-10000-five.md": "ITM-10000" };

// TST-1089001 · level: unit · module: MOD-site-frame
// guards: EVERY ARTIFACT HAS AN IDENTIFIER; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product whose backlog holds ITM-99, ITM-100, ITM-999, ITM-1000 and ITM-10000, with a sprint and a role assignment
// input: #backlog opened with a token
// expect: the files read in batches include the items ITM-100, ITM-999, ITM-1000 and ITM-10000 (the three-digit ones are still read: the known positive) and not ITM-99-too-short.md; the sprint is read too
test("#backlog reads the backlog items of three, four and five digits and not one of two", async () => {
  const repo = { ...base, "docs/backlog/sprints/team1/01.md": SPRINT,
    "docs/role-assignments/team1.md": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Owner | alice |\n| Builders | dev-a |\n| Checker | dev-a |\n",
    ...Object.fromEntries(Object.entries(ITEMS).map(([path, id]) => [path, item(id)])) };
  const srv = await repoServer({ files: repo, history: [], handlers: [(url) => (url.origin === "https://api.github.com" && url.pathname.endsWith("/pulls")
    ? new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }) : undefined)] });
  await openDashboard({ server: srv, hash: "#backlog" });
  const read = new Set(srv.batches.flat());
  for (const path of ["docs/backlog/ITM-100-three.md", "docs/backlog/ITM-999-last-three.md", "docs/backlog/ITM-1000-four.md", "docs/backlog/ITM-10000-five.md"]) assert.ok(read.has(path), `${path} is read`);
  assert.ok(read.has("docs/backlog/sprints/team1/01.md"), "known positive: the sprint is read");
  assert.equal(read.has("docs/backlog/ITM-99-too-short.md"), false);
});
