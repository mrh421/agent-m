// A PAGE LOAD READS THE REPOSITORY IN BATCHES — the Check of that requirement. With a token on GitHub, one load of a dashboard
// page sends its commit and that commit's tree once, and the texts of the files it shows in requests of at most 100 files each;
// a file whose blob the page has read is not read again, and an acceptance reads the head it commits on once. Deterministic, no
// network: the real app (src/site-frame/dashboard-app.mjs) runs in tests/app-harness.mjs against a GitHub API mock that counts every
// request and serves GitHub's batch request (POST /graphql), one aliased field for each file, and its query of folders' entries
// (POST /graphql, counted as `folders`).
//
// Of the tree, a review page reads only the folders it shows (ITM-1266; MOD-site-frame's Route `folders`, MOD-repository-hosts' readSnapshot
// with `folders`): the start page, #arc, #spec and the review routes send their commit and one request for their folders — no git/trees —; a
// route that names no folders, such as #settings or #backlog, reads the whole tree as before. On the instance's own page the folders include the
// two files of the instance that MOD-prompt-bar's Files names and the bar reads when it is drawn: docs/participants.md and
// docs/conversation-recording.md.
//
// Module: MOD-site-frame
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; STATUS IS DERIVED FROM THE RECORDS; AN APPROVAL NAMES THE EXACT TEXT; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// Level: component
//
// The expected requests are written here from the requirement, for the fixture product of tests/fixtures/architecture: the files a
// page shows are listed by name, and the requests that carry them are `batch <n>`, n the files in it. The pages are MOD-review-pages'
// routes, which the app's addresses lead to. A route of MOD-review-pages draws from the snapshot the frame hands its `reads` (ITM-716) and asks
// the repository's information (`repository`) only where it needs whether the person may write or the repository's visibility; MOD-trace-pages'
// modules view (#arc, #module) and MOD-approvals' lastAcceptedText (a changed file) still read it, once per page open, and a second such read
// within a load fails the case.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { blobSha } from "../src/text-tools/index.mjs";
import { sectionText } from "../src/spec-document/index.mjs";
import { repoServer, fakeCaches, openDashboard, REPO, setting, askedFor } from "./app-harness.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";

// ---------------------------------------------------------------- the product: tests/fixtures/architecture, with records and queues

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
const README = "docs/use-cases/README.md";
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md";
const PAGE = "docs/architecture/MOD-page.md", REVIEW = "docs/architecture/MOD-review.md";
const DONE = "docs/spec-freigaben/2026-09-01_done", OPEN = "docs/spec-freigaben/2026-09-02_open";
// The rationales of the queues' entries, which queues reads for each entry's issue (MOD-spec-changes, Queue).
const RATIONALES = [`${DONE}/01-rules.begruendung.md`, `${OPEN}/01-more.begruendung.md`];
const INDEX = (anchor) => "# Queue\n\n**Zieldatei aller Einträge:** `products/fixture/SPEC.md`\n\n| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n" +
  `|---|---|---|---|---|\n| 01 | \`SPEC.md\` | ${anchor} | — | — |\n`;

// The texts accepted earlier, which the server still holds by their blob SHA.
const EARLIER = [];
const server = async (files, handlers = []) => repoServer({ files, history: EARLIER, handlers });

async function product(over = {}) {
  const f = { ...base, [README]: "# Use cases\n\nThe overview.\n", "docs/approvals/README.md": "# Approval records\n" };
  const rec = async (id, path, text, blob = null) => {
    const b = blob ?? await blobSha(text);
    if (text !== f[path]) EARLIER.push(text);
    f[approvalPath(id, await blobSha(text))] = recordText(reviewedRecord(path, b));
  };
  await rec("UC-001", UC1, f[UC1]);                                  // accepted
  await rec("UC-002", UC2, f[UC2].replace("Show the status", "Show a status"));   // changed: accepted in an earlier text
  await rec("ARC-001", ARC, f[ARC]);                                 // accepted
  await rec("MOD-reader", READER, f[READER].replace("Reads files at", "Reads a file at"));   // changed
  // A queue whose one entry is accepted and written, and a queue with an open entry.
  const section = sectionText(f["SPEC.md"], "## 1. Rules");
  f[`${DONE}/index.md`] = INDEX("## 1. Rules");
  f[`${DONE}/01-rules.md`] = section;
  f[`${DONE}/01-rules.begruendung.md`] = "# Why\n\nBecause.\n";
  const doneRec = approvalPath("spec-2026-09-01_done-01", await blobSha(section));
  f[doneRec] = recordText({ kind: "spec", queue: DONE, entry: "01", proposal: `${DONE}/01-rules.md`, blob: await blobSha(section),
    target: "SPEC.md", anchor: "## 1. Rules", section: await blobSha(section) });
  f[`${DONE}/entscheidungen.md`] = `# Decisions\n\n| 2026-09-01 10:00 UTC | 1 | uebernommen | approval:${doneRec.split("/").pop()} |\n`;
  f[`${OPEN}/index.md`] = INDEX("## 1. Rules");
  f[`${OPEN}/01-more.md`] = section + "\n**RULE TWO** *(PO, 2026-09-02)*\nA second rule.\n*Check:* none\n";
  f[`${OPEN}/01-more.begruendung.md`] = "# Why\n\nA second rule.\n";
  f[`${OPEN}/entscheidungen.md`] = "# Decisions\n\nAppend-only.\n";
  return { ...f, ...over };
}

const useCase = (n, title) => `---\nid: UC-${n}\ntitle: ${title}\narea: 1\nactors:\n  - Reader\nrealises: []\n---\n# UC-${n} ${title}\n`;
const extraUseCases = (from, count) => Object.fromEntries(Array.from({ length: count }, (_, i) =>
  [`docs/use-cases/UC-${from + i}-extra-${from + i}.md`, useCase(from + i, `Extra ${from + i}`)]));

