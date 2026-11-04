// An EU legal text fetched, and a new version of a source (ITM-385) -- MOD-source-register's fetchLegalText(identifier)
// and versionCommits(entry, files, version), as docs/architecture/MOD-source-register.md states them: the official text
// from the EU publication repository with retrieval date and repository version identifier, NotFound and Unreachable by
// name, and a new source version appended with SHA-256 hashes while earlier versions stay unchanged. The waiting state of
// a legal-text entry is derived from its recognised identifier and empty versions.
// Run: node --test tests/source-register-version-fetch.test.mjs
//
// Module: MOD-source-register
// Guards: UC-004; UC-016; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// Guards: A SOURCE VERSION IS NEVER OVERWRITTEN; A LIVING SOURCE IS PINNED
// Level: unit
//
// The publication repository is replaced by a local fixture server. Each test states its input and expected result before
// it runs. A name the module does not provide yet is undefined here, so that the tests-only commit is red at the public
// interface before any source change. The counter-proofs are recorded in the sprint review.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readDocument, writeDocument } from "../src/documents/index.mjs";
import * as sourceRegister from "../src/source-register/index.mjs";

const { fetchLegalText, recogniseLegalText, sourceSchemas, versionCommits } = sourceRegister;

const INSTANCE = "alice/requirements";
const encode = (text) => new TextEncoder().encode(text);
const textOf = (bytes) => new TextDecoder().decode(bytes);
const hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const versionHashOf = (files) => hex(files.map((file) => ({ name: file.name, sha: hex(file.bytes) }))
  .sort((a, b) => (a.name < b.name ? -1 : 1)).map((file) => `${file.sha}  ${file.name}\n`).join(""));

const BODY = "<html><body><p>Artificial Intelligence Act</p></body></html>\n";
const ANNEX = "Annex I\n";
const FILES = [
  { name: "32024R1689.xhtml", bytes: encode(BODY), keep: true },
  { name: "annex.txt", bytes: encode(ANNEX), keep: true },
];

async function withFixture(answer, body) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, accept: request.headers.accept ?? "" });
    response.writeHead(answer.status ?? 200, answer.headers ?? {});
    response.end(answer.body ?? "");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = `http://127.0.0.1:${server.address().port}`;
  const original = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    const parsed = new URL(String(url));
    return original(`${address}${parsed.pathname}${parsed.search}`, init);
  };
  try {
    return await body({ requests });
  } finally {
    globalThis.fetch = original;
    await new Promise((resolve) => server.close(resolve));
  }
}

function entryOf(text, id = "SRC-ai-act") {
  return readDocument(sourceSchemas().entry, `docs/sources/${id}.md`, text);
}

function existingEntry() {
  return entryOf([
    "---",
    "id: SRC-ai-act",
    "title: Artificial Intelligence Act",
    "kind: regulation",
    "authority: normative",
    "licence: may be republished - EU legal text",
    "identifier: 32024R1689",
    "---",
    "# SRC-ai-act Artificial Intelligence Act",
    "",
    "## Versions",
    "",
    "| Version | Date | Edition | Read from | Files |",
    "|---|---|---|---|---|",
    "| `2024-06-01` | 2024-06-01 | first publication | publication repository | 1 file, listed below; version hash `" + versionHashOf([{ name: "old.xhtml", bytes: encode("old text\n") }]) + "` |",
    "",
    "### Files of 2024-06-01",
    "",
    "| File | SHA-256 |",
    "|---|---|",
    "| `old.xhtml` | `" + hex(encode("old text\n")) + "` |",
    "",
    "## Parts",
    "",
    "| Part | Applies to |",
    "|---|---|",
    "| whole text | all files |",
    "",
  ].join("\n"));
}

