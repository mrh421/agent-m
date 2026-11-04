// Release tests of ITM-1293 — UC-033 step 3 on the issue's page: the move form marks a `builds_on` that names no item of the backlog, gives no mark for one that does, and shows only the marks of the drafted item. The behaviour is
// UC-033 (docs/use-cases/UC-033-move-an-issue-into-the-backlog.md, step 3: "Agent M checks the item as it checks a drafted item (UC-032, step 3) and names what fails; the Product Owner corrects it.", and step 4: "The Product Owner presses
// **Add**") as docs/architecture/MOD-maintenance-pages.md (Uses: "MOD-work-plans.backlogFindings — the item's marks while the person edits it") and docs/architecture/MOD-work-plans.md (`backlogFindings`: "an error for each item it builds on
// that is not among `items`") state it.
// Run: node --test tests/release-itm-1293-move-form-builds-on.test.mjs
//
// Module: MOD-maintenance-pages; MOD-work-plans
// Guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; ONE CLICK PER DECISION; UC-033
// Level: release
//
// Written for the release testing of sprint 116 by a participant who implemented none of ITM-1293 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the maintenance pages' tests (tests/maintenance-pages-world.mjs: the fake
// GitHub of alice/product with its issue, over the real MOD-repository-hosts) and the real route `issue` of MOD-maintenance-pages, as tests/release-itm-1254-issue-move.test.mjs draws it. The implementers' cases
// (tests/maintenance-pages-move-builds-on.test.mjs) type one identifier against a backlog of one item; these cases take backlogs of their own — three items, and three items one of which has marks of its own — and type several identifiers, a
// mix of existing and missing ones, and none, meeting the form from the outside: the marks it shows, whether Add is offered, and the file Add commits. Each case first shows that the form marks: the first assertion of a case is a mark
// the form is known to give (a missing item named in `builds_on`), so that a count of no mark stands for a form that checked and found none, not for a form that checks nothing. Readings the texts leave open, which the cases state:
//   - "the item's marks" (MOD-maintenance-pages Uses) is read as the findings on the drafted item, as the page's own comment names it ("kept for the drafted one alone"): a finding on a backlog item that stands beside the drafted one is no mark of the
//     form, whatever it says.
//   - "an error for each item it builds on that is not among `items`" (MOD-work-plans) is read as one mark for each missing item, naming it, however many items the field names.
//   - the field `builds_on` holds its items separated by commas, as the form's fields of every list key do (tests/maintenance-pages-move-lists.test.mjs).
//   - "Add stays enabled when all named items exist" is read as: Add is offered while no error remains, the form's own rule (MOD-site-frame `schemaForm`), once the item names what it realises and the module it changes.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/release-itm-1293-move-form-builds-on.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
// A backlog item as the product's repository holds it; `modules` and `builds_on` are lists, left out where empty.
const itemText = (id, title, { realises = ["UC-001"], modules = ["MOD-store"], builds_on = [] } = {}) => {
  const list = (key, values) => (values.length ? [`${key}:`, ...values.map((value) => `  - ${value}`)] : []);
  return ["---", `id: ${id}`, `title: ${title}`, "level: module", ...list("realises", realises), ...list("modules", modules), ...list("builds_on", builds_on), "---", `# ${id} ${title}`, ""].join("\n");
};
// The backlog of the product: ITM-0900 (the harness's small product holds it), and two items more.
const BACKLOG = {
  "docs/backlog/ITM-0901-second-work.md": itemText("ITM-0901", "Second work"),
  "docs/backlog/ITM-0902-third-work.md": itemText("ITM-0902", "Third work"),
};
const PRODUCT_FILES = { "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"), ...BACKLOG };
// An item of the backlog with marks of its own: it realises nothing, names no module and builds on ITM-0777, which the backlog lacks.
const BROKEN = { "docs/backlog/ITM-0903-broken-work.md": itemText("ITM-0903", "Broken work", { realises: [], modules: [], builds_on: ["ITM-0777"] }) };

