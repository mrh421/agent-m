// The files removed since their acceptance (ITM-730) — MOD-approvals' removedFiles, and acceptShown's removal, as the accepted text of
// docs/architecture/MOD-approvals.md states them: "removedFiles(snapshot: Snapshot) -> Array<{ id: string, kind: "architecture-decision" |
// "module" }> — every decision or module file that a record names and of whose identifier the snapshot holds no file, and whose removal no
// record accepts (no record of that identifier names the empty text's blob)", computed in the same pass over docs/approvals/ as statuses, in
// the order of the identifiers; and of acceptShown: "A shown file with the empty text's blob is a removal: it is recorded, naming the empty
// text's blob, while the head holds no file of its identifier, and left out as "changed since shown" when the head holds one" (UC-023 step 5).
// Run: node --test tests/approvals-removed-files.test.mjs
//
// Module: MOD-approvals
// Guards: UC-023; STATUS IS DERIVED FROM THE RECORDS; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// Level: unit
//
// removedFiles is given a snapshot held in memory — only `paths` and `blob`, as statuses is —, which has no `read`: a read of a record's
// text would fail by itself. acceptShown is given a fake host that keeps to MOD-repository-hosts' interface as the module file states it —
// one repository in memory, default branch `trunk`, repositoryInfo, readSnapshot and commitFiles, a commit made only on the expected head —,
// every write recorded. A name the module does not provide yet is undefined here, so that each test fails by itself. The empty text's blob is
// git's, e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 (MOD-approvals, Data). Nothing reaches the network. Each test states its input and its
// expected result before it runs; the counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as approvalsModule from "../src/approvals/index.mjs";
import { readDocument } from "../src/documents/index.mjs";

const { removedFiles, acceptShown, approvalSchema } = approvalsModule;

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const record = (id, blob) => `docs/approvals/${id}-${blob.slice(0, 12)}.md`;

// ---------------------------------------------------------------- removedFiles

// A snapshot of paths and blobs: MOD-held, whose file stands; MOD-gone and ARC-007, whose records stand and whose files do not; MOD-done,
// whose removal a record of the empty text's blob accepts; UC-005, a use case whose file is gone — no decision or module —; and README.md.
const HELD_BLOB = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";
function snapshotOf({ doneAccepted = true } = {}) {
  const blobs = { "docs/architecture/MOD-held.md": HELD_BLOB, "docs/architecture/ARC-001-the-system.md": "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2" };
  const paths = [...Object.keys(blobs), record("MOD-held", HELD_BLOB), record("MOD-gone", "c3c3c3c3c3c3c3c3c3c3"),
    record("ARC-007", "d4d4d4d4d4d4d4d4d4d4"), record("MOD-done", "e5e5e5e5e5e5e5e5e5e5"), ...(doneAccepted ? [record("MOD-done", EMPTY)] : []),
    record("UC-005", "f6f6f6f6f6f6f6f6f6f6"), "docs/approvals/README.md"].sort();
  return { paths, blob: (path) => blobs[path] ?? null };
}

// TST-730001 · level: unit · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-023
// given: a snapshot of paths and blobs only, no read: records of MOD-held (whose file stands), MOD-gone and ARC-007 (whose files do not), MOD-done (whose file does not, and a second record of which names the empty text's blob) and UC-005 (a use case whose file does not stand); and, as the known positive, the same snapshot without MOD-done's record of the empty text
// input: removedFiles(snapshot); removedFiles(the known positive)
// expect: [{ id: "ARC-007", kind: "architecture-decision" }, { id: "MOD-gone", kind: "module" }] — in the order of the identifiers; neither MOD-held, whose file is held, nor MOD-done, whose removal a record accepts, nor UC-005, no decision or module —; for the known positive, MOD-done named too, after MOD-gone; no record's text is read
test("removedFiles — a removed decision or module is named, a held one is not, and one whose removal a record accepts is not", () => {
  assert.equal(typeof removedFiles, "function", "MOD-approvals provides removedFiles");
  assert.deepEqual(removedFiles(snapshotOf()), [{ id: "ARC-007", kind: "architecture-decision" }, { id: "MOD-gone", kind: "module" }]);
  assert.deepEqual(removedFiles(snapshotOf({ doneAccepted: false })).map((each) => each.id), ["ARC-007", "MOD-done", "MOD-gone"],
    "known positive: without the record of the empty text, MOD-done's removal is not accepted, and it is named");
});

// ---------------------------------------------------------------- acceptShown, a removal

const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" };
const SPEC = text("# Fixture product — Specification", "", "## Section", "", "**A SAMPLE RULE** *(Product Owner)*",
  "A sample rule.", "*Check:* `tests/sample.test.mjs`");
const UC1_PATH = "docs/use-cases/UC-001-read-a-file.md";
const UC1 = text("---", "id: UC-001", "title: Read a file", "area: files", "actors:", "  - Reader", "realises:", "  - A SAMPLE RULE", "---",
  "# UC-001 Read a file", "", "**Goal.** The reader reads a file.");
