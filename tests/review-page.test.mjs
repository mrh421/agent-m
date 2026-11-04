// The review page — every open file of one area on one page, and one click that accepts everything it showed. Deterministic, no
// network: the real app (src/site-frame/dashboard-app.mjs) in tests/app-harness.mjs against a GitHub API mock that counts every
// request and takes commits, on the fixture product of tests/fixtures/architecture. The page is MOD-review-pages' route `<k>/id=all`,
// which the app's address #review/uc and #review/arc lead to. Run: node --test tests/*.test.mjs
//
// Module: MOD-site-frame
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-008; UC-022; UC-023
// Level: component
//
// SPEC §10 SEVERAL FILES ARE ACCEPTED IN ONE CLICK · AN APPROVAL NAMES THE EXACT TEXT · A CHANGED FILE IS SHOWN AGAINST ITS LAST
// ACCEPTED TEXT · THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK · EVERY STEP EXPLAINS ITSELF; §11 ARCHITECTURE RESTS ON ACCEPTED
// ARTIFACTS · AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST (UC-008 3e, UC-022 step 10, UC-023 step 5).
// Where the page differs from the one of the removed view, the expected result is MOD-review-pages' text (its Interfaces, `<k>/all`):
// "Accept all N shown" counts the files shown, and a file that names what is not accepted is shown, left out of the commit and named.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blobSha } from "../src/text-tools/index.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";
import { artifactSchemaOf, readDocument } from "../src/documents/index.mjs";
import { repoServer, fakeCaches, openDashboard, REPO } from "./app-harness.mjs";

const record = (path, blob) => recordText(reviewedRecord(path, blob));
// The identifier of a reviewed file, as MOD-documents reads it from the file's path.
const reviewedId = (path) => readDocument(artifactSchemaOf(path), path, "").id;

// ---------------------------------------------------------------- the product: tests/fixtures/architecture, with records

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md";
const REVIEW = "docs/architecture/MOD-review.md", PAGE = "docs/architecture/MOD-page.md";

// The texts accepted earlier, which the server still holds by their blob SHA.
const EARLIER = [];
// UC-001 and ARC-001 accepted; UC-002 and MOD-reader changed since acceptance; MOD-page and MOD-review never accepted.
// MOD-review realises UC-002, which is not accepted in its current text: it cannot be accepted (ARCHITECTURE RESTS ON
// ACCEPTED ARTIFACTS). MOD-page names nothing; MOD-reader names RULE ONE and UC-001, both accepted.
async function product() {
  const f = { ...base, "docs/use-cases/README.md": "# Use cases\n", "docs/approvals/README.md": "# Approval records\n" };
  const rec = async (id, path, text) => {
    const b = await blobSha(text);
    if (text !== f[path]) EARLIER.push(text);
    f[approvalPath(id, b)] = record(path, b);
  };
  await rec("UC-001", UC1, f[UC1]);
  await rec("UC-002", UC2, f[UC2].replace("Show the status", "Show a status"));
  await rec("ARC-001", ARC, f[ARC]);
  await rec("MOD-reader", READER, f[READER].replace("Reads files at", "Reads a file at"));
  return f;
}

// ---------------------------------------------------------------- the app: the page, the click, what it reads

// Each server stands at a commit of its own (tests/app-harness.mjs' head): MOD-trace-graph's storedGraph keeps a commit's graph for the length of this file.
let servers = 0;
const ownHead = () => `c0ffee${String(++servers).padStart(6, "0")}`.padEnd(40, "0");
const server = async (files) => repoServer({ files, history: EARLIER, head: ownHead() });
const files = (requests) => requests.filter((r) => r.startsWith("file ")).map((r) => r.slice(5)).sort();
const writesOf = (requests) => requests.filter((r) => /^write /.test(r) || r === "ref" || r === "commit object");
const count = (requests, what) => requests.filter((r) => r === what).length;
// The part of the page that shows one file: from the heading that opens with its identifier to the next file or the button.
function section(html, id) {
  const at = html.indexOf(`<section class="review-file"><h3>${id} `);
  if (at < 0) return null;
  const rest = html.slice(at + 1);
  const end = Math.min(...["<section class=\"review-file\">", "<button class=\"btn accept-all\""].map((m) => { const i = rest.indexOf(m); return i < 0 ? Infinity : i; }));
  return html.slice(at, end === Infinity ? html.length : at + 1 + end);
}

