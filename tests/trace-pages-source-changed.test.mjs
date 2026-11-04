// A requirement whose source moved on is marked *source changed* (ITM-657) — UC-016 step 5: "the listed requirements are marked *source changed* on the dashboard until each is looked at
// again", and MOD-trace-pages' `specification` descriptor: "where MOD-source-register's `affectedRequirements` names it for a source the product moved to a newer version after its section last
// changed, *source changed* until its section changes".
// Run: node --test tests/trace-pages-source-changed.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-016; UC-020; A REQUIREMENT HAS A REGISTERED SOURCE
// Level: component
//
// The route is called through its public Route.render with the Host fake of tests/trace-pages-harness.mjs, which here also holds the history of the product's default branch. Readings the cases
// take (the pull request names them):
//   - "moved to a newer version" is a change of a source's Version in the product's docs/sources.md between two commits of its history, the source being in both; the move is dated by the
//     newest commit that holds the version the file names now. A source that appears with its first version has not moved.
//   - "its section last changed" is the date of the newest commit whose text of the requirement differs from that of the commit before it.
//   - a requirement is marked when its source moved strictly after its section last changed; the mark is a span of class requirement-source-changed in the requirement's row, reading "source changed".
//   - the mark is found from the history the Host gives, bounded: the history of docs/sources.md is read once, as one page of at most 30 commits with `changes: false` and one batch of file texts; the
//     history of SPEC.md the same, and only when a requirement is named by a moved source; a product without docs/sources.md reads no history at all. (The measurement against the token budget
//     of sprint 66's agreement is these counts: a page of commits and a batch of files per history, never a request per requirement.)
// Each case states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const spec = ({ alpha = "Alpha rule.", beta = "Beta rule.", gamma = "Gamma rule." } = {}) => ["# Source fixture — Specification", "", "## Only section", "",
  "**ALPHA RULE** *(Law A)*", alpha, "*Check:* at review.", "", "**BETA RULE** *(Law B)*", beta, "*Check:* at review.", "", "**GAMMA RULE** *(Law A)*", gamma, "*Check:* at review.", ""].join("\n");
const entry = (id, title) => ["---", `id: ${id}`, `title: ${title}`, "kind: document", "authority: normative", "licence: may be republished — CC BY 4.0", "---", `# ${id} ${title}`, "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| ${TICK}1${TICK} | 2026-01-01 | first | a repository | none |`, `| ${TICK}2${TICK} | 2026-06-01 | second | a repository | none |`, ""].join("\n");
const links = (a, b) => ["# Sources", "", "| Source | Version | Hash | Part |", "|---|---|---|---|",
  ...(a ? [`| SRC-law-a | ${a} | ${"a".repeat(64)} | |`] : []), ...(b ? [`| SRC-law-b | ${b} | ${"b".repeat(64)} | |`] : []), ""].join("\n");
const REGISTER = { "docs/sources/SRC-law-a.md": entry("SRC-law-a", "Law A"), "docs/sources/SRC-law-b.md": entry("SRC-law-b", "Law B") };
const commit = (name, date, files) => ({ commit: name, date, files: { ...REGISTER, ...files } });

// The history, newest first. Law A moves from version 1 to 2 in c3; Law B stays at 1 from the start.
//   c1 2026-10-01: the first text and the links (A 1, B 1);  c2 2026-10-02: BETA RULE's text changes;  c3 2026-10-03: Law A moves to 2;  c4 2026-10-04 (only in `withGammaChange`): GAMMA RULE's text changes.
function history({ withGammaChange = false } = {}) {
  const c1 = commit("c1", "2026-10-01T10:00:00Z", { "SPEC.md": spec(), "docs/sources.md": links("1", "1") });
  const c2 = commit("c2", "2026-10-02T10:00:00Z", { ...c1.files, "SPEC.md": spec({ beta: "Beta rule, reworded." }) });
  const c3 = commit("c3", "2026-10-03T10:00:00Z", { ...c2.files, "docs/sources.md": links("2", "1") });
  const c4 = commit("c4", "2026-10-04T10:00:00Z", { ...c3.files, "SPEC.md": spec({ beta: "Beta rule, reworded.", gamma: "Gamma rule, changed." }) });
  return withGammaChange ? [c4, c3, c2, c1] : [c3, c2, c1];
}
const hostOf = (entries) => treeHost({ trees: { main: entries[0].files }, history: entries });
async function render(host) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/sourced", host } }, { key: "specification", ref: "main" });
  return target;
}
// The names of the requirements whose row carries the mark, after the page has had the turn the history needs.
async function marked(target, expected) {
  const rows = () => find(target, (node) => node.localName === "td" && find(node, (kid) => kid.localName === "button" && kid.className.includes("requirement-name")).length > 0);
  const names = () => rows().filter((cell) => find(cell, (node) => node.className.includes("requirement-source-changed")).length).map((cell) => find(cell, (node) => node.localName === "button")[0].textContent);
  await until(() => names().length >= expected.length, 500);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(rows().length, 3, "known positive: the three requirements are listed");
  return names();
}

