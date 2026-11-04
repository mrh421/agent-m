// The Spec page (MOD-trace-pages' view `specification`) shows first the SPEC change entries that wait for acceptance, each linked, and none of
// that where none waits; below them the SPEC; and it leads to the history of the SPEC change entries, which opens on request.
// Accepted texts: MOD-trace-pages.md, the view `specification`: "first, only while an entry of a change queue waits for acceptance, those entries, each with
// its status and a link to it (MOD-review-pages' `spec-entry/<id>`), and nothing where none waits; then the tree of `docs/groups/requirements.md` …" and
// "*History of SPEC changes*, which opens MOD-review-pages' `spec-entry/history`"; MOD-site-frame.md: "the list of SPEC change entries and their history are opened
// from it". Run: node --test tests/trace-pages-waiting-changes.test.mjs
//
// Module: MOD-trace-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006; UC-018
// Level: unit
//
// Readings, each adding no word to the quoted sentences: an entry "waits for acceptance" when MOD-spec-changes' state for it is open, stale or waiting for its
// anchor (the entries a person may tick on the review pages); the section is drawn on the default branch only, as the view's links to the review pages are, so a
// released version shows none and reads no queue; the link to the history is `#spec-entry/id=history`, and no link leads to the list of all entries
// (the address form the frame reads). The calls are the public route's, with the Host of tests/trace-pages-harness.mjs. Expected results are stated in each case.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = "# Fixture — Specification\n\n## First section\n\n**FIRST REQUIREMENT** *(Source one)*\nFirst rule.\n*Check:* at review.\n";
const TICK = "`";
// The files of one queue with one entry: its index, its decisions (a row when the entry is decided) and the entry.
function queue(folder, anchor, decided) {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ${anchor} | — | — |`, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", "", ...(decided ? [`| 2026-10-08 10:00 UTC | 1 | uebernommen | ${"c".repeat(40)} |`] : []), ""].join("\n"),
    [`${base}/01-entry.md`]: `${anchor}\n\n**FIRST REQUIREMENT** *(Source one)*\nFirst rule, changed.\n*Check:* at review.\n`,
  };
}
const OPEN = "2026-10-09_open", DONE = "2026-10-08_done";
const withOpen = { "SPEC.md": SPEC, ...queue(OPEN, "## First section", false), ...queue(DONE, "## Second section", true) };
const onlyDecided = { "SPEC.md": SPEC, ...queue(DONE, "## Second section", true) };

async function render(files, ref = "main", tags = []) {
  const productHost = treeHost({ trees: { main: files, "v2026.1.0": files }, tags });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: productHost } }, { key: "specification", ref });
  return { target, productHost };
}
const anchors = (target) => find(target, (node) => node.localName === "a");
const hrefs = (target) => anchors(target).map((node) => node.getAttribute("href"));
const waitingSection = (target) => find(target, (node) => node.localName === "section" && node.className.includes("spec-waiting"))[0];
const text = (node) => node.textContent.replace(/\s+/g, " ");

// TST-878001 · level: unit · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// given: the default branch, whose queues hold an open entry (2026-10-09_open, entry 01) and a decided one (2026-10-08_done, entry 01)
// input: the specification view drawn at main
// expect: a section "SPEC changes waiting for acceptance" is the first child of the page, before the version choice and the section "Current requirements"; it links #spec-entry/id=spec-2026-10-09_open-01 and names its status open; the decided entry is not in it (the counter-proof: no link to spec-2026-10-08_done-01 anywhere on the page)
test("TST-878001 the open entry is linked first, above the SPEC, and the decided entry is not listed", async () => {
  const { target } = await render(withOpen);
  const waiting = waitingSection(target);
  assert.ok(waiting, "known positive: the waiting section is drawn");
  assert.ok(text(waiting).includes("SPEC changes waiting for acceptance") && text(waiting).includes("open"));
  assert.deepEqual(hrefs(waiting), [`#spec-entry/id=spec-${OPEN}-01`]);
  const overview = find(target, (node) => node.localName === "section" && node.className.includes("current-requirements"))[0];
  assert.ok(overview, "known positive: the SPEC is drawn");
  const order = find(target, (node) => node === waiting || node === overview);
  assert.deepEqual(order, [waiting, overview], "the waiting entries stand above the SPEC");
  assert.equal(target.firstChild, waiting, "the waiting entries are the first thing on the page, above the version choice and the narrowing");
  assert.equal(hrefs(target).some((href) => href.includes(`spec-${DONE}-01`)), false, "the decided entry is not listed");
});

