// MOD-job-ledger's listJobs reads a snapshot's records in batches (ITM-1280), as the accepted text of docs/architecture/MOD-job-ledger.md states it (Interfaces: `listJobs`): "The records of each
// snapshot are named to its `readMany` first, so that they are read in batches."
// Run: node --test tests/job-ledger-list-batched.test.mjs
//
// Module: MOD-job-ledger
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB
// Level: unit
//
// The snapshot is the real MOD-repository-hosts host's, connected with a token to the counting fake GitHub of tests/progress-measures-load.mjs, which serves the product's files and records every
// request by what it reads: a file by itself ("file") and many files in one request of the GraphQL API ("batch", with the paths it names). No request leaves the fake.
//
// Readings the texts leave open, which the test states (the pull request names them):
//   - "today's rows" are the rows listJobs gives over a snapshot that has no readMany — a plain snapshot of the same texts in memory, as tests/job-ledger.test.mjs gives it —, which reads each record by
//     itself.
//   - A batch holds at most a hundred files (MOD-repository-hosts, BATCH), so 250 records are three batches of 100, 100 and 50.

import test from "node:test";
import assert from "node:assert/strict";
import { listJobs } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { PRODUCT, TOKEN, githubServer, productFiles, summary } from "./progress-measures-load.mjs";

const ADDRESS = `https://github.com/${PRODUCT}`;

// TST-1280001 · level: unit · module: MOD-job-ledger
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB
// given: a product of 250 job records and a SPEC.md and a test file, served by the counting fake GitHub; the host connected with a token; the snapshot of its branch main
// input: listJobs([{ address, snapshot }], new Map()); the requests the fake recorded from the snapshot on
// expect: three batch requests, of 100, 100 and 50 files, every one of them a record under docs/jobs/, and no request for a file by itself; 250 rows, equal to the rows listJobs gives over a plain snapshot of the same texts without readMany (today's rows); counter-proof: the plain snapshot's reads are 250 reads of one file each
test("TST-1280001 listJobs names a snapshot's records to its readMany first: 250 records are three batches and no single read, and the rows are today's", async () => {
  const files = productFiles({ items: 0, jobs: 250 });
  const server = githubServer({ [PRODUCT]: files });
  server.install();
  try {
    const host = connect(parseAddress(ADDRESS), { token: TOKEN });
    const snapshot = await host.readSnapshot("main");
    server.log.length = 0;
    const rows = await listJobs([{ address: ADDRESS, snapshot }], new Map());
    const read = summary(server.log);
    assert.deepEqual(read.batches, [100, 100, 50], "three batches");
    assert.equal(read.allFiles.every((path) => path.startsWith("docs/jobs/")), true, "every file read is a record");
    assert.deepEqual(read.singles, [], "no record is read by itself");

    const plainReads = [];
    const plain = { paths: Object.keys(files), read: async (path) => { plainReads.push(path); return Object.hasOwn(files, path) ? files[path] : null; } };
    const today = await listJobs([{ address: ADDRESS, snapshot: plain }], new Map());
    assert.equal(plainReads.length, 250, "counter-proof: without readMany each record is read by itself");
    assert.equal(rows.length, 250);
    assert.deepEqual(rows, today, "the rows are today's");
  } finally {
    server.restore();
  }
});