// TST-065701 · level: component · module: MOD-trace-pages
// guards: UC-016; UC-020
// given: a product whose Law A moved from version 1 to 2 after ALPHA RULE and GAMMA RULE (both naming Law A) last changed, and whose Law B never moved
// input: the specification view at main
// expect: ALPHA RULE and GAMMA RULE carry the mark "source changed"; BETA RULE, whose source did not move (and whose own text changed after the start), does not
test("a requirement whose source the product moved to a newer version after its section last changed is marked source changed", async () => {
  const target = await render(hostOf(history()));
  assert.deepEqual(await marked(target, ["ALPHA RULE", "GAMMA RULE"]), ["ALPHA RULE", "GAMMA RULE"]);
  assert.match(find(target, (node) => node.className.includes("requirement-source-changed"))[0].textContent, /^source changed$/);
});

// TST-065702 · level: component · module: MOD-trace-pages
// guards: UC-016
// given: the same product, in which GAMMA RULE's text changes in a commit after Law A moved
// input: the specification view at main, once for the history without that commit and once with it
// expect: without it GAMMA RULE is marked (known positive); with it only ALPHA RULE is — the mark is gone once the section changes
test("once its section changes, the mark is gone", async () => {
  assert.deepEqual(await marked(await render(hostOf(history())), ["ALPHA RULE", "GAMMA RULE"]), ["ALPHA RULE", "GAMMA RULE"], "known positive");
  assert.deepEqual(await marked(await render(hostOf(history({ withGammaChange: true }))), ["ALPHA RULE"]), ["ALPHA RULE"]);
});

// TST-065703 · level: component · module: MOD-trace-pages
// guards: UC-016
// given: a product whose links file named Law A at version 2 from the start and added Law B later; and one that links Law A at 2 in its only commit
// input: the specification view at main
// expect: counter-proof — a source added with its first version has not moved: nothing is marked in either
test("a source that was only added, or never changed, marks nothing", async () => {
  const c1 = commit("c1", "2026-10-01T10:00:00Z", { "SPEC.md": spec(), "docs/sources.md": links("2", null) });
  const c2 = commit("c2", "2026-10-02T10:00:00Z", { ...c1.files, "docs/sources.md": links("2", "1") });
  assert.deepEqual(await marked(await render(hostOf([c2, c1])), []), []);
  assert.deepEqual(await marked(await render(hostOf([c1])), []), []);
});

// TST-065704 · level: component · module: MOD-trace-pages
// guards: UC-016
// given: the history of TST-065701 (a source moved, requirements named), the one of TST-065703 (no move), and a product without docs/sources.md
// input: the specification view of each; the Host logs its history and file-batch calls
// expect: with a move: the history of docs/sources.md is read once, as one page of at most 30 commits with changes false, and its files once in a batch; the history of SPEC.md the same; with no move the history of SPEC.md is not read; without docs/sources.md no history is read at all
test("the marks cost one page of commits and one batch of files per history, and nothing where no source moved", async () => {
  const moved = hostOf(history());
  await marked(await render(moved), ["ALPHA RULE", "GAMMA RULE"]);
  assert.deepEqual(moved.log.histories.map(([path]) => path).sort(), ["SPEC.md", "docs/sources.md"]);
  for (const [, options] of moved.log.histories) assert.deepEqual([options.changes, options.limit <= 30], [false, true]);
  assert.deepEqual(moved.log.fileAts.map(([path]) => path).sort(), ["SPEC.md", "docs/sources.md"]);

  const c1 = commit("c1", "2026-10-01T10:00:00Z", { "SPEC.md": spec(), "docs/sources.md": links("2", "1") });
  const still = hostOf([c1]);
  await marked(await render(still), []);
  assert.deepEqual(still.log.histories.map(([path]) => path), ["docs/sources.md"]);
  assert.deepEqual(still.log.fileAts, [], "a file with one commit in its history cannot have moved a source: the page of commits is all it costs");
  // Two commits of the links file, the second only adding a source: its texts are read, no source moved, so neither the register nor the SPEC's history is.
  const added = hostOf([commit("c2", "2026-10-02T10:00:00Z", { ...c1.files, "docs/sources.md": links("2", "1") }),
    commit("c1", "2026-10-01T10:00:00Z", { "SPEC.md": spec(), "docs/sources.md": links("2", null) })]);
  await marked(await render(added), []);
  assert.deepEqual(added.log.histories.map(([path]) => path), ["docs/sources.md"]);
  assert.deepEqual(added.log.reads.filter((path) => path.startsWith("docs/sources/")), [], "the register is read only when a source moved");

  const bare = treeHost({ trees: { main: { "SPEC.md": spec() } }, history: [commit("c1", "2026-10-01T10:00:00Z", { "SPEC.md": spec() })] });
  await marked(await render(bare), []);
  assert.deepEqual(bare.log.histories, []);
});
