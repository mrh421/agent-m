// Release tests of ITM-1180 — UC-020 on the specification view: at the default branch it links no list of all SPEC change entries, and it keeps *History of SPEC changes*, *Arrange*, *Edit*,
// *+ Requirement* and the link of each entry that waits; at a tag and at any other branch it offers none of the links that lead to the review pages. The behaviour is MOD-trace-pages
// (docs/architecture/MOD-trace-pages.md, the row of the view `specification`: "first, only while an entry of a change queue waits for acceptance, those entries, each with its status and a link to it
// (MOD-review-pages' `spec-entry/<id>`), and nothing where none waits" and "to the review pages, on the default branch only: *Edit* on a requirement, *+ Requirement* once for each section of the SPEC
// … and *Arrange*; *History of SPEC changes*, which opens MOD-review-pages' `spec-entry/history`") and UC-020 (docs/use-cases/UC-020-browse-the-specification.md, step 6 and Alternative flow 1a:
// "*Edit* … on the current version", "open proposals and *Edit* are hidden" on a released version).
// Run: node --test tests/release-itm-1180-spec-view-links.test.mjs
//
// Module: MOD-trace-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; THE BROWSER SHOWS ANY RELEASED VERSION; UC-020
// Level: release
//
// Written for the release testing of sprint 117 by a participant who implemented none of ITM-1180 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is the public route trace/specification
// of MOD-trace-pages, drawn over the Host of tests/trace-pages-harness.mjs whose repository has an open queue, a decided queue and three requirements in two sections. The cases read the page as a reader
// does: every anchor, by its text and its address. Readings the texts leave open, which the cases state:
//   - "a branch": the default branch the Host's repositoryInfo names (main), and a branch that is not it (next). The accepted text offers the links "on the default branch only", so a branch that is not the
//     default is read like a tag: it offers none of them.
//   - "no list of all SPEC change entries": no anchor whose text is "All SPEC change entries", none of the class `spec-entries-link`, and none whose address is the bare route `#spec-entry` (the form that
//     opened the list, in the address form the frame reads); the anchors that lead to one entry (`#spec-entry/id=spec-<queue>-<number>`) and to the history (`#spec-entry/id=history`) are the only ones to that route.
//   - Each link leads to a route the review pages serve, the reading of tests/release-itm-1254-issue-move.test.mjs for its lead.

