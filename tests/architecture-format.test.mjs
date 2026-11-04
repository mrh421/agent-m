// The format of ARC and MOD files and the requirement names of a SPEC, as MOD-documents reads and checks them (artifactSchemaOf,
// readDocument, documentFindings, by the decision and module schemas artifactSchemas gives) and as MOD-spec-document reads a
// SPEC (parseSpec). Deterministic, no network.
// Run: node --test tests/*.test.mjs
//
// Module: MOD-documents
// Guards: ONE REVIEW LAYOUT FOR EVERY PRODUCT; ONE ARCHITECTURE DECISION, ONE FILE; ONE MODULE, ONE FILE; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-022; UC-023
// Level: unit
//
// SPEC §11 ONE ARCHITECTURE DECISION, ONE FILE · ONE MODULE, ONE FILE; §10 ONE REVIEW LAYOUT FOR EVERY PRODUCT (UC-022,
// UC-023). The product is the fixture under tests/fixtures/architecture/; no test reads the repository's own SPEC.md.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactSchemaOf, artifactSchemas, readDocument, documentFindings } from "../src/documents/index.mjs";
import { parseSpec } from "../src/spec-document/index.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const files = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else files[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md";
const REVIEW = "docs/architecture/MOD-review.md", PAGE = "docs/architecture/MOD-page.md";
const UC1 = "docs/use-cases/UC-001-read-a-file.md";

// A file read by the schema its path names, and the findings of that schema on it.
const read = (path, text) => readDocument(artifactSchemaOf(path), path, text);
const findings = (path, text) => documentFindings(artifactSchemaOf(path), read(path, text));
// The identifier of a reviewed file from its path alone: the document of an empty text, whose identifier is its path's.
const idOfPath = (path) => (artifactSchemaOf(path) ? read(path, "").id : null);

// ---------------------------------------------------------------- identifiers and kinds

test("ONE REVIEW LAYOUT FOR EVERY PRODUCT — ARC and MOD files are reviewed files with identifiers from their names", () => {
  assert.equal(idOfPath(ARC), "ARC-001");
  assert.equal(idOfPath("docs/architecture/ARC-001-renamed-since.md"), "ARC-001");
  assert.equal(idOfPath(READER), "MOD-reader");
  assert.equal(idOfPath("docs/architecture/MOD-review-core.md"), "MOD-review-core", "the whole slug is the identifier");
  assert.equal(idOfPath("docs/architecture/MOD-123-x.md"), "MOD-123-x", "a module is not read as an ARC-like number");
  assert.equal(idOfPath("docs/architecture/README.md"), null);
  assert.equal(artifactSchemaOf(ARC), artifactSchemas().decision);
  assert.equal(artifactSchemaOf(READER), artifactSchemas().module);
  assert.equal(artifactSchemaOf(UC1), artifactSchemas().useCase);
  assert.equal(artifactSchemaOf("docs/architecture/notes.md"), null);
});

// ---------------------------------------------------------------- the format

test("a decision — id, title, forced_by, and its four sections", () => {
  const a = read(ARC, files[ARC]);
  assert.equal(a.kind, "decision");
  assert.equal(a.id, "ARC-001");
  assert.equal(a.fields.title, "The dashboard is a static client of the Git server's API");
  assert.deepEqual(a.fields.forced_by, ["RULE ONE", "UC-001"]);
  assert.deepEqual(findings(ARC, files[ARC]), []);
  assert.ok(findings(ARC, files[ARC].replace("  - RULE ONE\n  - UC-001\n", "")).some((f) => /forced_by/.test(f.what)),
    "a decision names what forces it");
  assert.ok(findings(ARC, files[ARC].replace("## Alternatives\n", "")).some((f) => /Alternatives/.test(f.what)));
});

test("a module — folder, realises, follows, uses MOD-x.interface, provides, and its sections", () => {
  const m = read(REVIEW, files[REVIEW]);
  assert.equal(m.kind, "module");
  assert.equal(m.id, "MOD-review");
  assert.deepEqual(m.fields.realises, ["THE READER'S RULE", "UC-002"]);
  assert.deepEqual(m.fields.follows, ["ARC-001"]);
  assert.deepEqual(m.fields.uses, ["MOD-reader.readFile", "MOD-reader.listTree", "MOD-store.load"]);
  assert.deepEqual(m.fields.provides, ["status"]);
  assert.match(m.sections.find((s) => s.heading === "## Interfaces").text,
    /^- `status\(path\) -> "open" \| "accepted" \| "changed"`\n {2}— derived, never stored\.$/m);
  assert.deepEqual(findings(REVIEW, files[REVIEW]), []);
  const page = read(PAGE, files[PAGE]);
  assert.deepEqual([page.fields.realises, page.fields.provides, findings(PAGE, files[PAGE])], [[], [], []], "empty lists are lists");
  // Counter-proof: a use of an interface not written MOD-x.name, a provided interface nobody describes, and an identifier that
  // differs from the file name.
  assert.ok(findings(REVIEW, files[REVIEW].replace("  - MOD-reader.readFile\n", "  - readFile\n")).length);
  assert.ok(findings(REVIEW, files[REVIEW].replace("  - status\n", "  - status\n  - history\n")).some((f) => /history/.test(f.what)),
    "a provided interface nobody describes");
  assert.ok(findings("docs/architecture/MOD-other.md", files[REVIEW]).some((f) => /MOD-review/.test(f.what)), "id differs from the file name");
});

// ---------------------------------------------------------------- ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS

// The requirements planted after the fixture's sections in the test below, in the shapes the repository's own SPEC has.
const LATER = [
  "## 85. Later rules",
  "",
  "**RULE ONE REPLACES IT** *(PO)*",
  "The rule that replaces an old one.",
  "*Check:* none",
  "",
  "**A RENAMED RULE IS WITHDRAWN AND ADDED** *(PO)*",
  "A rule whose name holds the word WITHDRAWN.",
  "*Check:* none",
  "",
].join("\n");

test("parseSpec — the names in SPEC.md; a source over two lines is read whole; prose in bold is no requirement", () => {
  const r = parseSpec(files["SPEC.md"]).requirements;
  assert.deepEqual([...r.keys()], ["RULE ONE", "THE READER'S RULE", "OLD RULE"]);
  assert.match(r.get("THE READER'S RULE").source, /extended\n2026-09-30$/, "a source that runs over two lines is read whole");
  assert.equal(r.has("Form of a requirement"), false);
  // The known positive, on fixture text — no test reads the repository's own SPEC.md (ITM-128): the fixture's section under 84
  // headings of its own, then requirements in the shapes the real SPEC supplied.
  const sections = Array.from({ length: 84 }, (_, i) => files["SPEC.md"]
    .replace("## 1. Rules", `## ${i + 1}. Rules`)
    .replace(/^\*\*([^*\n]+)\*\* \*\(/gm, `**$1 ${i + 1}** *(`));
  const long = parseSpec([...sections, LATER].join("\n")).requirements;
  assert.ok(long.size > 250);
  assert.ok(long.has("RULE ONE REPLACES IT"));
  assert.ok(long.has("A RENAMED RULE IS WITHDRAWN AND ADDED"));
});
