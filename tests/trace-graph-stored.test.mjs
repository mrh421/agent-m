// MOD-trace-graph's stored graph (ITM-907), as the accepted text of docs/architecture/MOD-trace-graph.md states it, with the rule that a page reads the graph and never
// builds it: the workflow "main changed" stores the graph of each pushed commit gzipped as `<commit>.json.gz` on the branch `trace-cache`. traceGraph — "first, where
// `options.commit` is given and the source has `readOn`, reads the stored file on the branch `trace-cache` once; a text that `graphFromText` restores for that commit is the
// result, and no file is read. A missing branch or file, a text of another format and a text that names another commit are not failures: the graph is then built"; storedGraph —
// the graph stored for a commit, read once through `readOn`, never built: it rejects with GraphNotStored where none is stored; graphText — "the graph as one text, the same text
// for the same graph, that names the commit"; graphFromText — "the graph the text holds, or `null` for a text that is no `graphText` or names a commit other than `commit`. Reads
// nothing." The pages (src/review-pages, src/trace-pages, src/test-pages, src/implementation-pages, src/main-page, src/release-evidence) import no traceGraph, so that no
// page can build the graph in the browser.
// Run: node --test tests/trace-graph-stored.test.mjs
//
// Module: MOD-trace-graph
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TRACEABILITY MATRIX IS DERIVED
// Level: unit
//
// Deterministic, nothing reaches the network: the TextSource is built here over a small repository — SPEC.md with one requirement, a use
// case that realises it, a module file and a backlog item — and its `read`, `readMany` and `readOn` record their calls. Each test states
// its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as stored from "../src/trace-graph/index.mjs";
import { storedGraph, traceGraph } from "../src/trace-graph/index.mjs";
import { gzipped } from "../src/trace-graph/stored.mjs";
import { gzipSync } from "node:zlib";

const COMMIT = "abcdef00abcdef00abcdef00abcdef00abcdef00";
const OTHER = "99999999999999999999999999999999999999ff";
const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
  "docs/architecture/MOD-doer.md": "---\nid: MOD-doer\ntitle: The doer\nfolder: src/doer/\nrealises:\n  - A THING IS DONE\nprovides:\n  - doIt\n---\n# MOD-doer The doer\n",
  "docs/backlog/ITM-001-do-it.md": "---\nid: ITM-001\ntitle: Do it\nlevel: unit\nrealises:\n  - A THING IS DONE\nmodules:\n  - MOD-doer\ntests:\n  - unit\n---\n# ITM-001 Do it\n",
  "src/doer/index.mjs": "export const doIt = () => 1;\n",
};

// A TextSource over FILES that records `read`, `readMany` and `readOn` calls; `readOn` is what readOn answers (bytes, a text, null, or a function).
function source({ readOn } = {}) {
  const calls = { read: [], readMany: [], readOn: [] };
  const own = {
    paths: Object.keys(FILES),
    async read(path) { calls.read.push(path); return FILES[path] ?? null; },
    async readMany(paths) { calls.readMany.push(paths); },
  };
  if (readOn !== undefined) {
    own.readOn = async (branch, path, options) => { calls.readOn.push([branch, path, options]); return typeof readOn === "function" ? readOn(branch, path) : readOn; };
  }
  return { source: own, calls };
}

// The graph built from the files for COMMIT, as traceGraph builds it with no stored graph.
const built = async () => traceGraph(source().source, { commit: COMMIT });
const STORED_FILE = ["trace-cache", `${COMMIT}.json.gz`, { bytes: true }];

// TST-907101 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: the graph built from the small repository for COMMIT
// input: graphText(graph) twice; graphFromText of it for COMMIT; for another commit; for the text "not a graph", for "{}" and for ""
// expect: the same text twice; a graph deeply equal to the built one; null for the other commit; null for each of the three texts that are no graphText
test("graphText is the same text for the same graph, and graphFromText restores that graph for its commit only", async () => {
  const graph = await built();
  assert.ok(graph.nodes.size >= 4, "known positive: the graph holds the requirement, the use case, the module and the item");
  const text = stored.graphText(graph);
  assert.equal(stored.graphText(graph), text);
  assert.deepEqual(stored.graphFromText(text, COMMIT), graph);
  assert.equal(stored.graphFromText(text, OTHER), null);
  for (const notGraph of ["not a graph", "{}", ""]) assert.equal(stored.graphFromText(notGraph, COMMIT), null, JSON.stringify(notGraph));
});

