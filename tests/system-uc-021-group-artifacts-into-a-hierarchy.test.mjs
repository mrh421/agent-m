// System coverage for UC-021 Group artifacts into a hierarchy, walked through the dashboard: the main flow, steps 1 to 6, and the alternative flows 1a, 1b, 2a, 2b, 2c, 3a, 3b, 3c, 5a, 5b and 5c. The pages are MOD-site-frame's real
// review page, the real routes `arrange` and `use-case` of MOD-review-pages and `trace` of MOD-trace-pages, over the real MOD-repository-hosts host of GitHub or of a GitLab server, MOD-artifact-edits, MOD-group-document and
// MOD-trace-graph, behind the fixture servers of tests/uc-008-harness.mjs; the product and its group files are those of tests/uc-021-harness.mjs. No request leaves the process.
// Run: node --test tests/system-uc-021-group-artifacts-into-a-hierarchy.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-artifact-edits
// Module: MOD-group-document
// Module: MOD-trace-pages
// Guards: UC-021
// Level: system
//
// Authored by developer-sonnet-j (ITM-738), who implemented none of ITM-722, ITM-723, ITM-726, ITM-727 and ITM-737 and no UC-021 production behaviour.
// Where the pages and UC-021 disagree the case follows UC-021 and is marked { todo } with the finding it reports (UC021-F3, named in FLOW_FINDINGS).
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-738001), which holds the expected passages itself
// and checks that UC-021 still says them. A person's click is the page's own listener called with a trusted event; a script's click is made by `scripted()`. Readings the texts leave open, which the cases state:
//   - "an item or a group is moved by dragging it" is read as the drag events of the browser (dragstart on the item, drop on the group or on the tree), as the page listens to them.
//   - "(keyboard and screen reader reachable)" is read as: the control is a button, and the choice of the target is a select with an accessible name, both reached by the keyboard.
//   - 2a: the page offers an author only the items of the kind it arranges, so a move across kinds reaches the page as a participant's proposal (1b), which the tree refuses with the reason.
//   - 5b "an accepted change later": the SPEC of the default branch no longer holds the requirement, as an accepted removal leaves it; the group file is the commit before and after.
//   - 5c "puts the new group file on the clipboard and opens GitHub's editor at its path": the window opened is the page `edit` of the path where the file exists, the page `new` with the path where it does not.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BOOK_RETURN, LOAN_DATE, LOAN_EXTENSION, SHELF_PLACE, SPEC, TOKENS, USE_CASE_GROUPS, addGroup, arrangement, badgeOf, blobOf, browser, byClass, click, drag, find,
  groupFile, groupOf, grouped, itemOf, land, linksOf, marksOf, membersOf, moveTo, pending, propose, refused, results, rowOf, saveButton, scripted, textOf, topLevel, trace, treeOf, until, withProduct,
  GROUP_PATH } from "./uc-021-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-021-group-artifacts-into-a-hierarchy.md";
const SELF = "tests/system-uc-021-group-artifacts-into-a-hierarchy.test.mjs";
const US = GROUP_PATH("use-cases");
const withUseCaseGroups = { files: { [US]: USE_CASE_GROUPS } };
const group = (title, ...members) => [`- ${title}`, ...members.map((member) => `  - ${member}`)];
const arrangeAt = (w, kind) => `#arrange/kind=${kind}/product=${encodeURIComponent(w.address)}`;
/** The files of a world other than its group files, as { path: blob }: what a regrouping leaves as it is. */
const blobsOutsideGroups = (w) => Object.fromEntries(Object.entries(w.files()).filter(([path]) => !path.startsWith("docs/groups/")).map(([path, body]) => [path, blobOf(body)]));

// ---------------------------------------------------------------- the flow map

// The passages of UC-021 the system test walks, each with the tests that walk it; a passage the page does otherwise is a finding, a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-arrange": { uc: "the author presses **Arrange**. The list turns into the hierarchy of that kind", evidence: [[SELF, "TST-738002"]] },
  "main-2-new-group": { uc: "**+ Group** creates a group with a title, inside the selected group or at the top", evidence: [[SELF, "TST-738004"]] },
  "main-2-move": { uc: "or with **Move to …** (keyboard and screen reader reachable)", evidence: [[SELF, "TST-738004"]] },
  "main-2-rename": { uc: "a group is renamed in place", evidence: [[SELF, "TST-738004"]] },
  "main-3-pending": { uc: "Agent M lists the pending changes beside the tree", evidence: [[SELF, "TST-738005"]] },
  "main-3-rules": { uc: "a group holds one kind of artifact, an item has one place", evidence: [[SELF, "TST-738005"]] },
  "main-4-save": { uc: "The author presses **Save arrangement** — one click.", evidence: [[SELF, "TST-738007"]] },
  "main-5-commit": { uc: "commits the new version to the default branch under the author's own account", evidence: [[SELF, "TST-738007"]] },
  "main-5-nothing-else": { uc: "No other file is touched", evidence: [[SELF, "TST-738007"]] },
  "main-6-link": { uc: "The dashboard shows the commit as a link and the new hierarchy.", evidence: [[SELF, "TST-738007"]] },
  "1a-no-file": { uc: "**1a. The product has no group file of this kind yet.**", evidence: [[SELF, "TST-738008"]] },
  "1b-propose": { uc: "**1b. The author asks a participant to propose an arrangement**", evidence: [[SELF, "TST-738009"]] },
  "2a-other-kind": { uc: "**2a. The author tries to put an item into a group of another kind**", evidence: [[SELF, "TST-738010"]] },
  "2b-only-empty": { uc: "Only an empty group can be deleted", evidence: [[SELF, "TST-738011"]] },
  "2c-rename": { uc: "**2c. The author renames a group.** Only its title changes", evidence: [[SELF, "TST-738013"]] },
  "3a-unknown-leave": { uc: "The tree shows it as *unknown member*; the author removes it or leaves it.", evidence: [[SELF, "TST-738014"]] },
  "3b-not-yet-placed": { uc: "It is shown at the top level, marked *not yet placed*.", evidence: [[SELF, "TST-738016"]] },
  "3c-twice": { uc: "The tree shows both places and asks the author to keep one; nothing is saved until the item has one place.", evidence: [[SELF, "TST-738017"]] },
  "5a-changed": { uc: "**5a. The group file changed since step 1.** Nothing is written.", evidence: [[SELF, "TST-738018"]] },
  "5b-removed-from-spec": { uc: "**5b. A requirement in the group file is removed from the SPEC by an accepted change later.**", evidence: [[SELF, "TST-738019"]] },
  "5c-github": { uc: "*Save arrangement* puts the new group file on the clipboard and opens GitHub's editor at its path", evidence: [[SELF, "TST-738020"]] },
  "5c-gitlab": { uc: "On a GitLab product without a token, there is no save.", evidence: [[SELF, "TST-738021"]] },
  "main-1-tests-list": { uc: "or in the list of use cases, architecture elements, modules or tests, the author presses **Arrange**", evidence: [[SELF, "TST-738003"]] },
  "main-3-from-group": { uc: "*moved UC-007 from \"Review\" to \"Approval\"*", evidence: [[SELF, "TST-738006"]] },
  "2b-delete": { uc: "**2b. The author deletes a group.**", evidence: [[SELF, "TST-738012"]] },
  "1b-tests": { uc: "**1b. The author asks a participant to propose an arrangement**", evidence: [[SELF, "TST-738022"]] },
};
const FLOW_FINDINGS = {
  "3a-unknown-remove": { uc: "the author removes it or leaves it", finding: "UC021-F3", file: SELF, test: "TST-738015" },
};

