// Waiting queues — MOD-progress-measures' waitingQueues, as docs/architecture/MOD-progress-measures.md states it: the change queues with an
// entry not in the SPEC yet are those of the overview stored for the commit (asOf null); while that is not stored, those of the overview
// stored last (asOf its commit); where the repository stores no overview, those MOD-spec-changes' queues derives from every queue. A commit's
// overview is read once however many snapshots of it ask. waitingForAcceptance takes its SPEC changes from waitingQueues.
// Run: node --test tests/progress-measures-waiting-queues.test.mjs
//
// Module: MOD-progress-measures
// Guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020; UC-047
// Level: unit
//
// The snapshots are held in memory with a counting readOn and read, as MOD-repository-hosts' Snapshot gives them: 66 queues, one of which waits.

import test from "node:test";
import assert from "node:assert/strict";
import { waitingQueues, waitingForAcceptance } from "../src/progress-measures/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";

const HEAD = "a".repeat(40);
const C0 = "b".repeat(40);
const SPEC_DIR = "docs/spec-freigaben/";
const WAITING = `${SPEC_DIR}2026-03-66_waiting`;
const noTags = { listTags: async () => [] };

// 65 queues whose one entry is in SPEC (a decision names its record) and the queue 66 whose one entry is open.
function repositoryFiles() {
  const texts = {};
  const blobs = {};
  const extra = [];
  for (let n = 1; n <= 66; n += 1) {
    const base = n === 66 ? WAITING : `${SPEC_DIR}2026-03-${String(n).padStart(2, "0")}_done`;
    const slug = base.slice(SPEC_DIR.length);
    texts[`${base}/index.md`] = ["# SPEC approvals — queue", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      "| 01 | `SPEC.md` | ## 1. Section | — | — |", ""].join("\n");
    const record = `docs/approvals/spec-${slug}-01-${"1".repeat(12)}.md`;
    texts[`${base}/entscheidungen.md`] = ["# Decisions", "", "Append-only.",
      ...(n === 66 ? [] : [`| 2026-03-01 10:00 UTC | 1 | uebernommen | approval:${record.slice("docs/approvals/".length)} |`]), ""].join("\n");
    blobs[`${base}/01-section.md`] = String(n).padStart(2, "0").repeat(20);
    if (n !== 66) extra.push(record);
  }
  return { texts, blobs, extra };
}

// A snapshot of HEAD with counting readOn and read; `branch` is what overview-cache holds (file -> text), null for a repository with no such branch.
function snapshotOf(files, branch, counts, repository = {}) {
  const paths = [...new Set([...Object.keys(files.blobs), ...Object.keys(files.texts), ...files.extra])];
  return {
    repository, commit: HEAD, paths, blob: (path) => files.blobs[path] ?? null,
    read: async (path) => { counts.reads.push(path); return Object.hasOwn(files.texts, path) ? files.texts[path] : null; },
    readOn: async (name, path) => {
      counts.requests.push([name, path]);
      if (branch === null) { const error = new Error("no such branch"); error.name = "NotFound"; throw error; }
      return branch[path] ?? null;
    },
  };
}

const overviewText = (commit, held) => JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: held });
const fresh = () => ({ reads: [], requests: [] });
const undecided = async (files) => (await queues(snapshotOf(files, null, fresh()))).filter((queue) => queue.entries.some((entry) => entry.state !== "in SPEC"));
const specChangeIds = (waiting) => waiting.filter((row) => row.kind === "SPEC change").map((row) => row.id);
const queueFilesRead = (counts) => counts.reads.filter((path) => path.startsWith(SPEC_DIR));

// TST-110272 · level: unit · module: MOD-progress-measures
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: 66 queues of which one waits; the overview stored for the head holds that one queue
// input: waitingQueues(snapshot)
// expect: that queue, asOf null, in one request (HEAD.json of overview-cache) and no read under docs/spec-freigaben/
test("waitingQueues — the head's stored overview gives the waiting queue in one request and no queue file is read", async () => {
  const files = repositoryFiles();
  const held = await undecided(files);
  assert.deepEqual(held.map((queue) => queue.folder), [WAITING]);
  const counts = fresh();
  const got = await waitingQueues(snapshotOf(files, { [`${HEAD}.json`]: overviewText(HEAD, held) }, counts));
  assert.deepEqual(got.queues.map((queue) => queue.folder), [WAITING]);
  assert.equal(got.asOf, null);
  assert.deepEqual(counts.requests, [["overview-cache", `${HEAD}.json`]]);
  assert.deepEqual(queueFilesRead(counts), []);
});