const files = (requests) => requests.filter((r) => r.startsWith("file ")).map((r) => r.slice(5)).sort();
const under = (requests, prefix) => files(requests).filter((p) => p.startsWith(prefix));
const recordOf = (repo, id) => Object.keys(repo).filter((p) => p.startsWith(`docs/approvals/${id}-`));
const sorted = (list) => [...list].sort();
const batchesOf = (requests) => requests.filter((r) => r.startsWith("batch "));
const count = (requests, what) => requests.filter((r) => r === what).length;
// The head commit the harness's server answers, and the reads of the branches that hold what the workflow "main changed" stored for it — the
// graph (`stored graph <commit>`, trace-cache), the overview (overview-cache), the impact lists, and latest.json, which names the overview
// stored last while the head's is not stored yet: each is one request of its own by design (MOD-trace-graph's storedGraph and storedImpacts,
// MOD-progress-measures' storedOverview and latestOverview), not a file the page shows. No commit's facts file is stored, and none is asked for.
const HEAD = "c0ffee".padEnd(40, "0");
const STORED = new RegExp(`^(${HEAD}\\.(json|impacts\\.json|references\\.json\\.gz)|latest\\.json)$`);
const shownFiles = (requests) => files(requests).filter((path) => !STORED.test(path));
// The order of the one read of the repository's information among a load's requests is no part of the rule: it is counted, and left out of the sequence.
const withoutInfo = (requests) => requests.filter((r) => r !== "repository");
// The instance's files the prompt bar reads when it is drawn (MOD-prompt-bar, Files), which the instance's own page reads with its folders.
const BAR = ["docs/conversation-recording.md", "docs/participants.md"];
// The folders and files each address of the review pages reads of the tree (ITM-1266's Outcome), with the bar's files.
const FOLDERS = {
  useCases: sorted(["docs/use-cases", "docs/approvals", "docs/groups", "docs/process.md", "SPEC.md", "docs/architecture", "docs/process-models", "src/model-catalogue", "AGENTS.md", ...BAR]),
  architecture: sorted(["docs/architecture", "docs/approvals", "docs/groups", ...BAR]),
  spec: sorted(["SPEC.md", "docs/sources.md", "docs/sources", "docs/spec-freigaben", "docs/approvals", "docs/groups", ...BAR]),
};

// ---------------------------------------------------------------- the start page, #arc, #spec, #backlog: the Check

// TST-1266101 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product — two use cases, one of them with a record of an earlier text
// input: open the start page with a token
// expect: the commit once, one request for the entries of its folders — docs/use-cases, docs/approvals, docs/groups, and what an Accept that checks the modules a use case changes reads — docs/process.md, SPEC.md, docs/architecture, docs/process-models, src/model-catalogue and AGENTS.md —, and the bar's two files — and no git/trees, then one batch of the 2 files it shows, no read of the repository's information (ITM-716: 1 → 0), and no file by itself; both use cases listed with their status — UC-001 accepted, UC-002 changed since acceptance — read from the names of the records, so that no record is read
test("the start page sends its commit, one request for its folders and one batch of the files it shows", async () => {
  const repo = await product(), srv = await server(repo);
  const page = await openDashboard({ server: srv });
  assert.match(page.main(), /UC-001/);
  assert.match(page.main(), /UC-002/);
  assert.match(page.main(), /<span class="badge b-accepted">accepted<\/span>/);
  assert.match(page.main(), /<span class="badge b-changed">changed since acceptance<\/span>/);
  assert.deepEqual(withoutInfo(page.requests), ["commit", "folders", "batch 2"]);
  assert.equal(count(page.requests, "repository"), 0);
  assert.deepEqual(srv.folders.map(sorted), [askedFor(FOLDERS.useCases)]);
  assert.deepEqual(srv.batches.map(sorted), [sorted([UC1, UC2])]);
});

// TST-1266102 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product, whose architecture files decide #arc
// input: open #arc with a token
// expect: the commit once, one request for its folders — docs/architecture, docs/approvals, docs/groups and the bar's two files — and no git/trees, then one batch of the 4 architecture files, the repository's information once with the GraphQL request of greenToMerge beside it, a batch of no file (ITM-1170), and no use case, no queue file, no file by itself; then, for the table and the gaps of the modules view (ITM-721), the graph of the commit: the graph stored for it, read by one request, and no file of the graph (MOD-trace-graph: "A page never builds the graph: it reads the stored one through `storedGraph`")
test("#arc sends its commit, one request for its folders and one batch of the files it shows — no use case and no queue file", async () => {
  const repo = await product(), srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#arc" });
  for (const id of ["ARC-001", "MOD-page", "MOD-reader", "MOD-review"]) assert.match(page.main(), new RegExp(id));
  // ITM-1170: "batch 0" is the GraphQL request of greenToMerge beside the repository's information; it names no file.
  assert.deepEqual(withoutInfo(page.requests), ["commit", "folders", "batch 4", "batch 0", STORED_GRAPH]);
  assert.equal(count(page.requests, "repository"), 1);
  assert.deepEqual(srv.folders.map(sorted), [askedFor(FOLDERS.architecture)]);
  assert.deepEqual(sorted(srv.batches[0]), sorted([ARC, PAGE, READER, REVIEW]));
  assert.deepEqual(srv.batches.slice(1), [[]], "no graph is built from the files; the second batch, of no file, is greenToMerge's (ITM-1170)");
  assert.equal(new Set(srv.batches.flat()).size, srv.batches.flat().length, "no file twice");
});

// TST-1429017 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: MOD-review, which realises UC-002, a use case whose current text is not accepted
// input: open #arc/MOD-review with a token
// expect: the page names UC-002 as what it rests on and offers one Accept, disabled; the counter-proof is MOD-page, which names nothing open and is offered for acceptance with an Accept that is enabled
test("TST-1429017: #arc/<id>: a module that names what is not accepted says so, and its Accept is disabled", async () => {
  const repo = await product();
  const waiting = await openDashboard({ server: await server(repo), hash: "#arc/MOD-review" });
  assert.match(waiting.main(), /Rests on what is not accepted/);
  assert.match(waiting.main(), /<li class="open-name">UC-002<\/li>/);
  assert.match(waiting.main(), /<button class="btn accept" type="button" disabled>Accept<\/button>/);
  assert.equal(waiting.main().match(/<button class="btn accept"/g).length, 1, "one Accept");
  const free = await openDashboard({ server: await server(repo), hash: "#arc/MOD-page" });
  assert.doesNotMatch(free.main(), /Rests on what is not accepted/);
  assert.match(free.main(), /<button class="btn accept" type="button">Accept<\/button>/);
});