// TST-738001 · level: system · module: system
// guards: UC-021
// given: UC-021 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 1a, 1b, 2a, 2b, 2c, 3a, 3b, 3c, 5a, 5b and 5c with its executable evidence or its finding
// expect: every named passage stands in UC-021; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-021 names is among the passages
test("TST-738001: UC-021 system coverage names the main flow and every alternative flow", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-021 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-021 contains ${needle}`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
  const named = [...uc.matchAll(/\*\*(\d[a-z])\. /g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ["1a", "1b", "2a", "2b", "2c", "3a", "3b", "3c", "5a", "5b", "5c"], "known positive: UC-021 names these eleven alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.slice(0, 2)));
  assert.deepEqual(named.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
});

// ---------------------------------------------------------------- step 1

// TST-738002 · level: system · module: system
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the product with a group file of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099 which matches no use case; UC-044 in no group) and one of the requirements (Lending, holding Loans: A LOAN HAS A DUE DATE, and A LOAN CAN BE EXTENDED ONCE; the other two requirements in no group); the author's token for the product is stored
// input: the author opens the specification browser and presses Arrange; then the list of use cases, of architecture decisions and of modules, and presses Arrange in each
// expect: the link of the specification browser leads to #arrange/kind=requirements, and the links of the lists of a product's page to #arrange/kind=use-cases, #arrange/kind=architecture and #arrange/kind=modules, each ending in /product=<the product's address, percent-encoded> (ITM-1355, ITM-1364); the page of use cases shows two groups, Review (UC-041, UC-042) and Derivation (UC-043, UC-099), with UC-044 once at the top level; the page of the requirements shows Lending with Loans nested in it; every item of each kind stands once; nothing is written
test("TST-738002: UC-021 1 Arrange in the specification browser and in the lists opens the hierarchy of that kind, nested, with every item in one place", async () => {
  const requirements = groupFile("requirements", ...group("Lending", `${BOOK_RETURN}`), "  - Loans", `    - ${LOAN_DATE}`, `    - ${LOAN_EXTENSION}`);
  const w = await grouped({ files: { [US]: USE_CASE_GROUPS, [GROUP_PATH("requirements")]: requirements } });
  const spec = await trace(w);
  assert.deepEqual(linksOf(spec).filter((a) => a.className === "arrange-link").map((a) => a.getAttribute("href")), [`#arrange/kind=requirements/product=${encodeURIComponent(w.address)}`]);
  const page = await w.open(`#use-case/product=${encodeURIComponent(w.address)}`);
  const hrefs = {};
  for (const [route, kind] of [["use-case", "use-cases"], ["decision", "architecture"], ["module", "modules"]]) {
    await page.go(withProduct(`#${route}`, w.address));
    const arrange = linksOf(page.target).filter((a) => a.textContent === "Arrange");
    assert.deepEqual(arrange.map((a) => a.getAttribute("href")), [`#arrange/kind=${kind}/product=${encodeURIComponent(w.address)}`], route);
    hrefs[kind] = arrange[0].getAttribute("href");
  }
  await page.go(hrefs["use-cases"]);
  assert.match(textOf(page.target), /^Arrange the use cases/);
  assert.deepEqual(byClass(page.target, "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Review", "Derivation"]);
  assert.deepEqual(membersOf(groupOf(page.target, "Review")), ["UC-041", "UC-042"]);
  assert.deepEqual(membersOf(groupOf(page.target, "Derivation")), ["UC-043", "UC-099"]);
  assert.deepEqual(topLevel(page.target), ["UC-044"]);
  assert.deepEqual(byClass(page.target, "li", "arrange-item").map((node) => node.getAttribute("data-id")).sort(), ["UC-041", "UC-042", "UC-043", "UC-044", "UC-099"], "every item once");
  await page.go(withProduct("#arrange/kind=requirements", w.address));
  const lending = groupOf(page.target, "Lending");
  assert.deepEqual(byClass(lending, "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Loans"], "Loans is nested in Lending");
  assert.deepEqual(membersOf(groupOf(page.target, "Loans")), [LOAN_DATE, LOAN_EXTENSION]);
  assert.deepEqual(topLevel(page.target), [SHELF_PLACE], "the requirement no group names, at the top level");
  assert.deepEqual(byClass(page.target, "li", "arrange-item").map((node) => node.getAttribute("data-id")).sort(), [BOOK_RETURN, LOAN_DATE, LOAN_EXTENSION, SHELF_PLACE].sort());
  assert.deepEqual(w.writers(), [], "nothing is written");
});

