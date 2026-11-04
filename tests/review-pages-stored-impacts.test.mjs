// MOD-review-pages reads the impact lists stored for the commit it shows (ITM-942), as the accepted text of docs/architecture/MOD-review-pages.md states it: "For a changed decision or
// module file, on `<k>/<id>` and in `<k>/all`, the page first reads the impact lists stored for the commit it shows (MOD-trace-graph's `storedImpacts`, one request). Where an entry's
// blob is the file's blob, the page takes the file's impact list from it. It reads the last accepted text at the entry's `before` commit with one `readFileAt` per file, and calls
// neither `traceGraph` nor `lastAcceptedText` for them. Where no entry fits, it derives both as before."
// Run: node --test tests/review-pages-stored-impacts.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-008; UC-023
// Level: unit
//
// The product is a Host of this file's own over one repository in memory with a history, keeping to MOD-repository-hosts' interface; its snapshots offer `readOn`, and the branch
// `trace-cache` holds the file `<main commit>.impacts.json` that MOD-trace-graph's publishGraph writes. Every call is recorded. The real MOD-approvals, MOD-trace-graph and MOD-documents run.
// Nothing reaches the network. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - A "traceGraph read" is any read of `<commit>.json.gz` (the stored graph) on the branch `trace-cache`, or of a file only the graph reads (the fixture's code file and test file); "lastAcceptedText" is a `readSnapshot` of a commit other than the
//     default branch's head, which is how that function reads the text at the commit of the record.
//   - The stored list is drawn without the graph: the stored list is all the page then has, so it shows the modules with their reasons, and the code files and the tests of the whole
//     list in one line each below them, as <p class="small code-files"> and <p class="small tests"> children of <section class="change-impact">.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { blobOf, byClass, draw, failure, GITHUB, text, fetched } from "./review-pages-draft-world.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const SPEC = text("# Fixture - Specification", "", "## 1. Rules", "", "**RULE ONE** *(Product Owner)*", "First rule.", "*Check:* `tests/reader.test.mjs`", "",
  "**RULE TWO** *(Product Owner)*", "Second rule.", "*Check:* `tests/reader.test.mjs`");
const UC1 = text("---", "id: UC-001", "title: Read a book", "area: reading", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Read a book", "", "**Goal.** Read.");
const ARC1 = text("---", "id: ARC-001", "title: ARC-001 title", "forced_by:", "  - RULE ONE", "designs:", "  - MOD-reader", "---", "# ARC-001 ARC-001 title", "", "## Context", "", "Books are read.",
  "", "## Decision", "", "Reading is one module.", "", "## Alternatives", "", "None.", "", "## Consequences", "", "Folders.");
const module_ = (realises, sentence) => text("---", "id: MOD-reader", "title: MOD-reader title", "folder: src/reader/", "realises:", ...realises.map((name) => `  - ${name}`), "follows:", "  - ARC-001",
  "uses:", "provides:", "  - lend", "---", "# MOD-reader MOD-reader title", "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", "- `lend(book) -> loan` - lends a book.", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const READER_PATH = "docs/architecture/MOD-reader.md", ARC1_PATH = "docs/architecture/ARC-001-reading.md";
const READER_BEFORE = module_(["RULE ONE", "UC-001"], "It does one thing.");
const READER_AFTER = module_(["RULE ONE", "RULE TWO"], "It does one thing, and does it well.");
const BASE = { "README.md": "# Fixture\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-book.md": UC1, [ARC1_PATH]: ARC1, [READER_PATH]: READER_BEFORE,
  "tests/reader.test.mjs": text("// TST-801 · level: unit · module: MOD-reader", "// guards: RULE ONE"), "src/reader/read.mjs": "export const read = 1;\n" };
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// Commit 1 holds the product, commit 2 the approval records of UC-001, ARC-001 and MOD-reader, commit 3 the change of MOD-reader.
const STEPS = [BASE, Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-read-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", ARC1_PATH, ARC1),
  recordOf("MOD-reader", "module", READER_PATH, READER_BEFORE)]), { [READER_PATH]: READER_AFTER }];

