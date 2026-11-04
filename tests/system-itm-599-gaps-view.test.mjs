// The gaps page through the frame (ITM-599): MOD-site-frame's startPage over the view of MOD-trace-pages, the route `trace` with the key `gaps` named by the address's
// fragment, the product the fragment names connected by the frame from this browser's store with its own token or without one, against MOD-repository-hosts' real
// GitHub host, answered by a fake of fetch over a repository that holds files at refs (tests/trace-pages-world.mjs). Nothing reaches the network: every request is recorded.
//
// Run: node --test tests/system-itm-599-gaps-view.test.mjs
//
// Module: MOD-trace-pages; MOD-site-frame
// Guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: system
//
// Each case states its input and its expected values in its own text; none reads an expected value from a document. The product is https://github.com/alice/thesis-tool: a SPEC of
// ALPHA RULE and DELTA RULE, UC-001 and MOD-direct, which realise ALPHA RULE, and the test TST-501, which guards it — so DELTA RULE is the one gap of each kind, and the graph, built
// from four files by the workflow "main changed", is stored as `<commit>.json.gz` on the branch trace-cache, which the page reads and never builds. A request of the page to the product's repository is of one of three kinds: `api` (a REST call: the repository's information, its tags, the commit of a ref,
// that commit's tree and, with a token, a file through the contents API), `graphql` (a batch of files, with a token) and `raw` (a file from the raw host, without a token).

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, until } from "./trace-pages-harness.mjs";
import { counted, githubWorld, installBrowser } from "./trace-pages-world.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const { startPage } = await import("../src/site-frame/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");

const INSTANCE = "akmaier/agent-m";
const PRODUCT = "https://github.com/alice/thesis-tool";
const REPO = "alice/thesis-tool";
const TOKEN = "github_pat_PRODUCT0123456789abcdefghijk";
const INSTANCE_TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
const TICK = "`";
const FILES = {
  "SPEC.md": ["# Thesis tool — Specification", "", "## Export", "",
    "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", `*Check:* ${TICK}tests/alpha.test.mjs${TICK}`, "",
    "**DELTA RULE** *(Vibe Coding)*", "Delta rule.", "*Check:* at review.", ""].join("\n"),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
  "docs/architecture/MOD-direct.md": doc("MOD-direct", "Direct module", { folder: "src/direct/", realises: ["ALPHA RULE"] }),
  "tests/alpha.test.mjs": ["// TST-501", "// level: unit", "// module: MOD-direct", "// guards: ALPHA RULE", ""].join("\n"),
};
const GRAPH_FILES = ["docs/architecture/MOD-direct.md", "docs/use-cases/UC-001-first.md", "tests/alpha.test.mjs"];
const GAPS = `#trace/key=gaps/ref=main/product=${encodeURIComponent(PRODUCT)}`;
const OTHER = `#trace/key=timeline/ref=main/product=${encodeURIComponent(PRODUCT)}`;

const mainText = () => find(document.body, (node) => node.localName === "main")[0].textContent;
const lists = () => find(document.body, (node) => node.localName === "section" && node.className === "gaps-list");
const linesOf = (section) => find(section, (node) => node.localName === "li").map((node) => node.textContent);
const settle = async () => { await until(() => false, 150); };
const pageIsGaps = () => /Matrix/.test(mainText());

// A person opens the page at `fragment`, with the product kept in this browser — with its own token where `token` is true — and the frame started on the view of MOD-trace-pages.
async function visit(t, fragment, { token, instanceToken = false, repositories = { [REPO]: { main: FILES }, [INSTANCE]: { main: {} } } }) {
  const world = githubWorld(repositories);
  const realFetch = globalThis.fetch;
  const realInterval = globalThis.setInterval;
  globalThis.fetch = world.fetch;
  globalThis.setInterval = () => 1;
  t.after(() => { globalThis.fetch = realFetch; globalThis.setInterval = realInterval; });
  const browser = installBrowser(fragment);
  const store = openStore(INSTANCE);
  writeSetting(store, "products", [PRODUCT]);
  if (token) writeSetting(store, `github-token:${REPO}`, { value: TOKEN, name: "Agent M · alice/thesis-tool", expires: "2027-01-01" });
  if (instanceToken) writeSetting(store, "github-token", { value: INSTANCE_TOKEN, name: "Agent M · akmaier/agent-m", expires: "2027-01-01" });
  await startPage({ page: "review", views: [view] });
  await settle();
  return { world, browser, product: () => world.forRepository(REPO) };
}

