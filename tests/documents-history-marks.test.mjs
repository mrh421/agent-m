// The marks of history in a document — MOD-documents' documentFindings as docs/architecture/MOD-documents.md states it: "…
// and, for a `noHistory` schema, each mark of history (`A DOCUMENT HOLDS NO HISTORY`)", through MOD-text-tools' historyMarks,
// which its Uses name for "the marks of history in a document whose schema forbids them".
// Run: node --test tests/documents-history-marks.test.mjs
//
// Module: MOD-documents
// Guards: A DOCUMENT HOLDS NO HISTORY
// Level: unit
//
// The documents are the decision and the use case of the fixtures, read by the schemas the module owns (artifactSchemas), and
// a note and a record of key: value lines read by schemas written here; each broken text is a copy with one change. Readings,
// each named: a mark is what historyMarks finds, of its three kinds, and the finding names it with its kind and its text as
// historyMarks gives them; its line counts from 1 in the whole text, front matter included, as historyMarks counts it — so a
// mark in a front matter value stands on its key's line, and one in a record of key: value lines on its own line; a schema
// that does not say `noHistory: true` is not checked for marks. Each test states its input and its expected result before it
// runs; the counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as documents from "../src/documents/index.mjs";
import { formatFinding } from "../src/text-tools/index.mjs";

const { decision, useCase } = documents.artifactSchemas();
const NO_HISTORY = "A DOCUMENT HOLDS NO HISTORY";
const ARC = readFileSync(new URL("./fixtures/architecture/docs/architecture/ARC-001-static-client.md", import.meta.url), "utf8");
const ARC_PATH = "docs/architecture/ARC-001-static-client.md";
const UC = readFileSync(new URL("./fixtures/use-cases/UC-001-complete.md", import.meta.url), "utf8");
const UC_PATH = "docs/use-cases/UC-001-complete.md";

// A copy of a text with one change: `from` must occur exactly once.
function changed(text, from, to) {
  assert.equal(text.split(from).length - 1, 1, `the changed text occurs once: ${JSON.stringify(from)}`);
  return text.replace(from, () => to);
}

const read = (schema, path, text) => documents.documentFindings(schema, documents.readDocument(schema, path, text));
// The findings of a document, each as [line, rule, what].
const findingsOf = (schema, path, text) => read(schema, path, text).map((f) => [f.line, f.rule, f.what]);
const mark = (line, kind, text) => [line, NO_HISTORY, `the document holds a mark of history (${kind}): "${text}"`];

// A schema written here, loaded as its owner loads it.
const load = (schema) => documents.loadSchema(`# The ${schema.schema} schema\n\n\`\`\`json\n${JSON.stringify(schema)}\n\`\`\`\n`,
  "MOD-example");

// TST-1396001 · level: unit · module: MOD-documents
// guards: A DOCUMENT HOLDS NO HISTORY; UC-022
// given: the fixture's decision ARC-001, complete, read by the decision schema, whose noHistory is true; and a copy whose line 12 reads "The product has no server of its own. Changed on 2026-10-01: it was one folder before."
// input: documentFindings of each
// expect: known positive — none for the complete decision; for the copy exactly one error, on line 12, under A DOCUMENT HOLDS NO HISTORY: `ARC-001:12: error: the document holds a mark of history (edit-stamp): "Changed on 2026-10-01" [A DOCUMENT HOLDS NO HISTORY] — remove it; the version history keeps what was changed, when and by whom.`
test("documentFindings — a decision that carries a stamp of change is an error at the stamp's line", () => {
  assert.deepEqual(findingsOf(decision, ARC_PATH, ARC), [], "known positive: the complete decision");
  const stamped = changed(ARC, "The product has no server of its own.",
    "The product has no server of its own. Changed on 2026-10-01: it was one folder before.");
  assert.deepEqual(read(decision, ARC_PATH, stamped).map(formatFinding), [
    "ARC-001:12: error: the document holds a mark of history (edit-stamp): \"Changed on 2026-10-01\" [A DOCUMENT HOLDS NO HISTORY] "
      + "— remove it; the version history keeps what was changed, when and by whom.",
  ]);
});

