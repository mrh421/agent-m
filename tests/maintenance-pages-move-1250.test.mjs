// An issue whose class is bug or change is moved to the backlog in one decision (ITM-1250) — MOD-maintenance-pages' route `issue/<number>` over MOD-issue-handling's `backlogItemFrom` and `moveToBacklog`, as the accepted text of
// docs/architecture/MOD-maintenance-pages.md (:117-126) states it: "*Move to backlog* with the item prefilled — its fields checked in a form while the person edits them —; *Add*, which writes the item and the issue's comment and label with `moveToBacklog`,
// or names the comment to copy when the token may not comment"; and (:119-120, :190-193) "MOD-spec-changes.queues — the change's queues, those whose `issue` names the number of the issue shown and the address of the product the frame has chosen;
// MOD-spec-changes.entryView — the requirements each of their entries changes or adds, its `impact`, given to `backlogItemFrom` as `changed`". UC-033 steps 1 to 4, 1a and 4b.
// Run: node --test tests/maintenance-pages-move-1250.test.mjs
//
// Module: MOD-maintenance-pages; MOD-issue-handling; MOD-work-plans; MOD-spec-changes
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; EVOLUTION ENTERS THROUGH THE SPECIFICATION; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// Level: component
//
// The world is tests/maintenance-pages-world.mjs: its model endpoint ep1 is the participant local-llm, its fake GitHub holds the issues of alice/product with their comments and labels and takes git commits to the product. The page, MOD-issue-handling,
// MOD-work-plans, MOD-spec-changes, MOD-documents, MOD-site-frame and MOD-repository-hosts are the real ones. Readings the texts leave open, which the tests state (the pull request names them):
//   - The move is a section of the issue's page, <section class="issue-move">, shown for an open issue whose class is bug or change — by its label, or by the person's click on a class — and for no other class; it offers <button> "Move to backlog" (the person's click).
//   - The click draws the item as a form of MOD-site-frame's schemaForm (<div class="schema-form">, one <div class="field" data-key="<key>"> with an <input> for each key of the item), whose list-valued keys (realises, modules, tests, origin) are typed as one text,
//     the names separated by commas; its one button is "Add"; it is offered only while no error remains (disabled otherwise), and the findings of MOD-work-plans' backlogFindings are shown beside the form as <li class="error">. The identifier the form holds is
//     provisional: `saveItems` gives the item the next one that no history holds.
//   - `changed` is every requirement the entries of the queues name as added or changed in `entryView`'s impact, in the order of the queues' entries, once each, for the queues whose `**Issue:**` line names this issue and this product. The analysis is the page's proposal, if
//     the person ran one: a bug realises the requirement the answer of `analyse-issue` names as violated (ITM-1374), and nothing until the person names it where the answer names none; its `modules` are the modules of the architecture whose folder holds a file it
//     names as wrong, none without a proposal.
//   - Add is the person's click on the form's button. It writes through `moveToBacklog`; the page then shows <p class="move-added"> with the item's identifier, or, when the comment was refused for want of the permission, <div class="move-comment"> with <pre class="comment-text">,
//     the issue's address as <a class="comment-issue"> and <button> "Copy comment".

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, one, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-move-1250.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE_BODY = "The export is cut off after the second page.";
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: ISSUE_BODY, state: "open", labels, comments: [] });
// Fresh for each world: the world copies an issue but not its list of comments.
const issuesOf = () => [issueRecord(5, []), issueRecord(6, ["defect"]), issueRecord(7, ["change"]), issueRecord(8, ["not-reproducible"])];
const ADDRESS = (number) => `${PRODUCT_URL}/issues/${number}`;

const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");