// TST-1294001 · level: component · module: MOD-site-frame
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; EVERY STEP EXPLAINS ITSELF
// given: the fixture product, whose MOD-page is new, MOD-reader changed since its acceptance, MOD-review rests on UC-002 which is not accepted, and ARC-001 accepted
// input: open #review/arc with a token
// expect: ARC-001 is not on the page; MOD-page, MOD-reader and MOD-review stand in sequence; MOD-page in full, MOD-reader as the difference to its last accepted text with its impact list, MOD-review naming UC-002 as what it rests on; one button "Accept all 3 shown" and the folded explanations
test("the architecture's review page shows every open or changed file in sequence — new in full, changed as a difference with its impact list, a waiting one named", async () => {
  const repo = await product();
  const page = await openDashboard({ server: await server(repo), hash: "#review/arc" });
  const html = page.main();
  assert.equal(section(html, "ARC-001"), null, "an accepted file is not on the page");
  const order = ["MOD-page", "MOD-reader", "MOD-review"].map((id) => html.indexOf(`<section class="review-file"><h3>${id} `));
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], `in sequence: ${order}`);
  // New: rendered in full.
  assert.match(section(html, "MOD-page"), /Shows what the other modules derive\./);
  // Changed: the difference to the text its last record names, and its impact list.
  const reader = section(html, "MOD-reader");
  assert.match(reader, /<pre class="diff">/);
  assert.match(reader, /<span class="ddel">- title: Reads a file at a pinned commit/);
  assert.match(reader, /<span class="dadd">\+ title: Reads files at a pinned commit/);
  assert.match(reader, /Impact of this change/);
  assert.match(reader, /Affected modules/);
  assert.match(reader, /<strong>MOD-reader<\/strong> — changed/);
  // Waiting: shown, and naming what is open.
  const review = section(html, "MOD-review");
  assert.match(review, /Derives open, accepted or changed from the approval records\./);
  assert.match(review, /Rests on what is not accepted/);
  assert.match(review, /<li class="open-name">UC-002<\/li>/);
  // One button for the files shown, and the folded explanations.
  assert.match(html, /<button class="btn accept-all" type="button">Accept all 3 shown<\/button>/);
  assert.match(html, /<details class="explain"><summary>What is this\?<\/summary>[^]*Accepting is a commit made under your own account/);
  assert.match(reader, /<details class="explain"><summary>What is this\?<\/summary>[^]*Before a change to an accepted decision or module is accepted/);
});

// TST-1294002 · level: component · module: MOD-site-frame
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-reader changed since its acceptance; once with the graph of the commit stored, once on a server that answers 404 for the stored graph
// input: open #arc/MOD-reader with a token on each
// expect: with the stored graph the impact list is shown and Accept is offered; without it the page says the impact list could not be derived, shows no impact list and offers no Accept
test("a change to an architecture file is not offered for acceptance where its impact list cannot be derived", async () => {
  const repo = await product();
  const good = await openDashboard({ server: await server(repo), hash: "#arc/MOD-reader" });
  assert.match(good.main(), /Impact of this change/, "known positive: the list is shown when the graph is stored");
  assert.match(good.main(), /<button class="btn accept" type="button">Accept<\/button>/, "known positive: Accept is offered with it");
  // The page derives the impact list only from the graph the workflow "main changed" stored for the commit (MOD-review-pages: "no page builds a graph"); a
  // server whose branch trace-cache holds no graph, through the contents API or the raw host, leaves it underivable.
  const refused = async (url) => (/\/[0-9a-f]{40}\.json\.gz$/.test(url.pathname) ? new Response('{"message":"Not Found"}', { status: 404 }) : undefined);
  const page = await openDashboard({ server: await repoServer({ files: repo, history: EARLIER, handlers: [refused], head: ownHead() }), hash: "#arc/MOD-reader" });
  assert.match(page.main(), /The impact list could not be derived/);
  assert.doesNotMatch(page.main(), /Impact of this change/);
  assert.doesNotMatch(page.main(), /<button class="btn accept"/, "without the list, no Accept");
});

