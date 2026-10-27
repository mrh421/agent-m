// The recipe `backlog-inputs` of MOD-work-plans' `workStrategies` (ITM-615; UC-032 step 2), as the accepted text of docs/architecture/MOD-work-plans.md states it (blob 42e171450da1, approved in
// docs/approvals/MOD-work-plans-42e171450da1.md): ":259 recipe `backlog-inputs` — the accepted requirements and use cases, those no item realises yet, the architecture, and the existing items,
// which its part carries as artifacts keyed by their title", with UC-032 step 2 (blob 549b15b59fd1, approved in docs/approvals/UC-032-549b15b59fd1.md): "The run panel names the participant and what
// is sent: the requirements, the use cases, the architecture and the existing items", and MOD-job-runner's `JobContext` and `Part`.
// Run: node --test tests/work-plans-backlog-inputs.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
// Level: unit
//
// The product is a fixture of this file: a SPEC.md of two requirements (ALPHA RULE, which an item realises, and BETA RULE, which none does), a third requirement that stands only in an open
// entry of a SPEC change queue, four use cases (UC-001 and UC-002 accepted, UC-003 open, UC-004 changed since its acceptance), a decision and two module files, two backlog items, a plan step, code
// and a test. The readings where the file leaves one open, which the pull request names:
//   - The parts stand in the order the text lists what they give: the accepted requirements, the accepted use cases, what no item realises yet, the architecture, the existing items.
//   - A requirement is accepted when the SPEC holds it (MOD-approvals, accept.mjs:11: "a requirement is accepted when the SPEC holds it — one that stands only in an open queue is not"), a use
//     case when `statuses` gives it accepted. A requirement is one part, named by it and holding it as the SPEC states it — name, source, rule, check —, in the order the SPEC lists them; a use case
//     is one part, named by its path and holding the file whole, in the order of the paths.
//   - What no item realises yet is the accepted requirements and use cases that no existing item names under `realises`, one part, a name or identifier to a line, the requirements first.
//   - The architecture is every decision and module file of docs/architecture/, one part each, named by its path and holding the file whole, in the order of the paths.
//   - The existing items are the items of docs/backlog/ (not the steps of docs/plan/), in one part, the files whole in the order of their paths; the part carries each item as an artifact, its
//     identifier and the key of the item format (`artifactSchemas().item.key`, the title). No other part carries an artifact.
//   - A part carries the sources of every `places.contents` entry that names a path its text comes from or a folder above it, as `architecture-and-model` does. A part with nothing to give is
//     not given: no existing item, no part of the items; nothing unrealised, no such part; a product without a SPEC.md gives no requirement.
// Each test states its input and its expected result before it runs (given / input / expect); every call is made with a `fetch` that fails the test if it is called. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import { workStrategies } from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");

// ---------------------------------------------------------------- the fixture product

const SPEC = lines("# Fixture — Specification", "", "## 1. Rules", "",
  "**ALPHA RULE** *(Owner)*", "Alpha rule text.", "*Check:* `tests/alpha.test.mjs`", "",
  "**BETA RULE** *(Owner; SRC-fixture 2026)*", "Beta rule text.", "*Check:* no automatic check; at review.");
const GAMMA_ENTRY = lines("## 1. Rules", "", "**GAMMA RULE** *(Owner)*", "Gamma rule text, proposed only.", "*Check:* no automatic check; at review.");

const useCase = (id, title, realises) => lines("---", `id: ${id}`, `title: ${title}`, "area: files", "actors:", "  - Reader", "realises:", ...realises.map((name) => `  - ${name}`), "---",
  `# ${id} ${title}`, "", `**Goal.** ${title}.`, "", "## Postcondition", "", `POSTCONDITION-OF-${id}`);
const UC1 = useCase("UC-001", "Read a file", ["ALPHA RULE"]);
const UC2 = useCase("UC-002", "Write a file", ["BETA RULE"]);
const UC3 = useCase("UC-003", "Delete a file", ["ALPHA RULE"]);
const UC4 = useCase("UC-004", "Copy a file", ["ALPHA RULE"]);
const UC4_EARLIER = useCase("UC-004", "Duplicate a file", ["ALPHA RULE"]);
const record = (id, kind, file, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, lines(`kind: ${kind}`, `file: ${file}`, `blob: ${blobOf(body)}`)];

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-001", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", `RESPONSIBILITY-OF-${id}`, "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f",
  "", "## Uses", "", "u");
const item = (id, title, realises, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:", "  - MOD-store",
  ...extra, "tests:", "  - unit", "origin:", "  - UC-032", "---", `# ${id} ${title}`, "", "## Outcome", "", `OUTCOME-OF-${id}`, "", "## Acceptance", "", "a");

