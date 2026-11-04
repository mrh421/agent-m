// MOD-trace-pages' specification view narrows its tree by text and by filters (ITM-596), as UC-020 step 4 states it: "The reader narrows the tree by typing part of a name or rule, or by
// filter: status, source, realised or not", and as the accepted text of docs/architecture/MOD-trace-pages.md has it: the view narrows "it by filters", a descriptor's `filters` being
// `{ name, values, keep(row) -> boolean }`, and each route taking "its version and filters in its `params`".
//
// Run: node --test tests/trace-pages-spec-narrow.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020
// Level: unit
//
// This calls the public trace/specification Route.render with a Host of the test's own (tests/trace-pages-harness.mjs), and drives the controls the way a person does: a value is set on the
// control and its `input` (the text) or `change` (a choice) event is dispatched. The fixture is a SPEC of four requirements in two sections, a group file that arranges three of them (one
// member of it names no requirement), a use case that realises two, and a queue whose one open entry changes ALPHA RULE, withdraws BETA RULE and adds EPSILON RULE. The expected values are written in
// each case; none is read from a document. Readings the cases take where the texts leave one open, each named in the pull request:
//   - the controls stand above the tree: a text field `spec-narrow-text`, and the choices `spec-narrow-status`, `spec-narrow-source` and `spec-narrow-realised`, each with the choice "all" first;
//   - the text matches the name or the rule of a requirement, in any case; a requirement an entry would add matches by its name;
//   - the choices of status are the four statuses; of source, the sources the SPEC names, in the order of their names; of realised, "realised" and "not realised"; a requirement an entry would add is not realised
//     and names no source;
//   - a row that does not match is hidden, a group none of whose requirements matches is hidden, and a member that names no requirement is shown only while nothing narrows;
//   - a group keeps its counts while the tree is narrowed; with no requirement left the tree says "No requirement matches.";
//   - the params `text`, `status`, `source` and `realised` give the controls their first values, so that an address reproduces the narrowed tree; the controls narrow in place.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const block = (name, source, rule) => [`**${name}** *(${source})*`, rule, "*Check:* at review.", ""];
const SPEC = [
  "# Fixture — Specification", "", "## Lending", "",
  ...block("ALPHA RULE", "Source A", "Every loan has a due date."),
  ...block("BETA RULE", "Source A; Source B", "Every book stands on a shelf."),
  "## Membership", "",
  ...block("GAMMA RULE", "Source B", "A member holds a card."),
  ...block("DELTA RULE", "Source C", "Fines stay small."),
].join("\n");
const PROPOSAL = ["## Lending", "", ...block("ALPHA RULE", "Source A", "Every loan has a due date, changed."), ...block("EPSILON RULE", "Source A", "Epsilon rule.")].join("\n");
const GROUPS = ["- Lending rules", "  - ALPHA RULE", "  - BETA RULE", "- Membership rules", "  - GAMMA RULE", "  - GHOST RULE", ""].join("\n");
const QUEUE = "docs/spec-freigaben/2026-10-09_lending";
const FILES = {
  "SPEC.md": SPEC,
  "docs/groups/requirements.md": GROUPS,
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE", "GAMMA RULE"] }),
  [`${QUEUE}/index.md`]: ["# SPEC approvals — queue 2026-10-09 · lending", "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## Lending | — | — |`, ""].join("\n"),
  [`${QUEUE}/entscheidungen.md`]: "# Decisions — queue 2026-10-09 lending\n\nAppend-only.\n",
  [`${QUEUE}/01-entry.md`]: PROPOSAL,
};
const EVERY = ["ALPHA RULE", "BETA RULE", "EPSILON RULE", "GAMMA RULE", "DELTA RULE", "GHOST RULE"].sort();

async function render(productHost, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: productHost } }, { key: "specification", ref: "main", ...params });
  return target;
}
const hasClass = (node, name) => node.className.split(/\s+/).includes(name);
const control = (target, name) => find(target, (node) => hasClass(node, `spec-narrow-${name}`))[0];
// Whether the narrowing hides a node: some element from it up to the root is hidden — but for the list of a group, which its control closes and opens (the cases name when a group is open).
const hiddenWithin = (node, root) => {
  for (let up = node; up && up !== root; up = up.parentNode) {
    if (up.getAttribute?.("hidden") === null || up.getAttribute?.("hidden") === undefined || hasClass(up, "spec-group-body")) continue;
    return true;
  }
  return false;
};
const bodyOf = (target, title) => find(find(target, (node) => node.localName === "section" && hasClass(node, "spec-group")).find((group) => find(group, (node) => hasClass(node, "spec-group-toggle"))[0].textContent === title),
  (node) => hasClass(node, "spec-group-body"))[0];