afterEach(restoreWorld);

/** The world with the product chosen; its snapshots serve the graph of their commit, and its history holds no commit (as tests/maintenance-pages-move-lists.test.mjs gives them). */
function start(extra = {}) {
  const w = world({ mails: [], issues: [{ number: 7, title: "Export loses pages 7", body: "The export is cut off after the second page.", state: "open", labels: ["defect"], comments: [] }],
    answer: () => ({ draft: { class: "bug", reasoning: "", wrong: [] }, answers: [] }), product: { ...PRODUCT_FILES, ...extra } });
  const real = connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)), readHistory: async () => [] };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return w;
}
const moveOf = (detail) => byClass(detail, "issue-move")[0];
const fieldOf = (root, key) => walk(root, (node) => node.getAttribute?.("data-key") === key)[0];
const inputOf = (root, key) => walk(fieldOf(root, key), (node) => node.localName === "input")[0];
const findingsIn = (root) => walk(root, (node) => node.localName === "li" && /^(error|warning)$/.test(node.className)).map(textOf);
const typeInto = async (form, key, text) => { inputOf(form, key).value = text; inputOf(form, key).dispatchEvent(new Event("input")); await flush(); };
const addedFiles = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string" && entry.path.startsWith("docs/backlog/ITM-")).map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];
const missing = (id) => `the item builds on ${id}, which does not exist`;
/** The marks of the form that are about `builds_on`: the findings that say the item builds on an item. */
const buildsOnMarks = (form) => findingsIn(form).filter((text) => text.includes("the item builds on"));

/** The issue 7 opened, the person's click on Move to backlog, the form waited for, the backlog's items waited for, and the requirement FIRST RULE and the module MOD-store typed, so that the only marks left are those of builds_on. The issue is a bug, whose realises the person names. */
async function formOf(w, { backlog }) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "7" });
  await waitFor(() => moveOf(detail) !== undefined);
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  await waitFor(() => byClass(moveOf(detail), "existing-item").length > 0);
  assert.deepEqual(byClass(moveOf(detail), "existing-item").map((node) => node.getAttribute("data-item")), backlog, "the backlog the page read");
  const form = byClass(moveOf(detail), "schema-form")[0];
  await typeInto(form, "realises", "FIRST RULE");
  await typeInto(form, "modules", "MOD-store");
  return { detail, form };
}
const GOOD = ["ITM-0900", "ITM-0901", "ITM-0902"];

// TST-1293301 · level: release · module: MOD-maintenance-pages, MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: the issue 7, a bug, moved into a backlog of three items (ITM-0900, ITM-0901, ITM-0902); a bug, so the person types what it realises, FIRST RULE, and the module MOD-store
// input: the person types "ITM-0999" into the field builds_on (known positive); then "ITM-0900"; then "ITM-0900, ITM-0901, ITM-0902"; then "ITM-0902, ITM-0900"; then clears the field
// expect: known positive first — for "ITM-0999" the form shows `the item builds on ITM-0999, which does not exist` once; for each of the four that follow, no mark about builds_on stands in the form, no error of any kind stands in it, and Add is offered; for the cleared field too
// Planted fault: the form checked with the drafted item alone (`backlogFindings([live], architecture)` in extraChecks of moveSection, src/maintenance-pages/issues.mjs) marks ITM-0900 as an item that does not exist, and the case fails at the first existing item.
// Planted fault: the form checked beside the first item of the backlog only (`backlog.slice(0, 1)` in extraChecks of moveSection) passes the single ITM-0900 and fails at "ITM-0900, ITM-0901, ITM-0902", marking ITM-0901.
test("TST-1293301 a builds_on that names items of the backlog — one, several, in any order — gives the move form no mark, and none gives none", async () => {
  const w = start();
  const { form } = await formOf(w, { backlog: GOOD });
  await typeInto(form, "builds_on", "ITM-0999");
  assert.equal(buildsOnMarks(form).filter((text) => text.includes(missing("ITM-0999"))).length, 1, `known positive: a missing item is marked, once\n${findingsIn(form).join("\n")}`);
  assert.equal(buildsOnMarks(form).length, 1, findingsIn(form).join("\n"));
  for (const typed of ["ITM-0900", "ITM-0900, ITM-0901, ITM-0902", "ITM-0902, ITM-0900", ""]) {
    await typeInto(form, "builds_on", typed);
    assert.deepEqual(buildsOnMarks(form), [], `builds_on "${typed}": ${findingsIn(form).join("\n")}`);
    assert.deepEqual(walk(form, (node) => node.localName === "li" && node.className === "error").map(textOf), [], `builds_on "${typed}"`);
    assert.equal(buttonsOf(form, "Add")[0].disabled, false, `builds_on "${typed}": Add is offered`);
  }
});