// TST-738003 · level: system · module: system
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS
// given: the product with its tests TST-101, TST-102 and TST-103 on the default branch; the author's token stored (known positive: the specification browser, and the lists of use cases, decisions and modules, link Arrange)
// input: the author opens the tests browser (the route trace with the key tests at main)
// expect: UC-021 step 1 "or in the list of use cases, architecture elements, modules or tests, the author presses Arrange": the tests browser offers one Arrange, a link to #arrange/kind=tests/product=<the product's address, percent-encoded>
test("TST-738003: UC-021 1 the list of tests offers Arrange", async () => {
  const w = await grouped();
  assert.equal(linksOf(await trace(w)).filter((a) => a.className === "arrange-link").length, 1, "known positive: the specification browser links Arrange");
  const tests = await trace(w, { key: "tests", ref: "main" });
  assert.match(textOf(tests), /TST-101/, "the tests are listed");
  assert.deepEqual(linksOf(tests).filter((a) => a.textContent === "Arrange").map((a) => a.getAttribute("href")), [`#arrange/kind=tests/product=${encodeURIComponent(w.address)}`]);
});

// ---------------------------------------------------------------- steps 2 and 3

// TST-738004 · level: system · module: system
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; ONE CLICK PER DECISION
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099; UC-044 in no group) on the dashboard
// input: + Group "Approval" at the top; + Group "Appeals" inside Review; Move to … of UC-044 to Approval; Move to … of the group Derivation to Approval; a drag of UC-041 onto Appeals; a drag of UC-042 onto the tree; Rename of Review to Chapters
// expect: each step shows in the tree at once, nothing written: Approval at the top; Appeals inside Review; UC-044 inside Approval; Derivation (with UC-043, UC-099) inside Approval; UC-041 inside Appeals; UC-042 at the top level; the group Review is called Chapters, with Appeals in it; every item stands once; every select of a move has an accessible name and each move is a button
test("TST-738004: UC-021 2 a group is created, an item or a group moved with Move to … or by dragging, and a group renamed in place", async () => {
  const w = await grouped(withUseCaseGroups);
  const page = await w.open(arrangeAt(w, "use-cases"));
  const t = page.target;
  addGroup(t, "Approval");
  assert.ok(groupOf(t, "Approval"), "Approval is a group at the top");
  assert.equal(topLevel(t).includes("Approval"), false);
  addGroup(t, "Appeals", "Review");
  assert.deepEqual(byClass(groupOf(t, "Review"), "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Appeals"], "Appeals is inside Review");
  moveTo(itemOf(t, "UC-044")[0], "Approval");
  assert.deepEqual(membersOf(groupOf(t, "Approval")), ["UC-044"]);
  moveTo(groupOf(t, "Derivation"), "Approval");
  assert.deepEqual(byClass(groupOf(t, "Approval"), "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Derivation"], "Derivation is inside Approval");
  assert.deepEqual(membersOf(groupOf(t, "Derivation")), ["UC-043", "UC-099"], "a moved group keeps what it holds");
  drag(itemOf(t, "UC-041")[0], groupOf(t, "Appeals"));
  assert.deepEqual(membersOf(groupOf(t, "Appeals")), ["UC-041"], "dragged onto a group");
  drag(itemOf(t, "UC-042")[0], treeOf(t));
  assert.deepEqual(topLevel(t), ["UC-042"], "dragged onto the tree: at the top level");
  const rename = byClass(groupOf(t, "Review"), "input", "arrange-rename")[0];
  rename.value = "Chapters";
  click(byClass(groupOf(t, "Review"), "button", "arrange-rename-go")[0]);
  assert.equal(groupOf(t, "Review"), undefined);
  assert.deepEqual(byClass(groupOf(t, "Chapters"), "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Appeals"], "renamed in place, with what it held");
  assert.deepEqual(byClass(t, "li", "arrange-item").map((node) => node.getAttribute("data-id")).sort(), ["UC-041", "UC-042", "UC-043", "UC-044", "UC-099"], "every item once");
  const moves = byClass(t, "select", "arrange-move");
  assert.ok(moves.length >= 5 && moves.every((select) => /^Move .+ to$/.test(select.getAttribute("aria-label") ?? "")), "each choice of a target has an accessible name");
  assert.ok(byClass(t, "button", "arrange-move-to").every((node) => node.localName === "button" && node.textContent === "Move to …"));
  assert.deepEqual(w.writers(), [], "nothing is written before Save arrangement");
});

// TST-738005 · level: system · module: system
// guards: UC-021; A GROUP HOLDS ONE KIND OF ARTIFACT; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099; UC-044 in no group)
// input: + Group "Approval"; Move to … of UC-043 to Approval; Move to … of UC-043 to Review; + Group "UC-050"
// expect: the pending changes stand beside the tree in the order they were made: "Add the group “Approval”", "Move UC-043 from “Derivation” to “Approval”", "Move UC-043 from “Approval” to “Review”"; UC-043 stands once, in Review; the group titled by an identifier is refused with a reason that names the identifier and is no pending change; nothing is written
test("TST-738005: UC-021 3 the pending changes are listed beside the tree, and the rules of the hierarchy are kept", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  addGroup(t, "Approval");
  moveTo(itemOf(t, "UC-043")[0], "Approval");
  moveTo(itemOf(t, "UC-043")[0], "Review");
  assert.deepEqual(pending(t), ["Add the group “Approval”", "Move UC-043 from “Derivation” to “Approval”", "Move UC-043 from “Approval” to “Review”"]);
  assert.equal(itemOf(t, "UC-043").length, 1, "an item has one place");
  assert.deepEqual(membersOf(groupOf(t, "Review")), ["UC-041", "UC-042", "UC-043"]);
  assert.deepEqual(membersOf(groupOf(t, "Approval")), []);
  addGroup(t, "UC-050");
  assert.equal(refused(t).length, 1);
  assert.match(refused(t)[0], /UC-050/);
  assert.equal(pending(t).length, 3, "the refused change is no pending change");
  const side = byClass(t, "ol", "arrange-pending")[0];
  assert.ok(side && byClass(t, "section", "arrange")[0], "the list stands within the arrangement, beside the tree");
  assert.deepEqual(w.writers(), []);
});