// A queue drafted from an issue (MOD-spec-changes, Data): one entry that replaces the section "## 1. Section" of SPEC.md.
const rule = (name, text, check) => [`**${name}** *(Product Owner)*`, text, `*Check:* ${check}`, ""];
const SECTION = (rules) => ["## 1. Section", "", ...rules.flat()].join("\n");
const FIRST_CHANGED = rule("FIRST RULE", "The first rule holds on every page.", "`tests/unit.test.mjs`");
const SECOND = rule("SECOND RULE", "The second rule holds.", "no automatic check; at review.");
const SECOND_CHANGED = rule("SECOND RULE", "The second rule holds for every export.", "no automatic check; at review.");
const THIRD = rule("THIRD RULE", "The third rule holds.", "no automatic check; at review.");
function queue(folder, issue, rules) {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 11)} · ${folder.slice(12)}`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. Section | — | |", ""].join("\n"),
    [`${base}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
    [`${base}/01-section.md`]: `${SECTION(rules)}`,
    [`${base}/01-section.begruendung.md`]: `# Reason\n\nWhy.\n\n**Issue:** #${issue.number} of ${issue.product}\n`,
  };
}
// Issue 7's queue changes FIRST RULE and adds THIRD RULE; another product's issue 7 and this product's issue 6 each have a queue changing SECOND RULE, which no issue-7 item may name.
const QUEUES = {
  ...queue("2026-10-20a_export", { number: 7, product: PRODUCT_URL }, [FIRST_CHANGED, SECOND, THIRD]),
  ...queue("2026-10-20b_other-product", { number: 7, product: "https://github.com/alice/other" }, [rule("FIRST RULE", "The first rule holds.", "`tests/unit.test.mjs`"), SECOND_CHANGED]),
  ...queue("2026-10-20c_other-issue", { number: 6, product: PRODUCT_URL }, [rule("FIRST RULE", "The first rule holds.", "`tests/unit.test.mjs`"), SECOND_CHANGED]),
};
const PRODUCT_FILES = { ...QUEUES, "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"), "docs/architecture/MOD-pages.md": moduleText("MOD-pages", "src/pages/") };

const PROPOSAL = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs", "tests/store.test.mjs"] };

afterEach(restoreWorld);

/**
 * The world with the product chosen. The fake GitHub of the world serves neither the branch trace-cache nor the history of the default branch, so that the product's host is given two answers (the pattern of tests/stored-graph-fake.mjs):
 * its snapshots serve the graph of their commit as the workflow "main changed" stores it — `entryView` reads the impact of an entry from it and a page never builds one —, and its history, which `saveItems` reads for the identifiers
 * the history holds, holds no commit.
 */
function start(over = {}) {
  const w = world({ mails: [], issues: issuesOf(), answer: () => ({ draft: PROPOSAL, answers: [] }), product: PRODUCT_FILES, ...over });
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)), readHistory: async () => [] };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return w;
}
const open = (w, number) => {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  return draw(routeNamed("issue"), w.context, { number: String(number) });
};
const moveOf = (detail) => byClass(detail, "issue-move")[0];
const fieldOf = (root, key) => walk(walk(root, (node) => node.getAttribute?.("data-key") === key)[0], (node) => node.localName === "input")[0];
const namesIn = (value) => String(value).split(",").map((name) => name.trim()).filter(Boolean);
// The world keeps a request for a tree twice (both of its branches note it), so that a file is taken once, by its path and text.
const addedFiles = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string" && entry.path.startsWith("docs/backlog/ITM-")).map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];
const issueOf = (w, number) => w.kept.issues.find((each) => each.number === number);

/** The issue opened and its move section drawn. */
async function opened(w, number) {
  const detail = await open(w, number);
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && moveOf(detail) !== undefined);
  assert.ok(moveOf(detail), `issue ${number} shows the section to move it to the backlog`);
  return detail;
}
/** The person's click on Move to backlog, and the form waited for. */
async function moved(detail) {
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return byClass(moveOf(detail), "schema-form")[0];
}

