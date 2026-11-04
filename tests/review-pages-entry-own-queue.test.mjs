// A SPEC entry's page and a requirement's editor read their own queue and the waiting ones — MOD-review-pages, as the accepted text of
// docs/architecture/MOD-review-pages.md states it: "For a SPEC entry, on `<k>/<id>` and for its subject, the page reads the entry's own queue (`queueAt`, the folder
// from the entry's identifier), and the other proposals on the same section from the queues MOD-progress-measures' `waitingQueues` gives, with its line `As of <commit>`
// while they are of an earlier commit; the editor of a requirement reads the other open proposals on its section the same way. Neither reads every queue."
// Run: node --test tests/review-pages-entry-own-queue.test.mjs
//
// Module: MOD-review-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006; UC-018
// Level: component
//
// The world is the one of the main page's tests (tests/main-page-home-harness.mjs: the counting fake GitHub behind the real MOD-repository-hosts, the browser of the instance, the
// branch overview-cache), with the product's 66 change queues below; the routes `spec-entry` and `requirement` of the real MOD-review-pages are drawn on one host of the product, whose
// snapshots serve the trace graph the workflow "main changed" stores (tests/stored-graph-fake.mjs). The real MOD-spec-changes, MOD-progress-measures and MOD-trace-graph run as they are.
// Readings the texts leave open, which the cases state:
//   - A queue "is read" when its index.md or entscheidungen.md is named to the server; the proposal and rationale of the entry shown are what its page shows, and are read.
//   - "what tests/review-pages-edit-entry.test.mjs expects" of an open entry's page: its heading, the badge open, the proposal beside the section that holds now, and the link Edit to
//     #spec-entry/id=<id>/edit=1.
//   - The line `As of <commit>` is an element of the class `as-of` that begins with "As of " and the first seven digits of the commit whose overview the other proposals come from; with
//     the head's own overview there is none.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { INSTANCE, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, byClass, draw, find, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";

const { view } = await import("../src/review-pages/index.mjs");
const entryRoute = view.routes.find((candidate) => candidate.name === "spec-entry");
const editRoute = view.routes.find((candidate) => candidate.name === "requirement");

const TICK = "`";
const SPEC_DIR = "docs/spec-freigaben/";
const ANCHOR = "## 1. Section";
const MINE = "2026-10-20_mine", OTHER = "2026-10-19_other";
const DECIDED = Array.from({ length: 64 }, (_, n) => `2026-09-01_decided-${String(n + 1).padStart(2, "0")}`);
const ENTRY = `spec-${MINE}-02`;
const OLDER = "e".repeat(40);
const PROPOSAL = `${ANCHOR}\n\n**FIRST RULE** *(Product Owner)*\nThe first rule holds on every page.\n*Check:* ${TICK}tests/unit.test.mjs${TICK}\n\n`
  + `**SECOND RULE** *(Product Owner)*\nThe second rule holds.\n*Check:* no automatic check; at review.\n`;

// One queue of the entries given, each [number, decided]: every entry replaces "## 1. Section" of SPEC.md; a decided one has a decision row naming the commit that wrote it.
function queue(folder, entries) {
  const base = `${SPEC_DIR}${folder}`;
  const nn = (number) => String(number).padStart(2, "0");
  const files = {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...entries.map(([number]) => `| ${nn(number)} | ${TICK}SPEC.md${TICK} | ${ANCHOR} | — | — |`), ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", "",
      ...entries.filter(([, decided]) => decided).map(([number]) => `| 2026-09-08 10:00 UTC | ${number} | uebernommen | ${"c".repeat(40)} |`), ""].join("\n"),
  };
  for (const [number] of entries) {
    files[`${base}/${nn(number)}-entry.md`] = PROPOSAL.replace("on every page", `on every page of ${folder} ${nn(number)}`);
    files[`${base}/${nn(number)}-entry.begruendung.md`] = `# 1. Section: every page\n\n**The change.** A fixture.\n\n**Why.** Clearer.\n`;
  }
  return files;
}
// The product of the main page's tests with 66 queues: 64 decided, MINE (01 in the SPEC, 02 open) and OTHER (01 open), all on the same section.
const productFiles = () => ({ ...smallProduct({ accepted: ["UC-001", "UC-002"] }), ...Object.assign({}, ...DECIDED.map((folder) => queue(folder, [[1, true]]))),
  ...queue(MINE, [[1, true], [2, false]]), ...queue(OTHER, [[1, false]]) });

