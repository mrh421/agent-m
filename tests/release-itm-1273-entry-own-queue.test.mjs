// Release tests of ITM-1273 — a SPEC entry's page and a requirement's editor read their own queue through `queueAt` and the other open proposals through `waitingQueues`, and show the line "As of <commit>" while the overview they come from is of an earlier commit; the
// list of SPEC change entries and *Review all* are unchanged. The behaviour is UC-006 steps 1 and 2 (docs/use-cases/UC-006-approve-a-specification-change.md: "The reviewer opens the dashboard and selects an open entry" — "The dashboard shows the current SPEC section beside
// the proposal, the difference between them, and the rationale") and UC-018 step 4 (the editor of a requirement) as docs/architecture/MOD-review-pages.md (`<k>/<id>`: "For a SPEC entry, on `<k>/<id>` and for its subject, the page reads the entry's own queue (`queueAt`, the folder
// from the entry's identifier), and the other proposals on the same section from the queues MOD-progress-measures' `waitingQueues` gives, with its line `As of <commit>` while they are of an earlier commit; the editor of a requirement reads the other open proposals on its section
// the same way. Neither reads every queue.") and docs/architecture/MOD-spec-changes.md (`queueAt`: "the one queue whose folder is `folder` [...] `null` where the snapshot holds no such queue") state it.
// Run: node --test tests/release-itm-1273-entry-own-queue.test.mjs
//
// Module: MOD-review-pages; MOD-spec-changes
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006; UC-018
// Level: release
//
// Written for the release testing of sprint 111 by a participant who implemented none of ITM-1273 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the main page's tests (tests/main-page-home-harness.mjs: the counting fake GitHub behind the real
// MOD-repository-hosts, the browser of the instance, the branch overview-cache), with a product of 23 change queues whose SPEC holds three sections; the routes `spec-entry` and `requirement` of the real MOD-review-pages are drawn on one host of the product, whose snapshots serve the
// trace graph the workflow "main changed" stores (tests/stored-graph-fake.mjs). The implementers' tests (tests/review-pages-entry-own-queue.test.mjs, tests/spec-changes-queue-at.test.mjs) draw the page of one entry and one editor over one pair of queues; these cases look at the pages
// a reviewer meets across the queues — the list, *Review all*, an entry on a section of its own, an address that names no entry — and at the commits the overview and the head differ in. Readings the texts leave open, which the cases state:
//   - A queue "is read" when its index.md or entscheidungen.md is named to the server; "the other proposals" of a page are the entries not in the SPEC, on the same anchor, that are not the page's own entry.
//   - The overview is "of an earlier commit" when the branch overview-cache holds the overview of a commit c0 and latest.json naming it, and none of the head's; the line is an element of the class `as-of` that begins with "As of " and the first seven digits of c0.
//   - The list and *Review all* show the head, "unchanged": whatever the overview holds, they list every queue's entries of the head and the others of an entry are the head's.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { INSTANCE, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, byClass, draw, find, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";
import { sectionText } from "../src/spec-document/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";

const { view } = await import("../src/review-pages/index.mjs");
const entryRoute = view.routes.find((candidate) => candidate.name === "spec-entry");
const editRoute = view.routes.find((candidate) => candidate.name === "requirement");

const TICK = "\u0060";
const SPEC_DIR = "docs/spec-freigaben/";
const A1 = "## 1. Section", A2 = "## 2. Other", A3 = "## 3. Quiet";
const MINE = "2026-10-20_mine", OTHER = "2026-10-19_other", BATCH = "2026-10-21_batch-12";
const DECIDED = Array.from({ length: 20 }, (_, n) => `2026-09-01_decided-${String(n + 1).padStart(2, "0")}`);
const OLDER = "e".repeat(40);
const idOf = (folder, number) => `spec-${folder}-${String(number).padStart(2, "0")}`;
const SECTION_TWO = `${A2}\n\n**THIRD RULE** *(Product Owner)*\nThe third rule holds.\n*Check:* no automatic check; at review.\n`;
const SECTION_THREE = `${A3}\n\n**FOURTH RULE** *(Product Owner)*\nThe fourth rule holds.\n*Check:* no automatic check; at review.\n`;
const proposal = (anchor, tag) => (anchor === A1
  ? `${A1}\n\n**FIRST RULE** *(Product Owner)*\nThe first rule holds on every page${tag}.\n*Check:* ${TICK}tests/unit.test.mjs${TICK}\n\n**SECOND RULE** *(Product Owner)*\nThe second rule holds.\n*Check:* no automatic check; at review.\n`
  : SECTION_TWO.replace("holds.", `holds${tag}.`));

