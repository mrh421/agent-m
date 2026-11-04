// MOD-trace-pages' specification view draws the requirements as the tree of the group file docs/groups/requirements.md (ITM-595), as the accepted text of
// docs/architecture/MOD-trace-pages.md states it for the specification: "the tree of `docs/groups/requirements.md`, every requirement once with its status — in SPEC, change
// proposed, removal proposed, proposed — … each group with how many it holds and how many no use case realises"; UC-020 steps 2, 3 and 3a: the groups nested, each requirement once
// under its group by its name, or at the top level if no group names it; a proposed requirement at the top level until a group names it; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL.
//
// Run: node --test tests/trace-pages-spec-tree.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// Level: component
//
// The fixture is a small product: a SPEC of four requirements in two sections; a group file with two top groups, one holding a group; one use case that realises ALPHA RULE and
// one that realises GAMMA RULE; and a queue of one open entry, which proposes the section "## Lending" without BETA RULE, with ALPHA RULE's rule changed and with EPSILON RULE and ZETA RULE added.
// The group file names GHOST RULE, which no requirement has, and ZETA RULE, which the entry would add, and leaves DELTA RULE and EPSILON RULE unnamed. The expected values are written in each case; none is read from a document.
// Readings the cases take where the texts leave one open, each named in the pull request:
//   - "how many it holds" counts the requirements of the group and of the groups below it, once each; a member that names no requirement is not one, and a requirement an open entry would add is;
//   - a requirement an open entry would add is one that no use case realises, since the trace graph does not hold it;
//   - the status of a requirement that two open entries name is the first entry's;
//   - an unknown member's status reads "unknown: no requirement of this name".

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const SPEC = [
  "# Fixture — Specification", "", "## Lending", "",
  "**ALPHA RULE** *(Source)*", "Alpha rule.", "*Check:* at review.", "",
  "**BETA RULE** *(Source)*", "Beta rule.", "*Check:* at review.", "",
  "## Membership", "",
  "**GAMMA RULE** *(Source)*", "Gamma rule.", "*Check:* at review.", "",
  "**DELTA RULE** *(Source)*", "Delta rule.", "*Check:* at review.", "",
].join("\n");
const PROPOSAL = [
  "## Lending", "",
  "**ALPHA RULE** *(Source)*", "Alpha rule, changed.", "*Check:* at review.", "",
  "**EPSILON RULE** *(Source)*", "Epsilon rule.", "*Check:* at review.", "",
  "**ZETA RULE** *(Source)*", "Zeta rule.", "*Check:* at review.", "",
].join("\n");
const GROUPS = ["- Lending rules", "  - ALPHA RULE", "  - Loans", "    - BETA RULE", "    - ZETA RULE", "- Membership rules", "  - GAMMA RULE", "  - GHOST RULE", ""].join("\n");
const QUEUE = "docs/spec-freigaben/2026-10-09_lending";
const FILES = {
  "SPEC.md": SPEC,
  "docs/groups/requirements.md": GROUPS,
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
  "docs/use-cases/UC-002-second.md": doc("UC-002", "Second use case", { realises: ["GAMMA RULE"] }),
  [`${QUEUE}/index.md`]: ["# SPEC approvals — queue 2026-10-09 · lending", "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## Lending | — | — |`, ""].join("\n"),
  [`${QUEUE}/entscheidungen.md`]: "# Decisions — queue 2026-10-09 lending\n\nAppend-only.\n",
  [`${QUEUE}/01-entry.md`]: PROPOSAL,
};
const mainParams = { key: "specification", ref: "main" };

async function render(productHost, params = mainParams) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: productHost } }, params);
  return target;
}
const hasClass = (node, name) => node.className.split(/\s+/).includes(name);
// A row's name is its button's text, or, for a row without one, the first text of its first cell: the cell of a requirement no group names also holds the mark *not yet placed* (UC-021 3b).
const rowsOf = (root) => find(root, (node) => node.localName === "tr" && find(node, (cell) => hasClass(cell, "requirement-status")).length === 1)
  .map((row) => [find(row, (node) => node.localName === "button" && hasClass(node, "requirement-name"))[0]?.textContent ?? row.firstChild.firstChild.textContent,
    find(row, (node) => hasClass(node, "requirement-status"))[0].textContent]);