// The names of the rows a person sees: the rows of requirements and of unknown members that no hidden element holds.
// A row's name is its button's text, or, for a row without one, the first text of its first cell: the cell of a requirement no group names also holds the mark *not yet placed* (UC-021 3b).
const seen = (target) => find(target, (node) => node.localName === "tr" && find(node, (cell) => hasClass(cell, "requirement-status")).length === 1)
  .filter((row) => !hiddenWithin(row, target))
  .map((row) => find(row, (node) => node.localName === "button" && hasClass(node, "requirement-name"))[0]?.textContent ?? row.firstChild.firstChild.textContent).sort();
const groupsSeen = (target) => find(target, (node) => node.localName === "section" && hasClass(node, "spec-group")).filter((group) => !hiddenWithin(group, target))
  .map((group) => find(group, (node) => node.localName === "button" && hasClass(node, "spec-group-toggle"))[0].textContent);
// Sets the controls a person sets and waits until the tree shows `expected` (a choice of realised reads the trace graph first).
async function narrowTo(target, values, expected) {
  for (const [name, value] of Object.entries(values)) {
    const field = control(target, name);
    assert.ok(field, `the control ${name} is on the page`);
    field.value = value;
    field.dispatchEvent(new Event(name === "text" ? "input" : "change"));
  }
  await until(() => JSON.stringify(seen(target)) === JSON.stringify([...expected].sort()));
  return seen(target);
}
const optionsOf = (target, name) => find(control(target, name), (node) => node.localName === "option").map((node) => node.getAttribute("value") ?? node.textContent);
const main = () => treeHost({ trees: { main: FILES } });

