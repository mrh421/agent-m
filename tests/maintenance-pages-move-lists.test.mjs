// The form of *Move to backlog* is MOD-site-frame's schemaForm over the item schema itself, and *Add* hands `moveToBacklog` the lists (ITM-1257) — MOD-maintenance-pages' route `issue/<number>`, as docs/architecture/MOD-maintenance-pages.md
// states it: "*Move to backlog* with the item prefilled — its fields checked in a form while the person edits them —; *Add*, which writes the item and the issue's comment and label with `moveToBacklog`" (Interfaces), over
// "MOD-site-frame.schemaForm — [...] the form of a backlog item", "MOD-documents.artifactSchemas — the item's schema for its form" and "MOD-work-plans.backlogFindings — the item's marks while the person edits it" (Uses). UC-033 steps 2 to 4.
// Run: node --test tests/maintenance-pages-move-lists.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; ONE CLICK PER DECISION; UC-033
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs: its fake GitHub holds the issue 7 of alice/product, labelled change, with one change queue naming it, and takes git commits to the product, as tests/maintenance-pages-move-1250.test.mjs
// sets it up. The readings, named in the pull request: the item schema's own findings are those schemaForm shows beside the field of their key (the frame's rule); the form's field of a list key holds its items separated by commas.
// Each test states its input and its expected result before it runs (given / input / expect).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-move-lists.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const ADDRESS = `${PRODUCT_URL}/issues/7`;
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
// A queue whose entry is drafted from the issue 7, its rationale naming it (MOD-spec-changes, Data): one entry that replaces the section "## 1. Section" of SPEC.md, changing FIRST RULE and adding THIRD RULE.
const rule = (name, text) => [`**${name}** *(Product Owner)*`, text, "*Check:* no automatic check; at review.", ""];
const QUEUE = "docs/spec-freigaben/2026-10-20a_export";
const PRODUCT_FILES = {
  [`${QUEUE}/index.md`]: ["# SPEC approvals — queue 2026-10-20a · export", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. Section | — | |", ""].join("\n"),
  [`${QUEUE}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
  [`${QUEUE}/01-section.md`]: ["## 1. Section", "", ...rule("FIRST RULE", "The first rule holds on every page."), ...rule("SECOND RULE", "The second rule holds."), ...rule("THIRD RULE", "The third rule holds.")].join("\n"),
  [`${QUEUE}/01-section.begruendung.md`]: `# Reason\n\nWhy.\n\n**Issue:** #7 of ${PRODUCT_URL}\n`,
  "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"),
  "docs/architecture/MOD-pages.md": moduleText("MOD-pages", "src/pages/"),
};

afterEach(restoreWorld);

/** The world with the product chosen; its snapshots serve the graph of their commit, and its history holds no commit (as tests/maintenance-pages-move-1250.test.mjs gives them). */
function start() {
  const w = world({ mails: [], issues: [{ number: 7, title: "Export loses pages 7", body: "The export is cut off after the second page.", state: "open", labels: ["change"], comments: [] }],
    answer: () => ({ draft: { class: "change", reasoning: "", wrong: [] }, answers: [] }), product: PRODUCT_FILES });
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

/** The issue 7 opened, the person's click on Move to backlog, and the form waited for. */
async function formOf(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "7" });
  await waitFor(() => moveOf(detail) !== undefined);
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return { detail, form: byClass(moveOf(detail), "schema-form")[0] };
}

// TST-1257003 · level: unit · module: MOD-maintenance-pages
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: known positive first — the form of the issue 7 shows its realises FIRST RULE, THIRD RULE and, with no module named, the backlog's finding that the item names no module the architecture describes
// input: the person types "MOD-store, store" into the field modules
// expect: the item schema's finding on the item "store" — `the key modules does not fit: "store" is not an identifier` — stands beside the field modules, once in the whole form, and Add is not offered. Counter-proof: before the change the form's schema types modules as text, and the page's second check shows that finding at the end of the form, not beside the field
test("issue — the move form is schemaForm over the item schema: a finding on a module stands beside its field, once", async () => {
  const w = start();
  const { form } = await formOf(w);
  assert.equal(inputOf(form, "realises").value, "FIRST RULE, THIRD RULE");
  assert.ok(findingsIn(form).some((text) => text.includes("the item names no module the architecture describes")), findingsIn(form).join("\n"));
  await typeInto(form, "modules", "MOD-store, store");
  const finding = 'the key modules does not fit: "store" is not an identifier';
  assert.equal(findingsIn(fieldOf(form, "modules")).filter((text) => text.includes(finding)).length, 1, `beside the field modules:\n${findingsIn(fieldOf(form, "modules")).join("\n")}\nin the form:\n${findingsIn(form).join("\n")}`);
  assert.equal(findingsIn(form).filter((text) => text.includes(finding)).length, 1, findingsIn(form).join("\n"));
  assert.equal(buttonsOf(form, "Add")[0].disabled, true);
});

// TST-1257004 · level: unit · module: MOD-maintenance-pages
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; ONE CLICK PER DECISION; UC-033
// given: the form of the issue 7, whose realises are FIRST RULE and THIRD RULE
// input: the person types "MOD-store, MOD-pages" into the field modules, and clicks Add
// expect: no error stands in the form and Add is offered; the click commits one item of the backlog whose realises is the list FIRST RULE, THIRD RULE, whose modules is the list MOD-store, MOD-pages and whose origin is the list of the issue's address, each item on a line of its own, as moveToBacklog writes the lists it is handed
test("issue — Add hands moveToBacklog the lists the form holds", async () => {
  const w = start();
  const { detail, form } = await formOf(w);
  await typeInto(form, "modules", "MOD-store, MOD-pages");
  assert.deepEqual(walk(form, (node) => node.localName === "li" && node.className === "error").map(textOf), []);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false);
  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1);
  assert.match(files[0].content, /realises:\n {2}- FIRST RULE\n {2}- THIRD RULE\n(?! {2}- )/);
  assert.match(files[0].content, /modules:\n {2}- MOD-store\n {2}- MOD-pages\n(?! {2}- )/);
  assert.match(files[0].content, new RegExp(`origin:\\n {2}- ${ADDRESS}\\n(?! {2}- )`));
});
