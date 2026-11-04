// Release tests of ITM-1301 — the specification view (`#spec`, the route `trace` with the view `specification`) of a product with several change queues that wait for acceptance: each requirement that
// a waiting entry would change or withdraw carries the one mark of the newest queue's entry that names it, and the list of waiting entries holds every entry, each with its status and a link. The behaviour is
// the SPEC's OPEN PROPOSALS ARE SHOWN IN THE BROWSER ("Every requirement that an open queue entry would add, change or withdraw is shown in the browser with that entry's status and a link to it.");
// docs/architecture/MOD-trace-pages.md, view `specification` ("first, only while an entry of a change queue waits for acceptance, those entries, each with its status and a link to it"; "in SPEC, change
// proposed, removal proposed, proposed"); and UC-020, alternative flow 5c ("Two open proposals touch the same requirement. Both are listed"). Seen from outside: the page the route draws for a host that
// holds the files of a few queues, and nothing else.
// Run: node --test tests/release-itm-1301-newest-queue-marks.test.mjs
//
// Module: MOD-trace-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// Level: release
//
// Written for the release testing of sprint 113 by a participant who implemented none of ITM-1301 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementer's case
// (tests/trace-pages-newest-queue-marks.test.mjs) takes two queues that each hold one entry on one requirement; these cases take three queues, four requirements that the queues name in every
// combination, and queues of two entries each. They use the fixtures and the Host of tests/trace-pages-harness.mjs and the public route; the expected marks are stated in each case. Readings the
// texts leave open, taken here and named in the pull request:
//   - "the newest queue": the queue whose folder name sorts last, as MOD-spec-changes' `queues` lists "newest first" and MOD-progress-measures' `waitingQueues` gives them; the folder names here begin
//     with distinct dates, so no reading of ties is needed.
//   - "the newest queue's entry that names it": of the waiting entries, the newest queue's whose proposal changes or withdraws the requirement — an entry whose proposal leaves the requirement's text
//     as it is names it not (MOD-spec-changes' `entryImpact` lists what an entry changes, withdraws or adds).
//   - the order of the list of waiting entries is read for its queues only (the newest queue's entries before the older queue's); the entries of one queue are compared as a set.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const FIRST = "2026-10-08_first", SECOND = "2026-10-09_second", THIRD = "2026-10-10_third";
const RULES = { "ALPHA RULE": "Alpha rule.", "BETA RULE": "Beta rule.", "GAMMA RULE": "Gamma rule.", "DELTA RULE": "Delta rule." };
const section = (heading, names) => [heading, "", ...names.flatMap((name) => [`**${name}** *(Source)*`, RULES[name], "*Check:* at review.", ""])];
// The SPEC: one section with the four requirements, or two sections of two.
const specOf = (sections) => ["# Fixture — Specification", "", ...sections.flatMap(([heading, names]) => section(heading, names))].join("\n");
// The proposed text of one section: each name with `changed` gets a different rule text, each with `withdrawn` is left out, every other name keeps its text.
function proposal(heading, names, marks) {
  const kept = names.filter((name) => marks[name] !== "withdrawn");
  return section(heading, kept).map((line) => (Object.entries(marks).some(([name, mark]) => mark === "changed" && line === RULES[name]) ? line.replace(/\.$/, ", changed.") : line)).join("\n");
}
// The files of one queue: its index with one row for each entry, its (empty) decisions, and each entry's proposal. An entry is `[heading, text]`.
function queue(folder, entries) {
  const base = `docs/spec-freigaben/${folder}`;
  const rows = entries.map(([heading], at) => `| ${String(at + 1).padStart(2, "0")} | ${TICK}SPEC.md${TICK} | ${heading} | — | — |`);
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", ...rows, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", ""].join("\n"),
    ...Object.fromEntries(entries.map(([, text], at) => [`${base}/${String(at + 1).padStart(2, "0")}-entry.md`, text])),
  };
}
// The tree of main: the SPEC and the queues, put in the files' order that `order` gives.
const treeOf = (spec, queues, order) => {
  const tree = { "SPEC.md": spec };
  for (const [folder, entries] of order === "newest first" ? [...queues].reverse() : queues) Object.assign(tree, queue(folder, entries));
  return tree;
};

