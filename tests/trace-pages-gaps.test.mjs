// MOD-trace-pages' public route drawn for the gaps (ITM-599): the matrix of every requirement against the use cases, decisions, modules and tests that
// name it, and the gaps as coverageGaps finds them, at the version chosen — what the page says when there are none (UC-020 7a) and when the version
// holds no requirement or no artifact of a kind (7b) —, and the one graph the route builds for a version.
//
// Run: node --test tests/trace-pages-gaps.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; THE BROWSER SHOWS ANY RELEASED VERSION
// Level: component
//
// The route is called through its public Route.render with a Host/Snapshot-shaped fake that holds the files of a small product (tests/trace-pages-harness.mjs);
// it has no write method. The fixture is a product of its own: a SPEC of four requirements in two sections, three use cases, a decision, a module and a test.
// Each case states its expected texts; none is read from a document. Readings the cases take, each from the sentence quoted:
// - "every requirement against every use case, architecture decision, module and test that names it" (UC-020 7): the matrix has one row for each requirement of
//   the SPEC, in the order of the SPEC, and in each of four columns the identifiers tracesTo gives, each a link, or `none`;
// - "requirements realised by no use case, and — once they exist — named by no module or no test; use cases that realise no requirement; names in use cases,
//   modules or tests that match no requirement" (UC-020 7): five lists in this order, the second and the third drawn once the version holds a module, a test;
// - "**Gaps** says so; it does not hide" (UC-020 7a): where no list holds a line and the version holds a requirement and an artifact of every kind, the page
//   says "There are no gaps at <version>." in place of the lists, and the matrix stays;
// - "shows what exists at that commit and says what is missing" (UC-020 7b): one line for each of requirements, use cases, decisions, modules and tests that the
//   version does not hold, "No <kind> exist at <version>.", above what the version does hold.

