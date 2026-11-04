// Every kind of job, as data — MOD-job-catalogue's interface as docs/architecture/MOD-job-catalogue.md states it: the index
// `kinds.md`, one folder per kind with its definition `kind.md`, its prompt `prompt.md` and the schema of its draft
// `answer.schema.json`, the schema every definition follows `definition.schema.md`; kindNames and kindOf.
// Run: node --test tests/job-catalogue.test.mjs
//
// Module: MOD-job-catalogue
// Guards: ONE DEFINITION, THREE DRIVERS; THE CATALOGUE IS DATA; THE CORRECTION LOOP HAS A FIXED LIMIT
// Level: component
//
// The expected kinds are stated in this file: the table of kinds — name, the use cases it serves, what its participant
// needs, its preconditions, recipes, checks, reviewers, steps, review and writer —, and the lists of the kinds with product
// resources, with gate points, and with the rule a person decides. Every kind has the limit of rounds UC-019 states as the
// default, 5.
//
// The catalogue is read as every caller reads it, through its index.mjs. Where a test needs a definition the catalogue does
// not ship, the module is loaded anew with a disk that gives that text for one file and the real text for every other, as
// tests/participant-list.test.mjs loads MOD-participant-list; the shipped files are never changed. Each test states its
// input and its expected result before it runs (given / input / expect); where a test asserts a refusal, the same call is
// first shown to succeed on a known positive. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { kindNames, kindOf } from "../src/job-catalogue/index.mjs";

const MODULE = new URL("../src/job-catalogue/index.mjs", import.meta.url);
const KINDS = new URL("../src/job-catalogue/kinds/", import.meta.url);
const ONE_DEFINITION = "ONE DEFINITION, THREE DRIVERS";

// ---------------------------------------------------------------- the expected kinds, stated here