// TST-1429018 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product with a queue whose one entry is accepted and written, and a queue with an open entry
// input: open #spec with a token
// expect: no overview is stored for the commit, so the app reads, as MOD-site-frame states it ("the change queues stored for the commit, read beside the first wave of `#spec` …; where no overview is stored, the index and decisions of every queue are read, then the proposals of those still open"), in three waves, each one request: the SPEC — 1 file —, then the queues' heads — 3 files, the two queues' index files being the same blob —, then the proposals of the open queue — 1 file —; before the third, the GraphQL request of greenToMerge beside the repository's information, a batch of no file (ITM-1170). The open entry's rationale is not read (ITM-1274: the impact list of the open entry is made from its proposal and target, MOD-spec-changes' entryImpact, "it reads no rationale"); the graph gives that impact list (the statuses of the specification view, UC-020 step 3) only its referencedBy (MOD-spec-changes), and that graph is the stored one, and no batch of its artifacts is sent (MOD-trace-graph: "A page never builds the graph"); no file twice, the accepted queue's proposal not at all, and no file by itself. The open entry stands under "SPEC changes waiting for acceptance" as a link with its state open; the written one does not.
test("TST-1429018: #spec: the app reads the SPEC in one batch, the queues' heads in a second, the open queue's proposals in a third, and builds no graph", async () => {
  const repo = await product(), srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#spec" });
  const wave1 = ["SPEC.md"], heads = sorted([`${DONE}/entscheidungen.md`, `${DONE}/index.md`, `${OPEN}/entscheidungen.md`]);
  const wave3 = [`${OPEN}/01-more.md`], rationales = RATIONALES;
  assert.deepEqual(batchesOf(page.requests), ["batch 1", "batch 3", "batch 0", `batch ${rationales.length}`, "batch 1"], "batch 0 is greenToMerge's (ITM-1170)");
  assert.deepEqual(srv.batches.map(sorted), [wave1, heads, [], rationales, wave3], "no other batch: no graph is built from the files; the empty one is greenToMerge's (ITM-1170); the rationales, whose line Issue gives each entry's issue (MOD-spec-changes, Queue), in the queues' second round");
  assert.equal(new Set(srv.batches.flat()).size, srv.batches.flat().length, "no file twice");
  assert.deepEqual(shownFiles(page.requests), [], "the app reads no file by itself");
  const main = page.main();
  assert.match(main, /SPEC changes waiting for acceptance/);
  assert.match(main, /href="#spec-entry\/id=spec-2026-09-02_open-01"[^>]*>[^<]*<\/a><\/td><td>1\. Rules<\/td><td><span class="badge b-open">open<\/span>/);
  assert.doesNotMatch(main, /spec-2026-09-01_done-01/, "the written entry is not among the waiting ones");
});

// TST-1429019 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product with a register: the links file docs/sources.md and two entries docs/sources/SRC-a.md and SRC-b.md
// input: open #spec with a token
// expect: the first wave is one batch of 4 files — the SPEC and the links file with the two register entries —, then, no overview being stored, the queues' heads a second batch of 3 (MOD-site-frame: "where no overview is stored, the index and decisions of every queue are read, then the proposals of those still open"), the open queue's proposal a third batch of 1 — its rationale is not read (ITM-1274) —, before it greenToMerge's GraphQL request, a batch of no file (ITM-1170), and no batch of the graph's artifacts; no file twice, none by itself; the register is read in no batch of its own
test("TST-1429019: #spec: the links file and the register's entries are read in the first wave, beside the SPEC and the queues' heads", async () => {
  const entry = (id) => ["---", `id: ${id}`, "title: A person", "kind: person", "authority: normative", "licence: may be republished — fixture",
    `identifier: github.com/${id}`, "---", `# ${id} A person`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
    "| `2026-10-11` | 2026-10-11 | the fixture | this repository | one file, hashed only |", ""].join("\n");
  const register = { "docs/sources.md": `# Sources\n\n| Source | Version | Hash | Part |\n|---|---|---|---|\n| SRC-a | 2026-10-11 | ${"0".repeat(64)} | |\n`,
    "docs/sources/SRC-a.md": entry("SRC-a"), "docs/sources/SRC-b.md": entry("SRC-b") };
  const srv = await server(await product(register));
  const page = await openDashboard({ server: srv, hash: "#spec" });
  const wave1 = sorted(["SPEC.md", ...Object.keys(register)]);
  const heads = sorted([`${DONE}/entscheidungen.md`, `${DONE}/index.md`, `${OPEN}/entscheidungen.md`]);
  assert.deepEqual(batchesOf(page.requests), ["batch 4", "batch 3", "batch 0", `batch ${RATIONALES.length}`, "batch 1"], "batch 0 is greenToMerge's (ITM-1170)");
  assert.deepEqual(srv.batches.map(sorted), [wave1, heads, [], RATIONALES, [`${OPEN}/01-more.md`]], "the empty batch is greenToMerge's (ITM-1170); the rationales in the queues' second round");
  assert.equal(new Set(srv.batches.flat()).size, srv.batches.flat().length, "no file twice");
  assert.deepEqual(shownFiles(page.requests), [], "no file by itself");
});

// TST-1266103 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product
// input: open #spec with a token
// expect: the whole load — the specification route's reads included — sends its commit once and one request for its folders — SPEC.md, docs/sources.md, docs/sources, docs/spec-freigaben, docs/approvals, docs/groups and the bar's two files —, no git/trees, reads the repository's information once, and reads no file by itself
test("#spec: the whole load sends its commit and one request for its folders once, and every file in a batch", async () => {
  const srv = await server(await product());
  const page = await openDashboard({ server: srv, hash: "#spec" });
  assert.equal(count(page.requests, "commit"), 1);
  assert.equal(count(page.requests, "folders"), 1);
  assert.equal(count(page.requests, "tree"), 0);
  assert.deepEqual(srv.folders.map(sorted), [askedFor(FOLDERS.spec)]);
  assert.equal(count(page.requests, "repository"), 1);
  assert.deepEqual(shownFiles(page.requests), []);
});

// TST-1429020 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product, opened on #uc
// input: go on to #arc, #uc/UC-001 and #spec within the same load of the page
// expect: the start page reads no repository's information (ITM-716: 1 → 0); #arc reads it once, for its modules view (MOD-trace-pages; ITM-716: 0 → 1), and #uc/UC-001 and #spec do not read it again
test("TST-1429020: the repository's information is read once for as long as the page is open", async () => {
  const page = await openDashboard({ server: await server(await product()) });
  assert.equal(count(page.requests, "repository"), 0);
  for (const [hash, times] of [["#arc", 1], ["#uc/UC-001", 0], ["#spec", 0]]) assert.equal(count(await page.go(hash), "repository"), times, hash);
});

// TST-1429021 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product that declares its process model, with one team, its sprint and two items; the branch overview-cache holds the backlog view of the head (ITM-1260: MOD-implementation-pages' route `backlog` "draws the view stored for the head (MOD-progress-measures' `storedView`) and reads no record, no facts and no pull request")
// input: open #backlog with a token
// expect: the commit and the tree once, then one read of the view on overview-cache, and nothing else: no batch of files, no file by itself, no facts file, no pull request; ITM-001 and ITM-002 listed
test("TST-1429021: #backlog sends its commit and tree once, and reads the view stored for its commit, with no batch of files", async () => {
  const repo = await product({
    "docs/process.md": ["---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"c0ffee".padEnd(40, "0")}`,
      "---", "# How the fixture product is developed", ""].join("\n"),
    "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Owner | alice |\n| Builders | dev-a |\n| Checker | dev-a |\n",
    "docs/backlog/sprints/team1/01.md": "---\nsprint: 1\ngoal: Read\nstart: 2026-09-14\nend:\ncloser: alice\nbranch:\nselection:\n  - ITM-001\n---\n# team1 Sprint 01\n",
    "docs/backlog/ITM-001-item-1.md": item(1), "docs/backlog/ITM-002-item-2.md": item(2),
  });
  const pulls = (url) => (url.origin === "https://api.github.com" && url.pathname === `/repos/${REPO}/pulls`
    ? new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }) : undefined);
  const srv = await server(repo, [pulls, storedView("backlog", backlogViewOf(["ITM-001", "ITM-002"]))]);
  const page = await openDashboard({ server: srv, hash: "#backlog" });
  assert.match(page.main(), /ITM-001/);
  assert.match(page.main(), /ITM-002/);
  assert.deepEqual(withoutInfo(page.requests), ["commit", "tree", `handler GET https://api.github.com/repos/${REPO}/contents/${HEAD}.backlog.json.gz?ref=overview-cache`]);
  assert.deepEqual(srv.batches, [], "no batch of files");
  assert.deepEqual(page.requests.filter((r) => r.includes(".facts.json") || /\/pulls\b/.test(r)), []);
});