// TST-1293302 · level: release · module: MOD-maintenance-pages, MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: the world of TST-1293301, realises FIRST RULE and the module MOD-store typed
// input: the person types "ITM-0999"; then "ITM-0998, ITM-0999"; then the mix "ITM-0900, ITM-0999, ITM-0901"; then the mix "ITM-0998, ITM-0902"; then "ITM-0900" again
// expect: for "ITM-0999" one mark, `the item builds on ITM-0999, which does not exist`; for "ITM-0998, ITM-0999" two marks, one for each, each naming its item; for the first mix one mark, naming ITM-0999 and neither ITM-0900 nor ITM-0901; for the second mix one mark, naming ITM-0998 and not ITM-0902; Add is not offered in the four; after "ITM-0900" again the marks are gone and Add is offered, so that the marks follow what the person types
// Planted fault: the form checked with no marks (`extraChecks: () => []` in moveSection, src/maintenance-pages/issues.mjs) shows no mark for a missing item, and the case fails at "ITM-0999".
// Planted fault: the form checked beside the first item of the backlog only (`backlog.slice(0, 1)` in extraChecks of moveSection) marks ITM-0901 in the first mix, and the case fails at the mix: a mark for an item the backlog holds.
test("TST-1293302 a builds_on that names items the backlog lacks is marked for each of them, and a mix of existing and missing ones is marked for the missing alone", async () => {
  const w = start();
  const { form } = await formOf(w, { backlog: GOOD });
  const marked = async (typed, expected) => {
    await typeInto(form, "builds_on", typed);
    assert.equal(buildsOnMarks(form).length, expected.length, `builds_on "${typed}": one mark for each missing item\n${findingsIn(form).join("\n")}`);
    for (const id of expected) assert.equal(buildsOnMarks(form).filter((text) => text.includes(missing(id))).length, 1, `builds_on "${typed}": ${id} is marked once`);
    assert.equal(buttonsOf(form, "Add")[0].disabled, true, `builds_on "${typed}": Add is not offered`);
  };
  await marked("ITM-0999", ["ITM-0999"]);
  await marked("ITM-0998, ITM-0999", ["ITM-0998", "ITM-0999"]);
  await marked("ITM-0900, ITM-0999, ITM-0901", ["ITM-0999"]);
  await marked("ITM-0998, ITM-0902", ["ITM-0998"]);
  assert.equal(findingsIn(form).filter((text) => /ITM-090[012]/.test(text)).length, 0, "no mark names an item the backlog holds");
  await typeInto(form, "builds_on", "ITM-0900");
  assert.deepEqual(buildsOnMarks(form), []);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false, "the marks follow what the person types");
});

