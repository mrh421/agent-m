// Release tests of UC-021 Group artifacts into a hierarchy: one or more for each requirement UC-021 realises whose check is a test, each walked through the arrangement page as the author reads it — the real routes `arrange` and
// `use-case` of MOD-review-pages and `trace` of MOD-trace-pages over the real MOD-repository-hosts host, MOD-artifact-edits, MOD-group-document and MOD-trace-graph, behind the fixture servers of tests/uc-008-harness.mjs and the product
// of tests/uc-021-harness.mjs — and against what the product's repository holds afterwards. The cases never read the code files. ONE CLICK PER DECISION is guarded only at review (SPEC, `Check`), and has no case here.
// Run: node --test tests/release-uc-021-group-artifacts-into-a-hierarchy.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-artifact-edits
// Module: MOD-group-document
// Module: MOD-trace-pages
// Guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; A GROUP CARRIES NO IDENTIFIER; A GROUP HOLDS ONE KIND OF ARTIFACT; AN ITEM HAS ONE PLACE IN ITS HIERARCHY; EVERY HIERARCHY IS KEPT IN A GROUP FILE OF ITS OWN; REGROUPING LEAVES THE GROUPED FILE UNCHANGED; A REGROUPING IS COMMITTED DIRECTLY; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL; THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; STATUS IS DERIVED FROM THE RECORDS; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ARTIFACTS ARE MARKDOWN; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// Level: release
//
// Written by developer-sonnet-j (ITM-738), who implemented none of ITM-722, ITM-723, ITM-726, ITM-727 and ITM-737 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER) and no UC-021 production behaviour.
// Where the page and UC-021 disagree the case follows UC-021 and is marked { todo } with the finding it reports; the findings of this file are those of tests/system-uc-021-group-artifacts-into-a-hierarchy.test.mjs (UC021-F3),
// which the system test marks, and this file reports none of its own. Readings the texts leave open, which the cases state:
//   - A GROUP CARRIES NO IDENTIFIER: "an identifier of the kind EVERY ARTIFACT HAS AN IDENTIFIER gives artifacts" is read as the identifiers of the scheme SRC-, UC-, ARC-, MOD-, TST-, ITM-, RES-, JOB- and a requirement's name.
//   - THE PRODUCT REPOSITORY IS SELF-SUFFICIENT: "no artifact references a file or service that exists only inside Agent M" is read for the group file this page writes: it holds no address, no path and no name of Agent M, and a reader
//     with no Agent M rebuilds the arrangement from its text alone (the test's own reading of the nested list).
//   - EVERY STEP EXPLAINS ITSELF: a step that asks something of the author is read as the arrangement page of each kind and its Propose groups; the explanation is "folded" when its details element is not open.

import test from "node:test";
import assert from "node:assert/strict";
import { BOOK_RETURN, LOAN_DATE, LOAN_EXTENSION, SHELF_PLACE, TOKENS, USE_CASE_GROUPS, addGroup, arrangement, badgeOf, blobOf, byClass, click, drag, find, groupFile, groupOf, grouped, itemOf, land, marksOf,
  membersOf, moveTo, pending, propose, refused, results, saveButton, scripted, textOf, topLevel, trace, until, GROUP_PATH, ARTIFACTS } from "./uc-021-harness.mjs";

const KINDS = ["requirements", "use-cases", "architecture", "modules", "tests"];
const ITEMS = { requirements: [BOOK_RETURN, SHELF_PLACE, LOAN_EXTENSION, LOAN_DATE], "use-cases": ["UC-041", "UC-042", "UC-043", "UC-044"], architecture: ["ARC-001", "ARC-002"], modules: ["MOD-reader", "MOD-shelf"],
  tests: ["TST-101", "TST-102", "TST-103"] };
// One item of each kind, to be put into a group of another kind.
const FOREIGN = { requirements: LOAN_DATE, "use-cases": "UC-041", architecture: "ARC-001", modules: "MOD-shelf", tests: "TST-101" };
const US = GROUP_PATH("use-cases");
/** The group files as the page writes them, by kind: the title line, the line saying what the file arranges and by what its members are named. */
const HEAD = { requirements: "# Requirements — groups\n\nThe hierarchy of the requirements, each member by its name.\n", "use-cases": "# Use cases — groups\n\nThe hierarchy of the use cases, each member by its identifier.\n",
  architecture: "# Architecture decisions — groups\n\nThe hierarchy of the architecture decisions, each member by its identifier.\n", modules: "# Modules — groups\n\nThe hierarchy of the modules, each member by its identifier.\n",
  tests: "# Tests — groups\n\nThe hierarchy of the tests, each member by its identifier.\n" };
