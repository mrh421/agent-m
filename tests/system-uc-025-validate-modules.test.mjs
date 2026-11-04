// System coverage for UC-025 Validate modules against specification and tests, walked through the dashboard: the main flow, steps 1 to 6, and the
// alternative flows 2a, 2b, 3a, 4a, 4b and 5a. The page is the real route `trace` of MOD-trace-pages with the key `modules`, over the real MOD-trace-graph
// and the fixture product of tests/uc-025-harness.mjs. No request leaves the process.
// Run: node --test tests/system-uc-025-validate-modules.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-trace-graph
// Guards: UC-025
// Level: system
//
// Authored by developer-opus-f (ITM-741), who implemented none of ITM-692, ITM-720, ITM-721, ITM-210, ITM-735 and ITM-736.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file.
// A person's click is the page's own listener called through the event it dispatches. Readings the texts leave open, which the cases state:
//   - "with its status (accepted, open, changed since acceptance, not in the SPEC)" of a requirement: a requirement the SPEC holds is shown "in SPEC", which
//     is read as its accepted status; a requirement proposed in a change queue is not among this battery's fixtures.
//   - 4b "named as not in the SPEC": the gap of the name, which says it "matches no requirement", is read as naming it so.
//   - 2a "without one that reaches it, it says so": a host that refuses the read is a token that does not reach the repository; the page's line that the
//     modules could not be read, with the host's reason, is read as saying so.

import test from "node:test";
import assert from "node:assert/strict";
import { byClass, cellOf, clean, click, find, gapsOf, hostOf, itemsOf, moduleDoc, open, product, rowOf, rowsOf, testFile, textOf } from "./uc-025-harness.mjs";

const gapKinds = (target) => gapsOf(target).map((gap) => `${gap.kind} ${gap.text.split(" — ")[0]}`);

// TST-741001 · level: system · module: system
// guards: UC-025
// given: the fixture product of tests/uc-025-harness.mjs on the default branch main
// input: the reviewer opens Modules: the route trace with the key modules at main
// expect: the route is listed under the menu entry architecture; the page is headed "Modules"; the Host is asked for the snapshot of main alone
test("TST-741001: UC-025 step 1 and 2 — Modules opens under Architecture and reads the default branch", async () => {
  const host = hostOf();
  const { target, route } = await open(host);
  assert.equal(route.entryShown({ key: "modules" }), "architecture");
  assert.deepEqual(find(target, (node) => node.localName === "h2").map((node) => node.textContent), ["Modules"]);
  assert.deepEqual(host.log.snapshots, ["main"]);
});

// TST-741002 · level: system · module: system
// guards: UC-025
// given: the fixture product: MOD-store, MOD-pages and MOD-news follow ARC-002, whose file an approval record accepts; MOD-mail follows ARC-003, which no record accepts; MOD-store's file is accepted, the others open
// input: the reviewer opens Modules at main
// expect: one row per module, by identifier: MOD-mail, MOD-news, MOD-pages, MOD-store; MOD-store belongs to "ARC-002 — accepted", realises "RULE ONE — in SPEC", is described by "docs/architecture/MOD-store.md — accepted", has the code src/store/index.mjs and the test TST-9001; MOD-pages belongs to "ARC-002 — accepted", is described by "docs/architecture/MOD-pages.md — open", has the code src/pages/index.mjs and the test TST-9002; MOD-mail belongs to "ARC-003 — open" and has no test; MOD-news has no code and the test TST-9003
test("TST-741002: UC-025 step 3 — one row per module: its subsystem, what it realises, its file, its code and its tests, each with its status", async () => {
  const { target } = await open();
  assert.deepEqual(rowsOf(target), ["MOD-mail", "MOD-news", "MOD-pages", "MOD-store"]);
  assert.equal(cellOf(target, "MOD-store", "module-subsystem").textContent, "ARC-002 — accepted");
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-realises")), ["RULE ONE — in SPEC"]);
  assert.equal(cellOf(target, "MOD-store", "module-file").textContent, "docs/architecture/MOD-store.md — accepted");
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-code")), ["src/store/index.mjs"]);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-tests")), ["TST-9001"]);
  assert.equal(cellOf(target, "MOD-pages", "module-subsystem").textContent, "ARC-002 — accepted");
  assert.equal(cellOf(target, "MOD-pages", "module-file").textContent, "docs/architecture/MOD-pages.md — open");
  assert.deepEqual(itemsOf(cellOf(target, "MOD-pages", "module-code")), ["src/pages/index.mjs"]);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-pages", "module-tests")), ["TST-9002"]);
  assert.equal(cellOf(target, "MOD-mail", "module-subsystem").textContent, "ARC-003 — open");
  assert.deepEqual(itemsOf(cellOf(target, "MOD-mail", "module-tests")), []);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-news", "module-code")), []);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-news", "module-tests")), ["TST-9003"]);
});

