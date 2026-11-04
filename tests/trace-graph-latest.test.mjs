// MOD-trace-graph's latestGraph, as docs/architecture/MOD-trace-graph.md states it: "the graph stored for `commit`, as `storedGraph` gives it; while
// that is not stored yet, the graph stored last, of the commit `latest.json` on the branch `trace-cache` names, with the one line a page shows above
// what it draws from it, naming both commits … It never builds the graph and reads no other file; where neither is stored it rejects with the
// `GraphNotStored` of `commit`."
// Run: node --test tests/trace-graph-latest.test.mjs
//
// Module: MOD-trace-graph
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TRACEABILITY MATRIX IS DERIVED
// Level: unit
//
// Deterministic, nothing reaches the network: the TextSource is built here over a small repository — SPEC.md with one requirement and a use case that
// realises it — and its `read`, `readMany` and `readOn` record their calls; `readOn` answers from a map of the branch trace-cache this file gives. Each
// test asks for commits of its own, since storedGraph keeps a commit's graph for the page. Each test states its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { graphText, latestGraph, traceGraph } from "../src/trace-graph/index.mjs";
import { gzipped } from "../src/trace-graph/stored.mjs";

const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
};
const commitOf = (digit) => digit.repeat(40);

// The bytes publishGraph stores for `commit`: the graph built from FILES, its graphText gzipped.
const storedBytes = async (commit) => gzipped(graphText(await traceGraph({ paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null }, { commit })));

// A TextSource over FILES whose readOn answers the branch trace-cache from `branch` (path -> text or bytes); every call is recorded.
function source(branch) {
  const calls = { read: [], readMany: [], readOn: [] };
  return { calls, source: {
    paths: Object.keys(FILES),
    async read(path) { calls.read.push(path); return FILES[path] ?? null; },
    async readMany(paths) { calls.readMany.push(paths); },
    async readOn(name, path, options) { calls.readOn.push([name, path]); return name === "trace-cache" && Object.hasOwn(branch, path) ? branch[path] : null; },
  } };
}
const notStored = (commit) => (error) => error.name === "GraphNotStored" && error.message.includes(`the trace graph of ${commit.slice(0, 12)} is not stored yet`);

// TST-1302012 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: trace-cache holding the graph of the head commit and a latest.json naming another commit whose graph it also holds
// input: latestGraph(source, head)
// expect: the head's graph (its commit the head's, the use case among its nodes) and no line; readOn asked only for "<head>.json.gz" — latest.json is not read; no read, no readMany
test("latestGraph gives the head's graph where it is stored, with no line, and reads nothing more", async () => {
  const head = commitOf("1"), earlier = commitOf("2");
  const { source: given, calls } = source({ [`${head}.json.gz`]: await storedBytes(head), [`${earlier}.json.gz`]: await storedBytes(earlier), "latest.json": `{"commit":"${earlier}"}\n` });
  const { graph, line } = await latestGraph(given, head);
  assert.equal(graph.commit, head);
  assert.ok(graph.nodes.has("UC-001"), "known positive: the stored graph was read");
  assert.equal(line, null);
  assert.deepEqual(calls.readOn, [["trace-cache", `${head}.json.gz`]]);
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});

// TST-1302013 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: trace-cache holding no graph of the head, and latest.json naming an earlier commit whose graph it holds
// input: latestGraph(source, head)
// expect: the earlier commit's graph; the line "As of <earlier, 7 characters>: the trace graph of the newest commit, <head, 7 characters>, is being stored."; readOn asked for "<head>.json.gz", "latest.json" and "<earlier>.json.gz", in that order; no read, no readMany — no graph is built
test("latestGraph gives the graph stored last, with the line naming both commits, while the head's is not stored", async () => {
  const head = commitOf("3"), earlier = commitOf("4");
  const { source: given, calls } = source({ [`${earlier}.json.gz`]: await storedBytes(earlier), "latest.json": `{"commit":"${earlier}"}\n` });
  const { graph, line } = await latestGraph(given, head);
  assert.equal(graph.commit, earlier);
  assert.ok(graph.nodes.has("UC-001"), "known positive: the stored graph was read");
  assert.equal(line, `As of ${earlier.slice(0, 7)}: the trace graph of the newest commit, ${head.slice(0, 7)}, is being stored.`);
  assert.deepEqual(calls.readOn, [["trace-cache", `${head}.json.gz`], ["trace-cache", "latest.json"], ["trace-cache", `${earlier}.json.gz`]]);
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});

// TST-1302014 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: trace-cache holding no graph of the head and (a) no latest.json; (b) a latest.json naming a commit whose graph it does not hold; (c) a latest.json that is no JSON; (d) a latest.json naming no commit; and (e) a source without readOn
// input: latestGraph(source, head) for each, a head of its own
// expect: each rejects with GraphNotStored whose message is storedGraph's for the head ("the trace graph of <head> is not stored yet"); no read and no readMany — no graph is built
test("latestGraph rejects with the head's GraphNotStored where neither graph is stored", async () => {
  const missing = commitOf("6");
  const cases = { "no latest.json": {}, "latest names a commit not stored": { "latest.json": `{"commit":"${missing}"}\n` }, "no JSON": { "latest.json": "not json" },
    "no commit": { "latest.json": "{\"commit\":\"main\"}\n" } };
  let digit = 7;
  for (const [name, branch] of Object.entries(cases)) {
    const head = `${digit++}`.repeat(40).slice(0, 40);
    const { source: given, calls } = source(branch);
    await assert.rejects(latestGraph(given, head), notStored(head), name);
    assert.deepEqual([calls.read, calls.readMany], [[], []], `${name}: no graph is built`);
  }
  const head = commitOf("a");
  const { source: bare, calls } = source({});
  delete bare.readOn;
  await assert.rejects(latestGraph(bare, head), notStored(head), "no readOn");
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});