async function render(tree) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: treeHost({ trees: { main: tree } }) } }, { key: "specification", ref: "main" });
  return target;
}
// The mark beside each requirement of the tree.
const marksOf = (target) => Object.fromEntries(find(target, (node) => node.localName === "tr" && find(node, (cell) => cell.className === "requirement-status").length === 1)
  .map((row) => [find(row, (node) => node.localName === "button")[0].textContent, find(row, (node) => node.className === "requirement-status")[0].textContent]));
// The rows of the list of waiting entries: the address of the link, the section, the status.
const waitingOf = (target) => find(find(target, (node) => node.localName === "section" && node.className.includes("spec-waiting"))[0], (node) => node.localName === "tr")
  .filter((row) => find(row, (node) => node.localName === "a").length === 1)
  .map((row) => [find(row, (node) => node.localName === "a")[0].getAttribute("href"), ...find(row, (node) => node.localName === "td").slice(1).map((cell) => cell.textContent.trim())]);
const link = (folder, number) => `#spec-entry/id=spec-${folder}-${String(number).padStart(2, "0")}`;

// TST-1301301 · level: release · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: the default branch main, whose SPEC holds ALPHA RULE, BETA RULE, GAMMA RULE and DELTA RULE in one section, and three queues that each hold one entry that waits — 2026-10-08_first changes ALPHA and BETA and withdraws GAMMA, 2026-10-09_second withdraws ALPHA and changes BETA, 2026-10-10_third withdraws BETA and changes GAMMA and leaves ALPHA and DELTA as they are
// input: the specification view drawn at main, with the queues' files in the order of the oldest first, and again with the newest first
// expect: in both drawings ALPHA RULE is "removal proposed" (the second queue's, the newest that names it), BETA RULE "removal proposed" (the third's), GAMMA RULE "change proposed" (the third's), DELTA RULE "in SPEC" (no entry names it); the list of waiting entries holds the three entries, the third queue's first, then the second's, then the first's, each with the section "Lending" and the status "open"; counter-proof: with the oldest queue's marks planted — ALPHA "change proposed", BETA "change proposed", GAMMA "removal proposed" — all three expectations fail
// Planted fault: taking the oldest queue's entry for the mark (the loop over `impacts` in arrangement, src/trace-pages/flow.mjs, walking the waiting entries oldest first) turns ALPHA, BETA and GAMMA to the other mark, and the case fails on the marks.
test("TST-1301301 of three waiting queues the newest queue that names a requirement gives its mark, and every entry is listed", async () => {
  const names = Object.keys(RULES);
  const spec = specOf([["## Lending", names]]);
  const queues = [
    [FIRST, [["## Lending", proposal("## Lending", names, { "ALPHA RULE": "changed", "BETA RULE": "changed", "GAMMA RULE": "withdrawn" })]]],
    [SECOND, [["## Lending", proposal("## Lending", names, { "ALPHA RULE": "withdrawn", "BETA RULE": "changed" })]]],
    [THIRD, [["## Lending", proposal("## Lending", names, { "BETA RULE": "withdrawn", "GAMMA RULE": "changed" })]]],
  ];
  const marks = { "ALPHA RULE": "removal proposed", "BETA RULE": "removal proposed", "GAMMA RULE": "change proposed", "DELTA RULE": "in SPEC" };
  const planted = { "ALPHA RULE": "change proposed", "BETA RULE": "change proposed", "GAMMA RULE": "removal proposed", "DELTA RULE": "in SPEC" };
  for (const order of ["oldest first", "newest first"]) {
    const target = await render(treeOf(spec, queues, order));
    const got = marksOf(target);
    assert.deepEqual(got, marks, `${order}: the marks`);
    assert.notDeepEqual(got, planted, `${order}: counter-proof: the oldest queue's marks are not the page's`);
    assert.deepEqual(waitingOf(target), [
      [link(THIRD, 1), "Lending", "open"], [link(SECOND, 1), "Lending", "open"], [link(FIRST, 1), "Lending", "open"],
    ], `${order}: every entry is listed, the newest queue's first`);
  }
});