// TST-738006 · level: system · module: system
// guards: UC-021
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099)
// input: Move to … of UC-041 to Derivation
// expect: UC-021 step 3, whose example of a pending change is "moved UC-007 from "Review" to "Approval"": the pending change of UC-041 names the group it was moved from (Review) and the group it was moved to (Derivation)
test("TST-738006: UC-021 3 a pending move names the group the item was moved from", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-041")[0], "Derivation");
  assert.equal(pending(t).length, 1, "known positive: the move is a pending change");
  assert.match(pending(t)[0], /UC-041[^]*from[^]*Review[^]*Derivation/i);
});

// ---------------------------------------------------------------- steps 4 to 6

// TST-738007 · level: system · module: system
// guards: UC-021; REGROUPING LEAVES THE GROUPED FILE UNCHANGED; A REGROUPING IS COMMITTED DIRECTLY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the arrangement of the use cases on the dashboard (Review: UC-041, UC-042; Derivation: UC-043, UC-099; UC-044 in no group), with the author's token for the product, named "github.com/alice", and the instance's own token, both stored; the author moved UC-044 into Review and added the group Approval; known negative first — a click a script makes on Save arrangement
// input: a script clicks Save arrangement; then the author clicks it once; the page is read, and the arrangement opened again
// expect: the script's click writes nothing; the author's click makes exactly one commit on the default branch (a tree, a commit and the move of the branch main — no branch, no pull request) on the head the page was drawn from, of exactly one file docs/groups/use-cases.md, whose text is the canonical file with UC-044 last in Review and Approval empty at the end; every request that writes carries the product's token and none the instance's; the blob of SPEC.md and of every other file of the product is the one it was; the page names the commit as a link to the product's commit and shows the new hierarchy with UC-044 in Review, no pending change and no mark; opened again, the hierarchy is the same
test("TST-738007: UC-021 4 to 6 Save arrangement is one click: it commits the group file, and only it, under the author's own token, and shows the commit and the new hierarchy", async () => {
  const w = await grouped(withUseCaseGroups);
  const page = await w.open(arrangeAt(w, "use-cases"));
  const t = page.target;
  const before = blobsOutsideGroups(w), head = w.head();
  moveTo(itemOf(t, "UC-044")[0], "Review");
  addGroup(t, "Approval");
  saveButton(t).dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual(w.writers(), [], "known negative: a click a script makes writes nothing");
  click(saveButton(t));
  await until(() => w.writes().length === 1 && byClass(t, "a", "commit-link").length === 1, "the commit and its link");
  const [write, ...more] = w.writes();
  assert.equal(more.length, 0, "one click, one commit");
  assert.deepEqual(Object.keys(write.files), [US], "exactly the group file");
  assert.equal(write.files[US], ["# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", ...group("Review", "UC-041", "UC-042", "UC-044"), ...group("Derivation", "UC-043", "UC-099"), "- Approval", ""].join("\n"));
  assert.deepEqual(w.writers().map((request) => [request.method, request.path.replace("/repos/alice/thesis-tool", "")]),
    [["POST", "/git/trees"], ["POST", "/git/commits"], ["PATCH", "/git/refs/heads/main"]], "directly on the default branch");
  assert.equal(JSON.parse(JSON.stringify(w.writers().find((request) => request.path.endsWith("/git/commits")).body)).parents[0], head, "on the head the page was drawn from");
  assert.deepEqual(new Set(w.writers().map((request) => request.authorization)), new Set([`Bearer ${TOKENS.github.value}`]), "under the author's own token, never the instance's");
  assert.deepEqual(blobsOutsideGroups(w), before, "no other file is touched");
  const link = byClass(t, "a", "commit-link")[0];
  assert.equal(link.getAttribute("href"), `https://github.com/alice/thesis-tool/commit/${w.head()}`);
  assert.deepEqual(membersOf(groupOf(t, "Review")), ["UC-041", "UC-042", "UC-044"]);
  assert.deepEqual(pending(t), []);
  assert.deepEqual(byClass(t, "span", "mark").map((node) => node.textContent), ["unknown member"], "UC-099 stays unknown; UC-044 is no longer marked not yet placed");
  await page.go(arrangeAt(w, "use-cases"));
  assert.deepEqual(membersOf(groupOf(t, "Review")), ["UC-041", "UC-042", "UC-044"], "opened again: the same hierarchy");
});

// ---------------------------------------------------------------- the alternative flows

// TST-738008 · level: system · module: system
// guards: UC-021; EVERY HIERARCHY IS KEPT IN A GROUP FILE OF ITS OWN; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the product with no group file of the modules; two modules, MOD-reader and MOD-shelf
// input: the arrangement of the modules is opened; + Group "Shelving"; Move to … of MOD-shelf to Shelving; Save arrangement
// expect: before the changes both modules stand at the top level, each marked "not yet placed"; the save creates docs/groups/modules.md in one commit, whose text is "# Modules — groups", a blank line, "The hierarchy of the modules, each member by its identifier.", a blank line, "- Shelving", "  - MOD-shelf"; MOD-reader, which the author did not place, is shown at the top level and not written
test("TST-738008: UC-021 1a without a group file every item is at the top level, and the first Save arrangement creates the file", async () => {
  const w = await grouped();
  assert.equal(w.files()[GROUP_PATH("modules")], undefined, "known positive: the product has no group file of the modules");
  const t = await arrangement(w, "modules");
  assert.deepEqual(topLevel(t), ["MOD-reader", "MOD-shelf"]);
  assert.deepEqual(byClass(t, "span", "mark").map((node) => node.textContent), ["not yet placed", "not yet placed"]);
  addGroup(t, "Shelving");
  moveTo(itemOf(t, "MOD-shelf")[0], "Shelving");
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the first save");
  assert.deepEqual(Object.keys(w.writes()[0].files), [GROUP_PATH("modules")]);
  assert.equal(w.files()[GROUP_PATH("modules")], "# Modules — groups\n\nThe hierarchy of the modules, each member by its identifier.\n\n- Shelving\n  - MOD-shelf\n");
  assert.deepEqual(topLevel(t), ["MOD-reader"], "MOD-reader stays at the top level");
});