// One queue of the entries given, each [number, decided, anchor]: a decided entry has a decision row naming the commit that wrote it.
function queue(folder, entries) {
  const base = `${SPEC_DIR}${folder}`;
  const nn = (number) => String(number).padStart(2, "0");
  const files = {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...entries.map(([number, , anchor]) => `| ${nn(number)} | ${TICK}SPEC.md${TICK} | ${anchor} | — | — |`), ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", "",
      ...entries.filter(([, decided]) => decided).map(([number]) => `| 2026-09-08 10:00 UTC | ${number} | uebernommen | ${"c".repeat(40)} |`), ""].join("\n"),
  };
  for (const [number, , anchor] of entries) {
    files[`${base}/${nn(number)}-entry.md`] = proposal(anchor, ` in ${folder} ${nn(number)}`);
    files[`${base}/${nn(number)}-entry.begruendung.md`] = `# ${anchor}: a change\n\n**The change.** A fixture.\n\n**Why.** Clearer.\n`;
  }
  return files;
}
/** The product with the entries given for the three queues; the 20 decided ones and the SPEC of three sections are the same in every state. */
function product({ mine, other, batch }) {
  const small = smallProduct({ accepted: ["UC-001", "UC-002"] });
  small["SPEC.md"] += `\n${SECTION_TWO}\n${SECTION_THREE}`;
  return { ...small, ...Object.assign({}, ...DECIDED.map((folder) => queue(folder, [[1, true, A1]]))), ...queue(MINE, mine), ...queue(OTHER, other), ...queue(BATCH, batch) };
}
// c0: only OTHER's entry 01 is open. The head: it is open, and MINE's 02 and BATCH's 03 have come.
const AT_C0 = product({ mine: [[1, true, A1]], other: [[1, false, A1]], batch: [[1, true, A2], [2, true, A2]] });
const AT_HEAD = product({ mine: [[1, true, A1], [2, false, A1]], other: [[1, false, A1]], batch: [[1, true, A2], [2, true, A2], [3, false, A2]] });
// The head where OTHER's 01 has been accepted since c0.
const AFTER_ACCEPTANCE = product({ mine: [[1, true, A1], [2, false, A1]], other: [[1, true, A1]], batch: [[1, true, A2], [2, true, A2], [3, false, A2]] });

let net = null;
afterEach(() => { net?.restore(); net = null; timers.restore(); document.body?.replaceChildren(); });

/** The queues of a state of the product that have an entry not in the SPEC, as the overview stores them, read by a fake of their own. */
async function heldIn(files) {
  const probe = network({ [PRODUCT]: files, [INSTANCE]: instanceFiles() });
  probe.install();
  try {
    return (await queues(await connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }).readSnapshot("main"))).filter((each) => each.entries.some((entry) => entry.state !== "in SPEC"));
  } finally { probe.restore(); }
}

/**
 * The world: the fake GitHub holding the product at the head (`files`) and the instance, and on the product's branch overview-cache what `stored` says — "head": the overview of the head, with the queues that have an entry not in the SPEC as the head has them; "older": only the
 * overview of the commit c0, as the product was then (`AT_C0`), and latest.json naming it; "none": no branch.
 */
async function worldWith(files, stored) {
  const waitingAtHead = stored === "head" ? await heldIn(files) : null;
  const waitingAtC0 = stored === "older" ? await heldIn(AT_C0) : null;
  net = network({ [PRODUCT]: files, [INSTANCE]: instanceFiles() });
  net.install();
  const head = headOf(PRODUCT);
  const overview = (commit, held) => JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: held });
  if (stored === "head") net.overviews[PRODUCT] = { [head]: overview(head, waitingAtHead) };
  if (stored === "older") net.overviews[PRODUCT] = { [OLDER]: overview(OLDER, waitingAtC0), latest: JSON.stringify({ commit: OLDER }) };
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  const context = browser();
  context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return { context, head, mark: net.server.log.length };
}
/** Moves the branch overview-cache of the world to what `stored` says, as the workflow "main changed" would after the push. */
function storeHeadOverview(world, held) {
  net.overviews[PRODUCT] = { [world.head]: JSON.stringify({ commit: world.head, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: held }) };
}