const blobsOutsideGroups = (w) => Object.fromEntries(Object.entries(w.files()).filter(([path]) => !path.startsWith("docs/groups/")).map(([path, body]) => [path, blobOf(body)]));
/** The author's click on Save arrangement, and the wait for the commit that follows. */
async function save(w, t) {
  const made = w.writes().length;
  click(saveButton(t));
  await until(() => w.writes().length === made + 1, "the save");
  await w.quiet();
}
/** The nested list of a group file read by a reader that has no Agent M: { title, members, groups } from the indentation alone. */
function readList(text) {
  const root = { title: null, members: [], groups: [] };
  const open = [{ indent: -2, node: root }];
  const lines = text.split("\n").filter((line) => /^ *- /.test(line));
  lines.forEach((line, at) => {
    const indent = line.length - line.trimStart().length, label = line.trim().slice(2);
    while (open.at(-1).indent >= indent) open.pop();
    const holder = open.at(-1).node;
    const next = lines[at + 1], deeper = next !== undefined && next.length - next.trimStart().length > indent;
    if (deeper || !/^(UC|ARC|MOD|TST)-|^[A-Z][A-Z ]+[A-Z]$/.test(label)) {
      const group = { title: label, members: [], groups: [] };
      holder.groups.push(group);
      open.push({ indent, node: group });
    } else holder.members.push(label);
  });
  return root;
}

// TST-738101 · level: release · module: system
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS
// given: the product with no group file, in which the requirements, the use cases, the architecture decisions, the modules and the tests can each be arranged
// input: for each of the five kinds the author adds a group Chapter, a group Section inside it and a group Part inside that, moves the first item of the kind into Part and saves; the arrangement of each kind is opened again
// expect: each saved file holds the item at the third level of nesting (six spaces) under "- Chapter", "  - Section", "    - Part"; opened again, the page shows Part inside Section inside Chapter holding that item
test("TST-738101: UC-021 each of the five kinds is arranged in groups of any depth, and the arrangement survives the save", async () => {
  const w = await grouped();
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Chapter");
    addGroup(t, "Section", "Chapter");
    addGroup(t, "Part", "Chapter › Section");
    const first = ITEMS[kind][0];
    moveTo(itemOf(t, first)[0], "Chapter › Section › Part");
    await save(w, t);
    assert.equal(w.files()[GROUP_PATH(kind)], `${HEAD[kind]}\n- Chapter\n  - Section\n    - Part\n      - ${first}\n`, kind);
    const again = await arrangement(w, kind);
    const chapter = groupOf(again, "Chapter");
    assert.deepEqual(byClass(chapter, "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Section", "Part"], kind);
    assert.deepEqual(membersOf(groupOf(again, "Part")), [first], kind);
    assert.ok(byClass(groupOf(again, "Section"), "li", "arrange-group").some((node) => node.getAttribute("data-title") === "Part"), `${kind}: Part is inside Section`);
  }
});

// TST-738102 · level: release · module: system
// guards: UC-021; A GROUP CARRIES NO IDENTIFIER
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099)
// input: + Group with the titles UC-050, MOD-new, ARC-009, TST-009, SRC-x and A LOAN HAS A DUE DATE (a requirement's name); Rename of Derivation to UC-060; + Group "Chapters" (known positive); Save arrangement
// expect: each title that is an identifier is refused, with a reason that says it is an identifier, and is no pending change; the group Chapters is the one pending change; the saved file has no group titled by an identifier: every title of a group in it is Review, Derivation or Chapters
test("TST-738102: UC-021 a group is named by a title, never by an identifier", async () => {
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(w, "use-cases");
  for (const title of ["UC-050", "MOD-new", "ARC-009", "TST-009", "SRC-x", LOAN_DATE]) addGroup(t, title);
  const rename = byClass(groupOf(t, "Derivation"), "input", "arrange-rename")[0];
  rename.value = "UC-060";
  click(byClass(groupOf(t, "Derivation"), "button", "arrange-rename-go")[0]);
  assert.equal(refused(t).length, 7);
  for (const line of refused(t)) assert.match(line, /is an identifier, and a group carries none/);
  assert.deepEqual(pending(t), []);
  addGroup(t, "Chapters");
  assert.deepEqual(pending(t), ["Add the group “Chapters”"], "known positive: a title in words is a group");
  await save(w, t);
  assert.deepEqual(readList(w.files()[US]).groups.map((each) => each.title), ["Review", "Derivation", "Chapters"]);
});