// The accepted table of kinds, one row per kind, stated in this test's own text. Row cells: kind | serves | participant
// needs | preconditions | recipes (a name ending in ? may be left out) | checks | reviewers | steps | review · writer |
// the draft it expects. A ~ stands where the module file writes a backtick.
const TABLE_TEXT = `
| ~derive-requirements~ | UC-005 | draft text | | ~instruction?~, ~source-excerpt~, ~spec-with-queues~, ~chapters-for-requirements~ | ~requirement-form~, ~candidate-classes~ | | | ~person~ · ~queue-entries~ | candidates: name, rule, check, what it constrains, source passage — and the source of a rule it points to, where that is not the job's —, class |
| ~change-requirements~ | UC-019, UC-012, UC-049 | draft text | ~person-source~ | ~instruction~, ~conversation~, ~draft?~, ~issue-context?~, ~named-requirements~, ~spec-with-queues~, ~chapters-for-requirements~ | ~requirement-form~, ~candidate-classes~ | | | ~person~ · ~queue-entries~ | the same |
| ~derive-use-cases~ | UC-007 | draft text | ~rests-on-accepted~ | ~instruction?~, ~chosen-requirements~, ~use-cases~, ~chapters-for-requirements~ | ~document-schema~, ~graph-checks~, ~candidate-classes~ | | | ~none~ · ~open-files~ | files |
| ~change-use-case~ | UC-019, UC-049 | draft text | | ~instruction~, ~conversation~, ~draft?~, ~use-case-with-neighbours~, ~chapters-for-requirements~ | ~document-schema~, ~graph-checks~, ~identifier-kept~ | | | ~person~ · ~open-files~ | files |
| ~derive-architecture~ | UC-022 | draft text | ~architecture-ready~ | ~instruction?~, ~whole-spec~, ~accepted-use-cases~, ~chapters-for-architecture~ | ~document-schema~, ~graph-checks~, ~candidate-classes~ | ~review-architecture~ × 1 | ~due-diligence~ | ~person~ · ~open-files~ | files |
| ~change-architecture~ | UC-023, UC-049 | draft text | ~rests-on-accepted~ | ~instruction~, ~conversation~, ~draft?~, ~whole-spec~, ~use-cases~, ~whole-architecture~, ~chapters-for-architecture~ | ~document-schema~, ~graph-checks~, ~identifier-kept~, ~candidate-classes~ | ~review-architecture~ × 1 | ~due-diligence~ | ~person~ · ~open-files~ | files |
| ~review-architecture~ | UC-022, UC-023 | draft text | | ~instruction?~, ~whole-spec~, ~accepted-use-cases~, ~whole-architecture~, ~draft~, ~chapters-for-architecture~ | | | | ~none~ · ~return-draft~ | findings, each a warning |
| ~propose-groups~ | UC-021 | draft text | | ~items-of-kind~ | ~group-rules~ | | | ~none~ · ~return-draft~ | moves, each a ~GroupMove~ of MOD-group-document |
| ~draft-plan~ | UC-045 | draft text | ~rests-on-accepted~ | ~architecture-and-model~ | ~plan-checks~ | | | ~person~ · ~plan-steps~ | steps |
| ~propose-items~ | UC-032 | draft text | ~rests-on-accepted~ | ~backlog-inputs~ | ~backlog-checks~, ~candidate-classes~ | | | ~person~ · ~backlog-items~ | items |
| ~check-affected-modules~ | UC-008 | draft text | ~rests-on-accepted~ | ~use-case-with-neighbours~, ~whole-architecture~ | ~backlog-checks~ | | ~leave-out-named-modules~ | ~none~ · ~backlog-items~ | items, one for each module whose implementation the accepted use case's text changes, each realising the use case and naming that module |
| ~close-sprint~ | UC-041 | draft text, read the repository, write to the repository | | ~sprint-facts~ | ~sprint-record-checks~ | | | ~none~ · ~sprint-record~ | the review, the retrospective, the proposed changes |
| ~implement~ | UC-024, UC-034, UC-043 | write to the repository, run code and tests | ~rests-on-accepted~ | ~instruction?~, ~implementation-inputs~, ~chapters-for-implementation~, ~resource-pins~ | | | | ~none~ · ~branch-and-pull-request~ | the agent's report: branch, commits, pull request |
| ~refactor~ | UC-024 | write to the repository, run code and tests | ~rests-on-accepted~ | ~instruction?~, ~implementation-inputs~, ~resource-pins~ | | | | ~none~ · ~branch-and-pull-request~ | the same |
| ~decide-gate~ | UC-034, UC-036 | read the repository | | ~gate-inputs~ | | | | ~none~ · ~gate-record~ | the decision and its reasoning |
| ~set-up-ci~ | UC-043, UC-027 | — | | | | | | ~none~ · ~ci-configuration~ | — |
| ~propose-tests~ | UC-026, UC-043 | read the repository, write to the repository, run code and tests | ~rests-on-accepted~ | ~instruction?~, ~test-selection~, ~chapters-for-tests~ | ~test-proposals~, ~candidate-classes~ | | | ~person~ · ~return-draft~ | test cases: identifier, level, what each guards, precondition, input, expected result, class |
| ~write-tests~ | UC-026, UC-043 | read the repository, write to the repository, run code and tests | ~rests-on-accepted~ | ~instruction?~, ~draft~, ~test-selection~, ~chapters-for-tests~, ~resource-pins~ | ~test-declarations~, ~test-proposals~ | | | ~none~ · ~branch-and-pull-request~ | the agent's report: branch, commits, pull request; each test with its outcome and its counter-proof, or why it was not written |
| ~run-tests~ | UC-028, UC-013 | run code and tests | | ~instruction?~, ~commit-and-levels~, ~resource-pins~ | | | | ~none~ · ~result-record~ | the outcomes |
| ~analyse-issue~ | UC-012 | draft text | | ~issue-context~ | | | | ~none~ · ~return-draft~ | the class and its reasoning |
| ~fix-bug~ | UC-012 | write to the repository, run code and tests | | ~instruction?~, ~fix-inputs~, ~chapters-for-tests~, ~resource-pins~ | | | | ~none~ · ~branch-and-pull-request~ | the agent's report |
| ~propose-issues~ | UC-038 | draft text | | ~mail-batch~ | ~people-search~ | | | ~none~ · ~return-draft~ | one proposal per mail |
| ~rewrite-without-persons~ | UC-038 | draft text | | ~report-data~ | ~people-search~ | ~check-for-persons~ × 3 | | ~none~ · ~return-draft~ | the rewritten text |
| ~check-for-persons~ | UC-038 | draft text | | ~draft~ | | | | ~none~ · ~return-draft~ | findings |
| ~draft-replies~ | UC-039 | draft text | | ~reply-inputs~ | | | | ~none~ · ~mail-drafts~ | one reply per mail |
| ~check-resource~ | UC-040 | run code and tests | | ~instruction?~, ~resource-check~ | | | | ~none~ · ~return-draft~ | what answered |
| ~converse~ | UC-049 | draft text | | ~page~, ~conversation~, ~instruction~, ~chapters-for-page?~ | ~document-schema~, ~graph-checks~ | | | ~person~ · ~proposed-edits~ | the answer, the edits the participant proposed, and the hand-over it proposes |
`;