const ITEM1 = item("ITM-001", "Read the store", ["ALPHA RULE", "UC-001"]);
const ITEM2 = item("ITM-002", "Read the store twice", ["ALPHA RULE"], ["builds_on:", "  - ITM-001"]);
const STEP = item("ITM-009", "A plan step", ["BETA RULE"]);

const FILES = {
  "SPEC.md": SPEC,
  "docs/spec-freigaben/2026-10-01_gamma/index.md": lines("# Queue", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
    "| 01 | `SPEC.md` | ## 1. Rules | — | — |"),
  "docs/spec-freigaben/2026-10-01_gamma/01-gamma.md": GAMMA_ENTRY,
  "docs/use-cases/UC-001-read.md": UC1,
  "docs/use-cases/UC-002-write.md": UC2,
  "docs/use-cases/UC-003-delete.md": UC3,
  "docs/use-cases/UC-004-copy.md": UC4,
  ...Object.fromEntries([record("UC-001", "use-case", "docs/use-cases/UC-001-read.md", UC1), record("UC-002", "use-case", "docs/use-cases/UC-002-write.md", UC2),
    record("UC-004", "use-case", "docs/use-cases/UC-004-copy.md", UC4_EARLIER)]),
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001", "designs:", "  - MOD-store", "  - MOD-pages"]),
  "docs/architecture/MOD-store.md": module_("MOD-store"),
  "docs/architecture/MOD-pages.md": module_("MOD-pages"),
  "docs/backlog/ITM-001-read-the-store.md": ITEM1,
  "docs/backlog/ITM-002-read-the-store-twice.md": ITEM2,
  "docs/plan/ITM-009-a-plan-step.md": STEP,
  "README.md": "# Fixture\n",
  "src/store/index.mjs": "export const read = 1;\n",
  "tests/alpha.test.mjs": lines("// TST-001", "// level: unit", "// module: MOD-store", "// guards: ALPHA RULE", "", "// the case follows"),
};

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null),
  blob: (path) => (Object.prototype.hasOwnProperty.call(files, path) ? blobOf(files[path]) : null) });
const contextOf = (files, contents = []) => ({
  kind: null, params: {}, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host: null }, instance: { snapshot: snapshotOf({}), host: null, checkout: null },
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents }, gates: [], person: "alice", now: new Date("2026-10-23T08:00:00Z"),
  agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null,
});

// Runs `body` with a fetch that records its calls; the test asserts there were none.
async function offline(body) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("the recipe must make no request"); };
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
    assert.deepEqual(calls, [], "no request was made");
  }
}
const recipe = (files, contents) => {
  assert.equal(typeof workStrategies.recipes["backlog-inputs"], "function", "workStrategies offers the recipe backlog-inputs");
  return offline(() => workStrategies.recipes["backlog-inputs"](contextOf(files, contents), {}));
};
const namesOf = (parts) => parts.map((part) => part.name);
const without = (files, ...paths) => Object.fromEntries(Object.entries(files).filter(([path]) => !paths.some((each) => path === each || path.startsWith(each))));

const UNREALISED = "not yet realised by an item";
const EXISTING = "existing items";
const ALL = ["ALPHA RULE", "BETA RULE", "docs/use-cases/UC-001-read.md", "docs/use-cases/UC-002-write.md", UNREALISED,
  "docs/architecture/ARC-001-whole.md", "docs/architecture/MOD-pages.md", "docs/architecture/MOD-store.md", EXISTING];

// TST-615001 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the fixture product, whose SPEC holds ALPHA RULE and BETA RULE, whose accepted use cases are UC-001 and UC-002, whose items ITM-001 and ITM-002 realise ALPHA RULE and UC-001, so that BETA RULE and UC-002 are realised by none, and whose architecture is ARC-001, MOD-pages and MOD-store
// input: the recipe backlog-inputs
// expect: nine parts, by name, in this order: the requirements ALPHA RULE, BETA RULE; the use cases' files UC-001, UC-002; "not yet realised by an item"; the architecture's files ARC-001, MOD-pages, MOD-store; "existing items"
test("the recipe gives the accepted requirements and use cases, those no item realises, the architecture and the existing items, in that order — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  assert.deepEqual(namesOf(parts), ALL);
});