// TST-741003 · level: system · module: system
// guards: UC-025
// given: the fixture product, in which MOD-mail's file names RULE ONE under realises and no test exercises MOD-mail; and the same product with tests/mail.test.mjs, which exercises MOD-mail and guards RULE THREE (known positive: MOD-store, whose test guards what its file names, realises RULE ONE)
// input: the reviewer opens Modules at main, for each of the two
// expect: UC-025 step 3 "realises — the requirements its tests guard" and step 4 "a module that realises no requirement: no test of it guards one": without the test MOD-mail realises nothing and is listed with the gap realises-nothing; with it MOD-mail realises "RULE THREE — in SPEC" alone and RULE THREE is no requirement-without-module gap.
test("TST-741003: UC-025 step 3 and 4 — a module realises the requirements its tests guard", async () => {
  const known = await open();
  assert.deepEqual(itemsOf(cellOf(known.target, "MOD-store", "module-realises")), ["RULE ONE — in SPEC"], "known positive");
  assert.deepEqual(itemsOf(cellOf(known.target, "MOD-mail", "module-realises")), []);
  assert.ok(gapKinds(known.target).includes("realises-nothing MOD-mail"), gapKinds(known.target).join("; "));
  const tested = await open(hostOf(product({ "tests/mail.test.mjs": testFile("9004", "MOD-mail", "RULE THREE") })));
  assert.deepEqual(itemsOf(cellOf(tested.target, "MOD-mail", "module-realises")), ["RULE THREE — in SPEC"]);
  assert.ok(!gapKinds(tested.target).includes("requirement-without-module RULE THREE"), gapKinds(tested.target).join("; "));
});

// TST-741004 · level: system · module: system
// guards: UC-025
// given: the fixture product: MOD-news follows ARC-002, which does not name it, and has no code; no test exercises MOD-mail; MOD-mail's code imports MOD-store, of which MOD-mail's file names no interface; no module realises RULE THREE; MOD-news's file also names RULE GHOST under realises, which matches nothing
// input: the reviewer opens Modules at main
// expect: the gaps listed, each with the artifact it concerns, hold "subsystem-does-not-name-module MOD-news", "module-without-code MOD-news", "module-without-test MOD-mail", "import-not-in-uses src/mail/index.mjs", "requirement-without-module RULE THREE" and "unknown-name MOD-news", whose text names RULE GHOST
test("TST-741004: UC-025 step 4 — the gaps are listed, each with the artifact it concerns", async () => {
  const files = product({ "docs/architecture/MOD-news.md": moduleDoc("MOD-news", { realises: ["RULE TWO", "RULE GHOST"], follows: ["ARC-002"] }) });
  const { target } = await open(hostOf(files));
  const kinds = gapKinds(target);
  for (const expected of ["subsystem-does-not-name-module MOD-news", "module-without-code MOD-news", "module-without-test MOD-mail", "import-not-in-uses src/mail/index.mjs",
    "requirement-without-module RULE THREE", "unknown-name MOD-news"]) assert.ok(kinds.includes(expected), `${expected} in ${kinds.join("; ")}`);
  assert.match(gapsOf(target).find((gap) => gap.kind === "unknown-name").text, /RULE GHOST/);
});