// The view of `page` stored for the head on overview-cache, gzipped JSON as MOD-progress-measures' publishOverview stores it, served through the contents API with a token.
function storedView(page, view) {
  const bytes = gzipSync(JSON.stringify({ ...view, commit: HEAD }));
  return (url) => (url.origin === "https://api.github.com" && url.searchParams.get("ref") === "overview-cache" && url.pathname === `/repos/${REPO}/contents/${HEAD}.${page}.json.gz`
    ? new Response(bytes, { status: 200 }) : undefined);
}
const MODEL = { name: "fixture-scrum-wip", kind: "pulled", sprints: true, wip: 2, measure: "remaining items per time box" };
const stateOf = (item, state) => ({ item, state, reason: null, job: null, pullRequest: null });
// A BacklogView (MOD-progress-measures' Interfaces) of team1 and the items, each ready.
const backlogViewOf = (items) => ({ declared: true, modelFile: "docs/process-models/fixture.md", modelUnread: null, model: MODEL,
  teams: [{ team: "team1", owner: "alice", running: { name: "team1/01", path: "docs/backlog/sprints/team1/01.md", goal: "Read", closer: "alice", selection: ["ITM-001"] }, lastEnded: null }],
  rows: items.map((item, at) => ({ item, path: `docs/backlog/${item}-item-${at + 1}.md`, title: `The work of item ${at + 1}`, realises: ["RULE ONE"], state: stateOf(item, "ready"), held: null, kept: [] })),
  uncovered: { requirements: [], useCases: [] } });
// A ProgressView (MOD-progress-measures' Interfaces) of team1's running sprint team1/01 with the items, each ready.
const progressViewOf = (items) => ({ declared: true, modelFile: "docs/process-models/fixture.md", modelUnread: null, model: MODEL, measure: null,
  teams: [{ team: "team1", sprint: { name: "team1/01", path: "docs/backlog/sprints/team1/01.md", goal: "Read", start: "2026-10-20", end: "", branch: "", closer: "alice", ended: null,
    final: false, endable: true, items: items.map((item, at) => ({ item, path: `docs/backlog/${item}-item-${at + 1}.md`, title: `The work of item ${at + 1}`, state: stateOf(item, "ready"),
      changes: ["MOD-reader"], uses: [] })), merges: [] } }],
  gates: [], blocked: [], who: { participants: [], held: [], unreachable: [] } });

// A fake of GitHub's pulls API and search, as their pages document them ("List pull requests": state, sort, direction, per_page, page, and the Link header naming the last page;
// "Search issues and pull requests": total_count): `closed` pull requests closed in August, two open ones, and one merged on 2026-10-21, during the running sprint.
function pullsAndSearch(closed) {
  const pull = (number, state, updated, merged = null) => ({ number, title: `ITM-00${number % 2 + 1}: work ${number}`, head: { ref: `work/${number}`, sha: "b".repeat(40) }, base: { ref: "main" },
    state, created_at: "2026-08-01T00:00:00Z", updated_at: updated, merged_at: merged, merge_commit_sha: merged ? "f".repeat(40) : null, closed_at: state === "closed" ? updated : null, body: "" });
  const all = [pull(closed + 3, "open", "2026-10-22T09:00:00Z"), pull(closed + 2, "open", "2026-08-15T09:00:00Z"), pull(closed + 1, "closed", "2026-10-21T10:00:00Z", "2026-10-21T10:00:00Z"),
    ...Array.from({ length: closed }, (_, i) => pull(closed - i, "closed", "2026-08-02T00:00:00Z", i % 3 ? null : "2026-08-02T00:00:00Z"))];
  const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...headers } });
  return (url) => {
    if (url.origin !== "https://api.github.com") return undefined;
    const q = url.searchParams;
    if (url.pathname === "/search/issues") {
      const query = q.get("q") ?? "", since = /updated:>=(\S+)/.exec(query)?.[1];
      const found = all.filter((p) => (!query.includes("is:closed") || p.state === "closed") && (!query.includes("is:open") || p.state === "open") && (!since || Date.parse(p.updated_at) >= Date.parse(since)));
      return json({ total_count: found.length, incomplete_results: false, items: [] });
    }
    if (url.pathname !== `/repos/${REPO}/pulls`) return undefined;
    const state = q.get("state") ?? "open", per = Number(q.get("per_page") ?? 30), page = Number(q.get("page") ?? 1);
    let list = all.filter((p) => state === "all" || p.state === state);
    if (q.get("sort") === "updated") list = [...list].sort((a, b) => (q.get("direction") === "asc" ? 1 : -1) * a.updated_at.localeCompare(b.updated_at));
    const last = Math.max(1, Math.ceil(list.length / per));
    const at = (n) => { const next = new URL(url); next.searchParams.set("page", String(n)); return next.href; };
    return json(list.slice((page - 1) * per, page * per), page < last ? { Link: `<${at(page + 1)}>; rel="next", <${at(last)}>; rel="last"` } : {});
  };
}