// CASE ITM-599-SYSTEM-01
// TST-599201 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: this browser keeps the product https://github.com/alice/thesis-tool without a token; its default branch main holds the four files above
// input: the address #trace/key=gaps/ref=main/product=<the product> is opened
// expect: the frame shows the page headed "Gaps" with DELTA RULE under each of the three lists of requirements and the matrix rows ALPHA RULE (UC-001, none, MOD-direct, TST-501) and DELTA RULE (none in all four); the product is asked for 4 REST calls (its information, its tags, main's commit and that commit's tree), 2 files from the raw host — SPEC.md and the graph stored on the branch trace-cache, <commit>.json.gz — and for no GraphQL batch: no file of the graph is read; no request carries an authorisation; no request goes anywhere but to the repository's API and raw host
test("without a token, the gaps page is drawn from SPEC.md and the stored graph from the raw host: four REST calls and two files", async (t) => {
  const page = await visit(t, GAPS, { token: false });
  assert.match(mainText(), /Gaps/);
  assert.deepEqual(lists().map(linesOf), [["DELTA RULE"], ["DELTA RULE"], ["DELTA RULE"], [], []]);
  assert.match(mainText(), /ALPHA RULEUC-001noneMOD-directTST-501DELTA RULEnonenonenonenone/);
  assert.deepEqual(counted(page.product()), { api: 4, graphql: 0, raw: 2 });
  const raw = page.product().filter((request) => request.kind === "raw");
  assert.equal(raw[0].file, "SPEC.md");
  assert.match(raw[1].path, /^\/alice\/thesis-tool\/trace-cache\/[0-9a-f]{40}\.json\.gz$/, "the stored graph, read from trace-cache");
  assert.deepEqual(page.product().filter((request) => request.authorization !== null), []);
  assert.deepEqual(page.world.requests.filter((request) => request.kind === "other"), []);
});

// CASE ITM-599-SYSTEM-02
// TST-599202 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED
// given: the same product, kept in this browser with its own token
// input: the address #trace/key=gaps/ref=main/product=<the product> is opened
// expect: the page shows the same lists and rows as without a token; the product is asked for 6 REST calls (the 4 above, SPEC.md through the contents API and the graph stored on trace-cache through the contents API, contents/<commit>.json.gz?ref=trace-cache) and for no GraphQL batch but greenToMerge's request beside its information, which names no file (ITM-1170) — none of the files of the graph (MOD-direct's file, UC-001's, the test's) is asked for — and for no file from the raw host; every request carries the product's token
test("with a token, the gaps page is drawn from SPEC.md and the stored graph through the contents API: six REST calls and no batch", async (t) => {
  const page = await visit(t, GAPS, { token: true });
  assert.deepEqual(lists().map(linesOf), [["DELTA RULE"], ["DELTA RULE"], ["DELTA RULE"], [], []]);
  assert.match(mainText(), /ALPHA RULEUC-001noneMOD-directTST-501DELTA RULEnonenonenonenone/);
  // ITM-1170: the one GraphQL request is greenToMerge's, beside the repository's information; it names no file.
  assert.deepEqual(counted(page.product()), { api: 6, graphql: 1, raw: 0 });
  assert.equal(page.product().filter((request) => /\/contents\/[0-9a-f]{40}\.json\.gz\?ref=trace-cache$/.test(request.path)).length, 1, "the stored graph, read from trace-cache");
  assert.deepEqual(page.product().filter((request) => GRAPH_FILES.some((file) => request.path.includes(encodeURIComponent(file)) || request.path.includes(file))), [], "no file of the graph is read");
  assert.deepEqual(page.product().filter((request) => request.authorization !== `Bearer ${TOKEN}`), []);
});