// TST-878002 · level: unit · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// given: the default branch, whose only queue is decided
// input: the specification view drawn at main
// expect: no waiting section at all (counter-proof of TST-878001: the same page with an open queue has one), and the SPEC is shown
test("TST-878002 where no entry waits there is no such section", async () => {
  const { target } = await render(onlyDecided);
  assert.equal(waitingSection(target), undefined);
  assert.equal(text(target).includes("waiting for acceptance"), false);
  assert.ok(text(target).includes("FIRST REQUIREMENT"), "known positive: the SPEC is shown");
  assert.ok(waitingSection((await render(withOpen)).target), "counter-proof: with an open entry the section is there");
});

// TST-878003 · level: unit · module: MOD-trace-pages
// guards: UC-006; UC-018
// given: the default branch with an open entry
// input: the specification view drawn at main, and at the tag v2026.1.0 (a released version)
// expect: at main the page links "History of SPEC changes" to #spec-entry/id=history and "Arrange" to #arrange/kind=requirements, and has no link "All SPEC change entries" and no anchor to #spec-entry (the waiting entry's own link goes to #spec-entry/id=…); at the tag it has none of the links and no waiting section
test("TST-878003 the history is a link on the default branch's page only, and no link leads to the list of all entries", async () => {
  const { target } = await render(withOpen);
  const link = (label) => anchors(target).find((node) => node.textContent === label);
  assert.equal(link("History of SPEC changes")?.getAttribute("href"), "#spec-entry/id=history", "known positive: the history link is drawn");
  assert.equal(link("Arrange")?.getAttribute("href"), "#arrange/kind=requirements", "known positive: the Arrange link is drawn");
  assert.equal(link("All SPEC change entries") === undefined, true, "no link All SPEC change entries");
  assert.equal(hrefs(target).includes("#spec-entry"), false);
  assert.deepEqual(hrefs(target).filter((href) => href.startsWith("#spec-entry")), [`#spec-entry/id=spec-${OPEN}-01`, "#spec-entry/id=history"], "counter-proof: the waiting entry stays linked");
  const released = (await render(withOpen, "v2026.1.0", ["v2026.1.0"])).target;
  assert.equal(anchors(released).some((node) => node.textContent === "All SPEC change entries" || node.textContent === "History of SPEC changes"), false);
  assert.equal(waitingSection(released), undefined);
});

// TST-878004 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a default branch whose snapshot holds no file under docs/spec-freigaben/
// input: the specification view drawn at main
// expect: no readMany call and no read of a queue file — a read the page already has the answer to (there is no queue) is not made; the reads are SPEC.md and the group file
test("TST-878004 a repository without a change queue costs the page no queue read", async () => {
  const { productHost } = await render({ "SPEC.md": SPEC });
  assert.deepEqual(productHost.log.manys, []);
  assert.deepEqual(productHost.log.reads, ["SPEC.md", "docs/groups/requirements.md"]);
});

