// Release tests of ITM-1254 — UC-033 1a, 4a and 4b on the issue's page: an issue not classified yet is led to UC-012, step 2; an issue is added to an item of the backlog that
// describes the same work, and both issues get the comment; and where no token may comment, the item is committed all the same and the comment is shown to copy. The behaviour is
// UC-033 (docs/use-cases/UC-033-move-an-issue-into-the-backlog.md, Alternative flows 1a, 4a and 4b) as docs/architecture/MOD-maintenance-pages.md (`issue/<number>`: "*Add*, which writes
// the item and the issue's comment and label with `moveToBacklog`, or names the comment to copy when the token may not comment") and docs/architecture/MOD-issue-handling.md
// (`moveToBacklog`: "When the token may not comment, the item is written all the same and the comment's text and the issue's address are returned for the person to copy") state it.
// Run: node --test tests/release-itm-1254-issue-move.test.mjs
//
// Module: MOD-maintenance-pages; MOD-issue-handling; MOD-review-pages
// Guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; EVERY ARTIFACT NAMES ITS ORIGIN; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// Level: release
//
// Written for the release testing of sprint 110 by a participant who implemented none of ITM-1254 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the
// maintenance pages' tests (tests/maintenance-pages-world.mjs: the fake GitHub of alice/product with its issues, comments and labels, over the real MOD-repository-hosts) and the real route
// `issue` of MOD-maintenance-pages. The component tests of the item (tests/maintenance-pages-move-1250.test.mjs, tests/issue-handling-backlog.test.mjs) press one control on one page; these cases
// walk the use case's alternative flows across pages and across worlds. Readings the texts leave open, which the cases state:
//   - 4a: "both issues get the comment" is read as each of the two issues carrying, once, the comment that names the one item and the address of its file, the first when the item was written and
//     the second when it was added to. "the item then names both issues as origins": the item's file after the second issue is the file after the first with the second issue's address added
//     to its origins, in that order, and nothing else changed.
//   - 4b: "the comment text with a copy button" is read as the text a successful comment would have carried, put on the clipboard by the button. The fake GitHub takes a commit without a token,
//     which a real server does not; the case without a token therefore stands for what the page does at the step of the comment when the host answers NotSupported itself, not for the commit.
//   - 1a: "Agent M links to UC-012, step 2" is read as a lead whose route is one the review pages serve and that is offered as long as the person has not confirmed a class — the class a participant
//     proposes is a proposal (UC-012 step 4: the person confirms it).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { view as reviewPages } from "../src/review-pages/index.mjs";
import { buttonsOf, byClass, flush, one, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/release-itm-1254-issue-move.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ADDRESS = (number) => `${PRODUCT_URL}/issues/${number}`;
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: "The export is cut off after the second page.", state: "open", labels, comments: [] });
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const PRODUCT_FILES = { "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/") };
const PROPOSAL = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs"] };

afterEach(restoreWorld);

/** The world with the product chosen; `token` false gives the host no token (the fake serves the public repository as it serves the token's). */
function start({ token = true, ...over } = {}) {
  const w = world({ mails: [], issues: [issueRecord(5, []), issueRecord(6, ["defect"]), issueRecord(7, ["defect"])], answer: () => ({ draft: PROPOSAL, answers: [] }), product: PRODUCT_FILES, ...over });
  const real = connect(parseAddress(PRODUCT_URL), token ? { token: PRODUCT_TOKEN } : {});
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)), readHistory: async () => [] };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: token };
  return w;
}
const moveOf = (detail) => byClass(detail, "issue-move")[0];
const fieldOf = (root, key) => walk(walk(root, (node) => node.getAttribute?.("data-key") === key)[0], (node) => node.localName === "input")[0];
const typed = async (field, value) => { field.value = value; field.dispatchEvent(new Event("input")); await flush(); };
// The files a world's server received as new blobs of the backlog, in the order they were written, once each.
const writtenItems = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string" && entry.path.startsWith("docs/backlog/ITM-")).map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];
const issueOf = (w, number) => w.kept.issues.find((each) => each.number === number);
const requestsTo = (w, pattern) => w.kept.github.filter((request) => pattern.test(`${request.method} ${request.path}`));

