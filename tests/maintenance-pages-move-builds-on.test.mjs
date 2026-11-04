// The move form checks `builds_on` against the backlog (ITM-1293) — MOD-maintenance-pages' route `issue/<number>`, as docs/architecture/MOD-maintenance-pages.md states it: "MOD-work-plans.backlogFindings — the item's marks while the
// person edits it" (Uses), with backlogFindings as docs/architecture/MOD-work-plans.md gives it: "an item [...] that builds on an item that does not exist". The marks are found with the backlog's items beside the drafted one, so that an item the
// backlog holds is no item that does not exist. UC-033 step 3.
// Run: node --test tests/maintenance-pages-move-builds-on.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs: its fake GitHub holds the issue 7 of alice/product, labelled change, with one change queue naming it, and the product's backlog holds the item ITM-0900 (tests/main-page-home-harness.mjs,
// smallProduct), as tests/maintenance-pages-move-lists.test.mjs sets it up. The backlog's items are those the page reads for *Add to <identifier>* (ITM-1254). The reading, named in the pull request: a mark of the form is a finding on the
// drafted item; a backlog item's own findings are not marks of the form.
// Each test states its input and its expected result before it runs (given / input / expect).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-move-builds-on.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

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
};

afterEach(restoreWorld);

/** The world with the product chosen; its snapshots serve the graph of their commit, and its history holds no commit (as tests/maintenance-pages-move-lists.test.mjs gives them). */
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

/** The issue 7 opened, the person's click on Move to backlog, the form waited for, and the module MOD-store typed, so that the only marks left are those of builds_on. */
async function formOf(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "7" });
  await waitFor(() => moveOf(detail) !== undefined);
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  await waitFor(() => byClass(moveOf(detail), "existing-item").length > 0);
  assert.deepEqual(byClass(moveOf(detail), "existing-item").map((node) => node.getAttribute("data-item")), ["ITM-0900"], "the backlog holds ITM-0900");
  const form = byClass(moveOf(detail), "schema-form")[0];
  await typeInto(form, "modules", "MOD-store");
  return form;
}

// TST-1293001 · level: unit · module: MOD-maintenance-pages
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: known positive first (TST-1293002: an item the backlog lacks is marked); the form of the issue 7, its realises FIRST RULE, THIRD RULE and its modules MOD-store; the backlog holds the item ITM-0900
// input: the person types "ITM-0900" into the field builds_on
// expect: no mark of the form names ITM-0900, no error stands in the form, and Add is offered. Counter-proof: on the code before ITM-1293 the form is checked with the drafted item alone, and shows the error `the item builds on ITM-0900, which does not exist`, with Add not offered
test("issue — a builds_on that names an item of the backlog gives the move form no mark", async () => {
  const w = start();
  const form = await formOf(w);
  await typeInto(form, "builds_on", "ITM-0900");
  assert.deepEqual(findingsIn(form).filter((text) => text.includes("ITM-0900")), [], findingsIn(form).join("\n"));
  assert.deepEqual(walk(form, (node) => node.localName === "li" && node.className === "error").map(textOf), []);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false);
});

// TST-1293002 · level: unit · module: MOD-maintenance-pages
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: the form of the issue 7, its realises FIRST RULE, THIRD RULE and its modules MOD-store; the backlog holds the item ITM-0900 and no item ITM-0999
// input: the person types "ITM-0999" into the field builds_on
// expect: the form shows the error `the item builds on ITM-0999, which does not exist` once, and Add is not offered; no mark of the form is one of a backlog item's own (none names ITM-0900)
test("issue — a builds_on that names an item the backlog lacks is marked in the move form", async () => {
  const w = start();
  const form = await formOf(w);
  await typeInto(form, "builds_on", "ITM-0999");
  assert.equal(findingsIn(form).filter((text) => text.includes("the item builds on ITM-0999, which does not exist")).length, 1, findingsIn(form).join("\n"));
  assert.deepEqual(findingsIn(form).filter((text) => text.includes("ITM-0900")), [], findingsIn(form).join("\n"));
  assert.equal(buttonsOf(form, "Add")[0].disabled, true);
});