// TST-738009 · level: system · module: system
// guards: UC-021; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; DERIVATION SEES THE EXISTING REQUIREMENTS
// given: the arrangement of the use cases and of the requirements; the instance lists the participant drafter-a (a model endpoint at "this machine") that can draft text; the endpoint answers three moves: a new group Lending, UC-044 into it, and UC-043 into it
// input: drafter-a is chosen and Propose groups pressed; Run; then the author moves UC-041 into Lending himself; Save arrangement. The same for the requirements: Propose groups, Run
// expect: before Run the panel names one destination, drafter-a with "this machine", and the parts "the use-cases" and "docs/groups/use-cases.md", and the model was asked nothing; Run asks the model once, with the identifiers and the titles of the four use cases (UC-041 "Check out a book" … UC-044 "Reserve a book"); the proposal arrives as three pending changes in its order — "Add the group “Lending”", "Move UC-044 from the top level to “Lending”", "Move UC-043 from “Derivation” to “Lending”" —, and the author's move is the fourth; the job writes only its record under docs/jobs/ and no group file; Save arrangement commits the group file alone, holding Lending with UC-044, UC-043 and UC-041; for the requirements the request holds each name and its text ("Every loan states the date by which the book is returned.")
test("TST-738009: UC-021 1b Propose groups shows what is sent where, and the proposal arrives as pending changes that the author edits before saving", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  const proposal = await propose(w, t, [{ op: "create", title: "Lending", in: [] }, { op: "move", item: "UC-044", to: ["Lending"] }, { op: "move", item: "UC-043", to: ["Lending"] }]);
  try {
    const destinations = byClass(proposal.panel, "section", "destination");
    assert.equal(destinations.length, 1);
    assert.match(destinations[0].textContent, /drafter-a — drafter/);
    assert.match(destinations[0].textContent, /this machine/);
    assert.deepEqual(byClass(destinations[0], "li", "part").map((item) => item.textContent.split(" — ")[0]), ["the use-cases", US]);
    assert.deepEqual(proposal.asked, [], "nothing is sent before Run");
    await proposal.run();
    assert.equal(proposal.asked.length, 1, "the model is asked once");
    for (const needle of ["UC-041", "Check out a book", "UC-042", "Extend a loan", "UC-043", "Return a book", "UC-044", "Reserve a book"]) assert.ok(proposal.asked[0].includes(needle), `the request names ${needle}`);
    assert.deepEqual(pending(t), ["Add the group “Lending”", "Move UC-044 from the top level to “Lending”", "Move UC-043 from “Derivation” to “Lending”"]);
    moveTo(itemOf(t, "UC-041")[0], "Lending");
    assert.equal(pending(t).length, 4, "the author's change comes on top of the proposal");
    assert.ok(w.writes().every((write) => Object.keys(write.files).every((path) => path.startsWith("docs/jobs/"))), "the job writes its record and no group file");
    assert.equal(w.files()[US], USE_CASE_GROUPS, "the group file is as it was");
    const jobs = w.writes().length;
    click(saveButton(t));
    await until(() => w.writes().length === jobs + 1, "the save");
    assert.deepEqual(Object.keys(w.writes().at(-1).files), [US], "Save arrangement commits the group file alone");
    assert.ok(w.files()[US].includes(["- Lending", "  - UC-044", "  - UC-043", "  - UC-041"].join("\n")), w.files()[US]);
  } finally { proposal.restore(); }
  const r = await arrangement(w, "requirements");
  const second = await propose(w, r, []);
  try {
    await second.run();
    assert.ok(second.asked[0].includes(LOAN_DATE) && second.asked[0].includes("Every loan states the date by which the book is returned."), "a requirement is sent with its text");
  } finally { second.restore(); }
});

// TST-738010 · level: system · module: system
// guards: UC-021; A GROUP HOLDS ONE KIND OF ARTIFACT
// given: the arrangement of the requirements of the product, and a participant whose proposal puts the use case UC-041 into a group of requirements (a new group Lending, and then UC-041 into it) and a module MOD-shelf into it
// input: Propose groups and Run
// expect: the new group is a pending change; both moves across kinds are refused: each is listed beside the tree with a reason that says UC-041 is a use case, not a requirement, and MOD-shelf a module; neither is a pending change; neither item stands anywhere in the tree of the requirements; nothing is written but the job's record
test("TST-738010: UC-021 2a a use case moved into a group of requirements is refused, with the reason shown", async () => {
  const w = await grouped();
  const t = await arrangement(w, "requirements");
  const proposal = await propose(w, t, [{ op: "create", title: "Lending", in: [] }, { op: "move", item: "UC-041", to: ["Lending"] }, { op: "move", item: "MOD-shelf", to: ["Lending"] }]);
  try {
    await proposal.run();
    assert.deepEqual(pending(t), ["Add the group “Lending”"]);
    assert.equal(refused(t).length, 2);
    assert.match(refused(t)[0], /^Move UC-041 to “Lending”: UC-041 is a use case, not a requirement/);
    assert.match(refused(t)[1], /^Move MOD-shelf to “Lending”: MOD-shelf is a module, not a requirement/);
    assert.equal(itemOf(t, "UC-041").length + itemOf(t, "MOD-shelf").length, 0, "relations across kinds are traceability, not grouping");
    assert.deepEqual(membersOf(groupOf(t, "Lending")), []);
    assert.ok(w.writes().every((write) => Object.keys(write.files).every((path) => path.startsWith("docs/jobs/"))));
  } finally { proposal.restore(); }
});

// TST-738011 · level: system · module: system
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099); a participant whose proposal deletes the group Review, which holds two use cases
// input: Propose groups and Run; then Move content up one level of Review; Save arrangement
// expect: the deletion of the group that holds use cases is refused and listed with the reason that the group is not empty and its content is to be moved out first, and is no pending change; the lifting is one pending change, after which UC-041 and UC-042 stand at the top level and Review is empty; the saved file keeps Review (empty) and still lists UC-041 and UC-042 once each, UC-043 and UC-099 under Derivation: grouping deleted no item
test("TST-738011: UC-021 2b only an empty group is deleted: otherwise its content is moved out, up one level, and no item is deleted", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  const proposal = await propose(w, t, [{ op: "delete", group: ["Review"] }]);
  try {
    await proposal.run();
    assert.equal(refused(t).length, 1);
    assert.match(refused(t)[0], /^Delete the empty group “Review”: .*not empty; move what it holds out first/);
    assert.deepEqual(pending(t), []);
    assert.deepEqual(membersOf(groupOf(t, "Review")), ["UC-041", "UC-042"], "nothing was deleted");
  } finally { proposal.restore(); }
  click(byClass(groupOf(t, "Review"), "button", "arrange-lift")[0]);
  assert.deepEqual(pending(t), ["Move the content of “Review” up one level"]);
  assert.deepEqual(membersOf(groupOf(t, "Review")), []);
  assert.deepEqual(topLevel(t).sort(), ["UC-041", "UC-042", "UC-044"]);
  const jobs = w.writes().length;
  click(saveButton(t));
  await until(() => w.writes().length === jobs + 1, "the save");
  assert.equal(w.files()[US], ["# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- UC-041", "- UC-042", "- Review", ...group("Derivation", "UC-043", "UC-099"), ""].join("\n"));
});

