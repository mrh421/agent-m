// A repository source gets a new version as a newer commit (ITM-705) — MOD-source-register's versionCommits(entry, files, version) with `version.commit`, as the accepted text of
// docs/architecture/MOD-source-register.md states it (Interfaces: "For a source of kind repository, `commit` is the commit read, which the row records (`A LIVING SOURCE IS PINNED`); its
// `files` may be none, and its bytes are that commit. Throws `SameBytes { version }` when its files' hashes, or for a repository its commit, equal those of an existing version"), for UC-016
// step 1 and 1a. Where the texts leave a reading open, the test states the reading it takes:
//   - The commit is recorded in the cell `Read from` of the new row after the entry's `identifier`, `<repository address> commit <commit>`, the form in which the registration of a repository
//     writes its first version (MOD-settings-pages' route library, "Read from" of a repository), and an existing version's commit is read from that cell in the same form.
//   - A version with a commit is the same as an existing version when that version records the same commit; its files, which it may not have, are not compared.
// Run: node --test tests/source-register-version-commit.test.mjs
//
// Module: MOD-source-register
// Guards: UC-016; A LIVING SOURCE IS PINNED; A SOURCE VERSION IS NEVER OVERWRITTEN; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect); the expected texts are written out here, not read from a document. Nothing reaches the
// network. The counter-proofs (a planted fault in src/source-register/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readDocument } from "../src/documents/index.mjs";
import * as sourceRegister from "../src/source-register/index.mjs";

const { sourceSchemas, registrationCommits, versionCommits } = sourceRegister;
const INSTANCE = "akmaier/agent-m";
const GUIDE = "https://github.com/erin/guide";
const C1 = "96210fa4bf2c1cb0c5bc69339eb4c04c840f7f1b", C2 = "240ddc98fbd96ee987230e72d664cfd892e6574e", C3 = "fc67b7a00668ea188178faaeba58f2879def5dec";

const readEntry = (text) => readDocument(sourceSchemas().entry, "docs/sources/SRC-guide.md", text);
// The entry of the registration of a repository as the form hands it over: the first version's row, read from the repository at the commit C1, with no files.
const FORM = readEntry(["---", "id: SRC-guide", "title: Erin's guide", "kind: system", "authority: normative", "licence: may be republished — MIT", `identifier: ${GUIDE}`, "---",
  "# SRC-guide Erin's guide", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`2026-10-01\` | 2026-10-01 | — | ${GUIDE} commit ${C1} | pending |`, ""].join("\n"));
const writtenEntry = (plan) => {
  const file = plan.find((commit) => commit.repository === INSTANCE).files.find((each) => each.path === "docs/sources/SRC-guide.md");
  return { text: file.content, entry: readDocument(sourceSchemas().entry, "docs/sources/SRC-guide.md", file.content) };
};
const rowsOf = (entry) => entry.sections.find((section) => section.heading === "## Versions").rows;
// The entry as the repository route writes it: the first version registered, as registrationCommits writes it.
const registered = async () => writtenEntry(await registrationCommits(FORM, [], INSTANCE));
const later = (version, commit) => ({ version, date: version, repository: INSTANCE, commit });

