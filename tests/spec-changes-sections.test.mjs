// The sections a draft of requirements changes (ITM-393) — MOD-spec-changes' entrySections, as docs/architecture/MOD-spec-changes.md
// states it: the sections of the SPEC that the draft's candidates change, each as the whole section's new text, composed by the
// classes — a `new` candidate added to its section, a `change` in the section of the requirement it changes under its name, a
// `duplicate` as an added source of the existing requirement, a `conflict` only as the person resolved it, an undecided one not at all —;
// every requirement names the job's source with the passage it draws on, and the source of a rule its candidate points to; every other
// byte of a section stays as it is. Pure. The writer queue-entries and the prompt route call it; they are not part of ITM-393.
// Run: node --test tests/spec-changes-sections.test.mjs
//
// Module: MOD-spec-changes
// Guards: UC-005; UC-019
// Guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CONFLICT IS DECIDED BY A PERSON
// Guards: THE PERSON WHO PROMPTS IS A SOURCE
// Level: unit
//
// The SPEC is a fixture of ours, never Agent M's own SPEC.md (KEIN SPEC-ZUGRIFF AUS PRODUKT-CODE): two sections, the first with a line of
// prose and two requirements — the second naming a source besides the product owner's —, the second with one requirement and no empty
// line at its end. A draft is `{ candidates }` as the kinds derive-requirements and change-requirements return it; the classes are
// MOD-documents' Classified, as classifyCandidates gives them and a person may change them, a candidate named by its `ref`, its name.
// The expected texts are put together here from the fixture's pieces, never taken from the code. Where the module file leaves a reading
// open, the test states the reading it takes, and the pull request names it:
//   - A `new` candidate is added after the last requirement of the section of the requirement its class's `of` names, or, with none
//     named, of the last section of the SPEC; a change or a duplicate whose `of` the SPEC does not hold is RequirementNotFound.
//   - A `change` replaces the requirement's block with its name, sources, rule and check, the rule and the check on one line each; it
//     keeps the sources the SPEC states and adds the job's.
//   - The job's source is one item for each passage of the merged candidates: `<source>, <passage>`, or the source alone for none.
//   - A section whose text a draft leaves as it is is not returned; the sections come in the order of the SPEC.
// A name the module does not provide yet is undefined here, so that each test fails by itself. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import * as specChanges from "../src/spec-changes/index.mjs";

const { entrySections } = specChanges;

const text = (...lines) => `${lines.join("\n")}\n`;
const JOB = "Job Source";

const SECTION_1 = text("## 1. Reading", "", "Some prose about reading.", "",
  "**A SAMPLE RULE** *(Fixture PO)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "",
  "**ANOTHER SAMPLE RULE** *(Fixture PO; Other Source, Art. 2)*", "A reader sees the name of a file.", "*Check:* no automatic check; at review", "");
const SECTION_2 = text("## 2. Writing", "",
  "**A WRITE RULE** *(Fixture PO)*", "A writer writes a file whole.", "*Check:* no automatic check; at review");
const HEAD = text("# Fixture product — Specification", "");
const SPEC = HEAD + SECTION_1 + SECTION_2;

const candidate = (name, { rule = `${name} states a rule.`, check = "no automatic check; at review", passage = "ch. 8", class: kind = "new", of = null } = {}) =>
  ({ name, rule, check, constrains: "product", passage, class: kind, of });
// The class of a candidate as classifyCandidates gives it: one candidate, its passages, the class and the artifact.
const classed = (item, kind = item.class, of = item.of, from = [item.passage]) => ({ refs: [item.name], from, class: kind, of, decidedBy: "participant" });
const compose = (items, classes = items.map((item) => classed(item)), source = JOB, spec = SPEC) => entrySections(spec, { candidates: items }, classes, source);
const block = (name, sources, rule, check) => text(`**${name}** *(${sources})*`, rule, `*Check:* ${check}`).slice(0, -1);