import test from "node:test";
import assert from "node:assert/strict";
import { addressParts, doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const SPEC = [
  "# Gaps fixture — Specification", "", "## First section", "",
  "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", `*Check:* ${TICK}tests/alpha.test.mjs${TICK}`, "",
  "**BETA RULE** *(Vibe Coding)*", "Beta rule.", "*Check:* at review.", "",
  "## Second section", "",
  "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule.", "*Check:* at review.", "",
  "**DELTA RULE** *(Vibe Coding)*", "Delta rule.", "*Check:* at review.", "",
].join("\n");
const OLD_SPEC = [
  "# Gaps fixture — Specification", "", "## First section", "",
  "**ALPHA RULE** *(Vibe Coding)*", "Old alpha rule.", "*Check:* at review.", "",
  "**BETA RULE** *(Vibe Coding)*", "Old beta rule.", "*Check:* at review.", "",
  "**DELTA RULE** *(Vibe Coding)*", "Old delta rule.", "*Check:* at review.", "",
].join("\n");
const UC1 = doc("UC-001", "First use case", { realises: ["ALPHA RULE", "REMOVED RULE"] });
const UC2 = doc("UC-002", "Second use case", { realises: ["BETA RULE"] });
const UC4 = doc("UC-004", "Fourth use case", { realises: ["ORPHAN RULE"] }, "It realises nothing the SPEC holds.");
const ARC1 = doc("ARC-001", "First decision", { forced_by: ["ALPHA RULE"] });
const MODULE = doc("MOD-direct", "Direct module", { folder: "src/direct/", realises: ["ALPHA RULE", "GAMMA RULE"] });
const TEST = ["// TST-501", "// level: unit", "// module: MOD-direct", "// guards: ALPHA RULE", ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/use-cases/UC-001-first.md": UC1,
  "docs/use-cases/UC-002-second.md": UC2,
  "docs/use-cases/UC-004-fourth.md": UC4,
  "docs/architecture/ARC-001-first.md": ARC1,
  "docs/architecture/MOD-direct.md": MODULE,
  "tests/alpha.test.mjs": TEST,
};
// The tag v2026.1.0 predates the architecture and the tests: a SPEC of three requirements and one use case.
const TAGGED = { "SPEC.md": OLD_SPEC, "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }) };
// The tag v2025.0.1 predates every artifact of Agent M.
const BARE = { "README.md": "A readme and nothing else." };
const COVERED = {
  "SPEC.md": ["# Covered fixture", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", `*Check:* ${TICK}tests/alpha.test.mjs${TICK}`, ""].join("\n"),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
  "docs/architecture/ARC-001-first.md": ARC1,
  "docs/architecture/MOD-direct.md": doc("MOD-direct", "Direct module", { folder: "src/direct/", realises: ["ALPHA RULE"] }),
  "tests/alpha.test.mjs": TEST,
};
const ADDRESS = "https://github.com/acme/library";

const gapsParams = { key: "gaps", ref: "main" };
const trees = (more = {}) => ({ main: FILES, "v2026.1.0": TAGGED, "v2025.0.1": BARE, ...more });
const hostOf = (extra = {}) => treeHost({ trees: trees(), tags: ["v2026.1.0", "v2025.0.1"], ...extra });
function render(productHost, params = gapsParams, context = { product: { address: ADDRESS, host: productHost } }) {
  const target = document.createElement("div");
  document.body.append(target);
  return route.render(target, context, params).then(() => target);
}
const selectOf = (target) => find(target, (node) => node.localName === "select")[0];
const choose = (target, ref) => { const select = selectOf(target); select.value = ref; select.dispatchEvent(new Event("change")); };
const reading = (target) => find(target, (node) => node.className === "traces-reading").length;
const lists = (target) => find(target, (node) => node.localName === "section" && node.className === "gaps-list");
const titleOf = (section) => find(section, (node) => node.localName === "h3")[0].textContent;
const linesOf = (section) => find(section, (node) => node.localName === "li").map((node) => node.textContent);
const titles = (target) => lists(target).map(titleOf);
const listed = (target, title) => linesOf(lists(target).find((section) => titleOf(section) === title));
const missing = (target) => find(target, (node) => node.className === "gaps-missing").map((node) => node.textContent);
const noGaps = (target) => find(target, (node) => node.className === "no-gaps").map((node) => node.textContent);
const asOf = (target) => find(target, (node) => node.className === "version-as-of").map((node) => node.textContent);
const matrix = (target) => find(target, (node) => node.localName === "table" && node.className.includes("gaps-matrix"));
const rows = (table) => find(find(table, (node) => node.localName === "tbody")[0], (node) => node.localName === "tr")
  .map((row) => find(row, (node) => node.localName === "td").map((cell) => cell.textContent));
const hrefs = (root) => find(root, (node) => node.localName === "a").map((node) => node.getAttribute("href"));
const click = (target, text) => find(target, (node) => node.localName === "button" && node.textContent === text)[0].dispatchEvent(new Event("click"));
const NONE = ["none", "none", "none", "none"];

// CASE ITM-599-01
// TST-599001 · level: component · module: MOD-trace-pages
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, the default branch: ALPHA RULE is realised by UC-001, forces the decision ARC-001 (forced_by), is realised by MOD-direct and guarded by TST-501; BETA RULE is realised by UC-002 alone; GAMMA RULE by MOD-direct alone; DELTA RULE by nothing; UC-001 also realises REMOVED RULE and UC-004 only ORPHAN RULE, names the SPEC does not hold
// input: Route.render with the key "gaps" at main
// expect: the page is headed "Gaps"; five lists in this order — requirements realised by no use case: DELTA RULE, GAMMA RULE; named by no module: BETA RULE, DELTA RULE; named by no test: BETA RULE, DELTA RULE, GAMMA RULE; use cases that realise no requirement: "UC-004 Fourth use case"; unknown names: "ORPHAN RULE — named by UC-004", "REMOVED RULE — named by UC-001"; the matrix has the rows ALPHA RULE (UC-001, ARC-001, MOD-direct, TST-501), BETA RULE (UC-002, none, none, none), GAMMA RULE (none, none, MOD-direct, none), DELTA RULE (none in all four), the identifiers linked to #use-case/id=…, #decision/id=…, #module/id=… and #trace/key=tests/row=…; no line is reading any more; no Edit link is offered
test("the gaps page lists the gaps of the version and the matrix of every requirement against what names it", async () => {
  const productHost = hostOf();
  const target = await render(productHost);
  assert.deepEqual(find(target, (node) => node.localName === "h2").map((node) => node.textContent), ["Gaps"]);
  assert.deepEqual(titles(target), ["Requirements realised by no use case", "Requirements named by no module", "Requirements named by no test",
    "Use cases that realise no requirement", "Unknown names"]);
  assert.deepEqual(listed(target, "Requirements realised by no use case"), ["DELTA RULE", "GAMMA RULE"]);
  assert.deepEqual(listed(target, "Requirements named by no module"), ["BETA RULE", "DELTA RULE"]);
  assert.deepEqual(listed(target, "Requirements named by no test"), ["BETA RULE", "DELTA RULE", "GAMMA RULE"]);
  assert.deepEqual(listed(target, "Use cases that realise no requirement"), ["UC-004 Fourth use case"]);
  assert.deepEqual(listed(target, "Unknown names"), ["ORPHAN RULE — named by UC-004", "REMOVED RULE — named by UC-001"]);
  assert.deepEqual(hrefs(lists(target).find((section) => titleOf(section) === "Unknown names")), ["#use-case/id=UC-004", "#use-case/id=UC-001"]);
  const [table] = matrix(target);
  assert.deepEqual(find(table, (node) => node.localName === "th").map((node) => node.textContent), ["Requirement", "Use cases", "Architecture decisions", "Modules", "Tests"]);
  assert.deepEqual(rows(table), [["ALPHA RULE", "UC-001", "ARC-001", "MOD-direct", "TST-501"], ["BETA RULE", "UC-002", "none", "none", "none"],
    ["GAMMA RULE", "none", "none", "MOD-direct", "none"], ["DELTA RULE", ...NONE]]);
  assert.deepEqual(hrefs(table), ["#use-case/id=UC-001", "#decision/id=ARC-001", "#module/id=MOD-direct", "#trace/key=tests/row=TST-501",
    "#use-case/id=UC-002", "#module/id=MOD-direct"]);
  assert.equal(reading(target), 0);
  assert.equal(find(target, (node) => node.localName === "a" && /requirement-(edit|new)/.test(node.className)).length, 0);
  assert.deepEqual(asOf(target), []);
});

// CASE ITM-599-02
// TST-599002 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the fixture at main and at the tag v2026.1.0, where DELTA RULE reads "Old delta rule."; at main DELTA RULE reads "Delta rule." and UC-004's file holds "It realises nothing the SPEC holds."
// input: at main DELTA RULE is clicked in the list of requirements realised by no use case, and UC-004 in the list of use cases that realise no requirement; then v2026.1.0 is chosen and DELTA RULE clicked in its list
// expect: at main DELTA RULE opens with its four fields, "Delta rule." among them, and UC-004 with "UC-004 Fourth use case" and its file's text "It realises nothing the SPEC holds."; a second click closes each; at the tag DELTA RULE opens with "Old delta rule." and not "Delta rule.", and the page says "as of v2026.1.0"
test("a requirement or a use case in a list opens as it read in the version shown", async () => {
  const target = await render(hostOf());
  const first = () => lists(target).find((section) => titleOf(section) === "Requirements realised by no use case");
  click(first(), "DELTA RULE");
  await until(() => /Delta rule\./.test(first().textContent));
  for (const text of ["Source", "Vibe Coding", "Rule", "Delta rule.", "Check", "at review."]) assert.ok(first().textContent.includes(text), text);
  click(first(), "DELTA RULE");
  assert.equal(linesOf(first())[0], "DELTA RULE");
  assert.equal(first().textContent.includes("Delta rule."), false, "a second click closes it");
  const useCases = () => lists(target).find((section) => titleOf(section) === "Use cases that realise no requirement");
  click(useCases(), "UC-004 Fourth use case");
  await until(() => /It realises nothing the SPEC holds\./.test(useCases().textContent));
  assert.ok(useCases().textContent.includes("It realises nothing the SPEC holds."), "the file of the use case is shown");
  assert.ok(useCases().textContent.includes("UC-004 Fourth use case"));
  click(useCases(), "UC-004 Fourth use case");
  assert.equal(useCases().textContent.includes("It realises nothing"), false);

  choose(target, "v2026.1.0");
  await until(() => asOf(target).length === 1 && reading(target) === 0);
  assert.deepEqual(asOf(target), ["as of v2026.1.0"]);
  click(first(), "DELTA RULE");
  await until(() => /Old delta rule\./.test(first().textContent));
  assert.ok(first().textContent.includes("Old delta rule."), "the rule as it read at the tag is shown");
  assert.equal(first().textContent.includes("Delta rule."), false, "the rule as it read at main is not the rule at the tag");
});

// CASE ITM-599-03
// TST-599003 · level: component · module: MOD-trace-pages
// guards: UC-020; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: a product with one requirement ALPHA RULE that UC-001 realises, ARC-001 forces, MOD-direct realises and TST-501 guards; and the same product where MOD-direct realises nothing (known positive)
// input: Route.render with the key "gaps" at main for each
// expect: the first page says "There are no gaps at main." once, draws none of the lists and no line about a missing kind, and still draws the matrix with the row ALPHA RULE (UC-001, ARC-001, MOD-direct, TST-501); the second lists ALPHA RULE under "Requirements named by no module" and does not say there are no gaps
test("a version without gaps says so, and the matrix stays", async () => {
  const target = await render(treeHost({ trees: { main: COVERED } }));
  assert.deepEqual(noGaps(target), ["There are no gaps at main."]);
  assert.deepEqual(titles(target), []);
  assert.deepEqual(missing(target), []);
  assert.deepEqual(rows(matrix(target)[0]), [["ALPHA RULE", "UC-001", "ARC-001", "MOD-direct", "TST-501"]]);
  const loose = { ...COVERED, "docs/architecture/MOD-direct.md": doc("MOD-direct", "Direct module", { folder: "src/direct/" }) };
  const known = await render(treeHost({ trees: { main: loose } }));
  assert.deepEqual(noGaps(known), []);
  assert.deepEqual(listed(known, "Requirements named by no module"), ["ALPHA RULE"]);
});

// CASE ITM-599-04
// TST-599004 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the tag v2026.1.0 holds a SPEC of ALPHA RULE, BETA RULE and DELTA RULE and UC-001, which realises ALPHA RULE, and no decision, module or test; the tag v2025.0.1 holds a readme and nothing else
// input: the route rendered at main, v2026.1.0 chosen; then v2025.0.1
// expect: at v2026.1.0 the page says "No architecture decisions exist at v2026.1.0.", "No modules exist at v2026.1.0." and "No tests exist at v2026.1.0.", and not that there are no gaps; its lists are the requirements realised by no use case (BETA RULE, DELTA RULE), the use cases that realise no requirement (none) and the unknown names (none) — no list of modules or tests —; the matrix has the rows ALPHA RULE (UC-001, none, none, none), BETA RULE and DELTA RULE (none in all four). At v2025.0.1 the page says "SPEC.md holds no requirements at v2025.0.1.", then "No use cases exist …", "No architecture decisions exist …", "No modules exist …", "No tests exist …", draws no matrix and does not say there are no gaps
test("a version that predates the artifacts shows what it holds and says what is missing", async () => {
  const target = await render(hostOf());
  assert.deepEqual(missing(target), []);
  choose(target, "v2026.1.0");
  await until(() => missing(target).length === 3 && reading(target) === 0);
  assert.deepEqual(missing(target), ["No architecture decisions exist at v2026.1.0.", "No modules exist at v2026.1.0.", "No tests exist at v2026.1.0."]);
  assert.deepEqual(noGaps(target), []);
  assert.deepEqual(titles(target), ["Requirements realised by no use case", "Use cases that realise no requirement", "Unknown names"]);
  assert.deepEqual(listed(target, "Requirements realised by no use case"), ["BETA RULE", "DELTA RULE"]);
  assert.deepEqual(listed(target, "Use cases that realise no requirement"), []);
  assert.deepEqual(rows(matrix(target)[0]), [["ALPHA RULE", "UC-001", "none", "none", "none"], ["BETA RULE", ...NONE], ["DELTA RULE", ...NONE]]);
  choose(target, "v2025.0.1");
  await until(() => missing(target).length === 5 && reading(target) === 0);
  assert.deepEqual(missing(target), ["SPEC.md holds no requirements at v2025.0.1.", "No use cases exist at v2025.0.1.", "No architecture decisions exist at v2025.0.1.",
    "No modules exist at v2025.0.1.", "No tests exist at v2025.0.1."]);
  assert.equal(matrix(target).length, 0);
  assert.deepEqual(noGaps(target), []);
});

// CASE ITM-599-05
// TST-599005 · level: component · module: MOD-trace-pages
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED
// given: the fixture, whose branch trace-cache holds no graph of main at the first readOn of main (the workflow "main changed" has not run yet), and holds it later
// input: the route rendered at main; then v2026.1.0 chosen and main chosen again
// expect: the first page says "The gaps could not be read: the trace graph of <main's commit> is not stored yet …", keeps the version choice with main selected, draws no list and no matrix and reads no file for a graph (UC-001's file is not read); the choice of main after the tag draws the five lists and the matrix, since the graph that was missing is read again
test("a graph that is not stored is named in place of the gaps, the choice stays, and the next drawing reads it again", async () => {
  const productHost = hostOf({ stored: (ref, nth) => !(ref === "main" && nth === 1) });
  const target = await render(productHost);
  const problems = find(target, (node) => node.className === "traces-problem").map((node) => node.textContent);
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(`^The gaps could not be read: the trace graph of ${productHost.commitOf("main").slice(0, 12)} is not stored yet — the workflow "main changed" builds it`));
  assert.equal(productHost.log.reads.includes("docs/use-cases/UC-001-first.md"), false, "the page builds no graph");
  assert.equal(selectOf(target).value, "main");
  assert.deepEqual(titles(target), []);
  assert.equal(matrix(target).length, 0);
  choose(target, "v2026.1.0");
  await until(() => asOf(target).length === 1 && reading(target) === 0);
  choose(target, "main");
  await until(() => titles(target).length === 5);
  assert.equal(find(target, (node) => node.className === "traces-problem").length, 0);
  assert.equal(matrix(target).length, 1);
});

// CASE ITM-599-06
// TST-599006 · level: component · module: MOD-trace-pages
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED
// given: one Host, whose snapshots count every readOn, read and readMany, for main and for the tag v2026.1.0, each with its graph stored on trace-cache; the frame hands each opening of the route a context of its own
// input: the route rendered at main; rendered at main again; v2026.1.0 chosen; main chosen
// expect: the stored graph has been read once after the first rendering — ("trace-cache", "<main's commit>.json.gz") — and still once after the second; <v2026.1.0's commit>.json.gz is read once the tag is chosen, and nothing more once main is chosen again — one graph for each version; no file is read for a graph: UC-001's file is never read and readMany is never told it
test("the graph of a version is read from trace-cache once, however often the gaps are opened at it, and never built", async () => {
  const productHost = hostOf();
  const uc = "docs/use-cases/UC-001-first.md";
  const graphReads = () => productHost.log.readOns.filter(([branch]) => branch === "trace-cache").map(([, path]) => path);
  await render(productHost);
  assert.deepEqual(graphReads(), [`${productHost.commitOf("main")}.json.gz`]);
  const again = await render(productHost);
  assert.deepEqual(graphReads(), [`${productHost.commitOf("main")}.json.gz`], "the second opening at main reads no graph");
  assert.deepEqual(titles(again).length, 5, "known positive: the second opening drew the lists");
  choose(again, "v2026.1.0");
  await until(() => asOf(again).length === 1 && reading(again) === 0);
  assert.deepEqual(graphReads(), [`${productHost.commitOf("main")}.json.gz`, `${productHost.commitOf("v2026.1.0")}.json.gz`]);
  choose(again, "main");
  await until(() => titles(again).length === 5);
  assert.deepEqual(graphReads(), [`${productHost.commitOf("main")}.json.gz`, `${productHost.commitOf("v2026.1.0")}.json.gz`]);
  assert.equal(productHost.log.reads.includes(uc), false, "the page builds no graph");
  assert.equal(productHost.log.manys.some((paths) => paths.includes(uc)), false, "the page names no file of a graph to readMany");
});

// CASE ITM-599-07
// TST-599007 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT; THE BROWSER SHOWS ANY RELEASED VERSION
// given: one Host for main and the tag v2026.1.0; the specification view drawn at main and ALPHA RULE opened
// input: v2026.1.0 chosen and ALPHA RULE opened; main chosen and ALPHA RULE opened again; then the gaps drawn at main with the same Host
// expect: the reads of the stored graph — readOn on trace-cache — are one after the first opening, two after the tag's, and still two after the second opening at main and after the gaps — the graph of a version is the same for the two pages; the calls of readMany that name docs/sources.md are the register's batch, one for each of the three drawings an opening was made in
test("the specification and the gaps share the graph of a version", async () => {
  const productHost = hostOf();
  const graphReads = () => productHost.log.readOns.filter(([branch]) => branch === "trace-cache").length;
  const registerManys = () => productHost.log.manys.filter((paths) => paths.includes("docs/sources.md")).length;
  const target = await render(productHost, { key: "specification", ref: "main" });
  const open = async (name) => {
    const button = find(target, (node) => node.localName === "button" && node.textContent === name)[0];
    button.dispatchEvent(new Event("click"));
    const row = button.parentNode.parentNode.nextSibling;
    await until(() => find(row, (node) => node.className === "traces-reading").length === 0);
    return row;
  };
  await open("ALPHA RULE");
  assert.equal(graphReads(), 1);
  choose(target, "v2026.1.0");
  await until(() => asOf(target).length === 1);
  await open("ALPHA RULE");
  assert.equal(graphReads(), 2);
  choose(target, "main");
  await until(() => find(target, (node) => node.localName === "button" && node.textContent === "GAMMA RULE").length === 1);
  await open("ALPHA RULE");
  assert.equal(graphReads(), 2, "the graph of main was kept");
  assert.equal(registerManys(), 3, "known positive: each of the three drawings named the register to readMany once, in its first opening");
  const gaps = await render(productHost);
  assert.equal(titles(gaps).length, 5, "known positive: the gaps were drawn");
  assert.equal(graphReads(), 2, "the gaps use the graph the specification read");
});

// CASE ITM-599-08
// TST-599008 · level: component · module: MOD-trace-pages
// guards: UC-020; UC-049
// given: the gaps drawn at main for the product https://github.com/acme/library
// input: route.subject for the key "gaps" at main, with the context the route was drawn with
// expect: no kind of its own (the bar runs converse on every page), no draft route, title "Gaps", a key holding key=gaps and ref=main, and a page text holding "Gaps", the address, "Version: main" and the list title "Requirements realised by no use case"
test("the subject of the gaps page is the page, titled Gaps", async () => {
  const context = { product: { address: ADDRESS, host: hostOf() } };
  await render(context.product.host, gapsParams, context);
  const subject = route.subject(gapsParams, context);
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.draftRoute, null);
  assert.equal(subject.title, "Gaps");
  assert.ok(subject.key.includes("key=gaps") && subject.key.includes("ref=main"), subject.key);
  const page = subject.paramsFor({}).page;
  for (const part of ["Gaps", ADDRESS, "Version: main", "Requirements realised by no use case"]) assert.ok(page.includes(part), part);
});

// CASE ITM-599-09
// TST-599009 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture Host
// input: the route rendered with the key "timeline", a view the route does not draw
// expect: the page says "No current requirements are recorded in SPEC.md." and the Host is asked for no snapshot
test("a view the route does not draw reads nothing and says so", async () => {
  const productHost = hostOf();
  const target = await render(productHost, { key: "timeline", ref: "main" });
  assert.equal(target.textContent, "No current requirements are recorded in SPEC.md.");
  assert.deepEqual(productHost.log.snapshots, []);
});

// The way between the specification and the gaps (ITM-668): the gaps view leads back to the specification "the same way", an anchor in the frame's address form beside the version
// choice, `#trace/key=specification/ref=<the ref shown, encoded>`; the specification's Gaps link is `#trace/key=gaps/ref=<the ref shown, encoded>`.
const linksOf = (target, className) => find(target, (node) => node.localName === "a" && node.className.split(/\s+/).includes(className));

// CASE ITM-668-06
// TST-668006 · level: component · module: MOD-trace-pages
// guards: UC-020
// given: the fixture product at main, the default branch, and the tag v2026.1.0
// input: the gaps rendered at main; v2026.1.0 chosen
// expect: at main one link back, text "Specification", href "#trace/key=specification/ref=main", and no Gaps link; after the choice the one link back has the href "#trace/key=specification/ref=v2026.1.0"
test("the gaps view leads back to the specification at the version it shows", async () => {
  const target = await render(hostOf());
  assert.deepEqual(linksOf(target, "trace-specification-link").map((node) => [node.textContent, node.getAttribute("href")]), [["Specification", "#trace/key=specification/ref=main"]]);
  assert.equal(linksOf(target, "trace-gaps-link").length, 0);
  choose(target, "v2026.1.0");
  await until(() => asOf(target).length === 1 && reading(target) === 0);
  assert.deepEqual(linksOf(target, "trace-specification-link").map((node) => node.getAttribute("href")), ["#trace/key=specification/ref=v2026.1.0"]);
});

// CASE ITM-668-07
// TST-668007 · level: component · module: MOD-trace-pages
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED
// given: a Host whose main holds a SPEC of one requirement ALPHA RULE and the use case UC-001 realising it, and counts every snapshot, read and readMany
// input: the specification rendered at main; then the address of its Gaps link followed, as the frame does: the route "trace" rendered with the key and the ref the link names, with the same Host
// expect: after the specification: snapshots [main], reads [SPEC.md, the group file docs/groups/requirements.md], no readMany and no readOn (the file holds no group, so no count asks for the graph). After following the link: snapshots [main, main], reads [SPEC.md, the group file, SPEC.md], no readMany and one readOn of ("trace-cache", "<main's commit>.json.gz") — the gaps alone read SPEC.md once and the stored graph once, and build no graph, so the specification and the link added the specification's own snapshot and read and nothing else
test("showing the link reads nothing, and following it adds only the stored graph the gaps view reads itself", async () => {
  const UC_FILE = "docs/use-cases/UC-001-first.md";
  const files = {
    "SPEC.md": ["# F", "", "## S", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n"),
    [UC_FILE]: doc("UC-001", "First", { realises: ["ALPHA RULE"] }),
  };
  const productHost = treeHost({ trees: { main: files } });
  const context = { product: { address: ADDRESS, host: productHost } };
  const target = await render(productHost, { key: "specification", ref: "main" }, context);
  assert.deepEqual([productHost.log.snapshots, productHost.log.reads, productHost.log.manys, productHost.log.readOns], [["main"], ["SPEC.md", "docs/groups/requirements.md"], [], []]);
  const link = linksOf(target, "trace-gaps-link");
  assert.equal(link.length, 1, "known positive: the Gaps link is there");
  const { route: name, params } = addressParts(link[0].getAttribute("href"));
  assert.equal(name, "trace");
  const followed = await render(productHost, params, context);
  assert.deepEqual(titles(followed), ["Requirements realised by no use case", "Use cases that realise no requirement", "Unknown names"], "known positive: the gaps were drawn, without the lists of the kinds this version lacks");
  assert.deepEqual([productHost.log.snapshots, productHost.log.reads, productHost.log.manys, productHost.log.readOns],
    [["main", "main"], ["SPEC.md", "docs/groups/requirements.md", "SPEC.md"], [], [["trace-cache", `${productHost.commitOf("main")}.json.gz`]]]);
});
