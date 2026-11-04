// MOD-trace-graph's `<commit>.references.json.gz` and storedReferences, as docs/architecture/MOD-trace-graph.md states them: publishGraph adds
// `<commit>.references.json.gz`, "what names each requirement of it, gzipped", beside `<commit>.json.gz`; "storedReferences(source, commit) — for each
// requirement of the graph stored for `commit`, and each name an edge of it leads to that no node is, the identifiers of what names it, as `requirementImpact`
// gives them, each once; a name without an entry is named by nothing. Read with the source's `readOn` in one request, once for each commit; `null` without
// `readOn`, or when the branch or the file is missing or holds another format."
// Run: node --test tests/trace-graph-stored-references.test.mjs
//
// Module: MOD-trace-graph
// Guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, nothing reaches the network: the host is a fake with readSnapshot and commitFiles holding the branch trace-cache in memory; the snapshot is a
// small repository in which one requirement is named by a use case, a module, a test and an item, one by nothing, and one name no node is is named by a use
// case. storedReferences keeps what it read for a commit for the page, so each case asks for a commit of its own. The counter-proofs are run as planted faults
// and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import * as trace from "../src/trace-graph/index.mjs";

const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* `tests/doer.test.mjs`.\n\n"
    + "**ANOTHER THING WAITS** *(Product Owner)*\n\nIt waits.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n  - A NAME NO NODE IS\n---\n# UC-001 Do it\n",
  "docs/architecture/MOD-doer.md": "---\nid: MOD-doer\ntitle: The doer\nfolder: src/doer/\nrealises:\n  - A THING IS DONE\nprovides:\n  - doIt\n---\n# MOD-doer The doer\n",
  "docs/backlog/ITM-001-do-it.md": "---\nid: ITM-001\ntitle: Do it\nlevel: unit\nrealises:\n  - A THING IS DONE\nmodules:\n  - MOD-doer\ntests:\n  - unit\n---\n# ITM-001 Do it\n",
  "tests/doer.test.mjs": "// Module: MOD-doer\n// Guards: A THING IS DONE\n// Level: unit\n\n// TST-001001 · level: unit · module: MOD-doer\n// guards: A THING IS DONE\n// given: nothing\n// input: nothing\n// expect: nothing\ntest(\"x\", () => {});\n",
  "src/doer/index.mjs": "export const doIt = () => 1;\n",
};
const commitOf = (digit) => String(digit).repeat(40);
const snapshotOf = (commit) => ({ commit, paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null, readMany: async () => {}, blob: () => null });

function fakeHost() {
  const held = {};
  return { held, host: {
    async readSnapshot() { return { commit: "f".repeat(40), paths: Object.keys(held), read: async (path) => held[path] ?? null, readMany: async () => {}, blob: () => null }; },
    async commitFiles(change) { for (const file of change.files) held[file.path] = file.bytes ?? file.text; return { commit: "e".repeat(40) }; },
  } };
}
// A source that reads the branch's files by readOn, as MOD-repository-hosts' readOn does: bytes where the caller asks for them. Each read is counted.
const sourceOver = (held) => {
  const reads = [];
  return { reads, readOn: async (branch, path, options) => {
    reads.push([branch, path, options?.bytes === true]);
    const file = held[path] ?? null;
    return file !== null && !options?.bytes && typeof file !== "string" ? new TextDecoder().decode(file) : file;
  } };
};
const refsFile = (commit) => `${commit}.references.json.gz`;
const gz = (value) => new Uint8Array(gzipSync(typeof value === "string" ? value : JSON.stringify(value)));

