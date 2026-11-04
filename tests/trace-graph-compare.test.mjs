// The comparison of two versions (ITM-600) — MOD-trace-graph's compareGraphs, as docs/architecture/MOD-trace-graph.md states it: "the requirements
// added, changed and removed between two versions, and the coverage gained and lost (UC-020)", as a Comparison `{ requirements: { added, changed,
// removed }, coverage: { gained: { name, by }[], lost: { name, by }[] } }`.
// Run: node --test tests/trace-graph-compare.test.mjs
//
// Module: MOD-trace-graph
// Guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// Level: unit
//
// The fixture is a small product of its own at two versions, each given to traceGraph through a TextSource built here — two graphs, not hand-made objects.
// Readings the cases take, each from the text quoted:
// - "changed": the graph keeps of a requirement no text and no blob, only its place and the items of its source ("SPEC.md's requirements and the test
//   files' declarations carry neither a title nor a blob of their own"; "a requirement the items of its source as written"); so a requirement in both
//   versions is changed when what its node keeps differs, but for its line, which moves whenever a requirement above it is added or removed;
// - "coverage": what coverageGaps counts as covering a requirement — a use case's or a module's `realises`, a test's `guards` —, one `{ name, by }` for
//   each requirement and each artifact that covers it; a decision's `forced_by` and an item's `realises` cover nothing;
// - every list is sorted, the requirements by name, the coverage by name and then by the artifact, so that it does not depend on the order of the files.

import test from "node:test";
import assert from "node:assert/strict";
import * as traceGraphModule from "../src/trace-graph/index.mjs";

// A name the module does not provide yet is undefined here, so that each case fails by itself and not the whole file at once.
const { traceGraph, compareGraphs } = traceGraphModule;

const source = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
const doc = (id, title, keys = {}) => ["---", `id: ${id}`, `title: ${title}`,
  ...Object.entries(keys).map(([key, values]) => (Array.isArray(values) ? `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}` : `${key}: ${values}`)),
  "---", `# ${id} ${title}`, "", ""].join("\n");
const requirement = (name, sourceText, rule) => [`**${name}** *(${sourceText})*`, rule, "*Check:* at review.", ""];
const spec = (...requirements) => ["# Compare fixture — Specification", "", "## Section", "", ...requirements.flat()].join("\n");
const testFile = (id, guards) => [`// ${id} · level: unit · module: MOD-kept`, `// guards: ${guards}`, "// given: a fixture", "// input: none", "// expect: nothing", ""].join("\n");

// The earlier version: KEPT RULE, MOVED RULE, SOURCED RULE and GONE RULE. The later one adds NEW RULE above MOVED RULE, so that MOVED RULE's line moves while it
// reads as before; it gives SOURCED RULE a second item of its source; and it removes GONE RULE.
const EARLIER = {
  "SPEC.md": spec(requirement("KEPT RULE", "Vibe Coding", "Kept rule."), requirement("MOVED RULE", "Vibe Coding", "Moved rule."),
    requirement("SOURCED RULE", "Vibe Coding", "Sourced rule."), requirement("GONE RULE", "Vibe Coding", "Gone rule.")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["KEPT RULE", "GONE RULE"] }),
  "docs/architecture/ARC-001-first.md": doc("ARC-001", "First decision", { forced_by: ["KEPT RULE"] }),
  "docs/architecture/MOD-kept.md": doc("MOD-kept", "Kept module", { folder: "src/kept/", realises: ["MOVED RULE"] }),
  "tests/kept.test.mjs": testFile("TST-901", "KEPT RULE"),
};
const LATER = {
  "SPEC.md": spec(requirement("KEPT RULE", "Vibe Coding", "Kept rule."), requirement("NEW RULE", "Vibe Coding", "New rule."),
    requirement("MOVED RULE", "Vibe Coding", "Moved rule."), requirement("SOURCED RULE", "Vibe Coding; PO A. Maier", "Sourced rule.")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["KEPT RULE", "NEW RULE"] }),
  "docs/use-cases/UC-002-second.md": doc("UC-002", "Second use case", { realises: ["SOURCED RULE"] }),
  "docs/architecture/ARC-001-first.md": doc("ARC-001", "First decision", { forced_by: ["KEPT RULE", "NEW RULE"] }),
  "docs/architecture/MOD-kept.md": doc("MOD-kept", "Kept module", { folder: "src/kept/", realises: ["MOVED RULE", "NEW RULE"] }),
  "docs/backlog/ITM-001-first.md": doc("ITM-001", "First item", { level: "module", realises: ["MOVED RULE"], modules: ["MOD-kept"], tests: ["unit"] }),
  "tests/kept.test.mjs": testFile("TST-901", "SOURCED RULE"),
};

