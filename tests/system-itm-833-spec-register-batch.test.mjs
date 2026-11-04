// The register of the sources on the dashboard's #spec (ITM-833): the specification view looks the person's own source up in docs/sources.md and in the
// entries of docs/sources/, and with a token these files are fetched together in one batch, not one request each.
//
// Module: MOD-trace-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: system
//
// The page is the real #spec of the dashboard on the harness's repository server, which counts every request it answers (tests/app-harness.mjs): `commit`,
// `tree`, `repository`, `batch <n>` for GitHub's batch query with n files, `file <path>` for one file, and the tag list as an `other` request. The
// repository is a small one of the test's own: the SPEC and a register of two entries, which the product links. A page without a token reads each file of a
// public repository from GitHub's raw host. Each case states its expected requests in its own text.

import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN, openDashboard, repoServer } from "./app-harness.mjs";

const TICK = "`";
const SPEC = ["# Register fixture", "", "## A section", "", "**A RULE** *(Source)*", "The rule.", `*Check:* ${TICK}tests/rule.test.mjs${TICK}`, ""].join("\n");
const SHA = "0".repeat(64);
const entry = (id, account) => ["---", `id: ${id}`, "title: A person", "kind: person", "authority: normative", "licence: may be republished — fixture", `identifier: ${account}`, "---",
  `# ${id} A person`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| ${TICK}2026-10-11${TICK} | 2026-10-11 | the fixture | this repository | one file, hashed only |`, ""].join("\n");
const LINKS = ["# Sources", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-a | 2026-10-11 | ${SHA} | |`, ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/sources.md": LINKS,
  "docs/sources/SRC-a.md": entry("SRC-a", "github.com/akmaier"),
  "docs/sources/SRC-b.md": entry("SRC-b", "github.com/other"),
};
const REGISTER = ["docs/sources.md", "docs/sources/SRC-a.md", "docs/sources/SRC-b.md"];
const files = (requests) => requests.filter((request) => request.startsWith("file ")).map((request) => request.slice(5)).sort();

// CASE ITM-833-SYSTEM-01
// TST-833201 · level: system · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the dashboard with a stored token on the repository of the constants above
// input: the real #spec drawn
// expect: 7 requests in all — the commit, the tree, one batch of SPEC.md, docs/sources.md and the two entries, the repository's information with greenToMerge's GraphQL request beside it (ITM-1170; a batch of no file), the tag list and, for the mark source changed (ITM-657), one page of the history of docs/sources.md: the whole cost of the mark where no source moved —, no file by itself, and no file twice; known positive: the page draws the specification
test("with a token #spec reads the SPEC, the links file and the register entries in one batch", async () => {
  const server = await repoServer({ files: FILES });
  const page = await openDashboard({ server, hash: "#spec", token: TOKEN });
  assert.match(page.main(), /Current requirements/, "known positive: the specification is drawn");
  assert.deepEqual(files(page.requests), []);
  // ITM-1170: the empty batch is the GraphQL request of greenToMerge beside the repository's information.
  assert.deepEqual(server.batches.map((paths) => [...paths].sort()), [["SPEC.md", ...REGISTER].sort(), []]);
  assert.equal(page.requests.length, 7, page.requests.join(" | "));
  assert.deepEqual(page.requests.filter((request) => request.startsWith("history ")), ["history docs/sources.md"], "the one request the mark source changed adds");
});

// CASE ITM-833-SYSTEM-02
// TST-833202 · level: system · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same repository, and a stored token that is not sent
// input: the real #spec drawn without a token
// expect: GitHub's batch query needs the token: no batch is sent; SPEC.md and the three files of the register are read by their own requests, once each, 9 requests in all (the commit, the tree, the four files, the repository's information, the tag list and the one page of the history of docs/sources.md that the mark source changed (ITM-657) adds)
test("without a token #spec reads the links file and each register entry by itself", async () => {
  const server = await repoServer({ files: FILES });
  const page = await openDashboard({ server, hash: "#spec", token: null });
  assert.match(page.main(), /Current requirements/, "known positive: the specification is drawn");
  assert.deepEqual(server.batches, []);
  assert.deepEqual(files(page.requests), ["SPEC.md", ...REGISTER]);
  assert.equal(page.requests.length, 9, page.requests.join(" | "));
  assert.deepEqual(page.requests.filter((request) => request.startsWith("history ")), ["history docs/sources.md"], "the one request the mark source changed adds");
});