// TST-738012 · level: system · module: system
// guards: UC-021
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099), in which the author moved the content of Review up one level, so that Review is empty (known positive: the group Review stands, empty, in the tree)
// input: the author looks for the control that deletes the empty group Review, and presses it; Save arrangement
// expect: UC-021 2b "The author deletes a group. Only an empty group can be deleted": the group Review offers a button named Delete (or Remove); pressed, it is the pending change "Delete the empty group “Review”"; the saved file no longer lists Review
test("TST-738012: UC-021 2b the author deletes an empty group", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  click(byClass(groupOf(t, "Review"), "button", "arrange-lift")[0]);
  assert.ok(groupOf(t, "Review") && membersOf(groupOf(t, "Review")).length === 0, "known positive: Review stands, empty");
  const del = find(groupOf(t, "Review"), (node) => node.localName === "button" && /^(Delete|Remove)/i.test(node.textContent));
  assert.equal(del.length, 1, "the group offers Delete");
  click(del[0]);
  assert.ok(pending(t).includes("Delete the empty group “Review”"));
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.equal(w.files()[US].includes("- Review"), false);
});

// TST-738013 · level: system · module: system
// guards: UC-021; THE NAME IS THE ID AND IT SURVIVES; REGROUPING LEAVES THE GROUPED FILE UNCHANGED
// given: the arrangement of the use cases (Review: UC-041, UC-042; Derivation: UC-043, UC-099), the files of the product as they stand
// input: Rename of Derivation to Approval; Save arrangement
// expect: the one pending change is "Rename the group “Derivation” to “Approval”"; the saved group file differs from the old one in one line, "- Derivation" read "- Approval", and lists the same members in the same places; the blob of every other file of the product is the one it was
test("TST-738013: UC-021 2c renaming a group changes only its title", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  const before = blobsOutsideGroups(w);
  const rename = byClass(groupOf(t, "Derivation"), "input", "arrange-rename")[0];
  rename.value = "Approval";
  click(byClass(groupOf(t, "Derivation"), "button", "arrange-rename-go")[0]);
  assert.deepEqual(pending(t), ["Rename the group “Derivation” to “Approval”"]);
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.equal(w.files()[US], USE_CASE_GROUPS.replace("- Derivation", "- Approval"));
  assert.deepEqual(blobsOutsideGroups(w), before);
});

// TST-738014 · level: system · module: system
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the group file of the use cases names UC-099, which no use case has any more (Derivation: UC-043, UC-099)
// input: the arrangement is opened; the author leaves UC-099 and moves UC-044 into Review; Save arrangement
// expect: UC-099 is shown in Derivation marked "unknown member", the only item so marked; the saved file still lists UC-099 under Derivation, once
test("TST-738014: UC-021 3a an identifier that no longer exists is shown as an unknown member, and the author may leave it", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  assert.deepEqual(marksOf(itemOf(t, "UC-099")[0]), ["unknown member"]);
  assert.deepEqual(byClass(t, "span", "mark").filter((mark) => mark.textContent === "unknown member").length, 1);
  assert.ok(membersOf(groupOf(t, "Derivation")).includes("UC-099"));
  moveTo(itemOf(t, "UC-044")[0], "Review");
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.equal(w.files()[US].split("\n").filter((line) => line.trim() === "- UC-099").length, 1);
  assert.ok(w.files()[US].includes("- Derivation\n  - UC-043\n  - UC-099"));
});

// TST-738015 · level: system · module: system
// guards: UC-021
// given: the arrangement of the use cases, in which UC-099 is an unknown member (known positive: it is marked)
// input: the author looks for the control that removes the unknown member UC-099; Save arrangement
// expect: UC-021 3a "the author removes it or leaves it": UC-099 offers a button named Remove (or Delete); pressed and saved, the group file no longer lists UC-099 and still lists every other member. FINDING: the unknown member offers only Move to …
test("TST-738015: UC-021 3a the author removes an unknown member", { todo: "FINDING UC021-F3 — itemNode (src/review-pages/arrange.mjs:191-198) draws the same controls for every member, Move to … only, and a move puts a member into a group (src/group-document/moves.mjs, `move`): MOD-group-document's GroupMove has no operation that takes a member out of the file (`No move deletes an item`, docs/architecture/MOD-group-document.md, applyMoves), so an unknown member can be left or moved but not removed on the page; UC-021 3a says the author removes it — an item for MOD-group-document and MOD-review-pages, and a gap between UC-021 3a and the accepted architecture text" }, async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  assert.deepEqual(marksOf(itemOf(t, "UC-099")[0]), ["unknown member"], "known positive");
  const remove = find(itemOf(t, "UC-099")[0], (node) => node.localName === "button" && /^(Remove|Delete|Drop)/i.test(node.textContent));
  assert.equal(remove.length, 1, "the unknown member offers Remove");
  click(remove[0]);
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.equal(w.files()[US].includes("UC-099"), false);
  for (const id of ["UC-041", "UC-042", "UC-043"]) assert.ok(w.files()[US].includes(id), id);
});