async function openIssue(w, number) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: String(number) });
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && (moveOf(detail) !== undefined || byClass(detail, "move-not-offered").length > 0));
  return detail;
}
/** Move to backlog pressed by the person, and the form waited for. */
async function moved(detail) {
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return byClass(moveOf(detail), "schema-form")[0];
}
/** The form completed for a bug (what it realises and the module it changes), and Add pressed by the person. */
async function added(detail) {
  const form = await moved(detail);
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store");
  await waitFor(() => buttonsOf(form, "Add")[0].disabled === false);
  assert.equal(buttonsOf(form, "Add")[0].disabled, false, "Add is offered once the item is complete");
  await trusted(buttonsOf(form, "Add")[0]);
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return detail;
}

// TST-1254301 · level: release · module: MOD-maintenance-pages, MOD-issue-handling
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; ONE CLICK PER DECISION; UC-033
// given: UC-033 alternative flow 4a. the product's backlog holds ITM-0900; the issues 6 and 7 are both bugs describing the same work; the person moves issue 6 into the backlog as a new item (realises FIRST RULE, changes MOD-store) and then opens issue 7 on the same page
// input: Add on issue 6; then, on issue 7, Move to backlog and the person's click on the button of the item just written (Add to <that item>)
// expect: issue 7 lists the item just written beside ITM-0900; the product received two writes of one file and of no other — the item's file after issue 7 is its file after issue 6 with the address of issue 7 added after the address of issue 6 in its origins and nothing else changed; each issue carries one comment, the note item-added naming that item and the address of its file, the same in both; both carry the label backlog; the page shows issue 7 as added to the item
// Planted fault: addTo handing `moveToBacklog` null in place of the item's identifier (src/maintenance-pages/issues.mjs) refuses the unused prefilled item (ItemsRefused), and the case fails on the absence of a problem on issue 7's page.
// Planted fault: moveToBacklog rewriting an existing item with the new issue's address alone (`origin: [issue.address]` in src/issue-handling/backlog.mjs) fails the assertion that only the origins differ.
test("TST-1254301 two issues describing the same work end as one item with both origins, and both issues carry its comment", async () => {
  const w = start();
  const six = await openIssue(w, 6);
  await added(six);
  const first = writtenItems(w);
  assert.equal(first.length, 1, "the first issue wrote one item");
  const [, id] = /^docs\/backlog\/(ITM-\d{3,})-/.exec(first[0].path);
  assert.notEqual(id, "ITM-0900", "a new item");

  const seven = await openIssue(w, 7);
  await moved(seven);
  await waitFor(() => byClass(moveOf(seven), "existing-item").length > 0);
  const offered = byClass(moveOf(seven), "existing-item").map((node) => node.getAttribute("data-item"));
  assert.deepEqual(offered, ["ITM-0900", id].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))), "the backlog's items, the one just written among them");
  await trusted(buttonsOf(byClass(moveOf(seven), "existing-item").find((node) => node.getAttribute("data-item") === id), `Add to ${id}`)[0]);
  await waitFor(() => byClass(moveOf(seven), "move-added").length > 0 || byClass(moveOf(seven), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(seven), "issue-problem").length, 0, textOf(moveOf(seven)));
  assert.ok(textOf(one(moveOf(seven), "move-added")).includes(id));

  const writes = writtenItems(w);
  assert.deepEqual(writes.map((file) => file.path), [first[0].path, first[0].path], "the product received two writes of one file and of no other");
  assert.ok(first[0].content.includes(`origin:\n  - ${ADDRESS(6)}\n`), first[0].content);
  assert.equal(writes[1].content, first[0].content.replace(`origin:\n  - ${ADDRESS(6)}\n`, `origin:\n  - ${ADDRESS(6)}\n  - ${ADDRESS(7)}\n`), "only the origins differ");
  const link = `${PRODUCT_URL}/blob/main/${first[0].path}`;
  for (const number of [6, 7]) {
    assert.equal(issueOf(w, number).comments.length, 1, `issue ${number} carries one comment`);
    assert.equal(issueOf(w, number).comments[0].startsWith(`Backlog item \`${id}\` added: ${link}`), true, issueOf(w, number).comments[0]);
    assert.deepEqual(issueOf(w, number).labels.sort(), ["backlog", "defect"], `issue ${number}`);
  }
  assert.equal(issueOf(w, 6).comments[0].replace(/\d{4}-\d{2}-\d{2}/, ""), issueOf(w, 7).comments[0].replace(/\d{4}-\d{2}-\d{2}/, ""), "the same comment on both");
});

