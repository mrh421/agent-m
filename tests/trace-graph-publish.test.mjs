// MOD-trace-graph's publishGraph (ITM-908), as the accepted text of docs/architecture/MOD-trace-graph.md states it: "publishGraph(host, snapshot,
// changed?) — builds the graph of the snapshot's commit from its files and adds `<commit>.json.gz`, its graphText gzipped, to the branch `trace-cache` by `commitFiles`, on the
// head it read; `written` is `false` when the branch holds the file already, which it then leaves as it is. … Crosses the network; fails as
// `commitFiles` fails, with `NotFound` naming the branch when the repository has none." The impact lists (`changed`) are ITM-941's and are not tested here.
// Run: node --test tests/trace-graph-publish.test.mjs
//
// Module: MOD-trace-graph
// Guards: THE TRACEABILITY MATRIX IS DERIVED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, nothing reaches the network: the host is a fake of MOD-repository-hosts' Host with readSnapshot and commitFiles, holding the
// branch trace-cache in memory; the snapshot is a small repository (SPEC.md, a use case, a module file, a backlog item and a code file) handed in.
// Each test states its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import * as trace from "../src/trace-graph/index.mjs";
import { gunzipped } from "../src/trace-graph/stored.mjs";

const COMMIT = "abcdef00abcdef00abcdef00abcdef00abcdef00";
const HEAD = "1111111111111111111111111111111111111111";
const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
  "docs/architecture/MOD-doer.md": "---\nid: MOD-doer\ntitle: The doer\nfolder: src/doer/\nrealises:\n  - A THING IS DONE\nprovides:\n  - doIt\n---\n# MOD-doer The doer\n",
  "docs/backlog/ITM-001-do-it.md": "---\nid: ITM-001\ntitle: Do it\nlevel: unit\nrealises:\n  - A THING IS DONE\nmodules:\n  - MOD-doer\ntests:\n  - unit\n---\n# ITM-001 Do it\n",
  "src/doer/index.mjs": "export const doIt = () => 1;\n",
};
const snapshot = { commit: COMMIT, paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null, readMany: async () => {}, blob: () => null };

// A fake host holding the branch trace-cache: `held` maps the files it has to their texts or bytes, as commitFiles was handed them. `missing`: the repository has no such branch.
// `moves`: the first commitFiles refuses with Moved (the branch moved on since it was read); the next one is made on a head read again.
function fakeHost({ held = {}, missing = false, moves = false } = {}) {
  const state = { held: { ...held }, head: HEAD, commits: [], reads: [], moves };
  return { state, host: {
    async readSnapshot(ref) {
      state.reads.push(ref);
      if (ref !== "trace-cache" || missing) throw Object.assign(new Error(`${ref} was not found`), { name: "NotFound" });
      return { commit: state.head, paths: Object.keys(state.held), read: async (path) => state.held[path] ?? null, readMany: async () => {}, blob: () => null };
    },
    async commitFiles(change) {
      state.commits.push(change);
      if (state.moves) { state.moves = false; throw Object.assign(new Error("trace-cache has moved on"), { name: "Moved" }); } // once: the next read finds the new head
      if (change.expectedHead !== state.head) throw Object.assign(new Error("trace-cache has moved on"), { name: "Moved" });
      for (const file of change.files) state.held[file.path] = file.bytes ?? file.text;
      state.head = "2222222222222222222222222222222222222222";
      return { commit: state.head, url: "https://example.test/commit" };
    },
  } };
}

// TST-908001 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake host whose branch trace-cache stands at 1111… and holds no file of the commit; a snapshot of the small repository at abcdef…
// input: publishGraph(host, snapshot)
// expect: { commit: "abcdef…", written: true }; one commitFiles on branch "trace-cache" with expectedHead "1111…" and the file "abcdef….json.gz" whose bytes (a Uint8Array, no text) gunzip to graphText of the graph built from the files, which graphFromText restores for that commit, and "latest.json" beside it (TST-1302015); a message that names the commit
test("publishGraph adds the graph of the commit to the head of trace-cache it read", async () => {
  const { host, state } = fakeHost();
  const built = await trace.traceGraph({ paths: snapshot.paths, read: snapshot.read }, { commit: COMMIT });
  assert.deepEqual(await trace.publishGraph(host, snapshot), { commit: COMMIT, written: true });
  assert.equal(state.commits.length, 1);
  const [change] = state.commits;
  assert.deepEqual([change.branch, change.expectedHead, change.files.map((file) => file.path)], ["trace-cache", HEAD, [`${COMMIT}.json.gz`, `${COMMIT}.gaps.json`, `${COMMIT}.references.json.gz`, "latest.json"]]);
  assert.equal(change.files[0].bytes instanceof Uint8Array, true, "the file is written as bytes");
  assert.equal(change.files[0].text, undefined);
  const text = await gunzipped(change.files[0].bytes);
  assert.equal(text, trace.graphText(built));
  assert.deepEqual(trace.graphFromText(text, COMMIT), built);
  assert.equal(change.message.includes(COMMIT), true, change.message);
});

