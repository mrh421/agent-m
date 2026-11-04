// ITM-1271 — MOD-review-pages reads the record of the job that wrote the file it shows, as docs/architecture/MOD-review-pages.md states it: "beside an open file a job
// wrote, the notes of that job's end record" (`<k>/<id>`), "the rounds of the job that drafted them" (`<k>/all`), and, among its Uses, "MOD-job-ledger.recordsNewestFirst — the record of
// the job that drafted a file, with its rounds, read newest first and no further than that record"; with UC-007 steps 4a and 4b and UC-022 step 8, and the SPEC's A PAGE LOAD READS THE
// REPOSITORY IN BATCHES. The records of a product are 300; the page of an open use case written by the third-newest job reads the records down to that job, and #decision/all, with a
// drafting job of the architecture among the ten newest, reads the first batch of the hundred newest only.
// Run: node --test tests/review-pages-job-notes-one-record.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-007; UC-022
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged; the repository is a Host of the tests' own over one repository in memory, every read of a path under
// docs/jobs/ counted (`read`, and each batch a `readMany` is given); the job records are written with MOD-job-ledger's own startRecord and appendToRecord. Readings the texts leave open,
// which the cases state:
//   - "the job that wrote the file" is read as the job whose end record lists `file <path>` for the path of the file shown (what MOD-runtimes' end writes for the files a writer committed).
//     A file that no end lists is looked for through all records, and shows the notes of every end that name it, as before.
//   - "reads the records down to that job" and A PAGE LOAD READS THE REPOSITORY IN BATCHES ("the texts of the files it shows in requests of at most 100 files each") are read together: the records are asked for newest
//     first in batches (`readMany`) of at most 100, and the search stops after the batch that holds the job's record. No record of a later batch is asked for. "Reads no record older than it" and "at most ten" are
//     read at that granularity: the batch of the hundred newest records holds the job.
//   - The job that drafted the architecture is read as the newest record of kind derive-architecture that has an end, as the page reads it now.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const kept = new Map();
globalThis.localStorage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); },
  removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const routeOf = (name) => pages.view?.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---", `# ${id} ${title}`, "",
  "**Goal.** The member borrows a book.");
const UC1_PATH = "docs/use-cases/UC-001-borrow-a-book.md";
const DECISION = text("---", "id: ARC-001", "title: Lending as a whole", "forced_by:", `  - ${RULE}`, "---", "# ARC-001 Lending as a whole", "", "## Context", "", "Books are lent at a desk.",
  "", "## Decision", "", "One module.", "", "## Alternatives", "", "Two modules.", "", "## Consequences", "", "One folder.");
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1_PATH]: useCase("UC-001", "Borrow a book"), "docs/architecture/ARC-001-lending.md": DECISION };

// ---------------------------------------------------------------- 300 job records

const COUNT = 300;
const jobId = (n) => `JOB-20261020-${new Date(Date.UTC(2026, 9, 20, 0, n)).toISOString().slice(11, 16).replace(":", "")}-${n.toString(16).padStart(4, "0")}`;
const FINDING = { artifact: "ARC-001", line: 3, kind: "warning", rule: "A MODULE IS CHECKED AGAINST ITS SUBSYSTEM", what: "ARC-001 names no way to return a book", fix: "name it" };
// The record of job `n`, 0 the oldest: of `kind`, ended with `results` and, for the drafting of the architecture, one round.
function record(n, kind, results) {
  const started = startRecord({ id: jobId(n), kind, worksOn: [RULE], participant: "drafter-a", model: "example-model", route: "tab", run: null, retries: null, startedBy: "alice",
    start: new Date(Date.UTC(2026, 9, 20, 0, n)), agentM: { version: "2026.10.0", commit: "abc123def456" }, inputs: [], limit: 5, task: "in parameters", conversation: null,
    destinations: [], params: {} });
  const rounds = kind === "derive-architecture" ? [{ number: 1, findings: [FINDING], answers: [{ finding: FINDING, how: "fixed", text: null }], changed: true }] : [];
  return [started.path, appendToRecord(started.text, { part: "end", at: new Date(Date.UTC(2026, 9, 20, 0, n + 1)), state: "done", results, draft: null, rounds,
    ...(rounds.length ? { stoppedBecause: "passed" } : {}), usage: null, cost: { known: false, usage: null }, reason: null, log: null })];
};
const NEWEST_NOTE = "UC-001 realises no requirement", OLDER_NOTE = "UC-001 realised GONE which matches no requirement; removed";
// Three job records of 300 write the use case: the third-newest (299 - 2) with NEWEST_NOTE, the one at 100 with OLDER_NOTE. The architecture was drafted by the job `archAt`.
function jobs({ archAt = null } = {}) {
  const found = {};
  for (let n = 0; n < COUNT; n++) {
    const [path, body] = n === COUNT - 3 ? record(n, "derive-use-cases", ["commit c0ffee1", `file ${UC1_PATH}`, `note: ${NEWEST_NOTE}`, "note: UC-002 realises no requirement"])
      : n === 100 ? record(n, "derive-use-cases", ["commit c0ffee0", `file ${UC1_PATH}`, `note: ${OLDER_NOTE}`])
      : n === archAt ? record(n, "derive-architecture", ["waits for a person"])
      : record(n, "derive-use-cases", ["no change"]);
    found[path] = body;
  }
  return found;
}

// ---------------------------------------------------------------- the fake host