let net = null;
afterEach(() => { net?.restore(); net = null; timers.restore(); document.body?.replaceChildren(); });

/**
 * The world: the fake GitHub holding the product and the instance, and on the product's branch overview-cache what `stored` says — "head": the overview of the head, with the queues that
 * have an entry not in the SPEC yet as MOD-spec-changes' `queues` gives them; "older": only the overview of the commit c0 and latest.json naming it; "none": no branch. The overview is derived by
 * a host of its own before `mark`, whose reads are no read of the pages.
 */
async function worldWith(stored) {
  net = network({ [PRODUCT]: productFiles(), [INSTANCE]: instanceFiles() });
  net.install();
  const head = headOf(PRODUCT);
  const all = await queues(await connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }).readSnapshot("main"));
  assert.equal(all.length, 66, "known positive: the product holds 66 queues");
  const held = all.filter((each) => each.entries.some((entry) => entry.state !== "in SPEC"));
  assert.deepEqual(held.map((each) => each.folder.slice(SPEC_DIR.length)), [OTHER, MINE], "known positive: two queues wait, in the order of their folders' names");
  const overview = (commit) => JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: held });
  if (stored === "head") net.overviews[PRODUCT] = { [head]: overview(head) };
  if (stored === "older") net.overviews[PRODUCT] = { [OLDER]: overview(OLDER), latest: JSON.stringify({ commit: OLDER }) };
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  return { host, head, mark: net.server.log.length };
}

const overviewRequests = () => net.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}/`) && request.url.includes("ref=overview-cache"))
  .map((request) => /contents\/([^?]+)\?/.exec(request.url)[1]);
// The index and decisions files of the queues the server was asked for since `mark`, each once.
const queueFilesRead = (mark) => [...new Set(net.server.log.slice(mark).flatMap((entry) => entry.files)
  .filter((path) => path.startsWith(SPEC_DIR) && /\/(index|entscheidungen)\.md$/.test(path)))].sort();

async function drawn(world, route, params) {
  const context = browser();
  context.product = { address: PRODUCT_URL, kind: "github", host: world.host, tokenStored: true };
  return draw(route, context, params);
}
const one = (target, name) => byClass(target, name)[0];
// What a part of the page shows: its text and the markup MOD-markdown-render rendered into it (the fixture's document keeps innerHTML as it is given).
const shown = (node) => [node.textContent, ...find(node, () => true).map((kid) => (typeof kid.innerHTML === "string" ? kid.innerHTML : ""))].join(" ");
const hrefs = (node) => (node ? find(node, (kid) => kid.localName === "a").map((anchor) => anchor.getAttribute("href")) : []);
const othersOf = (target) => hrefs(one(target, "others"));
const KEEP = `/product=${encodeURIComponent(PRODUCT_URL)}`;
const asOf = (target) => byClass(target, "as-of").map((node) => node.textContent);

// TST-1273101 · level: component · module: MOD-review-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006
// given: the product's 66 queues (64 decided; 2026-10-20_mine with 01 in the SPEC and 02 open; 2026-10-19_other with 01 open, all on "## 1. Section"), the overview of the head stored, a token
// input: the route spec-entry drawn with id=spec-2026-10-20_mine-02 (the page and its subject)
// expect: the heading "2026-10-20_mine · entry 02", the badge open, the proposal beside the section that holds now, the link Edit to #spec-entry/id=spec-2026-10-20_mine-02/edit=1/product=<the product's address, percent-encoded>; among the other proposals spec-2026-10-19_other-01 and not the decided spec-2026-10-20_mine-01; no line As of; the queue files asked for are 2026-10-20_mine's index.md and entscheidungen.md and no other queue's; one request for the head's overview
test("spec-entry/<id> reads its own queue and one overview, and shows the other queue's open entry on its section", async () => {
  const world = await worldWith("head");
  const target = await drawn(world, entryRoute, { id: ENTRY });
  assert.equal(find(target, (node) => node.localName === "h2")[0]?.textContent, `${MINE} · entry 02`, target.textContent.slice(0, 300));
  assert.match(one(target, "badge").textContent, /^open$/);
  assert.match(shown(one(target, "proposal")), new RegExp(`on every page of ${MINE} 02`));
  assert.match(shown(one(target, "current")), /The first rule holds\./);
  assert.equal(one(target, "edit-link")?.getAttribute("href"), `#spec-entry/id=${ENTRY}/edit=1${KEEP}`);
  assert.deepEqual(othersOf(target), [`#spec-entry/id=spec-${OTHER}-01${KEEP}`]);
  assert.deepEqual(asOf(target), []);
  assert.deepEqual(queueFilesRead(world.mark), [`${SPEC_DIR}${MINE}/entscheidungen.md`, `${SPEC_DIR}${MINE}/index.md`]);
  assert.deepEqual(overviewRequests(), [`${world.head}.json`]);
});