// TST-738103 · level: release · module: system
// guards: UC-021; A GROUP HOLDS ONE KIND OF ARTIFACT
// given: for each of the kinds the arrangement of the product, and a participant whose proposal puts one item of each of the other four kinds into a new group Mixed
// input: Propose groups and Run, for the requirements, the use cases, the architecture decisions and the modules
// expect: the group Mixed is the one pending change; each of the four moves is refused with a reason that says what the item is and that the group holds another kind ("is a …, not a …"); no foreign item stands in the tree; nothing is written but the job's record
async function refusesForeign(w, kind) {
  const t = await arrangement(w, kind);
  const foreign = KINDS.filter((other) => other !== kind).map((other) => FOREIGN[other]);
  const proposal = await propose(w, t, [{ op: "create", title: "Mixed", in: [] }, ...foreign.map((item) => ({ op: "move", item, to: ["Mixed"] }))]);
  try {
    await proposal.run();
    assert.deepEqual(pending(t), ["Add the group “Mixed”"], kind);
    assert.equal(refused(t).length, 4, kind);
    for (const [at, item] of foreign.entries()) assert.match(refused(t)[at], new RegExp(`^Move ${item} to “Mixed”: ${item} is an? .+, not an? .+`), kind);
    for (const item of foreign) assert.equal(itemOf(t, item).length, 0, `${kind}: ${item} is in no tree of this kind`);
    assert.ok(w.writes().every((write) => Object.keys(write.files).every((path) => path.startsWith("docs/jobs/"))), kind);
  } finally { proposal.restore(); }
}
test("TST-738103: UC-021 a group holds items of one kind only: requirements, use cases, decisions and modules", async () => {
  const w = await grouped();
  for (const kind of KINDS.filter((each) => each !== "tests")) await refusesForeign(w, kind);
});

// TST-738118 · level: release · module: system
// guards: UC-021; A GROUP HOLDS ONE KIND OF ARTIFACT
// given: the arrangement of the tests of the product, and a participant whose proposal puts one item of each of the other four kinds into a new group Mixed (known positive: the same proposal on the requirements is answered, TST-738103)
// input: Propose groups and Run
// expect: as TST-738103 for the tests: the group Mixed is the one pending change, each of the four moves is refused with its reason
test("TST-738118: UC-021 a group of tests holds tests only", async () => {
  const w = await grouped();
  await refusesForeign(w, "requirements");
  await refusesForeign(w, "tests");
});

// TST-738104 · level: release · module: system
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: for each of the five kinds a group file that places the first item of the kind in a group One; and the architecture decisions' group file in which ARC-001 stands under One and again under Two
// input: for each kind the author moves the first item to Two and saves; for the architecture decisions with the item in two places the author saves at once
// expect: each saved file lists the item once, under Two; no item of any kind is listed twice in any saved file; the save with ARC-001 in two places commits nothing and says ARC-001 would stand in more than one place
test("TST-738104: UC-021 every item has exactly one place, in a saved file and on the page", async () => {
  const files = Object.fromEntries(KINDS.map((kind) => [GROUP_PATH(kind), `${HEAD[kind]}\n- One\n  - ${ITEMS[kind][0]}\n- Two\n`]));
  const w = await grouped({ files });
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    moveTo(itemOf(t, ITEMS[kind][0])[0], "Two");
    await save(w, t);
    const lines = w.files()[GROUP_PATH(kind)].split("\n");
    assert.equal(lines.filter((line) => line.trim() === `- ${ITEMS[kind][0]}`).length, 1, kind);
    assert.deepEqual(readList(w.files()[GROUP_PATH(kind)]).groups.map((group) => [group.title, group.members]), [["One", []], ["Two", [ITEMS[kind][0]]]], kind);
  }
  for (const kind of KINDS) {
    const members = [...w.files()[GROUP_PATH(kind)].matchAll(/^ *- (.+)$/gm)].map((match) => match[1]).filter((label) => ITEMS[kind].includes(label));
    assert.equal(new Set(members).size, members.length, `${kind}: no item twice`);
  }
  const twice = await grouped({ files: { [GROUP_PATH("architecture")]: `${HEAD.architecture}\n- One\n  - ARC-001\n- Two\n  - ARC-001\n` } });
  const t = await arrangement(twice, "architecture");
  assert.equal(itemOf(t, "ARC-001").length, 2);
  click(saveButton(t));
  await twice.quiet();
  assert.deepEqual(twice.writes(), []);
  assert.match(results(t)[0], /ARC-001 would stand in more than one place/);
});

