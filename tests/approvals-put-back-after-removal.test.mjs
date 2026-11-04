// A file put back after its accepted removal (ITM-1314) — MOD-approvals' lastAcceptedText and rejectShown, as the accepted text of
// docs/architecture/MOD-approvals.md states them: lastAcceptedText gives "the text named by the most recent approval record of an identifier",
// and a removal's record names "the blob of the empty text (e69de29bb2d1d6434b8b29ae775ad8c2e48c5391), which is what the default branch holds of
// it" (Data, blob); rejectShown makes "the file's text … the one lastAcceptedText gives for its identifier, … or the file is deleted when no
// record names one". The item reads the empty text of a removal as the file removed again, so that rejectShown deletes the file.
// Run: node --test tests/approvals-put-back-after-removal.test.mjs
//
// Module: MOD-approvals
// Guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; A REJECTION REMOVES THE PROPOSAL; UC-023
// Level: unit
//
// The repository is tests/memory-host.mjs, a Host of MOD-repository-hosts' interface held in memory, its history written below by commitFiles,
// one commit a second; a wrapper counts every call to the host and every read of a snapshot, with the ref or path it names. Nothing reaches the
// network. Each test states its input and its expected result before it runs; the counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { memoryHost } from "./memory-host.mjs";
import { lastAcceptedText, rejectShown } from "../src/approvals/index.mjs";

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const recordAt = (id, blob) => `docs/approvals/${id}-${blob.slice(0, 12)}.md`;
const recordText = (file, blob) => text("kind: module", `file: ${file}`, `blob: ${blob}`);
const moduleFile = (id, sentence) => text("---", `id: ${id}`, `title: ${id.slice(4)}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:",
  "  - ARC-001", "---", `# ${id}`, "", "## Responsibility", "", sentence);

// MOD-desk: accepted, removed, its removal accepted, and put back with another text. MOD-kept: accepted, and changed since.
const DESK = "docs/architecture/MOD-desk.md", KEPT = "docs/architecture/MOD-kept.md";
const D1 = moduleFile("MOD-desk", "It lends books at the desk."), D2 = moduleFile("MOD-desk", "It lends books and takes them back.");
const K1 = moduleFile("MOD-kept", "It keeps books."), K2 = moduleFile("MOD-kept", "It keeps books in order.");

async function repository() {
  const repo = memoryHost({ [DESK]: D1, [KEPT]: K1 });
  const commit = async (files) => repo.host.commitFiles({ branch: "main", expectedHead: (await repo.host.readSnapshot("main")).commit, files, message: "" });
  await commit([{ path: recordAt("MOD-desk", blobOf(D1)), text: recordText(DESK, blobOf(D1)) }, { path: recordAt("MOD-kept", blobOf(K1)), text: recordText(KEPT, blobOf(K1)) }]);
  await commit([{ path: DESK, delete: true }, { path: KEPT, text: K2 }]);
  await commit([{ path: recordAt("MOD-desk", EMPTY), text: recordText(DESK, EMPTY) }]);
  await commit([{ path: DESK, text: D2 }]);
  repo.commits().length = 0;
  return repo;
}

// The host, its calls counted: each call with its function and the ref or path it names; a read of a snapshot as "read" with the snapshot's ref.
function counted(host) {
  const calls = [];
  const snapshotOf = (snapshot, ref) => ({ ...snapshot, read: async (path) => { calls.push({ fn: "read", ref, path }); return snapshot.read(path); } });
  return {
    calls,
    host: {
      ...host,
      repositoryInfo: async () => { calls.push({ fn: "repositoryInfo" }); return host.repositoryInfo(); },
      readSnapshot: async (ref, options) => { calls.push({ fn: "readSnapshot", ref }); return snapshotOf(await host.readSnapshot(ref, options), ref); },
      readHistory: async (path, options) => { calls.push({ fn: "readHistory", path }); return host.readHistory(path, options); },
      readFileAt: async (path, commits) => {
        calls.push({ fn: "readFileAt", path, commits });
        return host.readFileAt(path, commits);
      },
    },
  };
}

// TST-1314001 · level: unit · module: MOD-approvals
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// given: MOD-desk accepted, removed, its removal accepted by a record naming the empty text's blob at docs/architecture/MOD-desk.md where no file stood when that record was added, and put back with another text; known positive: MOD-kept, accepted and changed since, whose most recent record names a text
// input: lastAcceptedText("MOD-desk", host); lastAcceptedText("MOD-kept", host); each over a host that counts its calls
// expect: for MOD-desk { text: "", blob: e69de29bb2d1d6434b8b29ae775ad8c2e48c5391, path: docs/architecture/MOD-desk.md } in five calls — repositoryInfo, readSnapshot of main, two readHistory, one read of the newest record —, no readSnapshot of another ref and no read of MOD-desk's file; for MOD-kept its accepted text with its blob and path, in five calls, one readFileAt of MOD-kept's file at the record's commit among them and no snapshot of another ref
test("lastAcceptedText — where the most recent record names the empty text's blob, it gives the empty text and reads no file", async () => {
  const repo = await repository();
  const desk = counted(repo.host);
  assert.deepEqual(await lastAcceptedText("MOD-desk", desk.host), { text: "", blob: EMPTY, path: DESK });
  assert.deepEqual(desk.calls.map((call) => call.fn), ["repositoryInfo", "readSnapshot", "readHistory", "readHistory", "read"]);
  assert.deepEqual(desk.calls.filter((call) => call.fn === "readSnapshot").map((call) => call.ref), ["main"], "no snapshot at the record's commit");
  assert.ok(!desk.calls.some((call) => call.path === DESK && call.fn === "read"), "no read of the file");

  const kept = counted(repo.host);
  assert.deepEqual(await lastAcceptedText("MOD-kept", kept.host), { text: K1, blob: blobOf(K1), path: KEPT },
    "known positive: a record that names a text is read as before");
  assert.equal(kept.calls.length, 5);
  assert.ok(kept.calls.some((call) => call.fn === "readFileAt" && call.path === KEPT), "known positive: the file read at the record's commit");
  assert.ok(!kept.calls.some((call) => call.fn === "readSnapshot" && call.ref !== "main"), "no snapshot at the record's commit");
});

// TST-1314002 · level: unit · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL; UC-023
// given: the same history: MOD-desk put back after its accepted removal; known positive: MOD-kept, accepted and changed since
// input: rejectShown(host, { path: docs/architecture/MOD-desk.md, blob: the put-back text's blob }, "bob", reason); on a fresh host, rejectShown for MOD-kept as shown
// expect: one commit on main whose files are [{ path: docs/architecture/MOD-desk.md, delete: true }] and whose message holds the reason, after which main holds no MOD-desk file; for MOD-kept one commit whose files are [{ path: docs/architecture/MOD-kept.md, text: its accepted text }]
test("rejectShown — a file put back after its accepted removal is rejected by one commit that deletes it", async () => {
  const reason = "The desk stays removed.";
  const repo = await repository();
  const result = await rejectShown(repo.host, { path: DESK, blob: blobOf(D2) }, "bob", reason);
  assert.equal(repo.commits().length, 1, "one commit");
  const [commit] = repo.commits();
  assert.deepEqual(commit.files, [{ path: DESK, delete: true }]);
  assert.ok(commit.message.includes(reason), commit.message);
  assert.ok(typeof result.commit === "string" && !(DESK in repo.files()), "main holds no MOD-desk file");

  const positive = await repository();
  await rejectShown(positive.host, { path: KEPT, blob: blobOf(K2) }, "bob", reason);
  assert.deepEqual(positive.commits().map((each) => each.files), [[{ path: KEPT, text: K1 }]], "known positive: a changed file returns to its accepted text");
});