const one = (target, name) => byClass(target, name)[0];
// The address of a SPEC entry on the product's page: the product stays in it (ITM-1355).
const entryHref = (id) => `#spec-entry/id=${id}/product=${encodeURIComponent(PRODUCT_URL)}`;
const hrefs = (node) => (node ? find(node, (kid) => kid.localName === "a").map((anchor) => anchor.getAttribute("href")) : []);
const othersOf = (target) => hrefs(one(target, "others"));
const asOf = (target) => byClass(target, "as-of").map((node) => node.textContent);
// The index and decisions files of the queues the server was asked for since `mark`, each once.
const queueFilesRead = (mark) => [...new Set(net.server.log.slice(mark).flatMap((entry) => entry.files).filter((path) => path.startsWith(SPEC_DIR) && /\/(index|entscheidungen)\.md$/.test(path)))].sort();
const overviewRequests = () => net.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}/`) && request.url.includes("ref=overview-cache")).map((request) => /contents\/([^?]+)\?/.exec(request.url)[1]);
// What a part of the page shows: its text and the markup MOD-markdown-render rendered into it (the fixture's document keeps innerHTML as it is given).
const shown = (node) => [node.textContent, ...find(node, () => true).map((kid) => (typeof kid.innerHTML === "string" ? kid.innerHTML : ""))].join(" ");
const open = async (world, route, params) => { const target = await draw(route, world.context, params); return target; };

// TST-1273301 · level: release · module: MOD-review-pages, MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: UC-006 step 1. the product of 23 queues at the head, where OTHER's 01, MINE's 02 and BATCH's 03 are open (OTHER's and MINE's on "## 1. Section", BATCH's on "## 2. Other"); the overview of an earlier commit c0 stored, in which OTHER's 01 alone was open; a token
// input: the list (the route spec-entry with no parameter) and Review all (id=all), and then the page of OTHER's 01 (id=spec-2026-10-19_other-01)
// expect: the list offers the three open entries of the head — the count 3 beside Review all, each as a link to its page with the product in the address (/product=<the product's address, percent-encoded>) — and no line As of; Review all shows the three, the others of OTHER's 01 being MINE's 02, those of MINE's 02 being OTHER's 01 and those of BATCH's 03 none, and no line As of — they are the head's, though the overview names one entry only; the list reads the index of every one of the 23 queues; the page of OTHER's 01 shows no other proposal and the line "As of eeeeeee", since its others are c0's — every link to an entry or to all the entries ends in /product=<the product's address, percent-encoded> (ITM-1355)
// Planted fault: Review all taking the other proposals from the waiting queues in place of the queues read (`described(await waitingQueues(snapshot), queue, …)` in place of `described({ around: all, asOf: null }, queue, …)` in src/review-pages/spec-entries.mjs) shows the line As of on every entry and no other proposal on OTHER's 01, and the case fails there.
test("TST-1273301 the list and Review all show the head's entries and the head's other proposals whatever the overview holds; an entry's page shows c0's, with the line", async () => {
  const world = await worldWith(AT_HEAD, "older");
  const list = await open(world, entryRoute, {});
  assert.match(list.textContent, /Review all 3 not accepted/, list.textContent.slice(0, 200));
  const openLinks = [idOf(BATCH, 3), idOf(MINE, 2), idOf(OTHER, 1)].map((id) => `#spec-entry/id=${id}/product=${encodeURIComponent(PRODUCT_URL)}`);
  for (const link of openLinks) assert.ok(hrefs(list).includes(link), `the list links ${link}`);
  assert.deepEqual(asOf(list), []);
  assert.deepEqual(queueFilesRead(world.mark).filter((path) => path.endsWith("/index.md")).length, 23, "the list reads the index of every queue");

  const all = await open(world, entryRoute, { id: "all" });
  assert.deepEqual(find(all, (node) => node.localName === "h2").map((node) => node.textContent), ["Review all — SPEC changes"]);
  const lists = byClass(all, "others").map((node) => hrefs(node));
  assert.deepEqual(lists, [[entryHref(idOf(MINE, 2))], [entryHref(idOf(OTHER, 1))], []], "the others of OTHER's 01, MINE's 02 and BATCH's 03, in the order of the identifiers");
  assert.deepEqual(asOf(all), []);

  const page = await open(world, entryRoute, { id: idOf(OTHER, 1) });
  assert.deepEqual(othersOf(page), [], "the overview of c0 names no proposal but this entry");
  assert.equal(asOf(page).length, 1, page.textContent.slice(0, 300));
  assert.match(asOf(page)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));
});