// TST-1429022 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035
// given: a product that declares its process model, with one team whose sprint 01 runs since 2026-10-20, two items; its pull requests: two open, one merged on 2026-10-21, and 250 closed in August; the branch overview-cache holds the progress view of the head (ITM-1260: MOD-implementation-pages' route `progress` "draws the view stored for the head … and reads no record, no facts and no pull request")
// input: open #implementation with a token; and, as the counter-proof, the same without the stored view
// expect: the route progress is drawn — team1's running sprint team1/01 — and no request about pull requests is sent, no /pulls and no /search/issues; without the stored view the page derives the view in the page and reads them
test("TST-1429022: #implementation draws progress from the view stored for its commit, and sends no request about pull requests", async () => {
  const sprinting = () => product({
    "docs/process.md": ["---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"c0ffee".padEnd(40, "0")}`,
      "---", "# How the fixture product is developed", ""].join("\n"),
    "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Owner | alice |\n| Builders | dev-a |\n| Checker | dev-a |\n",
    "docs/backlog/sprints/team1/01.md": "---\nsprint: 1\ngoal: Read\nstart: 2026-10-20\nend:\ncloser: alice\nbranch:\nselection:\n  - ITM-001\n  - ITM-002\n---\n# team1 Sprint 01\n",
    "docs/backlog/ITM-001-item-1.md": item(1), "docs/backlog/ITM-002-item-2.md": item(2),
  });
  const about = (requests) => requests.filter((r) => r.startsWith("handler GET https://api.github.com/")).map((r) => new URL(r.slice("handler GET ".length)))
    .filter((url) => url.pathname.endsWith("/pulls") || url.pathname === "/search/issues");
  const stored = await openDashboard({ server: await server(await sprinting(), [pullsAndSearch(250), storedView("progress", progressViewOf(["ITM-001", "ITM-002"]))]), hash: "#implementation" });
  assert.match(stored.main(), /data-team="team1"/, "the route progress is drawn");
  assert.match(stored.main(), /team1\/01/);
  assert.deepEqual(about(stored.requests).map(String), [], "no request about pull requests");
  const derived = await openDashboard({ server: await server(await sprinting(), [pullsAndSearch(250)]), hash: "#implementation" });
  assert.match(derived.main(), /team1\/01/);
  assert.ok(about(derived.requests).some((url) => url.pathname.endsWith("/pulls")), "counter-proof: without the stored view the page reads the pull requests");
});

