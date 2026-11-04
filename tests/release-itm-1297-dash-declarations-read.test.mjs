// Release tests of ITM-1297 — the declarations of five test files, once written with ` - ` in place of ` · `, are read by MOD-test-document's reader in the stated form, and the `guards` entries that named a use case
// with a step now name the use case. The behaviour is the SPEC's A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS ("Every test case names its input, its precondition and its expected result in a form that can be
// read without running it") and A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION ("A cross-reference names the identifier it points at, never a section number or line number."), as docs/architecture/MOD-test-document.md
// states the form: "`// TST-014 · level: unit · module: MOD-text-tools`", and `testFindings`: "under `A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION` for each `guards` entry that is neither a requirement's name nor
// a use case's identifier — a use case written with its step, such as `UC-005 (alternative flow 6a)`, is none".
// Run: node --test tests/release-itm-1297-dash-declarations-read.test.mjs
//
// Module: MOD-test-document
// Guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// Level: release
//
// Written for the release testing of sprint 113 by a participant who implemented none of ITM-1297 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The cases read the five files as they stand, through the
// interface of src/test-document/index.mjs, and compare with an oracle that does not use the reader: the lines of a file that begin a declaration (`// TST-<n>`), and the guards entries as written. Readings the texts
// leave open: "no step guards" is read as no guards entry that is anything but a use case's identifier alone or a requirement's name (written in capitals); the oracle does not look the names up in the SPEC.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testDeclarations, testFindings } from "../src/test-document/index.mjs";

const TESTS = fileURLToPath(new URL("./", import.meta.url));
const read = (name) => readFileSync(TESTS + name, "utf8");
const pathOf = (name) => `tests/${name}`;

// The five files and the declarations that were written with a dash (the item's 28), by identifier. How many declarations a file holds is read from its own `// TST-` heads, not copied here.
const FILES = {
  "reuse-facts.test.mjs": { recovered: ["TST-435001", "TST-435002", "TST-435003", "TST-435004", "TST-435005", "TST-436001", "TST-436002", "TST-436003", "TST-436004"] },
  "review-pages-draft-requirements.test.mjs": { recovered: ["TST-361001", "TST-361002", "TST-361003", "TST-361004", "TST-361005"] },
  "source-register-version-fetch.test.mjs": { recovered: ["TST-385001", "TST-385002", "TST-385003", "TST-385004", "TST-385005", "TST-385006"] },
  "workflow-entries-sources.test.mjs": { recovered: ["TST-401001", "TST-401002", "TST-401003"] },
  "review-pages-draft-architecture.test.mjs": { recovered: ["TST-443001", "TST-443002", "TST-443003", "TST-443004", "TST-443005"] },
};
// The twelve declarations whose guards named a use case with a step, and the use case each names now.
const STEPPED = { "TST-361002": "UC-005", "TST-361003": "UC-005", "TST-361004": "UC-005", "TST-361005": "UC-005",
  "TST-385001": "UC-004", "TST-385002": "UC-004", "TST-385003": "UC-004", "TST-385004": "UC-004", "TST-385006": "UC-004",
  "TST-401001": "UC-004", "TST-401002": "UC-004", "TST-401003": "UC-004" };

// The first line of a declaration as MOD-test-document, Data, writes it.
const BEGINS = /^\s*\/\/ TST-\d+/;
const STATED_FORM = /^\s*\/\/ TST-\d+ · level: (?:unit|component|system|release|user) · module: (?:MOD-[a-z0-9-]+|system)\s*$/;
const firstLines = (text) => text.split("\n").filter((line) => BEGINS.test(line));
const idOf = (line) => /TST-\d+/.exec(line)[0];
// A text of one declaration, its first line as given; built by join, so that no line of this file is a declaration.
const declaration = (first, guards) => ["// " + first, "// guards: " + guards, "// given: g", "// input: i", "// expect: e", "test(\"t\", () => {});", ""].join("\n");