// TST-596001 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main; known positive: with nothing typed every requirement and the unknown member is on the page
// input: "shelf" typed (it stands in BETA RULE's rule only); then "Gamma" (a name, in other case); then "RULE" (every name); then the text cleared
// expect: the rows BETA RULE; GAMMA RULE; every requirement (the unknown member and the group of it hidden but for the requirements' own groups' rows); then the whole tree again. Lending rules keeps its count "2 requirements"
test("typing part of a name or of a rule narrows the tree to the requirements that hold it", async () => {
  const target = await render(main());
  assert.deepEqual(seen(target), EVERY, "known positive");
  assert.deepEqual(await narrowTo(target, { text: "shelf" }, ["BETA RULE"]), ["BETA RULE"]);
  assert.deepEqual(groupsSeen(target), ["Lending rules"], "the group of no matching requirement is hidden");
  // The tables of the tree: the list of the SPEC changes waiting for acceptance above it (section.spec-waiting) is a table.list too, and is not narrowed.
  const waiting = find(target, (node) => node.localName === "section" && hasClass(node, "spec-waiting")).flatMap((section) => find(section, (node) => node.localName === "table"));
  const tables = () => find(target, (node) => node.localName === "table" && hasClass(node, "list")).filter((table) => !waiting.includes(table) && !hiddenWithin(table, target)).length;
  assert.equal(tables(), 1, "so are the tables in which nothing matches: only that of Lending rules is left");
  assert.equal(find(find(target, (node) => node.localName === "section" && hasClass(node, "spec-group"))[0], (node) => hasClass(node, "spec-group-held"))[0].textContent, "2 requirements");
  assert.deepEqual(await narrowTo(target, { text: "Gamma" }, ["GAMMA RULE"]), ["GAMMA RULE"]);
  assert.deepEqual(groupsSeen(target), ["Membership rules"]);
  assert.deepEqual(await narrowTo(target, { text: "rule" }, ["ALPHA RULE", "BETA RULE", "DELTA RULE", "EPSILON RULE", "GAMMA RULE"]), ["ALPHA RULE", "BETA RULE", "DELTA RULE", "EPSILON RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { text: "" }, EVERY), EVERY);
  assert.deepEqual(groupsSeen(target), ["Lending rules", "Membership rules"]);
});

// TST-596002 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main: ALPHA RULE change proposed, BETA RULE removal proposed, EPSILON RULE proposed, GAMMA RULE and DELTA RULE in SPEC
// input: the status chosen in turn: removal proposed; proposed; in SPEC; change proposed; all
// expect: BETA RULE; EPSILON RULE; DELTA RULE and GAMMA RULE; ALPHA RULE; every requirement again. The choices offered are all, in SPEC, change proposed, removal proposed, proposed
test("the filter by status keeps the requirements of that status", async () => {
  const target = await render(main());
  assert.deepEqual(optionsOf(target, "status"), ["all", "in SPEC", "change proposed", "removal proposed", "proposed"]);
  assert.deepEqual(await narrowTo(target, { status: "removal proposed" }, ["BETA RULE"]), ["BETA RULE"]);
  assert.deepEqual(await narrowTo(target, { status: "proposed" }, ["EPSILON RULE"]), ["EPSILON RULE"]);
  assert.deepEqual(await narrowTo(target, { status: "in SPEC" }, ["DELTA RULE", "GAMMA RULE"]), ["DELTA RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { status: "change proposed" }, ["ALPHA RULE"]), ["ALPHA RULE"]);
  assert.deepEqual(await narrowTo(target, { status: "all" }, EVERY), EVERY);
});

// TST-596003 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main: BETA RULE names Source A and Source B, ALPHA RULE Source A, GAMMA RULE Source B, DELTA RULE Source C; EPSILON RULE (added) names none
// input: the source chosen in turn: Source B; Source C; Source A; all
// expect: the choices offered are all, Source A, Source B, Source C; BETA RULE and GAMMA RULE; DELTA RULE; ALPHA RULE and BETA RULE; every requirement again
test("the filter by source keeps the requirements that name the source", async () => {
  const target = await render(main());
  assert.deepEqual(optionsOf(target, "source"), ["all", "Source A", "Source B", "Source C"]);
  assert.deepEqual(await narrowTo(target, { source: "Source B" }, ["BETA RULE", "GAMMA RULE"]), ["BETA RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { source: "Source C" }, ["DELTA RULE"]), ["DELTA RULE"]);
  assert.deepEqual(await narrowTo(target, { source: "Source A" }, ["ALPHA RULE", "BETA RULE"]), ["ALPHA RULE", "BETA RULE"]);
  assert.deepEqual(await narrowTo(target, { source: "all" }, EVERY), EVERY);
});

// TST-596004 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main: UC-001 realises ALPHA RULE and GAMMA RULE; no use case realises BETA RULE and DELTA RULE, nor EPSILON RULE, which an entry would add
// input: realised chosen; not realised chosen; all chosen
// expect: ALPHA RULE and GAMMA RULE; BETA RULE, DELTA RULE and EPSILON RULE; every requirement again. The choices offered are all, realised, not realised
test("the filter by realised keeps the requirements a use case realises, or those none realises", async () => {
  const target = await render(main());
  assert.deepEqual(optionsOf(target, "realised"), ["all", "realised", "not realised"]);
  assert.deepEqual(await narrowTo(target, { realised: "realised" }, ["ALPHA RULE", "GAMMA RULE"]), ["ALPHA RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { realised: "not realised" }, ["BETA RULE", "DELTA RULE", "EPSILON RULE"]), ["BETA RULE", "DELTA RULE", "EPSILON RULE"]);
  assert.deepEqual(await narrowTo(target, { realised: "all" }, EVERY), EVERY);
});

// TST-596005 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main
// input: the source Source A and not realised together; then the text "book" added; then the text "loan" in place of it; then the text cleared
// expect: BETA RULE alone (Source A, not realised; EPSILON RULE, added, names no source); BETA RULE ("book" stands in its rule); no row and no group, since "loan" stands in ALPHA RULE's rule, which is realised, and the line "No requirement matches." on the page; then, with the filters still set, BETA RULE, and the line gone
test("the text and the filters narrow together, and a tree with nothing left says so", async () => {
  const target = await render(main());
  const nothing = () => find(target, (node) => hasClass(node, "spec-narrow-none")).filter((node) => !hiddenWithin(node, target));
  assert.equal(nothing().length, 0, "known positive: the line is not there while requirements are");
  assert.deepEqual(await narrowTo(target, { source: "Source A", realised: "not realised" }, ["BETA RULE"]), ["BETA RULE"]);
  assert.deepEqual(await narrowTo(target, { text: "book" }, ["BETA RULE"]), ["BETA RULE"]);
  assert.deepEqual(await narrowTo(target, { text: "loan" }, []), []);
  assert.equal(nothing()[0]?.textContent, "No requirement matches.");
  assert.deepEqual(groupsSeen(target), []);
  assert.deepEqual(await narrowTo(target, { text: "" }, ["BETA RULE"]), ["BETA RULE"]);
  assert.equal(nothing().length, 0);
});

// TST-596006 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main
// input: the route rendered with the params text "shelf"; with status "removal proposed"; with source "Source C" and realised "not realised"; with a status that is none of the four
// expect: the tree drawn narrowed to BETA RULE; to BETA RULE; to DELTA RULE, each control holding the value of its param; the last tree is not narrowed
test("the params give the controls their first values and the tree is drawn narrowed", async () => {
  const drawn = async (params, expected) => {
    const target = await render(main(), params);
    await until(() => JSON.stringify(seen(target)) === JSON.stringify([...expected].sort()));
    return target;
  };
  assert.deepEqual(seen(await drawn({ text: "shelf" }, ["BETA RULE"])), ["BETA RULE"]);
  assert.deepEqual(seen(await drawn({ status: "removal proposed" }, ["BETA RULE"])), ["BETA RULE"]);
  const both = await drawn({ source: "Source C", realised: "not realised" }, ["DELTA RULE"]);
  assert.deepEqual(seen(both), ["DELTA RULE"]);
  assert.deepEqual([control(both, "source").value, control(both, "realised").value], ["Source C", "not realised"]);
  assert.deepEqual(seen(await drawn({ status: "no such status" }, EVERY)), EVERY);
});

// TST-596007 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main, whose group Membership rules names GHOST RULE, which no requirement has
// input: the status in SPEC chosen, then all
// expect: GHOST RULE is among the rows with nothing narrowing, gone while the status narrows, and back once it is all again
test("a member that names no requirement is shown only while nothing narrows", async () => {
  const target = await render(main());
  assert.ok(seen(target).includes("GHOST RULE"), "known positive");
  assert.deepEqual(await narrowTo(target, { status: "in SPEC" }, ["DELTA RULE", "GAMMA RULE"]), ["DELTA RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { status: "all" }, EVERY), EVERY);
});

// TST-596008 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture at the tag v2026.1.0, which holds the same files
// input: at the tag, the source Source B chosen, then the text "card"
// expect: the controls are there at the tag too; BETA RULE and GAMMA RULE (the tag shows no entry, so no EPSILON RULE); then GAMMA RULE
test("a released version narrows the same way", async () => {
  const productHost = treeHost({ trees: { main: FILES, "v2026.1.0": FILES }, tags: ["v2026.1.0"] });
  const target = await render(productHost, { ref: "v2026.1.0" });
  assert.deepEqual(optionsOf(target, "status"), ["all", "in SPEC", "change proposed", "removal proposed", "proposed"]);
  assert.deepEqual(await narrowTo(target, { source: "Source B" }, ["BETA RULE", "GAMMA RULE"]), ["BETA RULE", "GAMMA RULE"]);
  assert.deepEqual(await narrowTo(target, { text: "card" }, ["GAMMA RULE"]), ["GAMMA RULE"]);
});

// TST-596009 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main, whose branch trace-cache holds no graph of main (the workflow "main changed" has not stored it)
// input: realised chosen
// expect: the tree is not narrowed by it (every row stays) and the page says "Whether a use case realises a requirement could not be read."
test("a trace graph that is not stored leaves the tree as it is and names what is missing", async () => {
  const target = await render(treeHost({ trees: { main: FILES }, stored: () => false }));
  const all = seen(target);
  assert.ok(all.includes("DELTA RULE") && all.includes("GHOST RULE"), "known positive: the tree is drawn");
  const field = control(target, "realised");
  field.value = "realised";
  field.dispatchEvent(new Event("change"));
  await until(() => find(target, (node) => hasClass(node, "spec-narrow-problem")).some((node) => !hiddenWithin(node, target)));
  assert.equal(hiddenWithin(find(target, (node) => hasClass(node, "spec-narrow-problem"))[0], target), false, "the line is shown");
  assert.equal(find(target, (node) => hasClass(node, "spec-narrow-problem"))[0].textContent, "Whether a use case realises a requirement could not be read.");
  assert.deepEqual(seen(target), all);
});

// TST-596010 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: the fixture on main, whose groups start closed
// input: "shelf" typed (BETA RULE, in Lending rules); then the text cleared; then Lending rules opened with its control and "shelf" typed and cleared
// expect: Lending rules is open while BETA RULE matches, Membership rules stays closed; both closed again once the text is cleared; the group the person opened stays open
test("a group with a matching requirement is opened by the narrowing, and closed again when it ends unless the person opened it", async () => {
  const target = await render(main());
  const open = (title) => bodyOf(target, title).getAttribute("hidden") === null;
  assert.deepEqual([open("Lending rules"), open("Membership rules")], [false, false], "known positive: both start closed");
  await narrowTo(target, { text: "shelf" }, ["BETA RULE"]);
  assert.deepEqual([open("Lending rules"), open("Membership rules")], [true, false]);
  await narrowTo(target, { text: "" }, EVERY);
  assert.deepEqual([open("Lending rules"), open("Membership rules")], [false, false]);
  find(target, (node) => node.localName === "button" && hasClass(node, "spec-group-toggle") && node.textContent === "Lending rules")[0].dispatchEvent(new Event("click"));
  await narrowTo(target, { text: "shelf" }, ["BETA RULE"]);
  await narrowTo(target, { text: "" }, EVERY);
  assert.deepEqual([open("Lending rules"), open("Membership rules")], [true, false]);
});