// TST-1301302 · level: release · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: the default branch main, whose SPEC holds ALPHA RULE and BETA RULE in the section Lending and GAMMA RULE and DELTA RULE in the section Returns, and two queues of two entries each — 2026-10-08_first changes ALPHA (Lending) and withdraws GAMMA (Returns), 2026-10-10_third withdraws ALPHA (Lending) and changes DELTA (Returns)
// input: the specification view drawn at main
// expect: ALPHA RULE is "removal proposed" (the third queue's, which is the newer one's), BETA RULE "in SPEC", GAMMA RULE "removal proposed" (the only entry that names it is the first queue's), DELTA RULE "change proposed" (the third queue's); the list holds all four entries, each with its section and "open", the third queue's two before the first queue's two; counter-proof: with the two queues' folders exchanged (the older one named third, the newer first) ALPHA RULE is "change proposed", so the mark follows the queue and not the entry's place in the list
// Planted fault: a mark taken from the first entry listed in the order of the entries' numbers, whichever queue it is of, gives ALPHA the first queue's "change proposed", and the case fails on the marks.
test("TST-1301302 queues of two entries mark each requirement by the newest queue that names it and list all four entries", async () => {
  const spec = specOf([["## Lending", ["ALPHA RULE", "BETA RULE"]], ["## Returns", ["GAMMA RULE", "DELTA RULE"]]]);
  const lending = ["ALPHA RULE", "BETA RULE"], returns = ["GAMMA RULE", "DELTA RULE"];
  const queues = (older, newer) => [
    [older, [["## Lending", proposal("## Lending", lending, { "ALPHA RULE": "changed" })], ["## Returns", proposal("## Returns", returns, { "GAMMA RULE": "withdrawn" })]]],
    [newer, [["## Lending", proposal("## Lending", lending, { "ALPHA RULE": "withdrawn" })], ["## Returns", proposal("## Returns", returns, { "DELTA RULE": "changed" })]]],
  ];
  const target = await render(treeOf(spec, queues(FIRST, THIRD), "oldest first"));
  assert.deepEqual(marksOf(target), { "ALPHA RULE": "removal proposed", "BETA RULE": "in SPEC", "GAMMA RULE": "removal proposed", "DELTA RULE": "change proposed" });
  const listed = waitingOf(target);
  assert.equal(listed.length, 4, "all four entries are listed");
  assert.deepEqual(listed.slice(0, 2).map(([href]) => href).sort(), [link(THIRD, 1), link(THIRD, 2)], "the newer queue's two entries come first");
  assert.deepEqual(listed.slice(2).map(([href]) => href).sort(), [link(FIRST, 1), link(FIRST, 2)], "then the older queue's two");
  assert.deepEqual([...new Set(listed.map(([, , status]) => status))], ["open"], "each with its status");
  assert.deepEqual(listed.map(([href, heading]) => [href, heading]).sort(), [
    [link(FIRST, 1), "Lending"], [link(FIRST, 2), "Returns"], [link(THIRD, 1), "Lending"], [link(THIRD, 2), "Returns"],
  ], "each entry with the section it changes");

  const exchanged = await render(treeOf(spec, queues(THIRD, FIRST), "oldest first"));
  assert.equal(marksOf(exchanged)["ALPHA RULE"], "change proposed", "counter-proof: with the folders exchanged, the mark follows the newer queue");
});