const MOD_PATH = "docs/architecture/MOD-sample.md";
const MODULE = text("---", "id: MOD-sample", "title: Sample", "folder: src/sample/", "realises:", "  - A SAMPLE RULE", "---", "# MOD-sample Sample");
const ARC2_PATH = "docs/architecture/ARC-002-writing-files.md";
const ARC2_RENAMED = "docs/architecture/ARC-002-writing.md";
const ARC2 = text("---", "id: ARC-002", "title: Writing files", "forced_by:", "  - UC-001", "---", "# ARC-002 Writing files");
const recordFile = (id, kind, path, body) => [record(id, blobOf(body)), text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// MOD-sample and ARC-002 were accepted and then removed; UC-001 stands, open — the one reviewed file on the head.
const PRODUCT = { "SPEC.md": SPEC, [UC1_PATH]: UC1, ...Object.fromEntries([recordFile("MOD-sample", "module", MOD_PATH, MODULE),
  recordFile("ARC-002", "architecture-decision", ARC2_PATH, ARC2)]) };

const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);
function fakeHost(files) {
  const writes = [];
  let tree = new Map(Object.entries(files)), made = 0, head = createHash("sha1").update(`commit ${++made}`).digest("hex");
  return {
    head: () => head,
    files: () => Object.fromEntries(tree),
    writes: () => writes,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref !== "trunk") throw failure("NotFound", { what: ref });
        const held = tree;
        return { repository: ON_GITHUB, ref, commit: head, paths: [...held.keys()].sort(), read: async (path) => held.get(path) ?? null,
          blob: (path) => (held.has(path) ? blobOf(held.get(path)) : null) };
      },
      async commitFiles(change) {
        writes.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        tree = new Map([...tree, ...change.files.map((file) => [file.path, file.text])]);
        head = createHash("sha1").update(`commit ${++made}`).digest("hex");
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}
const fieldsOf = (path, body) => readDocument(approvalSchema, path, body).fields;

// TST-730002 · level: unit · module: MOD-approvals
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; UC-023
// given: the product above on GitHub, whose default branch `trunk` holds records of MOD-sample and of ARC-002 and no file of either, and UC-001, open; the person bob was shown MOD-sample's removal — its path docs/architecture/MOD-sample.md with the empty text's blob — and UC-001 as it stands
// input: acceptShown(host, [MOD-sample's path with the empty text's blob, UC-001's path with its blob], "bob")
// expect: one commit on `trunk`, on the head that was read, holding two records — docs/approvals/MOD-sample-e69de29bb2d1.md of the three lines kind module, file docs/architecture/MOD-sample.md, blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391, and UC-001's record —, and nothing else; its message names bob and MOD-sample; the result { commit, recorded: both paths in the order shown, leftOut: [] }
test("acceptShown — a shown removal is recorded, naming the empty text's blob, while the head holds no file of its identifier", async () => {
  const fake = fakeHost(PRODUCT);
  const read = fake.head();

  const result = await acceptShown(fake.host, [{ path: MOD_PATH, blob: EMPTY }, { path: UC1_PATH, blob: blobOf(UC1) }], "bob");

  assert.equal(fake.writes().length, 1, "one commit");
  const [change] = fake.writes();
  assert.equal(change.expectedHead, read, "on the head that was read");
  assert.deepEqual(change.files.map((file) => file.path), ["docs/approvals/MOD-sample-e69de29bb2d1.md", record("UC-001", blobOf(UC1))]);
  assert.deepEqual(fieldsOf(change.files[0].path, change.files[0].text), { kind: "module", file: MOD_PATH, blob: EMPTY });
  assert.equal(change.files[0].text.trimEnd().split("\n").length, 3, "a record of three lines");
  assert.ok(/\bbob\b/.test(change.message) && change.message.includes("MOD-sample"), `the message names bob and MOD-sample: ${change.message}`);
  assert.deepEqual(result, { commit: fake.head(), recorded: [MOD_PATH, UC1_PATH], leftOut: [] });
});

// TST-730003 · level: unit · module: MOD-approvals
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; UC-023
// given: the same product, in which, after bob was shown ARC-002's removal — its path docs/architecture/ARC-002-writing-files.md with the empty text's blob —, another writer put ARC-002 back on `trunk` under a new name, docs/architecture/ARC-002-writing.md; bob was shown UC-001 too
// input: acceptShown(host, [ARC-002's old path with the empty text's blob, UC-001's path with its blob], "bob"); and, as the known positive, the same click on a head without ARC-002's new file
// expect: one commit holding UC-001's record alone; the result's leftOut [{ path: ARC-002's old path, reason: "changed since shown", names: [] }]; no record of ARC-002 naming the empty text's blob anywhere on `trunk`; for the known positive, ARC-002's removal recorded
test("acceptShown — a shown removal is left out as changed since shown when the head holds a file of its identifier", async () => {
  const fake = fakeHost({ ...PRODUCT, [ARC2_RENAMED]: ARC2 });
  const shown = [{ path: ARC2_PATH, blob: EMPTY }, { path: UC1_PATH, blob: blobOf(UC1) }];

  const result = await acceptShown(fake.host, shown, "bob");

  assert.deepEqual(fake.writes()[0].files.map((file) => file.path), [record("UC-001", blobOf(UC1))], "UC-001's record alone");
  assert.deepEqual(result.leftOut, [{ path: ARC2_PATH, reason: "changed since shown", names: [] }]);
  assert.ok(!(record("ARC-002", EMPTY) in fake.files()), "no record of ARC-002's removal");

  const positive = fakeHost(PRODUCT);
  const accepted = await acceptShown(positive.host, shown, "bob");
  assert.deepEqual(accepted.recorded, [ARC2_PATH, UC1_PATH], "known positive: without a file of ARC-002 on the head, its removal is recorded");
  assert.deepEqual(fieldsOf(record("ARC-002", EMPTY), positive.files()[record("ARC-002", EMPTY)]),
    { kind: "architecture-decision", file: ARC2_PATH, blob: EMPTY });
});
