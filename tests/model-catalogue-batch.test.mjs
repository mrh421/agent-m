// MOD-model-catalogue's catalogue reads the instance's own models in batches (ITM-841), as the accepted text of
// docs/architecture/MOD-model-catalogue.md and of docs/architecture/MOD-repository-hosts.md states it: the module uses
// MOD-repository-hosts.Snapshot, whose `readMany` "fetches the texts of many files ahead of their `read`s, in as few requests as the
// server allows — on GitHub with a token, many files in one request of the same server's GraphQL API [...]; on any other server, in
// a clone or without a token, it reads nothing ahead and each `read` fetches its file as before".
// Run: node --test tests/model-catalogue-batch.test.mjs
//
// Module: MOD-model-catalogue
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Each test states its input and its expected result in its own text (given / input / expect); no expected value is read from a
// document. The instance is a repository of files held in memory, served by a counting fake of GitHub through the real
// MOD-repository-hosts host (tests/model-catalogue-load.mjs): its commit and tree are the caller's, and the tests count the requests
// of `catalogue` itself. Every instance model is present in the repository; a test that expects "no request" first shows the same
// count finding a request on a known positive. Nothing reaches the network: `fetch` is the fake, and every request it has seen
// went to api.github.com or raw.githubusercontent.com. The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogue } from "../src/model-catalogue/index.mjs";
import { githubServer, instanceSnapshot, blobOf } from "./model-catalogue-load.mjs";

// ---------------------------------------------------------------- the instance's models

// A complete shipped model's text, whose name is replaced: a definition the schema reads without an error.
const BASE = readFileSync(new URL("../src/model-catalogue/models/kanban.md", import.meta.url), "utf8");
const pathOf = (n) => `docs/process-models/m${String(n).padStart(3, "0")}.md`;
const nameOf = (n) => `instance-model-${n}`;
const textOf = (n) => BASE.replace(/^name: .*$/m, `name: ${nameOf(n)}`);
const SHIPPED = 5;
const NAMES = ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"];

/** The files of an instance with `count` models, m001.md to m<count>.md, and one file that is no model. */
const instanceFiles = (count) => ({
  "README.md": "# The instance\n",
  ...Object.fromEntries(Array.from({ length: count }, (_, i) => [pathOf(i + 1), textOf(i + 1)])),
});
const range = (count) => Array.from({ length: count }, (_, i) => i + 1);