// TST-738105 · level: release · module: system
// guards: UC-021; EVERY HIERARCHY IS KEPT IN A GROUP FILE OF ITS OWN
// given: the product with no group file; the first item of each kind in a new group Lot
// input: for each of the five kinds the author adds the group Lot, moves the first item into it and saves
// expect: the commit of each save holds one file, docs/groups/<kind>.md of that kind — requirements.md, use-cases.md, architecture.md, modules.md, tests.md —, whose text is the title line "# <Kind> — groups", the line saying what it arranges, a blank line and the list "- Lot", "  - <the item>"; a requirement is named in it by its name, the others by their identifiers; after the five saves docs/groups/ holds these five files and nothing else
test("TST-738105: UC-021 the hierarchy of each kind is kept in a group file of its own under docs/groups/, each member named by its identifier", async () => {
  const w = await grouped();
  const paths = { requirements: "docs/groups/requirements.md", "use-cases": "docs/groups/use-cases.md", architecture: "docs/groups/architecture.md", modules: "docs/groups/modules.md", tests: "docs/groups/tests.md" };
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    moveTo(itemOf(t, ITEMS[kind][0])[0], "Lot");
    await save(w, t);
    assert.deepEqual(Object.keys(w.writes().at(-1).files), [paths[kind]], kind);
    assert.equal(w.files()[paths[kind]], `${HEAD[kind]}\n- Lot\n  - ${ITEMS[kind][0]}\n`, kind);
  }
  assert.deepEqual(Object.keys(w.files()).filter((path) => path.startsWith("docs/groups/")).sort(), Object.values(paths).sort());
});

// TST-738106 · level: release · module: system
// guards: UC-021; REGROUPING LEAVES THE GROUPED FILE UNCHANGED
// given: the product with its SPEC, use cases, decisions, modules and tests, and an approval record for UC-042 and UC-043 (their blob SHAs are read before)
// input: for each of the five kinds the author regroups — a new group, an item moved into it, the group renamed — and saves
// expect: after every save the blob SHA of SPEC.md and of every other file of the product but the group files is the one it was; the paths of the product are those it had, plus docs/groups/<kind>.md of the kind saved; the docs/approvals folder holds the records it held
test("TST-738106: UC-021 regrouping leaves the SPEC and every artifact file byte for byte as it was", async () => {
  const w = await grouped();
  const before = blobsOutsideGroups(w);
  const records = Object.keys(w.files()).filter((path) => path.startsWith("docs/approvals/"));
  assert.ok(records.length >= 2 && before["SPEC.md"], "known positive: the product holds its SPEC and its records");
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    moveTo(itemOf(t, ITEMS[kind][1])[0], "Lot");
    const rename = byClass(groupOf(t, "Lot"), "input", "arrange-rename")[0];
    rename.value = "Batch";
    click(byClass(groupOf(t, "Lot"), "button", "arrange-rename-go")[0]);
    await save(w, t);
    assert.deepEqual(blobsOutsideGroups(w), before, `${kind}: no file but the group file differs`);
  }
  assert.deepEqual(Object.keys(w.files()).filter((path) => path.startsWith("docs/approvals/")), records);
  assert.deepEqual(Object.keys(w.files()).filter((path) => !(path in before)).sort(), KINDS.map((kind) => GROUP_PATH(kind)).sort());
});