// TST-1293303 · level: release · module: MOD-maintenance-pages, MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: a backlog of four items, ITM-0900 to ITM-0902 and ITM-0903, which realises nothing, names no module and builds on ITM-0777, an item the backlog lacks; the issue 7's form, realises FIRST RULE typed, no module typed
// input: the person leaves builds_on empty; then types "ITM-0999"; then types "ITM-0903"; then types the module MOD-store
// expect: known positive first — with no module typed, the form shows `the item names no module the architecture describes` once, the drafted item's own mark; no mark names ITM-0903, ITM-0777 or `realises nothing` (the marks of the backlog's own item); with "ITM-0999" the missing item is marked once and still no mark is ITM-0903's; with "ITM-0903" the form shows no mark about builds_on (an item that has marks of its own is an item that exists); after the module is typed no `names no module` mark stands in the form
// Planted fault: the marks of the whole backlog shown (`.filter((one) => one.artifact === (live.id || live.path))` left out of extraChecks of moveSection, src/maintenance-pages/issues.mjs) shows the item ITM-0903's marks — `names no module` twice, `realises nothing`, `builds on ITM-0777` — and the case fails at the count of the drafted item's own mark.
test("TST-1293303 the move form shows the marks of the drafted item alone, never a mark of an item of the backlog", async () => {
  const w = start(BROKEN);
  const { form } = await formOf(w, { backlog: [...GOOD, "ITM-0903"] });
  await typeInto(form, "modules", "");
  const own = "the item names no module the architecture describes";
  assert.equal(findingsIn(form).filter((text) => text.includes(own)).length, 1, `known positive: the drafted item's own mark, once\n${findingsIn(form).join("\n")}`);
  const strangers = () => findingsIn(form).filter((text) => /ITM-0903|ITM-0777|realises nothing/.test(text));
  assert.deepEqual(strangers(), [], "no mark of the backlog's own item");
  await typeInto(form, "builds_on", "ITM-0999");
  assert.deepEqual(buildsOnMarks(form).map((text) => text.includes(missing("ITM-0999"))), [true], findingsIn(form).join("\n"));
  assert.deepEqual(strangers(), []);
  assert.equal(findingsIn(form).filter((text) => text.includes(own)).length, 1, "still the drafted item's mark, once");
  await typeInto(form, "builds_on", "ITM-0903");
  assert.deepEqual(buildsOnMarks(form), [], `an item with marks of its own is an item that exists\n${findingsIn(form).join("\n")}`);
  assert.deepEqual(strangers(), []);
  await typeInto(form, "modules", "MOD-store");
  assert.equal(findingsIn(form).filter((text) => text.includes("names no module")).length, 0, findingsIn(form).join("\n"));
  assert.deepEqual(strangers(), []);
});

// TST-1293304 · level: release · module: MOD-maintenance-pages, MOD-work-plans, MOD-issue-handling
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; ONE CLICK PER DECISION; UC-033
// given: the world of TST-1293301, realises FIRST RULE and the module MOD-store typed
// input: the person types "ITM-0900, ITM-0901" into builds_on and clicks Add
// expect: no mark about builds_on stands in the form and Add is offered; the click commits one item of the backlog whose builds_on is the list ITM-0900, ITM-0901, each on a line of its own, whose modules is MOD-store and whose origin is the address of the issue 7; the page shows the item added and no problem
// Planted fault: the form checked with the drafted item alone (`backlogFindings([live], architecture)` in extraChecks of moveSection, src/maintenance-pages/issues.mjs) marks ITM-0900 and ITM-0901 as items that do not exist and withholds Add, and the case fails at the offer of Add.
test("TST-1293304 with every item named in builds_on in the backlog, Add is offered and commits the item with its builds_on", async () => {
  const w = start();
  const { detail, form } = await formOf(w, { backlog: GOOD });
  await typeInto(form, "builds_on", "ITM-0900, ITM-0901");
  assert.deepEqual(buildsOnMarks(form), [], findingsIn(form).join("\n"));
  assert.equal(buttonsOf(form, "Add")[0].disabled, false, "Add is offered");
  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1, "one item committed");
  assert.match(files[0].content, /builds_on:\n {2}- ITM-0900\n {2}- ITM-0901\n(?! {2}- )/);
  assert.match(files[0].content, /modules:\n {2}- MOD-store\n(?! {2}- )/);
  assert.match(files[0].content, new RegExp(`origin:\\n {2}- ${PRODUCT_URL}/issues/7\\n(?! {2}- )`));
});