// TST-1250201 · level: component · module: MOD-maintenance-pages, MOD-issue-handling, MOD-work-plans, MOD-spec-changes
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; EVOLUTION ENTERS THROUGH THE SPECIFICATION; ONE CLICK PER DECISION; UC-033
// given: known positive first — the issue 7 labelled change; the product holds three queues: issue 7 of this product (FIRST RULE changed, THIRD RULE added), issue 7 of another product and issue 6 of this one (each changing SECOND RULE), and the module MOD-store
// input: the route issue 7; a click on Move to backlog by a script and then by a person; the module MOD-store typed; Add by a person
// expect: before the person's click no form; after it the item prefilled — the issue's title, the origin https://github.com/alice/product/issues/7, realises FIRST RULE and THIRD RULE and not SECOND RULE, no module —, and Add disabled with an error that names the module; once MOD-store is typed Add is enabled; the person's click commits one file docs/backlog/ITM-<nnn>-export-loses-pages-7.md whose origin, realises and modules are those, with the issue's text as its outcome; the issue 7 receives one comment, the note item-added naming that identifier and the file, and the label backlog; the page shows the identifier as added
test("issue — Move to backlog prefills the item with the requirements the issue's queues change, and Add writes it, the comment and the label", async () => {
  const w = start();
  const detail = await opened(w, 7);
  assert.equal(byClass(moveOf(detail), "schema-form").length, 0, "no form before the click");
  buttonsOf(moveOf(detail), "Move to backlog")[0].dispatchEvent(new Event("click"));
  await flush();
  assert.equal(byClass(moveOf(detail), "schema-form").length, 0, "a click by a script draws nothing");
  const form = await moved(detail);
  assert.equal(fieldOf(form, "title").value, "Export loses pages 7");
  assert.deepEqual(namesIn(fieldOf(form, "realises").value), ["FIRST RULE", "THIRD RULE"]);
  assert.deepEqual(namesIn(fieldOf(form, "origin").value), [ADDRESS(7)]);
  assert.deepEqual(namesIn(fieldOf(form, "modules").value), []);
  const add = buttonsOf(form, "Add")[0];
  assert.ok(add, "Add is offered");
  assert.equal(add.disabled, true, "Add waits for a module");
  assert.match(textOf(byClass(form, "error").find((node) => /module/i.test(textOf(node)))), /module/i);
  fieldOf(form, "modules").value = "MOD-store";
  fieldOf(form, "modules").dispatchEvent(new Event("input"));
  await waitFor(() => buttonsOf(form, "Add")[0].disabled === false);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false);
  assert.deepEqual(addedFiles(w), [], "nothing is written before Add");

  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1);
  const [, id] = /^docs\/backlog\/(ITM-\d{3,})-export-loses-pages-7\.md$/.exec(files[0].path) ?? [];
  assert.ok(id, `the item is a new file of the backlog: ${files[0].path}`);
  assert.ok(files[0].content.includes(`id: ${id}`) && files[0].content.includes(ADDRESS(7)), files[0].content);
  assert.match(files[0].content, /realises:\n {2}- FIRST RULE\n {2}- THIRD RULE\n/);
  assert.match(files[0].content, /modules:\n {2}- MOD-store\n/);
  assert.ok(files[0].content.includes(ISSUE_BODY), "the outcome is the issue's text");
  assert.ok(!files[0].content.includes("SECOND RULE"), "no requirement of another queue");
  assert.equal(issueOf(w, 7).comments.length, 1);
  assert.match(issueOf(w, 7).comments[0], new RegExp(`^Backlog item \`${id}\` added: .*docs/backlog/${id}-export-loses-pages-7\\.md`));
  assert.deepEqual(issueOf(w, 7).labels.sort(), ["backlog", "change"]);
  assert.ok(textOf(one(moveOf(detail), "move-added")).includes(id));
});