// CASE ITM-599-SYSTEM-03
// TST-599203 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED
// given: the gaps page opened at main, once without and once with a token (the two cases above), then the address of a view the page does not draw, which asks the product for nothing
// input: the address #trace/key=gaps/ref=main/product=<the product> is opened a second time, at the same commit of main
// expect: the page shows the same lists; the product is asked for 4 REST calls, with a token and without — and for no GraphQL batch (with a token, only greenToMerge's request beside its information, ITM-1170) and no file, SPEC.md included, not through the contents API with a token either: the frame keeps the product's host across the navigation (ITM-669), so a blob it has read is not read again, and the graph of the commit is kept as well
test("opening the gaps page a second time at the same commit asks for the lists' files no more", async (t) => {
  for (const token of [false, true]) {
    const page = await visit(t, GAPS, { token });
    const first = page.product().length;
    page.browser.go(OTHER);
    await settle();
    assert.equal(page.product().length, first, "the other view asks the product for nothing");
    assert.equal(pageIsGaps(), false, "known positive: the gaps page is gone");
    page.browser.go(GAPS);
    await until(pageIsGaps);
    await settle();
    const second = page.product().slice(first);
    assert.deepEqual(counted(second), { api: 4, graphql: token ? 1 : 0, raw: 0 }, token ? "with a token" : "without a token");
    assert.deepEqual(lists().map(linesOf), [["DELTA RULE"], ["DELTA RULE"], ["DELTA RULE"], [], []]);
  }
});

// An opened requirement at a released version (ITM-846): the product's tag v1.0.0 holds a SPEC whose requirement ALPHA RULE names the person's source SRC-acme-person, the product's links
// file docs/sources.md, and the use case UC-001; the instance akmaier/agent-m holds the register, two entries of docs/sources/. The register is read for the opened requirement only: a
// deep link to the tag does not draw the default branch, whose drawing would have read it for the prompt bar.
const SHA = "0".repeat(64);
const entryOf = (id, account) => ["---", `id: ${id}`, "title: A person", "kind: person", "authority: normative", "licence: may be republished — fixture", `identifier: ${account}`, "---",
  `# ${id} A person`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| ${TICK}2026-10-11${TICK} | 2026-10-11 | the fixture | this repository | one file, hashed only |`, ""].join("\n");
const RELEASED = {
  "SPEC.md": ["# Thesis tool — Specification", "", "## Export", "", "**ALPHA RULE** *(SRC-acme-person)*", "Alpha rule.", "*Check:* at review.", ""].join("\n"),
  "docs/sources.md": ["# Sources", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-acme-person | 2026-10-11 | ${SHA} | |`, ""].join("\n"),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
};
const REGISTER_FILES = ["docs/sources/SRC-acme-person.md", "docs/sources/SRC-other-person.md"];
const REGISTER = Object.fromEntries(REGISTER_FILES.map((path) => [path, entryOf(path.slice("docs/sources/".length, -3), "github.com/alice")]));
const RELEASE_LINK = `#trace/key=specification/ref=v1.0.0/product=${encodeURIComponent(PRODUCT)}`;

// The requests the product's and the instance's repositories are asked for by one click on the requirement, as { product, instance }.
async function clickAlpha(t, { tokens, link = RELEASE_LINK, repositories = { [REPO]: { main: FILES, "v1.0.0": RELEASED }, [INSTANCE]: { main: REGISTER } } }) {
  const page = await visit(t, link, { token: tokens, instanceToken: tokens, repositories });
  assert.match(mainText(), /ALPHA RULE/, "known positive: the specification is drawn");
  const before = { product: page.product().length, instance: page.world.forRepository(INSTANCE).length };
  find(document.body, (node) => node.localName === "button" && node.textContent === "ALPHA RULE")[0].dispatchEvent(new Event("click"));
  await until(() => /A person — version 2026-10-11/.test(mainText()));
  await settle();
  assert.match(mainText(), /A person — version 2026-10-11/, "known positive: the sources of the opened requirement are shown");
  return { product: page.product().slice(before.product), instance: page.world.forRepository(INSTANCE).slice(before.instance) };
}