// TST-473031 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; THE PERSON WHO PROMPTS IS A SOURCE; UC-019
// given: a candidate classed as a change of A SAMPLE RULE — drafted under another name, with a new rule and a new check, from "ch. 8"
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: one section, section 1, whose text is the old one with A SAMPLE RULE's block replaced by the existing name, the sources it had and the job's with the passage, the candidate's rule and check; every other byte of the section as it was; section 2 not returned
test("entrySections — a change replaces the requirement under its existing name, keeping its sources and adding the job's", () => {
  const item = candidate("A BETTER NAME", { rule: "A reader reads a file whole, or says why not.", check: "`tests/better.test.mjs`", class: "change", of: "A SAMPLE RULE" });
  const result = compose([item]);
  const old = block("A SAMPLE RULE", "Fixture PO", "A reader reads a file whole.", "`tests/sample.test.mjs`");
  const changed = block("A SAMPLE RULE", "Fixture PO; Job Source, ch. 8", "A reader reads a file whole, or says why not.", "`tests/better.test.mjs`");
  assert.ok(SECTION_1.includes(old), "the fixture holds the old block");
  assert.deepEqual(result, [{ anchor: "## 1. Reading", until: null, text: SECTION_1.replace(old, changed) }]);
});

// TST-473032 · level: unit · module: MOD-spec-changes
// guards: A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; THE PERSON WHO PROMPTS IS A SOURCE; UC-005
// given: a candidate classed as a duplicate of ANOTHER SAMPLE RULE, which names a source besides the product owner's, merged from two passages, "ch. 8" and "ch. 9"; and, to show the same call adding, a duplicate of A WRITE RULE
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: the head line of ANOTHER SAMPLE RULE with its two sources kept and an item for each passage added, every other byte as it was; for A WRITE RULE the head line with the job's source added; no requirement added
test("entrySections — a duplicate adds the job's source with each passage to the existing requirement, nothing else", () => {
  const item = candidate("RESTATES IT", { class: "duplicate", of: "ANOTHER SAMPLE RULE" });
  const result = compose([item], [classed(item, "duplicate", "ANOTHER SAMPLE RULE", ["ch. 8", "ch. 9"])]);
  assert.deepEqual(result, [{ anchor: "## 1. Reading", until: null,
    text: SECTION_1.replace("*(Fixture PO; Other Source, Art. 2)*", "*(Fixture PO; Other Source, Art. 2; Job Source, ch. 8; Job Source, ch. 9)*") }]);

  const other = candidate("RESTATES THE WRITE RULE", { class: "duplicate", of: "A WRITE RULE" });
  assert.deepEqual(compose([other]), [{ anchor: "## 2. Writing", until: null, text: SECTION_2.replace("*(Fixture PO)*", "*(Fixture PO; Job Source, ch. 8)*") }]);
});

// TST-473033 · level: unit · module: MOD-spec-changes
// guards: A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; UC-005
// given: a duplicate whose job source and passage the requirement names already, and, to show the same call changing a section, the same with another passage
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: no section for the first — the text would not change —, the section for the second
test("entrySections — a section that a draft leaves as it is is not returned", () => {
  const item = candidate("RESTATES IT", { class: "duplicate", of: "A WRITE RULE", passage: "ch. 9" });
  assert.equal(compose([item]).length, 1, "known positive: a new passage changes the section");
  const known = entrySections(SPEC.replace(SECTION_2, SECTION_2.replace("*(Fixture PO)*", "*(Fixture PO; Job Source, ch. 9)*")),
    { candidates: [item] }, [classed(item)], JOB);
  assert.deepEqual(known, []);
});

// TST-473034 · level: unit · module: MOD-spec-changes
// guards: UC-005; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: new candidates — one with no artifact named, one whose class names ANOTHER SAMPLE RULE as its neighbour; section 1 ends with an empty line, section 2 with a line end only; and the first again in a SPEC without a final line end
// input: entrySections(SPEC, draft, classes, "Job Source") for each
// expect: the requirement after the last requirement of its section, an empty line before it where the section has none: in the last section with no neighbour named, in section 1 with the neighbour; with no final line end the SPEC's end then an empty line first
test("entrySections — a new requirement is added at the end of its section", () => {
  const last = candidate("A NEW RULE", { rule: "A thing happens.", check: "`tests/new.test.mjs`" });
  const added = block("A NEW RULE", "Job Source, ch. 8", "A thing happens.", "`tests/new.test.mjs`");
  assert.deepEqual(compose([last]), [{ anchor: "## 2. Writing", until: null, text: `${SECTION_2}\n${added}\n` }], "the last section");

  const near = candidate("A NEARBY RULE", { rule: "A thing happens.", check: "`tests/new.test.mjs`", of: "ANOTHER SAMPLE RULE" });
  const nearBlock = block("A NEARBY RULE", "Job Source, ch. 8", "A thing happens.", "`tests/new.test.mjs`");
  assert.deepEqual(compose([near]), [{ anchor: "## 1. Reading", until: null, text: `${SECTION_1}${nearBlock}\n\n` }], "the section of the neighbour");

  const bare = SPEC.slice(0, -1);
  assert.deepEqual(compose([last], undefined, JOB, bare), [{ anchor: "## 2. Writing", until: null, text: `${SECTION_2.slice(0, -1)}\n\n${added}` }], "no final line end");
});

