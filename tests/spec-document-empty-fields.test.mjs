// A requirement with empty fields is read and marked (ITM-1400) — MOD-spec-document as docs/architecture/MOD-spec-document.md states it: parseSpec "never throws on content: a requirement missing a field is read with that field `null`, and
// `requirementFindings` names it". The editor of a new requirement (UC-018, 3d) opens a section with the four fields empty, `****`, an empty line and `*Check:*`; step 3 marks "a missing one of the four fields". So a requirement whose name is
// empty, and one that is a name and nothing else, are read with every other field null, and requirementFindings names each field that is missing.
// Run: node --test tests/spec-document-empty-fields.test.mjs
//
// Module: MOD-spec-document
// Guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// Level: unit
//
// Every text read here is a fixture SPEC written out below; no test opens Agent M's own SPEC.md (KEIN SPEC-ZUGRIFF AUS PRODUKT-CODE). The numbers beside a fixture are its lines. Where the module file leaves a reading open, the test states the
// reading it takes, and the pull request names it:
//   - A bold name in capitals alone on its line is the head line of a requirement when a `*Check:*` line follows it: directly, as before, or opening the next paragraph, after an empty line — the form in which the editor opens a new
//     requirement. A bold name in capitals followed by anything else is prose, as before (`**VERBINDLICH (SPEC)**` in the preamble of a SPEC).
//   - An empty name is the empty string. A finding of a requirement with an empty name names the artifact "" and the line of its head line.
// Each test names the requirement it guards and states its input and its expected result before it runs (given / input / expect); where a test expects something not to be found, the same reading is first shown to find it on a known positive.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { parseSpec, requirementFindings } from "../src/spec-document/index.mjs";

// A text of these lines, each ended by a line feed.
const lines = (...ls) => ls.map((l) => `${l}\n`).join("");

const FOUR_FIELDS = "A REQUIREMENT HAS FOUR FIELDS";
const SECTION = "## 2. Membership";

// The summary of a finding as the tests compare it: the requirement it names, its line, error or warning, and the rule it is reported under.
const summary = (f) => `${f.artifact}:${f.line}: ${f.kind} [${f.rule}]`;

// The field a finding says is missing: its `what` names one of these.
const FIELDS = ["source", "rule", "check"];
const fieldOf = (f) => FIELDS.find((word) => new RegExp(`\\b${word}\\b`, "i").test(f.what));

// The findings of the SPEC `text` under A REQUIREMENT HAS FOUR FIELDS, in the order of their lines — on one line, in the order of the fields.
const fieldFindings = (text) => requirementFindings(parseSpec(text)).filter((f) => f.rule === FOUR_FIELDS)
  .sort((a, b) => a.line - b.line || FIELDS.indexOf(fieldOf(a)) - FIELDS.indexOf(fieldOf(b)));

// The section as the editor opens a new requirement in it: the section as it stands, an empty line, and the four fields empty. The numbers are the lines of EMPTY.
const MEMBER = lines(
  `${SECTION}`,                                                                                  //  1
  "",                                                                                            //  2
  "**A MEMBER HAS A CARD** *(Product Owner)*",                                                   //  3
  "Every member holds a card.",                                                                  //  4
  "*Check:* `tests/card.test.mjs`",                                                              //  5
);
const MEMBER_READ = { name: "A MEMBER HAS A CARD", source: "Product Owner", sources: ["Product Owner"], rule: "Every member holds a card.",
  check: "`tests/card.test.mjs`", checkPaths: ["tests/card.test.mjs"], section: SECTION, line: 3 };
const EMPTY = `${MEMBER}\n${lines("****", "", "*Check:*")}`;
// A name typed into the empty fields, and nothing else.
const ALONE = `${MEMBER}\n${lines("**A MEMBER IS REGISTERED**", "", "*Check:*")}`;
const NOTHING_BUT = (name, line) => ({ name, source: null, sources: [], rule: null, check: null, checkPaths: [], section: SECTION, line });