// TST-907102 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a TextSource with readOn that answers the gzipped graphText of the graph built for COMMIT, as the workflow stores it
// input: traceGraph(source, { commit: COMMIT })
// expect: a graph deeply equal to the built one; readOn called once, with ("trace-cache", "<COMMIT>.json.gz", { bytes: true }); no read and no readMany
test("traceGraph returns the graph stored for its commit and reads no file", async () => {
  const graph = await built();
  const { source: given, calls } = source({ readOn: await gzipped(stored.graphText(graph)) });
  assert.deepEqual(await traceGraph(given, { commit: COMMIT }), graph);
  assert.deepEqual(calls.readOn, [STORED_FILE]);
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});

// The sources whose readOn gives no usable stored graph of COMMIT: (a) no readOn; (b) readOn answering null (no branch or file); (c) the gzipped text of another commit's
// graph; (d) gzipped bytes of a text that is no graph; (e) the graph's text itself, not gzipped bytes; (f) bytes that are no gzip; (g) readOn rejecting.
async function unusable() {
  const graph = await built();
  const text = stored.graphText(graph);
  return {
    "no readOn": undefined, "no file": null, "another commit": await gzipped(stored.graphText({ ...graph, commit: OTHER })), "no graph": await gzipped("not a graph"),
    "a text, not bytes": text, "no gzip": new TextEncoder().encode(text), "a failing readOn": () => { throw new Error("offline"); },
  };
}

// TST-907103 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the sources (a) to (g) above
// input: traceGraph(each source, { commit: COMMIT }); and traceGraph(source with readOn answering the stored bytes, no commit option)
// expect: for (a) to (g) the graph built from the files, deeply equal to the stored one, with the files read (read called for SPEC.md); for (a) readOn never called; without the commit option readOn is not called and the graph is built
test("without a usable stored graph, traceGraph builds the graph from the files and equals the stored one", async () => {
  const graph = await built();
  for (const [name, readOn] of Object.entries(await unusable())) {
    const { source: given, calls } = source({ readOn });
    assert.deepEqual(await traceGraph(given, { commit: COMMIT }), graph, name);
    assert.equal(calls.read.includes("SPEC.md"), true, `${name}: the files are read`);
    assert.equal(calls.readOn.length, name === "no readOn" ? 0 : 1, name);
  }
  const { source: given, calls } = source({ readOn: await gzipped(stored.graphText(graph)) });
  const withoutCommit = await traceGraph(given);
  assert.equal(calls.readOn.length, 0);
  assert.equal(withoutCommit.commit, null);
  assert.equal(withoutCommit.nodes.size, graph.nodes.size);
});

// TST-907105 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TRACEABILITY MATRIX IS DERIVED
// given: a TextSource with readOn that answers the gzipped graphText of the graph built for a commit no other test of this file asks storedGraph for (storedGraph keeps a commit's graph)
// input: storedGraph(source, that commit)
// expect: a graph deeply equal to the built one for that commit; readOn called once, with ("trace-cache", "<commit>.json.gz", { bytes: true }); no read and no readMany
test("storedGraph returns the graph stored for the commit, read by one readOn, and reads no file", async () => {
  const own = "1111111111111111111111111111111111111105";
  const graph = { ...(await built()), commit: own };
  const { source: given, calls } = source({ readOn: await gzipped(stored.graphText(graph)) });
  assert.deepEqual(await storedGraph(given, own), graph);
  assert.deepEqual(calls.readOn, [["trace-cache", `${own}.json.gz`, { bytes: true }]]);
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});

// TST-907106 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE TRACEABILITY MATRIX IS DERIVED
// given: the sources (a) to (g) above (COMMIT, which no test of this file reads a stored graph of through storedGraph), and a source with the stored bytes asked for no commit
// input: storedGraph(each source, COMMIT); storedGraph(source, null)
// expect: each rejects with an error named GraphNotStored whose message says the graph is not stored yet and names the workflow "main changed"; no read and no readMany; the one readOn of ("trace-cache", "<COMMIT>.json.gz", { bytes: true }) is the only call, none for (a) and none without a commit — storedGraph never builds the graph
test("storedGraph rejects with GraphNotStored where no usable graph is stored, and makes no read besides the one readOn", async () => {
  const notStored = (error) => error.name === "GraphNotStored" && /is not stored yet/.test(error.message) && /"main changed"/.test(error.message);
  for (const [name, readOn] of Object.entries(await unusable())) {
    const { source: given, calls } = source({ readOn });
    await assert.rejects(storedGraph(given, COMMIT), notStored, name);
    assert.deepEqual([calls.read, calls.readMany], [[], []], `${name}: nothing is read`);
    assert.deepEqual(calls.readOn, name === "no readOn" ? [] : [STORED_FILE], name);
  }
  const { source: given, calls } = source({ readOn: await gzipped(stored.graphText(await built())) });
  await assert.rejects(storedGraph(given, null), notStored);
  assert.deepEqual([calls.read, calls.readMany, calls.readOn], [[], [], []]);
});