// TST-1348001 · level: unit · module: MOD-trace-graph
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake host whose trace-cache holds nothing; the small repository at 1111…, in which A THING IS DONE is named by UC-001, MOD-doer, ITM-001 and a test, ANOTHER THING WAITS by nothing, and A NAME NO NODE IS by UC-001 only
// input: publishGraph(host, snapshot), then storedReferences over the branch's files for 1111…, twice
// expect: the commit adds 1111….references.json.gz beside 1111….json.gz; storedReferences gives a Map with an entry for each requirement of the graph and for A NAME NO NODE IS, each the identifiers requirementImpact gives for the graph built from the files, each once — A THING IS DONE names UC-001, MOD-doer, ITM-001 and the test's identifier, ANOTHER THING WAITS none, A NAME NO NODE IS ["UC-001"]; one read of ("trace-cache", "1111….references.json.gz") with bytes for the two calls and no read of the graph; counter-proof: a map that holds no entry for A NAME NO NODE IS, or lists UC-001 twice, fails
test("TST-1348001 the file publishGraph stores is read back by storedReferences as the map requirementImpact gives, in one request", async () => {
  const commit = commitOf(1), { host, held } = fakeHost();
  await trace.publishGraph(host, snapshotOf(commit));
  assert.ok(refsFile(commit) in held && `${commit}.json.gz` in held, Object.keys(held).join(", "));
  const built = await trace.traceGraph({ paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null }, { commit });
  const idsOf = (name) => [...new Set(trace.requirementImpact(built, name).map((place) => place.id))];
  const source = sourceOver(held);
  const stored = await trace.storedReferences(source, commit);
  assert.ok(stored instanceof Map, "a Map");
  assert.deepEqual([...stored.keys()].sort(), ["A NAME NO NODE IS", "A THING IS DONE", "ANOTHER THING WAITS"]);
  for (const [name, ids] of stored) assert.deepEqual(ids, idsOf(name), name);
  assert.deepEqual(stored.get("A NAME NO NODE IS"), ["UC-001"]);
  assert.deepEqual(stored.get("ANOTHER THING WAITS"), []);
  assert.deepEqual([...stored.get("A THING IS DONE")].sort(), ["ITM-001", "MOD-doer", "TST-001001", "UC-001"]);
  assert.equal(await trace.storedReferences(source, commit), stored, "once for each commit: the second call is the first one's result");
  assert.deepEqual(source.reads, [["trace-cache", refsFile(commit), true]]);
});

// TST-1348002 · level: unit · module: MOD-trace-graph
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the references file of TST-1348001, stored for 2222…; trace-cache files of other kinds for 3333… to 8888…
// input: storedReferences for 2222… (known positive); for 3333… whose file is missing; for 4444… whose file is gzipped JSON of another format; for 5555… whose file is no gzip; for 6666… whose file names another commit; for 7777… whose file holds a list that is no id; over a source without readOn; with no commit
// expect: the known positive gives a Map; null each time otherwise, never the references of another commit
test("TST-1348002 storedReferences gives null for a missing file, another format, another commit and a source without readOn", async () => {
  const { host, held } = fakeHost();
  await trace.publishGraph(host, snapshotOf(commitOf(2)));
  const good = held[refsFile(commitOf(2))];
  assert.ok(good instanceof Uint8Array, "published as gzipped bytes");
  assert.ok((await trace.storedReferences(sourceOver(held), commitOf(2))) instanceof Map, "known positive");
  const none = async (files, commit) => trace.storedReferences(sourceOver(files), commit);
  assert.equal(await none({}, commitOf(3)), null, "missing file");
  assert.equal(await none({ [refsFile(commitOf(4))]: gz({ format: "other", version: 1, commit: commitOf(4), references: {} }) }, commitOf(4)), null, "another format");
  assert.equal(await none({ [refsFile(commitOf(5))]: new TextEncoder().encode("not gzip") }, commitOf(5)), null, "no gzip");
  assert.equal(await none({ [refsFile(commitOf(6))]: good }, commitOf(6)), null, "the file of another commit");
  assert.equal(await none({ [refsFile(commitOf(7))]: gz({ format: "agent-m-trace-references", version: 1, commit: commitOf(7), references: { "A THING": [1] } }) }, commitOf(7)), null, "a list that is no id");
  assert.equal(await trace.storedReferences({}, commitOf(8)), null, "no readOn");
  assert.equal(await trace.storedReferences(sourceOver(held), ""), null, "no commit");
});