import { document, find, treeHost, until, addressParts } from "./trace-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const { view: reviewPages } = await import("../src/review-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const SPEC = `# Library — Specification

## 1. Lending

**${LOAN}** *(Product Owner)*
Every loan states the date by which the book is returned.
*Check:* at review.

**${SHELF}** *(Product Owner)*
Every book stands on one shelf.
*Check:* at review.

## 2. Membership

**${CARD}** *(Product Owner)*
Every member holds a card.
*Check:* at review.
`;
const TICK = "`";
// One queue with one entry: its index, its decisions (a row when the entry is decided) and the entry.
function queue(folder, anchor, decided) {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ${anchor} | — | — |`, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", "", ...(decided ? [`| 2026-10-08 10:00 UTC | 1 | uebernommen | ${"c".repeat(40)} |`] : []), ""].join("\n"),
    [`${base}/01-entry.md`]: `${anchor}\n\n**${LOAN}** *(Product Owner)*\nEvery loan states the date by which the book is returned, changed.\n*Check:* at review.\n`,
  };
}
const OPEN = "2026-10-09_open", DONE = "2026-10-08_done";
const WAITING = { "SPEC.md": SPEC, ...queue(OPEN, "## 1. Lending", false), ...queue(DONE, "## 2. Membership", true) };
const NONE_WAITING = { "SPEC.md": SPEC, ...queue(DONE, "## 2. Membership", true) };

const PRODUCT = "https://github.com/acme/library";
// A link to a review route on the product's page ends in the product, percent-encoded (ITM-1364).
const onProduct = (href) => `${href}/product=${encodeURIComponent(PRODUCT)}`;
const REFS = ["main", "next", "v2026.1.0"];
async function render(files, ref = "main") {
  const productHost = treeHost({ trees: Object.fromEntries(REFS.map((each) => [each, files])), tags: ["v2026.1.0"] });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: PRODUCT, kind: "github", host: productHost } }, { key: "specification", ref });
  await until(() => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name")).length === 3);
  return target;
}
const anchors = (target) => find(target, (node) => node.localName === "a");
const hrefs = (target) => anchors(target).map((node) => node.getAttribute("href"));
const named = (target, label) => anchors(target).filter((node) => node.textContent === label);
const requirementButtons = (target) => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name"));
const encoded = (name) => `#requirement/name=${encodeURIComponent(name)}`;

// TST-1180301 · level: release · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: UC-020 step 6 on the default branch main of a library with an open queue entry (2026-10-09_open, entry 01), a decided one (2026-10-08_done, entry 01) and three requirements in two sections; known positive first — the page lists the three requirements
// input: the specification view drawn at main, and then every requirement opened
// expect: the page links History of SPEC changes to #spec-entry/id=history once and Arrange to #arrange/kind=requirements once, Edit beside each of the three requirements, + Requirement for each of the two sections, and the open entry to #spec-entry/id=spec-2026-10-09_open-01, each address ending in /product=<the product's address, percent-encoded> (ITM-1364); no anchor says All SPEC change entries, none has the class spec-entries-link, none leads to the bare #spec-entry, the only anchors to that route are the entry's and the history's, and the text of the page does not say All SPEC change entries; the decided entry is not linked; opening the requirements changes none of this
// Planted fault: specChangeLinks drawing `reviewLink("spec-entries-link", "All SPEC change entries", "spec-entry", {})` before the history link (src/trace-pages/flow.mjs) fails the assertion that no anchor says All SPEC change entries.
// Planted fault: specChangeLinks leaving out the history link or Arrange fails the assertion that each is linked once to its address.
// Planted fault: waitingSection drawing no link to the entry fails the assertion that the open entry is linked.
test("TST-1180301 at the default branch the page links the history, Arrange, Edit, + Requirement and the waiting entry, and no list of all SPEC change entries", async () => {
  const target = await render(WAITING, "main");
  assert.deepEqual(requirementButtons(target).map((node) => node.textContent), [LOAN, SHELF, CARD], "known positive: the three requirements are listed");
  const check = () => {
    assert.deepEqual(named(target, "History of SPEC changes").map((node) => node.getAttribute("href")), [onProduct("#spec-entry/id=history")]);
    assert.deepEqual(named(target, "Arrange").map((node) => node.getAttribute("href")), [onProduct("#arrange/kind=requirements")]);
    assert.deepEqual(named(target, "Edit").map((node) => node.getAttribute("href")), [LOAN, SHELF, CARD].map((name) => onProduct(encoded(name))));
    assert.deepEqual(named(target, "+ Requirement").map((node) => node.getAttribute("href")), ["## 1. Lending", "## 2. Membership"].map((heading) => onProduct(`#requirements/section=${encodeURIComponent(heading)}`)));
    assert.deepEqual(hrefs(target).filter((href) => href.startsWith("#spec-entry")), [onProduct(`#spec-entry/id=spec-${OPEN}-01`), onProduct("#spec-entry/id=history")], "the only anchors to the route spec-entry: the waiting entry's and the history's");
    assert.equal(named(target, "All SPEC change entries").length, 0, "no anchor says All SPEC change entries");
    assert.equal(anchors(target).some((node) => node.className.split(/\s+/).includes("spec-entries-link")), false);
    assert.equal(hrefs(target).includes("#spec-entry"), false, "no anchor leads to the bare #spec-entry");
    assert.equal(target.textContent.includes("All SPEC change entries"), false);
    assert.equal(hrefs(target).some((href) => href.includes(`spec-${DONE}-01`)), false, "the decided entry is not linked");
  };
  check();
  requirementButtons(target).forEach((button) => button.dispatchEvent(new Event("click")));
  assert.equal(find(target, (node) => node.localName === "section" && node.className.includes("requirement-detail")).length, 3, "known positive: each requirement opened");
  check();
});

// TST-1180302 · level: release · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: UC-020 step 6 on the default branch main of the library of TST-1180301 with no entry waiting (its one queue is decided)
// input: the specification view drawn at main
// expect: no section of waiting entries and no anchor to a SPEC change entry; History of SPEC changes and Arrange are linked once each to their addresses, which end in /product=<the product's address, percent-encoded> (ITM-1364), Edit beside each requirement and + Requirement for each section; no anchor says All SPEC change entries and none leads to the bare #spec-entry; the only anchor to the route spec-entry is the history's
// Planted fault: specChangeLinks drawing the link to the bare #spec-entry only where no entry waits fails the assertion that no anchor leads to the bare #spec-entry.
// Planted fault: the page drawing the history link only while an entry waits fails the assertion that it is linked once.
test("TST-1180302 with no entry waiting the page keeps the history, Arrange, Edit and + Requirement, and links no list of all entries", async () => {
  const target = await render(NONE_WAITING, "main");
  assert.deepEqual(requirementButtons(target).map((node) => node.textContent), [LOAN, SHELF, CARD], "known positive: the three requirements are listed");
  assert.equal(find(target, (node) => node.localName === "section" && node.className.includes("spec-waiting")).length, 0, "no waiting section");
  assert.deepEqual(named(target, "History of SPEC changes").map((node) => node.getAttribute("href")), [onProduct("#spec-entry/id=history")]);
  assert.deepEqual(named(target, "Arrange").map((node) => node.getAttribute("href")), [onProduct("#arrange/kind=requirements")]);
  assert.equal(named(target, "Edit").length, 3);
  assert.equal(named(target, "+ Requirement").length, 2);
  assert.deepEqual(hrefs(target).filter((href) => href.startsWith("#spec-entry")), [onProduct("#spec-entry/id=history")]);
  assert.equal(named(target, "All SPEC change entries").length, 0);
  assert.equal(hrefs(target).includes("#spec-entry"), false);
  assert.equal(target.textContent.includes("All SPEC change entries"), false);
});

// TST-1180303 · level: release · module: MOD-trace-pages
// guards: THE BROWSER SHOWS ANY RELEASED VERSION; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: UC-020 alternative flow 1a on the library of TST-1180301 with an open entry; main shown to hold the links first; the branch next, which is not the default branch the Host names, and the tag v2026.1.0
// input: the specification view drawn at next and at v2026.1.0
// expect: known positive — at main the history, Arrange, Edit, + Requirement and the waiting entry are linked; at next and at the tag the three requirements are listed and no anchor leads to the review pages: none says History of SPEC changes, Arrange, Edit, + Requirement or All SPEC change entries, none leads to the route spec-entry, arrange, requirement or requirements, and no section of waiting entries is drawn
// Planted fault: specChangeLinks drawn whatever the ref (`shown.onDefaultBranch ?` taken out of the choice of body in src/trace-pages/flow.mjs) fails the assertion that no anchor says History of SPEC changes at next and at the tag.
// Planted fault: waitingSection drawing no link to the entry fails the known positive that main links the waiting entry.
test("TST-1180303 at a branch that is not the default and at a tag the page offers no link to the review pages", async () => {
  const onMain = await render(WAITING, "main");
  assert.equal(named(onMain, "History of SPEC changes").length + named(onMain, "Arrange").length + named(onMain, "Edit").length + named(onMain, "+ Requirement").length, 1 + 1 + 3 + 2, "known positive: main offers them");
  assert.equal(hrefs(onMain).includes(onProduct(`#spec-entry/id=spec-${OPEN}-01`)), true, "known positive: main links the waiting entry");
  for (const ref of ["next", "v2026.1.0"]) {
    const target = await render(WAITING, ref);
    assert.deepEqual(requirementButtons(target).map((node) => node.textContent), [LOAN, SHELF, CARD], `${ref}: the requirements are listed`);
    for (const label of ["History of SPEC changes", "Arrange", "Edit", "+ Requirement", "All SPEC change entries"]) assert.equal(named(target, label).length, 0, `${ref}: no ${label}`);
    const toReview = hrefs(target).filter((href) => ["spec-entry", "arrange", "requirement", "requirements"].includes(addressParts(href).route));
    assert.deepEqual(toReview, [], `${ref}: no anchor leads to the review pages`);
    assert.equal(find(target, (node) => node.localName === "section" && node.className.includes("spec-waiting")).length, 0, `${ref}: no waiting section`);
  }
});

// TST-1180304 · level: release · module: MOD-trace-pages, MOD-review-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: UC-020 step 6 on the library of TST-1180301 at main with an open entry; the review pages' view
// input: every anchor of the page that leads to a route of the review pages (the address form `#route/key=value`), read with addressParts
// expect: each of them names a route the review pages serve — spec-entry for the entry and the history, arrange, requirement for each Edit, requirements for each + Requirement —, the entry's with id=spec-2026-10-09_open-01, the history's with id=history, Arrange's with kind=requirements, each with product=<the product's address> (ITM-1364); and the routes named are exactly spec-entry, arrange, requirement and requirements
// Planted fault: the history link naming a route that is no route (`reviewLink("spec-history-link", "History of SPEC changes", "spec-history", { id: "history" })`) fails the assertion that the review pages serve every route the page names.
test("TST-1180304 every link of the page leads to a route the review pages serve", async () => {
  const target = await render(WAITING, "main");
  const served = new Set(reviewPages.routes.map((each) => each.name));
  const leads = anchors(target).map((node) => ({ text: node.textContent, ...addressParts(node.getAttribute("href")) })).filter((lead) => served.has(lead.route) || ["spec-entry", "arrange", "requirement", "requirements"].includes(lead.route));
  assert.ok(leads.length > 0, "known positive: the page leads to the review pages");
  for (const lead of leads) assert.equal(served.has(lead.route), true, `${lead.text}: the review pages serve the route ${lead.route}`);
  assert.deepEqual([...new Set(leads.map((lead) => lead.route))].sort(), ["arrange", "requirement", "requirements", "spec-entry"]);
  assert.deepEqual(leads.filter((lead) => lead.text === "History of SPEC changes").map((lead) => lead.params), [{ id: "history", product: PRODUCT }]);
  assert.deepEqual(leads.filter((lead) => lead.text === "Arrange").map((lead) => lead.params), [{ kind: "requirements", product: PRODUCT }]);
  assert.deepEqual(leads.filter((lead) => lead.route === "spec-entry" && lead.text !== "History of SPEC changes").map((lead) => lead.params), [{ id: `spec-${OPEN}-01`, product: PRODUCT }]);
});