// TST-110273 · level: unit · module: MOD-progress-measures
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: 66 queues of which one waits; overview-cache holds only the overview of c0 and latest.json naming c0
// input: waitingQueues(snapshot of HEAD)
// expect: c0's queues and asOf c0; no queue file read; counter-proof: a waitingQueues that leaves out the overview stored last gives asOf null and reads the queue files, and fails
test("waitingQueues — while the head's overview is not stored, those stored last are given with their commit", async () => {
  const files = repositoryFiles();
  const held = await undecided(files);
  const counts = fresh();
  const got = await waitingQueues(snapshotOf(files, { [`${C0}.json`]: overviewText(C0, held), "latest.json": JSON.stringify({ commit: C0 }) }, counts));
  assert.deepEqual(got.queues.map((queue) => queue.folder), [WAITING]);
  assert.equal(got.asOf, C0);
  assert.deepEqual(queueFilesRead(counts), []);
});

// TST-110274 · level: unit · module: MOD-progress-measures
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: 66 queues of which one waits; the repository has no branch overview-cache
// input: waitingQueues(snapshot)
// expect: every queue as MOD-spec-changes' queues gives them (66, read from the files of docs/spec-freigaben/), asOf null
test("waitingQueues — where the repository stores no overview, every queue is read as queues reads them", async () => {
  const files = repositoryFiles();
  const counts = fresh();
  const got = await waitingQueues(snapshotOf(files, null, counts));
  assert.equal(got.queues.length, 66);
  assert.equal(got.asOf, null);
  assert.deepEqual(got.queues.map((queue) => queue.folder), (await queues(snapshotOf(files, null, fresh()))).map((queue) => queue.folder));
  assert.ok(queueFilesRead(counts).length >= 132);
});

// TST-110275 · level: unit · module: MOD-progress-measures
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; UC-047
// given: 66 queues of which one waits, in the three states of the repository: the head's overview stored, only c0's stored, no overview-cache
// input: waitingForAcceptance(host, snapshot) for each
// expect: the same SPEC change in all three (the entry of the waiting queue); with the head's overview, no file under docs/spec-freigaben/ is read; counter-proof: a waitingForAcceptance that reads every queue itself reads the 132 files with the head's overview stored, and fails
test("waitingForAcceptance — gives the same SPEC changes from the stored overview, the one stored last and every queue", async () => {
  const files = repositoryFiles();
  const held = await undecided(files);
  const expected = ["spec-2026-03-66_waiting-01"];
  const stored = fresh();
  assert.deepEqual(specChangeIds(await waitingForAcceptance(noTags, snapshotOf(files, { [`${HEAD}.json`]: overviewText(HEAD, held) }, stored))), expected);
  assert.deepEqual(queueFilesRead(stored), []);
  const last = { [`${C0}.json`]: overviewText(C0, held), "latest.json": JSON.stringify({ commit: C0 }) };
  assert.deepEqual(specChangeIds(await waitingForAcceptance(noTags, snapshotOf(files, last, fresh()))), expected);
  assert.deepEqual(specChangeIds(await waitingForAcceptance(noTags, snapshotOf(files, null, fresh()))), expected);
});

// TST-110276 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-020
// given: two snapshots of one commit of one repository, whose overview is stored
// input: waitingQueues of each
// expect: both give the queue; the file HEAD.json is requested once; counter-proof: a snapshot of another commit requests its own file
test("waitingQueues — two snapshots of one commit read its overview once", async () => {
  const files = repositoryFiles();
  const held = await undecided(files);
  const branch = { [`${HEAD}.json`]: overviewText(HEAD, held) };
  const counts = fresh();
  const repository = {};
  const first = await waitingQueues(snapshotOf(files, branch, counts, repository));
  const second = await waitingQueues(snapshotOf(files, branch, counts, repository));
  assert.deepEqual(second.queues.map((queue) => queue.folder), first.queues.map((queue) => queue.folder));
  assert.deepEqual(counts.requests, [["overview-cache", `${HEAD}.json`]]);
  await waitingQueues({ ...snapshotOf(files, branch, counts, repository), commit: C0 });
  assert.deepEqual(counts.requests[1], ["overview-cache", `${C0}.json`]);
});