// TST-908002 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: a fake host whose branch trace-cache already holds abcdef….json.gz, with a text of its own that is not the graph's
// input: publishGraph(host, snapshot); then, as the counter-proof, the same on a branch that does not hold the file
// expect: { commit, written: false } and no commitFiles — the file as it was, byte for byte; the counter-proof writes ({ written: true }) and the file then holds the graph
test("publishGraph leaves a file the branch holds as it is", async () => {
  const mine = '{"left":"alone"}\n';
  const there = fakeHost({ held: { [`${COMMIT}.json.gz`]: mine } });
  assert.deepEqual(await trace.publishGraph(there.host, snapshot), { commit: COMMIT, written: false });
  assert.deepEqual([there.state.commits.length, there.state.held[`${COMMIT}.json.gz`]], [0, mine]);
  const empty = fakeHost();
  assert.deepEqual(await trace.publishGraph(empty.host, snapshot), { commit: COMMIT, written: true });
  assert.equal(empty.state.held[`${COMMIT}.json.gz`] instanceof Uint8Array, true, "the counter-proof writes the gzipped graph");
});

// TST-908003 · level: unit · module: MOD-trace-graph
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a fake host whose commitFiles refuses with Moved the first time (the branch moved on after it was read)
// input: publishGraph(host, snapshot); then the same call again
// expect: the first call rejects with a failure named Moved and writes nothing; the second reads the branch again and succeeds ({ written: true }), the run being made again
test("publishGraph ends in Moved when the branch moved meanwhile, and can be run again", async () => {
  const { host, state } = fakeHost({ moves: true });
  await assert.rejects(trace.publishGraph(host, snapshot), { name: "Moved" });
  assert.deepEqual(state.held, {});
  assert.deepEqual(await trace.publishGraph(host, snapshot), { commit: COMMIT, written: true });
  assert.deepEqual(Object.keys(state.held), [`${COMMIT}.json.gz`, `${COMMIT}.gaps.json`, `${COMMIT}.references.json.gz`, "latest.json"]);
});

// TST-908004 · level: unit · module: MOD-trace-graph
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a fake host whose repository has no branch trace-cache
// input: publishGraph(host, snapshot)
// expect: a rejection named NotFound whose message names "trace-cache"; no commitFiles
test("publishGraph fails with NotFound naming the branch when the repository has none", async () => {
  const { host, state } = fakeHost({ missing: true });
  await assert.rejects(trace.publishGraph(host, snapshot), (error) => error.name === "NotFound" && /trace-cache/.test(error.message));
  assert.equal(state.commits.length, 0);
});

// TST-1302015 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: (a) a fake host whose branch trace-cache holds a latest.json naming another commit and no file of abcdef…; (b) a branch that holds abcdef….json.gz already and the same latest.json
// input: publishGraph(host, snapshot) on each
// expect: (a) the one commitFiles adds "abcdef….json.gz" and writes "latest.json" as the text {"commit":"abcdef…"} and a line end, in the same commit; (b) no commitFiles: latest.json still names the other commit — a graph that is not added does not move latest.json (the counter-proof of (a))
test("publishGraph writes latest.json naming the commit in the commit that adds its graph, and leaves it where it adds nothing", async () => {
  const other = '{"commit":"9999999999999999999999999999999999999999"}\n';
  const adding = fakeHost({ held: { "latest.json": other } });
  assert.deepEqual(await trace.publishGraph(adding.host, snapshot), { commit: COMMIT, written: true });
  assert.equal(adding.state.commits.length, 1);
  const files = adding.state.commits[0].files;
  assert.ok(files.some((file) => file.path === `${COMMIT}.json.gz`), "known positive: the graph is added in that commit");
  assert.equal(files.find((file) => file.path === "latest.json")?.text, `{"commit":"${COMMIT}"}\n`);
  assert.equal(JSON.parse(adding.state.held["latest.json"]).commit, COMMIT);
  const holding = fakeHost({ held: { [`${COMMIT}.json.gz`]: "kept", "latest.json": other } });
  assert.deepEqual(await trace.publishGraph(holding.host, snapshot), { commit: COMMIT, written: false });
  assert.deepEqual([holding.state.commits.length, holding.state.held["latest.json"]], [0, other]);
});