// TST-473035 · level: unit · module: MOD-spec-changes
// guards: A CONFLICT IS DECIDED BY A PERSON; UC-005
// given: a candidate classed as a conflict with A SAMPLE RULE, which no person has decided; and, to show the same call composing it, the class the person gave it — a change of A SAMPLE RULE
// input: entrySections(SPEC, draft, classes, "Job Source") for each
// expect: the undecided conflict in no section; the same candidate classed change composed into section 1
test("entrySections — a conflict is composed only as the person resolved it, an undecided one not at all", () => {
  const item = candidate("CONTRADICTS IT", { class: "conflict", of: "A SAMPLE RULE", rule: "A reader reads nothing." });
  assert.equal(compose([item], [classed(item, "change", "A SAMPLE RULE")]).length, 1, "known positive: decided as a change");
  assert.deepEqual(compose([item]), []);
  assert.deepEqual(compose([item], [classed(item, "conflict", "A SAMPLE RULE")]), []);
});

// TST-473036 · level: unit · module: MOD-spec-changes
// guards: UC-005; UC-019; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
// given: one candidate of each class in one draft — a change of A SAMPLE RULE, a duplicate of A WRITE RULE, a new requirement next to ANOTHER SAMPLE RULE, and an undecided conflict with A SAMPLE RULE —, in the order new, conflict, duplicate, change
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: two sections in the order of the SPEC: section 1 with the change and the new requirement after ANOTHER SAMPLE RULE, section 2 with the duplicate's source; the conflict nowhere; the prose of section 1 and the heading lines as they were
test("entrySections — one candidate of each class are composed into their sections, in the order of the SPEC", () => {
  const nu = candidate("A NEARBY RULE", { rule: "A thing happens.", check: "`tests/new.test.mjs`", of: "ANOTHER SAMPLE RULE" });
  const conflict = candidate("CONTRADICTS IT", { class: "conflict", of: "A SAMPLE RULE" });
  const duplicate = candidate("RESTATES THE WRITE RULE", { class: "duplicate", of: "A WRITE RULE" });
  const change = candidate("A CHANGED RULE", { rule: "A reader reads a file whole, or says why not.", check: "`tests/changed.test.mjs`", class: "change", of: "A SAMPLE RULE" });
  const result = compose([nu, conflict, duplicate, change]);
  const section1 = SECTION_1
    .replace(block("A SAMPLE RULE", "Fixture PO", "A reader reads a file whole.", "`tests/sample.test.mjs`"),
      block("A SAMPLE RULE", "Fixture PO; Job Source, ch. 8", "A reader reads a file whole, or says why not.", "`tests/changed.test.mjs`"))
    + `${block("A NEARBY RULE", "Job Source, ch. 8", "A thing happens.", "`tests/new.test.mjs`")}\n\n`;
  assert.deepEqual(result, [{ anchor: "## 1. Reading", until: null, text: section1 },
    { anchor: "## 2. Writing", until: null, text: SECTION_2.replace("*(Fixture PO)*", "*(Fixture PO; Job Source, ch. 8)*") }]);
  assert.ok(result[0].text.includes("Some prose about reading.\n\n"), "the prose stays");
});