const groups = (root) => find(root, (node) => node.localName === "section" && hasClass(node, "spec-group"));
const titleOf = (group) => find(group, (node) => node.localName === "button" && hasClass(node, "spec-group-toggle"))[0].textContent;
const spanOf = (group, name) => find(group, (node) => node.localName === "span" && hasClass(node, name))[0].textContent;

// TST-595001 · level: component · module: MOD-trace-pages
// guards: UC-020; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the fixture on the default branch main: DELTA RULE named by no group, EPSILON RULE added by the open entry and named by no group, ZETA RULE added by it and named by a group, GHOST RULE named by a group but by no requirement
// input: the public trace/specification route rendered at the ref main
// expect: each requirement once, with its status, in the order of the tree: the top level first (DELTA RULE in SPEC, EPSILON RULE proposed), then Lending rules (ALPHA RULE change proposed; below it, in Loans, BETA RULE removal proposed, ZETA RULE proposed), then Membership rules (GAMMA RULE in SPEC, GHOST RULE as an unknown member)
test("every requirement appears once in the tree of the group file, with its status", async () => {
  const target = await render(treeHost({ trees: { main: FILES } }));
  assert.deepEqual(rowsOf(target), [
    ["DELTA RULE", "in SPEC"], ["EPSILON RULE", "proposed"],
    ["ALPHA RULE", "change proposed"], ["BETA RULE", "removal proposed"], ["ZETA RULE", "proposed"],
    ["GAMMA RULE", "in SPEC"], ["GHOST RULE", "unknown: no requirement of this name"],
  ]);
  const opening = find(target, (node) => node.localName === "button" && hasClass(node, "requirement-name")).map((node) => node.textContent);
  assert.deepEqual([...opening].sort(), ["ALPHA RULE", "BETA RULE", "DELTA RULE", "GAMMA RULE"], "each requirement of the SPEC is one row that opens");
});

// TST-595002 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main; UC-001 realises ALPHA RULE, UC-002 realises GAMMA RULE, none realises BETA RULE, DELTA RULE or the added EPSILON RULE
// input: the route rendered at main
// expect: the groups in the order of the file, the group below another inside it; Lending rules holds 3 requirements (those of Loans too), 2 that no use case realises (BETA RULE, and ZETA RULE, which the entry would add and nothing realises yet); Loans holds 2, 2; Membership rules holds 1 (GHOST RULE is no requirement), 0 that no use case realises
test("each group shows how many requirements it holds and how many of them no use case realises", async () => {
  const target = await render(treeHost({ trees: { main: FILES } }));
  const all = groups(target);
  assert.deepEqual(all.map(titleOf), ["Lending rules", "Loans", "Membership rules"]);
  assert.deepEqual(all.map((group) => [spanOf(group, "spec-group-held"), spanOf(group, "spec-group-unrealised")]), [
    ["3 requirements", "2 that no use case realises"],
    ["2 requirements", "2 that no use case realises"],
    ["1 requirement", "0 that no use case realises"],
  ]);
  assert.deepEqual(find(all[0], (node) => node.localName === "section" && hasClass(node, "spec-group") && node !== all[0]).map(titleOf), ["Loans"], "Loans stands inside Lending rules");
  assert.equal(find(all[2], (node) => node.localName === "section" && hasClass(node, "spec-group") && node !== all[2]).length, 0, "Membership rules holds no group");
});