// TST-1273102 · level: component · module: MOD-review-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-018
// given: the product of TST-1273101, the overview of the head stored, a token
// input: the route requirement drawn with name=FIRST RULE (its editor)
// expect: the other open proposals on its section are spec-2026-10-20_mine-02 and spec-2026-10-19_other-01, linked; not the decided 01 of 2026-10-20_mine; no line As of; no index.md or entscheidungen.md of any queue is asked for; one request for the head's overview
test("requirement/<name>/edit lists the other proposals from the overview and reads no queue's index", async () => {
  const world = await worldWith("head");
  const target = await drawn(world, editRoute, { name: "FIRST RULE" });
  assert.ok(one(target, "editor-box"), `known positive: the editor is drawn: ${target.textContent.slice(0, 300)}`);
  assert.deepEqual(othersOf(target).sort(), [`#spec-entry/id=spec-${MINE}-02${KEEP}`, `#spec-entry/id=spec-${OTHER}-01${KEEP}`].sort());
  assert.deepEqual(asOf(target), []);
  assert.deepEqual(queueFilesRead(world.mark), []);
  assert.deepEqual(overviewRequests(), [`${world.head}.json`]);
});

// TST-1273103 · level: component · module: MOD-review-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006; UC-018
// given: the product of TST-1273101 in two states of its branch overview-cache: only the overview of an older commit c0 stored, with latest.json naming it; no branch at all
// input: in each state, the route spec-entry drawn with id=spec-2026-10-20_mine-02, and the route requirement drawn with name=FIRST RULE
// expect: with c0's overview, both pages list spec-2026-10-19_other-01 and each shows the line "As of eeeeeee"; the entry's page asks for no other queue's files than 2026-10-20_mine's; with no branch, both list it, neither shows an As of line, and the entry's page asks for the index.md of every one of the 66 queues, as every queue is read today
test("counter-proofs: with c0's overview only, the line As of; with no overview-cache, every queue as today", async () => {
  const older = await worldWith("older");
  const entryOlder = await drawn(older, entryRoute, { id: ENTRY });
  assert.deepEqual(othersOf(entryOlder), [`#spec-entry/id=spec-${OTHER}-01${KEEP}`]);
  assert.equal(asOf(entryOlder).length, 1, entryOlder.textContent.slice(0, 300));
  assert.match(asOf(entryOlder)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));
  assert.deepEqual(queueFilesRead(older.mark), [`${SPEC_DIR}${MINE}/entscheidungen.md`, `${SPEC_DIR}${MINE}/index.md`]);
  const editOlder = await drawn(older, editRoute, { name: "FIRST RULE" });
  assert.ok(othersOf(editOlder).includes(`#spec-entry/id=spec-${OTHER}-01${KEEP}`));
  assert.equal(asOf(editOlder).length, 1);
  assert.match(asOf(editOlder)[0], new RegExp(`^As of ${OLDER.slice(0, 7)}`));
  net.restore(); net = null; timers.restore(); document.body.replaceChildren();

  const none = await worldWith("none");
  const entryNone = await drawn(none, entryRoute, { id: ENTRY });
  assert.deepEqual(othersOf(entryNone), [`#spec-entry/id=spec-${OTHER}-01${KEEP}`]);
  assert.deepEqual(asOf(entryNone), []);
  assert.equal(queueFilesRead(none.mark).filter((path) => path.endsWith("/index.md")).length, 66, "every queue is read where no overview is stored");
  const editNone = await drawn(none, editRoute, { name: "FIRST RULE" });
  assert.ok(othersOf(editNone).includes(`#spec-entry/id=spec-${OTHER}-01${KEEP}`));
  assert.deepEqual(asOf(editNone), []);
});