function waitingEntry(identifier = "32024R1689") {
  return entryOf([
    "---",
    "id: SRC-ai-act",
    "title: Artificial Intelligence Act",
    "kind: regulation",
    "authority: normative",
    "licence: may be republished - EU legal text",
    `identifier: ${identifier}`,
    "---",
    "# SRC-ai-act Artificial Intelligence Act",
    "",
    "## Versions",
    "",
    "| Version | Date | Edition | Read from | Files |",
    "|---|---|---|---|---|",
    "",
  ].join("\n"));
}

const writtenEntry = (plan, id = "SRC-ai-act") => {
  const item = plan.find((commit) => commit.repository === INSTANCE).files.find((file) => file.path === `docs/sources/${id}.md`);
  return { text: item.content, entry: entryOf(item.content, id) };
};

// TST-385001 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a CELEX identifier and a fixture publication repository answer with a Date header, ETag repository version and filename
// input: fetchLegalText({ celex: "32024R1689" })
// expect: one fetched file with the fixture bytes, retrieved date 2024-07-16, repositoryVersion cellar-2024-07-12, and a request to /resource/celex/32024R1689?language=eng
// TST-584014 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a CELEX identifier and a fixture publication repository answer with a Date header, ETag repository version and filename
// input: fetchLegalText({ celex: "32024R1689" })
// expect: one fetched file with the fixture bytes, retrieved date 2024-07-16, repositoryVersion cellar-2024-07-12, and a request to /resource/celex/32024R1689?language=eng
test("fetchLegalText - fetches a CELEX text with retrieval date, repository version and bytes", async () => {
  assert.equal(typeof fetchLegalText, "function", "the module provides fetchLegalText");
  await withFixture({
    headers: {
      "content-type": "application/xhtml+xml",
      "content-disposition": "attachment; filename=\"32024R1689.xhtml\"",
      date: "Tue, 16 Jul 2024 12:00:00 GMT",
      etag: "\"cellar-2024-07-12\"",
    },
    body: BODY,
  }, async ({ requests }) => {
    const fetched = await fetchLegalText({ celex: "32024R1689" });
    assert.deepEqual(requests.map((request) => request.url), ["/resource/celex/32024R1689?language=eng"]);
    assert.match(requests[0].accept, /application\/xhtml\+xml/);
    assert.equal(fetched.retrieved, "2024-07-16");
    assert.equal(fetched.repositoryVersion, "cellar-2024-07-12");
    assert.deepEqual(fetched.files.map((file) => file.name), ["32024R1689.xhtml"]);
    assert.equal(textOf(fetched.files[0].bytes), BODY);
  });
});

// TST-385002 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: an ELI identifier
// input: fetchLegalText({ eli: "http://data.europa.eu/eli/reg/2024/1689/oj" })
// expect: the publication repository is requested through /resource/eli/reg/2024/1689/oj?language=eng
// TST-584015 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: an ELI identifier
// input: fetchLegalText({ eli: "http://data.europa.eu/eli/reg/2024/1689/oj" })
// expect: the publication repository is requested through /resource/eli/reg/2024/1689/oj?language=eng
test("fetchLegalText - fetches an ELI text through the publication repository's ELI resource", async () => {
  assert.equal(typeof fetchLegalText, "function", "the module provides fetchLegalText");
  await withFixture({
    headers: { "content-type": "text/plain", date: "Tue, 16 Jul 2024 12:00:00 GMT", etag: "\"eli-version\"" },
    body: "AI Act\n",
  }, async ({ requests }) => {
    const fetched = await fetchLegalText({ eli: "http://data.europa.eu/eli/reg/2024/1689/oj" });
    assert.deepEqual(requests.map((request) => request.url), ["/resource/eli/reg/2024/1689/oj?language=eng"]);
    assert.deepEqual(fetched.files.map((file) => file.name), ["reg-2024-1689-oj.txt"]);
  });
});