// TST-1273302 · level: release · module: MOD-review-pages, MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006; UC-018
// given: the head where OTHER's 01 has been accepted since c0 (a decision row in the SPEC) and MINE's 02 is open, both on "## 1. Section"; the overview of c0 stored, in which OTHER's 01 was open; a token
// input: the page of MINE's 02 and the editor of FIRST RULE with c0's overview only; then the same two with the head's overview stored (the workflow having run) and nothing else changed
// expect: with c0's overview the page of MINE's 02 lists OTHER's 01 among the others and the editor of FIRST RULE lists it, each under the line "As of eeeeeee" — the reviewer is told that the list is c0's —, and each shows the current section and the proposal as the head has them; with the head's overview the page lists no other proposal and the editor lists MINE's 02 alone, neither with a line As of; the proposal beside the current section is the same in both — every link to an entry or to all the entries ends in /product=<the product's address, percent-encoded> (ITM-1355)
// Planted fault: the line never drawn (`asOfLine` returning null in src/review-pages/common.mjs) leaves the reviewer with OTHER's 01 shown as open with no word that it is c0's, and the case fails on the line.
// Planted fault: the editor's line left out (`...[asOfLine(asOf)].filter(Boolean)` removed from the last `target.append` of src/review-pages/edit.mjs) leaves the editor listing c0's entries unmarked, and the case fails on the editor's line.
test("TST-1273302 an entry's page and a requirement's editor name an overview of an earlier commit with the line As of, and drop it once the head's overview is stored", async () => {
  const world = await worldWith(AFTER_ACCEPTANCE, "older");
  const entry = idOf(MINE, 2);
  const page = await open(world, entryRoute, { id: entry });
  assert.equal(one(page, "badge").textContent, "open", "known positive: the entry is open at the head");
  assert.match(shown(one(page, "proposal")), /The first rule holds on every page in 2026-10-20_mine 02/);
  assert.match(shown(one(page, "current")), /The first rule holds\./);
  assert.deepEqual(othersOf(page), [entryHref(idOf(OTHER, 1))], "c0's list still names OTHER's 01");
  assert.equal(asOf(page).length, 1);
  assert.match(asOf(page)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));
  const editor = await open(world, editRoute, { name: "FIRST RULE" });
  assert.deepEqual(othersOf(editor), [entryHref(idOf(OTHER, 1))]);
  assert.equal(asOf(editor).length, 1);
  assert.match(asOf(editor)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));

  storeHeadOverview(world, await heldIn(AFTER_ACCEPTANCE));
  const fresh = await open(world, entryRoute, { id: entry });
  assert.deepEqual(othersOf(fresh), [], "OTHER's 01 is accepted: it is no other proposal");
  assert.deepEqual(asOf(fresh), []);
  assert.equal(shown(one(fresh, "proposal")), shown(one(page, "proposal")), "the proposal is the same");
  const freshEditor = await open(world, editRoute, { name: "FIRST RULE" });
  assert.deepEqual(othersOf(freshEditor), [entryHref(entry)]);
  assert.deepEqual(asOf(freshEditor), []);
});