// TST-705001 · level: unit · module: MOD-source-register
// guards: UC-016; A LIVING SOURCE IS PINNED; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: the entry SRC-guide of a repository source, identifier https://github.com/erin/guide, registered with its first version 2026-10-01 read at the commit 96210fa4… and no file
// input: versionCommits(entry, [], { version: "2026-11-01", date: "2026-11-01", repository: "akmaier/agent-m", commit: "240ddc98…" }), and the register entry of the plan read back
// expect: the call resolves — the first version's file set is as empty as the new one's, and that is no reason to refuse it; the plan has one commit, to akmaier/agent-m, holding exactly docs/sources/SRC-guide.md; the entry keeps the row of 2026-10-01 line for line and has the row of 2026-11-01 after it, its date 2026-11-01 and its Read from `https://github.com/erin/guide commit 240ddc98fbd96ee987230e72d664cfd892e6574e`; its Files cell is the first version's, since both have no file (a further version goes the way the first one went)
test("versionCommits — a repository's new version with a commit and no file records the commit in its row, and earlier rows stay as they were", async () => {
  assert.equal(typeof versionCommits, "function", "the module provides versionCommits");
  const first = await registered();
  const plan = await versionCommits(first.entry, [], later("2026-11-01", C2));
  assert.deepEqual(plan.map((commit) => commit.repository), [INSTANCE]);
  assert.deepEqual(plan[0].files.map((file) => file.path), ["docs/sources/SRC-guide.md"]);
  const { text, entry } = writtenEntry(plan);
  const firstRow = first.text.split("\n").find((line) => line.startsWith("| `2026-10-01`"));
  assert.equal(text.includes(firstRow), true, "the row of 2026-10-01 stays as it was");
  const rows = rowsOf(entry);
  assert.deepEqual(rows.map((row) => row.cells.Version), ["`2026-10-01`", "`2026-11-01`"]);
  assert.equal(rows[1].cells.Date, "2026-11-01");
  assert.equal(rows[1].cells["Read from"], `${GUIDE} commit ${C2}`);
  assert.equal(rows[1].cells.Files, rows[0].cells.Files);
});

// TST-705002 · level: unit · module: MOD-source-register
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN; A LIVING SOURCE IS PINNED
// given: the same entry with the versions 2026-10-01 (commit 96210fa4…) and 2026-11-01 (commit 240ddc98…)
// input: versionCommits(entry, [], …) with the commit 96210fa4…, then with 240ddc98…, then with fc67b7a0…
// expect: the first rejects with the failure named SameBytes whose field version is "2026-10-01" and whose message is "SRC-guide already records the same bytes as 2026-10-01"; the second the same naming "2026-11-01"; the third resolves with a plan (a commit no version records is a new version)
test("versionCommits — the commit of an existing version is refused as SameBytes, naming that version; another commit is recorded", async () => {
  const first = await registered();
  const both = writtenEntry(await versionCommits(first.entry, [], later("2026-11-01", C2))).entry;
  for (const [commit, version] of [[C1, "2026-10-01"], [C2, "2026-11-01"]]) {
    await assert.rejects(() => versionCommits(both, [], later("2026-12-01", commit)),
      (error) => error.name === "SameBytes" && error.version === version && error.message === `SRC-guide already records the same bytes as ${version}`);
  }
  const plan = await versionCommits(both, [], later("2026-12-01", C3));
  assert.deepEqual(rowsOf(writtenEntry(plan).entry).map((row) => row.cells["Read from"]), [`${GUIDE} commit ${C1}`, `${GUIDE} commit ${C2}`, `${GUIDE} commit ${C3}`]);
});

// TST-925002 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: the entry SRC-guide of a repository source with the versions 2026-10-01 (commit 96210fa4…) and 2026-11-01 (commit 240ddc98…)
// input: versionCommits(entry, [], …) with the version 2026-10-01 and the commit fc67b7a0… (a commit no version records), and with the version 2026-12-01 and the same commit
// expect: the first rejects with VersionExists whose field version is "2026-10-01" and nothing is returned; the second resolves with a plan (a new identifier with a new commit is a new version)
test("versionCommits — a repository's new commit under the identifier of an existing version is refused as VersionExists", async () => {
  const first = await registered();
  const both = writtenEntry(await versionCommits(first.entry, [], later("2026-11-01", C2))).entry;
  await assert.rejects(() => versionCommits(both, [], later("2026-10-01", C3)), (error) => error.name === "VersionExists" && error.version === "2026-10-01");
  const plan = await versionCommits(both, [], later("2026-12-01", C3));
  assert.deepEqual(rowsOf(writtenEntry(plan).entry).map((row) => row.cells.Version), ["`2026-10-01`", "`2026-11-01`", "`2026-12-01`"]);
});