// TST-738016 · level: system · module: system
// guards: UC-021; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL; STATUS IS DERIVED FROM THE RECORDS
// given: the group file of the use cases as above; then a use case UC-045 written by another writer to the default branch (open: no approval record names it), after the author's group file
// input: the list of use cases is read; the arrangement is opened; the author moves UC-045 into Review and saves
// expect: UC-045 is listed open; the arrangement shows it once, at the top level, marked "not yet placed", beside UC-044; the group file has not been changed by the new use case; after the save UC-045 stands under Review, unmarked, and the list of use cases shows the same statuses as before (UC-041 open, UC-042 accepted, UC-043 changed since acceptance, UC-044 open, UC-045 open)
test("TST-738016: UC-021 3b a use case no group names is shown at the top level, marked not yet placed", async () => {
  const w = await grouped(withUseCaseGroups);
  const UC45 = "---\nid: UC-045\ntitle: Pay a fine\narea: lending\nactors:\n  - Member\nrealises:\n  - A LOAN HAS A DUE DATE\n---\n# UC-045 Pay a fine\n\n**Goal.** The member pays a fine.\n";
  await land(w, { "docs/use-cases/UC-045-pay-a-fine.md": UC45 });
  const list = await w.draw({}, "use-case");
  assert.deepEqual(["UC-041", "UC-042", "UC-043", "UC-044", "UC-045"].map((id) => badgeOf(rowOf(list, id))), ["open", "accepted", "changed since acceptance", "open", "open"]);
  const t = await arrangement(w, "use-cases");
  assert.equal(w.files()[US], USE_CASE_GROUPS, "the group file is as it was");
  assert.deepEqual(topLevel(t), ["UC-044", "UC-045"]);
  assert.deepEqual(marksOf(itemOf(t, "UC-045")[0]), ["not yet placed"]);
  assert.equal(itemOf(t, "UC-045").length, 1);
  moveTo(itemOf(t, "UC-045")[0], "Review");
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.deepEqual(marksOf(itemOf(t, "UC-045")[0]), []);
  assert.deepEqual(membersOf(groupOf(t, "Review")), ["UC-041", "UC-042", "UC-045"]);
  const after = await w.draw({}, "use-case");
  assert.deepEqual(["UC-041", "UC-042", "UC-043", "UC-044", "UC-045"].map((id) => badgeOf(rowOf(after, id))), ["open", "accepted", "changed since acceptance", "open", "open"]);
});

// TST-738017 · level: system · module: system
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the group file of the use cases names UC-041 twice — under Review and again under Derivation
// input: the arrangement is opened; Save arrangement; then Move to … of UC-041 to Review; Save arrangement
// expect: UC-041 is shown in both places, each marked "named twice"; the first Save writes nothing and says UC-041 would stand in more than one place; after the move UC-041 stands once, in Review, unmarked; the second Save commits the file with UC-041 once
test("TST-738017: UC-021 3c an item named twice is shown in both places, and nothing is saved until it has one place", async () => {
  const twice = USE_CASE_GROUPS.replace("  - UC-043\n", "  - UC-043\n  - UC-041\n");
  const w = await grouped({ files: { [US]: twice } });
  const t = await arrangement(w, "use-cases");
  const both = itemOf(t, "UC-041");
  assert.equal(both.length, 2);
  for (const node of both) assert.deepEqual(marksOf(node), ["named twice"]);
  click(saveButton(t));
  await w.quiet();
  assert.deepEqual(w.writes(), [], "nothing is saved");
  assert.match(results(t)[0], /UC-041 would stand in more than one place/);
  moveTo(itemOf(t, "UC-041")[0], "Review");
  assert.equal(itemOf(t, "UC-041").length, 1);
  assert.deepEqual(marksOf(itemOf(t, "UC-041")[0]), []);
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save");
  assert.equal(w.files()[US].split("\n").filter((line) => line.trim() === "- UC-041").length, 1);
});

// TST-738018 · level: system · module: system
// guards: UC-021; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the arrangement of the use cases opened; the author moved UC-044 into Review and added the group Later; then another writer's commit renames the group Review to Chapters in the group file
// input: Save arrangement; then Save arrangement again
// expect: the first save writes nothing; the page says the group file changed meanwhile and shows the newer hierarchy (Chapters, not Review) with the pending change "Add the group “Later”" still applied and the move of UC-044 into Review named as no longer applying; the second save commits on the newer head a file that holds Chapters and Later
test("TST-738018: UC-021 5a a group file that changed since it was read: nothing is written, the newer hierarchy shows the pending changes that still apply", async () => {
  const w = await grouped(withUseCaseGroups);
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  addGroup(t, "Later");
  await land(w, { [US]: USE_CASE_GROUPS.replace("- Review", "- Chapters") });
  const newer = w.head();
  click(saveButton(t));
  await until(() => results(t).some((line) => /changed/.test(line)), "the refusal");
  assert.deepEqual(w.writes(), [], "nothing is written");
  assert.ok(groupOf(t, "Chapters") && groupOf(t, "Review") === undefined, "the newer hierarchy is shown");
  assert.ok(groupOf(t, "Later"));
  assert.deepEqual(pending(t), ["Add the group “Later”"]);
  assert.ok(refused(t).some((line) => /UC-044/.test(line) && /Review/.test(line) && /no longer applies/.test(line)), refused(t).join(" | "));
  assert.equal(w.head(), newer, "the other writer's commit is still the head");
  click(saveButton(t));
  await until(() => w.writes().length === 1, "the save on the newer text");
  assert.ok(w.files()[US].includes("- Chapters") && w.files()[US].includes("- Later") && !w.files()[US].includes("- Review"));
});

