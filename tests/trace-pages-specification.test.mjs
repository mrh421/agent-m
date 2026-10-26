// MOD-trace-pages' public specification route — the SPEC overview of ITM-277, the version choice above it (ITM-594), and what an opened
// requirement shows beside its four fields: what traces to it and its open proposals, each linked (ITM-597).
//
// Run: node --test tests/trace-pages-specification.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020; A REQUIREMENT HAS FOUR FIELDS; THE BROWSER SHOWS ANY RELEASED VERSION; A REQUIREMENT SHOWS WHAT TRACES TO IT
// Level: unit
//
// This test calls the public trace/specification Route.render with a Host/Snapshot-shaped fake (the DOM and the fixtures are those of
// tests/trace-pages-harness.mjs). The fixture has two
// sections and a requirement before every section, and a group file that arranges the requirements of the two sections in two groups (ITM-595). The fake has no write method, so rendering has no write path.
// Readings the version-choice cases take: the ref the caller hands is "current" when the Host names it the default branch, else it is
// offered under its own name; the tags are those listTags gives, newest first by their vYYYY.MINOR.PATCH numbers, a tag of another form
// after them; a Host whose listTags fails offers no tag and says so as a failed read, never as a product without a release (ITM-658); any ref that is not the default branch is read-only and the view says "as of" it.
// A failed read is named by what failed, followed by MOD-site-frame's readProblem of the failure with the context's tokenStored (ITM-658): a failure that is no Host's reads "This page could not be drawn: <message>".