// The names a cell lists: the text of each ~…~ in it, or, without any, its comma-separated words; none for "—" or blank.
const named = (cell) => {
  const quoted = [...cell.matchAll(/~([^~]+)~/g)].map((m) => m[1]);
  if (quoted.length) return quoted;
  return cell.trim() === "—" || cell.trim() === "" ? [] : cell.split(",").map((part) => part.trim());
};

const TABLE = TABLE_TEXT.trim().split("\n").map((line) => {
  const cells = line.split("|").slice(1, -1);
  const [kind, serves, needs, preconditions, recipes, checks, reviewers, steps, reviewWriter] = cells;
  const [review, writer] = named(reviewWriter);
  const reviewer = reviewers.trim() ? { kind: named(reviewers)[0], count: Number(reviewers.match(/× (\d+)/)[1]) } : null;
  return { name: named(kind)[0], serves: named(serves), needs: named(needs), preconditions: named(preconditions),
    recipes: named(recipes), checks: named(checks), reviewer, steps: named(steps), review, writer };
});

// The kinds with `resources: product`; with the gate points before-merge and question; with before-merge alone; and those
// whose findings of A CONFLICT IS DECIDED BY A PERSON go to a person.
const PRODUCT_RESOURCES = ["implement", "refactor", "fix-bug", "write-tests", "run-tests"];
const MERGE_AND_QUESTION = ["implement", "refactor", "fix-bug"];
const MERGE_ONLY = ["write-tests"];
const PERSON_DECIDES = ["derive-requirements", "change-requirements", "derive-architecture", "change-architecture"];

// The kinds whose prompt holds the named place {{draft}}, stated here: the three change kinds take the conversation's draft as it
// stands; review-architecture, write-tests and check-for-persons take the draft under review, the cases, the text to check.
const DRAFT_PLACE = ["change-requirements", "change-use-case", "change-architecture", "review-architecture", "write-tests", "check-for-persons"];

const promptPlaces = (prompt) => [...new Set([...prompt.matchAll(/\{\{([a-z-]+)\}\}/g)].map((m) => m[1]))].sort();

// The keywords of a schema of a draft, at every depth.
function keywords(schema, found = new Set()) {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    for (const [key, value] of Object.entries(schema)) {
      found.add(key);
      if (key === "properties") for (const property of Object.values(value)) keywords(property, found);
      if (key === "items") keywords(value, found);
    }
  }
  return found;
}

// ---------------------------------------------------------------- loading the module anew

// One load of the module, anew, with `disk` as what process.getBuiltinModule("node:fs") gives it and `fetch` as the
// browser's fetch — as tests/participant-list.test.mjs loads MOD-participant-list. -> { module, reads }
let loads = 0;
async function load({ disk, fetch }) {
  const saved = { getBuiltinModule: process.getBuiltinModule, fetch: globalThis.fetch };
  const reads = [];
  process.getBuiltinModule = (name) => (name === "node:fs" ? disk?.(reads) : saved.getBuiltinModule.call(process, name));
  globalThis.fetch = fetch ? (url) => { reads.push(`fetch ${url}`); return fetch(url); } : undefined;
  try {
    loads += 1;
    return { module: await import(new URL(`?load=${loads}`, MODULE)), reads };
  } finally {
    process.getBuiltinModule = saved.getBuiltinModule;
    globalThis.fetch = saved.fetch;
  }
}

// A disk that gives the real text of every file, except `changed` for the file whose address ends with `ending`.
const diskWith = (ending, changed) => (reads) => ({
  readFileSync: (url, encoding) => {
    reads.push(`disk ${url}`);
    return String(url).endsWith(ending) ? changed : readFileSync(url, encoding);
  },
});

// ---------------------------------------------------------------- kindNames