// TST-738019 · level: system · module: system
// guards: UC-021; THE NAME IS THE ID AND IT SURVIVES
// given: the group file of the requirements names A BOOK CAN BE RETURNED under Lending; the SPEC of the default branch then loses that requirement, as an accepted removal leaves it (the group file is not in that commit)
// input: the arrangement of the requirements is opened
// expect: the group file is the blob it was; A BOOK CAN BE RETURNED stands in Lending marked "unknown member"; the three requirements the SPEC still holds are shown, A BOOK STANDS ON A SHELF at the top level, marked not yet placed
test("TST-738019: UC-021 5b a requirement removed from the SPEC stays in the group file and shows as an unknown member", async () => {
  const requirements = groupFile("requirements", ...group("Lending", LOAN_DATE, BOOK_RETURN));
  const w = await grouped({ files: { [GROUP_PATH("requirements")]: requirements } });
  const before = blobOf(w.files()[GROUP_PATH("requirements")]);
  await land(w, { "SPEC.md": SPEC.replace(/\*\*A BOOK CAN BE RETURNED\*\*[^]*?at review\n\n/, "") });
  assert.equal(w.files()["SPEC.md"].includes(BOOK_RETURN), false, "known positive: the SPEC no longer holds the requirement");
  assert.equal(blobOf(w.files()[GROUP_PATH("requirements")]), before, "the group file was not changed");
  const t = await arrangement(w, "requirements");
  assert.deepEqual(marksOf(itemOf(t, BOOK_RETURN)[0]), ["unknown member"]);
  assert.ok(membersOf(groupOf(t, "Lending")).includes(BOOK_RETURN));
  assert.deepEqual(membersOf(groupOf(t, "Lending")).filter((id) => id !== BOOK_RETURN), [LOAN_DATE]);
  assert.deepEqual(topLevel(t).sort(), [LOAN_EXTENSION, SHELF_PLACE].sort());
});

// TST-738020 · level: system · module: system
// guards: UC-021; NO TEXT TRAVELS IN A URL; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a GitHub product, no token stored for it; once with the group file of the use cases, once with none
// input: the author moves UC-044 into Review and presses Save arrangement; and in the product with no group file adds the group Review and presses Save arrangement
// expect: nothing is committed; the new group file is on the clipboard; the window opened is GitHub's editor of the existing file (https://github.com/alice/thesis-tool/edit/main/docs/groups/use-cases.md), and, where the file does not exist, GitHub's new-file page with the path (…/new/main?filename=docs%2Fgroups%2Fuse-cases.md&value=); no address holds any title or identifier of the arrangement
test("TST-738020: UC-021 5c without a token on GitHub the new group file is on the clipboard and GitHub's editor opens at its path", async () => {
  const w = await grouped({ token: false, files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  click(saveButton(t));
  await until(() => browser.opened.at(-1)?.includes("edit/main/docs/groups/use-cases.md"), "GitHub's editor");
  assert.deepEqual(w.writes(), [], "nothing is committed");
  assert.equal(browser.opened.at(-1), "https://github.com/alice/thesis-tool/edit/main/docs/groups/use-cases.md");
  assert.equal(browser.copied.at(-1), USE_CASE_GROUPS.replace("  - UC-042\n", "  - UC-042\n  - UC-044\n"));
  const fresh = await grouped({ token: false });
  const u = await arrangement(fresh, "use-cases");
  addGroup(u, "Review");
  click(saveButton(u));
  await until(() => browser.opened.at(-1)?.includes("new/main"), "GitHub's new-file page");
  assert.equal(browser.opened.at(-1), "https://github.com/alice/thesis-tool/new/main?filename=docs%2Fgroups%2Fuse-cases.md&value=");
  assert.equal(browser.copied.at(-1), "# Use cases — groups\n\nThe hierarchy of the use cases, each member by its identifier.\n\n- Review\n");
  assert.deepEqual(fresh.writes(), []);
  for (const address of browser.opened.slice(-2)) assert.ok(!/UC-044|Review/.test(address), address);
});

// TST-738021 · level: system · module: system
// guards: UC-021; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// given: a product on a GitLab server, no token stored for it; the group file of the use cases; and the same product with the project's token stored (known positive: with it Save arrangement commits)
// input: the author moves UC-044 into Review and presses Save arrangement, without the token and with it
// expect: without a token nothing is committed, no GitHub page is offered, and the page says the product is written with the project's own token and links the step that stores one; with the token one commit holds the group file, sent with the project's token
test("TST-738021: UC-021 5c on a GitLab product without a token there is no save", async () => {
  const stored = await grouped({ server: "gitlab", files: { [US]: USE_CASE_GROUPS } });
  const s = await arrangement(stored, "use-cases");
  moveTo(itemOf(s, "UC-044")[0], "Review");
  click(saveButton(s));
  await until(() => stored.writes().length === 1, "known positive: the save with the token");
  assert.deepEqual(Object.keys(stored.writes()[0].files), [US]);
  assert.equal(stored.writes()[0].token, TOKENS.gitlab.value);
  const w = await grouped({ server: "gitlab", token: false, files: { [US]: USE_CASE_GROUPS } });
  const t = await arrangement(w, "use-cases");
  moveTo(itemOf(t, "UC-044")[0], "Review");
  click(saveButton(t));
  await w.quiet();
  assert.deepEqual(w.writes(), []);
  assert.deepEqual(byClass(t, "a", "github-page"), []);
  assert.match(textOf(t), /A GitLab product is written with the project's own token/);
  assert.ok(byClass(t, "p", "arrange-result")[0] && linksOf(byClass(t, "p", "arrange-result")[0]).length > 0, "the step that stores the token is linked");
});

// TST-738022 · level: system · module: system
// guards: UC-021; THE PAGE NAMES WHERE IT SENDS
// given: the arrangement of the tests of the product (TST-101, TST-102, TST-103) with the participant drafter-a, whose answer is one move: a new group Lending (known positive: the same on the use cases is answered)
// input: Propose groups with drafter-a and Run
// expect: UC-021 1b offers Propose groups for the author's kinds, the tests among them: the model is asked once with the identifiers of the three tests, and the proposal arrives as the pending change "Add the group “Lending”"
test("TST-738022: UC-021 1b Propose groups on the tests", async () => {
  const w = await grouped(withUseCaseGroups);
  const known = await arrangement(w, "use-cases");
  const first = await propose(w, known, [{ op: "create", title: "Lending", in: [] }]);
  try {
    await first.run();
    assert.deepEqual(pending(known), ["Add the group “Lending”"], "known positive: the use cases are answered");
  } finally { first.restore(); }
  const t = await arrangement(w, "tests");
  const proposal = await propose(w, t, [{ op: "create", title: "Lending", in: [] }]);
  try {
    await proposal.run();
    assert.equal(proposal.asked.length, 1);
    for (const needle of ["TST-101", "TST-102", "TST-103"]) assert.ok(proposal.asked[0].includes(needle), needle);
    assert.deepEqual(pending(t), ["Add the group “Lending”"]);
  } finally { proposal.restore(); }
});