// TST-473037 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; UC-019
// given: a SPEC written with CR LF line ends, and the candidates of the test above that change a requirement, add a source and add a requirement
// input: entrySections(spec, draft, classes, "Job Source")
// expect: every line the module writes ends in CR LF as its neighbours do, and every byte it did not touch is as it was: the section with its CR LFs turned to LF is the section of the LF fixture
test("entrySections — the line ends of the section are kept", () => {
  const crlf = SPEC.replace(/\n/g, "\r\n");
  const change = candidate("A CHANGED RULE", { rule: "A reader reads a file whole, or says why not.", check: "`tests/changed.test.mjs`", class: "change", of: "A SAMPLE RULE" });
  const duplicate = candidate("RESTATES IT", { class: "duplicate", of: "ANOTHER SAMPLE RULE" });
  const nu = candidate("A NEARBY RULE", { rule: "A thing happens.", check: "`tests/new.test.mjs`", of: "ANOTHER SAMPLE RULE" });
  const items = [change, duplicate, nu];
  const plain = compose(items);
  const result = compose(items, undefined, JOB, crlf);
  assert.equal(result.length, 1);
  assert.ok(!/(?<!\r)\n/.test(result[0].text), "no bare line feed");
  assert.equal(result[0].text.replace(/\r\n/g, "\n"), plain[0].text);
});

// TST-473038 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; THE PERSON WHO PROMPTS IS A SOURCE
// given: a change of ANOTHER SAMPLE RULE, which names a source of another register entry besides the product owner's
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: the changed requirement names the product owner's source, the other source with its passage and the job's, in that order
test("entrySections — a change names the source of the rule it points to as well as the job's", () => {
  const item = candidate("A BETTER NAME", { class: "change", of: "ANOTHER SAMPLE RULE", rule: "A reader sees the names of files." });
  const [section] = compose([item]);
  assert.ok(section.text.includes("**ANOTHER SAMPLE RULE** *(Fixture PO; Other Source, Art. 2; Job Source, ch. 8)*\nA reader sees the names of files."));
});

// TST-473039 · level: unit · module: MOD-spec-changes
// guards: A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: a duplicate of a requirement the SPEC does not hold, and a change of one; and a new requirement in a SPEC with no section
// input: entrySections(...)
// expect: RequirementNotFound naming the requirement for each of the first two, in the order given; a RangeError for the third
test("entrySections — a requirement the SPEC lacks is RequirementNotFound, a SPEC with no section takes no new requirement", () => {
  assert.equal(compose([candidate("X", { class: "duplicate", of: "A WRITE RULE" })]).length, 1, "known positive: the requirement is there");
  const items = [candidate("X", { class: "duplicate", of: "A MISSING RULE" }), candidate("Y", { class: "change", of: "ANOTHER MISSING RULE" })];
  assert.throws(() => compose(items), (error) => error.name === "RequirementNotFound" && error.message.includes("A MISSING RULE")
    && JSON.stringify(error.requirements) === JSON.stringify(["A MISSING RULE", "ANOTHER MISSING RULE"]));
  assert.throws(() => compose([candidate("Z")], undefined, JOB, HEAD), RangeError);
});

// TST-473040 · level: unit · module: MOD-spec-changes
// guards: THE PERSON WHO PROMPTS IS A SOURCE
// given: the source of the job as an empty string, and as a number; and a source that is text
// input: entrySections(SPEC, draft, classes, source)
// expect: a TypeError for the first two — a requirement without a source cannot be written —, the section for the text
test("entrySections — the job's source is text", () => {
  const item = candidate("A NEW RULE");
  assert.equal(compose([item], undefined, JOB).length, 1, "known positive");
  assert.throws(() => compose([item], undefined, ""), TypeError);
  assert.throws(() => compose([item], undefined, 5), TypeError);
  assert.throws(() => compose([item], undefined, { trim: () => "Job Source" }), TypeError, "an object that only looks like text");
  assert.throws(() => compose([item], undefined, "  "), TypeError, "white space only");
});

// TST-473041 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-005
// given: a new candidate and a change whose rule and check run over several lines, with runs of white space
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: each rule on one line and each check on one line, white space folded to single blanks, in the new block and in the changed one
test("entrySections — a rule and a check are written on one line each", () => {
  const nu = candidate("A NEW RULE", { rule: "A thing\n  happens   twice.", check: "`tests/new.test.mjs`\nand more" });
  const change = candidate("A CHANGED RULE", { rule: "A reader\nreads  a file.", check: "no automatic check;\n at review", class: "change", of: "A WRITE RULE" });
  const [section] = compose([nu, change]);
  assert.equal(section.anchor, "## 2. Writing");
  assert.ok(section.text.includes("**A WRITE RULE** *(Fixture PO; Job Source, ch. 8)*\nA reader reads a file.\n*Check:* no automatic check; at review\n"));
  assert.ok(section.text.includes("**A NEW RULE** *(Job Source, ch. 8)*\nA thing happens twice.\n*Check:* `tests/new.test.mjs` and more"));
});