// TST-878005 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// given: the default branch of TST-878001 (an open queue and a decided one), whose snapshot has `readOn` and whose branch overview-cache holds the overview of its commit in the format MOD-progress-measures' Data names — its queues the open queue alone, as MOD-spec-changes' queues gives it, the queues with an entry not in the SPEC yet
// input: the specification view drawn at main
// expect: the open entry is linked as in TST-878001 (#spec-entry/id=spec-2026-10-09_open-01), the overview was read once, and no file of the decided queue's folder is read or named to readMany — counter-proof: without the overview the page reads the decided queue's index (known positive that the log sees such a read)
test("TST-878005 with an overview stored for the commit, the page lists the waiting entries from it and reads no queue that holds none", async () => {
  const { queues } = await import("../src/spec-changes/index.mjs");
  const decided = `docs/spec-freigaben/${DONE}/`;
  const plain = treeHost({ trees: { main: withOpen } });
  const open = (await queues(await plain.readSnapshot("main"))).filter((each) => each.folder.endsWith(OPEN));
  assert.equal(open.length, 1, "known positive: the open queue is read from the files");
  const overview = JSON.stringify({ commit: "main", shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: open });
  const asked = [];
  const host = treeHost({ trees: { main: withOpen } });
  // The fixture's commit is named by its ref, "main", as the overview stored for it names it.
  const productHost = { ...host, async readSnapshot(ref) {
    return { ...(await host.readSnapshot(ref)), commit: ref, readOn: async (branch, path) => { asked.push([branch, path]); return branch === "overview-cache" && path === "main.json" ? overview : null; } };
  } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: productHost } }, { key: "specification", ref: "main" });
  assert.deepEqual(hrefs(waitingSection(target)), [`#spec-entry/id=spec-${OPEN}-01`]);
  assert.deepEqual(asked.filter(([branch]) => branch === "overview-cache"), [["overview-cache", "main.json"]]);
  assert.deepEqual([...host.log.reads, ...host.log.manys.flat()].filter((path) => path.startsWith(decided)), []);

  const without = await render(withOpen);
  assert.equal([...without.productHost.log.reads, ...without.productHost.log.manys.flat()].some((path) => path.startsWith(decided)), true,
    "counter-proof: without an overview the decided queue is read");
});

// TST-878006 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// given: the default branch of TST-878001, whose overview is not stored yet — the minutes after a push —, and whose branch overview-cache holds latest.json naming an earlier commit and that commit's overview, its queues the open queue alone
// input: the specification view drawn at main
// expect: the open entry is linked as in TST-878001; the head's overview, latest.json and the earlier overview are read; no file of the decided queue's folder is read or named to readMany (the counter-proof of TST-878005: without any overview it is)
test("TST-878006 while the head's overview is not stored, the page lists the waiting entries from the overview stored last and reads no queue", async () => {
  const { queues } = await import("../src/spec-changes/index.mjs");
  const decided = `docs/spec-freigaben/${DONE}/`, earlier = "e".repeat(40);
  const open = (await queues(await treeHost({ trees: { main: withOpen } }).readSnapshot("main"))).filter((each) => each.folder.endsWith(OPEN));
  const overview = JSON.stringify({ commit: earlier, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: open });
  const stored = { "latest.json": JSON.stringify({ commit: earlier }), [`${earlier}.json`]: overview };
  const asked = [];
  const host = treeHost({ trees: { main: withOpen } });
  const productHost = { ...host, async readSnapshot(ref) {
    return { ...(await host.readSnapshot(ref)), commit: ref, readOn: async (branch, path) => { asked.push([branch, path]); return branch === "overview-cache" ? stored[path] ?? null : null; } };
  } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: productHost } }, { key: "specification", ref: "main" });
  assert.deepEqual(hrefs(waitingSection(target)), [`#spec-entry/id=spec-${OPEN}-01`]);
  assert.deepEqual(asked.filter(([branch]) => branch === "overview-cache").map(([, path]) => path).sort(), ["latest.json", "main.json", `${earlier}.json`].sort());
  assert.deepEqual([...host.log.reads, ...host.log.manys.flat()].filter((path) => path.startsWith(decided)), []);
});