import test from "node:test";
import assert from "node:assert/strict";
import { addressParts, blobOf, doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = `# Fixture — Specification

**OUTSIDE REQUIREMENT** *(Source outside)*
Outside rule.
*Check:* at review.

## First section

**FIRST REQUIREMENT** *(Source one)*
First rule.
*Check:* \`tests/first.test.mjs\`

## Second section

**SECOND REQUIREMENT** *(Source two)*
Second <img src=x onerror=alert(1)> rule.
*Check:* \`tests/second.test.mjs\`
`;

// tags: what listTags names; specs: the SPEC at a ref, where it differs; defaultBranch: what repositoryInfo names (null: no repositoryInfo);
// gates: a promise a ref's snapshot waits for; unreadable: refs whose snapshot cannot be read; tagsFail: listTags fails; groups: the text of docs/groups/requirements.md.
const GROUPS = "- First group\n  - FIRST REQUIREMENT\n- Second group\n  - SECOND REQUIREMENT\n";
function host(text = SPEC, { tags = [], specs = {}, defaultBranch = null, gates = {}, unreadable = [], tagsFail = false, groups = GROUPS } = {}) {
  const calls = [];
  const fake = {
    calls,
    async readSnapshot(ref) {
      calls.push(ref);
      await gates[ref];
      if (unreadable.includes(ref)) throw Object.assign(new Error("unreachable"), { name: "Unreachable" });
      const at = specs[ref] ?? text;
      return { ref, commit: ref, paths: at === null ? [] : ["SPEC.md", "docs/groups/requirements.md"],
        read: async (path) => path === "SPEC.md" ? at : path === "docs/groups/requirements.md" && at !== null ? groups : null, blob: () => null };
    },
    async listTags() { if (tagsFail) throw new Error("tags unavailable"); return tags.map((name) => ({ name, commit: `commit-of-${name}` })); },
  };
  if (defaultBranch !== null) fake.repositoryInfo = async () => ({ defaultBranch, visibility: "public", canWrite: false, archived: false, description: "" });
  return fake;
}
function render(productHost, params = { key: "specification", ref: "pinned-commit" }) { const target = document.createElement("div"); document.body.append(target); return route.render(target, { product: { host: productHost } }, params).then(() => target); }

// CASE ITM-277-01
// TST-473163 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: a public trace Route and a Host whose pinned snapshot has one requirement before the sections and two sections, and a group file with two groups, each naming one requirement of a section
// input: Route.render(target, { product: { host } }, { key: "specification", ref: "pinned-commit" })
// expect: the Host receives exactly that ref; current requirement names appear once, the one no group names first, then within their groups in the order of the group file; the groups' titles are the headings
test("the public trace/specification route reads the pinned SPEC and lists each requirement in file order", async () => {
  assert.ok(route, "the public trace route is exposed");
  const productHost = host();
  const target = await render(productHost);
  assert.deepEqual(productHost.calls, ["pinned-commit"]);
  const names = find(target, (node) => node.localName === "button" && node.className.includes("requirement-name"));
  assert.deepEqual(names.map((node) => node.textContent), ["OUTSIDE REQUIREMENT", "FIRST REQUIREMENT", "SECOND REQUIREMENT"]);
  assert.equal(new Set(names.map((node) => node.textContent)).size, 3);
  const visible = target.textContent;
  assert.ok(visible.indexOf("OUTSIDE REQUIREMENT") < visible.indexOf("First group"));
  assert.ok(visible.indexOf("First group") < visible.indexOf("FIRST REQUIREMENT"));
  assert.ok(visible.indexOf("FIRST REQUIREMENT") < visible.indexOf("Second group"));
  assert.deepEqual(find(target, (node) => node.localName === "button" && node.className.includes("spec-group-toggle")).map((node) => node.textContent), ["First group", "Second group"]);
  assert.doesNotMatch(visible, /First section|Second section/, "the SPEC's sections are not the tree");
});

// CASE ITM-277-02
// TST-473164 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: the rendered overview and an unsafe HTML image in SECOND REQUIREMENT's rule (known positive: SPEC contains both `<img` and `onerror`)
// input: a click on SECOND REQUIREMENT's displayed name
// expect: its name, source, rule and check are readable in the detail, no image node is created, and no route/navigation context is needed
test("selecting a requirement renders its four fields safely without navigating to a queue", async () => {
  assert.match(SPEC, /<img[^>]+onerror=/, "known positive: the fixture has unsafe HTML");
  const target = await render(host());
  const name = find(target, (node) => node.localName === "button" && node.textContent === "SECOND REQUIREMENT")[0];
  name.dispatchEvent(new Event("click"));
  const opened = name.parentNode.parentNode.nextSibling;
  for (const text of ["SECOND REQUIREMENT", "Source", "Source two", "Rule", "Second <img src=x onerror=alert(1)> rule.", "Check", "tests/second.test.mjs"]) {
    assert.match(opened.textContent, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(find(opened, (node) => node.localName === "img").length, 0);
  assert.equal(find(opened, (node) => node.localName === "a" && node.getAttribute("href")?.includes("queue")).length, 0);
});

// CASE ITM-278-01
// TST-473165 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: the public trace/specification route with two requirements in groups and one that no group names
// input: a fresh render, then each readable group-heading control is clicked to open, close and reopen its own list
// expect: group lists start hidden, each toggle changes only its own list, and the requirement no group names stays reachable at the top level
test("group headings start collapsed and independently toggle their requirement lists", async () => {
  const target = await render(host());
  const sections = find(target, (node) => node.localName === "section" && node.className.includes("spec-group"));
  const toggles = sections.map((section) => find(section, (node) => node.localName === "button" && node.className.includes("spec-group-toggle"))[0]);
  const tables = sections.map((section) => find(section, (node) => node.localName === "div" && node.className.includes("spec-group-body"))[0]);
  assert.deepEqual(toggles.map((toggle) => toggle?.textContent), ["First group", "Second group"]);
  assert.ok(tables.every((table) => table.getAttribute("hidden") === "hidden"), "a fresh render hides every group list");
  assert.ok(find(target, (node) => node.localName === "button" && node.textContent === "OUTSIDE REQUIREMENT").length === 1,
    "the requirement no group names remains reachable");
  toggles[0].dispatchEvent(new Event("click"));
  assert.equal(tables[0].getAttribute("hidden"), null, "the first heading opens its own list");
  assert.equal(tables[1].getAttribute("hidden"), "hidden", "the second list stays collapsed");
  toggles[0].dispatchEvent(new Event("click"));
  assert.equal(tables[0].getAttribute("hidden"), "hidden", "the same heading closes its list");
  toggles[0].dispatchEvent(new Event("click"));
  assert.equal(tables[0].getAttribute("hidden"), null, "the same heading reopens its list");
});

// CASE ITM-278-02
// TST-473166 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: a displayed current requirement in a row-local closed detail
// input: click its existing requirement-name button three times
// expect: the first click opens readable four fields, the second closes them, and the third reopens them without changing another section
test("a requirement name toggles its row-local detail closed and open again", async () => {
  const target = await render(host());
  const name = find(target, (node) => node.localName === "button" && node.textContent === "FIRST REQUIREMENT")[0];
  const opened = name.parentNode.parentNode.nextSibling;
  assert.equal(opened.textContent, "", "the row-local detail starts closed");
  name.dispatchEvent(new Event("click"));
  for (const text of ["FIRST REQUIREMENT", "Source", "Source one", "Rule", "First rule.", "Check", "tests/first.test.mjs"]) {
    assert.match(opened.textContent, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the first click opens the readable fields");
  }
  name.dispatchEvent(new Event("click"));
  assert.equal(opened.textContent, "", "the second click closes that detail");
  name.dispatchEvent(new Event("click"));
  assert.match(opened.textContent, /FIRST REQUIREMENT/, "the third click reopens the same detail");
});

// CASE ITM-277-03
// TST-473167 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: a Host whose pinned snapshot has no SPEC.md, no tags, and no default branch it can name
// input: the same public specification route
// expect: the version choice offers only the handed ref (UC-020 1c), the Gaps link follows it, and the bar says "as of" the ref; the page then states that the current requirements are empty; no write operation is called
test("an absent or empty SPEC has an explicit empty state and rendering offers no write", async () => {
  const productHost = host(null);
  const target = await render(productHost, { key: "specification", ref: "pinned-empty" });
  // The folded explanation of the versions (ITM-602) stands in the bar beside the choice; what is shown besides it is as before.
  const shown = find(target, (node) => node.localName === "details").reduce((text, fold) => text.replace(fold.textContent, ""), target.textContent);
  assert.equal(shown, "Version pinned-emptyGapsNo release is tagged yet (UC-013); only the current text can be shown.as of pinned-emptyCurrent requirementsNo current requirements are recorded in SPEC.md.");
  assert.equal(Object.hasOwn(productHost, "commitFiles"), false);
});

// The version choice (ITM-594). The Host names main the default branch; main has the SPEC above, the tag v2026.1.0 an older one.
const OLD_SPEC = `# Fixture — Specification

## Old section

**OLD REQUIREMENT** *(Source old)*
Old rule.
*Check:* \`tests/old.test.mjs\`
`;
// The choices of the version, not those of the filters that narrow the tree (ITM-596).
const options = (target) => find(target, (node) => node.localName === "select" && node.className.includes("version-choice")).flatMap((select) => find(select, (node) => node.localName === "option"));
const selectOf = (target) => find(target, (node) => node.localName === "select")[0];
const names = (target) => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name")).map((node) => node.textContent);
const choose = (target, ref) => { const select = selectOf(target); select.value = ref; select.dispatchEvent(new Event("change")); };
const editLinks = (target) => find(target, (node) => node.localName === "a" && /requirement-(edit|new)/.test(node.className));
const asOf = (target) => find(target, (node) => node.localName === "p" && node.className === "version-as-of").map((node) => node.textContent);
const tagged = (extra = {}) => host(SPEC, { defaultBranch: "main", tags: ["v2026.1.0"], specs: { "v2026.1.0": OLD_SPEC }, ...extra });
const mainParams = { key: "specification", ref: "main" };
const CURRENT_NAMES = ["OUTSIDE REQUIREMENT", "FIRST REQUIREMENT", "SECOND REQUIREMENT"];

// CASE ITM-594-01
// TST-594000 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: a Host that names main the default branch and gives the tags v2026.1.9, v2026.10.0, nightly, v2026.2.0, v2025.12.3 in that order
// input: the route rendered at main
// expect: the options are, in this order, main (shown as "current"), v2026.10.0, v2026.2.0, v2026.1.9, v2025.12.3, nightly (shown by their names); main is selected; no "as of" line
test("the version choice offers the default branch as current and every tag, newest first by number", async () => {
  const target = await render(host(SPEC, { defaultBranch: "main", tags: ["v2026.1.9", "v2026.10.0", "nightly", "v2026.2.0", "v2025.12.3"] }), mainParams);
  assert.deepEqual(options(target).map((node) => node.value), ["main", "v2026.10.0", "v2026.2.0", "v2026.1.9", "v2025.12.3", "nightly"]);
  assert.deepEqual(options(target).map((node) => node.textContent), ["current", "v2026.10.0", "v2026.2.0", "v2026.1.9", "v2025.12.3", "nightly"]);
  assert.equal(selectOf(target).value, "main");
  assert.deepEqual(asOf(target), []);
});

// CASE ITM-594-02
// TST-594001 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: a Host that names main the default branch and gives no tag; and one whose listTags fails
// input: the route rendered at main with each
// expect: for each, the only option is main shown as "current"; the first says that no release is tagged yet and points to UC-013; the second never says so but names the failed read, "The tags could not be read: This page could not be drawn: tags unavailable"
test("a product without tags is offered only current, with a pointer to UC-013; a failed listTags is named, never read as no release", async () => {
  const none = await render(host(SPEC, { defaultBranch: "main" }), mainParams);
  assert.deepEqual(options(none).map((node) => [node.value, node.textContent]), [["main", "current"]]);
  assert.deepEqual(find(none, (node) => node.localName === "p" && node.className === "version-none").map((node) => node.textContent),
    ["No release is tagged yet (UC-013); only the current text can be shown."]);
  const failed = await render(host(SPEC, { defaultBranch: "main", tagsFail: true }), mainParams);
  assert.deepEqual(options(failed).map((node) => [node.value, node.textContent]), [["main", "current"]]);
  assert.deepEqual(find(failed, (node) => node.className === "version-none").map((node) => node.textContent), []);
  assert.doesNotMatch(failed.textContent, /No release is tagged yet/);
  assert.deepEqual(find(failed, (node) => node.className === "traces-problem").map((node) => node.textContent),
    ["The tags could not be read: This page could not be drawn: tags unavailable"]);
});

// CASE ITM-594-03
// TST-594002 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: main has OUTSIDE, FIRST and SECOND REQUIREMENT and is the default branch; the tag v2026.1.0 has OLD REQUIREMENT only
// input: the route rendered at main, then v2026.1.0 chosen
// expect: at main three Edit links, two + Requirement links and no "as of"; readSnapshot is then asked main, v2026.1.0 and nothing else; the tree lists only OLD REQUIREMENT; v2026.1.0 is selected; the view says "as of v2026.1.0"; no Edit and no + Requirement link
test("choosing a tag draws the SPEC of that tag, read-only and as of it", async () => {
  const productHost = tagged();
  const target = await render(productHost, mainParams);
  assert.deepEqual(names(target), CURRENT_NAMES);
  assert.equal(editLinks(target).filter((node) => node.className.includes("requirement-edit")).length, 3);
  assert.equal(editLinks(target).filter((node) => node.className.includes("requirement-new")).length, 2);
  assert.deepEqual(asOf(target), []);
  choose(target, "v2026.1.0");
  await until(() => names(target)[0] === "OLD REQUIREMENT");
  assert.deepEqual(productHost.calls, ["main", "v2026.1.0"]);
  assert.deepEqual(names(target), ["OLD REQUIREMENT"]);
  assert.equal(selectOf(target).value, "v2026.1.0");
  assert.deepEqual(asOf(target), ["as of v2026.1.0"]);
  assert.deepEqual(editLinks(target), []);
});

// CASE ITM-594-04
// TST-594003 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the route rendered at main and the tag v2026.1.0 chosen
// input: main chosen again
// expect: readSnapshot is asked main, v2026.1.0, main; the three current requirements are listed with five Edit and + Requirement links; main is selected; no "as of" line
test("choosing current again draws the default branch editable", async () => {
  const productHost = tagged();
  const target = await render(productHost, mainParams);
  choose(target, "v2026.1.0");
  await until(() => names(target)[0] === "OLD REQUIREMENT");
  choose(target, "main");
  await until(() => names(target).length === 3);
  assert.deepEqual(productHost.calls, ["main", "v2026.1.0", "main"]);
  assert.equal(selectOf(target).value, "main");
  assert.equal(editLinks(target).length, 5);
  assert.deepEqual(asOf(target), []);
});

// CASE ITM-594-05
// TST-594004 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the route rendered at main (the params keep ref main), v2026.1.0 chosen, OLD REQUIREMENT opened
// input: route.subject(params, context) with the context the route was drawn with
// expect: no kind of its own (the bar runs converse on every page), no draft route, title "OLD REQUIREMENT at v2026.1.0", a key holding ref=v2026.1.0, and a page text holding "Version: v2026.1.0" and "Old rule."
test("the subject of a chosen tag is about the version shown, not the ref the caller handed", async () => {
  const context = { product: { address: "https://github.com/acme/library", host: tagged() } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, mainParams);
  choose(target, "v2026.1.0");
  await until(() => names(target)[0] === "OLD REQUIREMENT");
  find(target, (node) => node.localName === "button" && node.textContent === "OLD REQUIREMENT")[0].dispatchEvent(new Event("click"));
  const subject = route.subject(mainParams, context);
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.draftRoute, null);
  assert.equal(subject.title, "OLD REQUIREMENT at v2026.1.0");
  assert.ok(subject.key.includes("ref=v2026.1.0"), subject.key);
  const page = subject.paramsFor({}).page;
  assert.ok(page.includes("Version: v2026.1.0") && page.includes("Old rule."), page);
});

// CASE ITM-594-06
// TST-594005 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: a Host that gives the tags v2026.1.0 and v2026.0.1 and cannot read the snapshot of v2026.0.1
// input: the route rendered at main, v2026.0.1 chosen, then v2026.1.0
// expect: after the first choice the page says "v2026.0.1 could not be read: This page could not be drawn: unreachable" (readProblem's element follows what failed), lists no requirement and keeps the choice with v2026.0.1 selected; after the second it lists OLD REQUIREMENT and no problem line
test("a chosen tag that cannot be read is named in place of the tree and the choice stays", async () => {
  const problems = (target) => find(target, (node) => node.className === "version-problem").map((node) => node.textContent);
  const target = await render(tagged({ tags: ["v2026.1.0", "v2026.0.1"], unreadable: ["v2026.0.1"] }), mainParams);
  choose(target, "v2026.0.1");
  await until(() => problems(target).length === 1);
  assert.deepEqual(problems(target), ["v2026.0.1 could not be read: This page could not be drawn: unreachable"]);
  assert.deepEqual(names(target), []);
  assert.equal(selectOf(target).value, "v2026.0.1");
  choose(target, "v2026.1.0");
  await until(() => names(target)[0] === "OLD REQUIREMENT");
  assert.deepEqual(problems(target), []);
});

// CASE ITM-594-07
// TST-594006 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: a Host whose snapshot of v2026.1.0 waits for a gate that opens later
// input: v2026.1.0 chosen, then main chosen before the gate opens; then the gate opens and 50 ms of the clock pass
// expect: the page shows main's three requirements with main selected and no "as of" line; the slower, earlier choice does not replace it
test("of two choices made in a row, the later one stays when the earlier answers last", async () => {
  let open;
  const gate = new Promise((resolve) => { open = resolve; });
  const productHost = tagged({ gates: { "v2026.1.0": gate } });
  const target = await render(productHost, mainParams);
  choose(target, "v2026.1.0");
  await until(() => productHost.calls.length === 2);
  choose(target, "main");
  await until(() => names(target).length === 3);
  open();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(names(target), CURRENT_NAMES);
  assert.equal(selectOf(target).value, "main");
  assert.deepEqual(asOf(target), []);
});

// ---------------------------------------------------------------- what traces to an opened requirement, and its open proposals (ITM-597)
//
// The fixture is a small product of its own: a SPEC of three requirements in two sections; three use cases that name ALPHA RULE and one
// that realises a name the SPEC no longer has; a decision and two modules; a test; the product's links file and the register entry of the one
// source it links; and three queues of change entries, which this view does not read. The expected texts are
// written in each case; none is read from a document. Readings the cases take, each from the sentence quoted:
// - "lists its sources and every use case, architecture element, module and test that names it" (A REQUIREMENT SHOWS WHAT TRACES TO IT): the
//   lists are the sources the product links with version and part, the use cases with their review status, the decisions, modules and tests;
// - the open proposals and the note of 5c are not part of this view yet (ITM-648).
const TICK = "`";
const TRACE_SPEC = [
  "# Fixture — Specification", "", "## First section", "",
  "**ALPHA RULE** *(Vibe Coding, ch. 9; Unlinked Source)*", "Alpha rule.", `*Check:* ${TICK}tests/alpha.test.mjs${TICK}`, "",
  "**BETA RULE** *(Vibe Coding)*", "Beta rule.", "*Check:* at review.", "",
  "## Second section", "",
  "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule.", "*Check:* at review.", "",
].join("\n");
const UC1 = doc("UC-001", "First use case", { realises: ["ALPHA RULE", "REMOVED RULE"] });
const UC3 = doc("UC-003", "Third use case", { realises: ["ALPHA RULE"] });
const REGISTER_ENTRY = [
  "---", "id: SRC-vibe-coding", "title: Vibe Coding", "kind: document", "authority: normative", "licence: may be republished — CC BY 4.0", "---",
  "# SRC-vibe-coding Vibe Coding", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| ${TICK}2026-10-05${TICK} | 2026-10-05 | the manuscript | a repository | none |`, "",
].join("\n");
const LINKS = ["# Sources of the fixture", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-vibe-coding | 2026-10-05 | ${"a".repeat(64)} | ch. 9 |`, ""].join("\n");
const firstSection = (alpha, withBeta) => ["## First section", "", "**ALPHA RULE** *(Vibe Coding, ch. 9; Unlinked Source)*", alpha, `*Check:* ${TICK}tests/alpha.test.mjs${TICK}`, "",
  ...(withBeta ? ["**BETA RULE** *(Vibe Coding)*", "Beta rule.", "*Check:* at review.", ""] : [])].join("\n");
// The files of one queue with one entry: its index, its decisions (a row when the entry is decided), the entry and the section it proposes.
function queue(folder, title, anchor, proposal, decided = false, target = "SPEC.md") {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${title}`, "", `**Zieldatei aller Einträge:** ${TICK}${target}${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}${target}${TICK} | ${anchor} | — | — |`, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)} ${title}`, "", "Append-only.", "", ...(decided ? [`| 2026-10-08 10:00 UTC | 1 | uebernommen | ${"c".repeat(40)} |`] : []), ""].join("\n"),
    [`${base}/01-entry.md`]: proposal,
  };
}
const TRACE_FILES = {
  "SPEC.md": TRACE_SPEC,
  "docs/sources.md": LINKS,
  "docs/sources/SRC-vibe-coding.md": REGISTER_ENTRY,
  "docs/use-cases/UC-001-first.md": UC1,
  [`docs/approvals/UC-001-${blobOf(UC1).slice(0, 12)}.md`]: "record of the text UC-001 has now",
  "docs/use-cases/UC-002-second.md": doc("UC-002", "Second use case", { realises: ["BETA RULE"] }, `It also touches ${TICK}ALPHA RULE${TICK}.`),
  "docs/use-cases/UC-003-third.md": UC3,
  "docs/approvals/UC-003-000000000000.md": "record of an earlier text of UC-003",
  "docs/use-cases/UC-004-fourth.md": doc("UC-004", "Fourth use case", { realises: ["ORPHAN RULE"] }),
  "docs/architecture/ARC-001-first.md": doc("ARC-001", "First decision", { forced_by: ["ALPHA RULE"] }),
  "docs/architecture/MOD-direct.md": doc("MOD-direct", "Direct module", { folder: "src/direct/", realises: ["ALPHA RULE"] }),
  "docs/architecture/MOD-tested.md": doc("MOD-tested", "Tested module", { folder: "src/tested/", realises: ["BETA RULE"] }),
  "tests/alpha.test.mjs": ["// TST-501", "// level: unit", "// module: MOD-tested", "// guards: ALPHA RULE", ""].join("\n"),
  ...queue("2026-10-09_alpha", "alpha", "## First section", firstSection("Alpha rule, changed.", false)),
  ...queue("2026-10-09b_alpha-again", "alpha again", "## First section", firstSection("Alpha rule, again.", true)),
  ...queue("2026-10-08_done", "done", "## Second section", ["## Second section", "", "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule, changed.", "*Check:* at review.", ""].join("\n"), true),
};

const mainOnly = (files = TRACE_FILES) => treeHost({ trees: { main: files } });

// Opens a requirement by its name and waits, by the clock, until what traces to it is drawn. -> the row that holds its detail
async function openRequirement(target, name) {
  const button = find(target, (node) => node.localName === "button" && node.textContent === name)[0];
  button.dispatchEvent(new Event("click"));
  const row = button.parentNode.parentNode.nextSibling;
  await until(() => find(row, (node) => node.className === "traces-reading").length === 0);
  return row;
}
const traceSection = (row, title) => find(row, (node) => node.localName === "section" && node.className === "requirement-trace"
  && find(node, (kid) => kid.localName === "h4")[0].textContent === title)[0];
const listed = (row, title) => find(traceSection(row, title), (node) => node.localName === "li").map((node) => node.textContent);
const linksOf = (row, title) => find(traceSection(row, title), (node) => node.localName === "a").map((node) => node.getAttribute("href"));
const inFold = (node) => { for (let up = node.parentNode; up; up = up.parentNode) if (up.localName === "details") return true; return false; };
const paragraphs = (row, title) => find(traceSection(row, title), (node) => node.localName === "p" && !inFold(node)).map((node) => `${node.className}: ${node.textContent}`);

// CASE ITM-597-01
// TST-597001 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture product, whose links file links SRC-vibe-coding at version 2026-10-05 with the part ch. 9; ALPHA RULE names the item "Vibe Coding, ch. 9" and "Unlinked Source", BETA RULE "Vibe Coding"
// input: the route rendered at main, ALPHA RULE opened, then BETA RULE
// expect: ALPHA RULE's Sources are "Vibe Coding — version 2026-10-05, part ch. 9", linked to #library/source=SRC-vibe-coding, and "Unlinked Source — no linked version", not linked; BETA RULE's the first of these alone; the four fields stay in the detail
test("an opened requirement lists its sources with the version and the part the product links, the linked ones as links", async () => {
  const target = await render(mainOnly(), mainParams);
  const alpha = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(listed(alpha, "Sources"), ["Vibe Coding — version 2026-10-05, part ch. 9", "Unlinked Source — no linked version"]);
  assert.deepEqual(linksOf(alpha, "Sources"), ["#library/source=SRC-vibe-coding"]);
  assert.match(alpha.textContent, /Alpha rule\./);
  const beta = await openRequirement(target, "BETA RULE");
  assert.deepEqual(listed(beta, "Sources"), ["Vibe Coding — version 2026-10-05, part ch. 9"]);
});

// CASE ITM-597-02
// TST-597002 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture product: UC-001 has an approval record naming its current text, UC-002 none, UC-003 only a record of an earlier text; UC-001 and UC-003 realise ALPHA RULE, UC-002 names it in its text
// input: ALPHA RULE opened on the default branch
// expect: Use cases lists UC-001 "accepted", UC-002 "open", UC-003 "changed since acceptance", each as its title and status, linked to #use-case/id=<id>
test("an opened requirement lists the use cases that name it with their review status, each linked", async () => {
  const row = await openRequirement(await render(mainOnly(), mainParams), "ALPHA RULE");
  assert.deepEqual(listed(row, "Use cases"), ["UC-001 First use case — accepted", "UC-002 Second use case — open", "UC-003 Third use case — changed since acceptance"]);
  assert.deepEqual(linksOf(row, "Use cases"), ["#use-case/id=UC-001", "#use-case/id=UC-002", "#use-case/id=UC-003"]);
});

// CASE ITM-597-03
// TST-597003 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture product: ARC-001 is forced by ALPHA RULE, MOD-direct realises it, MOD-tested is exercised by TST-501, which guards it
// input: ALPHA RULE opened, then BETA RULE, which MOD-tested realises and no decision or test names
// expect: ALPHA RULE — decisions ARC-001 linked to #decision/id=ARC-001; modules MOD-direct and MOD-tested linked to #module/id=<id>; tests TST-501 linked to #trace/key=tests/row=TST-501. BETA RULE — decisions "none", modules MOD-tested, tests "none"
test("an opened requirement lists the decisions, modules and tests that name it, each linked, and none where nothing does", async () => {
  const target = await render(mainOnly(), mainParams);
  const alpha = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(listed(alpha, "Architecture decisions"), ["ARC-001 First decision"]);
  assert.deepEqual(linksOf(alpha, "Architecture decisions"), ["#decision/id=ARC-001"]);
  assert.deepEqual(listed(alpha, "Modules"), ["MOD-direct Direct module", "MOD-tested Tested module"]);
  assert.deepEqual(linksOf(alpha, "Modules"), ["#module/id=MOD-direct", "#module/id=MOD-tested"]);
  assert.deepEqual(listed(alpha, "Tests"), ["TST-501"]);
  assert.deepEqual(linksOf(alpha, "Tests"), ["#trace/key=tests/row=TST-501"]);
  const beta = await openRequirement(target, "BETA RULE");
  assert.deepEqual(paragraphs(beta, "Architecture decisions"), ["none: none"]);
  assert.deepEqual(listed(beta, "Modules"), ["MOD-tested Tested module"]);
  assert.deepEqual(paragraphs(beta, "Tests"), ["none: none"]);
});

// CASE ITM-597-04
// TST-597004 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture product, in which nothing names GAMMA RULE (known positive: ALPHA RULE's lists are full); and a product with a use case and no decision, module or test file at all
// input: GAMMA RULE opened in the first, ALPHA RULE in the second
// expect: GAMMA RULE — use cases, decisions, modules and tests each "none". In the second product: use cases list UC-001, and decisions, modules and tests each read "none yet" with the folded "What is this?" of MOD-site-frame (a details of the class explain) whose text says a list reads none yet when the version shown holds no artifact of that kind at all, and that architecture decisions and module files come when the architecture is derived from the accepted use cases
test("a list nothing fills reads none, and where the version holds no artifact of the kind it reads none yet with a folded note", async () => {
  const full = await render(mainOnly(), mainParams);
  assert.equal(listed(await openRequirement(full, "ALPHA RULE"), "Use cases").length, 3, "known positive: the same version fills ALPHA RULE's lists");
  const gamma = await openRequirement(full, "GAMMA RULE");
  for (const title of ["Use cases", "Architecture decisions", "Modules", "Tests"]) assert.deepEqual(paragraphs(gamma, title), ["none: none"], title);

  const bare = { "SPEC.md": TRACE_SPEC, "docs/use-cases/UC-001-first.md": UC1 };
  const row = await openRequirement(await render(mainOnly(bare), mainParams), "ALPHA RULE");
  assert.deepEqual(listed(row, "Use cases"), ["UC-001 First use case — open"]);
  for (const title of ["Architecture decisions", "Modules", "Tests"]) {
    assert.equal(paragraphs(row, title)[0], "none-yet: none yet", title);
    const note = find(traceSection(row, title), (node) => node.localName === "details")[0];
    assert.equal(note.className, "explain", title);
    assert.equal(find(note, (node) => node.localName === "summary")[0].textContent, "What is this?");
    assert.match(note.textContent, /a list reads none yet when the version shown holds no artifact of that kind at all/, title);
    assert.match(note.textContent, /Architecture decisions and module files come when the architecture is derived from the accepted use cases/, title);
  }
});

// CASE ITM-597-07
// TST-597007 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: a Host that names main the default branch and gives the tag v2026.1.0, whose tree holds the same files, queues included
// input: the route rendered at main, v2026.1.0 chosen, ALPHA RULE opened
// expect: the detail lists ALPHA RULE's use cases (known positive) and has no Open proposals section; no file of docs/spec-freigaben is read from the moment the tag is chosen (the draw at main before it reads the queues for the waiting section); a fault fails the case within 10 s of the clock
test("at a released version the traces are shown, no open proposals, and the queues are not read", { timeout: 10000 }, async () => {
  const productHost = treeHost({ trees: { main: TRACE_FILES, "v2026.1.0": TRACE_FILES }, tags: ["v2026.1.0"] });
  const target = await render(productHost, mainParams);
  const readBeforeTheChoice = productHost.log.reads.length;
  choose(target, "v2026.1.0");
  await until(() => productHost.log.snapshots.length === 2 && asOf(target).length === 1);
  const row = await openRequirement(target, "ALPHA RULE");
  assert.equal(listed(row, "Use cases").length, 3, "known positive: the traces are shown at the tag");
  assert.equal(traceSection(row, "Open proposals") === undefined, true, "no Open proposals section");
  assert.deepEqual(productHost.log.reads.slice(readBeforeTheChoice).filter((path) => path.startsWith("docs/spec-freigaben/")), []);
});

// CASE ITM-597-15
// TST-597015 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture on the default branch, whose queues hold open entries that change ALPHA RULE (known positive: its use cases are listed)
// input: ALPHA RULE opened
// expect: the detail has no Open proposals section and no stale note, and opening it reads no file of docs/spec-freigaben (the draw reads them for the waiting section): the open proposals wait for ITM-648
test("an opened requirement shows no open proposals and reads no queue", { timeout: 10000 }, async () => {
  const productHost = mainOnly();
  const target = await render(productHost, mainParams);
  const readByTheDraw = productHost.log.reads.length;
  const row = await openRequirement(target, "ALPHA RULE");
  assert.equal(listed(row, "Use cases").length, 3, "known positive: the traces are shown");
  assert.equal(traceSection(row, "Open proposals") === undefined, true, "no Open proposals section");
  assert.equal(find(row, (node) => node.className === "stale-note").length, 0);
  assert.deepEqual(productHost.log.reads.slice(readByTheDraw).filter((path) => path.startsWith("docs/spec-freigaben/")), []);
});

// CASE ITM-597-08
// TST-597008 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture, in which UC-001, a use case of ALPHA RULE, also realises REMOVED RULE, a name the SPEC does not hold, and UC-004, which names neither ALPHA RULE nor BETA RULE, realises ORPHAN RULE, another; and a product whose use case names only the requirement it holds
// input: ALPHA RULE and BETA RULE opened in the first, ALPHA RULE in the second
// expect: ALPHA RULE's Unknown names lists "REMOVED RULE — named by UC-001", UC-001 linked to #use-case/id=UC-001, and not ORPHAN RULE, which no artifact listed for ALPHA RULE names; BETA RULE's reads "none"; in the second product ALPHA RULE's reads "none"
test("the names that match no requirement and that the listed artifacts also name are listed under unknown names with what names them", async () => {
  const target = await render(mainOnly(), mainParams);
  const alpha = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(listed(alpha, "Unknown names"), ["REMOVED RULE — named by UC-001"]);
  assert.deepEqual(linksOf(alpha, "Unknown names"), ["#use-case/id=UC-001"]);
  assert.deepEqual(paragraphs(await openRequirement(target, "BETA RULE"), "Unknown names"), ["none: none"]);
  const only = doc("UC-001", "First use case", { realises: ["ALPHA RULE"] });
  const clean = await openRequirement(await render(mainOnly({ "SPEC.md": TRACE_SPEC, "docs/use-cases/UC-001-first.md": only }), mainParams), "ALPHA RULE");
  assert.deepEqual(paragraphs(clean, "Unknown names"), ["none: none"]);
});

// CASE ITM-597-09
// TST-597009 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture on the default branch, which holds no group file and two open entries of change queues
// input: the route drawn; ALPHA RULE opened; BETA RULE opened; ALPHA RULE closed and opened again
// expect: no file is read for a graph — UC-001's file is never named to readMany nor read; drawing reads the stored graph once, MOD-spec-changes' entryView's, for the impact lists that give the
//         statuses (UC-020 step 3): one readOn of ("trace-cache", "<main's commit>.json.gz"); the graph of a commit is read once for the page (MOD-trace-graph's storedGraph), so opening ALPHA RULE,
//         BETA RULE and ALPHA RULE again reads it no more — still one readOn —, and ALPHA RULE lists UC-001 (the graph is there: a known positive)
test("the view's trace graph is the stored graph of the commit, read once for the page and kept for every opening; no file is read for it", async () => {
  const productHost = mainOnly();
  const target = await render(productHost, mainParams);
  const queueFile = (path) => path.startsWith("docs/spec-freigaben/");
  assert.equal(productHost.log.reads[0], "SPEC.md");
  assert.equal(productHost.log.reads.filter(queueFile).length > 0, true, "known positive: the queue files of the default branch are read");
  const uc = "docs/use-cases/UC-001-first.md";
  const counts = () => [productHost.log.manys.filter((paths) => paths.includes(uc)).length, productHost.log.reads.filter((path) => path === uc).length,
    productHost.log.readOns.filter(([branch, path]) => branch === "trace-cache" && path === `${productHost.commitOf("main")}.json.gz`).length];
  assert.deepEqual(counts(), [0, 0, 1], "drawing reads the stored graph of the impact lists alone");
  const opened = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(counts(), [0, 0, 1]);
  assert.deepEqual(listed(opened, "Use cases")[0], "UC-001 First use case — accepted");
  await openRequirement(target, "BETA RULE");
  const alpha = find(target, (node) => node.localName === "button" && node.textContent === "ALPHA RULE")[0];
  alpha.dispatchEvent(new Event("click"));
  await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(counts(), [0, 0, 1]);
});

// CASE ITM-597-10
// TST-597010 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture, whose branch trace-cache holds no graph of main until the test lets the workflow have stored it
// input: ALPHA RULE opened, closed, the graph stored, ALPHA RULE opened again
// expect: the first opening keeps the four fields and says "What traces to this requirement could not be read: This page could not be drawn: the trace graph of <main's commit> is not stored yet" with no list,
//         and no file is read for a graph (UC-001's file is not read); the second opening reads again and lists UC-001 as "accepted"
test("a graph that is not stored is named in place of the traces, the four fields stay, and the next opening reads it again", async () => {
  let notStored = true;
  const productHost = treeHost({ trees: { main: TRACE_FILES }, stored: () => !notStored });
  const target = await render(productHost, mainParams);
  const row = await openRequirement(target, "ALPHA RULE");
  assert.match(row.textContent, /Alpha rule\./);
  assert.match(row.textContent, new RegExp(`What traces to this requirement could not be read: This page could not be drawn: the trace graph of ${productHost.commitOf("main").slice(0, 12)} is not stored yet`));
  assert.equal(traceSection(row, "Use cases") === undefined, true, "no lists beside the problem");
  assert.equal(productHost.log.reads.includes("docs/use-cases/UC-001-first.md"), false, "the page builds no graph");
  find(target, (node) => node.localName === "button" && node.textContent === "ALPHA RULE")[0].dispatchEvent(new Event("click"));
  notStored = false;
  const again = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(listed(again, "Use cases")[0], "UC-001 First use case — accepted");
  assert.doesNotMatch(again.textContent, /could not be read/);
});

// CASE ITM-597-11
// TST-597011 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the fixture, in which every read of docs/sources.md fails as an unreachable server does
// input: ALPHA RULE opened
// expect: Sources says "The sources could not be read: This page could not be drawn: unreachable"; the use cases are listed all the same
test("a part that cannot be read is named in its own section and leaves the others", async () => {
  const row = await openRequirement(await render(treeHost({ trees: { main: TRACE_FILES }, failing: (path) => path === "docs/sources.md" }), mainParams), "ALPHA RULE");
  assert.match(traceSection(row, "Sources").textContent, /The sources could not be read: This page could not be drawn: unreachable/);
  assert.deepEqual(paragraphs(row, "Sources"), ["problem: This page could not be drawn: unreachable"]);
  assert.equal(listed(row, "Use cases").length, 3);
});

// CASE ITM-597-13
// TST-597013 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: a product whose files hold the SPEC and the links file, and an instance whose default branch holds the register entry of SRC-vibe-coding; the route is handed both Hosts
// input: ALPHA RULE opened
// expect: Sources lists "Vibe Coding — version 2026-10-05, part ch. 9" and "Unlinked Source — no linked version", as when the product holds the register; the product's snapshot is asked for no file of docs/sources/, the instance's snapshot is the one of its default branch
test("the register of the sources is read from the instance's default branch when the route is handed the instance", async () => {
  const productHost = treeHost({ trees: { main: { "SPEC.md": TRACE_SPEC, "docs/sources.md": LINKS } } });
  const instanceHost = treeHost({ trees: { main: { "docs/sources/SRC-vibe-coding.md": REGISTER_ENTRY } } });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { instance: { host: instanceHost }, product: { host: productHost } }, mainParams);
  const row = await openRequirement(target, "ALPHA RULE");
  assert.deepEqual(listed(row, "Sources"), ["Vibe Coding — version 2026-10-05, part ch. 9", "Unlinked Source — no linked version"]);
  assert.deepEqual(productHost.log.reads.filter((path) => path.startsWith("docs/sources/")), []);
  assert.ok(instanceHost.log.reads.includes("docs/sources/SRC-vibe-coding.md"));
});