// CASE ITM-846-SYSTEM-01
// TST-846201 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: this browser keeps the product and the instance, each with its own token; the address of the specification at the tag v1.0.0 is opened
// input: the requirement ALPHA RULE is opened
// expect: the instance is asked for 3 REST calls (its information, the commit of main, that commit's tree), 1 GraphQL batch that names the two register entries and greenToMerge's GraphQL request beside its information, which names none (ITM-1170), and for no file from the raw host; the product is asked for 2 REST calls (docs/sources.md through the contents API, and the graph stored on trace-cache, contents/<commit>.json.gz?ref=trace-cache) and for no GraphQL batch: UC-001's file, a file of the graph, is not read; every request carries the token of its repository
test("with tokens, an opened requirement at a released version reads the register entries in one GraphQL batch", async (t) => {
  const asked = await clickAlpha(t, { tokens: true });
  assert.deepEqual(counted(asked.instance), { api: 3, graphql: 2, raw: 0 });
  assert.deepEqual(asked.instance.filter((request) => request.kind === "graphql").map((request) => [...request.files].sort()).sort(), [[], REGISTER_FILES], "the batch of the entries, and greenToMerge's of no file (ITM-1170)");
  assert.deepEqual(counted(asked.product), { api: 2, graphql: 0, raw: 0 });
  assert.equal(asked.product.filter((request) => /\/contents\/[0-9a-f]{40}\.json\.gz\?ref=trace-cache$/.test(request.path)).length, 1, "the stored graph, read from trace-cache");
  assert.deepEqual(asked.instance.filter((request) => request.authorization !== `Bearer ${INSTANCE_TOKEN}`), []);
  assert.deepEqual(asked.product.filter((request) => request.authorization !== `Bearer ${TOKEN}`), []);
});

// CASE ITM-846-SYSTEM-02
// TST-846202 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same, with no token stored
// input: the requirement ALPHA RULE is opened
// expect: GitHub's batch query needs a token, so none is sent: the instance is asked for 3 REST calls and the 2 register entries from the raw host, one request each; the product for 2 files from the raw host — docs/sources.md and the graph stored on the branch trace-cache, <commit>.json.gz — and for no REST call: UC-001's file, a file of the graph, is not read
test("without a token, an opened requirement reads each register entry by its own request", async (t) => {
  const asked = await clickAlpha(t, { tokens: false });
  assert.deepEqual(counted(asked.instance), { api: 3, graphql: 0, raw: 2 });
  assert.deepEqual(asked.instance.filter((request) => request.kind === "raw").map((request) => request.file).sort(), REGISTER_FILES);
  assert.deepEqual(counted(asked.product), { api: 0, graphql: 0, raw: 2 });
  const productFiles = asked.product.filter((request) => request.kind === "raw").map((request) => request.file).sort();
  const stored = (file) => /^[0-9a-f]{40}\.json\.gz$/.test(file);
  assert.equal(productFiles.filter(stored).length, 1, "one request for the graph stored on trace-cache");
  assert.deepEqual(productFiles.filter((file) => !stored(file)), ["docs/sources.md"]);
});

// An opened requirement on the default branch (ITM-867): the product's main holds the released text above (ALPHA RULE naming SRC-acme-person, docs/sources.md, UC-001), and the instance's main the
// register. Drawing the page on the default branch reads the instance already, for the prompt bar's person, and the frame reads its information, commit and tree of its own for what it shows
// around the page; the click is counted from the moment the page is drawn.
const MAIN_LINK = `#trace/key=specification/ref=main/product=${encodeURIComponent(PRODUCT)}`;
const ON_MAIN = { [REPO]: { main: RELEASED }, [INSTANCE]: { main: REGISTER } };

// CASE ITM-867-SYSTEM-01
// TST-867201 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: this browser keeps the product and the instance, each with its own token; the address of the specification at the default branch main is opened
// input: the requirement ALPHA RULE is opened
// expect: the opening asks the instance for no request at all — 0 REST calls, 0 GraphQL batches, 0 files from the raw host —, since the instance's commit, its tree and the register's entries were read when the page was drawn; known positive: the Sources read "A person — version 2026-10-11" (the opening of ITM-846-SYSTEM-01 at the tag, which the instance side asks for 3 REST calls and 1 GraphQL batch, is unchanged)
test("with tokens, an opened requirement on the default branch asks the instance for nothing more", async (t) => {
  const asked = await clickAlpha(t, { tokens: true, link: MAIN_LINK, repositories: ON_MAIN });
  assert.deepEqual(counted(asked.instance), { api: 0, graphql: 0, raw: 0 });
});

// CASE ITM-867-SYSTEM-02
// TST-867202 · level: system · module: MOD-trace-pages; MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same, with no token stored
// input: the requirement ALPHA RULE is opened
// expect: the opening asks the instance for no request at all — 0 REST calls and 0 files from the raw host
test("without a token, an opened requirement on the default branch asks the instance for nothing more", async (t) => {
  const asked = await clickAlpha(t, { tokens: false, link: MAIN_LINK, repositories: ON_MAIN });
  assert.deepEqual(counted(asked.instance), { api: 0, graphql: 0, raw: 0 });
});