// TST-1297301 · level: release · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the five files tests/reuse-facts.test.mjs, review-pages-draft-requirements, source-register-version-fetch, workflow-entries-sources and review-pages-draft-architecture as they stand; known positive first — a constructed declaration in the stated form is read as one, the same with ` - ` in place of ` · ` as none
// input: each file's path and text given to testDeclarations
// expect: in each file every line that begins a declaration is in the stated form, and the reader reads as many declarations as there are such lines in that file (counted from the file's own `// TST-` heads), with the same identifiers in the same order; the 28 identifiers once written with a dash, TST-443001 among them, are each read once; counter-proof: the first declaration line of each file written with ` - ` is read as one declaration fewer than the lines count
// Planted fault: one declaration line of a file written with ` - ` again (here by the case itself) reads one declaration fewer, and the case fails on the count; the same fault in the file fails the case in the same place.
test("TST-1297301 the five files' declarations are all written in the stated form and all read", () => {
  const stated = "TST-1 · level: unit · module: MOD-x", dashed = "TST-1 - level: unit - module: MOD-x";
  assert.equal(testDeclarations("tests/x.test.mjs", declaration(stated, "ONE CLICK PER DECISION")).length, 1, "known positive: the stated form is read");
  assert.equal(testDeclarations("tests/x.test.mjs", declaration(dashed, "ONE CLICK PER DECISION")).length, 0, "known positive: a dash is not the stated form, and the reader reads none");

  let recovered = 0;
  for (const [name, { recovered: ids }] of Object.entries(FILES)) {
    const text = read(name);
    const lines = firstLines(text);
    assert.deepEqual(lines.filter((line) => !STATED_FORM.test(line)), [], `${name}: every declaration's first line is in the stated form`);
    const declared = testDeclarations(pathOf(name), text);
    const count = lines.length;
    assert.ok(count > 0, `${name}: the file holds declarations`);
    assert.equal(declared.length, count, `${name}: the declarations read are the lines that begin a declaration`);
    assert.deepEqual(declared.map((d) => d.id), lines.map(idOf), `${name}: the same identifiers in the same order`);
    for (const id of ids) { assert.equal(declared.filter((d) => d.id === id).length, 1, `${name}: ${id} is read once`); recovered += 1; }

    const at = text.indexOf(lines[0]);
    const broken = text.slice(0, at) + lines[0].replace(" · ", " - ").replace(" · ", " - ") + text.slice(at + lines[0].length);
    assert.equal(testDeclarations(pathOf(name), broken).length, count - 1, `${name}: counter-proof: one line written with a dash is read as one fewer`);
  }
  assert.equal(recovered, 28, "the 28 declarations of the item");
  const architecture = testDeclarations(pathOf("review-pages-draft-architecture.test.mjs"), read("review-pages-draft-architecture.test.mjs")).find((d) => d.id === "TST-443001");
  assert.deepEqual([architecture.level, architecture.module], ["unit", "MOD-review-pages"]);
});

// TST-1297302 · level: release · module: MOD-test-document
// guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the same five files; known positive first — a declaration in the stated form whose guards entry is a use case written with its step, as UC-004 step 7 or UC-005 (alternative flow 6a), is given a finding by testFindings
// input: every declaration the reader reads in the five files, given to testFindings; and the guards entries as the declarations read them
// expect: no declaration has a finding; every guards entry is a use case's identifier alone or a name in capitals, none that begins UC- carries a step, a flow or a bracket; the twelve declarations that guarded a use case with its step (TST-361002 to 361005, TST-385001 to 385004 and 385006, TST-401001 to 401003) each guard exactly the one use case UC-005 or UC-004 and no entry with a step; counter-proof: the entry UC-004 step 7 put back into one of them is a finding
// Planted fault: a step put back into one guards line of a file (UC-004 step 7 in place of UC-004) gives the declaration a finding, and the case fails on the findings.
test("TST-1297302 no declaration of the five files has a finding and no guards entry carries a step", () => {
  for (const step of ["UC-004 step 7", "UC-005 (alternative flow 6a)"]) {
    const planted = testDeclarations("tests/x.test.mjs", declaration("TST-1 · level: unit · module: MOD-x", `${step}; ONE CLICK PER DECISION`));
    assert.equal(planted.flatMap(testFindings).length, 1, `known positive: ${step} is a finding`);
  }

  const seen = new Map();
  for (const name of Object.keys(FILES)) {
    const declared = testDeclarations(pathOf(name), read(name));
    assert.deepEqual(declared.flatMap(testFindings).map((finding) => finding.what), [], `${name}: no finding`);
    for (const d of declared) {
      seen.set(d.id, d.guards);
      for (const entry of d.guards) {
        assert.ok(/^UC-\d+$/.test(entry) || !/[a-z]/.test(entry), `${d.id}: "${entry}" is a use case's identifier or a name in capitals`);
        assert.ok(!entry.startsWith("UC-") || /^UC-\d+$/.test(entry), `${d.id}: "${entry}" names the use case alone, without a step`);
      }
    }
  }
  for (const [id, useCase] of Object.entries(STEPPED)) {
    const entries = seen.get(id);
    assert.deepEqual(entries.filter((entry) => entry.startsWith("UC-")), [useCase], `${id} guards the one use case ${useCase}`);
  }
});