// CASE ITM-597-14
// TST-597014 · level: component · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: a SPEC whose requirement LONELY RULE names no source, and the fixture's ALPHA RULE for the known positive
// input: LONELY RULE opened
// expect: Sources reads "none"
test("a requirement that names no source reads none under Sources", async () => {
  const lonely = `${TRACE_SPEC}\n**LONELY RULE**\nLonely rule.\n*Check:* at review.\n`;
  const target = await render(mainOnly({ ...TRACE_FILES, "SPEC.md": lonely }), mainParams);
  assert.equal(listed(await openRequirement(target, "ALPHA RULE"), "Sources").length, 2, "known positive: ALPHA RULE names two sources");
  assert.deepEqual(paragraphs(await openRequirement(target, "LONELY RULE"), "Sources"), ["none: none"]);
});

// The Gaps link (ITM-668): "UC-020 step 7: The tab Gaps shows ... the traceability matrix"; MOD-trace-pages: its links lead "to its own or the review pages' routes". The link is an anchor in the
// frame's address form, `#trace/key=gaps/ref=<the ref shown, encoded>`, beside the version choice; it is offered at every ref, and the reading it takes is that the ref shown is the ref chosen last.
const gapsLinks = (target) => find(target, (node) => node.localName === "a" && node.className.split(/\s+/).includes("trace-gaps-link"));
const backLinks = (target) => find(target, (node) => node.localName === "a" && node.className.split(/\s+/).includes("trace-specification-link"));