// TST-1250202 · level: component · module: MOD-maintenance-pages, MOD-issue-handling
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: the issue 6 labelled defect; the participant's analysis proposes the class bug and names the files src/store/read.mjs and tests/store.test.mjs as wrong; the product holds the modules MOD-store (src/store/) and MOD-pages (src/pages/); the queues of the product name the issue 6 with a change of SECOND RULE
// input: the analysis run by a person; Move to backlog by a person; the requirement FIRST RULE typed; Add by a person
// expect: the item changes MOD-store alone and realises nothing yet — a bug takes no requirement from the queues, and the analysis names none —, so that Add is disabled with an error that names what it realises; once FIRST RULE is typed Add is enabled and commits the item with the origin https://github.com/alice/product/issues/6, and comments on and labels issue 6
test("issue — for a bug the item changes the modules of the files the analysis names as wrong, takes no requirement from the queues, and is added once the person names what it realises", async () => {
  const w = start();
  const detail = await open(w, 6);
  await waitFor(() => byClass(detail, "participant").length > 0 && moveOf(detail) !== undefined);
  const radio = byClass(detail, "participant").find((each) => each.value === "local-llm");
  radio.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  await trusted(buttonsOf(one(detail, "run-panel"), "Run")[0]);
  await waitFor(() => byClass(detail, "issue-proposal").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(detail));
  const form = await moved(detail);
  assert.deepEqual(namesIn(fieldOf(form, "realises").value), []);
  assert.deepEqual(namesIn(fieldOf(form, "modules").value), ["MOD-store"]);
  assert.deepEqual(namesIn(fieldOf(form, "origin").value), [ADDRESS(6)]);
  assert.equal(buttonsOf(form, "Add")[0].disabled, true, "Add waits for the requirement");
  assert.match(textOf(byClass(form, "error").find((node) => /realises/i.test(textOf(node)))), /realises/i);
  fieldOf(form, "realises").value = "FIRST RULE";
  fieldOf(form, "realises").dispatchEvent(new Event("input"));
  await waitFor(() => buttonsOf(form, "Add")[0].disabled === false);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false);

  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1);
  assert.match(files[0].path, /^docs\/backlog\/ITM-\d{3,}-export-loses-pages-6\.md$/);
  assert.ok(files[0].content.includes(ADDRESS(6)));
  assert.match(files[0].content, /realises:\n {2}- FIRST RULE\n(?! {2}- )/);
  assert.match(files[0].content, /modules:\n {2}- MOD-store\n(?! {2}- )/);
  assert.equal(issueOf(w, 6).comments.length, 1);
  assert.deepEqual(issueOf(w, 6).labels.sort(), ["backlog", "defect"]);
});

// TST-1374101 · level: component · module: MOD-maintenance-pages
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-033
// given: the issue 6 labelled defect; the participant's analysis proposes the class bug, names the files src/store/read.mjs and tests/store.test.mjs as wrong and FIRST RULE as the requirement violated; the product holds MOD-store (src/store/) and MOD-pages (src/pages/); the queues of the product name the issue 6 with a change of SECOND RULE
// input: the analysis run by a person; Move to backlog by a person; Add by a person, with nothing typed
// expect: the item is prefilled with realises FIRST RULE alone — the requirement the analysis names as violated, none from the queues — and modules MOD-store; no error names what it realises and Add is enabled; Add commits the item with realises FIRST RULE and modules MOD-store
test("TST-1374101: issue — a bug's item realises the requirement the analysis names as violated, and is added without the person typing it", async () => {
  const w = start({ answer: () => ({ draft: { ...PROPOSAL, violated: "FIRST RULE" }, answers: [] }) });
  const detail = await open(w, 6);
  await waitFor(() => byClass(detail, "participant").length > 0 && moveOf(detail) !== undefined);
  const radio = byClass(detail, "participant").find((each) => each.value === "local-llm");
  radio.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  await trusted(buttonsOf(one(detail, "run-panel"), "Run")[0]);
  await waitFor(() => byClass(detail, "issue-proposal").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(detail));
  const form = await moved(detail);
  assert.deepEqual(namesIn(fieldOf(form, "realises").value), ["FIRST RULE"]);
  assert.deepEqual(namesIn(fieldOf(form, "modules").value), ["MOD-store"]);
  assert.equal(byClass(form, "error").filter((node) => /realises/i.test(textOf(node))).length, 0, textOf(form));
  await waitFor(() => buttonsOf(form, "Add")[0].disabled === false);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false, textOf(form));

  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1);
  assert.match(files[0].content, /realises:\n {2}- FIRST RULE\n(?! {2}- )/);
  assert.match(files[0].content, /modules:\n {2}- MOD-store\n(?! {2}- )/);
});

// TST-1250203 · level: component · module: MOD-maintenance-pages
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: the issues 5 (no class), 6 (defect), 7 (change) and 8 (not-reproducible)
// input: the route issue for 6, 7, 8 and 5; on 5 the person's clicks on Bug, on Not reproducible and on Change
// expect: 6 and 7 offer Move to backlog; 8 does not; 5 does not until the click on Bug, offers it after it, not after the click on Not reproducible, and offers it after the click on Change
test("issue — Move to backlog is offered for an issue classified as a bug or a change, and for no other", async () => {
  const w = start();
  for (const number of [6, 7]) {
    const detail = await opened(w, number);
    assert.equal(buttonsOf(moveOf(detail), "Move to backlog").length, 1, `issue ${number}`);
  }
  const eight = await open(w, 8);
  await waitFor(() => byClass(eight, "issue-analysis").length > 0);
  await flush();
  assert.equal(buttonsOf(eight, "Move to backlog").length, 0);
  const five = await open(w, 5);
  await waitFor(() => byClass(five, "set-class").length > 0);
  assert.equal(buttonsOf(five, "Move to backlog").length, 0);
  const setClass = async (cls, offered) => {
    await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === cls));
    await waitFor(() => buttonsOf(five, "Move to backlog").length === (offered ? 1 : 0));
    assert.equal(buttonsOf(five, "Move to backlog").length, offered ? 1 : 0, cls);
  };
  await setClass("bug", true);
  await setClass("not-reproducible", false);
  await setClass("change", true);
});