// TST-615002 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the fixture product
// input: the recipe backlog-inputs
// expect: a requirement's part holds ALPHA RULE as the SPEC states it (its name and source, its rule, its check), BETA RULE with the source "Owner; SRC-fixture 2026" and a check that names no test; a use case's part and an architecture file's part hold the file whole (UC-001's holds its Postcondition line, which an item drafted from a use case names); every part is required, has a `sources` array and carries no artifact
test("a requirement is given as the SPEC states it, a use case and an architecture file whole, none as an artifact — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  const part = (name) => parts.find((each) => each.name === name);
  assert.equal(parts.length, 9, "known positive: the parts are there to be checked");
  assert.equal(part("ALPHA RULE").text, lines("**ALPHA RULE** *(Owner)*", "Alpha rule text.", "*Check:* `tests/alpha.test.mjs`").trimEnd());
  assert.equal(part("BETA RULE").text, lines("**BETA RULE** *(Owner; SRC-fixture 2026)*", "Beta rule text.", "*Check:* no automatic check; at review.").trimEnd());
  assert.equal(part("docs/use-cases/UC-001-read.md").text, FILES["docs/use-cases/UC-001-read.md"]);
  assert.match(part("docs/use-cases/UC-001-read.md").text, /POSTCONDITION-OF-UC-001/);
  for (const path of ["docs/architecture/ARC-001-whole.md", "docs/architecture/MOD-pages.md", "docs/architecture/MOD-store.md"]) assert.equal(part(path).text, FILES[path]);
  assert.ok(parts.every((each) => each.required === true && Array.isArray(each.sources) && typeof each.text === "string"));
  for (const each of parts.filter((one) => one.name !== EXISTING)) assert.deepEqual(each.artifacts ?? [], [], `${each.name} carries no artifact`);
});

// TST-615003 · level: unit · module: MOD-work-plans
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; UC-032
// given: the fixture product, whose UC-003 has no approval record (open), whose UC-004 has a record of an earlier text (changed), and whose GAMMA RULE stands only in the entry 01 of an open SPEC change queue, not in the SPEC
// input: the recipe backlog-inputs
// expect: no part named UC-003's or UC-004's file or GAMMA RULE, and no mention of them in the part "not yet realised by an item", though no item realises them; UC-001 and UC-002, accepted, are given (the known positive)
test("only what is accepted is given: an open or changed use case and a requirement of an open queue are not — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  const names = namesOf(parts);
  assert.ok(names.includes("docs/use-cases/UC-001-read.md") && names.includes("docs/use-cases/UC-002-write.md"), "known positive: the accepted use cases are given");
  for (const absent of ["docs/use-cases/UC-003-delete.md", "docs/use-cases/UC-004-copy.md", "GAMMA RULE"]) assert.ok(!names.includes(absent), `${absent} is not given`);
  const everything = parts.map((part) => part.text).join("\n");
  assert.ok(!/GAMMA RULE|UC-003|UC-004/.test(parts.find((part) => part.name === UNREALISED).text), "the unrealised part names none of them");
  assert.ok(!/Gamma rule text/.test(everything), "the proposal's text is nowhere");
});

// TST-615004 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the fixture product, and the same product with the backlog item ITM-003 added, which realises BETA RULE and UC-002
// input: the recipe backlog-inputs
// expect: the part "not yet realised by an item" holds, one to a line, the requirement BETA RULE and then the use case UC-002, and not ALPHA RULE or UC-001, which items realise; with ITM-003 it does not exist, since every accepted requirement and use case is realised
test("what no item realises yet is the accepted requirements and use cases that no existing item names under realises — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  const unrealised = parts.find((part) => part.name === UNREALISED);
  assert.deepEqual(unrealised.text.split("\n").map((line) => line.replace(/^- /, "")), ["BETA RULE", "UC-002"]);
  const realised = { ...FILES, "docs/backlog/ITM-003-write-the-store.md": item("ITM-003", "Write the store", ["BETA RULE", "UC-002"]) };
  assert.deepEqual(namesOf(await recipe(realised)).filter((name) => name === UNREALISED), []);
  assert.equal(namesOf(await recipe(realised)).length, ALL.length - 1);
});

// TST-615005 · level: unit · module: MOD-work-plans
// guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-032
// given: the fixture product, whose docs/backlog/ holds ITM-001 and ITM-002 and whose docs/plan/ holds the step ITM-009
// input: the recipe backlog-inputs
// expect: one part "existing items", whose text is the file of ITM-001 and then the file of ITM-002, whole, and nothing of the plan step; it carries two artifacts, { id: "ITM-001", keys: ["Read the store"] } and { id: "ITM-002", keys: ["Read the store twice"] }, in that order: the identifier and the title
test("the existing items are one part carrying each item as an artifact keyed by its title — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  assert.equal(parts.filter((part) => part.name === EXISTING).length, 1);
  const items = parts.find((part) => part.name === EXISTING);
  assert.deepEqual(items.artifacts, [{ id: "ITM-001", keys: ["Read the store"] }, { id: "ITM-002", keys: ["Read the store twice"] }]);
  assert.ok(items.text.includes(ITEM1) && items.text.includes(ITEM2), "both files are whole in the text");
  assert.ok(items.text.indexOf("OUTCOME-OF-ITM-001") < items.text.indexOf("OUTCOME-OF-ITM-002"), "in the order of the paths");
  assert.ok(!items.text.includes("ITM-009"), "a step of the plan is no item of the backlog");
});