// TST-738107 · level: release · module: system
// guards: UC-021; A REGROUPING IS COMMITTED DIRECTLY
// given: a GitHub product and a GitLab product, each with the group file of the use cases, the author's token stored for each
// input: the author moves UC-044 into Review and saves, in each product
// expect: GitHub — the requests that write are a tree, a commit whose parent is the head read, and the move of the branch main to it; no branch is created, no pull request opened; the default branch is the commit; GitLab — one commit request, with the branch main, holding the group file alone, and no merge request
test("TST-738107: UC-021 a regrouping is one commit on the default branch, not a branch or a pull request", async () => {
  const hub = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const head = hub.head();
  const t = await arrangement(hub, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  await save(hub, t);
  assert.deepEqual(hub.writers().map((request) => `${request.method} ${request.path.replace("/repos/alice/thesis-tool", "")}`), ["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main"]);
  assert.deepEqual(hub.writers().find((request) => request.path.endsWith("/git/commits")).body.parents, [head]);
  assert.ok(hub.writers().every((request) => !/\/pulls|\/git\/refs$|\/merge/.test(request.path)), "no branch, no pull request");
  assert.notEqual(hub.head(), head);
  assert.ok(hub.files()[US].includes("  - UC-044"));
  const lab = await grouped({ server: "gitlab", files: { [US]: USE_CASE_GROUPS } });
  const u = await arrangement(lab, "use-cases");
  moveTo(itemOf(u, "UC-044")[0], "Review");
  await save(lab, u);
  assert.equal(lab.writers().length, 1);
  assert.match(lab.writers()[0].path, /\/repository\/commits$/);
  assert.equal(lab.writers()[0].body.branch, "main");
  assert.deepEqual(lab.writers()[0].body.actions.map((action) => [action.action, action.file_path]), [["update", US]]);
});

// TST-738108 · level: release · module: system
// guards: UC-021; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the product with the group file of the requirements naming two of the four requirements under Lending and the group files of the other four kinds absent
// input: the arrangement of each kind is opened; the specification browser is opened
// expect: in the arrangement of each kind with no group file every item stands at the top level, marked "not yet placed"; of the requirements the two Lending names stand in Lending, the other two at the top level marked; the specification browser draws the two Lending names, each with an Edit link ending in /product=<the product's address, percent-encoded> (ITM-1364), inside the section of the group Lending, and the other two outside every group, marked "not yet placed"
test("TST-738108: UC-021 an item no group names is shown at the top level, in the arrangement and in the specification browser", async () => {
  const requirements = groupFile("requirements", "- Lending", `  - ${LOAN_DATE}`, `  - ${LOAN_EXTENSION}`);
  const w = await grouped({ files: { [GROUP_PATH("requirements")]: requirements } });
  for (const kind of KINDS.filter((each) => each !== "requirements")) {
    const t = await arrangement(w, kind);
    assert.deepEqual(topLevel(t), ITEMS[kind], kind);
    assert.ok(byClass(t, "span", "mark").length === ITEMS[kind].length && byClass(t, "span", "mark").every((mark) => mark.textContent === "not yet placed"), kind);
  }
  const t = await arrangement(w, "requirements");
  assert.deepEqual(membersOf(groupOf(t, "Lending")), [LOAN_DATE, LOAN_EXTENSION]);
  assert.deepEqual(topLevel(t), [BOOK_RETURN, SHELF_PLACE]);
  assert.deepEqual(marksOf(itemOf(t, BOOK_RETURN)[0]), ["not yet placed"]);
  const spec = await trace(w);
  const sections = byClass(spec, "section", "spec-group");
  assert.equal(sections.length, 1);
  const edit = new RegExp(`^#requirement/name=([^/]+)/product=${encodeURIComponent(w.address).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  const names = (root) => find(root, (node) => node.localName === "a" && edit.test(node.getAttribute("href") ?? "")).map((a) => decodeURIComponent(edit.exec(a.getAttribute("href"))[1]));
  assert.deepEqual(names(sections[0]).sort(), [LOAN_DATE, LOAN_EXTENSION].sort());
  assert.deepEqual(names(spec).filter((name) => !names(sections[0]).includes(name)).sort(), [BOOK_RETURN, SHELF_PLACE].sort());
  assert.equal(byClass(spec, "span", "requirement-unplaced").length, 2);
  assert.equal(byClass(sections[0], "span", "requirement-unplaced").length, 0);
});

// TST-738109 · level: release · module: system
// guards: UC-021; THE NAME IS THE ID AND IT SURVIVES
// given: the product with its use cases UC-041 to UC-044, its requirements (names of several words), decisions, modules and tests, and for each kind no group file
// input: for each of the five kinds the author moves every item into a new group Lot and then one item out of it to the top, and saves; the list of use cases is opened
// expect: every group file names exactly the identifiers the kind has (the requirements by their names, with their spaces) — none changed, none added, none dropped —; the list of use cases still holds UC-041 to UC-044 in their files, byte for byte; the SPEC still holds the four names
test("TST-738109: UC-021 an item keeps its identifier through every regrouping", async () => {
  const w = await grouped();
  const files = ARTIFACTS();
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    for (const id of ITEMS[kind]) moveTo(itemOf(t, id)[0], "Lot");
    drag(itemOf(t, ITEMS[kind][0])[0], t);
    await save(w, t);
    const names = [...w.files()[GROUP_PATH(kind)].matchAll(/^ *- (.+)$/gm)].map((match) => match[1]).filter((label) => label !== "Lot");
    assert.deepEqual([...names].sort(), [...ITEMS[kind]].sort(), kind);
  }
  const list = await w.draw({}, "use-case");
  assert.deepEqual([...new Set(find(list, (node) => node.localName === "tr" && node.getAttribute("data-id")).map((row) => row.getAttribute("data-id")))].sort(), ITEMS["use-cases"]);
  for (const [path, body] of Object.entries(files)) assert.equal(w.files()[path], body, path);
});

// TST-738110 · level: release · module: system
// guards: UC-021; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: the group file of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099)
// input: the author reverses the places — UC-043 first into Review, UC-041 into Derivation — and saves
// expect: every member line of the saved file is an identifier (UC-…); none is a number, a line, a section sign or a position; UC-043 is referred to as "UC-043" in its new place, and the use case files are the bytes they were
test("TST-738110: UC-021 the group file refers to a member by its identifier, wherever it stands", async () => {
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const before = blobsOutsideGroups(w);
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-043")[0], "Review");
  moveTo(itemOf(t, "UC-041")[0], "Derivation");
  await save(w, t);
  const members = readList(w.files()[US]).groups.flatMap((group) => group.members);
  assert.deepEqual(members.sort(), ["UC-041", "UC-042", "UC-043", "UC-099"]);
  assert.doesNotMatch(w.files()[US], /§|\bsection \d|\bline \d|^ *- \d+\s*$/m);
  assert.deepEqual(readList(w.files()[US]).groups.map((group) => [group.title, group.members]), [["Review", ["UC-042", "UC-043"]], ["Derivation", ["UC-099", "UC-041"]]]);
  assert.deepEqual(blobsOutsideGroups(w), before);
});

// TST-738111 · level: release · module: system
// guards: UC-021; STATUS IS DERIVED FROM THE RECORDS
// given: the product with the use cases UC-041 (open), UC-042 (accepted: a record names its text), UC-043 (changed since acceptance) and UC-044 (open), and the decisions and modules, all open
// input: the author regroups the use cases, the decisions and the modules and saves each; the lists of use cases, decisions and modules are read before and after
// expect: the statuses are the same after: open, accepted, changed since acceptance, open; the decisions and modules open; the folder docs/approvals holds the same records, none added
test("TST-738111: UC-021 regrouping changes no status: it is still derived from the approval records", async () => {
  const w = await grouped();
  const statuses = async () => {
    const out = {};
    for (const route of ["use-case", "decision", "module"]) {
      const list = await w.draw({}, route);
      for (const row of find(list, (node) => node.localName === "tr" && node.getAttribute("data-id"))) out[row.getAttribute("data-id")] = badgeOf(row);
    }
    return out;
  };
  const before = await statuses();
  assert.equal(before["UC-042"], "accepted", "known positive: the product holds an accepted use case");
  assert.equal(before["UC-043"], "changed since acceptance");
  const records = Object.keys(w.files()).filter((path) => path.startsWith("docs/approvals/")).sort();
  for (const kind of ["use-cases", "architecture", "modules"]) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    moveTo(itemOf(t, ITEMS[kind][0])[0], "Lot");
    await save(w, t);
  }
  assert.deepEqual(await statuses(), before);
  assert.deepEqual(Object.keys(w.files()).filter((path) => path.startsWith("docs/approvals/")).sort(), records);
});

// TST-738112 · level: release · module: system
// guards: UC-021; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
// given: the arrangement of the use cases opened with the group file; then another writer changes it; and the arrangement of the modules opened with no group file, then another writer creates it; and the arrangement of the use cases opened, then another writer changes only the SPEC (known positive: this save is not refused)
// input: Save arrangement in each
// expect: with the group file changed, nothing is written and the other writer's text stays the text of the file; with the group file created, nothing is written and the other writer's file is the one the repository holds; with only the SPEC changed the save commits the group file
test("TST-738112: UC-021 a group file that is not the text the arrangement started from is not overwritten", async () => {
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  const theirs = USE_CASE_GROUPS.replace("- Derivation", "- Approval");
  await land(w, { [US]: theirs });
  click(saveButton(t));
  await until(() => /changed/.test(results(t).join(" ")), "the refusal");
  assert.deepEqual(w.writes(), []);
  assert.equal(w.files()[US], theirs);
  const fresh = await grouped();
  const m = await arrangement(fresh, "modules");
  addGroup(m, "Shelving");
  const created = "# Modules — groups\n\nThe hierarchy of the modules, each member by its identifier.\n\n- Theirs\n  - MOD-reader\n";
  await land(fresh, { [GROUP_PATH("modules")]: created });
  click(saveButton(m));
  await until(() => /changed/.test(results(m).join(" ")), "the refusal of a file created meanwhile");
  assert.deepEqual(fresh.writes(), []);
  assert.equal(fresh.files()[GROUP_PATH("modules")], created);
  const apart = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const u = await arrangement(apart, "use-cases");
  moveTo(itemOf(u, "UC-044")[0], "Review");
  await land(apart, { "README.md": "# Thesis tool, changed\n" });
  await save(apart, u);
  assert.deepEqual(Object.keys(apart.writes()[0].files), [US], "known positive: a change elsewhere refuses nothing");
});

// TST-738113 · level: release · module: system
// guards: UC-021; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: a GitHub product and a GitLab product, each with the author's token stored, and the instance's own token stored beside them
// input: the author saves a regrouping in each
// expect: every request that writes carries the token stored for that product (GitHub: Bearer + the product's token; GitLab: the project's token), and none carries the instance's token; the commit is on the default branch
test("TST-738113: UC-021 the regrouping is committed under the author's own token for the product", async () => {
  const hub = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(hub, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  await save(hub, t);
  assert.ok(hub.writers().length >= 3);
  for (const request of hub.writers()) assert.equal(request.authorization, `Bearer ${TOKENS.github.value}`, request.path);
  assert.ok(hub.writers().every((request) => request.authorization !== `Bearer ${TOKENS.instance.value}`));
  const lab = await grouped({ server: "gitlab", files: { [US]: USE_CASE_GROUPS } });
  const u = await arrangement(lab, "use-cases");
  moveTo(itemOf(u, "UC-044")[0], "Review");
  await save(lab, u);
  assert.equal(lab.writers().length, 1);
  assert.equal(lab.writers()[0].authorization, TOKENS.gitlab.value);
  assert.equal(lab.writes()[0].token, TOKENS.gitlab.value);
  assert.notEqual(lab.writers()[0].authorization, TOKENS.instance.value);
});

// TST-738114 · level: release · module: system
// guards: UC-021; ARTIFACTS ARE MARKDOWN
// given: the product with no group file; for each of the five kinds a nested arrangement of two levels
// input: the author saves each
// expect: each file is docs/groups/<kind>.md, ends in a newline, begins with a Markdown heading "# …", has no front matter and no JSON, and every other line is empty, the sentence that says what the file arranges, or an item of a Markdown list ("- …") indented by two spaces for each level
test("TST-738114: UC-021 every group file is Markdown", async () => {
  const w = await grouped();
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    addGroup(t, "Batch", "Lot");
    moveTo(itemOf(t, ITEMS[kind][0])[0], "Lot › Batch");
    await save(w, t);
    const text = w.files()[GROUP_PATH(kind)];
    assert.ok(GROUP_PATH(kind).endsWith(".md") && text.endsWith("\n") && !text.endsWith("\n\n"), kind);
    const lines = text.slice(0, -1).split("\n");
    assert.match(lines[0], /^# \S/, kind);
    assert.doesNotMatch(text, /^---$|[{}[\]]/m, `${kind}: no front matter, no JSON`);
    assert.match(lines[2], /^The hierarchy of the .+, each member by its (identifier|name)\.$/, kind);
    for (const line of lines.slice(3)) assert.match(line, /^$|^( {2})*- \S/, `${kind}: ${line}`);
  }
});

// TST-738115 · level: release · module: system
// guards: UC-021; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT
// given: a product repository on GitHub with the group file of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099); the author moves UC-044 into Derivation and UC-099 into Review, and saves
// input: the files of the repository are read as a reader without Agent M reads them: the group file by its indentation alone
// expect: every request that writes goes to the product's repository (nothing to the instance's); the group file holds no address, no path and no name of Agent M; its list rebuilds, from its text alone, the arrangement the author made — Review holds UC-041, UC-042 and UC-099, Derivation UC-043 and UC-044 — and each member but UC-099, which no use case matches, is a use case the product holds
test("TST-738115: UC-021 the group file is complete and readable without Agent M", async () => {
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Derivation");
  moveTo(itemOf(t, "UC-099")[0], "Review");
  await save(w, t);
  assert.ok(w.writers().every((request) => request.path.startsWith("/repos/alice/thesis-tool/")), "nothing is written outside the product's repository");
  const text = w.files()[US];
  assert.doesNotMatch(text, /https?:|agent[- ]?m|\.mjs|src\/|docs\/|github/i);
  const read = readList(text);
  assert.deepEqual(read.groups.map((group) => [group.title, group.members]), [["Review", ["UC-041", "UC-042", "UC-099"]], ["Derivation", ["UC-043", "UC-044"]]]);
  const held = Object.keys(w.files()).filter((path) => /^docs\/use-cases\/UC-\d+/.test(path)).map((path) => /UC-\d+/.exec(path)[0]);
  for (const member of read.groups.flatMap((group) => group.members).filter((id) => id !== "UC-099")) assert.ok(held.includes(member), `${member} is a use case the product holds`);
});

// TST-738116 · level: release · module: system
// guards: UC-021; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the arrangement of each of the five kinds, with the group file of the use cases; the repository's head read before
// input: the page of each kind is drawn and every control is used — + Group, Move to …, Rename, Move content up one level, a drag — and a script clicks every button of the page, Save arrangement among them
// expect: nothing is written and the head is the one it was; then the author's one click on Save arrangement of the use cases writes exactly one commit
test("TST-738116: UC-021 the arrangement writes to the repository only as the result of the author's click on Save arrangement", async () => {
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS } });
  const head = w.head();
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    addGroup(t, "Lot");
    moveTo(itemOf(t, ITEMS[kind][0])[0], "Lot");
    for (const node of find(t, (each) => each.localName === "button")) node.dispatchEvent(scripted());
    saveButton(t).dispatchEvent(scripted());
  }
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  for (const node of find(t, (each) => each.localName === "button")) node.dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual(w.writers(), []);
  assert.equal(w.head(), head);
  await save(w, t);
  assert.equal(w.writes().length, 1, "known positive: the author's click writes");
  assert.notEqual(w.head(), head);
});

// TST-738117 · level: release · module: system
// guards: UC-021; EVERY STEP EXPLAINS ITSELF
// given: the arrangement of each of the five kinds
// input: each page is drawn
// expect: it holds a folded explanation "What is this?" (a details element that is not open) whose text says that a group is only a heading, that a group has no identifier, that nothing realises it and no test guards it, and that moving an item changes nothing about the item; Propose groups carries a folded explanation of its participant
test("TST-738117: UC-021 the arrangement of each kind carries its folded explanation, and so does Propose groups", async () => {
  const w = await grouped();
  for (const kind of KINDS) {
    const t = await arrangement(w, kind);
    const details = byClass(t, "details", "explain");
    assert.ok(details.length >= 2, `${kind}: the page and Propose groups each explain themselves`);
    assert.ok(details.every((node) => !node.hasAttribute("open")), `${kind}: folded`);
    const first = textOf(details[0]);
    assert.match(first, /^What is this\?/, kind);
    assert.match(first, /A group is only a heading/);
    assert.match(first, /A group has no identifier/);
    assert.match(first, /nothing realises it and no test guards it/);
    assert.match(first, /changes where the item is listed and nothing about the item/);
    assert.match(textOf(byClass(t, "section", "arrange-propose")[0]), /What is this\?The participant is the model or agent that writes the draft/);
  }
});
