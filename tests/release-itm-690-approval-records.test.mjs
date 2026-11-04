// Release tests of ITM-690 — the approval records are checked through MOD-approvals (the rewritten tests/test_approval_records.py), and the old review core is gone. They guard the two requirements the item realises: STATUS IS DERIVED FROM THE RECORDS and EVERY CODE FILE BELONGS TO A MODULE.
// Written from the SPEC's texts: "A reviewed file counts as accepted exactly when an approval record names its current blob SHA" (STATUS IS DERIVED FROM THE RECORDS) and "every test and test helper names in its header a module of the architecture" (EVERY CODE FILE BELONGS TO A MODULE); and from docs/architecture/MOD-approvals.md (`statuses`: open, accepted or changed; a record path is docs/approvals/<ID>-<blob12>.md).
// Run: node --test tests/release-itm-690-approval-records.test.mjs
//
// Module: MOD-approvals
// Guards: STATUS IS DERIVED FROM THE RECORDS; EVERY CODE FILE BELONGS TO A MODULE
// Level: release
//
// Written for the release testing of sprint team1/133 by a participant who implemented none of ITM-690 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The item is a refactoring with no use case of its own; the cases reach the behaviour as the product does:
// statuses of the real MOD-approvals over this repository's own tree, and the header of the rewritten test file read by the real MOD-test-document.
// Readings the texts leave open, which the cases state:
//   - A record "names" a file's current blob when a path docs/approvals/<ID>-<blob12>.md exists for the file's identifier whose blob12 is the first twelve hex digits of the file's git blob SHA; the status is then "accepted", else "changed" if some record names the identifier, else "open".
//   - The file's blob SHA is git's: sha1 of "blob <bytes>\0" and the bytes, computed here without the module's own text-tools.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { statuses } from "../src/approvals/index.mjs";
import { testHeader } from "../src/test-document/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const blobOf = (bytes) => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

// TST-690001 · level: release · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: this repository's use cases and architecture files, each with its git blob SHA, and its docs/approvals/ records
// input: statuses over a snapshot of those paths and blobs; the expected status of each file is worked out here from the record names alone
// expect: a file whose identifier has a record naming its current blob12 is accepted, a file whose identifier has records but none naming the current blob is changed, any other is open; the three statuses all occur (known positive), and the two sets agree for every file
// Planted fault: statuses deriving "accepted" from any record of the identifier (`blob12s.some(...)` of src/approvals/status.mjs:90 replaced by `blob12s.length`) leaves the tree check passing (every record there names the current text) and the case fails on the fixture: "an edited text counts as accepted though no record names it".
test("TST-690001 the status of every reviewed file is accepted exactly when a record names its current blob", () => {
  const rel = (full) => relative(ROOT, full).split("\\").join("/");
  const reviewed = ["docs/use-cases", "docs/architecture"].flatMap((dir) => walk(join(ROOT, dir)).map(rel)).filter((p) => /\/(UC-\d+-|ARC-\d+-|MOD-)[^/]*\.md$/.test(p));
  const records = readdirSync(join(ROOT, "docs/approvals")).filter((f) => /^.+-[0-9a-f]{12}\.md$/.test(f));
  const blobs = Object.fromEntries(reviewed.map((p) => [p, blobOf(readFileSync(join(ROOT, p)))]));
  const paths = [...reviewed, ...records.map((f) => `docs/approvals/${f}`)];
  const result = statuses({ paths, blob: (p) => blobs[p] ?? null });

  const idOf = (p) => { const name = p.split("/").pop().slice(0, -3); return /^MOD-/.test(name) ? name : /^[A-Z]+-\d+/.exec(name)[0]; };
  const expected = (p) => {
    const own = records.filter((f) => f.slice(0, -16) === idOf(p));
    if (own.some((f) => f.slice(-15, -3) === blobs[p].slice(0, 12))) return "accepted";
    return own.length ? "changed" : "open";
  };
  const wrong = reviewed.filter((p) => result.get(p)?.status !== expected(p)).map((p) => `${p}: ${result.get(p)?.status} instead of ${expected(p)}`);
  assert.ok(result.size >= 100 && reviewed.some((p) => expected(p) === "accepted"), `known positive: the tree's reviewed files are found and some are accepted (${result.size})`);
  assert.deepEqual(wrong, [], "failure node: statuses disagrees with the records' names");

  // The three statuses from one fixture: a text edited after its acceptance is changed, not accepted.
  const text = Buffer.from("# UC-900 Fixture\n"), edited = Buffer.from("# UC-900 Fixture, edited\n");
  const uc = "docs/use-cases/UC-900-fixture.md", record = `docs/approvals/UC-900-${blobOf(text).slice(0, 12)}.md`;
  const status = (current, other) => statuses({ paths: [uc, "docs/use-cases/UC-901-other.md", record], blob: (p) => ({ [uc]: blobOf(current), "docs/use-cases/UC-901-other.md": blobOf(other) })[p] ?? null });
  assert.equal(status(text, text).get(uc).status, "accepted", "known positive: the record names the current text");
  assert.equal(status(edited, text).get(uc).status, "changed", "failure node: an edited text counts as accepted though no record names it");
  assert.equal(status(text, text).get("docs/use-cases/UC-901-other.md").status, "open", "a file with no record is open");
});

// TST-690002 · level: release · module: MOD-approvals
// guards: EVERY CODE FILE BELONGS TO A MODULE
// given: tests/test_approval_records.py, the file the item rewrites, and the module files under docs/architecture/
// input: testHeader reads the file's header; every module it names is looked up as docs/architecture/<MOD>.md; the old core docs/assets/review-core.mjs is looked up
// expect: the header names MOD-approvals (a known positive: the header names at least one module), every module it names has a file in docs/architecture/, and docs/assets/review-core.mjs no longer exists
// Planted fault: the line `# Module: MOD-approvals` deleted from the file's header makes the header name no module, and the case fails on the known positive.
test("TST-690002 the rewritten approval-record test names a module of the architecture and the old review core is gone", () => {
  const path = "tests/test_approval_records.py";
  const header = testHeader(path, readFileSync(join(ROOT, path), "utf8"));
  assert.ok(header && header.modules.length >= 1, `known positive: the header names a module (${header?.modules})`);
  assert.ok(header.modules.includes("MOD-approvals"), "failure node: the header does not name MOD-approvals");
  const missing = header.modules.filter((m) => !readdirSync(join(ROOT, "docs/architecture")).includes(`${m}.md`));
  assert.deepEqual(missing, [], "a module named in the header is no module of the architecture");
  assert.throws(() => statSync(join(ROOT, "docs/assets/review-core.mjs")), { code: "ENOENT" }, "the old review core is still there");
});