// CASE ITM-668-01
// TST-668001 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: main is the default branch and has OUTSIDE, FIRST and SECOND REQUIREMENT; the tag v2026.1.0 exists
// input: the specification route rendered at main
// expect: exactly one Gaps link, whose text is "Gaps" and whose href is "#trace/key=gaps/ref=main"; no link back to the specification; the Edit and + Requirement links are still five; readSnapshot was asked main alone
test("the specification view offers Gaps at the version it shows", async () => {
  const productHost = tagged();
  const target = await render(productHost, mainParams);
  assert.deepEqual(gapsLinks(target).map((node) => [node.textContent, node.getAttribute("href")]), [["Gaps", "#trace/key=gaps/ref=main"]]);
  assert.equal(backLinks(target).length, 0);
  assert.equal(editLinks(target).length, 5, "known positive: the Edit and + Requirement links are found as before");
  assert.deepEqual(productHost.calls, ["main"]);
});

// CASE ITM-668-02
// TST-668002 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: main is the default branch; the tag v2026.1.0 exists
// input: the route rendered at main, then v2026.1.0 chosen
// expect: after the choice the one Gaps link has the href "#trace/key=gaps/ref=v2026.1.0", and its address read by the frame's form names the route "trace" with key "gaps" and ref "v2026.1.0"; readSnapshot was asked main and v2026.1.0 and nothing else
test("the Gaps link leads to the version chosen", async () => {
  const productHost = tagged();
  const target = await render(productHost, mainParams);
  choose(target, "v2026.1.0");
  await until(() => asOf(target).length === 1);
  assert.deepEqual(gapsLinks(target).map((node) => node.getAttribute("href")), ["#trace/key=gaps/ref=v2026.1.0"]);
  assert.deepEqual(addressParts(gapsLinks(target)[0].getAttribute("href")), { route: "trace", params: { key: "gaps", ref: "v2026.1.0" } });
  assert.deepEqual(productHost.calls, ["main", "v2026.1.0"]);
});