// TST-1400001 · level: unit · module: MOD-spec-document
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// given: EMPTY — a section holding A MEMBER HAS A CARD, whole, and, after an empty line, the fields of a new requirement as the editor opens them: `****` on line 7, an empty line, and `*Check:*`; and, to show that the same reading finds what the code reads now, MEMBER alone
// input: parseSpec(EMPTY); parseSpec(MEMBER)
// expect: for EMPTY two requirements in the order they stand, the section's names listing both — A MEMBER HAS A CARD as MEMBER_READ writes it, and one named "" (empty) on line 7, its source, rule and check null, `sources` and `checkPaths` empty, its section the heading on line 1; for MEMBER (known positive) the first alone, read as before
test("parseSpec — the empty fields of a new requirement are read as a requirement with every field null", () => {
  const known = parseSpec(MEMBER);
  assert.deepEqual([...known.requirements.values()], [MEMBER_READ], "known positive: the whole requirement is read");
  const spec = parseSpec(EMPTY);
  assert.deepEqual([...spec.requirements.values()], [MEMBER_READ, NOTHING_BUT("", 7)]);
  assert.deepEqual(spec.sections.map((s) => s.requirements), [["A MEMBER HAS A CARD", ""]]);
});

// TST-1400002 · level: unit · module: MOD-spec-document
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// given: ALONE — the same section with a name written into the empty fields, `**A MEMBER IS REGISTERED**` on line 7, an empty line and `*Check:*`; and the name directly above its `*Check:*` line, without the empty line
// input: parseSpec of each
// expect: for each, a requirement named A MEMBER IS REGISTERED on line 7 after A MEMBER HAS A CARD, its source, rule and check null, `sources` and `checkPaths` empty; the second, which the code reads as such now, shows that the reading of the first is the same requirement
test("parseSpec — a name and no other field is read as a requirement with its other fields null", () => {
  const directly = `${MEMBER}\n${lines("**A MEMBER IS REGISTERED**", "*Check:*")}`;
  assert.deepEqual([...parseSpec(directly).requirements.values()], [MEMBER_READ, NOTHING_BUT("A MEMBER IS REGISTERED", 7)],
    "known positive: the name directly above an empty `*Check:*` is read");
  assert.deepEqual([...parseSpec(ALONE).requirements.values()], [MEMBER_READ, NOTHING_BUT("A MEMBER IS REGISTERED", 7)]);
});

// TST-1400003 · level: unit · module: MOD-spec-document
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// given: EMPTY and ALONE; and, to show that the same reading marks a requirement missing a field, the section with A MEMBER IS REGISTERED holding its source and rule but no check
// input: the findings of requirementFindings(parseSpec(text)) under A REQUIREMENT HAS FOUR FIELDS for each
// expect: for EMPTY three errors on line 7, naming the requirement "" and saying in order that its source, its rule and its check are missing; for ALONE three errors on line 7, naming A MEMBER IS REGISTERED, the same three fields; none for A MEMBER HAS A CARD in either; for the known positive exactly one, "no check" on line 7
test("requirementFindings — each field missing from the empty fields, and from a name given alone, is named", () => {
  const noCheck = `${MEMBER}\n${lines("**A MEMBER IS REGISTERED** *(Product Owner)*", "Every member is registered.")}`;
  assert.deepEqual(fieldFindings(noCheck).map(summary), [`A MEMBER IS REGISTERED:7: error [${FOUR_FIELDS}]`], "known positive: a missing check is marked");
  assert.match(fieldFindings(noCheck)[0].what, /no check/);

  for (const [text, name] of [[EMPTY, ""], [ALONE, "A MEMBER IS REGISTERED"]]) {
    const found = fieldFindings(text);
    assert.deepEqual(found.map(summary), FIELDS.map(() => `${name}:7: error [${FOUR_FIELDS}]`), name || "the empty name");
    assert.deepEqual(found.map(fieldOf), FIELDS, `${name || "the empty name"}: each field is named`);
  }
});