// TST-1294003 · level: component · module: MOD-site-frame
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: the review page of the architecture with MOD-page and MOD-reader acceptable and MOD-review resting on UC-002, which is not accepted
// input: press Accept all 3 shown
// expect: one commit holding one record for MOD-page and one for MOD-reader, each naming the blob rendered, and none for ARC-001, MOD-review or a use case; the head read again, then ref, commit object, write tree, write commit and write ref; MOD-page and MOD-reader no longer shown, MOD-review shown and named as left out because it rests on UC-002
test("Accept all N shown: one commit with one record per file the page could count, each naming the blob of the text it rendered; the file that waits is left out and named", async () => {
  const repo = await product(), caches = fakeCaches();
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#review/arc", caches });
  const made = await page.click(".accept-all");
  assert.equal(srv.writes.length, 1, "one commit");
  const written = srv.writes[0].files;
  const want = {};
  for (const p of [PAGE, READER]) want[approvalPath(reviewedId(p), await blobSha(repo[p]))] = record(p, await blobSha(repo[p]));
  assert.deepEqual(written, want, "a record for MOD-page and MOD-reader, each naming the blob rendered — none for ARC-001, MOD-review or a use case");
  assert.match(srv.writes[0].message, /MOD-page/);
  // The acceptance path of SEVERAL FILES ARE ACCEPTED IN ONE CLICK: read again at the head, then one commit.
  assert.deepEqual(writesOf(made), ["ref", "commit object", "write tree", "write commit", "write ref"]);
  assert.equal(section(page.main(), "MOD-page")?.includes("Rests on"), undefined, "MOD-page is accepted now");
  assert.equal(section(page.main(), "MOD-page"), null, "accepted now");
  assert.equal(section(page.main(), "MOD-reader"), null, "accepted now");
  assert.ok(section(page.main(), "MOD-review"), "still waiting for UC-002");
  assert.match(page.main(), /Accepted in commit [0-9a-f]{7}\./);
  assert.match(page.main(), /MOD-review was left out: rests on what is not accepted \(UC-002\)/);
});

// TST-1294004 · level: component · module: MOD-site-frame
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// given: the review page of the architecture, and MOD-page edited on the server after the page was built
// input: press Accept all 3 shown
// expect: one commit holding the record of MOD-reader alone; MOD-page is named as left out and shown with its new text
test("counter-proof: a file changed between building the page and the click is left out and named", async () => {
  const repo = await product();
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#review/arc" });
  await srv.change(PAGE, repo[PAGE] + "\nEdited by someone else.\n");
  await page.click(".accept-all");
  assert.equal(srv.writes.length, 1);
  assert.deepEqual(Object.keys(srv.writes[0].files), [approvalPath("MOD-reader", await blobSha(repo[READER]))]);
  assert.match(page.main(), /MOD-page was left out: /);
  // The page shows the new text, to be decided on again.
  assert.match(section(page.main(), "MOD-page"), /Edited by someone else\./);
});

// TST-1294005 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product, whose three module files MOD-page, MOD-reader and MOD-review are not accepted
// input: open #review/arc with a token, and again on a fresh server with the same caches
// expect: the three files shown come in one batch of three and none by itself; the stored graph of the commit read once, no batch of the files a graph reads; the SPEC at most once; no use case and no queue file; the commit and the repository's information once each, the folders once, one batch of the three files, one batch of one (MOD-reader's last accepted text, read by MOD-approvals as one file at the commit that added its record) and the GraphQL request of greenToMerge beside the repository's information, a batch of no file (ITM-1170), and no git/trees; the second load sends the same requests and shows the same page
test("request count: the architecture's review page reads the files it shows in one batch, its commit and its folders once, the repository's information once, and the stored graph of its impact list once", async (t) => {
  const repo = await product(), caches = fakeCaches();
  const srv = await server(repo);
  const cold = await openDashboard({ server: srv, hash: "#review/arc", caches });
  assert.deepEqual(files(cold.requests).filter((p) => p.startsWith("docs/architecture/")), [],
    "no file shown is read by itself");
  // ITM-1170: the third batch, of no file, is the GraphQL request of greenToMerge beside the repository's information.
  assert.equal(srv.batches.length, 3, "the files shown, MOD-reader's last accepted text, and greenToMerge's");
  assert.equal(srv.batches.filter((batch) => batch.length === 0).length, 1, "greenToMerge's names no file");
  assert.deepEqual([...srv.batches[0]].sort(), ["docs/architecture/MOD-page.md", "docs/architecture/MOD-reader.md", "docs/architecture/MOD-review.md"],
    "the three files shown, in one batch");
  assert.equal(cold.requests.filter((r) => r.startsWith("stored graph ")).length, 1, "the stored graph of the commit, once");
  assert.ok(count(cold.requests, "file SPEC.md") <= 1, "the SPEC is not read again");
  assert.deepEqual(files(cold.requests).filter((p) => p.startsWith("docs/use-cases/") || p.startsWith("docs/spec-freigaben/")), [],
    "no use case and no queue file");
  assert.equal(count(cold.requests, "commit"), 1);
  assert.equal(count(cold.requests, "folders"), 1, "the folders it reads");
  assert.equal(count(cold.requests, "tree"), 0);
  assert.equal(count(cold.requests, "repository"), 1);
  assert.deepEqual(cold.requests.filter((r) => r.startsWith("batch ")), ["batch 3", "batch 0", "batch 1"], "the files shown in one batch, greenToMerge's of no file (ITM-1170), MOD-reader's last accepted text in one of one, and no batch of a graph's files");
  const warm = await openDashboard({ server: await server(repo), hash: "#review/arc", caches });
  // Each server's head is a commit of its own (the stored graph is kept per commit for a page), so the two loads' requests are compared with the commit named alike.
  const anyCommit = (requests) => requests.map((request) => request.replace(/[0-9a-f]{40}/g, "<commit>"));
  assert.deepEqual(anyCommit(warm.requests), anyCommit(cold.requests), "a new dashboard load has a fresh in-memory text cache");
  assert.equal(warm.main(), cold.main(), "the same page");
  t.diagnostic(`architecture review page: ${cold.requests.length} requests (${cold.requests.join(", ")})`);
});

