// A table's column marked optional (ITM-1154) — MOD-documents, as its accepted text states it (the schema language's `sections` row, *Sections and their tables*, `documentFindings`): a column entry is `{ name, value,
// optional }`, with `"optional": true` where a header may leave the column out; "a section's table is the first table in it whose header row names the table's columns, in their order, where a column marked
// optional may be named or left out; a header that names a column the schema does not name, names the columns in another order, or leaves out a column that is not optional is not the table's header"; and
// `documentFindings` names the header "with the columns that header adds, lacks or puts out of order — a left-out optional column is not a lack".
// Run: node --test tests/documents-optional-columns.test.mjs
//
// Module: MOD-documents
// Guards: A DATA FORMAT IS DEFINED ONCE; A FINDING READS LIKE A COMPILER MESSAGE
// Level: unit
//
// The schema below is a fixture in the form the module file names. The readings the module file leaves open, which the pull request names: a row is read by position into the columns the header names, in the table's
// order; a cell of a column the header leaves out is absent, and is no finding; a row written to an existing table has the cells of the columns that table's header names, and a cell for a column the header leaves out
// is refused (a DocumentError naming the column); a table written anew has the columns that are not optional and the optional columns some row fills. Each test states its input and its expected result before it runs
// (given / input / expect). The counter-proofs are run as mutations and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { documentFindings, loadSchema, readRegister, writeDocument } from "../src/documents/index.mjs";

const SCHEMA = {
  schema: "listing", shape: "document", rule: "A LISTING IS A TABLE", path: "docs/listing.md",
  sections: [{ underTitle: true, required: true, table: { columns: [
    { name: "Name", value: { type: "text", required: true } },
    { name: "Kind", value: { type: "text", required: true } },
    { name: "Notes", value: { type: "text" }, optional: true },
    { name: "Owner", value: { type: "text" }, optional: true },
  ] } }],
  otherSections: "allowed",
};
const schemaFile = (schema) => ["# The schema listing", "", "The format's schema.", "", "```json", JSON.stringify(schema, null, 2), "```", ""].join("\n");
const load = (schema = SCHEMA) => loadSchema(schemaFile(schema), "MOD-documents");
const tableOf = (header, ...rows) => ["# A listing", "", `| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`), ""].join("\n");
const read = (text) => readRegister(load(), "docs/listing.md", text);
const errors = (text) => { const schema = load(); return documentFindings(schema, readRegister(schema, "docs/listing.md", text).document); };

// TST-115410 · level: unit · module: MOD-documents
// guards: A DATA FORMAT IS DEFINED ONCE
// given: a schema whose columns Notes and Owner are marked optional; lists whose headers name all four columns, Notes only, Owner only, and neither
// input: readRegister of each, and documentFindings
// expect: each header is the table's header: the row is read by position into the columns the header names (Notes and Owner present or absent as the header says), and no finding is made
test("a header may name an optional column or leave it out", () => {
  const cases = [
    [["Name", "Kind", "Notes", "Owner"], ["a", "k", "n", "o"], { Name: "a", Kind: "k", Notes: "n", Owner: "o" }],
    [["Name", "Kind", "Notes"], ["a", "k", "n"], { Name: "a", Kind: "k", Notes: "n" }],
    [["Name", "Kind", "Owner"], ["a", "k", "o"], { Name: "a", Kind: "k", Owner: "o" }],
    [["Name", "Kind"], ["a", "k"], { Name: "a", Kind: "k" }],
  ];
  for (const [header, row, cells] of cases) {
    const text = tableOf(header, row);
    assert.deepEqual(read(text).rows.map((each) => each.cells), [cells], header.join(", "));
    assert.deepEqual(errors(text), [], `${header.join(", ")}: no finding`);
  }
});

// TST-115411 · level: unit · module: MOD-documents
// guards: A DATA FORMAT IS DEFINED ONCE; A FINDING READS LIKE A COMPILER MESSAGE
// given: the same schema; headers that lack Kind (not optional), name the optional columns in the other order, and add a column Extra
// input: documentFindings of each
// expect: counter-proof — none is the table's header, so no row is read: one finding each, at the header, naming the schema's rule; the one that lacks Kind says "lacks Kind", the one in another order says it puts the columns out of order, the one that adds Extra says "adds Extra"; a left-out optional column is no lack
test("a header that lacks a required column, is out of order or adds a column is refused, and a left-out optional column is not a lack", () => {
  const cases = [
    [["Name", "Notes"], ["a", "n"], /lacks Kind/], [["Name", "Kind", "Owner", "Notes"], ["a", "k", "o", "n"], /puts the columns out of order/],
    [["Name", "Kind", "Extra"], ["a", "k", "x"], /adds Extra/],
  ];
  for (const [header, row, says] of cases) {
    const text = tableOf(header, row);
    assert.deepEqual(read(text).rows, [], `${header.join(", ")}: no row is read`);
    const found = errors(text);
    assert.equal(found.length, 1, header.join(", "));
    assert.equal(found[0].rule, "A LISTING IS A TABLE");
    assert.match(found[0].what, says);
  }
  assert.doesNotMatch(errors(tableOf(["Name", "Kind", "Extra"], ["a", "k", "x"]))[0].what, /lacks/, "the left-out optional columns are no lack");
});