// TST-595003 · level: component · module: MOD-trace-pages
// guards: UC-020; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the fixture on main
// input: the route rendered at main
// expect: DELTA RULE (named by no group) and EPSILON RULE (added by the open entry) stand in a table of the page itself, in no group; the other rows stand in groups
test("a requirement no group names, and a proposed one, stand at the top level", async () => {
  const target = await render(treeHost({ trees: { main: FILES } }));
  const inside = new Set(groups(target).flatMap((group) => rowsOf(group).map(([name]) => name)));
  assert.deepEqual([...inside].sort(), ["ALPHA RULE", "BETA RULE", "GAMMA RULE", "GHOST RULE", "ZETA RULE"]);
  const topLevel = rowsOf(target).map(([name]) => name).filter((name) => !inside.has(name));
  assert.deepEqual(topLevel, ["DELTA RULE", "EPSILON RULE"]);
});

// TST-595004 · level: component · module: MOD-trace-pages
// guards: UC-020; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the fixture, whose group Membership rules names GHOST RULE, which no requirement has; known positive: it names GAMMA RULE too, which has one
// input: the route rendered at main
// expect: GHOST RULE is a row of the class requirement-unknown, with no control that opens it, in Membership rules; GAMMA RULE is a row that opens
test("a member that names no requirement is shown as unknown", async () => {
  const target = await render(treeHost({ trees: { main: FILES } }));
  const membership = groups(target).find((group) => titleOf(group) === "Membership rules");
  assert.deepEqual(find(membership, (node) => node.localName === "button" && hasClass(node, "requirement-name")).map((node) => node.textContent), ["GAMMA RULE"]);
  const unknown = find(membership, (node) => node.localName === "tr" && hasClass(node, "requirement-unknown"));
  assert.deepEqual(unknown.map((row) => row.firstChild.textContent), ["GHOST RULE"]);
  assert.equal(find(unknown[0], (node) => node.localName === "button").length, 0);
});

// TST-595005 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main, and the same files at the tag v2026.1.0; known positive: at main ALPHA RULE reads change proposed
// input: the route rendered at the ref v2026.1.0
// expect: the tree of the tag's group file with every SPEC requirement "in SPEC", no EPSILON RULE, ZETA RULE an unknown member, the counts of the groups as without the entry
test("at a released version every requirement reads in SPEC and the tree is the tag's", async () => {
  const productHost = treeHost({ trees: { main: FILES, "v2026.1.0": FILES }, tags: ["v2026.1.0"] });
  assert.deepEqual(rowsOf(await render(productHost)).find(([name]) => name === "ALPHA RULE"), ["ALPHA RULE", "change proposed"]);
  const target = await render(productHost, { key: "specification", ref: "v2026.1.0" });
  assert.deepEqual(rowsOf(target), [
    ["DELTA RULE", "in SPEC"], ["ALPHA RULE", "in SPEC"], ["BETA RULE", "in SPEC"], ["ZETA RULE", "unknown: no requirement of this name"],
    ["GAMMA RULE", "in SPEC"], ["GHOST RULE", "unknown: no requirement of this name"],
  ]);
  assert.deepEqual(groups(target).map((group) => [titleOf(group), spanOf(group, "spec-group-held"), spanOf(group, "spec-group-unrealised")]), [
    ["Lending rules", "2 requirements", "1 that no use case realises"],
    ["Loans", "1 requirement", "1 that no use case realises"],
    ["Membership rules", "1 requirement", "0 that no use case realises"],
  ]);
});

// TST-595006 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main
// input: the control of Lending rules clicked; then the control of Loans inside it; then Lending rules again
// expect: every group starts closed; Lending rules opens its own list and the group below it, and leaves Membership rules closed; Loans opens on its own; closing Lending rules closes what is in it
test("a group opens and closes with its control and leaves the other groups as they are", async () => {
  const target = await render(treeHost({ trees: { main: FILES } }));
  const [lending, loans, membership] = groups(target);
  const bodyOf = (group) => find(group, (node) => node.localName === "div" && hasClass(node, "spec-group-body"))[0];
  const toggleOf = (group) => find(group, (node) => node.localName === "button" && hasClass(node, "spec-group-toggle"))[0];
  const closed = (group) => bodyOf(group).getAttribute("hidden") === "hidden";
  assert.deepEqual([lending, loans, membership].map(closed), [true, true, true]);
  toggleOf(lending).dispatchEvent(new Event("click"));
  assert.deepEqual([lending, loans, membership].map(closed), [false, true, true]);
  toggleOf(loans).dispatchEvent(new Event("click"));
  assert.deepEqual([lending, loans, membership].map(closed), [false, false, true]);
  toggleOf(lending).dispatchEvent(new Event("click"));
  assert.deepEqual([lending, loans, membership].map(closed), [true, false, true], "Loans keeps its own state; it is hidden with Lending rules' body");
});

