// What an opened requirement shows beside its four fields, through the dashboard's #spec (ITM-597): what traces to it comes from the trace graph
// the workflow "main changed" stored for the commit, read once for the page and kept for every later opening — a page never reads the artifacts to
// build the graph (MOD-trace-graph: "A page never builds the graph: it reads the stored one through `storedGraph`"); where an open entry of a change
// queue names a requirement, the same graph gives the entry's impact list, which gives the status of the requirement (ITM-595).
//
// Module: MOD-trace-pages
// Guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// Level: system
//
// The page is the real #spec of the dashboard on the harness's repository server, which counts every request it answers. A page without a
// token reads each file of a public repository from GitHub's raw host, so a request `file <path>` is the read of that file; with a token the
// harness answers GitHub's batch query from the fixture's files. The expected requests are written in each case.

import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN, openDashboard, repoServer } from "./app-harness.mjs";

const TICK = "`";
const SPEC = [
  "# Traces fixture", "", "## A section", "",
  "**TRACED RULE** *(Source)*", "The traced rule.", `*Check:* ${TICK}tests/traced.test.mjs${TICK}`, "",
].join("\n");
const UC = ["---", "id: UC-001", "title: Traced use case", "realises:", "  - TRACED RULE", "---", "# UC-001 Traced use case", ""].join("\n");
const MODULE = ["---", "id: MOD-traced", "title: Traced module", "folder: src/traced/", "realises:", "  - TRACED RULE", "---", "# MOD-traced Traced module", ""].join("\n");
const TEST = ["// TST-601", "// level: unit", "// module: MOD-traced", "// guards: TRACED RULE", ""].join("\n");
const QUEUE = "2026-10-09_traced";
const ENTRY = ["## A section", "", "**TRACED RULE** *(Source)*", "The traced rule, changed.", `*Check:* ${TICK}tests/traced.test.mjs${TICK}`, ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/use-cases/UC-001-traced.md": UC,
  "docs/architecture/MOD-traced.md": MODULE,
  "tests/traced.test.mjs": TEST,
  [`docs/spec-freigaben/${QUEUE}/index.md`]: [`# SPEC approvals — queue 2026-10-09 · traced`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## A section | — | — |`, ""].join("\n"),
  [`docs/spec-freigaben/${QUEUE}/entscheidungen.md`]: "# Decisions — queue 2026-10-09 traced\n\nAppend-only.\n",
  [`docs/spec-freigaben/${QUEUE}/01-entry.md`]: ENTRY,
};
const WITHOUT_QUEUE = Object.fromEntries(Object.entries(FILES).filter(([path]) => !path.startsWith("docs/spec-freigaben/")));
const ARTIFACTS = ["file docs/use-cases/UC-001-traced.md", "file docs/architecture/MOD-traced.md", "file tests/traced.test.mjs"];
// Each case's repository stands at a commit of its own, since MOD-trace-graph's storedGraph keeps a commit's graph for the length of this file; the
// read of the graph stored for it on the branch trace-cache is counted by tests/app-harness.mjs as `stored graph <commit>`.
const HEADS = { traces: "5970001".padEnd(40, "0"), entry: "5970003".padEnd(40, "0"), batches: "5970002".padEnd(40, "0") };
const storedGraph = (head) => `stored graph ${head}`;

// CASE ITM-597-SYSTEM-01
// TST-597201 · level: system · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the dashboard without a token on a repository holding SPEC.md, a use case, a module file and a test file, which name TRACED RULE, and no change queue
// input: the real #spec drawn; its requirement opened; closed; opened again
// expect: drawing and opening request none of the three artifact files, and the stored graph once in all (known positive: the page shows UC-001, MOD-traced and TST-601 as links once the requirement is opened); closing and opening again request nothing
test("the dashboard shows what traces to an opened requirement from the stored graph, reads no artifact, and nothing again on the next opening", async () => {
  const server = await repoServer({ files: WITHOUT_QUEUE, head: HEADS.traces });
  const page = await openDashboard({ server, hash: "#spec", token: null });
  const opening = await page.click("button.requirement-name");
  const read = server.requests; // the whole test: a read the page makes after it settled is counted too
  for (const artifact of ARTIFACTS) assert.ok(!read.includes(artifact), `neither drawing #spec nor opening the requirement requests ${artifact}`);
  assert.equal(read.filter((request) => request === storedGraph(HEADS.traces)).length, 1, "the stored graph, once");
  for (const link of ['href="#use-case/id=UC-001"', 'href="#module/id=MOD-traced"', 'href="#trace/key=tests/row=TST-601"']) assert.ok(page.main().includes(link), `the page links ${link}`);
  assert.deepEqual(await page.click("button.requirement-name"), [], "closing requests nothing");
  assert.deepEqual(await page.click("button.requirement-name"), [], "opening again requests nothing");
  assert.deepEqual(server.writes, []);
});

// CASE ITM-595-SYSTEM-01
// TST-597203 · level: system · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the dashboard without a token on the same repository with the queue 2026-10-09_traced, whose open entry changes TRACED RULE
// input: the real #spec drawn; its requirement opened; closed; opened again
// expect: the page draws TRACED RULE as "change proposed" (known positive), the entry's impact list made from the stored graph: drawing and opening request none of the three artifact files and the stored graph once in all; closing and opening again request nothing
test("the dashboard reads the stored graph once for the impact list of an open entry, and not again when the requirement is opened", async () => {
  const server = await repoServer({ files: FILES, head: HEADS.entry });
  const page = await openDashboard({ server, hash: "#spec", token: null });
  assert.ok(page.main().includes("change proposed"), "known positive: the open entry gives the status");
  const opening = await page.click("button.requirement-name");
  const read = server.requests; // the whole test: a read the page makes after it settled is counted too
  for (const artifact of ARTIFACTS) assert.ok(!read.includes(artifact), `neither drawing #spec nor opening the requirement requests ${artifact}`);
  assert.equal(read.filter((request) => request === storedGraph(HEADS.entry)).length, 1, "the stored graph, once");
  assert.ok(page.main().includes('href="#use-case/id=UC-001"'), "known positive: the traces are shown");
  assert.deepEqual(await page.click("button.requirement-name"), [], "closing requests nothing");
  assert.deepEqual(await page.click("button.requirement-name"), [], "opening again requests nothing");
  assert.deepEqual(server.writes, []);
});

// CASE ITM-597-SYSTEM-02
// TST-597202 · level: system · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the dashboard with a stored token on the same repository, whose queue 2026-10-09_traced holds an open entry that changes TRACED RULE
// input: the real #spec drawn; its requirement opened
// expect: the page links UC-001 (known positive) and the opened requirement has no open proposals; opening requests no file of the queue; the artifacts were read, over the whole load, in batch queries, fewer requests than files
test("the dashboard reads the artifacts in batches when a requirement is opened, and no queue", async () => {
  const graphql = async (url, init) => {
    // The batch of files' texts alone; the query of the folders' entries a load reads its snapshot with (ITM-1266) is the harness's.
    if (url.pathname !== "/graphql" || !/\bf\d+:object\(/.test(JSON.parse(init.body).query)) return null;
    const repository = {};
    for (const match of JSON.parse(init.body).query.matchAll(/(f\d+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)) {
      const path = JSON.parse(match[2]).split(":").slice(1).join(":");
      repository[match[1]] = path in FILES ? { text: FILES[path], isTruncated: false } : null;
    }
    return new Response(JSON.stringify({ data: { repository } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const server = await repoServer({ files: FILES, handlers: [graphql], head: HEADS.batches });
  const page = await openDashboard({ server, hash: "#spec", token: TOKEN });
  const opening = await page.click("button.requirement-name");
  const html = page.main();
  assert.ok(html.includes('href="#use-case/id=UC-001"'), "known positive: the traces are shown");
  assert.ok(!html.includes("Open proposals"));
  // The waiting entries are listed above the specification and the page ends with the links to the list and the history of the SPEC changes
  // (MOD-trace-pages' specification view); the opened requirement's own row links none of them.
  const openedRow = /<tr class="requirement-opened">[^]*?<\/tr>/.exec(html)?.[0] ?? "";
  assert.ok(openedRow.includes("UC-001"), "known positive: the opened requirement's row is the one examined");
  assert.ok(!openedRow.includes("spec-entry"), "the opened requirement shows no proposal");
  assert.deepEqual(opening.filter((request) => request.includes("spec-freigaben")), []);
  const batches = page.requests.filter((request) => request.startsWith("handler POST"));
  assert.ok(batches.length >= 1 && batches.length < Object.keys(FILES).length, `${batches.length} batch queries for ${Object.keys(FILES).length} files`);
  assert.deepEqual(server.writes, []);
});