// The impact list the branch trace-cache stores, distinct from what the page would derive: a code file, a test and an item the derivation would not give.
const STORED_IMPACT = { modules: [{ id: "MOD-reader", why: "changed", breaks: false }], codeFiles: ["src/reader/stored-marker.mjs"], tests: [{ id: "TST-STORED", guards: ["RULE TWO"] }],
  named: { added: ["RULE TWO"], removed: ["UC-001"] }, items: ["ITM-STORED"] };

// A Host of this file's own. `stored` is what the branch holds for the head commit: { blob } for the entry of MOD-reader, or null for no file.
// Each Host's commits are its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page, so two drawings never share a commit.
let products = 0;
function fakeProduct({ stored }) {
  const commits = new Map(), calls = [], product = ++products;
  let made = 0, head = null, accepted = null;
  for (const files of STEPS) {
    const sha = createHash("sha1").update(`product ${product} commit ${++made}`).digest("hex");
    commits.set(sha, { tree: new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), parent: head, date: `2026-10-0${made}T10:00:00Z` });
    if (made === 2) accepted = sha;
    head = sha;
  }
  // The graph the push job stores for a commit (tests/stored-graph-fake.mjs), built from a read that is not recorded: building it is the push job's work, not the page's.
  const graphs = new Map();
  const graphOf = (sha) => {
    if (!graphs.has(sha)) { const { tree } = commits.get(sha); graphs.set(sha, storedGraphReadOn({ commit: sha, paths: [...tree.keys()], read: async (each) => tree.get(each) ?? null })); }
    return graphs.get(sha);
  };
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => { calls.push({ fn: "read", path }); return tree.has(path) ? tree.get(path) : null; },
      readMany: async (paths) => { calls.push({ fn: "readMany", sha, paths }); },
      readOn: async (branch, path, options) => {
        calls.push({ fn: "readOn", branch, path });
        if (branch === "trace-cache" && path.endsWith(".json.gz")) return graphOf(sha)(branch, path, options);
        if (branch !== "trace-cache" || path !== `${head}.impacts.json` || stored === null) return null;
        return JSON.stringify({ format: "agent-m-trace-impacts", version: 1, commit: head, entries: [{ path: READER_PATH, blob: stored.blob, before: accepted, impact: STORED_IMPACT }] });
      },
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    calls, accepted,
    host: {
      async repositoryInfo() { calls.push({ fn: "repositoryInfo" }); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        calls.push({ fn: "readSnapshot", ref });
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        calls.push({ fn: "readHistory", path });
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async readFileAt(path, shas) {
        calls.push({ fn: "readFileAt", path, shas });
        return new Map(shas.map((sha) => [sha, commits.get(sha).tree.get(path) ?? null]));
      },
      async commitFiles() { throw failure("Unexpected", "nothing is written"); },
    },
  };
}

const impactOf = (target) => byClass(target, "section", "change-impact")[0];
const namesOf = (impact) => byClass(impact, "span", "module-head").map((node) => node.textContent);
const linesOf = (impact) => impact.childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.className.split(" ").includes("small")).map((node) => node.textContent);
const GRAPH_ONLY = ["src/reader/read.mjs", "tests/reader.test.mjs"];
const counted = (fake) => ({
  graphReads: fake.calls.filter((call) => (call.fn === "readOn" && !call.path.endsWith(".impacts.json")) || (call.fn === "read" && GRAPH_ONLY.includes(call.path))).length,
  lastAccepted: fake.calls.filter((call) => call.fn === "readSnapshot" && call.ref !== "main").length,
  readFileAt: fake.calls.filter((call) => call.fn === "readFileAt"),
  storedReads: fake.calls.filter((call) => call.fn === "readOn" && call.path.endsWith(".impacts.json")).length,
});
const STORED_LINES = ["Affected modules", "Requirements and use cases — newly named: RULE TWO · no longer named: UC-001", "Items — ITM-STORED"];
const fitting = { stored: { blob: blobOf(READER_AFTER) } };