// TST-1294006 · level: component · module: MOD-site-frame
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: the fixture product, whose UC-001 is accepted and UC-002 changed since its acceptance
// input: open #review/uc with a token, then press Accept all 1 shown
// expect: UC-001 is not on the page and UC-002 is shown as the difference to its last accepted text; no file outside the use cases and their records is read; the click writes one commit holding UC-002's record
test("the use cases' review page: a changed use case as its difference, no accepted one, no architecture file read; Accept all writes its record", async (t) => {
  const repo = await product();
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#review/uc" });
  const html = page.main();
  assert.equal(section(html, "UC-001"), null, "accepted");
  assert.match(section(html, "UC-002"), /<span class="ddel">- title: Show a status/);
  assert.match(section(html, "UC-002"), /<span class="dadd">\+ title: Show the status/);
  assert.match(html, /Accept all 1 shown</);
  assert.deepEqual(files(page.requests).filter((p) => !p.startsWith("docs/use-cases/") && !p.startsWith("docs/approvals/")), [],
    "nothing outside the use cases and their records");
  t.diagnostic(`use-case review page: ${page.requests.length} requests (${page.requests.join(", ")})`);
  await page.click(".accept-all");
  const b = await blobSha(repo[UC2]);
  assert.deepEqual(srv.writes.map((w) => w.files), [{ [approvalPath("UC-002", b)]: record(UC2, b) }]);
});

// TST-1294007 · level: component · module: MOD-site-frame
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the review page of the architecture, opened without a token
// input: open #review/arc without a token
// expect: MOD-page and MOD-reader are shown, there is no Accept all, and for each of them a link to GitHub's page that prefills the new file of its approval record
test("without a token: no Accept all — GitHub's prefilled page for each record, as for a single Accept", async () => {
  const repo = await product();
  const page = await openDashboard({ server: await server(repo), hash: "#review/arc", token: null });
  const html = page.main();
  assert.ok(section(html, "MOD-page") && section(html, "MOD-reader"), "the files are shown");
  assert.doesNotMatch(html, /accept-all/);
  const hrefs = [...html.matchAll(/<a class="github-page" href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  for (const p of [PAGE, READER]) {
    const path = approvalPath(reviewedId(p), await blobSha(repo[p]));
    assert.ok(hrefs.some((href) => href.startsWith(`https://github.com/${REPO}/new/main?`) && new URL(href).searchParams.get("filename") === path), path);
  }
});

// TST-1294008 · level: component · module: MOD-site-frame
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the fixture product
// input: open #uc and #arc with a token
// expect: the use-case list links to #use-case/id=all and the architecture list to #decision/id=all, each with the text Review all
test("the use-case list and the architecture list link to their review page", async () => {
  const repo = await product();
  const uc = await openDashboard({ server: await server(repo), hash: "#uc" });
  assert.match(uc.main(), /href="#use-case\/id=all"[^>]*>Review all/);
  const arc = await openDashboard({ server: await server(repo), hash: "#arc" });
  assert.match(arc.main(), /href="#decision\/id=all"[^>]*>Review all/);
});