// TST-472282 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS; THE CATALOGUE IS DATA
// given: the catalogue as shipped; the table of kinds stated in this file; the folders under src/job-catalogue/kinds/
// input: kindNames()
// expect: the names of the table's rows, in the table's order, and exactly one folder for each name
test("kindNames — every kind of the stated table, in its order, each with a folder of its own", async () => {
  assert.equal(TABLE.length, 27, "known positive: the stated table holds the 27 kinds");
  const names = await kindNames();
  assert.deepEqual(names, TABLE.map((row) => row.name));
  const folders = readdirSync(KINDS, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual([...folders].sort(), [...names].sort());
});

// ---------------------------------------------------------------- kindOf: the shipped definitions

// TST-472283 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS; THE CATALOGUE IS DATA; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: each kind of the catalogue; the row of the stated table with its name
// input: kindOf(name)
// expect: a definition read without an error, whose name is its folder's; the use cases it serves, what its participant needs — and `participant: none` exactly where the table names nothing —, its preconditions, recipes — one that may be left out only where the row writes its name with a ? —, checks, reviewer kind and number of reviewers, steps, review and writer as the row gives them; `resources: product` and the gate points before-merge and question exactly for the kinds this file names, before-merge alone for write-tests; A CONFLICT IS DECIDED BY A PERSON exactly for the requirement and architecture kinds; the limit 5; a purpose in a paragraph
test("kindOf — every shipped definition is read without an error and says what the stated table says", async () => {
  for (const row of TABLE) {
    const kind = await kindOf(row.name);
    const expected = {
      name: row.name, serves: row.serves, participant: row.needs.length ? "one" : "none", needs: row.needs,
      resources: PRODUCT_RESOURCES.includes(row.name) ? "product" : "none", preconditions: row.preconditions,
      recipes: row.recipes.map((name) => ({ name: name.replace(/\?$/, ""), optional: name.endsWith("?") })), checks: row.checks, personDecides: PERSON_DECIDES.includes(row.name) ? ["A CONFLICT IS DECIDED BY A PERSON"] : [],
      reviewer: row.reviewer?.kind ?? null, reviewers: row.reviewer?.count ?? 0, steps: row.steps,
      gatePoints: MERGE_AND_QUESTION.includes(row.name) ? ["before-merge", "question"]
        : MERGE_ONLY.includes(row.name) ? ["before-merge"] : [],
      review: row.review, writer: row.writer, limit: 5,
    };
    const got = Object.fromEntries(Object.keys(expected).map((key) => [key, kind[key]]));
    assert.deepEqual(got, expected, row.name);
    assert.match(kind.purpose, /\S/, `${row.name} states its purpose`);
  }
});

// TST-472284 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: each kind of the catalogue
// input: kindOf(name)
// expect: a kind with a participant has a prompt with a named place `{{recipe}}` for exactly each of its recipes, and a schema of its draft written with type, properties, required, items and enum only, describing an object; the prompts of change-requirements, change-use-case and change-architecture hold the place `{{draft}}`, and the prompt of no other kind holds it except those of review-architecture, write-tests and check-for-persons; a kind without a participant has neither a prompt nor a schema of a draft
test("kindOf — each prompt has a named place for exactly its kind's recipes, and each draft's schema uses the five keywords", async () => {
  for (const name of await kindNames()) {
    const kind = await kindOf(name);
    if (kind.participant === "none") {
      assert.deepEqual([kind.prompt, kind.answer, kind.recipes], ["", null, []], name);
      continue;
    }
    assert.deepEqual(promptPlaces(kind.prompt), kind.recipes.map((recipe) => recipe.name).sort(), name);
    assert.equal(promptPlaces(kind.prompt).includes("draft"), DRAFT_PLACE.includes(name), `${name}: the place {{draft}}`);
    assert.equal(kind.answer.type, "object", name);
    assert.deepEqual([...keywords(kind.answer)].filter((key) => !["type", "properties", "required", "items", "enum"]
      .includes(key)), [], name);
  }
});

// TST-472285 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: each kind of the catalogue that names a reviewer
// input: kindOf of it and of its reviewer
// expect: the reviewer is a kind of the catalogue with a participant, and the number of reviewers is at least one; a kind that names no reviewer has none
test("kindOf — a reviewer is a kind of the catalogue, with at least one reviewing participant", async () => {
  const names = await kindNames();
  let reviewed = 0;
  for (const name of names) {
    const kind = await kindOf(name);
    if (kind.reviewer === null) { assert.equal(kind.reviewers, 0, name); continue; }
    reviewed += 1;
    assert.ok(names.includes(kind.reviewer), `${name} names the reviewer ${kind.reviewer}`);
    assert.equal((await kindOf(kind.reviewer)).participant, "one", name);
    assert.ok(kind.reviewers >= 1, name);
  }
  assert.ok(reviewed >= 2, "known positive: the catalogue has reviewed kinds");
});

// TST-472286 · level: component · module: MOD-job-catalogue
// guards: THE CATALOGUE IS DATA
// given: the catalogue as shipped
// input: kindOf("derive-architecture") twice
// expect: the same definition both times — read once per program and kept
test("kindOf — a kind is read once per program and kept", async () => {
  assert.equal(await kindOf("derive-architecture"), await kindOf("derive-architecture"));
});

// TST-472287 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: known positive first — kindOf of the shipped kind derive-requirements; then a name the index does not hold
// input: kindOf("no-such-kind")
// expect: the known positive is read; the unknown name is refused with UnknownKind naming it
test("kindOf — a name the index does not hold is refused as UnknownKind, naming it", async () => {
  assert.equal((await kindOf("derive-requirements")).name, "derive-requirements");
  await assert.rejects(kindOf("no-such-kind"), (error) => error.name === "UnknownKind" && error.kind === "no-such-kind"
    && error.message.includes("no-such-kind"));
});

// TST-472288 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the module loaded anew three times with a disk that gives the real files — (a) unchanged, the known positive; (b) derive-requirements' definition without its line `writer: queue-entries`; (c) its definition naming itself `derive-something`
// input: kindOf("derive-requirements") of each load
// expect: (a) read; (b), (c) refused with InvalidKind naming the kind, carrying error findings on its definition's path under ONE DEFINITION, THREE DRIVERS — for (b) one naming the key writer, for (c) one naming both names
test("kindOf — a definition at odds with the definition schema, or not named as its folder, is refused as InvalidKind with its findings", async () => {
  const path = "kinds/derive-requirements/kind.md";
  const real = readFileSync(new URL(path, new URL("../src/job-catalogue/", import.meta.url)), "utf8");
  assert.ok(real.includes("\nwriter: queue-entries\n") && real.includes("\nname: derive-requirements\n"));

  const unchanged = await load({ disk: diskWith(path, real) });
  assert.equal((await unchanged.module.kindOf("derive-requirements")).writer, "queue-entries");

  for (const [changed, word] of [[real.replace("\nwriter: queue-entries\n", "\n"), "writer"],
    [real.replace("\nname: derive-requirements\n", "\nname: derive-something\n"), "derive-something"]]) {
    const { module } = await load({ disk: diskWith(path, changed) });
    await assert.rejects(module.kindOf("derive-requirements"), (error) => {
      assert.equal(error.name, "InvalidKind");
      assert.equal(error.kind, "derive-requirements");
      assert.ok(error.findings.length >= 1);
      for (const f of error.findings) {
        assert.deepEqual([f.artifact, f.kind, f.rule], [`src/job-catalogue/${path}`, "error", ONE_DEFINITION]);
      }
      assert.ok(error.findings.some((f) => f.what.includes(word)), word);
      return true;
    });
  }
});

// TST-472289 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the module loaded anew with a disk that gives derive-requirements' definition with its recipe source-excerpt written `source-excerpt?` — a part that may be left out with its reason, as the module file's Data says
// input: kindOf("derive-requirements")
// expect: its recipes read as instruction and source-excerpt, each a part that may be left out, then the others as they stand
test("kindOf — a recipe whose name ends with ? is read as one whose part may be left out", async () => {
  const path = "kinds/derive-requirements/kind.md";
  const real = readFileSync(new URL(path, new URL("../src/job-catalogue/", import.meta.url)), "utf8");
  assert.ok(real.includes("\n  - source-excerpt\n"), "known positive: the definition lists source-excerpt");
  const { module } = await load({ disk: diskWith(path, real.replace("\n  - source-excerpt\n", "\n  - source-excerpt?\n")) });
  assert.deepEqual((await module.kindOf("derive-requirements")).recipes, [{ name: "instruction", optional: true }, { name: "source-excerpt", optional: true },
    { name: "spec-with-queues", optional: false }, { name: "chapters-for-requirements", optional: false }]);
});

// TST-472290 · level: component · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the module loaded anew as in a browser — no disk, and a fetch that serves the module's own files
// input: kindNames(), and kindOf("propose-items")
// expect: the same names as in Node, and the definition read; every read a fetch of an address under the module's own folder, the index and the kind's three files among them
test("kindNames and kindOf — in a browser, the catalogue reads its own files from its own address", async () => {
  const serve = async (url) => ({ ok: true, status: 200, text: async () => readFileSync(new URL(url), "utf8") });
  const { module, reads } = await load({ disk: undefined, fetch: serve });
  assert.deepEqual(await module.kindNames(), await kindNames());
  assert.equal((await module.kindOf("propose-items")).name, "propose-items");
  const folder = new URL("../src/job-catalogue/", import.meta.url).href;
  assert.ok(reads.length > 0 && reads.every((read) => read.startsWith(`fetch ${folder}`)), reads.join("\n"));
  for (const file of ["kinds.md", "kinds/propose-items/kind.md", "kinds/propose-items/prompt.md",
    "kinds/propose-items/answer.schema.json"]) {
    assert.ok(reads.includes(`fetch ${folder}${file}`), file);
  }
});