// TST-942001 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: MOD-reader accepted and changed since; the branch trace-cache holds an entry for it whose blob is the file's blob, with an impact list the derivation would not give
// input: the route module with the id all
// expect: the stored impact list is shown; the difference is against the text at the entry's before commit; one read of the stored lists, one readFileAt of MOD-reader at before, no traceGraph read and no lastAcceptedText call
test("module/all — a fitting stored entry gives the impact list and the text at before, and no graph is read", async () => {
  const fake = fakeProduct(fitting);
  const { target } = await draw(fake, "module", { id: "all" });
  const impact = impactOf(target);
  assert.ok(impact, "the impact list");
  assert.deepEqual(namesOf(impact), ["MOD-reader — changed"]);
  assert.deepEqual(linesOf(impact).filter((line) => !/^(Code files|Tests) —/.test(line)), STORED_LINES);
  assert.ok(impact.textContent.includes("Code files — src/reader/stored-marker.mjs"), "the stored code files");
  assert.ok(impact.textContent.includes("Tests — TST-STORED (guards RULE TWO)"), "the stored tests");
  const diff = byClass(target, "section", "accepted-diff")[0];
  assert.ok(diff.textContent.includes("It does one thing, and does it well."), "the difference shows the text now");
  assert.ok(diff.textContent.includes("UC-001"), "the difference is against the text at before");
  const counts = counted(fake);
  assert.equal(counts.storedReads, 1, "the stored lists are read in one request");
  assert.equal(counts.graphReads, 0, "no traceGraph read");
  assert.equal(counts.lastAccepted, 0, "no lastAcceptedText call");
  assert.deepEqual(counts.readFileAt.map(({ path, shas }) => [path, shas]), [[READER_PATH, [fake.accepted]]], "one readFileAt of the file at before");
});

// TST-942002 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: the same repository
// input: the route module for MOD-reader
// expect: the same stored impact list and counts as on module/all
test("module/<id> — a fitting stored entry gives the impact list and the text at before, and no graph is read", async () => {
  const fake = fakeProduct(fitting);
  const { target } = await draw(fake, "module", { id: "MOD-reader" });
  assert.deepEqual(namesOf(impactOf(target)), ["MOD-reader — changed"]);
  assert.ok(impactOf(target).textContent.includes("ITM-STORED"), "the stored list");
  const counts = counted(fake);
  assert.deepEqual([counts.storedReads, counts.graphReads, counts.lastAccepted, counts.readFileAt.length], [1, 0, 0, 1]);
});

// TST-942003 · level: unit · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: the branch holds an entry for MOD-reader with another blob than the file's (stale)
// input: the route module with the id all, and for MOD-reader
// expect: the page derives both as before: the stored list is not shown, the one readFileAt is lastAcceptedText's, of the file at the commit of the record, no snapshot of an older commit is read, the graph is read
test("a stale stored entry is not used: the page derives the impact list and the last accepted text", async () => {
  for (const params of [{ id: "all" }, { id: "MOD-reader" }]) {
    const fake = fakeProduct({ stored: { blob: blobOf(READER_BEFORE) } });
    const { target } = await draw(fake, "module", params);
    const impact = impactOf(target);
    assert.ok(impact, "an impact list");
    assert.ok(!impact.textContent.includes("ITM-STORED"), "not the stored list");
    assert.deepEqual(namesOf(impact), ["MOD-reader — changed"]);
    assert.ok(impact.textContent.includes("src/reader/read.mjs"), "the code files derived from the graph");
    const counts = counted(fake);
    assert.equal(counts.readFileAt.length, 1, "lastAcceptedText's readFileAt, and no other");
    assert.equal(counts.lastAccepted, 0, "no snapshot of an older commit");
    assert.ok(counts.graphReads > 0, "the graph was read");
  }
});

// TST-942004 · level: unit · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// given: the branch has no file for the head commit
// input: the route module for MOD-reader
// expect: the page derives both as before, and the derived list names the file's module
test("without a stored file the page derives as before", async () => {
  const fake = fakeProduct({ stored: null });
  const { target } = await draw(fake, "module", { id: "MOD-reader" });
  assert.deepEqual(namesOf(impactOf(target)), ["MOD-reader — changed"]);
  assert.equal(counted(fake).readFileAt.length, 1, "lastAcceptedText's readFileAt");
  assert.equal(counted(fake).lastAccepted, 0, "no snapshot of an older commit");
});