// TST-600401 · level: unit · module: MOD-trace-graph
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the earlier version with KEPT RULE, MOVED RULE, SOURCED RULE and GONE RULE; the later one with NEW RULE added above MOVED RULE (whose line moves, its text as before), SOURCED RULE's source given the second item "PO A. Maier", and GONE RULE removed
// input: compareGraphs(the earlier graph, the later graph), then compareGraphs(the later graph, the earlier graph), then compareGraphs(the earlier graph, the earlier graph)
// expect: requirements added ["NEW RULE"], changed ["SOURCED RULE"], removed ["GONE RULE"] — MOVED RULE, on another line, and KEPT RULE are not changed; the other way round added ["GONE RULE"], changed ["SOURCED RULE"], removed ["NEW RULE"]; a graph against itself gives three empty lists; known positive: the later graph holds MOVED RULE on another line than the earlier one
test("TST-600401: compareGraphs gives the requirements added, changed and removed between two versions", async () => {
  const [earlier, later] = [await traceGraph(source(EARLIER)), await traceGraph(source(LATER))];
  assert.notEqual(later.nodes.get("MOVED RULE").line, earlier.nodes.get("MOVED RULE").line, "known positive: MOVED RULE stands on another line");
  assert.deepEqual(compareGraphs(earlier, later).requirements, { added: ["NEW RULE"], changed: ["SOURCED RULE"], removed: ["GONE RULE"] });
  assert.deepEqual(compareGraphs(later, earlier).requirements, { added: ["GONE RULE"], changed: ["SOURCED RULE"], removed: ["NEW RULE"] });
  assert.deepEqual(compareGraphs(earlier, earlier).requirements, { added: [], changed: [], removed: [] });
});

// TST-600402 · level: unit · module: MOD-trace-graph
// guards: UC-020; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the same two versions: at the earlier one UC-001 realises KEPT RULE and GONE RULE, MOD-kept realises MOVED RULE, TST-901 guards KEPT RULE, ARC-001 is forced by KEPT RULE; at the later one UC-001 realises KEPT RULE and NEW RULE, UC-002 realises SOURCED RULE, MOD-kept realises MOVED RULE and NEW RULE, TST-901 guards SOURCED RULE, ARC-001 is forced by KEPT RULE and NEW RULE, ITM-001 realises MOVED RULE
// input: compareGraphs(the earlier graph, the later graph)
// expect: coverage gained [{ NEW RULE by MOD-kept }, { NEW RULE by UC-001 }, { SOURCED RULE by TST-901 }, { SOURCED RULE by UC-002 }] and lost [{ GONE RULE by UC-001 }, { KEPT RULE by TST-901 }], in that order; neither ARC-001's forced_by nor ITM-001's realises is in either list; known positive: the later graph holds ARC-001's forced_by edge to NEW RULE and ITM-001's realises edge to MOVED RULE
test("TST-600402: compareGraphs gives the coverage gained and lost between two versions", async () => {
  const [earlier, later] = [await traceGraph(source(EARLIER)), await traceGraph(source(LATER))];
  assert.ok(later.edges.some((edge) => edge.from === "ARC-001" && edge.via === "forced_by" && edge.to === "NEW RULE"), "known positive: ARC-001 is forced by NEW RULE");
  assert.ok(later.edges.some((edge) => edge.from === "ITM-001" && edge.via === "realises" && edge.to === "MOVED RULE"), "known positive: ITM-001 realises MOVED RULE");
  assert.deepEqual(compareGraphs(earlier, later).coverage, {
    gained: [{ name: "NEW RULE", by: "MOD-kept" }, { name: "NEW RULE", by: "UC-001" }, { name: "SOURCED RULE", by: "TST-901" }, { name: "SOURCED RULE", by: "UC-002" }],
    lost: [{ name: "GONE RULE", by: "UC-001" }, { name: "KEPT RULE", by: "TST-901" }],
  });
});