// CASE ITM-668-03
// TST-668003 · level: unit · module: MOD-trace-pages
// guards: UC-020
// given: a Host that reads any ref and names main the default branch
// input: the route rendered at the ref "release/1 a"
// expect: the Gaps link has the href "#trace/key=gaps/ref=release%2F1%20a", and read back by the frame's form its ref is "release/1 a"
test("the Gaps link encodes the ref it leads to", async () => {
  const target = await render(host(SPEC, { defaultBranch: "main" }), { key: "specification", ref: "release/1 a" });
  assert.deepEqual(gapsLinks(target).map((node) => node.getAttribute("href")), ["#trace/key=gaps/ref=release%2F1%20a"]);
  assert.equal(addressParts(gapsLinks(target)[0].getAttribute("href")).params.ref, "release/1 a");
});

// CASE ITM-668-04
// TST-668004 · level: unit · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: main is the default branch and holds OUTSIDE, FIRST and SECOND REQUIREMENT; the tag v2026.1.0 has a SPEC that cannot be read (its snapshot is unreachable)
// input: the route rendered at main; v2026.1.0 chosen
// expect: the page says "v2026.1.0 could not be read: This page could not be drawn: unreachable" in place of the tree, and the one Gaps link, still beside the choice, has the href "#trace/key=gaps/ref=v2026.1.0"
test("a chosen version that cannot be read keeps the choice and its Gaps link at that version", async () => {
  const target = await render(tagged({ unreadable: ["v2026.1.0"] }), mainParams);
  choose(target, "v2026.1.0");
  await until(() => find(target, (node) => node.className === "version-problem").length === 1);
  assert.deepEqual(find(target, (node) => node.className === "version-problem").map((node) => node.textContent), ["v2026.1.0 could not be read: This page could not be drawn: unreachable"]);
  assert.deepEqual(gapsLinks(target).map((node) => node.getAttribute("href")), ["#trace/key=gaps/ref=v2026.1.0"]);
});

