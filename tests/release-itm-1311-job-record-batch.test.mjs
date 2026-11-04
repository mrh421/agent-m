// Release tests of ITM-1311 — A PAGE LOAD READS THE REPOSITORY IN BATCHES on the review pages that show a job's records: the page of an open use case (the notes of the job that wrote it, UC-007) and the review page of the whole
// architecture (the rounds of the job that drafted it, UC-022). The behaviour is the SPEC's: "With a token on GitHub, one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it shows
// in requests of at most 100 files each; a file whose blob the page has read already is not read again", and MOD-review-pages' (Interfaces: "beside an open file a job wrote, the notes of that job's end record"; `<k>/all`: "the
// rounds of the job that drafted them") and MOD-job-ledger's (`listJobs`: "The records of each snapshot are named to its `readMany` first, so that they are read in batches").
// Run: node --test tests/release-itm-1311-job-record-batch.test.mjs
//
// Module: MOD-review-pages; MOD-job-ledger; MOD-repository-hosts
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-007; UC-008; UC-022
// Level: release
//
// Written for the release testing of sprint 118 by a participant who implemented none of ITM-1311 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The pages are the real app (src/site-frame/dashboard-app.mjs) loaded by
// tests/app-harness.mjs over its counting fake GitHub, which serves GitHub's batch request and records every request by what it reads (`batch <n>`, `file <path>`) and the paths each batch names (`batches`); the host is the real
// MOD-repository-hosts with a token. The job records are written by the real MOD-job-ledger (startRecord, appendToRecord). The component test of the item (tests/review-pages-use-cases.test.mjs, TST-680211) counts the calls of a fake
// snapshot's `readMany`; these cases count the requests that leave the page. Readings the texts leave open, which the cases state:
//   - "reads those job records in exactly one batch request" is read as: one request of GitHub's batch query whose paths are every job record of the product and nothing else, and no file under docs/jobs/ read by its own request.
//   - "the notes shown are unchanged" is read as the notes of the pre-existing behaviour: the `note: ` lines of the end records of the jobs that name the file, newest job first, each in the order the record holds them, and no note that names another file.
//   - "batches of at most 100" is read as: no request of the batch query names more than 100 paths, and together the requests name every record once.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blobSha, finding } from "../src/text-tools/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { repoServer, openDashboard } from "./app-harness.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";

// ---------------------------------------------------------------- the product: tests/fixtures/architecture, with job records

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path); else base[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8");
  }
})(FIX);
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";
const ARCHITECTURE = ["docs/architecture/ARC-001-static-client.md", "docs/architecture/MOD-page.md", "docs/architecture/MOD-reader.md", "docs/architecture/MOD-review.md"];