// TST-1254302 · level: release · module: MOD-maintenance-pages, MOD-review-pages
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: UC-033 alternative flow 1a. known positive first — the issue 6 labelled defect is offered Move to backlog and no lead; the issue 5 has no class; a participant that proposes the class bug for it
// input: the issue 5 opened; Analyse run by a person (the proposal bug); the lead clicked by a person; the person's click on Bug
// expect: before and after the analysis the issue 5 offers no Move to backlog and says it is not classified, leading to "UC-012, step 2" — a proposal is no class —; the lead goes once, to the route "use-case" with the use case UC-012 of the instance itself (the empty product), and that route is one the review pages serve; after the person's click on Bug, Move to backlog is offered and the lead is gone
// Planted fault: the class a participant proposes counted as the issue's class and the move redrawn at the proposal (`state.proposal?.class` in currentClass and `drawMove()` in onProposal, src/maintenance-pages/issues.mjs) offers Move to backlog after the analysis, and the case fails on "a proposal is no class".
// Planted fault: the lead going to a route that is no route (`context.go("use-cases", …)`) fails the assertion on what went; MOD-review-pages' USE_CASES naming its route "use-cases" (src/review-pages/kinds.mjs) fails the assertion that the review pages serve the route the lead names.
test("TST-1254302 an issue the person has not classified is led to UC-012 step 2 whatever a participant proposes, by a route the review pages serve", async () => {
  const w = start();
  const six = await openIssue(w, 6);
  assert.equal(buttonsOf(moveOf(six), "Move to backlog").length, 1, "known positive: a classified bug is offered the move");
  assert.equal(byClass(six, "uc-012").length, 0);

  const five = await openIssue(w, 5);
  assert.equal(buttonsOf(five, "Move to backlog").length, 0);
  assert.match(textOf(one(five, "move-not-offered")), /not classified/i);
  assert.equal(textOf(one(five, "uc-012")), "UC-012, step 2");

  const radio = byClass(five, "participant").find((each) => each.value === "local-llm");
  radio.checked = true;
  one(five, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(five, "run-panel").length > 0);
  await trusted(buttonsOf(one(five, "run-panel"), "Run")[0]);
  await waitFor(() => byClass(five, "issue-proposal").length > 0 || byClass(five, "issue-problem").length > 0);
  assert.match(textOf(one(five, "proposed-class")), /bug/i, "known positive: the participant proposed the class bug");
  assert.equal(buttonsOf(five, "Move to backlog").length, 0, "a proposal is no class");
  assert.match(textOf(one(five, "move-not-offered")), /not classified/i);

  assert.deepEqual(w.context.went, []);
  await trusted(one(five, "uc-012"));
  assert.deepEqual(w.context.went, [["use-case", { id: "UC-012", product: "" }]]);
  assert.ok(reviewPages.routes.some((served) => served.name === w.context.went[0][0]), `the review pages serve the route ${w.context.went[0][0]}`);

  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => buttonsOf(five, "Move to backlog").length === 1);
  assert.equal(buttonsOf(five, "Move to backlog").length, 1);
  assert.equal(byClass(five, "uc-012").length, 0);
});

// The comment the successful way writes for issue 6 in a world of its own, which the comments to copy are compared with.
async function writtenComment() {
  const w = start();
  await added(await openIssue(w, 6));
  assert.equal(issueOf(w, 6).comments.length, 1, "known positive: a token that may comment writes the comment");
  const text = issueOf(w, 6).comments[0];
  const sent = requestsTo(w, /issues\/6\/(comments|labels)/).length;
  restoreWorld();
  return { text, sent };
}
const withClipboard = () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const copied = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { clipboard: { writeText: async (text) => { copied.push(text); } }, userAgent: "node" } });
  return { copied, restore: () => { if (prior) Object.defineProperty(globalThis, "navigator", prior); else delete globalThis.navigator; } };
};