// TST-615006 · level: unit · module: MOD-work-plans
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-032
// given: the fixture product, and places.contents naming SRC-spec for the file SPEC.md, SRC-arch for the folder docs/architecture and for docs/use-cases/UC-002-write.md, and SRC-item for the one file docs/backlog/ITM-002-read-the-store-twice.md
// input: the recipe backlog-inputs
// expect: the two requirements' parts carry ["SRC-spec"]; the three architecture parts ["SRC-arch"]; UC-002's part ["SRC-arch"] and UC-001's none; the part "existing items" ["SRC-item"], for the file it holds; the part "not yet realised by an item", which holds names and no file's content, none; with places.contents empty no part carries any source
test("a part carries the sources of the paths its text comes from — MOD-work-plans", async () => {
  const contents = [{ source: "SRC-spec", paths: ["SPEC.md"] }, { source: "SRC-arch", paths: ["docs/architecture", "docs/use-cases/UC-002-write.md"] },
    { source: "SRC-item", paths: ["docs/backlog/ITM-002-read-the-store-twice.md"] }];
  const parts = await recipe(FILES, contents);
  assert.deepEqual(Object.fromEntries(parts.map((part) => [part.name, part.sources])), {
    "ALPHA RULE": ["SRC-spec"], "BETA RULE": ["SRC-spec"], "docs/use-cases/UC-001-read.md": [], "docs/use-cases/UC-002-write.md": ["SRC-arch"], [UNREALISED]: [],
    "docs/architecture/ARC-001-whole.md": ["SRC-arch"], "docs/architecture/MOD-pages.md": ["SRC-arch"], "docs/architecture/MOD-store.md": ["SRC-arch"], [EXISTING]: ["SRC-item"],
  });
  const none = await recipe(FILES, []);
  assert.deepEqual(none.map((part) => part.sources), none.map(() => []));
});

// TST-615007 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the fixture product without its backlog (no file under docs/backlog/), and the fixture product without its SPEC.md
// input: the recipe backlog-inputs
// expect: without a backlog the parts are those of TST-615001 but the part "existing items", and the part "not yet realised by an item" holds ALPHA RULE, BETA RULE, UC-001 and UC-002, since no item realises any; without a SPEC.md no requirement is given and nothing fails: the use cases, the part "not yet realised by an item" holding UC-002 alone (ITM-001 still realises UC-001), the architecture and the items
test("a part with nothing to give is not given, and a product without a SPEC gives no requirement — MOD-work-plans", async () => {
  assert.equal((await recipe(FILES)).length, 9, "known positive: the items' part is there when the product has items");
  const noBacklog = await recipe(without(FILES, "docs/backlog/"));
  assert.deepEqual(namesOf(noBacklog), ALL.filter((name) => name !== EXISTING));
  assert.deepEqual(noBacklog.find((part) => part.name === UNREALISED).text.split("\n").map((line) => line.replace(/^- /, "")), ["ALPHA RULE", "BETA RULE", "UC-001", "UC-002"]);
  const noSpec = await recipe(without(FILES, "SPEC.md"));
  assert.deepEqual(namesOf(noSpec), ALL.filter((name) => !["ALPHA RULE", "BETA RULE"].includes(name)));
  assert.deepEqual(noSpec.find((part) => part.name === UNREALISED).text.split("\n").map((line) => line.replace(/^- /, "")), ["UC-002"]);
});

// TST-615008 · level: unit · module: MOD-work-plans
// guards: UC-032; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
// given: the module's workStrategies registered with the job runner under the owner MOD-work-plans, the fixture product, and a stand-in for the precondition `rests-on-accepted`; the writer `backlog-items` is MOD-work-plans' own (ITM-617)
// input: prepareJob("propose-items", context, no drafter)
// expect: it does not throw UnknownStrategy — the recipe `backlog-inputs`, the check `backlog-checks` and the writer `backlog-items` are all MOD-work-plans' —, and its parts of the recipe `backlog-inputs` are the nine parts of TST-615001, in that order, each naming that recipe, the part "existing items" still carrying its two artifacts
test("the kind propose-items prepares with the strategies MOD-work-plans registers, the writer among them — MOD-work-plans", async () => {
  registerStrategies("MOD-work-plans", workStrategies);
  registerStrategies("tests/work-plans-backlog-inputs.test.mjs", { preconditions: { "rests-on-accepted": async () => null } });
  const prepared = await offline(() => prepareJob("propose-items", contextOf(FILES), { drafter: null, reviewers: [] }));
  const given = prepared.parts.filter((part) => part.recipe === "backlog-inputs");
  assert.deepEqual(namesOf(given), ALL);
  assert.deepEqual(given.find((part) => part.name === EXISTING).artifacts.map((each) => each.id), ["ITM-001", "ITM-002"]);
});