// TST-473042 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
// given: a SPEC whose last requirement is the last line, with no line end after it, and a change of it, and a duplicate of it
// input: entrySections(spec, draft, classes, "Job Source")
// expect: the section ends as the SPEC does, with no line end added, for each
test("entrySections — a requirement that ends the SPEC keeps its end as it was", () => {
  const bare = SPEC.slice(0, -1);
  const change = candidate("A CHANGED RULE", { rule: "A writer writes.", check: "no automatic check; at review", class: "change", of: "A WRITE RULE" });
  const duplicate = candidate("RESTATES IT", { class: "duplicate", of: "A WRITE RULE" });
  const [changed] = compose([change], undefined, JOB, bare);
  assert.equal(changed.text, text("## 2. Writing", "", "**A WRITE RULE** *(Fixture PO; Job Source, ch. 8)*", "A writer writes.", "*Check:* no automatic check; at review").slice(0, -1));
  const [added] = compose([duplicate], undefined, JOB, bare);
  assert.equal(added.text, SECTION_2.slice(0, -1).replace("*(Fixture PO)*", "*(Fixture PO; Job Source, ch. 8)*"));
});

// ---------------------------------------------------------------- two changes of one requirement (ITM-636)

const changeOf = (name, of, rule) => candidate(name, { rule, check: "`tests/changed.test.mjs`", class: "change", of });
const twice = (...names) => names.map((name) => changeOf(name, "A SAMPLE RULE", `${name} says the rule differently.`));

// TST-636001 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-005; UC-019
// given: two candidates, A BETTER NAME and A SECOND NAME, each classed as a change of A SAMPLE RULE; and, to show the same call composing, each of them alone
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: each alone gives one section (known positive); both together throw an error named TwoChanges, whose requirement is "A SAMPLE RULE", whose candidates are ["A BETTER NAME", "A SECOND NAME"] in the order of the classes, and whose message reads "A BETTER NAME and A SECOND NAME change A SAMPLE RULE: one block would replace the other. Nothing was composed."
test("entrySections — two candidates that change one requirement are TwoChanges, nothing composed", () => {
  const [first, second] = twice("A BETTER NAME", "A SECOND NAME");
  assert.equal(compose([first]).length, 1, "known positive: the first alone");
  assert.equal(compose([second]).length, 1, "known positive: the second alone");
  assert.throws(() => compose([first, second]), (error) => error.name === "TwoChanges" && error.requirement === "A SAMPLE RULE"
    && JSON.stringify(error.candidates) === JSON.stringify(["A BETTER NAME", "A SECOND NAME"])
    && error.message === "A BETTER NAME and A SECOND NAME change A SAMPLE RULE: one block would replace the other. Nothing was composed.");
});

// TST-636002 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: three candidates classed as changes of A SAMPLE RULE, listed with a change of A WRITE RULE between the second and the third
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: TwoChanges whose requirement is "A SAMPLE RULE" and whose candidates are the three names in the order of the classes; the change of A WRITE RULE is not among them; the message reads "ONE, TWO and THREE change A SAMPLE RULE: one block would replace the other. Nothing was composed."
test("entrySections — TwoChanges names every candidate that changes the requirement", () => {
  const [one, two, three] = twice("ONE", "TWO", "THREE");
  const other = changeOf("OTHER", "A WRITE RULE", "A writer writes a file whole, or says why not.");
  assert.throws(() => compose([one, two, other, three]), (error) => error.name === "TwoChanges" && error.requirement === "A SAMPLE RULE"
    && JSON.stringify(error.candidates) === JSON.stringify(["ONE", "TWO", "THREE"])
    && error.message === "ONE, TWO and THREE change A SAMPLE RULE: one block would replace the other. Nothing was composed.");
});