// TST-1396002 · level: unit · module: MOD-documents
// guards: A DOCUMENT HOLDS NO HISTORY
// given: the complete use case UC-001, read by the use-case schema, whose noHistory is true; and three copies with one change each: line 24 "- Withdrawn: the list may be empty." (a withdrawal); line 15 "**Goal.** The author takes the list away as a file. (PO A. Maier, 2026-09-24)" (a date of a change); and the front matter's line 4 "area: 2 requirements, reworded 2026-09-24" (a stamp in a value of the front matter)
// input: documentFindings of each
// expect: known positive — none for the complete use case; for each copy exactly one error under A DOCUMENT HOLDS NO HISTORY at its line, naming the mark's kind and text: line 24 withdrawal "Withdrawn: the list may be empty."; line 15 dated-change "2026-09-24"; line 4 edit-stamp "reworded 2026-09-24"
test("documentFindings — each kind of mark, in the body and in the front matter, at the line it stands on", () => {
  assert.deepEqual(findingsOf(useCase, UC_PATH, UC), [], "known positive: the complete use case");
  assert.deepEqual(findingsOf(useCase, UC_PATH, changed(UC, "- The list exists.", "- Withdrawn: the list may be empty.")),
    [mark(24, "withdrawal", "Withdrawn: the list may be empty.")]);
  assert.deepEqual(findingsOf(useCase, UC_PATH, changed(UC, "takes the list away as a file.",
    "takes the list away as a file. (PO A. Maier, 2026-09-24)")), [mark(15, "dated-change", "2026-09-24")]);
  assert.deepEqual(findingsOf(useCase, UC_PATH, changed(UC, "area: 2 requirements", "area: 2 requirements, reworded 2026-09-24")),
    [mark(4, "edit-stamp", "reworded 2026-09-24")]);
});

const NOTE = "---\ntitle: A note\n---\n# A note\n\nThe flow, in words.\nLast edited by akmaier\n";
const RECORD = "kind: release\nstate: accepted 2026-09-24\n";

// TST-1396003 · level: unit · module: MOD-documents
// guards: A DOCUMENT HOLDS NO HISTORY
// given: a note at docs/notes/a-note.md whose line 7 reads "Last edited by akmaier", read by a note schema (rule ONE NOTE, ONE FILE) with noHistory true and without the key; and a record of key: value lines at docs/records/a.md whose line 2 reads "state: accepted 2026-09-24", read by a record schema of the shape lines with noHistory true and without the key
// input: documentFindings of each by each schema
// expect: with noHistory true, one error each under A DOCUMENT HOLDS NO HISTORY — the note's on line 7, edit-stamp "Last edited by akmaier"; the record's on line 2, dated-change "2026-09-24"; without the key, no finding for either
test("documentFindings — marks are errors only where the schema says noHistory, in a document and in a record of lines", () => {
  const note = (noHistory) => load({ schema: "note", shape: "document", rule: "ONE NOTE, ONE FILE", path: "docs/notes/{slug}.md",
    frontMatter: { title: { type: "text", required: true } }, otherSections: "allowed", ...(noHistory ? { noHistory } : {}) });
  const record = (noHistory) => load({ schema: "record", shape: "lines", rule: "ONE NOTE, ONE FILE", path: "docs/records/{slug}.md",
    lines: { kind: { type: "text", required: true }, state: { type: "text" } }, ...(noHistory ? { noHistory } : {}) });
  assert.deepEqual(findingsOf(note(undefined), "docs/notes/a-note.md", NOTE), [], "known positive: no noHistory, no finding");
  assert.deepEqual(findingsOf(note(true), "docs/notes/a-note.md", NOTE), [mark(7, "edit-stamp", "Last edited by akmaier")]);
  assert.deepEqual(findingsOf(record(undefined), "docs/records/a.md", RECORD), [], "known positive: no noHistory, no finding");
  assert.deepEqual(findingsOf(record(true), "docs/records/a.md", RECORD), [mark(2, "dated-change", "2026-09-24")]);
});
