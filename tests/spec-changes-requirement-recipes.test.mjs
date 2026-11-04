// The recipes of requirements (ITM-337) — MOD-spec-changes' specStrategies, as the accepted text of docs/architecture/MOD-spec-changes.md
// states them under Interfaces: the recipe chosen-requirements, the requirements the person chose and, without a choice, every requirement
// of the SPEC that no use case realises (MOD-trace-graph's coverageGaps, ITM-308); the recipe named-requirements, the requirements the job's
// parameters name, each with its whole section; and the recipe spec-with-queues, every requirement of the SPEC and of every open entry of
// every queue, each with its section and state, its part carrying each of them as an artifact keyed by its name and its rule, against which
// candidate-classes classifies a draft (ITM-387). The recipe whole-spec and the writer queue-entries (ITM-338) are not part of this item.
// Run: node --test tests/spec-changes-requirement-recipes.test.mjs
//
// Module: MOD-spec-changes
// Guards: DERIVATION SEES THE EXISTING REQUIREMENTS; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES; UC-005; UC-007; UC-019
// Level: unit
//
// The product is a small repository this file holds in memory, never Agent M's own: a SPEC of nine requirements, eight in four sections
// and one before the first, two use cases and a module file, and two change queues under docs/spec-freigaben/ whose entries are in each
// of the states open, approved, stale, waiting for its anchor and in SPEC. It is given to the recipes as a snapshot (paths, the blob SHA
// of every text and a read of the texts), the shape MOD-repository-hosts' Snapshot has, in the context of a job: a recipe is called as
// the job runner calls it, with that context and the job's parameters. The expected values are read off the fixture's own texts — the
// lines of a requirement, the bytes of a section —, never off the code. Each test states its input and its expected result before it runs
// (given / input / expect); where a test expects something to be left out, the same call first shows it giving it on a known positive.
// Nothing reaches the network and nothing waits. The Acceptance's cases are the chosen requirements and their default, the named
// requirements with their sections, and the SPEC's and the open entries' requirements as artifacts; the others — the failure for a name
// the SPEC lacks, no requirement named, an entry in SPEC, the classes of a draft, a product with no requirement and a file the snapshot
// cannot read — state what the readings below add, and can be cut. The counter-proofs are recorded in the pull request.
//
// Where the module file leaves a reading open, the test states the reading it takes, and the pull request names it:
//   - The job's parameter `requirements` is the list of names that the recipes chosen-requirements and named-requirements read, as
//     MOD-approvals' rests-on-accepted reads it for the same job; a value that is not a list names none, and an empty list is no choice.
//   - Without a choice, the requirements stand in the order coverageGaps lists them — by name.
//   - A name the SPEC does not hold, one that stands only in an open entry among them, is the failure RequirementNotFound { requirements },
//     naming every such name in the order given, for both recipes: a requirement is never left out silently.
//   - A requirement's part is named by it and holds it as the SPEC states it — its name and source, its rule, its check; a field it
//     lacks is left out — and nothing of its neighbours; it carries no source of its own, as MOD-approvals' requirement parts, and shows
//     no artifact. A named requirement has its own part with its whole section, the exact bytes of the section it stands in, so a
//     section two of them stand in is given twice; one that stands in no section is given as the SPEC states it.
//   - A file the snapshot cannot read fails the recipe with the snapshot's own failure, unchanged: the recipe never gives a part from
//     less than the SPEC and every queue, since a requirement left out would be left out silently.
//   - spec-with-queues gives one part, or none where the product has no requirement at all. Its text is blocks separated by an empty
//     line, one for each requirement, each holding the requirement as the SPEC states it, the heading line of the section it stands in
//     and the state it is in — in SPEC for the SPEC's own, for a requirement of an entry the state of that entry. Every entry that is
//     not in SPEC is open here: its requirements are a proposal that the product does not hold yet, and one in SPEC is the SPEC's already.
//     The SPEC's requirements come first in the order they stand, then those of the queues newest first, each queue's entries in the
//     order of its index and each proposal's requirements in the order they stand; a requirement that stands in no section shows none.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { classifyCandidates } from "../src/documents/index.mjs";
import * as specChanges from "../src/spec-changes/index.mjs";

