// + New version of a fetched EU legal text starts the fetch run (ITM-900) — MOD-settings-pages' route `library/<source>`, as docs/architecture/MOD-settings-pages.md states it: "*Fetch again* for a legal text whose fetch
// failed, and *+ New version* of a fetched one, each starting the fetch run for that entry (MOD-repository-hosts' `startWorkflow` with the input `source`)", and UC-016 step 1. The run appends the newer text
// (tests/workflow-entries-sources-newer-version.test.mjs). The route is rendered into the fixture DOM of tests/settings-pages-harness.mjs over MOD-repository-hosts' real GitHub host, answered by a fake of fetch
// (tests/settings-pages-sources.d/github.mjs, with the runs and the dispatch of tests/settings-pages-sources.d/dispatch.mjs); nothing reaches the network.
// Run: node --test tests/settings-pages-library-legal-text-version.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-016; UC-004; A SOURCE VERSION IS NEVER OVERWRITTEN; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// Each test names its input and states its expected result in its own text (given / input / expect) before it runs; no expected value is read from a document, and none from the code. Where the texts leave a reading open,
// the test states the reading it takes:
//   - A "fetched" legal text is an entry the page reads as an EU legal text (its `identifier` a CELEX number or an ELI, bare or in an address) with at least one version row; the entry of a legal text with no version waits
//     for its fetch, and its *Fetch again* is on the list, not on this page.
//   - The run is started on the repository's default branch with the input `source` holding the entry's identifier (SRC-…), and no other input.
//   - "Shown before the person presses it" (ITM-951): the folded explanation is in the page's drawing as the route leaves it, and none of its ancestors is hidden; a panel that stays hidden does not show it.
// The counter-proofs (a planted fault in src/settings-pages/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byClass, click } from "./settings-pages-harness.mjs";
import { attachedTarget, freshStore } from "./settings-pages-setup.d/dom.mjs";
import { githubWorld, installWorld, isWrite } from "./settings-pages-sources.d/github.mjs";
import { withRuns } from "./settings-pages-sources.d/dispatch.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { writeSetting } = await import("../src/browser-store/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const { explain } = await import("../src/site-frame/index.mjs");
const library = view.routes.find((candidate) => candidate.name === "library");

const INSTANCE = "akmaier/agent-m";
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
const ADDRESS = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689";
const entryText = (id, identifier) => ["---", `id: ${id}`, `title: ${id} text`, "kind: regulation", "authority: normative", "licence: may be republished — EU law", `identifier: ${identifier}`, "---",
  `# ${id} ${id} text`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`cellar-existing\` | 2024-07-12 | - | publication repository | 1 file, listed below; version hash \`${"a".repeat(64)}\` |`, "", "### Files of cellar-existing", "", "| File | SHA-256 | Kept at |", "|---|---|---|",
  `| \`32024R1689.xhtml\` | \`${"b".repeat(64)}\` | — |`, ""].join("\n");

async function open(t, id, identifier, { dispatchStatus } = {}) {
  const world = githubWorld({ [INSTANCE]: { files: { [`docs/sources/${id}.md`]: entryText(id, identifier) } } });
  installWorld(t, world);
  const runs = withRuns(world, INSTANCE, { dispatchStatus });
  globalThis.fetch = runs.fetch;
  const store = freshStore();
  writeSetting(store, "github-token", { value: TOKEN, name: "Agent M", expires: "2027-01-01" });
  const context = { page: "review", instance: { repository: INSTANCE, host: connect(parseAddress(`https://github.com/${INSTANCE}`), { token: TOKEN }) }, product: null, store, went: [], go() {} };
  const target = attachedTarget();
  await library.render(target, context, { source: id });
  return { world, target, dispatched: runs.dispatched };
}
const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };

// TST-900007 · level: unit · module: MOD-settings-pages
// guards: UC-016; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; ONE CLICK PER DECISION; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: the entry SRC-ai-act of an EU legal text with an EUR-Lex address as its identifier and one version, and the entry SRC-ai-bare with the bare CELEX number 32024R1689 and one version (each in its own instance)
// input: render library/<entry>; press + New version
// expect: for each, no field for files is offered; the instance's workflow fetch-sources.yml is started once, on the branch main, with exactly the input source = the entry's identifier (SRC-ai-act, SRC-ai-bare); the result reads "✓ The fetch workflow was started for <entry>: a newer text is recorded as a further version, the same text is not recorded again."; the page writes nothing to any repository
test("new version — of a fetched EU legal text it starts the fetch run for that entry and offers no file", async (t) => {
  for (const [id, identifier] of [["SRC-ai-act", ADDRESS], ["SRC-ai-bare", "32024R1689"]]) {
    const page = await open(t, id, identifier);
    await click(one(page.target, "library-new-version"));
    assert.equal(byClass(page.target, "library-version-files").length, 0, `${id}: no field for files`);
    assert.deepEqual(page.dispatched, [{ ref: "main", inputs: { source: id } }], id);
    assert.equal(one(page.target, "library-version-result").textContent,
      `✓ The fetch workflow was started for ${id}: a newer text is recorded as a further version, the same text is not recorded again.`, id);
    assert.deepEqual(page.world.requests.filter(isWrite), [], `${id}: nothing is written`);
  }
});

// TST-900008 · level: unit · module: MOD-settings-pages
// guards: UC-016; ONE CLICK PER DECISION
// given: the same entry SRC-ai-act; the server refuses the dispatch (422, an input it does not know)
// input: press + New version
// expect: the result begins "✗ The fetch workflow could not be started for SRC-ai-act: " and says why in the server's words; nothing is written to any repository
test("new version — a fetch run the server refuses is said so, and nothing is written", async (t) => {
  const page = await open(t, "SRC-ai-act", ADDRESS, { dispatchStatus: 422 });
  await click(one(page.target, "library-new-version"));
  const result = one(page.target, "library-version-result").textContent;
  assert.equal(result.startsWith("✗ The fetch workflow could not be started for SRC-ai-act: "), true, result);
  assert.deepEqual(page.world.requests.filter(isWrite), []);
});

// Whether the element or one of its ancestors is hidden, as a panel kept out of view is.
const hiddenAbove = (node) => { for (let n = node; n; n = n.parentNode) if (n.hasAttribute?.("hidden") || n.hidden === true) return true; return false; };

// TST-951001 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-016
// given: the entry SRC-ai-act of an EU legal text with an EUR-Lex address and one version (a fetched legal text); the route library/SRC-ai-act rendered, + New version not pressed
// input: look at the page before any press
// expect: exactly one folded What is this? of the topic source-new-version stands on the page — a details of class explain that is closed, none of whose ancestors is hidden, whose body is the same rendered text as explain("source-new-version") gives; pressing + New version afterwards leaves exactly that one on the page and still starts exactly one run
test("new version — of a fetched EU legal text the page shows the folded explanation of + New version before it is pressed", async (t) => {
  const page = await open(t, "SRC-ai-act", ADDRESS);
  const wanted = explain("source-new-version").children[1].innerHTML;
  assert.equal(wanted.length > 0, true, "known positive: the topic has a text");
  const found = () => byClass(page.target, "explain").filter((node) => node.children[1]?.innerHTML === wanted);
  assert.equal(found().length, 1);
  assert.equal(found()[0].hasAttribute("open"), false);
  assert.equal(hiddenAbove(found()[0]), false);
  assert.deepEqual(page.dispatched, [], "reading it starts no run");
  await click(one(page.target, "library-new-version"));
  assert.equal(found().length, 1);
  assert.deepEqual(page.dispatched, [{ ref: "main", inputs: { source: "SRC-ai-act" } }]);
});

// TST-951002 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-016
// given: the same fetched legal text SRC-ai-act
// input: look at the explanation shown before + New version is pressed
// expect: its text says what + New version does for such a source: it contains "starts the fetch run for the entry" and "the same text is not recorded again"
test("new version — the explanation shown for a fetched EU legal text says that + New version starts the fetch run", async (t) => {
  const page = await open(t, "SRC-ai-act", ADDRESS);
  const wanted = explain("source-new-version").children[1].innerHTML;
  const shown = byClass(page.target, "explain").filter((node) => node.children[1]?.innerHTML === wanted);
  assert.equal(shown.length, 1);
  const text = shown[0].textContent.replace(/\s+/g, " ");
  assert.equal(text.includes("starts the fetch run for the entry"), true, text);
  assert.equal(text.includes("the same text is not recorded again"), true, text);
});