const item = (n) => ["---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", "  - RULE ONE", "modules:", "  - MOD-reader",
  "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "",
  `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.", ""].join("\n");

// TST-1266110 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a start page that shows 207 use cases
// input: open the start page with a token
// expect: the commit and the request for its folders, then 3 batches in all, never more than 100 files in one: batch 100, batch 100, batch 7, and no read of the repository's information (ITM-716: 1 → 0)
test("a page that shows more than a hundred files sends one batch for every hundred of them", async () => {
  const repo = await product(extraUseCases(100, 205)), srv = await server(repo);
  const page = await openDashboard({ server: srv });
  assert.deepEqual(withoutInfo(page.requests), ["commit", "folders", "batch 100", "batch 100", "batch 7"]);
  assert.equal(count(page.requests, "repository"), 0);
  assert.equal(new Set(srv.batches.flat()).size, 207, "each of the 207 files once");
});

// TST-1429023 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a stored token; the fixture product
// input: open the start page without a token
// expect: GitHub's batch request needs the token: none is sent, and each of the 2 files is read by its own request
test("TST-1429023: without a token no batch is sent; each file is read by itself", async () => {
  const srv = await server(await product());
  const page = await openDashboard({ server: srv, token: null });
  assert.deepEqual(batchesOf(page.requests), []);
  assert.deepEqual(files(page.requests), [UC1, UC2]);
  assert.equal(count(page.requests, "repository"), 0);
  assert.match(page.main(), /UC-002/);
});

// TST-1429024 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: three use cases waiting for acceptance — UC-002 changed, UC-003 and UC-004 open — shown on the review page
// input: press Accept all 3 shown
// expect: before it writes, the click reads the head it commits on once — one commit, one tree — and, once, the SPEC that the requirements the use cases name are looked up in (MOD-approvals' acceptShown); no use case, since the three texts were read when the page was shown and their blobs are unchanged; the repository's information is not read again
test("TST-1429024: an acceptance of three files reads its head once", async () => {
  const repo = await product({ "docs/use-cases/UC-003-third.md": useCase("003", "Third"), "docs/use-cases/UC-004-fourth.md": useCase("004", "Fourth") });
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#review/uc" });
  assert.match(page.main(), /Accept all 3 shown/);
  const made = await page.click(".accept-all");
  assert.equal(srv.writes.length, 1, "one commit");
  assert.equal(Object.keys(srv.writes[0].files).length, 3, "one record for each of the three files");
  const before = made.slice(0, made.indexOf("write tree"));
  assert.equal(count(before, "commit"), 1, before.join(" | "));
  assert.equal(count(before, "tree"), 1, before.join(" | "));
  assert.equal(count(made, "repository"), 0, made.join(" | "));
  assert.deepEqual(before.filter((r) => r.startsWith("file ") || r.startsWith("batch ")), ["file SPEC.md"], before.join(" | "));
});

// TST-1266104 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: three use cases waiting for acceptance — UC-002 changed, UC-003 and UC-004 open
// input: open #review/uc with a token
// expect: the three use cases come in one batch of three and none by itself; the GraphQL request of greenToMerge, a batch of no file (ITM-1170), comes before the batch of the last accepted text; the only file read by itself is the record of UC-002's last accepted text, which MOD-approvals reads; the commit and the request for the folders of the use cases once each, and no git/trees; UC-002's last accepted text is one batch of one file, UC-002's at the commit that added its record (MOD-repository-hosts' readFileAt), with no request for that commit, its folders or its tree
test("#review/uc: the files it shows come in one batch", async () => {
  const repo = await product({ "docs/use-cases/UC-003-third.md": useCase("003", "Third"), "docs/use-cases/UC-004-fourth.md": useCase("004", "Fourth") });
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#review/uc" });
  assert.match(page.main(), /Accept all 3 shown/);
  assert.deepEqual(batchesOf(page.requests), ["batch 3", "batch 0", "batch 1"], "batch 0 is greenToMerge's (ITM-1170)");
  assert.deepEqual(srv.batches.map(sorted), [sorted([UC2, "docs/use-cases/UC-003-third.md", "docs/use-cases/UC-004-fourth.md"]), [], [UC2]], "the empty batch is greenToMerge's (ITM-1170)");
  assert.deepEqual(files(page.requests), recordOf(repo, "UC-002"), "only the record of UC-002's last accepted text is read by itself");
  assert.equal(count(page.requests, "commit"), 1);
  assert.equal(count(page.requests, "folders"), 1, "the use cases' folders");
  assert.equal(count(page.requests, "tree"), 0);
  assert.deepEqual(page.requests.filter((r) => r.startsWith("era ")), [], "no commit, no tree and no file of the older commit by itself");
});

// TST-716005 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: three use cases waiting for acceptance, none changed since acceptance — UC-002 in the text its record names, UC-003 and UC-004 open —; and, as the known positive, the same with UC-002 changed since acceptance
// input: open #review/uc with a token, for each
// expect: with nothing changed, the page sends its commit and folders once, one batch of the two open use cases, and no read of the repository's information: MOD-review-pages draws from the snapshot the frame read; with UC-002 changed, one read of it, which MOD-approvals' lastAcceptedText makes for UC-002's last accepted text
test("#review/uc reads no repository's information of its own", async () => {
  const more = { "docs/use-cases/UC-003-third.md": useCase("003", "Third"), "docs/use-cases/UC-004-fourth.md": useCase("004", "Fourth") };
  const changed = await product(more);
  const accepted = { ...changed, [UC2]: changed[UC2].replace("Show the status", "Show a status") };
  const plain = await openDashboard({ server: await server(accepted), hash: "#review/uc" });
  assert.match(plain.main(), /Accept all 2 shown/);
  assert.deepEqual(withoutInfo(plain.requests), ["commit", "folders", "batch 2"]);
  assert.equal(count(plain.requests, "repository"), 0, "MOD-review-pages asks none");
  const known = await openDashboard({ server: await server(changed), hash: "#review/uc" });
  assert.match(known.main(), /Accept all 3 shown/);
  assert.equal(count(known.requests, "repository"), 1, "known positive: MOD-approvals' lastAcceptedText reads it for the changed file");
});

// TST-1429025 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same three use cases, and a stored token that is not sent
// input: open #review/uc without a token
// expect: counter-proof of the case above — GitHub's batch request needs the token, so no batch is sent and each of the three use cases is read by its own request, more requests than the one batch
test("TST-1429025: #review/uc without a token: each file is read by itself, which sends more requests than the batch", async () => {
  const repo = await product({ "docs/use-cases/UC-003-third.md": useCase("003", "Third"), "docs/use-cases/UC-004-fourth.md": useCase("004", "Fourth") });
  const withToken = await openDashboard({ server: await server(repo), hash: "#review/uc" });
  const without = await openDashboard({ server: await server(repo), hash: "#review/uc", token: null });
  assert.deepEqual(batchesOf(without.requests), []);
  for (const path of [UC2, "docs/use-cases/UC-003-third.md", "docs/use-cases/UC-004-fourth.md"]) assert.ok(files(without.requests).includes(path), path);
  assert.ok(without.requests.length > withToken.requests.length, `${without.requests.length} against ${withToken.requests.length}`);
});

// TST-1266105 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product, whose UC-001 is accepted
// input: open #uc/UC-001 and #arc/ARC-001 with a token — a route that shows one accepted file
// expect: the commit, the request for its folders, and the one file by its own request — a batch of one file is no fewer requests —; no read of the repository's information (ITM-716: "repository" left out), no git/trees
test("#uc/<id> and #arc/<id> of an accepted file read that one file by itself", async () => {
  const repo = await product();
  const use = await openDashboard({ server: await server(repo), hash: "#uc/UC-001" });
  assert.deepEqual(use.requests, ["commit", "folders", `file ${UC1}`]);
  const arc = await openDashboard({ server: await server(repo), hash: "#arc/ARC-001" });
  assert.deepEqual(arc.requests, ["commit", "folders", `file ${ARC}`]);
});

// ---------------------------------------------------------------- the review pages' own addresses: #use-case, #decision, #module

// A decision file of the fixture's form, ARC-<n>: the fixture then holds three decisions (ARC-001, ARC-002, ARC-003).
const decision = (n) => base[ARC].replaceAll("ARC-001", `ARC-${n}`);
const ARC2 = "docs/architecture/ARC-002-second.md", ARC3 = "docs/architecture/ARC-003-third.md";
const MODULES = [PAGE, READER, REVIEW];
// The read of the graph stored for the fixture's commit (the commit the harness's server answers) on the branch trace-cache, asked for once by a page that reads the graph.
const STORED_GRAPH = `stored graph ${"c0ffee".padEnd(40, "0")}`;

// The files each address shows: the fixture's two use cases, three decisions and three module files.
const SHOWN = { "#use-case": [UC1, UC2], "#decision": [ARC, ARC2, ARC3], "#module": MODULES };
const withDecisions = () => product({ [ARC2]: decision("002"), [ARC3]: decision("003") });

// TST-1266106 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product with two use cases (UC-001, UC-002), three decisions (ARC-001, ARC-002, ARC-003) and three module files (MOD-page, MOD-reader, MOD-review)
// input: open #use-case (then #decision, then #module) with a token
// expect: the commit and the request for its folders once, no git/trees, one batch of exactly the files of its own kind — 2 files for #use-case, 3 for #decision, 3 for #module —, no read of the repository's information for #use-case and #decision (ITM-716: 1 → 0) and one for #module, whose modules view reads it (MOD-trace-pages), with the GraphQL request of greenToMerge beside it, a batch of no file (ITM-1170), and no file by itself; #module also shows the modules view (ITM-721), which reads the graph of the commit: the graph stored for it, by at most one request — the modules view may ask for it after the page has settled, so the read is counted, not placed —, and no file of the graph (MOD-trace-graph: "A page never builds the graph")
for (const [hash, paths] of Object.entries(SHOWN)) {
  test(`${hash} sends its commit and the request for its folders once and one batch of the files it shows`, async () => {
    const srv = await server(await withDecisions());
    const page = await openDashboard({ server: srv, hash });
    assert.deepEqual(withoutInfo(page.requests).filter((r) => r !== STORED_GRAPH), ["commit", "folders", `batch ${paths.length}`, ...(hash === "#module" ? ["batch 0"] : [])], "batch 0 is greenToMerge's, beside #module's read of the repository's information (ITM-1170)");
    assert.deepEqual(srv.folders.map(sorted), [askedFor(hash === "#use-case" ? FOLDERS.useCases : FOLDERS.architecture)]);
    assert.ok(count(page.requests, STORED_GRAPH) <= 1, "the stored graph is read at most once");
    assert.equal(count(page.requests, "repository"), hash === "#module" ? 1 : 0);
    assert.deepEqual(sorted(srv.batches[0]), sorted(paths));
    assert.equal(srv.batches.length, hash === "#module" ? 2 : 1, "no graph is built from the files; #module's second batch is greenToMerge's, of no file (ITM-1170)");
    assert.deepEqual(shownFiles(page.requests), [], "no file by itself");
  });
}

// The fixture product declaring a model that pulls its work (ITM-1319): the instance's own page, so that its declaration names the model at the commit the page reads,
// with the model's file and a register whose participant checker-a drafts text from this tab — the participant a page of use cases names beside Accept.
const PULLED = {
  "docs/process.md": ["---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${HEAD}`, "---", "# How the fixture product is developed", ""].join("\n"),
  "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
  "docs/participants.md": [...readFileSync(new URL("../docs/participants.md", import.meta.url), "utf8").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))),
    "| checker-a | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |", ""].join("\n"),
};
const perLoad = (requests) => Object.fromEntries(["commit", "tree", "folders", "repository"].map((what) => [what, count(requests, what)]));