// TST-115412 · level: unit · module: MOD-documents
// guards: A DATA FORMAT IS DEFINED ONCE
// given: the schema with a column marked optional that is not a boolean ("optional": "yes"), and the schema with "optional": true on a column
// input: loadSchema of each
// expect: known positive — the second loads; the first is refused with a SchemaError naming the key sections[0].table.columns[2].optional
test("loadSchema — optional is true or false and nothing else", () => {
  assert.doesNotThrow(() => load(), "known positive");
  const broken = JSON.parse(JSON.stringify(SCHEMA));
  broken.sections[0].table.columns[2].optional = "yes";
  assert.throws(() => load(broken), (error) => error.name === "SchemaError" && error.key === "sections[0].table.columns[2].optional");
});

// TST-115413 · level: unit · module: MOD-documents
// guards: A DATA FORMAT IS DEFINED ONCE
// given: a list that names Name, Kind and Notes, with a row; a list without a table
// input: writeDocument of the document read with one row added that fills Name, Kind and Notes; with one that also fills Owner; and of a document with rows and no table yet, one row filling Owner and one not
// expect: a row added to the existing table is written with the cells of the columns its header names (the row that fills Owner, which the header leaves out, is refused naming Owner); a table written anew has Name and Kind, and Notes or Owner only where some row fills them
test("writeDocument — a row follows the columns the header names, and a new table has the optional columns some row fills", () => {
  const schema = load();
  const text = tableOf(["Name", "Kind", "Notes"], ["a", "k", "n"]);
  const { document } = readRegister(schema, "docs/listing.md", text);
  const section = document.sections[0];
  const added = { ...document, sections: [{ ...section, rows: [...section.rows, { cells: { Name: "b", Kind: "k2", Notes: "n2" } }] }] };
  assert.equal(writeDocument(schema, added), tableOf(["Name", "Kind", "Notes"], ["a", "k", "n"], ["b", "k2", "n2"]));
  const wrong = { ...document, sections: [{ ...section, rows: [...section.rows, { cells: { Name: "b", Kind: "k2", Owner: "o" } }] }] };
  assert.throws(() => writeDocument(schema, wrong), /Owner/);

  const bare = { kind: "listing", path: "docs/listing.md", id: null, title: "A listing", fields: {}, appended: [], body: "# A listing\n",
    sections: [{ heading: "# A listing", line: 1, text: "\n", rows: [{ cells: { Name: "a", Kind: "k" } }, { cells: { Name: "b", Kind: "k2", Owner: "o" } }] }] };
  const written = writeDocument(schema, bare);
  assert.match(written, /\| Name \| Kind \| Owner \|/);
  assert.doesNotMatch(written, /Notes/);
  const plain = { ...bare, sections: [{ ...bare.sections[0], rows: [{ cells: { Name: "a", Kind: "k" } }] }] };
  assert.match(writeDocument(schema, plain), /\| Name \| Kind \|\n/);
});

// TST-115414 · level: unit · module: MOD-documents
// guards: A DATA FORMAT IS DEFINED ONCE
// given: a schema whose optional column Owner has a value that is required where the column is named; a list that leaves the column out, and one that names it with the cell left out
// input: documentFindings of each; writeDocument of a row without an Owner
// expect: a column that is left out asks nothing of its value: the first list has no finding and the row is written; the second, which names the column, is refused for the missing cell
test("an optional column that the header leaves out asks nothing of its value, and one it names is required as its value says", () => {
  const strict = JSON.parse(JSON.stringify(SCHEMA));
  strict.sections[0].table.columns[3].value = { type: "text", required: true };
  const schema = load(strict);
  const check = (text) => documentFindings(schema, readRegister(schema, "docs/listing.md", text).document);
  assert.deepEqual(check(tableOf(["Name", "Kind"], ["a", "k"])), []);
  assert.equal(check(tableOf(["Name", "Kind", "Owner"], ["a", "k", "—"])).length, 1, "known positive: a named column with its cell left out is refused");
  const { document } = readRegister(schema, "docs/listing.md", tableOf(["Name", "Kind"], ["a", "k"]));
  const added = { ...document, sections: [{ ...document.sections[0], rows: [...document.sections[0].rows, { cells: { Name: "b", Kind: "k2" } }] }] };
  assert.equal(writeDocument(schema, added), tableOf(["Name", "Kind"], ["a", "k"], ["b", "k2"]));
});