// TST-636003 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-005
// given: one change of A SAMPLE RULE (section 1) and one change of A WRITE RULE (section 2), each with a rule of its own
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: no error; two sections in the order of the SPEC, section 1 with the block of A SAMPLE RULE replaced by the first candidate's rule and check, section 2 with the block of A WRITE RULE replaced by the second's, each naming "Fixture PO; Job Source, ch. 8"
test("entrySections — one change of each requirement is composed as before", () => {
  const first = changeOf("A BETTER NAME", "A SAMPLE RULE", "A reader reads a file whole, or says why not.");
  const second = changeOf("A WRITER NAME", "A WRITE RULE", "A writer writes a file whole, or says why not.");
  const old = (name, rule, check) => block(name, "Fixture PO", rule, check);
  const changed = (name, rule) => block(name, "Fixture PO; Job Source, ch. 8", rule, "`tests/changed.test.mjs`");
  assert.deepEqual(compose([first, second]), [
    { anchor: "## 1. Reading", until: null, text: SECTION_1.replace(old("A SAMPLE RULE", "A reader reads a file whole.", "`tests/sample.test.mjs`"), changed("A SAMPLE RULE", "A reader reads a file whole, or says why not.")) },
    { anchor: "## 2. Writing", until: null, text: SECTION_2.replace(old("A WRITE RULE", "A writer writes a file whole.", "no automatic check; at review"), changed("A WRITE RULE", "A writer writes a file whole, or says why not.")) }]);
});

// TST-636004 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
// given: a change of A SAMPLE RULE from "ch. 8" and a duplicate of A SAMPLE RULE from "ch. 9", in that order
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: no error; one section, section 1, whose block of A SAMPLE RULE names "Fixture PO; Job Source, ch. 8; Job Source, ch. 9" and holds the change's rule and check: the duplicate adds its source to the block the change left, and no change is lost
test("entrySections — a change and a duplicate of one requirement are not two changes", () => {
  const change = changeOf("A BETTER NAME", "A SAMPLE RULE", "A reader reads a file whole, or says why not.");
  const duplicate = candidate("RESTATES IT", { class: "duplicate", of: "A SAMPLE RULE", passage: "ch. 9" });
  const old = block("A SAMPLE RULE", "Fixture PO", "A reader reads a file whole.", "`tests/sample.test.mjs`");
  const expected = block("A SAMPLE RULE", "Fixture PO; Job Source, ch. 8; Job Source, ch. 9", "A reader reads a file whole, or says why not.", "`tests/changed.test.mjs`");
  assert.deepEqual(compose([change, duplicate]), [{ anchor: "## 1. Reading", until: null, text: SECTION_1.replace(old, expected) }]);
});

// TST-636005 · level: unit · module: MOD-spec-changes
// guards: A CONFLICT IS DECIDED BY A PERSON; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: a change of A SAMPLE RULE and a conflict with A SAMPLE RULE; once the conflict undecided (class conflict), once as the person resolved it (class change of A SAMPLE RULE)
// input: entrySections(SPEC, draft, classes, "Job Source") for each
// expect: undecided: no error, one section holding the change's rule; resolved as a change: TwoChanges whose candidates are the change's name and the conflict's name in the order of the classes
test("entrySections — a conflict counts as a change only as the person resolved it", () => {
  const change = changeOf("A BETTER NAME", "A SAMPLE RULE", "A reader reads a file whole, or says why not.");
  const conflict = candidate("CONTRADICTS IT", { class: "conflict", of: "A SAMPLE RULE", rule: "A reader reads nothing." });
  const undecided = compose([change, conflict], [classed(change), classed(conflict, "conflict", "A SAMPLE RULE")]);
  assert.equal(undecided.length, 1);
  assert.ok(undecided[0].text.includes("A reader reads a file whole, or says why not."));
  assert.ok(!undecided[0].text.includes("A reader reads nothing."));
  assert.throws(() => compose([change, conflict], [classed(change), classed(conflict, "change", "A SAMPLE RULE")]),
    (error) => error.name === "TwoChanges" && JSON.stringify(error.candidates) === JSON.stringify(["A BETTER NAME", "CONTRADICTS IT"]));
});

// TST-636006 · level: unit · module: MOD-spec-changes
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: two changes of a requirement the SPEC does not hold, A MISSING RULE
// input: entrySections(SPEC, draft, classes, "Job Source")
// expect: RequirementNotFound naming A MISSING RULE, not TwoChanges: a requirement the SPEC lacks is refused first
test("entrySections — two changes of a requirement the SPEC lacks are RequirementNotFound", () => {
  const items = [changeOf("ONE", "A MISSING RULE", "One rule."), changeOf("TWO", "A MISSING RULE", "Two rule.")];
  assert.throws(() => compose(items), (error) => error.name === "RequirementNotFound" && JSON.stringify(error.requirements) === JSON.stringify(["A MISSING RULE"]));
});