// The modules a folder of src holds, by path, with the bindings each imports from anywhere: the names of `import { a, b as c } from` (a and b), and `* as x` of a namespace
// import, which can reach every export of the module it names.
async function importsUnder(folder) {
  const found = new Map();
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    const text = await readFile(path, "utf8");
    const bindings = [];
    for (const [, names, from] of text.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm)) {
      for (const name of names.split(",").map((each) => each.trim().split(/\s+as\s+/)[0]).filter(Boolean)) bindings.push({ name, from });
    }
    for (const [, from] of text.matchAll(/^\s*import\s*\*\s*as\s+\w+\s+from\s*["']([^"']+)["']/gm)) bindings.push({ name: "*", from });
    for (const [, from] of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) bindings.push({ name: "*", from });
    found.set(path, bindings);
  }
  return found;
}
const buildsGraph = ({ name, from }) => name === "traceGraph" || (/trace-graph\//.test(from) && (name === "*" || /build\.mjs$/.test(from)));

// TST-907107 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the source files of the page modules: src/review-pages, src/trace-pages, src/test-pages, src/implementation-pages, src/main-page and src/release-evidence
// input: a static scan of their import statements
// expect: no module imports traceGraph, a namespace of MOD-trace-graph (which would reach it) or src/trace-graph/build.mjs; known positive: the same scan finds traceGraph imported by src/run-planner/inputs.mjs
test("no page module imports traceGraph, so that the browser build cannot come back", async () => {
  const positive = await importsUnder("src/run-planner");
  assert.ok([...positive].some(([path, bindings]) => path.endsWith("inputs.mjs") && bindings.some(buildsGraph)), "known positive: run-planner's inputs.mjs imports traceGraph");
  const pages = ["src/review-pages", "src/trace-pages", "src/test-pages", "src/implementation-pages", "src/main-page", "src/release-evidence"];
  const offending = [];
  let scanned = 0;
  for (const folder of pages) {
    for (const [path, bindings] of await importsUnder(folder)) {
      scanned += 1;
      for (const binding of bindings.filter(buildsGraph)) offending.push(`${path}: ${binding.name} from ${binding.from}`);
    }
  }
  assert.ok(scanned > 20, `known positive: the page folders hold their modules (${scanned} scanned)`);
  assert.deepEqual(offending, []);
});

// TST-907104 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the graph built from the small repository, stored gzipped as `<commit>.json.gz` on trace-cache for a commit no other test of this file names; two sources of that commit, as two views of one page hold them, whose readOn answer those bytes; and, for the counter-proof, a source of a third commit whose readOn answers null at first and the bytes from its second call on
// input: storedGraph(first source, commit) and storedGraph(second source, commit) asked at once, then storedGraph(first source, commit) once more; storedGraph(third source, its commit) twice in a row
// expect: the three calls of the commit give the stored graph (deeply equal to the built one, known positive that it was read) and the two sources' readOn are called once in all, with ("trace-cache", "<commit>.json.gz"); the third commit's first call rejects with GraphNotStored and its second reads again (readOn called twice) and gives the graph — a graph not stored is not kept
test("storedGraph reads the graph of a commit once however many callers ask, and reads again a graph that was not stored", async () => {
  const graph = await built();
  const once = "0123456789abcdef0123456789abcdef01234567", later = "fedcba9876543210fedcba9876543210fedcba98";
  const bytesOf = (commit) => new Uint8Array(gzipSync(stored.graphText({ ...graph, commit })));
  const first = source({ readOn: () => bytesOf(once) }), second = source({ readOn: () => bytesOf(once) });
  const [a, b] = await Promise.all([stored.storedGraph(first.source, once), stored.storedGraph(second.source, once)]);
  const c = await stored.storedGraph(first.source, once);
  for (const each of [a, b, c]) assert.deepEqual(each, { ...graph, commit: once });
  assert.deepEqual([...first.calls.readOn, ...second.calls.readOn].map(([branch, path]) => [branch, path]), [["trace-cache", `${once}.json.gz`]]);

  let asked = 0;
  const third = source({ readOn: () => (++asked === 1 ? null : bytesOf(later)) });
  await assert.rejects(stored.storedGraph(third.source, later), { name: "GraphNotStored" });
  assert.deepEqual(await stored.storedGraph(third.source, later), { ...graph, commit: later });
  assert.equal(third.calls.readOn.length, 2);
});