// TST-1319007 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG
// given: the fixture product, once as it is and once declaring in docs/process.md a model that pulls its work (fixture-scrum-wip at the commit the page reads), with the model's file and a register with checker-a
// input: open #use-case, #use-case/id=UC-002 and #use-case/id=all with a token, each in a load of its own, for both
// expect: known positive: #use-case of the product as it is sends the base's requests — the commit, the request for its folders, one batch of 2 —; in the pulled product each page names checker-a beside Accept, and sends as many commit, tree and folders requests as the same page of the product as it is, and the repository's information once — the pulled product's { repository: 1 } against the plain one's { repository: 0 } on #use-case (ITM-716), the visibility that MOD-review-pages' jobs.mjs loadStage asks for the check beside Accept —: its commit once, no tree beside its folders; docs/process.md and SPEC.md are never read as a file by itself
test("a page of use cases in a pulled product reads its commit and its folders once, and its declaration and SPEC in batches", async () => {
  const plainList = await openDashboard({ server: await server(await product()), hash: "#use-case" });
  assert.deepEqual(withoutInfo(plainList.requests).filter((r) => r !== STORED_GRAPH), ["commit", "folders", "batch 2"], "known positive: the base's requests");
  for (const hash of ["#use-case", "#use-case/id=UC-002", "#use-case/id=all"]) {
    const plain = await openDashboard({ server: await server(await product()), hash });
    const pulled = await openDashboard({ server: await server(await product(PULLED)), hash });
    assert.match(pulled.main(), /class="participant">checker-a</, `${hash}: checker-a is named beside Accept`);
    assert.deepEqual(perLoad(pulled.requests), { ...perLoad(plain.requests), repository: 1 }, `${hash}: the commit, the tree and the folders as often as without the declaration, and the repository's information once`);
    assert.equal(perLoad(pulled.requests).commit, 1, `${hash}: the commit once`);
    for (const path of ["docs/process.md", "SPEC.md"]) assert.equal(count(pulled.requests, `file ${path}`), 0, `${hash}: ${path} is read in a batch`);
  }
});

// TST-1429026 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same fixture product, and a stored token that is not sent
// input: open #use-case, #decision and #module without a token
// expect: counter-proof of the case above — GitHub's batch request needs the token, so no batch is sent and each of the files of the kind (2, 3 and 3) is read by its own request; no read of the repository's information for #use-case and #decision (ITM-716: 1 → 0), one for #module
test("TST-1429026: #use-case, #decision and #module without a token: each file is read by itself", async () => {
  const repo = await withDecisions();
  for (const [hash, paths] of Object.entries(SHOWN)) {
    const page = await openDashboard({ server: await server(repo), hash, token: null });
    assert.deepEqual(batchesOf(page.requests), [], hash);
    for (const path of paths) assert.ok(files(page.requests).includes(path), `${hash}: ${path}`);
    assert.equal(count(page.requests, "repository"), hash === "#module" ? 1 : 0, hash);
  }
});

// TST-1266107 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: UC-001 and MOD-page, each with a record that names its current text
// input: open #use-case/id=UC-001 and #module/id=MOD-page with a token — a route that shows one accepted file
// expect: the commit, the request for its folders, and the one file by its own request — a batch of one file is no fewer requests —; no read of the repository's information (ITM-716: "repository" left out), no git/trees
test("#use-case/id= and #module/id= of an accepted file read that one file by itself", async () => {
  const repo = await product();
  const blob = await blobSha(repo[PAGE]);
  repo[approvalPath("MOD-page", blob)] = recordText(reviewedRecord(PAGE, blob));
  const use = await openDashboard({ server: await server(repo), hash: "#use-case/id=UC-001" });
  assert.deepEqual(use.requests, ["commit", "folders", `file ${UC1}`]);
  const module = await openDashboard({ server: await server(repo), hash: "#module/id=MOD-page" });
  assert.deepEqual(module.requests, ["commit", "folders", `file ${PAGE}`]);
});

// ---------------------------------------------------------------- one view, what it reads

// TST-1266108 · level: component · module: MOD-site-frame
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: UC-002, accepted in an earlier text, edited since
// input: open #uc/UC-002 with a token
// expect: the file once, the record's history once and the text the record names as the file stood when the record was added — that file at that commit in one batch of one file (MOD-repository-hosts' readFileAt), and no request for that commit, its folders or its tree; the head's commit and the request for its folders once, no git/trees of the head; the page shows the difference to the text accepted before
test("opening one use case reads that use case, the history of its record and the text the record names — no other file, no older tree", async () => {
  const repo = await product();
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  assert.deepEqual(srv.batches, [[], [UC2]], "the older text is asked for the file alone, in one batch of one; the empty one is greenToMerge's (ITM-1170)");
  assert.deepEqual(files(page.requests), [...recordOf(repo, "UC-002"), UC2].sort());
  assert.deepEqual(page.requests.filter((r) => r.startsWith("history ")), [`history ${recordOf(repo, "UC-002")[0]}`]);
  assert.deepEqual(page.requests.filter((r) => r.startsWith("era ")), [], "no commit, no tree and no file of the older commit by itself");
  assert.equal(count(page.requests, "commit"), 1);
  assert.equal(count(page.requests, "folders"), 1, "the head's folders");
  assert.equal(count(page.requests, "tree"), 0);
  assert.match(page.main(), /Show the status/);
  assert.match(page.main(), /<section class="accepted-diff"><h3>Changed since it was last accepted<\/h3>/);
  assert.match(page.main(), /<span class="ddel">- title: Show a status/, "the difference to the text accepted before");
});

// TST-1294009 · level: component · module: MOD-site-frame
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-reader, accepted in an earlier text, edited since
// input: open #arc/MOD-reader with a token
// expect: the difference to its last accepted text, the impact list beside it with the affected modules, and Accept offered with it; the impact lists stored for the commit asked for in one request, no graph built from the files — the one batch of files sent is MOD-reader's last accepted text, one file, besides greenToMerge's GraphQL request, of no file (ITM-1170) —, and no use case and no queue file read
test("opening a changed module shows its impact list beside the difference, and offers Accept with it", async () => {
  const repo = await product();
  const srv = await server(repo);
  const page = await openDashboard({ server: srv, hash: "#arc/MOD-reader" });
  assert.match(page.main(), /MOD-reader/);
  assert.match(page.main(), /Changed since it was last accepted/);
  assert.match(page.main(), /<section class="change-impact"><h3>Impact of this change<\/h3>/);
  assert.match(page.main(), /Affected modules/);
  assert.match(page.main(), /<button class="btn accept" type="button">Accept<\/button>/, "Accept, once the impact list is shown");
  assert.deepEqual(under(page.requests, "docs/use-cases/"), []);
  assert.deepEqual(under(page.requests, "docs/spec-freigaben/"), []);
  assert.equal(count(page.requests, `file ${HEAD}.impacts.json`), 1, "the stored impact lists, in one request");
  assert.deepEqual(batchesOf(page.requests), ["batch 0", "batch 1"], "no graph is built from the files; batch 0 is greenToMerge's (ITM-1170)");
  assert.deepEqual(srv.batches, [[], ["docs/architecture/MOD-reader.md"]], "the one batch of a file is MOD-reader's last accepted text; the empty one is greenToMerge's (ITM-1170)");
});