// TST-1250204 · level: component · module: MOD-maintenance-pages, MOD-issue-handling
// guards: UC-033; ONE CLICK PER DECISION
// given: known positive first (TST-1250201: the comment is written); the token may not comment (GitHub answers 403 to a comment); the issue 7 and its queue
// input: Move to backlog, the module typed, Add by a person
// expect: the item is committed all the same; the page shows no problem and, instead of the added line's comment, the comment's text — the note item-added naming the new identifier — in a pre with the issue's address and a Copy comment button; the issue is not labelled
test("issue — when the token may not comment the item is written and the page shows the comment to copy with the issue's address", async () => {
  const w = start({ commentStatus: 403 });
  const detail = await opened(w, 7);
  const form = await moved(detail);
  fieldOf(form, "modules").value = "MOD-store";
  fieldOf(form, "modules").dispatchEvent(new Event("input"));
  await waitFor(() => buttonsOf(form, "Add")[0].disabled === false);
  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-comment").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.equal(files.length, 1, "the item is committed");
  const [, id] = /^docs\/backlog\/(ITM-\d{3,})-/.exec(files[0].path);
  const comment = textOf(one(moveOf(detail), "comment-text"));
  assert.match(comment, new RegExp(`^Backlog item \`${id}\` added: `));
  assert.equal(one(moveOf(detail), "comment-issue").getAttribute("href"), ADDRESS(7));
  assert.equal(buttonsOf(moveOf(detail), "Copy comment").length, 1);
  assert.deepEqual(issueOf(w, 7).comments, []);
  assert.deepEqual(issueOf(w, 7).labels, ["change"]);
});

// ---------------------------------------------------------------- ITM-1254: UC-033 1a and 4a on the issue's page
// Readings the texts leave open, which these tests state (the pull request names them):
//   - 1a: for an open issue whose class is none yet (no label defect, change or not-reproducible), the place of the move says why it is not offered, <p class="move-not-offered">, and leads to UC-012 with <button class="uc-012"> "UC-012, step 2", which goes, on a
//     click, to Agent M's own use case (the context's `go("use-case", { id: "UC-012", product: "" })`, the empty product naming the instance itself), as the fix leads to UC-017. An issue classified as not reproducible is classified, so 1a does not apply to it.
//   - 4a: the click on Move to backlog also lists, beside the form, the items of the backlog at the default branch (docs/backlog/ITM-<n>-<slug>.md), each <li class="existing-item" data-item="<identifier>"> with its identifier and title and <button> "Add to <identifier>";
//     the person's click on it writes through `moveToBacklog` with `existing` the identifier, and the page shows <p class="move-added"> with that identifier, or the comment to copy as Add does.

const EXISTING_ITEM = "docs/backlog/ITM-001-export-keeps-every-page.md";
const EXISTING_TEXT = ["---", "id: ITM-001", "title: Export keeps every page", "level: module", "realises:", "  - FIRST RULE", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:", `  - ${ADDRESS(12)}`, "---",
  "# ITM-001 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");