// TST-1273303 · level: release · module: MOD-review-pages, MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006
// given: the product of TST-1273301 at the head with the head's overview stored; the queue 2026-10-21_batch-12 (a slug that ends in two digits) holding the open entry 03 on "## 2. Other", beside which two entries are in the SPEC; a token
// input: the page of BATCH's 03 (id=spec-2026-10-21_batch-12-03), and, in the context it was drawn in, the subject it gives the prompt bar
// expect: the heading "2026-10-21_batch-12 · entry 03", the badge open, the proposal beside the SPEC's section "## 2. Other", no other proposal on that section (OTHER's and MINE's are on another) and no line As of; the queue files asked for are 2026-10-21_batch-12's index.md and entscheidungen.md and no other queue's, one request for the head's overview; the subject's key is spec-entry/id=<id>/product=<the product's address>, its title the identifier, and its parameters name the entry as the target, THIRD RULE as the requirement it changes and the blob of the SPEC's section "## 2. Other" as the version
// Planted fault: the folder taken from the identifier without the digits its slug ends in (`parts[1].replace(/-\d+$/, "")` in entryAt of src/review-pages/spec-entries.mjs) finds no queue "2026-10-21_batch", and the case fails on the page's heading.
// Planted fault: the subject read from every queue (`queues(snapshot)` in place of `entryAt(snapshot, id)` in entryFacts of src/review-pages/subjects.mjs) asks for the other queues' files, and the case fails on the queue files asked for.
test("TST-1273303 the page of an entry in a queue whose name ends in digits reads that queue alone, and gives the prompt bar the entry, its requirement and its section's version", async () => {
  const world = await worldWith(AT_HEAD, "head");
  const id = idOf(BATCH, 3);
  const page = await open(world, entryRoute, { id });
  assert.equal(find(page, (node) => node.localName === "h2")[0]?.textContent, `${BATCH} · entry 03`, page.textContent.slice(0, 300));
  assert.equal(one(page, "badge").textContent, "open");
  assert.match(shown(one(page, "proposal")), /The third rule holds in 2026-10-21_batch-12 03/);
  assert.match(shown(one(page, "current")), /The third rule holds\./);
  assert.deepEqual(othersOf(page), []);
  assert.deepEqual(asOf(page), []);
  assert.deepEqual(queueFilesRead(world.mark), [`${SPEC_DIR}${BATCH}/entscheidungen.md`, `${SPEC_DIR}${BATCH}/index.md`]);
  assert.deepEqual(overviewRequests(), [`${world.head}.json`]);

  const subject = entryRoute.subject({ id }, world.context);
  assert.ok(subject, "the page gives the prompt bar a subject");
  assert.equal(subject.key, `spec-entry/id=${encodeURIComponent(id)}/product=${encodeURIComponent(PRODUCT_URL)}`);
  assert.equal(subject.title, id);
  const spec = AT_HEAD["SPEC.md"];
  assert.deepEqual(subject.paramsFor(), { target: id, requirements: ["THIRD RULE"], version: await blobSha(sectionText(spec, A2)) });
});

// TST-1273304 · level: release · module: MOD-review-pages, MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006
// given: the product of TST-1273301 at the head with the head's overview stored; known positive first — the page of MINE's 02 shows the entry; the addresses of entries that exist in no queue: the number 09 of the existing queue BATCH, a queue 2026-10-22_none, BATCH's name with no number, a queue named by a path (spec-../../SPEC.md-01), and an empty identifier
// input: each address drawn as the page of a SPEC entry, and, in its context, the subject it gives
// expect: each page says "No SPEC change entry <id> on the default branch." and links to all the entries, shows no entry, no badge and no line As of; no page asks for the index or the decisions of a queue but BATCH's, for the number 09; none asks for the overview; the subject of each is null — every link to an entry or to all the entries ends in /product=<the product's address, percent-encoded> (ITM-1355)
// Planted fault: the first entry of the queue taken when its number is missing (`(queue?.entries.find(…) ?? queue?.entries[0])` in entryAt of src/review-pages/spec-entries.mjs) shows BATCH's 01, in the SPEC, for the number 09, and the case fails on the page's text.
test("TST-1273304 an address that names no entry says so, reads at most the queue it names and gives the prompt bar no subject", async () => {
  const world = await worldWith(AT_HEAD, "head");
  const known = await open(world, entryRoute, { id: idOf(MINE, 2) });
  assert.equal(one(known, "badge").textContent, "open", "known positive");
  const before = net.server.log.length;
  const requestsBefore = net.requests.length;
  for (const id of [idOf(BATCH, 9), idOf("2026-10-22_none", 1), `spec-${BATCH}`, "spec-../../SPEC.md-01"]) {
    const context = browser();
    context.product = world.context.product;
    const page = await draw(entryRoute, context, { id });
    assert.equal(find(page, (node) => node.localName === "p" && node.className.includes("problem")).map((node) => node.textContent)[0], `No SPEC change entry ${id} on the default branch.`, `${JSON.stringify(id)}: ${page.textContent.slice(0, 200)}`);
    assert.ok(hrefs(page).includes(`#spec-entry/product=${encodeURIComponent(PRODUCT_URL)}`), "a link to all the entries");
    assert.equal(byClass(page, "badge").length, 0);
    assert.deepEqual(asOf(page), []);
    assert.equal(entryRoute.subject({ id }, context), null, `${JSON.stringify(id)}: no subject`);
  }
  assert.deepEqual(queueFilesRead(before), [`${SPEC_DIR}${BATCH}/entscheidungen.md`, `${SPEC_DIR}${BATCH}/index.md`], "the one queue that exists is read, to see that it lacks the number, and no other");
  assert.deepEqual(net.requests.slice(requestsBefore).filter((request) => request.url.includes("overview-cache")), [], "no overview is asked for");
});