// CASE ITM-668-05
// TST-668005 · level: unit · module: MOD-trace-pages
// guards: UC-020; UC-049
// given: the specification drawn at main with the context the frame handed the route
// input: route.subject for the key "specification" with that context, nothing open
// expect: the page text the subject sends holds "Gaps" (the link's text) and the requirement name OUTSIDE REQUIREMENT
test("the page text the specification gives the prompt bar names the Gaps link", async () => {
  const context = { product: { host: tagged() } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, mainParams);
  const page = route.subject(mainParams, context).paramsFor({}).page;
  assert.equal(page.includes("Gaps"), true);
  assert.equal(page.includes("OUTSIDE REQUIREMENT"), true);
});

// CASE ITM-658-01
// TST-658001 · level: unit · module: MOD-trace-pages
// guards: UC-020; EVERY STEP EXPLAINS ITSELF
// given: the fixture whose read of docs/sources.md fails as a Host fails when the repository is not found (a HostError NotFound); the context says tokenStored false, then true, then says nothing
// input: ALPHA RULE opened, for each context
// expect: with tokenStored false the sources say the repository is private or does not exist and offer "Store a token" (a.token-step); with tokenStored true they give the host's own message and offer no link; with no tokenStored they give the host's message and no private-or-missing sentence and no link
test("a failed read of the specification view is named by readProblem with the context's tokenStored", async () => {
  const { HostError } = await import("../src/repository-hosts/index.mjs");
  const cases = async (tokenStored) => {
    const productHost = treeHost({ trees: { main: TRACE_FILES } });
    const readSnapshot = productHost.readSnapshot;
    productHost.readSnapshot = async (ref) => {
      const snapshot = await readSnapshot(ref);
      const read = snapshot.read;
      return Object.assign(Object.create(snapshot), { read: async (path) => { if (path === "docs/sources.md") throw new HostError("NotFound", {}, "Not Found"); return read(path); } });
    };
    const target = document.createElement("div");
    document.body.append(target);
    await route.render(target, { product: { host: productHost, ...(tokenStored === undefined ? {} : { tokenStored }) } }, mainParams);
    const section = traceSection(await openRequirement(target, "ALPHA RULE"), "Sources");
    return { text: section.textContent, links: find(section, (node) => node.className === "token-step").length };
  };
  const without = await cases(false);
  assert.match(without.text, /The sources could not be read: This repository is private or does not exist/);
  assert.equal(without.links, 1);
  const stored = await cases(true);
  assert.match(stored.text, /The sources could not be read: Not Found/);
  assert.equal(stored.links, 0);
  const unknown = await cases(undefined);
  assert.match(unknown.text, /The sources could not be read: Not Found/);
  assert.doesNotMatch(unknown.text, /private or does not exist/);
  assert.equal(unknown.links, 0);
});