// TST-385003 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a publication repository 404, and then an unreachable fetch
// input: fetchLegalText(identifier) for each
// expect: NotFound names the address; Unreachable names the reason; neither returns guessed files
// TST-584016 · level: unit · module: MOD-source-register
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a publication repository 404, and then an unreachable fetch
// input: fetchLegalText(identifier) for each
// expect: NotFound names the address; Unreachable names the reason; neither returns guessed files
test("fetchLegalText - names NotFound and Unreachable, and guesses no text", async () => {
  assert.equal(typeof fetchLegalText, "function", "the module provides fetchLegalText");
  await withFixture({ status: 404, body: "not here" }, async () => {
    await assert.rejects(fetchLegalText({ celex: "32024R1689" }),
      (error) => error.name === "NotFound" && /resource\/celex\/32024R1689/.test(error.address));
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fixture offline"); };
  try {
    await assert.rejects(fetchLegalText({ celex: "32024R1689" }),
      (error) => error.name === "Unreachable" && /fixture offline/.test(error.reason));
  } finally {
    globalThis.fetch = original;
  }
});

// TST-385004 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A SOURCE VERSION IS NEVER OVERWRITTEN; UC-004
// given: a source entry with one existing version, and two fetched files for a newer version
// input: versionCommits(entry, files, { version, date, retrieved, repositoryVersion, repository: INSTANCE })
// expect: the instance plan appends the new row and files with SHA-256s and the version hash; the earlier version block remains byte for byte
// TST-584017 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A SOURCE VERSION IS NEVER OVERWRITTEN; UC-004
// given: a source entry with one existing version, and two fetched files for a newer version
// input: versionCommits(entry, files, { version, date, retrieved, repositoryVersion, repository: INSTANCE })
// expect: the instance plan appends the new row and files with SHA-256s and the version hash; the earlier version block remains byte for byte
test("versionCommits - appends a new version with file hashes while earlier versions stay unchanged", async () => {
  assert.equal(typeof versionCommits, "function", "the module provides versionCommits");
  const entry = existingEntry();
  const oldRow = "| `2024-06-01` | 2024-06-01 | first publication | publication repository | 1 file, listed below; version hash `"
    + versionHashOf([{ name: "old.xhtml", bytes: encode("old text\n") }]) + "` |";
  const oldFiles = [
    "### Files of 2024-06-01",
    "",
    "| File | SHA-256 |",
    "|---|---|",
    "| `old.xhtml` | `" + hex(encode("old text\n")) + "` |",
  ].join("\n");
  const plan = await versionCommits(entry, FILES, {
    version: "2024-07-12",
    date: "2024-07-12",
    retrieved: "2024-07-16",
    repositoryVersion: "cellar-2024-07-12",
    repository: INSTANCE,
  });
  assert.deepEqual(plan.map((commit) => commit.repository), [INSTANCE]);
  assert.deepEqual(plan[0].files.map((file) => file.path).sort(), [
    "docs/sources/SRC-ai-act.md",
    "docs/sources/SRC-ai-act/2024-07-12/32024R1689.xhtml",
    "docs/sources/SRC-ai-act/2024-07-12/annex.txt",
  ]);
  const { entry: written, text } = writtenEntry(plan);
  assert.ok(text.includes(oldRow), "the earlier version row is byte for byte still present");
  assert.ok(text.includes(oldFiles), "the earlier version's file block is byte for byte still present");
  const appended = written.sections[0].rows.at(-1);
  assert.deepEqual(appended.cells, {
    Version: "`2024-07-12`",
    Date: "2024-07-12",
    Edition: "-",
    "Read from": "publication repository, retrieved 2024-07-16, version cellar-2024-07-12",
    Files: `2 files, listed below; version hash \`${versionHashOf(FILES)}\``,
  });
  const filesBlock = written.sections[0].text.slice(written.sections[0].text.indexOf("### Files of 2024-07-12"));
  for (const file of FILES) assert.ok(filesBlock.includes(`| \`${file.name}\` | \`${hex(file.bytes)}\` |`), file.name);
  assert.equal(writeDocument(sourceSchemas().entry, written), text, "the appended entry remains canonical");
});

// TST-385005 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS NEVER OVERWRITTEN; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: an entry whose existing version already records the same file name and bytes
// input: versionCommits(entry, [{ name: "old.xhtml", bytes: old text, keep: true }], a new version)
// expect: SameBytes names the existing version and no commit plan is returned
// TST-584018 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS NEVER OVERWRITTEN; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: an entry whose existing version already records the same file name and bytes
// input: versionCommits(entry, [{ name: "old.xhtml", bytes: old text, keep: true }], a new version)
// expect: SameBytes names the existing version and no commit plan is returned
test("versionCommits - SameBytes refuses a byte set that is already recorded", async () => {
  assert.equal(typeof versionCommits, "function", "the module provides versionCommits");
  const same = [{ name: "old.xhtml", bytes: encode("old text\n"), keep: true }];
  await assert.rejects(versionCommits(existingEntry(), same, { version: "2024-07-12", date: "2024-07-12", repository: INSTANCE }),
    (error) => error.name === "SameBytes" && error.version === "2024-06-01");
});

// TST-385006 · level: unit · module: MOD-source-register
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-004
// given: one legal-text source entry with no version, one with a version, and one non-EU identifier with no version
// input: the derived predicate: identifier recognised by recogniseLegalText and ## Versions has no row
// expect: only the recognised legal-text entry with no row waits for its fetch
// TST-584019 · level: unit · module: MOD-source-register
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-004
// given: one legal-text source entry with no version, one with a version, and one non-EU identifier with no version
// input: the derived predicate: identifier recognised by recogniseLegalText and ## Versions has no row
// expect: only the recognised legal-text entry with no row waits for its fetch
test("legal-text fetch waiting state is derived from the recognised identifier and empty versions", () => {
  const waitsForFetch = (entry) => Boolean(recogniseLegalText(entry.fields.identifier))
    && (entry.sections.find((section) => section.heading === "## Versions")?.rows ?? []).length === 0;
  assert.equal(waitsForFetch(waitingEntry("https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689")), true);
  assert.equal(waitsForFetch(existingEntry()), false);
  assert.equal(waitsForFetch(waitingEntry("https://example.org/legal")), false);
});

// TST-925001 · level: unit · module: MOD-source-register
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: an entry whose existing version 2024-06-01 records old.xhtml with the bytes "old text"; known positive: a new version 2024-07-12 with other bytes resolves
// input: versionCommits(entry, [new.xhtml with other bytes], { version: "2024-06-01", … }) — the identifier of the existing version, other bytes; and the same with bytes that equal the existing version's
// expect: the first rejects with the failure named VersionExists whose field version is "2024-06-01" and whose message names that identifier, and no plan is returned (nothing is recorded); the second is refused as SameBytes, which keeps precedence (MOD-source-register: onSourcesCommitted catches only SameBytes)
test("versionCommits - a new version with the identifier of an existing version and other bytes is refused as VersionExists", async () => {
  const other = [{ name: "new.xhtml", bytes: encode("new text\n"), keep: true }];
  const plan = await versionCommits(existingEntry(), other, { version: "2024-07-12", date: "2024-07-12", repository: INSTANCE });
  assert.equal(plan.length > 0, true, "known positive: a new identifier with other bytes is recorded");
  await assert.rejects(versionCommits(existingEntry(), other, { version: "2024-06-01", date: "2024-07-12", repository: INSTANCE }),
    (error) => error.name === "VersionExists" && error.version === "2024-06-01" && error.message.includes("2024-06-01"));
  const same = [{ name: "old.xhtml", bytes: encode("old text\n"), keep: true }];
  await assert.rejects(versionCommits(existingEntry(), same, { version: "2024-06-01", date: "2024-07-12", repository: INSTANCE }),
    (error) => error.name === "SameBytes" && error.version === "2024-06-01");
});
