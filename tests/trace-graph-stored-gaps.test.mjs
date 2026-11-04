// MOD-trace-graph's `<commit>.gaps.json` and storedGaps, as docs/architecture/MOD-trace-graph.md states them: publishGraph adds `<commit>.gaps.json`, the
// graph's coverageGaps, beside `<commit>.json.gz`; "storedGaps(source, commit) — coverageGaps of the graph stored for `commit`, as publishGraph stored them
// beside it, read with the source's `readOn` in one request; null without `readOn`, or when the branch or the file is missing or holds another format."
// Run: node --test tests/trace-graph-stored-gaps.test.mjs
//
// Module: MOD-trace-graph
// Guards: THE TRACEABILITY MATRIX IS DERIVED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, nothing reaches the network: the host is a fake with readSnapshot and commitFiles holding the branch trace-cache in memory; the
// snapshot is a small repository in which one requirement is realised by a use case and one is not. Each test states its expected results.

import test from "node:test";
import assert from "node:assert/strict";
import * as trace from "../src/trace-graph/index.mjs";

const COMMIT = "abcdef00abcdef00abcdef00abcdef00abcdef00";
const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n\n"
    + "**ANOTHER THING WAITS** *(Product Owner)*\n\nIt waits.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
};
const snapshot = { commit: COMMIT, paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null, readMany: async () => {}, blob: () => null };

function fakeHost() {
  const held = {};
  return { held, host: {
    async readSnapshot() { return { commit: "1".repeat(40), paths: Object.keys(held), read: async (path) => held[path] ?? null, readMany: async () => {}, blob: () => null }; },
    async commitFiles(change) { for (const file of change.files) held[file.path] = file.bytes ?? file.text; return { commit: "2".repeat(40) }; },
  } };
}
// A source that reads the branch's files by readOn, counting each read.
const sourceOver = (held) => {
  const reads = [];
  return { reads, readOn: async (branch, path) => { reads.push([branch, path]); return held[path] ?? null; } };
};

// TST-1399001 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake host whose trace-cache holds nothing; the small repository at abcdef…, in which ANOTHER THING WAITS is realised by no use case
// input: publishGraph(host, snapshot), then storedGaps over the branch's files for abcdef…
// expect: the commit adds abcdef….gaps.json beside abcdef….json.gz; storedGaps gives coverageGaps of the graph built from the files — requirementsWithoutUseCase ["ANOTHER THING WAITS"] —, in one read of trace-cache:abcdef….gaps.json and no read of the graph
test("publishGraph stores the graph's coverage gaps beside it, and storedGaps reads them in one request without the graph", async () => {
  const { host, held } = fakeHost();
  await trace.publishGraph(host, snapshot);
  assert.ok(`${COMMIT}.json.gz` in held && `${COMMIT}.gaps.json` in held, Object.keys(held).join(", "));
  const built = await trace.traceGraph({ paths: snapshot.paths, read: snapshot.read }, { commit: COMMIT });
  const source = sourceOver(held);
  const gaps = await trace.storedGaps(source, COMMIT);
  assert.deepEqual(gaps, trace.coverageGaps(built));
  assert.deepEqual(gaps.requirementsWithoutUseCase, ["ANOTHER THING WAITS"]);
  assert.deepEqual(source.reads, [["trace-cache", `${COMMIT}.gaps.json`]]);
});

// TST-1399002 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: the gaps file of TST-1399001
// input: storedGaps for another commit; over a source whose file holds another format, or no JSON; over a source without readOn
// expect: null each time, never gaps of another commit; counter-proof: the same source gives the gaps for abcdef…
test("storedGaps gives null for another commit, another format and a source without readOn", async () => {
  const { host, held } = fakeHost();
  await trace.publishGraph(host, snapshot);
  assert.notEqual(await trace.storedGaps(sourceOver(held), COMMIT), null, "known positive");
  assert.equal(await trace.storedGaps(sourceOver({ [`${"9".repeat(40)}.gaps.json`]: held[`${COMMIT}.gaps.json`] }), "9".repeat(40)), null);
  assert.equal(await trace.storedGaps(sourceOver({ [`${COMMIT}.gaps.json`]: '{"format":"other"}' }), COMMIT), null);
  assert.equal(await trace.storedGaps(sourceOver({ [`${COMMIT}.gaps.json`]: "not json" }), COMMIT), null);
  assert.equal(await trace.storedGaps({}, COMMIT), null);
});