// TST-1266109 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product
// input: open #settings with a token
// expect: counter-proof of the review pages' folders — #settings names no folders: it sends no request for folders and no batch but greenToMerge's GraphQL request, which names no file (ITM-1170), and reads the whole tree as before; no use case, architecture file, record or queue is read
test("settings read the product's settings, and no use case, architecture file, record or queue", async () => {
  const page = await openDashboard({ server: await server(await product()), hash: "#settings" });
  assert.deepEqual(files(page.requests), []);
  assert.deepEqual(batchesOf(page.requests), ["batch 0"], "no batch but greenToMerge's, which names no file (ITM-1170)");
  assert.equal(count(page.requests, "folders"), 0);
  assert.ok(page.requests.includes("tree"));
});

// ---------------------------------------------------------------- #roles, #process, #release and #settings: the repository they show, once (ITM-1138)

// The four routes that read the repository they show themselves, beside the instance's files (MOD-implementation-pages, MOD-test-pages, MOD-settings-pages).
const OWN_READERS = ["#roles", "#process", "#release", "#settings"];
// A product that is another repository than the instance, on a server of its own; its head differs from the instance's, so that each commit is told apart.
const OTHER = "alice/product";
// The page of `hash` over two fake servers, the instance's and the other product's: a request goes to the server of the repository it names — by its path, or, for a
// request of GitHub's batch API, by the owner and name it is asked with. -> { page, instance, product }, each server with the requests it was sent.
async function openOnTwo(hash) {
  const instance = await server(await product());
  const shown = await repoServer({ files: await product(), history: EARLIER, repo: OTHER, head: "b0ffee".padEnd(40, "0") });
  const ofProduct = (url, init) => (url.pathname === "/graphql"
    ? `${JSON.parse(init.body).variables?.owner}/${JSON.parse(init.body).variables?.name}` === OTHER
    : url.pathname.includes(`/${OTHER}/`) || url.pathname.endsWith(`/${OTHER}`));
  const both = {
    get requests() { return instance.requests; },
    get pending() { return instance.pending + shown.pending; },
    fetch: (u, init = {}) => (ofProduct(new URL(String(u)), init) ? shown : instance).fetch(u, init),
  };
  const page = await openDashboard({ server: both, hash, search: `?repo=${OTHER}`, entries: setting("products", [`https://github.com/${OTHER}`]) });
  for (let idle = 0; idle < 40; idle += 1) await new Promise((r) => setTimeout(r, 0));
  return { page, instance, product: shown };
}

// TST-1138001 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture product as the instance itself, with a token; its docs/process.md names no other commit of the instance
// input: open #roles, #process, #release and #settings, each in a load of its own
// expect: each load sends the instance's commit once and its tree once — the snapshot the load read, handed to the route through the frame's host — (base: 3 for #roles, #process and #settings, 2 for #release)
test("#roles, #process, #release and #settings of the instance send its commit and its tree once", async () => {
  for (const hash of OWN_READERS) {
    const page = await openDashboard({ server: await server(await product()), hash });
    assert.equal(count(page.requests, "commit"), 1, `${hash}: the commit once`);
    assert.equal(count(page.requests, "tree"), 1, `${hash}: the tree once`);
  }
});

// TST-1138002 · level: component · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product that is another repository than the instance (alice/product, kept in this browser's products), on a server of its own, and the instance on another, with a token
// input: open #roles, #process, #release and #settings with ?repo=alice/product, each in a load of its own
// expect: each load sends the product's commit once and its tree once (base: 2 each); the instance's reads are not counted — the prompt bar's own instance host reads the instance's commit on a product's page as well
test("#roles, #process, #release and #settings of another product send that product's commit and tree once", async () => {
  for (const hash of OWN_READERS) {
    const { product: shown } = await openOnTwo(hash);
    assert.equal(count(shown.requests, "commit"), 1, `${hash}: the product's commit once`);
    assert.equal(count(shown.requests, "tree"), 1, `${hash}: the product's tree once`);
  }
});

// ---------------------------------------------------------------- the texts held during one dashboard load

test("a second load on an unchanged tree sends the same requests as the first; an edited file is read in the same batch", async () => {
  const repo = await product(), caches = fakeCaches();
  const first = await openDashboard({ server: await server(repo), caches });
  assert.deepEqual(withoutInfo(first.requests), ["commit", "folders", "batch 2"]);
  const again = await openDashboard({ server: await server(repo), caches });
  assert.deepEqual(withoutInfo(again.requests), ["commit", "folders", "batch 2"]);
  assert.equal(again.main(), first.main(), "the same page");
  // A file whose blob changed is shown with its new text, from the same batch: a status is told by the names of the records alone.
  const edited = { ...repo, [UC1]: repo[UC1].replaceAll("Read a file", "Read one file") };
  const srv = await server(edited);
  const third = await openDashboard({ server: srv, caches });
  assert.deepEqual(withoutInfo(third.requests), ["commit", "folders", "batch 2"]);
  assert.deepEqual(srv.batches.map(sorted), [sorted([UC1, UC2])]);
  assert.match(third.main(), /Read one file/);
});

test("without Cache Storage the page still works; it sends the same requests", async () => {
  const repo = await product();
  const first = await openDashboard({ server: await server(repo), caches: null });
  const again = await openDashboard({ server: await server(repo), caches: null });
  assert.deepEqual(again.requests, first.requests);
  assert.match(again.main(), /UC-002/);
});

// ---------------------------------------------------------------- the record decides where it is read

// TST-1429027 · level: component · module: MOD-site-frame
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: UC-001 with its record, and UC-002 whose only record names an earlier text
// input: open #uc/UC-001 and #uc/UC-002 with a token
// expect: UC-001 accepted, with no Accept; UC-002 changed since acceptance, with Accept — a file is accepted exactly when a record names its current blob
test("TST-1429027: a use case is accepted exactly when a record names its current text", async () => {
  const repo = await product();
  const honest = await openDashboard({ server: await server(repo), hash: "#uc/UC-001" });
  assert.match(honest.main(), /<span class="badge b-accepted">accepted<\/span>/);
  assert.doesNotMatch(honest.main(), /<button class="btn accept"/);
  const changed = await openDashboard({ server: await server(repo), hash: "#uc/UC-002" });
  assert.match(changed.main(), /<span class="badge b-changed">changed since acceptance<\/span>/);
  assert.match(changed.main(), /<button class="btn accept" type="button">Accept<\/button>/);
});
