// The issue route reads the backlog through the artifacts' schemas (ITM-1298) — MOD-maintenance-pages' route `issue/<number>`, its *Move to backlog*, reads the backlog's items, the plan's steps and the
// module files through MOD-documents' `artifactSchemas` and `readDocument`, which its accepted text names among its Uses (docs/architecture/MOD-maintenance-pages.md, Uses: "MOD-documents.artifactSchemas —
// the item's schema for its form"; "MOD-documents.readDocument"); UC-033 steps 2 and 4a.
// Run: node --test tests/maintenance-pages-backlog-schemas-1298.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; UC-033
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs, as tests/maintenance-pages-move-1250.test.mjs sets it up: the product alice/product, whose files hold the backlog item docs/backlog/ITM-0900-work.md
// (tests/main-page-home-harness.mjs), and the issue 6 labelled defect. Readings the texts leave open, which the tests state (the pull request names them):
//   - The form holds a provisional identifier, the next that the items of the backlog and the steps of the plan leave free (MOD-maintenance-pages' issues.mjs, as ITM-1250 built it). Which file is an
//     item or a step, and its identifier, is the item schema's (`artifactSchemas().item`, whose paths are docs/plan/ITM-{nnn}-{slug}.md and docs/backlog/ITM-{nnn}-{slug}.md), read with `readDocument`:
//     a file elsewhere whose name begins with an ITM- identifier is neither.
//   - The page's own files hold no path pattern of an item or a module file: each is MOD-documents' (ITM-1298, Acceptance). The backlog's folder `docs/backlog/` is the SPEC's own (THE BACKLOG LIVES IN
//     THE PRODUCT REPOSITORY) and stays as that one folder name.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-backlog-schemas-1298.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: "The export is cut off after the second page.", state: "open", labels, comments: [] });
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const NOTE = "# A note\n\nAn aside, kept beside the backlog.\n";
const STEP = ["---", "id: ITM-950", "title: A step", "level: module", "modules:", "  - MOD-store", "tests:", "  - unit", "---", "# ITM-950 A step", "", "## Outcome", "", "Stored.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");

/** The world with the product chosen, its files those of the world's product and `files`; its host serves the stored graph and no history (as tests/maintenance-pages-move-1250.test.mjs). */
function start(files) {
  const w = world({ mails: [], issues: [issueRecord(6, ["defect"])], answer: () => ({ draft: null, answers: [] }), product: { "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"), ...files } });
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)), readHistory: async () => [] };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return w;
}
const moveOf = (detail) => byClass(detail, "issue-move")[0];
const fieldOf = (root, key) => walk(walk(root, (node) => node.getAttribute?.("data-key") === key)[0], (node) => node.localName === "input")[0];

/** The issue 6 opened, the person's click on Move to backlog, and the form's provisional identifier. */
async function provisional(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "6" });
  await waitFor(() => moveOf(detail) !== undefined && buttonsOf(moveOf(detail), "Move to backlog").length > 0);
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return fieldOf(byClass(moveOf(detail), "schema-form")[0], "id").value;
}

// TST-1298101 · level: unit · module: MOD-maintenance-pages
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: known positive first — the backlog holds ITM-0900 and the plan the step docs/plan/ITM-950-a-step.md; then, instead of that step, the note docs/notes/ITM-950-aside.md, a file outside the backlog and the plan whose name begins with ITM-950
// input: the route issue 6; Move to backlog by a person, once over each product
// expect: known positive: with the plan's step ITM-950 the form's identifier is ITM-951; with the note instead it is ITM-901, the next that the backlog's ITM-0900 leaves free — the note is no item
test("issue — the provisional identifier is the next that the backlog's items and the plan's steps leave free, a file elsewhere named ITM- not among them", async () => {
  assert.equal(await provisional(start({ "docs/plan/ITM-950-a-step.md": STEP })), "ITM-951", "known positive: a step of the plan takes its identifier");
  restoreWorld();
  assert.equal(await provisional(start({ "docs/notes/ITM-950-aside.md": NOTE })), "ITM-901");
});

// The code lines of the page's own files: every line that is not a comment.
const HERE = new URL("../src/maintenance-pages/", import.meta.url);
const codeLines = (text) => text.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
// A path pattern of an item or a module file, or a folder of them, written into the code as a regular expression.
const OWN_RULES = [/ITM-\\d/, /MOD-\[/, /docs\\\/(backlog|plan|architecture)\\\//];
const ownRules = (text) => codeLines(text).filter((line) => OWN_RULES.some((rule) => rule.test(line)));

// TST-1298102 · level: unit · module: MOD-maintenance-pages
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: known positive first — the lines `const MODULE_FILE = /^docs\/architecture\/MOD-[^/]+\.md$/;`, `const ITEM_FILE = /(?:^|\/)(ITM-\d{3,})-[^/]*\.md$/;` and `const BACKLOG_ITEM = /^docs\/backlog\/(ITM-\d{3,})-[^/]*\.md$/;`, each found; a comment naming docs/backlog/ITM-<n>-<slug>.md is not; the files of src/maintenance-pages/
// input: every code line of every .mjs file of src/maintenance-pages/
// expect: the planted lines are found and the comment is not; no line of the module holds a path pattern of an item or a module file
test("src/maintenance-pages holds no path pattern of an item or a module file of its own", () => {
  const planted = ["const MODULE_FILE = /^docs\\/architecture\\/MOD-[^/]+\\.md$/;", "const ITEM_FILE = /(?:^|\\/)(ITM-\\d{3,})-[^/]*\\.md$/;", "const BACKLOG_ITEM = /^docs\\/backlog\\/(ITM-\\d{3,})-[^/]*\\.md$/;", "//   - the items of the backlog (docs/backlog/ITM-<n>-<slug>.md), as /^docs\\/backlog\\/ITM-\\d/"].join("\n");
  assert.equal(ownRules(planted).length, 3, "known positive: the three planted lines are found, the comment is not");
  const found = readdirSync(HERE).filter((name) => name.endsWith(".mjs")).flatMap((name) => ownRules(readFileSync(new URL(name, HERE), "utf8")).map((line) => `${name}: ${line.trim()}`));
  assert.deepEqual(found, []);
});