// TST-741005 · level: system · module: system
// guards: UC-025
// given: the fixture product: MOD-news, MOD-pages and MOD-store follow ARC-002, MOD-mail follows ARC-003; MOD-pages uses MOD-store.read and MOD-mail.send
// input: the reviewer opens Modules at main
// expect: Mermaid is handed one diagram: a flowchart with the box of ARC-002 holding MOD-news, MOD-pages and MOD-store, the box of ARC-003 holding MOD-mail, and two arrows, MOD_pages --> MOD_mail and MOD_pages --> MOD_store
test("TST-741005: UC-025 step 5 — the component diagram: one box per module in its subsystem's box, one arrow per used module", async () => {
  const { diagrams } = await open();
  assert.equal(diagrams.length, 1);
  const text = diagrams[0];
  assert.match(text, /^flowchart LR\n/);
  assert.match(text, /subgraph S_ARC_002\["ARC-002"\]\n {4}MOD_news\[[^\n]*\n {4}MOD_pages\[[^\n]*\n {4}MOD_store\[[^\n]*\n {2}end\n/);
  assert.match(text, /subgraph S_ARC_003\["ARC-003"\]\n {4}MOD_mail\[[^\n]*\n {2}end\n/);
  assert.deepEqual(text.split("\n").filter((line) => line.includes("-->")), ["  MOD_pages --> MOD_mail", "  MOD_pages --> MOD_store"]);
});

// TST-741006 · level: system · module: system
// guards: UC-025
// given: the fixture product, in which MOD-mail (no test) and MOD-news (no code, not named by its subsystem) have gaps, and MOD-pages and MOD-store none (known positive: the page lists those gaps)
// input: the reviewer opens Modules at main
// expect: UC-025 step 5 "modules with a gap are marked": the diagram marks MOD_mail and MOD_news, each with a class line, and marks neither MOD_pages nor MOD_store as a gap.
test("TST-741006: UC-025 step 5 — the diagram marks the modules that have a gap", async () => {
  const { target, diagrams } = await open();
  assert.ok(gapKinds(target).includes("module-without-test MOD-mail") && gapKinds(target).includes("module-without-code MOD-news"), "known positive");
  const classed = (id) => diagrams[0].split("\n").filter((line) => new RegExp(`^ {2}class ${id} `).test(line)).map((line) => line.trim().split(" ")[2]);
  assert.ok(classed("MOD_mail").includes("gap"), diagrams[0]);
  assert.ok(classed("MOD_news").includes("gap"), diagrams[0]);
  assert.deepEqual(classed("MOD_pages"), []);
  assert.deepEqual(classed("MOD_store"), []);
});

// TST-741007 · level: system · module: system
// guards: UC-025
// given: the fixture product on the default branch
// input: the reviewer presses MOD-store's name in its row; then reads the gaps' next steps
// expect: a row opens below MOD-store's with its file rendered ("The module MOD-store"), "Folder: src/store/" and its code src/store/index.mjs; the gap of RULE THREE (no module) offers "Change the architecture", a link to #decision/product=<the product's address, percent-encoded>; the gaps of MOD-mail (no test) and MOD-news (no code) offer "Implement", a link to #implement; no other gap offers a next step
test("TST-741007: UC-025 step 6 — a row opens onto its module's file and folder, and a gap offers its next step", async () => {
  const { target } = await open();
  await click(byClass(rowOf(target, "MOD-store"), "button", "module-name")[0]);
  const opened = byClass(target, "tr", "module-opened");
  assert.equal(opened.length, 1);
  assert.match(textOf(opened[0]), /The module MOD-store/);
  assert.match(textOf(opened[0]), /Folder: src\/store\//);
  assert.ok(itemsOf(opened[0]).includes("src/store/index.mjs"));
  const steps = byClass(target, "li", "module-gap").map((item) => [item.getAttribute("data-kind"), find(item, (node) => node.localName === "a").map((a) => `${a.textContent} ${a.getAttribute("href")}`)]);
  assert.deepEqual(steps.filter(([, links]) => links.length).sort(), [["module-without-code", ["Implement #implement"]], ["module-without-test", ["Implement #implement"]],
    ["requirement-without-module", [`Change the architecture #decision/product=${encodeURIComponent("https://github.com/acme/library")}`]]]);
});

// TST-741008 · level: system · module: system
// guards: UC-025
// given: the fixture product, whose gaps concern MOD-news (docs/architecture/MOD-news.md), MOD-mail (docs/architecture/MOD-mail.md) and src/mail/index.mjs (known positive: a row opens onto its module's file, TST-741007)
// input: the reviewer reads each gap of the page
// expect: UC-025 step 6 "The reviewer follows a row or a gap to the file it concerns": each gap that concerns a module or a code file offers a control that leads to that file — a link or a button besides the next step.
test("TST-741008: UC-025 step 6 — a gap leads to the file it concerns", async () => {
  const { target } = await open();
  const items = byClass(target, "li", "module-gap").filter((item) => item.getAttribute("data-kind") !== "requirement-without-module");
  assert.ok(items.length >= 4, "known positive: the gaps are drawn");
  for (const item of items) {
    const leads = find(item, (node) => node.localName === "button" || (node.localName === "a" && !["#implement", "#decision"].includes(node.getAttribute("href"))));
    assert.ok(leads.length > 0, `${item.textContent} offers no way to its file`);
  }
});

// TST-741009 · level: system · module: system
// guards: UC-025
// given: a private product whose host refuses every read with TokenRefused, "the token does not reach acme/library" — the browser holds no token that reaches it (known positive: the same page over the fixture draws its rows)
// input: the reviewer opens Modules at main
// expect: the page says "The modules could not be read: the token does not reach acme/library" and shows no row, no gap and no diagram
test("TST-741009: UC-025 2a — a private product without a token that reaches it: the page says so and shows nothing", async () => {
  assert.equal(rowsOf((await open()).target).length, 4, "known positive");
  const host = hostOf();
  host.readSnapshot = async () => { throw Object.assign(new Error("the token does not reach acme/library"), { name: "TokenRefused" }); };
  const { target, diagrams } = await open(host);
  assert.deepEqual(byClass(target, "p", "traces-problem").map((node) => node.textContent), ["The modules could not be read: the token does not reach acme/library"]);
  assert.deepEqual(rowsOf(target), []);
  assert.deepEqual(gapsOf(target), []);
  assert.deepEqual(diagrams, []);
});

// TST-741010 · level: system · module: system
// guards: UC-025
// given: the fixture product with code from before Agent M: legacy/old.mjs and legacy/tools/util.mjs, in no module's folder
// input: the reviewer opens Modules at main
// expect: each file is a gap code-without-module, the folders legacy and legacy/tools are gaps folder-named-by-no-module, and nothing blocks: the four modules' rows and the diagram are drawn
test("TST-741010: UC-025 2b — code outside every module's folder is listed as a gap, and nothing blocks", async () => {
  const { target, diagrams } = await open(hostOf(product({ "legacy/old.mjs": "export const old = 1;\n", "legacy/tools/util.mjs": "export const util = 1;\n" })));
  const kinds = gapKinds(target);
  for (const expected of ["code-without-module legacy/old.mjs", "code-without-module legacy/tools/util.mjs", "folder-named-by-no-module legacy", "folder-named-by-no-module legacy/tools"]) {
    assert.ok(kinds.includes(expected), `${expected} in ${kinds.join("; ")}`);
  }
  assert.deepEqual(rowsOf(target), ["MOD-mail", "MOD-news", "MOD-pages", "MOD-store"]);
  assert.equal(diagrams.length, 1);
});

// TST-741011 · level: system · module: system
// guards: UC-025
// given: the fixture product with a module MOD-inner whose folder src/store/inner/ lies inside MOD-store's folder src/store/
// input: the reviewer opens Modules at main
// expect: a gap module-folder-inside-another of MOD-inner, whose text names both folders; MOD-inner has a row of its own
test("TST-741011: UC-025 3a — a module's folder inside another module's folder is a gap", async () => {
  const files = product({ "docs/architecture/MOD-inner.md": moduleDoc("MOD-inner", { folder: "src/store/inner/", realises: ["RULE ONE"], follows: ["ARC-002"] }),
    "src/store/inner/index.mjs": "export const inner = 1;\n" });
  const { target } = await open(hostOf(files));
  const gap = gapsOf(target).find((each) => each.kind === "module-folder-inside-another");
  assert.ok(gap, gapKinds(target).join("; "));
  assert.match(gap.text, /^MOD-inner — /);
  assert.match(gap.text, /src\/store\/inner\/[^]*src\/store\//);
  assert.ok(rowsOf(target).includes("MOD-inner"));
});

// TST-741012 · level: system · module: system
// guards: UC-025
// given: a product without a gap: ARC-002 designs MOD-store, which realises RULE ONE, the SPEC's one requirement, has its code and a test that guards RULE ONE (known positive: the fixture product lists gaps)
// input: the reviewer opens Modules at main
// expect: the page says "There are no gaps at main." and lists no gap; the row of MOD-store and the diagram are still drawn
test("TST-741012: UC-025 4a — no gaps: the list says so and the view does not hide", async () => {
  assert.ok(gapsOf((await open()).target).length > 0, "known positive");
  const { target, diagrams } = await open(hostOf(clean()));
  assert.deepEqual(byClass(target, "p", "no-gaps").map((node) => node.textContent), ["There are no gaps at main."]);
  assert.deepEqual(gapsOf(target), []);
  assert.deepEqual(rowsOf(target), ["MOD-store"]);
  assert.equal(diagrams.length, 1);
});

// TST-741013 · level: system · module: system
// guards: UC-025
// given: the fixture product with tests/old.test.mjs, a test of MOD-store that guards RULE GONE, which the SPEC no longer has
// input: the reviewer opens Modules at main
// expect: among the gaps one of the test TST-9005 whose text names RULE GONE as matching no requirement
test("TST-741013: UC-025 4b — a test naming a requirement the SPEC no longer has appears among the gaps", async () => {
  const { target } = await open(hostOf(product({ "tests/old.test.mjs": testFile("9005", "MOD-store", "RULE GONE") })));
  const gap = gapsOf(target).find((each) => each.text.startsWith("TST-9005 — "));
  assert.ok(gap, gapKinds(target).join("; "));
  assert.match(gap.text, /RULE GONE[^]*matches no requirement/);
});

// TST-741014 · level: system · module: system
// guards: UC-025
// given: the fixture product, in which MOD-pages uses MOD-mail.send, which MOD-mail does not provide; and the same product in which MOD-pages also uses MOD-ghost.find, a module that has no file
// input: the reviewer opens Modules at main, for each
// expect: the arrow MOD_pages --> MOD_mail ends in MOD-mail's box, marked missing (class MOD_mail missing); with MOD-ghost, a box "MOD-ghost — missing" stands outside every subsystem, the arrow MOD_pages --> MOD_ghost ends in it and it is marked missing
test("TST-741014: UC-025 5a — an interface no module provides is an arrow ending in a box marked missing", async () => {
  const first = (await open()).diagrams[0];
  assert.match(first, /\n {2}MOD_pages --> MOD_mail\n/);
  assert.match(first, /\n {2}class MOD_mail missing\n/);
  const files = product({ "docs/architecture/MOD-pages.md": moduleDoc("MOD-pages", { realises: ["RULE TWO"], follows: ["ARC-002"], uses: ["MOD-store.read", "MOD-mail.send", "MOD-ghost.find"], provides: ["draw"] }) });
  const ghost = (await open(hostOf(files))).diagrams[0];
  assert.match(ghost, /\n {2}MOD_ghost\["MOD-ghost — missing"\]\n/);
  assert.match(ghost, /\n {2}MOD_pages --> MOD_ghost\n/);
  assert.match(ghost, /\n {2}class MOD_ghost missing\n/);
});