// The path and the text of the job record number `n`: a job of `kind` started `n` minutes after midnight of 2026-10-20, ended with `results` and `rounds` where it is given.
const jobIdOf = (n) => `JOB-20261020-${new Date(Date.UTC(2026, 9, 20, 0, n)).toISOString().slice(11, 16).replace(":", "")}-${n.toString(16).padStart(4, "0")}`;
function jobRecord(n, kind, worksOn, ended = null) {
  const { path, text } = startRecord({ id: jobIdOf(n), kind, worksOn, participant: "drafter-a", model: "example-model", route: "tab", run: null, retries: null, startedBy: "alice",
    start: new Date(Date.UTC(2026, 9, 20, 0, n)), agentM: { version: "2026.10.0", commit: "abc123def456" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
  if (ended === null) return [path, text];
  return [path, appendToRecord(text, { part: "end", at: new Date(Date.UTC(2026, 9, 20, 0, n + 5)), state: "done", results: ended.results, draft: null, rounds: ended.rounds ?? [],
    ...(ended.rounds ? { stoppedBecause: "passed" } : {}), usage: null, cost: { known: false, usage: null }, reason: null, log: null })];
}
const NOTE_ONE = "UC-001 realises no requirement", NOTE_TWO = "UC-001 realised GONE which matches no requirement; removed", NOTE_OTHER = "UC-002 realises no requirement";
// Three jobs of the use cases: the oldest ended with a note on UC-001, the newest ended with a note on UC-002 and one on UC-001, and one still queued.
const noteJobs = () => Object.fromEntries([
  jobRecord(10, "derive-use-cases", ["EXPORT IS A PDF"], { results: ["c0ffee1", `note: ${NOTE_ONE}`] }),
  jobRecord(30, "derive-use-cases", ["EXPORT IS A PDF"], { results: ["c0ffee2", `note: ${NOTE_OTHER}`, `note: ${NOTE_TWO}`] }),
  jobRecord(50, "derive-use-cases", ["EXPORT IS A PDF"]),
]);
const withJobs = (jobs, over = {}) => ({ ...base, ...jobs, ...over });
const server = (files) => repoServer({ files, history: [] });

// What the page sent: the requests that read a file by its own request, and those that read job records so.
const singleReads = (requests) => requests.filter((r) => r.startsWith("file ")).map((r) => r.slice(5));
const jobReads = (requests) => singleReads(requests).filter((path) => path.startsWith("docs/jobs/"));
const sorted = (list) => [...list].sort();
// The notes the page shows beside a file: the items of its section "Notes of the job that wrote it", in the order shown.
const notesOf = (html) => {
  const section = /<section class="job-notes"><h3>Notes of the job that wrote it<\/h3><ul>(.*?)<\/ul><\/section>/s.exec(html);
  return section ? [...section[1].matchAll(/<li>(.*?)<\/li>/gs)].map((item) => item[1]) : null;
};

// TST-1311301 · level: release · module: MOD-review-pages, MOD-job-ledger, MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-008
// given: a GitHub product with a token whose `main` holds the open use cases UC-001 and UC-002 and three job records under docs/jobs/
// input: the page of UC-001 opened (#use-case/id=UC-001), with the dashboard's real host over the counting fake GitHub
// expect: the three job records are read by one request of GitHub's batch query whose paths are those three records and nothing else; no file under docs/jobs/ is read by its own request; the batch is the only batch of the load
// Planted fault: MOD-job-ledger's listJobs without its `readMany` call (src/job-ledger/index.mjs) reads each record by its own request, and the case fails on the absence of the batch.
test("TST-1311301 the page of an open use case reads its job records in one batch request and none by itself", async () => {
  const jobs = noteJobs();
  const srv = await server(withJobs(jobs));
  const page = await openDashboard({ server: srv, hash: "#use-case/id=UC-001" });
  assert.match(page.main(), /UC-001/, "known positive: the use case is shown");
  assert.deepEqual(srv.batches.map(sorted), [sorted(Object.keys(jobs))], "one batch, naming the three job records and nothing else");
  assert.deepEqual(page.requests.filter((r) => r.startsWith("batch ")), ["batch 3"]);
  assert.deepEqual(jobReads(page.requests), [], "no job record by its own request");
});

// TST-1311302 · level: release · module: MOD-review-pages, MOD-job-ledger
// guards: UC-007
// given: the product above, whose records are: the oldest job's end with the note on UC-001, the newer job's end with a note on UC-002 and then a note on UC-001, and a job not ended
// input: the page of UC-001 opened; and the page of UC-002 opened in another load
// expect: UC-001 shows the section "Notes of the job that wrote it" with exactly two notes, the newer job's first — the second job's note on UC-001, then the oldest job's — and not the note that names UC-002; UC-002 shows exactly its one note
// Planted fault: jobNotes keeping every note of the ended jobs, not those that name the file (`line.includes(id)` taken out of src/review-pages/jobs.mjs), shows the note on UC-002 beside UC-001, and the case fails on the notes listed.
test("TST-1311302 the notes shown beside an open use case are those of the jobs that name it, newest job first", async () => {
  const jobs = noteJobs();
  const one = await openDashboard({ server: await server(withJobs(jobs)), hash: "#use-case/id=UC-001" });
  assert.deepEqual(notesOf(one.main()), [NOTE_TWO, NOTE_ONE]);
  const two = await openDashboard({ server: await server(withJobs(jobs)), hash: "#use-case/id=UC-002" });
  assert.deepEqual(notesOf(two.main()), [NOTE_OTHER]);
});

// TST-1311303 · level: release · module: MOD-review-pages, MOD-job-ledger, MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-022
// given: the product above without its use-case jobs but with two job records: a derive-architecture job ended with two rounds — the first with one finding, the second with none — and a derive-use-cases job; the architecture's four files open
// input: the review page of the whole architecture opened (#decision/id=all)
// expect: the page shows the rounds of the derive-architecture job — "Round 1 — 1 finding" and "Round 2 — no finding"; its reads are two batches, one naming the four architecture files and one naming the two job records and nothing else; no file under docs/jobs/ is read by its own request
// Planted fault: draftingRounds handing listJobs a snapshot without `readMany` (src/review-pages/flow.mjs) reads each job record by its own request, and the case fails on the batch naming the job records.
test("TST-1311303 the review page of the whole architecture reads the job records of its rounds in one batch and none by itself", async () => {
  const round = finding({ artifact: "ARC-001", line: 4, kind: "error", rule: "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES", what: "no Consequences", fix: "add the section" });
  const jobs = Object.fromEntries([
    jobRecord(20, "derive-architecture", ["ARC-001"], { results: ["c0ffee3"], rounds: [{ number: 1, findings: [round], answers: [{ finding: round, how: "fixed", text: null }] }, { number: 2, findings: [], answers: [] }] }),
    jobRecord(40, "derive-use-cases", ["EXPORT IS A PDF"], { results: ["c0ffee4"] }),
  ]);
  const srv = await server(withJobs(jobs));
  const page = await openDashboard({ server: srv, hash: "#decision/id=all" });
  assert.match(page.main(), /Round 1 — 1 finding/, "known positive: the rounds are shown");
  assert.match(page.main(), /Round 2 — no finding/);
  assert.deepEqual(srv.batches.map(sorted), [sorted(ARCHITECTURE), sorted(Object.keys(jobs))], "the architecture's files in one batch, the job records in one");
  assert.deepEqual(jobReads(page.requests), [], "no job record by its own request");
});

// TST-1311304 · level: release · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-008
// given: the product above with its three job records, and a record that names the current text of UC-002, which is therefore accepted; UC-001 is open
// input: the page of UC-001 opened; and the page of UC-002 opened in another load
// expect: known positive first — UC-001's page sends the batch of the three job records; UC-002's page sends no batch, reads no file under docs/jobs/ by its own request, and shows no section of notes
// Planted fault: showOne asking for the job notes of an accepted file too (`file.status !== "accepted"` taken out of the condition for `jobNotes` in src/review-pages/flow.mjs) makes UC-002's page send the batch, and the case fails on it.
test("TST-1311304 the page of an accepted use case asks for no job record", async () => {
  const jobs = noteJobs();
  const blob = await blobSha(base[UC2]);
  const files = withJobs(jobs, { [approvalPath("UC-002", blob)]: recordText(reviewedRecord(UC2, blob)) });
  const open = await server(files);
  await openDashboard({ server: open, hash: "#use-case/id=UC-001" });
  assert.equal(open.batches.length, 1, "known positive: the open use case's page reads its job records in a batch");
  const accepted = await server(files);
  const page = await openDashboard({ server: accepted, hash: "#use-case/id=UC-002" });
  assert.match(page.main(), /accepted/, "the use case is shown accepted");
  assert.deepEqual(accepted.batches, [], "no batch");
  assert.deepEqual(jobReads(page.requests), [], "no job record by its own request");
  assert.equal(notesOf(page.main()), null, "no notes");
});

// TST-1311305 · level: release · module: MOD-review-pages, MOD-job-ledger, MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-008; UC-022
// given: the product above with 230 job records, each of a job ended with a note on UC-001
// input: the page of UC-001 opened; and the review page of the whole architecture opened in another load
// expect: on each page the job records are read by three requests of the batch query naming 100, 100 and 30 paths, which together name each of the 230 records once; the architecture's four files come in a batch of their own; no file under docs/jobs/ is read by its own request; UC-001 shows its 230 notes
// Planted fault: BATCH raised to 1000 (src/repository-hosts/github.mjs) sends the 230 records in one request, and the case fails on the sizes of the batches.
test("TST-1311305 more than a hundred job records are read in batches of at most 100", async () => {
  const jobs = Object.fromEntries(Array.from({ length: 230 }, (_, at) => jobRecord(at + 1, "derive-use-cases", ["EXPORT IS A PDF"], { results: [`note: ${NOTE_ONE} (${at + 1})`] })));
  const paths = sorted(Object.keys(jobs));
  const sizes = (srv) => srv.batches.filter((batch) => batch.some((path) => path.startsWith("docs/jobs/"))).map((batch) => batch.length);
  const named = (srv) => sorted(srv.batches.flat().filter((path) => path.startsWith("docs/jobs/")));

  const useCase = await server(withJobs(jobs));
  const one = await openDashboard({ server: useCase, hash: "#use-case/id=UC-001" });
  assert.deepEqual(sizes(useCase), [100, 100, 30]);
  assert.deepEqual(named(useCase), paths, "every record once");
  assert.deepEqual(jobReads(one.requests), [], "no job record by its own request");
  assert.equal(notesOf(one.main())?.length, 230, "known positive: the records were read");

  const architecture = await server(withJobs(jobs));
  const all = await openDashboard({ server: architecture, hash: "#decision/id=all" });
  assert.deepEqual(sizes(architecture), [100, 100, 30]);
  assert.deepEqual(named(architecture), paths, "every record once");
  assert.deepEqual(architecture.batches.filter((batch) => !batch.some((path) => path.startsWith("docs/jobs/"))).map(sorted), [sorted(ARCHITECTURE)], "the architecture's files in a batch of their own");
  assert.deepEqual(jobReads(all.requests), [], "no job record by its own request");
});