let server = null;
const seen = [];
// The fake in place is taken out, and the requests it saw noted, before another is put in or a test ends.
function release() {
  if (server) { seen.push(...server.log.map((entry) => entry.what)); server.restore(); }
  server = null;
}
afterEach(() => {
  release();
  const stray = seen.splice(0).filter((what) => !/ https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//.test(` ${what}`));
  assert.deepEqual(stray, [], "every request went to GitHub's two hosts only");
});

/** The requests catalogue makes over an instance of `count` models, with or without a token, and what it returns. */
async function load(count, { token }) {
  release();
  server = githubServer(instanceFiles(count));
  server.install();
  const snapshot = await instanceSnapshot(server, { token });
  const got = await catalogue(snapshot);
  return { got, log: [...server.log] };
}

// ---------------------------------------------------------------- with a token: batches

// TST-1429028 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: an instance of ten models, read with a token
// input: catalogue(snapshot)
// expect: exactly one request, a batch that reads the ten model files in the order of their paths, and no file read by itself; the models are the five shipped ones, then the ten of the instance, each with its path, its name and the blob SHA of its text as its version.
test("TST-1429028: ITM-841 · with a token, ten instance models are read in one batch request and no file by itself", async () => {
  const { got, log } = await load(10, { token: true });
  assert.deepEqual(log.map((r) => r.kind), ["batch"], "one request, a batch");
  assert.deepEqual(log[0].files, range(10).map(pathOf), "the batch reads the ten model files in the order of their paths");
  assert.deepEqual(got.models.map((m) => m.name), [...NAMES, ...range(10).map(nameOf)], "the five shipped models, then the ten of the instance");
  assert.deepEqual(got.models.slice(SHIPPED).map((m) => m.path), range(10).map(pathOf));
  assert.deepEqual(got.models.slice(SHIPPED).map((m) => m.version), range(10).map((n) => blobOf(textOf(n))), "the version is the blob SHA of the file read");
  assert.deepEqual(Object.keys(got.findings).slice(SHIPPED), range(10).map(pathOf), "each instance model has its findings");
});

// TST-1429029 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: an instance of one model, this repository's size, read with a token
// input: catalogue(snapshot)
// expect: one batch request that reads the one file, and no file read by itself.
test("TST-1429029: ITM-841 · with a token, one instance model is one batch request of one file", async () => {
  const { got, log } = await load(1, { token: true });
  assert.deepEqual(log.map((r) => r.kind), ["batch"]);
  assert.deepEqual(log[0].files, [pathOf(1)]);
  assert.deepEqual(got.models.map((m) => m.name), [...NAMES, nameOf(1)]);
});

// TST-1429030 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: an instance of 250 models, read with a token
// input: catalogue(snapshot)
// expect: batches of a hundred — three requests of 100, 100 and 50 files in the order of the paths — and no file read by itself; every model is present, in the order of its path.
test("TST-1429030: ITM-841 · with a token, 250 instance models are read in batches of a hundred", async () => {
  const { got, log } = await load(250, { token: true });
  assert.deepEqual(log.map((r) => r.kind), ["batch", "batch", "batch"]);
  assert.deepEqual(log.map((r) => r.files.length), [100, 100, 50]);
  assert.deepEqual(log.flatMap((r) => r.files), range(250).map(pathOf));
  assert.deepEqual(got.models.slice(SHIPPED).map((m) => m.name), range(250).map(nameOf));
});

// ---------------------------------------------------------------- without a token: as before

// TST-1429031 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: an instance of ten models, read without a token
// input: catalogue(snapshot)
// expect: no batch — the host reads nothing ahead — and ten requests, each reading one model file from the raw host, in the order of the paths; the models are those read with a token.
test("TST-1429031: ITM-841 · without a token, ten instance models are ten file requests, and the models are those read with a token", async () => {
  const without = await load(10, { token: false });
  assert.deepEqual(without.log.map((r) => r.kind), Array(10).fill("file"));
  assert.deepEqual(without.log.flatMap((r) => r.files), range(10).map(pathOf));
  const withToken = await load(10, { token: true });
  assert.deepEqual(without.got, withToken.got, "the same catalogue, whatever the requests");
});

// ---------------------------------------------------------------- nothing to read

// TST-1429032 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: an instance with no model of its own, read with a token
// input: catalogue(snapshot)
// expect: no request at all, and the five shipped models. Known positive: the same count over an instance of one model finds one request.
test("TST-1429032: ITM-841 · an instance without a model of its own sends no request", async () => {
  const positive = await load(1, { token: true });
  assert.equal(positive.log.length, 1, "known positive: one model sends a request");
  const { got, log } = await load(0, { token: true });
  assert.deepEqual(log, []);
  assert.deepEqual(got.models.map((m) => m.name), NAMES);
});

// ---------------------------------------------------------------- the call on the snapshot

// A snapshot that records its calls, in order: readMany(paths) and read(path). Its paths hold three models, a file that is no model
// and a model in a folder below docs/process-models/.
function recordingSnapshot() {
  const files = { ...instanceFiles(3), "docs/process-models/deeper/x.md": textOf(9), "docs/process-models/notes.txt": "x" };
  const calls = [];
  return {
    calls,
    snapshot: {
      paths: ["docs/process-models/m003.md", "README.md", "docs/process-models/deeper/x.md", "docs/process-models/m001.md", "docs/process-models/notes.txt", "docs/process-models/m002.md"],
      readMany: async (paths) => { calls.push(["readMany", [...paths]]); },
      read: async (path) => { calls.push(["read", path]); return files[path] ?? null; },
      blob: (path) => (path in files ? blobOf(files[path]) : null),
    },
  };
}

// TST-1429033 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a snapshot with readMany whose paths hold three models, a file that is no model and one in a deeper folder
// input: catalogue(snapshot)
// expect: readMany is called once, before every read, with exactly the three model paths in the order of the paths; each model is then read.
test("TST-1429033: ITM-841 · catalogue names the instance's model files to readMany once, before it reads any", async () => {
  const { calls, snapshot } = recordingSnapshot();
  const got = await catalogue(snapshot);
  assert.deepEqual(calls[0], ["readMany", ["docs/process-models/m001.md", "docs/process-models/m002.md", "docs/process-models/m003.md"]]);
  assert.equal(calls.filter(([what]) => what === "readMany").length, 1);
  assert.deepEqual(calls.slice(1).map(([what]) => what), ["read", "read", "read"]);
  assert.deepEqual(got.models.slice(SHIPPED).map((m) => m.name), [nameOf(1), nameOf(2), nameOf(3)]);
});

// TST-1429034 · level: unit · module: MOD-model-catalogue
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same snapshot without readMany
// input: catalogue(snapshot)
// expect: the same models, each read by itself.
test("TST-1429034: ITM-841 · a snapshot without readMany is read file by file", async () => {
  const { calls, snapshot } = recordingSnapshot();
  const { readMany, ...bare } = snapshot;
  assert.equal(typeof readMany, "function", "known positive: the snapshot above has readMany");
  const got = await catalogue(bare);
  assert.deepEqual(calls.map(([what]) => what), ["read", "read", "read"]);
  assert.deepEqual(got.models.slice(SHIPPED).map((m) => m.name), [nameOf(1), nameOf(2), nameOf(3)]);
});