const isJob = (path) => /^docs\/jobs\/JOB-/.test(path);
let commitsMade = 0;
function fakeHost(files) {
  const tree = new Map(Object.entries(files));
  const sha = createHash("sha1").update(`commit of the file's ${++commitsMade}`).digest("hex");
  const readJobs = new Set(), batches = [];
  const snapshot = withStoredGraph({ repository: ON_GITHUB, ref: "main", commit: sha, paths: [...tree.keys()].sort(),
    read: async (path) => { if (isJob(path)) readJobs.add(path); return tree.has(path) ? tree.get(path) : null; },
    readMany: async (paths) => { const named = paths.filter(isJob); if (named.length) batches.push(named); for (const path of named) readJobs.add(path); },
    blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  return {
    readJobs: () => [...readJobs].sort(),
    batches: () => batches.map((each) => [...each]),
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot() { return snapshot; },
      async readHistory() { return []; },
      async commitFiles() { throw new Error("nothing is written"); },
    },
  };
}

async function show(fake, name, params) {
  const route = routeOf(name);
  assert.ok(route, `the route ${name}: ${pages.error?.message}`);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
// The paths of the job records, newest first: the first `n` of them are the `n` newest.
const newest = (all, n) => Object.keys(all).filter(isJob).sort().reverse().slice(0, n);

// ---------------------------------------------------------------- the page of one use case

// TST-1271001 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-007
// given: a product with 300 job records, the use case UC-001 open, written by the third-newest job — whose end lists the file and a note naming UC-001 and one naming UC-002 — and a job at 100 that wrote it earlier, with a note of its own
// input: the route use-case rendered with the id UC-001
// expect: the notes section holds the third-newest job's note on UC-001, and no note of the older job, none naming UC-002 (known positive: the notes are shown); the job records are asked for in one batch holding the hundred newest, and no record outside it is read
test("MOD-review-pages use-case/<id> — the notes of the job that wrote the file, read in a batch of the newest records", async () => {
  const all = jobs();
  const fake = fakeHost({ ...FILES, ...all });
  const target = await show(fake, "use-case", { id: "UC-001" });
  const notes = byClass(target, "section", "job-notes");
  assert.equal(notes.length, 1, "known positive: the notes of the job are shown");
  assert.match(notes[0].textContent, /UC-001 realises no requirement/);
  assert.ok(!notes[0].textContent.includes("GONE"), "the note of an older job naming the same use case is not shown");
  assert.ok(!notes[0].textContent.includes("UC-002"), "a note naming another file is not shown");
  const read = fake.readJobs();
  assert.ok(read.length >= 1, "known positive: the counting fake counts reads");
  assert.deepEqual(fake.batches().map((each) => [...each].sort()), [newest(all, 100).sort()], "one batch, the hundred newest records");
  assert.deepEqual(read.filter((path) => !newest(all, 100).includes(path)), [], `no job record outside the hundred newest is read; ${read.length} were`);
});

// TST-1271002 · level: unit · module: MOD-review-pages
// guards: UC-007
// given: a product with 300 job records, of which no end lists the file UC-001, two ends holding a note that names it
// input: the route use-case rendered with the id UC-001
// expect: the notes of both ends that name UC-001, the newest job's first; a file that no job wrote is looked for through all 300 records, asked for newest first in batches of 100, none above 100
test("MOD-review-pages use-case/<id> — a file no job wrote is looked for through all records", async () => {
  const written = jobs();
  assert.ok(Object.values(written).some((body) => body.includes(`file ${UC1_PATH}`)), "known positive: the records list the file before it is taken out");
  const all = Object.fromEntries(Object.entries(written).map(([path, body]) => [path, body.replaceAll(`, file ${UC1_PATH}`, "")]));
  assert.ok(!Object.values(all).some((body) => body.includes(`file ${UC1_PATH}`)), "and no record lists it after");
  const fake = fakeHost({ ...FILES, ...all });
  const target = await show(fake, "use-case", { id: "UC-001" });
  const notes = byClass(target, "section", "job-notes");
  assert.equal(notes.length, 1);
  const items = find(notes[0], (node) => node.localName === "li").map((node) => node.textContent);
  assert.deepEqual(items, [NEWEST_NOTE, OLDER_NOTE]);
  assert.equal(fake.readJobs().length, COUNT, "all records were looked through");
  assert.deepEqual(fake.batches().map((each) => each.length), [100, 100, 100], "in batches of a hundred");
  assert.deepEqual(fake.batches().flat(), newest(all, COUNT), "each record once, newest first");
});

// ---------------------------------------------------------------- the review page of the architecture

// TST-1271003 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-022
// given: a product with 300 job records, the job that drafted the architecture the 8th newest, with one round, and a token
// input: the route decision rendered with the id all
// expect: the rounds section shows the round of that job (known positive: it holds the finding's text); the job records read are among the hundred newest, asked for in one batch
test("MOD-review-pages decision/all — the rounds of the drafting job, read in a batch of the newest records", async () => {
  const all = jobs({ archAt: COUNT - 8 });
  const fake = fakeHost({ ...FILES, ...all });
  const target = await show(fake, "decision", { id: "all" });
  const rounds = byClass(target, "section", "rounds");
  assert.equal(rounds.length, 1, "known positive: the rounds are shown");
  assert.match(rounds[0].textContent, /ARC-001 names no way to return a book/);
  const read = fake.readJobs();
  assert.ok(read.length >= 1 && read.length <= 100, `at most a hundred job records are read; ${read.length} were`);
  assert.deepEqual(read.filter((path) => !newest(all, 100).includes(path)), [], "and all among the hundred newest");
  assert.deepEqual(fake.batches().map((each) => [...each].sort()), [newest(all, 100).sort()], "in one batch");
});