// A name the module does not provide yet is undefined here, so that each test fails by itself and not the whole file at once.
const { specStrategies } = specChanges;

// ---------------------------------------------------------------- the product

const text = (...lines) => lines.join("\n") + "\n";
const pad2 = (n) => String(n).padStart(2, "0");
// The blob SHA of a text, as `git hash-object` gives it.
function gitBlob(body) {
  const bytes = Buffer.from(body, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}
// A snapshot of the files given, as MOD-repository-hosts' Snapshot has it.
const snapshotOf = (files) => ({
  paths: Object.keys(files),
  blob: (path) => (Object.hasOwn(files, path) ? gitBlob(files[path]) : null),
  read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
});
// A recipe called as the job runner calls it: with the job's context and its parameters.
const run = (recipe, snapshot, params = {}) => specStrategies.recipes[recipe](
  { params, product: { address: "https://github.com/alice/product", snapshot, host: null } }, params);

// The SPEC: a requirement before the first section; section 1, whose second requirement has two sources; section 2, with a requirement
// without a check, one without a source and one without a rule; the sections 3 and 4.
const PREAMBLE = text(
  "# Fixture product — Specification", "",
  "**A PREAMBLE RULE** *(Product Owner)*", "A rule stated before the first section.", "*Check:* no automatic check; at review", "");
const READING = text(
  "## 1. Reading", "",
  "**A SAMPLE RULE** *(Product Owner)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "",
  "**ANOTHER SAMPLE RULE** *(Product Owner; SRC-fixture 2026)*", "A reader sees the name of a file.", "*Check:* no automatic check; at review", "");
const WRITING = text(
  "## 2. Writing", "",
  "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole.", "*Check:* `tests/write.test.mjs`", "",
  "**A RULE WITHOUT A CHECK** *(Product Owner)*", "A writer says why a file was not written.", "",
  "**A RULE WITHOUT A SOURCE**", "A writer names the file it wrote.", "*Check:* no automatic check; at review", "",
  "**A NAME WITHOUT A RULE** *(Product Owner)*", "*Check:* no automatic check; at review", "");
const DECIDING = text(
  "## 3. Deciding", "",
  "**A DECIDED RULE** *(Product Owner)*", "A person decides what is accepted.", "*Check:* no automatic check; at review", "");
const AGING = text(
  "## 4. Aging", "",
  "**AN AGING RULE** *(Product Owner)*", "An aged file is shown as aged.", "*Check:* no automatic check; at review", "");
const SPEC = PREAMBLE + READING + WRITING + DECIDING + AGING;

// UC-001 realises A SAMPLE RULE; UC-002 three requirements of the later sections; a module realises A RULE WITHOUT A CHECK, which no
// use case does.
const useCase = (id, title, realises) => text("---", `id: ${id}`, `title: ${title}`, "area: reading", "actors:", "  - Reader",
  "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${title}.`);
const DOCUMENTS = {
  "docs/use-cases/UC-001-read-a-file.md": useCase("UC-001", "Read a file", ["A SAMPLE RULE"]),
  "docs/use-cases/UC-002-write-a-file.md": useCase("UC-002", "Write a file", ["A WRITE RULE", "A DECIDED RULE", "AN AGING RULE"]),
  "docs/architecture/MOD-sample.md": text("---", "id: MOD-sample", "title: Sample", "folder: src/sample/", "realises:",
    "  - A RULE WITHOUT A CHECK", "provides:", "  - sample", "---", "# MOD-sample Sample", ""),
};

// The proposals of the entries, each the whole section as proposed.
const READING_PROPOSED = READING.replace("A reader reads a file whole.", "A reader reads a file whole, or says why not.");
const ADDED = text(
  "## 1a. Added", "",
  "**AN ADDED RULE** *(Product Owner)*", "A reader sees what was added.", "*Check:* no automatic check; at review", "");
const ADDED_AGAIN = ADDED.replace("sees what was added", "sees what was added, and when");
const WRITING_PROPOSED = text(
  "## 2. Writing", "",
  "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole, or says why not.", "*Check:* `tests/write.test.mjs`", "");
const WRITING_SECOND = text(
  "## 2. Writing", "",
  "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole, or names the error.", "*Check:* `tests/write.test.mjs`", "",
  "**A SECOND QUEUE RULE** *(Product Owner)*", "A writer writes into the queue of a later day.", "*Check:* no automatic check; at review", "");
const AGING_PROPOSED = AGING.replace("shown as aged.", "shown as aged, with its age.");
const AGING_EARLIER = AGING.replace("shown as aged.", "shown as old.");

// A queue: its index with the entries given, its decisions, the proposals and the approval records.
const QUEUE_1 = "docs/spec-freigaben/2026-03-01_sample";
const QUEUE_2 = "docs/spec-freigaben/2026-03-02_second";
const entry = (nr, anchor, slug, proposal) => ({ nr, anchor, slug, proposal });
const proposalPath = (folder, item) => `${folder}/${pad2(item.nr)}-${item.slug}.md`;
// The approval record of an entry, as MOD-approvals' schema writes it: the proposal and the section as the reviewer saw them.
function record(folder, item, { proposal = item.proposal, section }) {
  const blob = gitBlob(proposal);
  return {
    path: `docs/approvals/spec-${folder.split("/").pop()}-${pad2(item.nr)}-${blob.slice(0, 12)}.md`,
    text: ["kind: spec", `queue: ${folder}`, `entry: ${pad2(item.nr)}`, `proposal: ${proposalPath(folder, item)}`, `blob: ${blob}`,
      "target: SPEC.md", `anchor: ${item.anchor}`, `section: ${gitBlob(section)}`, ""].join("\n"),
  };
}
function queueFiles(folder, title, entries, { records = [], decided = [] } = {}) {
  const date = folder.split("/").pop().slice(0, 10);
  return {
    [`${folder}/index.md`]: text(`# SPEC approvals — queue ${date} · ${title}`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...entries.map((item) => `| ${pad2(item.nr)} | \`SPEC.md\` | ${item.anchor} | — | — |`)),
    [`${folder}/entscheidungen.md`]: text(`# Decisions — queue ${date} ${title}`, "", "Append-only.",
      ...decided.map((d) => `| ${date} 10:00 UTC | ${d.entry} | uebernommen | approval:${d.record.path.replace("docs/approvals/", "")} |`)),
    ...Object.fromEntries(entries.map((item) => [proposalPath(folder, item), item.proposal])),
    ...Object.fromEntries(records.map((r) => [r.path, r.text])),
  };
}
// Queue 1 (the older): 01 open, whose proposal also creates the section 1a; 02 approved, a record names its proposal and the section as it
// holds; 03 in SPEC, a decision row names its record; 04 stale, a record names an earlier wording of its proposal; 05 waiting for the
// anchor 1a, which entry 01 creates. Queue 2 (the newer): 01 open.
const E1 = entry(1, "## 1. Reading", "reading", READING_PROPOSED + ADDED);
const E2 = entry(2, "## 2. Writing", "writing", WRITING_PROPOSED);
const E3 = entry(3, "## 3. Deciding", "deciding", DECIDING);
const E4 = entry(4, "## 4. Aging", "aging", AGING_PROPOSED);
const E5 = entry(5, "## 1a. Added", "added", ADDED_AGAIN);
const E_SECOND = entry(1, "## 2. Writing", "writing", WRITING_SECOND);
const DECIDED = { entry: 3, record: record(QUEUE_1, E3, { section: DECIDING }) };
const QUEUES = {
  ...queueFiles(QUEUE_1, "sample", [E1, E2, E3, E4, E5], { decided: [DECIDED], records: [record(QUEUE_1, E2, { section: WRITING }),
    DECIDED.record, record(QUEUE_1, E4, { proposal: AGING_EARLIER, section: AGING })] }),
  ...queueFiles(QUEUE_2, "second", [E_SECOND]),
};
const WITH_QUEUES = snapshotOf({ "SPEC.md": SPEC, ...DOCUMENTS, ...QUEUES });
const WITHOUT_QUEUES = snapshotOf({ "SPEC.md": SPEC, ...DOCUMENTS });

// The lines of the requirement `name` in a text: from its head line to the line before the next empty one — the requirement as the
// text states it. And its rule, the lines between its head line and its check: none, the empty text, for a requirement without one.
function stated(body, name) {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => line.startsWith(`**${name}**`));
  assert.ok(at >= 0, `${name} stands in the text`);
  return lines.slice(at, lines.indexOf("", at)).join("\n");
}
const ruleOf = (body, name) => stated(body, name).split("\n").slice(1).filter((line) => !line.startsWith("*Check:*")).join("\n");
const namesOf = (parts) => parts.map((part) => part.name);

// ---------------------------------------------------------------- the recipe chosen-requirements

// TST-473009 · level: unit · module: MOD-spec-changes
// guards: UC-007
// given: the product above; the parameter requirements naming A WRITE RULE, A SAMPLE RULE, A RULE WITHOUT A SOURCE, A RULE WITHOUT A CHECK and A NAME WITHOUT A RULE, in that order — not the order the SPEC states them in —, and not ANOTHER SAMPLE RULE
// input: the recipe chosen-requirements, with the job's context and that parameter
// expect: five parts in the order named, each named by its requirement and holding it as the SPEC states it — a requirement without a source, a check or a rule as it lacks them —, with no source of its own and no artifact, and none for the requirement not named
test("chosen-requirements — the requirements the person chose, in the order chosen, each as the SPEC states it", async () => {
  const chosen = ["A WRITE RULE", "A SAMPLE RULE", "A RULE WITHOUT A SOURCE", "A RULE WITHOUT A CHECK", "A NAME WITHOUT A RULE"];

  const parts = await run("chosen-requirements", WITH_QUEUES, { requirements: chosen });

  assert.deepEqual(parts.map(({ name, text: held, sources, artifacts }) => ({ name, text: held, sources, artifacts })),
    chosen.map((name) => ({ name, text: stated(SPEC, name), sources: [], artifacts: undefined })));
});

// TST-473010 · level: unit · module: MOD-spec-changes
// guards: UC-007
// given: the product above, whose use cases realise A SAMPLE RULE, A WRITE RULE, A DECIDED RULE and AN AGING RULE, and whose module realises A RULE WITHOUT A CHECK; the job's parameters without a choice — none; an empty list; a name that is no list — and, to show the same call giving a choice, the parameter naming A SAMPLE RULE
// input: the recipe chosen-requirements, with each
// expect: with a choice, the one part of A SAMPLE RULE; without one, the five requirements that no use case realises — A RULE WITHOUT A CHECK among them, which only a module realises —, each as the SPEC states it, in the order of MOD-trace-graph's coverageGaps, by name (so ANOTHER SAMPLE RULE comes last, though the SPEC states it before the three of section 2), and none of the realised
test("chosen-requirements — without a choice, every requirement of the SPEC that no use case realises", async () => {
  const unrealised = ["A NAME WITHOUT A RULE", "A PREAMBLE RULE", "A RULE WITHOUT A CHECK", "A RULE WITHOUT A SOURCE", "ANOTHER SAMPLE RULE"];

  assert.deepEqual(namesOf(await run("chosen-requirements", WITH_QUEUES, { requirements: ["A SAMPLE RULE"] })), ["A SAMPLE RULE"],
    "known positive: a choice gives the requirement chosen");

  for (const params of [{}, { requirements: [] }, { requirements: "A SAMPLE RULE" }]) {
    const parts = await run("chosen-requirements", WITH_QUEUES, params);
    assert.deepEqual(parts.map(({ name, text: held, sources, artifacts }) => ({ name, text: held, sources, artifacts })),
      unrealised.map((name) => ({ name, text: stated(SPEC, name), sources: [], artifacts: undefined })), JSON.stringify(params));
  }
});

// ---------------------------------------------------------------- a name the SPEC does not hold

// TST-473011 · level: unit · module: MOD-spec-changes
// guards: UC-007; UC-019
// given: the product above; names that the SPEC holds, and then names it does not: NO SUCH RULE, A SAMPLE RULE (held), and A SECOND QUEUE RULE, which stands in an open entry of the second queue and not in the SPEC
// input: the recipes chosen-requirements and named-requirements, with the held names, and with all three
// expect: the held names give their parts; the three names give the failure RequirementNotFound, whose requirements are the two the SPEC does not hold, in the order given, and whose message names both and not A SAMPLE RULE
test("chosen-requirements and named-requirements — a name the SPEC does not hold is a failure naming it, an open entry's among them", async () => {
  for (const recipe of ["chosen-requirements", "named-requirements"]) {
    assert.deepEqual(namesOf(await run(recipe, WITH_QUEUES, { requirements: ["A SAMPLE RULE"] })), ["A SAMPLE RULE"],
      `known positive: ${recipe} gives a requirement the SPEC holds`);
    await assert.rejects(run(recipe, WITH_QUEUES, { requirements: ["NO SUCH RULE", "A SAMPLE RULE", "A SECOND QUEUE RULE"] }), (error) => {
      assert.equal(error.name, "RequirementNotFound");
      assert.deepEqual(error.requirements, ["NO SUCH RULE", "A SECOND QUEUE RULE"]);
      assert.ok(error.message.includes("NO SUCH RULE") && error.message.includes("A SECOND QUEUE RULE"), error.message);
      assert.ok(!error.message.includes("A SAMPLE RULE"), error.message);
      return true;
    }, recipe);
  }
});

// ---------------------------------------------------------------- the recipe named-requirements

// TST-473012 · level: unit · module: MOD-spec-changes
// guards: UC-019; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
// given: the product above; the parameter requirements naming A WRITE RULE, A SAMPLE RULE, A RULE WITHOUT A CHECK — which stands in the same section as A WRITE RULE — and A PREAMBLE RULE, which stands in no section
// input: the recipe named-requirements, with the job's context and that parameter
// expect: four parts in the order named, each named by its requirement: for the first three the whole section it stands in, byte for byte — section 2 twice, section 1 once, with the neighbours of each requirement —, for the last the requirement as the SPEC states it; with no source of their own and no artifact
test("named-requirements — each requirement named, with the whole section it stands in", async () => {
  const named = ["A WRITE RULE", "A SAMPLE RULE", "A RULE WITHOUT A CHECK", "A PREAMBLE RULE"];

  const parts = await run("named-requirements", WITH_QUEUES, { requirements: named });

  assert.deepEqual(parts.map(({ name, text: held, sources, artifacts }) => ({ name, text: held, sources, artifacts })), [
    { name: "A WRITE RULE", text: WRITING, sources: [], artifacts: undefined },
    { name: "A SAMPLE RULE", text: READING, sources: [], artifacts: undefined },
    { name: "A RULE WITHOUT A CHECK", text: WRITING, sources: [], artifacts: undefined },
    { name: "A PREAMBLE RULE", text: stated(SPEC, "A PREAMBLE RULE"), sources: [], artifacts: undefined },
  ]);
});

// TST-473013 · level: unit · module: MOD-spec-changes
// guards: UC-019
// given: the product above; a job that names a requirement, to show the same call giving a part; then a job that names none — no parameter, and an empty list
// input: the recipe named-requirements, with each
// expect: the part of the requirement named; no part where none is named
test("named-requirements — no requirement named, no part", async () => {
  assert.deepEqual(namesOf(await run("named-requirements", WITH_QUEUES, { requirements: ["A DECIDED RULE"] })), ["A DECIDED RULE"],
    "known positive: a requirement named is given");

  assert.deepEqual(await run("named-requirements", WITH_QUEUES, {}), []);
  assert.deepEqual(await run("named-requirements", WITH_QUEUES, { requirements: [] }), []);
});

// ---------------------------------------------------------------- the recipe spec-with-queues

// What each block of the part's text holds, in the order the text gives them: the requirement, the text it is stated in, the heading line
// of its section or null, and its state. The SPEC's nine, then the open entries' eight, newest queue first.
const IN_SPEC = (name, section) => ({ name, section, state: "in SPEC", from: SPEC });
const SPEC_LISTED = [IN_SPEC("A PREAMBLE RULE", null), IN_SPEC("A SAMPLE RULE", "## 1. Reading"),
  IN_SPEC("ANOTHER SAMPLE RULE", "## 1. Reading"), IN_SPEC("A WRITE RULE", "## 2. Writing"),
  IN_SPEC("A RULE WITHOUT A CHECK", "## 2. Writing"), IN_SPEC("A RULE WITHOUT A SOURCE", "## 2. Writing"),
  IN_SPEC("A NAME WITHOUT A RULE", "## 2. Writing"), IN_SPEC("A DECIDED RULE", "## 3. Deciding"), IN_SPEC("AN AGING RULE", "## 4. Aging")];
const OF_ENTRY = (state, from, ...listed) => listed.map(([name, section]) => ({ name, section, state, from }));
const ENTRIES_LISTED = [
  ...OF_ENTRY("open", E1.proposal, ["A SAMPLE RULE", "## 1. Reading"], ["ANOTHER SAMPLE RULE", "## 1. Reading"], ["AN ADDED RULE", "## 1a. Added"]),
  ...OF_ENTRY("approved", WRITING_PROPOSED, ["A WRITE RULE", "## 2. Writing"]),
  ...OF_ENTRY("stale", AGING_PROPOSED, ["AN AGING RULE", "## 4. Aging"]),
  ...OF_ENTRY("waiting for its anchor", ADDED_AGAIN, ["AN ADDED RULE", "## 1a. Added"]),
  ...OF_ENTRY("open", WRITING_SECOND, ["A WRITE RULE", "## 2. Writing"], ["A SECOND QUEUE RULE", "## 2. Writing"]),
];

const blocksOf = (part) => part.text.split(/\n{2,}/).filter((block) => block.trim() !== "");
// The part's text holds one block for each requirement listed, in order, each with the requirement as its text states it, its state and the
// heading line of its section; a requirement that stands in no section shows none.
function assertListed(part, listed) {
  const blocks = blocksOf(part);
  assert.equal(blocks.length, listed.length, `one block for each of ${listed.length} requirements:\n${part.text}`);
  listed.forEach((each, at) => {
    const block = blocks[at], own = stated(each.from, each.name);
    assert.ok(block.includes(own), `block ${at + 1} holds ${each.name} as it is stated:\n${block}`);
    const rest = block.replace(own, "");
    assert.ok(rest.includes(each.state), `block ${at + 1}, ${each.name}, names its state ${each.state}:\n${block}`);
    if (each.section === null) {
      assert.ok(!rest.includes("##") && !/null|undefined/.test(rest), `block ${at + 1}, ${each.name}, shows no section:\n${block}`);
    } else {
      assert.ok(rest.includes(each.section), `block ${at + 1}, ${each.name}, names its section ${each.section}:\n${block}`);
    }
  });
}

// TST-473014 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005
// given: the product above without a queue — a new product's case
// input: the recipe spec-with-queues, with the job's context
// expect: one part, named for the SPEC, whose text has one block for each of the SPEC's nine requirements in the order they stand, each as the SPEC states it with the heading line of its section — none for A PREAMBLE RULE — and the state in SPEC
test("spec-with-queues — every requirement of the SPEC, with its section and its state", async () => {
  const parts = await run("spec-with-queues", WITHOUT_QUEUES);

  assert.equal(parts.length, 1);
  assert.match(parts[0].name, /SPEC/, "the part is named for the SPEC");
  assertListed(parts[0], SPEC_LISTED);
});

// TST-473015 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005; UC-019
// given: the product above with its two queues: the older one's entry 01 open, whose proposal changes two requirements of section 1 and adds the section 1a, 02 approved, 03 in SPEC, 04 stale and 05 waiting for its anchor; the newer one's entry 01 open
// input: the recipe spec-with-queues, with the job's context
// expect: one part whose text lists the SPEC's nine requirements and then the eight of the entries that are not in SPEC — in the order of the queues' folders' names, the older queue's in the order of its index: three of 01, one each of 02, 04 and 05, then the newer queue's two —, each as its proposal states it, with the state of its entry and the heading of the section it stands in there: AN ADDED RULE under 1a, though its entry starts at section 1; a requirement that an entry changes is listed as the SPEC states it and as the entry proposes it
test("spec-with-queues — every requirement of every open entry, with the state of its entry, after the SPEC's own", async () => {
  const parts = await run("spec-with-queues", WITH_QUEUES);

  assert.equal(parts.length, 1);
  assertListed(parts[0], [...SPEC_LISTED, ...ENTRIES_LISTED]);
});

// TST-473016 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005
// given: the product above with its two queues, whose entry 03 is in SPEC — a decision row names its record — and proposes the section 3 word for word as the SPEC holds it, with A DECIDED RULE; and, to show the same call listing an entry's requirement beside the SPEC's, A SAMPLE RULE, which the SPEC holds and entry 01 of the older queue proposes in another wording
// input: the recipe spec-with-queues, with the job's context
// expect: A DECIDED RULE once, in the state in SPEC, and A SAMPLE RULE twice — in SPEC, and open
test("spec-with-queues — an entry that is in SPEC adds nothing to the SPEC's own requirements", async () => {
  const [part] = await run("spec-with-queues", WITH_QUEUES);

  const blocksNaming = (name) => blocksOf(part).filter((block) => block.includes(`**${name}**`));
  const sample = blocksNaming("A SAMPLE RULE");
  assert.equal(sample.length, 2, "known positive: a requirement the SPEC holds and an open entry proposes is listed twice");
  assert.ok(sample[0].includes("in SPEC") && sample[1].includes("open"), sample.join("\n\n"));
  const decided = blocksNaming("A DECIDED RULE");
  assert.equal(decided.length, 1);
  assert.ok(decided[0].includes("in SPEC"), decided[0]);
});

// TST-473017 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005
// given: the product above with its two queues
// input: the recipe spec-with-queues, with the job's context
// expect: the part carries one artifact for each requirement listed, in the order of the text — the SPEC's nine and the entries' eight —, whose identifier is the requirement's name and whose key is its name and its rule, the rule as the text it is stated in gives it
test("spec-with-queues — each requirement is carried as an artifact keyed by its name and its rule", async () => {
  const [part] = await run("spec-with-queues", WITH_QUEUES);

  assert.deepEqual(part.artifacts, [...SPEC_LISTED, ...ENTRIES_LISTED].map((each) => (
    { id: each.name, keys: [each.name, ruleOf(each.from, each.name)] })));
});

// TST-473018 · level: unit · module: MOD-spec-changes
// guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-005
// given: the part of the product above with its two queues; three candidates: one that restates the rule of A SECOND QUEUE RULE, which stands in an open entry only, under another name; one that restates A DECIDED RULE, which the SPEC holds, with the rule the SPEC states for it; and one that no requirement states
// input: MOD-documents' classifyCandidates of the candidates against the part's artifacts
// expect: the first a duplicate of A SECOND QUEUE RULE and the second a duplicate of A DECIDED RULE, each decided by rule; the third new, left to the participant
test("spec-with-queues — a draft is classified against its artifacts: a restated rule and a restated requirement of the SPEC are duplicates", async () => {
  const [part] = await run("spec-with-queues", WITH_QUEUES);
  const candidate = (ref, name, rule) => ({ ref, keys: [name, rule], from: [`passage of ${ref}`], proposed: { class: "new", of: null } });

  const classes = classifyCandidates([
    candidate("restated", "A RESTATED QUEUE RULE", ruleOf(WRITING_SECOND, "A SECOND QUEUE RULE")),
    candidate("taken", "A DECIDED RULE", ruleOf(DECIDING, "A DECIDED RULE")),
    candidate("fresh", "A FRESH RULE", "Nothing in the product says this."),
  ], part.artifacts);

  assert.deepEqual(classes.map(({ refs, class: kind, of, decidedBy }) => ({ refs, class: kind, of, decidedBy })), [
    { refs: ["restated"], class: "duplicate", of: "A SECOND QUEUE RULE", decidedBy: "rule" },
    { refs: ["taken"], class: "duplicate", of: "A DECIDED RULE", decidedBy: "rule" },
    { refs: ["fresh"], class: "new", of: null, decidedBy: "participant" },
  ]);
});

// TST-473019 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005
// given: the product above, to show the same call giving a part; then a new product whose SPEC has a section and no requirement, and no queue
// input: the recipe spec-with-queues, with each
// expect: one part for the first; no part for the second
test("spec-with-queues — a product with no requirement gives no part", async () => {
  assert.equal((await run("spec-with-queues", WITH_QUEUES)).length, 1, "known positive");

  const fresh = snapshotOf({ "SPEC.md": text("# Fresh product — Specification", "", "## Requirements", "") });
  assert.deepEqual(await run("spec-with-queues", fresh), []);
});

// TST-473020 · level: unit · module: MOD-spec-changes
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005; UC-007; UC-019
// given: the product above, and copies of its snapshot that cannot read one file each and fail as a host does, with a failure named Unreachable: the SPEC, the index of the older queue, and the proposal of the newer queue's entry; and the product without a queue, with the SPEC that cannot be read
// input: the recipe spec-with-queues with each of the four; the recipes chosen-requirements and named-requirements, with a name the SPEC holds, with the SPEC that cannot be read; and, to show the same calls giving parts, each on the snapshot that reads every file
// expect: every call on the snapshot that reads every file gives a part; every call on a snapshot that cannot read a file fails with that failure, unchanged and naming the file — none gives a part made of what it could read
test("the recipes — a file the snapshot cannot read fails the recipe with the snapshot's failure, and leaves nothing out", async () => {
  const unreadable = (snapshot, path) => ({ ...snapshot, read: async (each) => {
    if (each === path) throw Object.assign(new Error(`${path} cannot be read`), { name: "Unreachable" });
    return snapshot.read(each);
  } });
  const sample = { requirements: ["A SAMPLE RULE"] };
  const calls = [["spec-with-queues", {}, WITH_QUEUES, "SPEC.md"], ["spec-with-queues", {}, WITH_QUEUES, `${QUEUE_1}/index.md`],
    ["spec-with-queues", {}, WITH_QUEUES, proposalPath(QUEUE_2, E_SECOND)], ["spec-with-queues", {}, WITHOUT_QUEUES, "SPEC.md"],
    ["chosen-requirements", sample, WITH_QUEUES, "SPEC.md"], ["named-requirements", sample, WITH_QUEUES, "SPEC.md"]];

  for (const [recipe, params, snapshot, path] of calls) {
    assert.ok((await run(recipe, snapshot, params)).length > 0, `known positive: ${recipe} gives a part`);
    await assert.rejects(run(recipe, unreadable(snapshot, path), params), (error) => error.name === "Unreachable" && error.message.includes(path),
      `${recipe} fails when ${path} cannot be read`);
  }
});