// TST-595007 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main, whose branch trace-cache holds no graph of main (the workflow "main changed" has not stored it); known positive: the same page with the graph stored counts 2 for Loans
// input: the route rendered at main
// expect: the groups still show how many they hold (the impact list of the entry reads the same stored graph and finds none too, so ZETA RULE is unknown and not counted), and where the unrealised count would stand they read "whether a use case realises them could not be read"
test("a trace graph that is not stored leaves the counts of held requirements and names what is missing", async () => {
  const positive = await render(treeHost({ trees: { main: FILES } }));
  assert.equal(spanOf(groups(positive)[1], "spec-group-unrealised"), "2 that no use case realises");
  const target = await render(treeHost({ trees: { main: FILES }, stored: () => false }));
  assert.deepEqual(groups(target).map((group) => [spanOf(group, "spec-group-held"), spanOf(group, "spec-group-unrealised")]),
    ["2 requirements", "1 requirement", "1 requirement"].map((held) => [held, "whether a use case realises them could not be read"]));
});

// TST-595008 · level: component · module: MOD-trace-pages
// guards: UC-020; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the fixture without a group file; known positive: with it, Lending rules exists
// input: the route rendered at main
// expect: no group, and every requirement of the SPEC at the top level in the order of the SPEC, EPSILON RULE and ZETA RULE after them
test("without a group file every requirement stands at the top level", async () => {
  const { "docs/groups/requirements.md": _group, ...without } = FILES;
  assert.ok(groups(await render(treeHost({ trees: { main: FILES } }))).length > 0, "known positive: the group file gives groups");
  const target = await render(treeHost({ trees: { main: without } }));
  assert.equal(groups(target).length, 0);
  assert.deepEqual(rowsOf(target), [
    ["ALPHA RULE", "change proposed"], ["BETA RULE", "removal proposed"], ["GAMMA RULE", "in SPEC"], ["DELTA RULE", "in SPEC"], ["EPSILON RULE", "proposed"], ["ZETA RULE", "proposed"],
  ]);
});

// TST-595009 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture with a second queue, newer than the first (2026-10-10), whose open entry proposes the section "## Lending" with BETA RULE alone, so that it withdraws ALPHA RULE, which the older queue's entry changes
// input: the route rendered at main
// expect: ALPHA RULE reads "removal proposed", the status the newest entry that names it gives (the last in the order MOD-spec-changes' queues gives them: folder names, then entry numbers), and not "change proposed"; known positive: with the older queue alone it reads "change proposed"
test("of two open entries that name a requirement the first gives its status", async () => {
  const newer = "docs/spec-freigaben/2026-10-10_withdraw";
  const files = {
    ...FILES,
    [`${newer}/index.md`]: FILES[`${QUEUE}/index.md`].replace("2026-10-09 · lending", "2026-10-10 · withdraw"),
    [`${newer}/entscheidungen.md`]: "# Decisions — queue 2026-10-10 withdraw\n\nAppend-only.\n",
    [`${newer}/01-entry.md`]: ["## Lending", "", "**BETA RULE** *(Source)*", "Beta rule.", "*Check:* at review.", ""].join("\n"),
  };
  const statusOfAlpha = async (tree) => rowsOf(await render(treeHost({ trees: { main: tree } }))).find(([name]) => name === "ALPHA RULE")[1];
  assert.equal(await statusOfAlpha(FILES), "change proposed", "known positive");
  assert.equal(await statusOfAlpha(files), "removal proposed");
});
