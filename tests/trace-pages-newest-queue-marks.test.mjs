// The specification view (MOD-trace-pages' view `specification`) marks a requirement that two waiting entries of two queues name with the status of the newer queue's
// entry, and lists both entries. Accepted texts: SPEC.md, OPEN PROPOSALS ARE SHOWN IN THE BROWSER: "Every requirement that an open queue entry would add, change or withdraw is shown
// in the browser with that entry's status and a link to it."; MOD-trace-pages.md, the view `specification`: "first, only while an entry of a change queue waits for acceptance, those entries,
// each with its status and a link to it"; UC-020 5c: "Two open proposals touch the same requirement. Both are listed". Run: node --test tests/trace-pages-newest-queue-marks.test.mjs
//
// Module: MOD-trace-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// Level: unit
//
// Reading, named in the pull request: no text says which of two entries gives the one mark beside the requirement; the case takes the entry of the queue that MOD-progress-measures'
// `waitingQueues` lists first, which MOD-spec-changes' `queues` gives newest first (the queue folder's name sorted, descending). The calls are the public route's, with the Host of
// tests/trace-pages-harness.mjs. Expected results are stated in each case.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "`";
const SPEC = [
  "# Fixture — Specification", "", "## Lending", "",
  "**ALPHA RULE** *(Source)*", "Alpha rule.", "*Check:* at review.", "",
  "**BETA RULE** *(Source)*", "Beta rule.", "*Check:* at review.", "",
].join("\n");
const ALPHA_CHANGED = ["## Lending", "", "**ALPHA RULE** *(Source)*", "Alpha rule, changed.", "*Check:* at review.", "",
  "**BETA RULE** *(Source)*", "Beta rule.", "*Check:* at review.", ""].join("\n");
const ALPHA_WITHDRAWN = ["## Lending", "", "**BETA RULE** *(Source)*", "Beta rule.", "*Check:* at review.", ""].join("\n");
// The files of one queue with one entry that waits: its index, its (empty) decisions and the entry.
function queue(folder, proposal) {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## Lending | — | — |`, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", ""].join("\n"),
    [`${base}/01-entry.md`]: proposal,
  };
}
const OLDER = "2026-10-09_older", NEWER = "2026-10-10_newer";
const files = (older, newer) => ({ "SPEC.md": SPEC, ...queue(OLDER, older), ...queue(NEWER, newer) });

async function render(tree) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: treeHost({ trees: { main: tree } }) } }, { key: "specification", ref: "main" });
  return target;
}
const marksOf = (target) => Object.fromEntries(find(target, (node) => node.localName === "tr" && find(node, (cell) => cell.className === "requirement-status").length === 1)
  .map((row) => [find(row, (node) => node.localName === "button")[0].textContent, find(row, (node) => node.className === "requirement-status")[0].textContent]));
const listed = (target) => find(find(target, (node) => node.localName === "section" && node.className.includes("spec-waiting"))[0], (node) => node.localName === "a")
  .map((node) => node.getAttribute("href"));

// TST-1301001 · level: unit · module: MOD-trace-pages
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020
// given: the default branch main, whose SPEC holds ALPHA RULE and BETA RULE, and two queues each with one entry that waits — the older (2026-10-09_older) changes ALPHA RULE, the newer (2026-10-10_newer) withdraws it
// input: the specification view drawn at main
// expect: ALPHA RULE is marked "removal proposed", the newer queue's mark — the last entry naming it in queues' order, folder names then entry numbers —, and BETA RULE "in SPEC"; the list of waiting entries holds both links, the newer queue's first: #spec-entry/id=spec-2026-10-10_newer-01, #spec-entry/id=spec-2026-10-09_older-01
//         counter-proof: with the entries exchanged (the older withdraws, the newer changes) ALPHA RULE is "change proposed", so the older queue's mark, planted, fails the first expectation
test("TST-1301001 of two waiting entries that name one requirement the newer queue's gives the mark, and both are listed", async () => {
  const target = await render(files(ALPHA_CHANGED, ALPHA_WITHDRAWN));
  assert.deepEqual(marksOf(target), { "ALPHA RULE": "removal proposed", "BETA RULE": "in SPEC" });
  assert.deepEqual(listed(target), [`#spec-entry/id=spec-${NEWER}-01`, `#spec-entry/id=spec-${OLDER}-01`]);

  const exchanged = await render(files(ALPHA_WITHDRAWN, ALPHA_CHANGED));
  assert.equal(marksOf(exchanged)["ALPHA RULE"], "change proposed", "counter-proof: the mark follows the newer queue, whichever change it holds");
  assert.deepEqual(listed(exchanged), [`#spec-entry/id=spec-${NEWER}-01`, `#spec-entry/id=spec-${OLDER}-01`]);
});