// TST-1254303 · level: release · module: MOD-maintenance-pages, MOD-issue-handling
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// given: UC-033 alternative flow 4b. known positive first — in a world whose token may comment, Add on issue 6 writes the comment; the same world with a token that may not comment (GitHub answers 403 to a comment)
// input: Add on issue 6 by a person; then the person's click on Copy comment
// expect: the item is committed once; the issue has no comment and no label backlog; the page shows the comment text — the same, up to the date, as the comment the successful world wrote — beside the address of issue 6, and the click puts exactly that text on the clipboard
// Planted fault: the button copying the issue's address in place of the comment's text (`writeText(comment.issue)` in commentToCopy of src/maintenance-pages/issues.mjs) puts the address on the clipboard, and the case fails on "the clipboard holds the comment's text".
test("TST-1254303 where the token may not comment, the comment shown is the one that would have been written, and Copy comment copies it", async () => {
  const { text: wanted } = await writtenComment();
  const clipboard = withClipboard();
  try {
    const w = start({ commentStatus: 403 });
    const detail = await added(await openIssue(w, 6));
    assert.equal(writtenItems(w).length, 1, "the item is committed");
    assert.deepEqual(issueOf(w, 6).comments, []);
    assert.deepEqual(issueOf(w, 6).labels, ["defect"]);
    const shown = textOf(one(moveOf(detail), "comment-text"));
    assert.equal(one(moveOf(detail), "comment-issue").getAttribute("href"), ADDRESS(6));
    const dateless = (text) => text.replace(/\d{4}-\d{2}-\d{2}/, "<date>");
    assert.equal(dateless(shown), dateless(wanted));
    await trusted(buttonsOf(moveOf(detail), "Copy comment")[0]);
    assert.deepEqual(clipboard.copied, [one(moveOf(detail), "comment-text").textContent], "the clipboard holds the comment's text");
    assert.equal(dateless(clipboard.copied[0]), dateless(wanted));
  } finally { clipboard.restore(); }
});

// TST-1254304 · level: release · module: MOD-maintenance-pages, MOD-issue-handling, MOD-repository-hosts
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// given: UC-033 alternative flow 4b. known positive first (TST-1254303: the comment to copy is shown for a token that may not comment); this browser stores no token for the product, so that MOD-repository-hosts' commentOnIssue answers NotSupported before any request; the fake GitHub takes the commit (see the readings above)
// input: Add on issue 6 by a person
// expect: no problem is shown; the item is committed once; the page shows the comment to copy with the address of issue 6, the same text as the successful world's up to the date; no request to the comments or the labels of issue 6 was sent, and issue 6 is unchanged
// Planted fault: moveToBacklog passing a NotSupported of the comment on (`refused?.name !== "PermissionMissing"` alone in src/issue-handling/backlog.mjs, as before ITM-1254) shows the problem "The item could not be added" and no comment, and the case fails at the absence of a problem on the page.
test("TST-1254304 with no token stored, the item is written and the page shows the comment to copy, sending no request to the issue", async () => {
  const { text: wanted, sent } = await writtenComment();
  assert.equal(sent, 2, "known positive: with a token that may comment the page sends the comment and the label");
  const w = start({ token: false });
  const detail = await added(await openIssue(w, 6));
  assert.equal(writtenItems(w).length, 1, "the item is committed");
  assert.equal(one(moveOf(detail), "comment-issue").getAttribute("href"), ADDRESS(6));
  const dateless = (text) => text.replace(/\d{4}-\d{2}-\d{2}/, "<date>");
  assert.equal(dateless(textOf(one(moveOf(detail), "comment-text"))), dateless(wanted));
  assert.deepEqual(requestsTo(w, /issues\/6\/(comments|labels)/), [], "no request to the comments or the labels of the issue");
  assert.deepEqual(issueOf(w, 6).comments, []);
  assert.deepEqual(issueOf(w, 6).labels, ["defect"]);
});