// TST-1273305 · level: release · module: MOD-review-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-018
// given: the product of TST-1273301 at the head, whose section "## 3. Quiet" holds FOURTH RULE and has no proposal in any queue; a token; the branch overview-cache in three states — the head's overview, only c0's, none
// input: the editor of FOURTH RULE (requirement/<name>/edit) in each state; and the editor of FIRST RULE in the first
// expect: in every state the editor of FOURTH RULE lists no other proposal; with the head's overview it shows no line As of and asks for no queue's index or decisions, one request for the overview; with c0's only it shows the line "As of eeeeeee" though the list is empty; with no branch it shows none and reads every queue (the index of each of the 23); the editor of FIRST RULE with the head's overview lists MINE's 02 and OTHER's 01, linked, and not the entries in the SPEC — every link to an entry or to all the entries ends in /product=<the product's address, percent-encoded> (ITM-1355)
// Planted fault: the editor reading every queue again (`all = await queues(snapshot)` with `asOf` undefined in place of `({ queues: all, asOf } = await waitingQueues(snapshot))` in src/review-pages/edit.mjs) asks for the index of all 23 queues, and the case fails on the queue files asked for.
test("TST-1273305 the editor of a requirement on a section nobody proposes a change to lists none, says whose list it is, and reads no queue where the overview is stored", async () => {
  const stored = await worldWith(AT_HEAD, "head");
  const quiet = await open(stored, editRoute, { name: "FOURTH RULE" });
  assert.ok(one(quiet, "editor-box"), `known positive: the editor is drawn: ${quiet.textContent.slice(0, 200)}`);
  assert.deepEqual(othersOf(quiet), []);
  assert.deepEqual(asOf(quiet), []);
  assert.deepEqual(queueFilesRead(stored.mark), []);
  assert.deepEqual(overviewRequests(), [`${stored.head}.json`]);
  const first = await open(stored, editRoute, { name: "FIRST RULE" });
  assert.deepEqual(othersOf(first).sort(), [entryHref(idOf(MINE, 2)), entryHref(idOf(OTHER, 1))].sort());
  net.restore(); net = null; timers.restore(); document.body.replaceChildren();

  const older = await worldWith(AT_HEAD, "older");
  const stale = await open(older, editRoute, { name: "FOURTH RULE" });
  assert.deepEqual(othersOf(stale), []);
  assert.equal(asOf(stale).length, 1, stale.textContent.slice(0, 300));
  assert.match(asOf(stale)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));
  net.restore(); net = null; timers.restore(); document.body.replaceChildren();

  const none = await worldWith(AT_HEAD, "none");
  const bare = await open(none, editRoute, { name: "FOURTH RULE" });
  assert.deepEqual(othersOf(bare), []);
  assert.deepEqual(asOf(bare), []);
  assert.equal(queueFilesRead(none.mark).filter((path) => path.endsWith("/index.md")).length, 23, "every queue is read where no overview is stored");
});