// TST-1254201 · level: component · module: MOD-maintenance-pages
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: known positive first — the issue 6 labelled defect offers Move to backlog; the issue 5 without a class; the issue 8 labelled not-reproducible
// input: the route issue for 6, 8 and 5; on 5 the lead to UC-012 clicked by a person, then the person's click on Bug
// expect: 6 offers Move to backlog and no lead; 8 offers neither; 5 offers no Move to backlog but says why — the issue is not classified — and leads to UC-012, step 2, whose click goes to Agent M's own use case UC-012 — the empty product — and before which nothing goes; after the click on Bug, Move to backlog is offered and the lead is gone
test("issue — an issue not classified yet is not offered Move to backlog and is led to UC-012, step 2 (UC-033 1a)", async () => {
  const w = start();
  const six = await opened(w, 6);
  assert.equal(buttonsOf(moveOf(six), "Move to backlog").length, 1, "known positive: a bug is offered the move");
  assert.equal(byClass(six, "uc-012").length, 0);
  const eight = await open(w, 8);
  await waitFor(() => byClass(eight, "issue-analysis").length > 0);
  await flush();
  assert.equal(buttonsOf(eight, "Move to backlog").length, 0);
  assert.equal(byClass(eight, "uc-012").length, 0, "an issue classified as not reproducible is classified");
  const five = await open(w, 5);
  await waitFor(() => byClass(five, "set-class").length > 0 && byClass(five, "uc-012").length > 0);
  assert.equal(buttonsOf(five, "Move to backlog").length, 0);
  assert.match(textOf(one(five, "move-not-offered") ?? { textContent: "" }), /not classified/i);
  const lead = one(five, "uc-012");
  assert.ok(lead, "the lead to UC-012 is offered");
  assert.equal(textOf(lead), "UC-012, step 2");
  assert.deepEqual(w.context.went, [], "nothing goes before the click");
  await trusted(lead);
  assert.deepEqual(w.context.went, [["use-case", { id: "UC-012", product: "" }]]);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => buttonsOf(five, "Move to backlog").length === 1);
  assert.equal(buttonsOf(five, "Move to backlog").length, 1);
  assert.equal(byClass(five, "uc-012").length, 0);
});

// TST-1254202 · level: component · module: MOD-maintenance-pages, MOD-issue-handling, MOD-work-plans
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// given: known positive first (TST-1250201: Add writes a new item); the backlog holds ITM-001 "Export keeps every page" whose origin is the issue 12; the issue 7 labelled change describes the same work
// input: the route issue 7; Move to backlog by a person; "Add to ITM-001" clicked by a script, then by a person
// expect: beside the form the backlog's item ITM-001 is offered with its title; the script's click writes nothing; the person's click commits one file, docs/backlog/ITM-001-export-keeps-every-page.md, whose origins are the issue 12 and then the issue 7 and whose title is unchanged, and no new item; the issue 7 receives one comment, the note item-added naming ITM-001, and the label backlog; the page shows ITM-001 as added
test("issue — Move to backlog offers the backlog's items, and Add to an existing item adds the issue to its origins (UC-033 4a)", async () => {
  const w = start({ product: { ...PRODUCT_FILES, [EXISTING_ITEM]: EXISTING_TEXT } });
  const detail = await opened(w, 7);
  await moved(detail);
  await waitFor(() => byClass(moveOf(detail), "existing-item").length > 0);
  // The world's product holds the item ITM-0900 too (tests/main-page-home-harness.mjs, smallProduct), which is offered as well.
  const offered = byClass(moveOf(detail), "existing-item");
  assert.deepEqual(offered.map((node) => node.getAttribute("data-item")), ["ITM-001", "ITM-0900"]);
  assert.match(textOf(offered[0]), /ITM-001.*Export keeps every page/);
  const add = buttonsOf(offered[0], "Add to ITM-001")[0];
  assert.ok(add, "Add to ITM-001 is offered");
  add.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(addedFiles(w), [], "a click by a script writes nothing");

  await trusted(add);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = addedFiles(w);
  assert.deepEqual(files.map((file) => file.path), [EXISTING_ITEM]);
  assert.match(files[0].content, new RegExp(`origin:\\n {2}- ${ADDRESS(12)}\\n {2}- ${ADDRESS(7)}\\n`));
  assert.ok(files[0].content.includes("title: Export keeps every page"), files[0].content);
  assert.equal(issueOf(w, 7).comments.length, 1);
  assert.match(issueOf(w, 7).comments[0], /^Backlog item `ITM-001` added: .*docs\/backlog\/ITM-001-export-keeps-every-page\.md/);
  assert.deepEqual(issueOf(w, 7).labels.sort(), ["backlog", "change"]);
  assert.ok(textOf(one(moveOf(detail), "move-added")).includes("ITM-001"));
});