// TST-1400004 · level: unit · module: MOD-spec-document
// guards: A REQUIREMENT HAS FOUR FIELDS
// given: PROSE — a section holding the marker `**VERBINDLICH (SPEC)**` followed by an empty line and a sentence, a bold line in capitals followed by a paragraph without a check, a line `****` followed by an empty line and a sentence, and a bold name followed by an empty line and a paragraph of two lines, the second `*Check:*`; and the same text with a `*Check:*` line opening the paragraph after `****`
// input: parseSpec(PROSE) and parseSpec of the second text
// expect: for PROSE no requirement and no name in the section; for the second text exactly one, named "" on the line of `****` — the same reading finds the empty fields where a `*Check:*` line follows, and only there
test("parseSpec — a bold line that no `*Check:*` line follows stays prose", () => {
  const PROSE = lines(
    "## 1. Prose",                                                                                //  1
    "",                                                                                           //  2
    "**VERBINDLICH (SPEC)**",                                                                     //  3
    "",                                                                                           //  4
    "The binding document.",                                                                      //  5
    "",                                                                                           //  6
    "**BOLD PROSE IN CAPITALS**",                                                                 //  7
    "A paragraph after it, with no check.",                                                       //  8
    "",                                                                                           //  9
    "****",                                                                                       // 10
    "",                                                                                           // 11
    "A sentence after a rule.",                                                                   // 12
    "",                                                                                           // 13
    "**A NAME OVER A PARAGRAPH**",                                                                // 14
    "",                                                                                           // 15
    "Its rule, in a paragraph of its own.",                                                       // 16
    "*Check:* `tests/a.test.mjs`",                                                                // 17
  );
  const planted = PROSE.replace("A sentence after a rule.\n", "*Check:*\n");
  assert.notEqual(planted, PROSE);
  // Known positive: the same reading finds a bold name in capitals where a `*Check:*` line follows it directly.
  assert.deepEqual([...parseSpec(lines("## 1. Prose", "", "**A NAME**", "*Check:*")).requirements.keys()], ["A NAME"]);
  const known = parseSpec(planted);
  assert.deepEqual([...known.requirements.values()].map((r) => [r.name, r.line]), [["", 10]], "known positive: the empty fields are read where `*Check:*` follows");
  const spec = parseSpec(PROSE);
  assert.deepEqual([...spec.requirements.keys()], []);
  assert.deepEqual(spec.sections.map((s) => s.requirements), [[]]);
});

// TST-1400005 · level: unit · module: MOD-spec-document
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// given: a section holding a requirement whose name is empty but whose source, rule and check are written: `**** *(Product Owner)*`, a rule, and a `*Check:*` naming a test
// input: parseSpec of it, and requirementFindings of that
// expect: one requirement named "" on the line of its head line, with source "Product Owner", sources ["Product Owner"], the rule, the check and checkPaths as written; no finding under A REQUIREMENT HAS FOUR FIELDS
test("parseSpec — a requirement with an empty name and its other fields written is read with them", () => {
  const text = lines(
    "## 1. Named later",                                                                          //  1
    "",                                                                                           //  2
    "**** *(Product Owner)*",                                                                     //  3
    "Every member holds a card.",                                                                 //  4
    "*Check:* `tests/card.test.mjs`",                                                             //  5
  );
  const spec = parseSpec(text);
  assert.deepEqual([...spec.requirements.values()], [{ name: "", source: "Product Owner", sources: ["Product Owner"], rule: "Every member holds a card.",
    check: "`tests/card.test.mjs`", checkPaths: ["tests/card.test.mjs"], section: "## 1. Named later", line: 3 }]);
  assert.deepEqual(fieldFindings(text), []);
});
